import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const modifiers = await prisma.modifierRule.findMany({
    where: { isActive: true },
  });

  console.log(`Found ${modifiers.length} active modifier rules to migrate.`);

  let migrated = 0;
  for (const mod of modifiers) {
    let effectAction = 'ADD';
    let effectValue = mod.addedMinutes;
    let effectType = 'DURATION';

    if (mod.priceEffectFlat !== 0) {
      effectType = 'PRICE';
      effectValue = mod.priceEffectFlat;
      effectAction = 'ADD';
    } else if (mod.priceEffectPercent !== 0) {
      effectType = 'PRICE';
      effectValue = mod.priceEffectPercent;
      effectAction = 'MULTIPLY';
    }

    // Condition mapping based on triggerType
    let conditionField = '';
    let conditionOperator = '==';
    let conditionValue = 'true';

    switch (mod.triggerType) {
      case 'KNOTS':
        conditionField = 'appointment.hasKnots';
        break;
      case 'DIFFICULT_BEHAVIOR':
        conditionField = 'animal.groomingBehavior';
        conditionValue = 'DIFFICULT';
        break;
      case 'FIRST_VISIT':
        conditionField = 'appointment.isFirstVisit';
        break;
      default:
        conditionField = 'custom.field'; // Fallback
        conditionValue = mod.triggerType;
        break;
    }

    await prisma.salonRule.create({
      data: {
        salonId: mod.salonId,
        name: `Migration: ${mod.triggerType}`,
        isActive: mod.isActive,
        priority: 0,
        conditionField,
        conditionOperator,
        conditionValue,
        effectType,
        effectAction,
        effectValue,
      }
    });

    migrated++;
  }

  console.log(`Successfully migrated ${migrated} rules.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
