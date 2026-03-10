import { PrismaClient, Role, AnimalType, OfferType, StaffRole, TableCategory, ValidationMode, PetSize, PetCharacter } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function createSupabaseUser(email: string, role: string, fullName: string) {
  console.log(`Vérification/Création de l'utilisateur Supabase : ${email}`);
  
  // Chercher si l'utilisateur existe déjà
  const { data: listUsers, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;
  
  const existingUser = listUsers.users.find(u => u.email === email);
  
  if (existingUser) {
    console.log(`L'utilisateur ${email} existe déjà dans Supabase (ID: ${existingUser.id})`);
    return existingUser.id;
  }

  // Créer l'utilisateur s'il n'existe pas
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: 'password123', // Mot de passe par défaut pour le test
    email_confirm: true,
    user_metadata: {
      role: role,
      full_name: fullName
    }
  });

  if (createError) throw createError;
  console.log(`Utilisateur ${email} créé dans Supabase (ID: ${newUser.user.id})`);
  return newUser.user.id;
}

async function main() {
  console.log('🚀 Début du seeding approfondi avec intégration Supabase...');

  // Nettoyage complet pour repartir sur une base saine
  console.log('🧹 Nettoyage de la base de données...');
  await prisma.appointment.deleteMany();
  await prisma.staffServiceDuration.deleteMany();
  await prisma.staffMember.deleteMany();
  await prisma.groomingTable.deleteMany();
  await prisma.service.deleteMany();
  await prisma.salonConfig.deleteMany();
  await prisma.providerProfile.deleteMany();
  await prisma.user.deleteMany();

  // 1. IDs des utilisateurs Supabase
  const formationUserId = await createSupabaseUser('formation@kompagni.com', 'PROVIDER', 'Marie Formatrice');
  const julieUserId = await createSupabaseUser('julie@kompagni.com', 'PROVIDER', 'Julie Solo');
  const clientUserId = await createSupabaseUser('client@kompagni.com', 'CLIENT', 'Jean Client');

  // --- 1. SALON DE FORMATION ---
  await prisma.user.upsert({
    where: { id: formationUserId },
    update: {},
    create: {
      id: formationUserId,
      email: 'formation@kompagni.com',
      firstName: 'Marie',
      lastName: 'Formatrice',
      role: Role.PROVIDER,
      providerProfile: {
        create: {
          businessName: 'Centre de Formation Toilettage',
          description: 'Salon école avec encadrement professionnel.',
          address: '42 Rue des Apprentis',
          city: 'Lyon',
          postalCode: '69007',
          tags: ['Toiletteur', 'Formation', 'Chien', 'Chat'],
          salonConfig: {
            create: {
              validationMode: ValidationMode.MANUAL,
              formationDiscount: 15.0,
              formationBlocks: [
                { name: 'Matin', start: '08:30', end: '12:30' },
                { name: 'Après-midi', start: '13:30', end: '17:30' }
              ]
            }
          }
        }
      }
    }
  });

  const formationSalon = await prisma.providerProfile.findUnique({ where: { userId: formationUserId } });
  if (formationSalon) {
      await prisma.groomingTable.createMany({
        data: [
          { name: 'Table 1 (Grande)', category: TableCategory.LARGE, salonId: formationSalon.id },
          { name: 'Table 2 (Moyenne)', category: TableCategory.SMALL, salonId: formationSalon.id },
          { name: 'Table 3 (Chat/Petit)', category: TableCategory.CAT, salonId: formationSalon.id },
        ],
        skipDuplicates: true
      });

      const mariePro = await prisma.staffMember.create({
        data: {
          name: 'Marie (Pro)',
          role: StaffRole.PRO,
          salonId: formationSalon.id,
          weeklySchedule: [
            { dayOfWeek: 1, startTime: '08:30', endTime: '18:00' },
            { dayOfWeek: 2, startTime: '08:30', endTime: '18:00' },
            { dayOfWeek: 3, startTime: '08:30', endTime: '18:00' },
            { dayOfWeek: 4, startTime: '08:30', endTime: '18:00' },
            { dayOfWeek: 5, startTime: '08:30', endTime: '18:00' },
          ]
        }
      });

      const lucasApprenti = await prisma.staffMember.create({
        data: {
          name: 'Lucas (Apprenti)',
          role: StaffRole.APPRENTI,
          salonId: formationSalon.id,
          weeklySchedule: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
            { dayOfWeek: 2, startTime: '09:00', endTime: '12:00' },
            { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
            { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
          ]
        }
      });

      await prisma.service.create({
        data: {
          name: 'Toilettage Complet Chien',
          description: 'Bain, tonte/coupe, griffes, oreilles.',
          animalType: AnimalType.DOG,
          providerId: formationSalon.id,
          availableModes: [OfferType.PRO, OfferType.FORMATION],
          defaultDurationPro: 90,
          defaultDurationForm: 240,
          priceTiers: [
            { maxWeightKg: 10, price: 50 },
            { maxWeightKg: 25, price: 70 },
            { maxWeightKg: null, price: 90 }
          ],
          staffDurations: {
            create: [
              { staffId: mariePro.id, durationMinutes: 75 },
              { staffId: lucasApprenti.id, durationMinutes: 240 }
            ]
          }
        }
      });
  }

  // --- 2. SALON SOLO JULIE ---
  await prisma.user.upsert({
    where: { id: julieUserId },
    update: {},
    create: {
      id: julieUserId,
      email: 'julie@kompagni.com',
      firstName: 'Julie',
      lastName: 'Solo',
      role: Role.PROVIDER,
      providerProfile: {
        create: {
          businessName: 'Julie Toilettage',
          description: 'Toilettage passionné en solo.',
          address: '15 Rue de la Paix',
          city: 'Lyon',
          postalCode: '69002',
          tags: ['Toiletteur', 'Solo', 'Expert'],
          salonConfig: {
            create: {
              validationMode: ValidationMode.AUTO,
            }
          }
        }
      }
    }
  });

  const julieSalon = await prisma.providerProfile.findUnique({ where: { userId: julieUserId } });
  if (julieSalon) {
      await prisma.groomingTable.create({
        data: { name: 'Table Unique', category: TableCategory.SMALL, salonId: julieSalon.id }
      });

      await prisma.staffMember.create({
        data: {
          name: 'Julie',
          role: StaffRole.PRO,
          salonId: julieSalon.id,
          weeklySchedule: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
            { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
            { dayOfWeek: 4, startTime: '09:00', endTime: '18:00' },
            { dayOfWeek: 5, startTime: '09:00', endTime: '18:00' },
            { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' },
          ]
        }
      });

      await prisma.service.create({
        data: {
          name: 'Bain & Brushing',
          animalType: AnimalType.DOG,
          providerId: julieSalon.id,
          availableModes: [OfferType.PRO],
          defaultDurationPro: 45,
          priceTiers: [{ maxWeightKg: null, price: 35 }]
        }
      });
  }

  // --- 3. CLIENT DE TEST ---
  await prisma.user.upsert({
    where: { id: clientUserId },
    update: {},
    create: {
      id: clientUserId,
      email: 'client@kompagni.com',
      firstName: 'Jean',
      lastName: 'Client',
      role: Role.CLIENT,
      pets: {
        create: [
          { name: 'Rex', type: AnimalType.DOG, breed: 'Golden Retriever', size: PetSize.LARGE, character: PetCharacter.CALM, weightKg: 28 },
          { name: 'Mimi', type: AnimalType.CAT, breed: 'Persan', size: PetSize.SMALL, character: PetCharacter.HAPPY, weightKg: 4 }
        ]
      }
    }
  });

  console.log('✅ Seeding terminé avec succès ! Tout est prêt pour le login.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
