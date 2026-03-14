import { PrismaClient, Role, StaffRole, AnimalCategory, CoatType, GroomingBehavior, SkinCondition, ValidationMode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding KAIROS v1.6 database...');

  // 1. Clean existing data (careful order for FKs)
  await prisma.priceAdjustment.deleteMany();
  await prisma.animalRefinement.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.slotLock.deleteMany();
  await prisma.manualBlock.deleteMany();
  await prisma.modifierRule.deleteMany();
  await prisma.baseRule.deleteMany();
  await prisma.service.deleteMany();
  await prisma.staffMember.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.providerAbsence.deleteMany();
  await prisma.salonConfig.deleteMany();
  await prisma.providerProfile.deleteMany();
  await prisma.pet.deleteMany();
  await prisma.user.deleteMany();

  // 2. Users
  const providerUser = await prisma.user.create({
    data: {
      email: 'salon@kompagni.fr',
      firstName: 'Jean',
      lastName: 'Toiletteur',
      role: Role.PROVIDER,
      phoneNumber: '0123456789',
    },
  });

  const clientUser = await prisma.user.create({
    data: {
      email: 'client@example.com',
      firstName: 'Alice',
      lastName: 'Dupont',
      role: Role.CLIENT,
      phoneNumber: '0612345678',
    },
  });

  // 3. Salon (ProviderProfile)
  const salon = await prisma.providerProfile.create({
    data: {
      userId: providerUser.id,
      businessName: 'Kompagni Salon Paris',
      description: 'Toilettage expert toutes races',
      address: '10 rue de Rivoli',
      city: 'Paris',
      postalCode: '75004',
      tags: ['Expert', 'Chien', 'Chat'],
    },
  });

  // 4. Salon Configuration
  await prisma.salonConfig.create({
    data: {
      salonId: salon.id,
      validationMode: ValidationMode.AUTO,
      slotGranularityMin: 30,
      planningHorizonDays: 30,
      concurrentLimits: {
        SMALL: 2,
        LARGE: 1,
        GIANT: 1,
        CAT: 1,
        NAC: 1,
      },
    },
  });

  // 5. Working Hours
  const days = [1, 2, 3, 4, 5]; // Mon to Fri
  for (const day of days) {
    await prisma.workingHours.create({
      data: {
        providerId: salon.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '18:00',
        breakStartTime: '12:30',
        breakEndTime: '13:30',
      },
    });
  }

  // 6. Services
  const serviceTonte = await prisma.service.create({
    data: {
      providerId: salon.id,
      name: 'Tonte complète',
      description: 'Tonte, bain, brushing et coupe des griffes',
      animalTypes: ['dog', 'cat'],
    },
  });

  const serviceBain = await prisma.service.create({
    data: {
      providerId: salon.id,
      name: 'Bain & Brushing',
      description: 'Shampoing adapté, séchage et brossage',
      animalTypes: ['dog', 'cat'],
    },
  });

  // 7. Base Rules (Layer 1)
  // Tonte complète rules
  await prisma.baseRule.createMany({
    data: [
      { salonId: salon.id, serviceId: serviceTonte.id, minWeightKg: 0, maxWeightKg: 10, baseDurationMinutes: 60, basePrice: 45, includedMinutes: 9999, overtimeRatePerMin: 0 },
      { salonId: salon.id, serviceId: serviceTonte.id, minWeightKg: 10, maxWeightKg: 25, baseDurationMinutes: 90, basePrice: 65, includedMinutes: 9999, overtimeRatePerMin: 0 },
      { salonId: salon.id, serviceId: serviceTonte.id, minWeightKg: 25, maxWeightKg: 9999, baseDurationMinutes: 120, basePrice: 95, includedMinutes: 9999, overtimeRatePerMin: 0 },
    ],
  });

  // Bain et Brushing rules
  await prisma.baseRule.createMany({
    data: [
      { salonId: salon.id, serviceId: serviceBain.id, minWeightKg: 0, maxWeightKg: 10, baseDurationMinutes: 30, basePrice: 25, includedMinutes: 9999, overtimeRatePerMin: 0 },
      { salonId: salon.id, serviceId: serviceBain.id, minWeightKg: 10, maxWeightKg: 25, baseDurationMinutes: 45, basePrice: 40, includedMinutes: 9999, overtimeRatePerMin: 0 },
      { salonId: salon.id, serviceId: serviceBain.id, minWeightKg: 25, maxWeightKg: 9999, baseDurationMinutes: 60, basePrice: 60, includedMinutes: 9999, overtimeRatePerMin: 0 },
    ],
  });

  // 8. Modifier Rules (Layer 2)
  await prisma.modifierRule.createMany({
    data: [
      { salonId: salon.id, triggerType: 'KNOTS', addedMinutes: 15, priceEffectFlat: 10, priceEffectPercent: 0, isActive: true },
      { salonId: salon.id, triggerType: 'BEHAVIOR_BAD', addedMinutes: 20, priceEffectFlat: 0, priceEffectPercent: 15, isActive: true },
      { salonId: salon.id, triggerType: 'COAT_DOUBLE', addedMinutes: 30, priceEffectFlat: 20, priceEffectPercent: 0, isActive: true },
    ],
  });

  // 9. Staff Members
  const staffExpert = await prisma.staffMember.create({
    data: {
      salonId: salon.id,
      name: 'Expert Marc',
      role: StaffRole.PROFESSIONAL,
      speedIndex: 1.0,
      allowedServiceIds: [serviceTonte.id, serviceBain.id],
      weeklySchedule: days.map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00' })),
    },
  });

  const staffApprentice = await prisma.staffMember.create({
    data: {
      salonId: salon.id,
      name: 'Apprentie Julie',
      role: StaffRole.APPRENTICE,
      speedIndex: 1.3,
      allowedServiceIds: [serviceTonte.id, serviceBain.id],
      weeklySchedule: days.map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00' })),
    },
  });

  // 10. Pet
  await prisma.pet.create({
    data: {
      ownerId: clientUser.id,
      name: 'Max',
      species: 'dog',
      breedId: 'golden-retriever',
      birthDate: new Date('2020-05-10'),
      sex: 'male',
      isNeutered: true,
      weightKg: 28.0,
      category: AnimalCategory.LARGE,
      coatType: CoatType.LONG,
      groomingBehavior: GroomingBehavior.EASY,
      skinCondition: SkinCondition.NORMAL,
    },
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
