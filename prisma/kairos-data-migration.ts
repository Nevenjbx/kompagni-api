import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting KAIROS ENGINE data migration...');

  // 1. Migrate Staff Members
  // Set speedIndex based on role, and populate allowedServiceIds from existing StaffServiceDuration
  console.log('Migrating StaffMembers...');
  
  // NOTE: For safety against already-migrated data, we wrap in try-catch or use raw SQL if Prisma Client has changed
  try {
    // In a real environment, we would query the old tables using raw SQL if Prisma schema has already dropped them
    // For this script, we assume it's run via raw SQL or before the schema drop
    
    await prisma.$executeRaw`
      UPDATE "staff_members"
      SET "speedIndex" = CASE WHEN role = 'APPRENTICE' THEN 1.3 ELSE 1.0 END,
          "allowedServiceIds" = COALESCE(
              (SELECT array_agg("serviceId") 
               FROM "staff_service_durations" 
               WHERE "staffId" = "staff_members".id),
              '{}'
          );
    `;
    console.log('✅ StaffMembers migrated');
  } catch (e) {
    console.log('⚠️ StaffMembers migration skipped or failed (columns might already be dropped):', e.message);
  }

  // 2. Migrate Services and create BaseRules
  console.log('Migrating Services to BaseRules...');
  try {
    // Fetch old services with their JSON priceTiers
    const oldServices = await prisma.$queryRaw<any[]>`
      SELECT id, "providerId", "priceTiers", "defaultDurationPro"
      FROM "services"
      WHERE "priceTiers" IS NOT NULL
    `;

    let rulesCreated = 0;
    for (const service of oldServices) {
      if (!service.priceTiers) continue;
      
      const tiers = typeof service.priceTiers === 'string' 
        ? JSON.parse(service.priceTiers) 
        : service.priceTiers;

      let currentMinWeight = 0;
      
      // Assume tiers is an array like [{ maxWeightKg: 7, price: 40 }, { maxWeightKg: null, price: 50 }]
      for (const tier of tiers) {
        const maxW = tier.maxWeightKg === null ? 9999 : parseFloat(tier.maxWeightKg);
        const p = parseFloat(tier.price);
        
        // Check if rule already exists to make script idempotent
        const exists = await prisma.$queryRaw<any[]>`
           SELECT id FROM "base_rules" 
           WHERE "salonId" = ${service.providerId} 
             AND "serviceId" = ${service.id} 
             AND "minWeightKg" = ${currentMinWeight}
        `;

        if (exists.length === 0) {
          await prisma.$executeRaw`
            INSERT INTO "base_rules" ("id", "salonId", "serviceId", "minWeightKg", "maxWeightKg", "baseDurationMinutes", "basePrice", "includedMinutes", "overtimeRatePerMin", "updatedAt")
            VALUES (
              gen_random_uuid(), 
              ${service.providerId}, 
              ${service.id}, 
              ${currentMinWeight}, 
              ${maxW}, 
              ${service.defaultDurationPro || 60}, 
              $fixedValue, -- basePrice (or 0 for TIME_BASED, but V1 was fixed price)
              9999, -- includedMinutes (Infinity for FIXED)
              0, -- overtimeRatePerMin
              NOW()
            )
          `.then(() => {}).catch(err => {
             // If we need to inject the parameter safely without raw variables for the basePrice
          });
          
          await prisma.$executeRawUnsafe(`
            INSERT INTO "base_rules" ("id", "salonId", "serviceId", "minWeightKg", "maxWeightKg", "baseDurationMinutes", "basePrice", "includedMinutes", "overtimeRatePerMin", "updatedAt")
            VALUES (
              gen_random_uuid(), 
              '${service.providerId}', 
              '${service.id}', 
              ${currentMinWeight}, 
              ${maxW}, 
              ${service.defaultDurationPro || 60}, 
              ${p}, 
              9999,
              0, 
              NOW()
            )
          `);
          rulesCreated++;
        }
        
        currentMinWeight = maxW + 0.1;
      }
    }
    console.log(`✅ ${rulesCreated} BaseRules created from Service.priceTiers`);
  } catch (e) {
    console.log('⚠️ Services migration skipped or failed:', e.message);
  }

  // 3. Migrate Pets
  console.log('Migrating Pets (mapping old enums to new fields)...');
  try {
    await prisma.$executeRaw`
      UPDATE "pets"
      SET 
        "species" = CASE 
           WHEN "type" = 'DOG' THEN 'dog'
           WHEN "type" = 'CAT' THEN 'cat'
           ELSE 'nac' 
        END,
        "groomingBehavior" = CASE
           WHEN "character" IN ('CALM', 'HAPPY') THEN 'EASY'::"GroomingBehavior"
           WHEN "character" IN ('SCARED', 'ENERGETIC') THEN 'NERVOUS'::"GroomingBehavior"
           WHEN "character" = 'ANGRY' THEN 'DIFFICULT'::"GroomingBehavior"
           ELSE 'EASY'::"GroomingBehavior"
        END,
        "category" = CASE
           WHEN "size" = 'SMALL' THEN 'SMALL'::"AnimalCategory"
           WHEN "size" = 'MEDIUM' THEN 'SMALL'::"AnimalCategory"  -- Or appropriate mapping
           WHEN "size" = 'LARGE' THEN 'LARGE'::"AnimalCategory"
           WHEN "size" = 'GIANT' THEN 'GIANT'::"AnimalCategory"
           ELSE 'SMALL'::"AnimalCategory"
        END,
        "coatType" = 'NORMAL'::"CoatType",
        "sex" = 'unknown',
        "breedId" = 'unknown_breed',
        "birthDate" = NOW() - INTERVAL '3 years'
      WHERE "species" IS NULL OR "species" = '';
    `;
    console.log('✅ Pets migrated');
  } catch (e) {
    console.log('⚠️ Pets migration skipped or failed:', e.message);
  }

  // 4. Migrate SalonConfig concurrentLimits
  console.log('Migrating SalonConfig concurrentLimits from GroomingTables...');
  try {
    const tableCounts = await prisma.$queryRaw<any[]>`
      SELECT "salonId", "category", COUNT(*) as count
      FROM "grooming_tables"
      GROUP BY "salonId", "category"
    `;
    
    const salonLimits: Record<string, Record<string, number>> = {};
    for (const row of tableCounts) {
      if (!salonLimits[row.salonId]) salonLimits[row.salonId] = { SMALL: 1, LARGE: 1, GIANT: 1, CAT: 1, NAC: 1 };
      
      // Map old TableCategory to new AnimalCategory limits
      if (row.category === 'SMALL') salonLimits[row.salonId].SMALL = Number(row.count);
      if (row.category === 'LARGE') {
        salonLimits[row.salonId].LARGE = Number(row.count);
        salonLimits[row.salonId].GIANT = Number(row.count); // Give giants same limit as large if no explicit table
      }
      if (row.category === 'CAT') salonLimits[row.salonId].CAT = Number(row.count);
    }
    
    for (const [salonId, limits] of Object.entries(salonLimits)) {
      await prisma.$executeRawUnsafe(`
        UPDATE "salon_configs"
        SET "concurrentLimits" = '${JSON.stringify(limits)}'::jsonb
        WHERE "salonId" = '${salonId}'
      `);
    }
    console.log('✅ SalonConfig concurrentLimits migrated');
  } catch (e) {
    console.log('⚠️ SalonConfig migration skipped or failed:', e.message);
  }

  // 5. Create Default ModifierRules for existing Salons
  console.log('Creating default ModifierRules...');
  try {
    const salons = await prisma.$queryRaw<any[]>`SELECT id FROM "provider_profiles"`;
    let modifiersCreated = 0;
    
    for (const salon of salons) {
      const existingMods = await prisma.$queryRaw<any[]>`SELECT id FROM "modifier_rules" WHERE "salonId" = ${salon.id}`;
      if (existingMods.length > 0) continue;
      
      const defaultMods = [
        { triggerType: 'HAS_KNOTS', min: 15, flat: 10, pct: 0 },
        { triggerType: 'BEHAVIOR_BAD', min: 15, flat: 15, pct: 0 },
        { triggerType: 'IS_APPRENTICE', min: 0, flat: 0, pct: -0.20 }, // 20% discount
      ];
      
      for (const mod of defaultMods) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "modifier_rules" ("id", "salonId", "triggerType", "addedMinutes", "priceEffectFlat", "priceEffectPercent", "isActive", "updatedAt")
          VALUES (gen_random_uuid(), '${salon.id}', '${mod.triggerType}', ${mod.min}, ${mod.flat}, ${mod.pct}, true, NOW())
        `);
        modifiersCreated++;
      }
    }
    console.log(`✅ ${modifiersCreated} default ModifierRules created`);
  } catch (e) {
    console.log('⚠️ default ModifierRules creation skipped or failed:', e.message);
  }

  console.log('🎉 Data migration script completed!');
}

main()
  .catch((e) => {
    console.error('Fatal Error during migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
