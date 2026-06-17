import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration for SalonClient and SalonPet...');

  // 1. Get all unique salon-client combinations from appointments
  const appointments = await prisma.appointment.findMany({
    select: {
      salonId: true,
      clientId: true,
      petId: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc', // To get the earliest date for createdAt in the new tables
    },
  });

  console.log(`Found ${appointments.length} appointments to process.`);

  const uniqueSalonClients = new Map<string, { salonId: string; clientId: string; createdAt: Date }>();
  const uniqueSalonPets = new Map<string, { salonId: string; petId: string; createdAt: Date }>();

  for (const appt of appointments) {
    if (appt.clientId) {
      const clientKey = `${appt.salonId}-${appt.clientId}`;
      if (!uniqueSalonClients.has(clientKey)) {
        uniqueSalonClients.set(clientKey, { salonId: appt.salonId, clientId: appt.clientId, createdAt: appt.createdAt });
      }
    }

    if (appt.petId) {
      const petKey = `${appt.salonId}-${appt.petId}`;
      if (!uniqueSalonPets.has(petKey)) {
        uniqueSalonPets.set(petKey, { salonId: appt.salonId, petId: appt.petId, createdAt: appt.createdAt });
      }
    }
  }

  console.log(`Identified ${uniqueSalonClients.size} unique Salon-Client relationships.`);
  console.log(`Identified ${uniqueSalonPets.size} unique Salon-Pet relationships.`);

  // 2. Insert into SalonClient
  console.log('Inserting into SalonClient...');
  let clientsInserted = 0;
  for (const { salonId, clientId, createdAt } of uniqueSalonClients.values()) {
    try {
      await prisma.salonClient.upsert({
        where: {
          salonId_clientId: { salonId, clientId },
        },
        update: {},
        create: { salonId, clientId, createdAt },
      });
      clientsInserted++;
    } catch (e) {
      console.error(`Failed to insert SalonClient ${salonId}-${clientId}:`, e);
    }
  }
  console.log(`Successfully inserted ${clientsInserted} SalonClient records.`);

  // 3. Insert into SalonPet
  console.log('Inserting into SalonPet...');
  let petsInserted = 0;
  for (const { salonId, petId, createdAt } of uniqueSalonPets.values()) {
    try {
      await prisma.salonPet.upsert({
        where: {
          salonId_petId: { salonId, petId },
        },
        update: {},
        create: { salonId, petId, createdAt },
      });
      petsInserted++;
    } catch (e) {
      console.error(`Failed to insert SalonPet ${salonId}-${petId}:`, e);
    }
  }
  console.log(`Successfully inserted ${petsInserted} SalonPet records.`);

  console.log('Migration completed.');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
