import { PrismaClient, AppointmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Script d\'ajout de statistiques non-destructif ---');

  // 1. Récupérer le premier salon
  const salon = await prisma.providerProfile.findFirst();
  if (!salon) {
    console.error('Erreur: Aucun salon trouvé en base de données. Veuillez créer un compte prestataire d\'abord.');
    return;
  }
  console.log(`Salon ciblé : ${salon.businessName} (ID: ${salon.id})`);

  // 2. Récupérer le premier client
  const client = await prisma.user.findFirst({
    where: { role: 'CLIENT' }
  });
  if (!client) {
    console.error('Erreur: Aucun client trouvé en base de données. Veuillez créer un compte client d\'abord.');
    return;
  }
  console.log(`Client ciblé : ${client.firstName} ${client.lastName} (ID: ${client.id})`);

  // 3. Récupérer le premier animal
  const pet = await prisma.pet.findFirst({
    where: { ownerId: client.id }
  });
  if (!pet) {
    console.error(`Erreur: Aucun animal trouvé pour le client ${client.firstName}. Veuillez lui ajouter un animal.`);
    return;
  }
  console.log(`Animal ciblé : ${pet.name} (ID: ${pet.id})`);

  // 4. Récupérer les services du salon
  const services = await prisma.service.findMany({
    where: { providerId: salon.id }
  });
  if (services.length === 0) {
    console.error('Erreur: Le salon ne possède aucun service. Veuillez en ajouter depuis l\'application.');
    return;
  }
  console.log(`${services.length} services trouvés.`);

  // 5. Récupérer les collaborateurs du salon
  const staffs = await prisma.staffMember.findMany({
    where: { salonId: salon.id }
  });
  if (staffs.length === 0) {
    console.error('Erreur: Le salon ne possède aucun collaborateur. Veuillez en ajouter.');
    return;
  }
  console.log(`${staffs.length} collaborateurs trouvés.`);

  // 6. Générer les faux rendez-vous
  console.log('Génération de faux rendez-vous sur les 30 derniers jours...');
  const appointmentsToCreate: any[] = [];
  const statuses = [
    AppointmentStatus.COMPLETED, AppointmentStatus.COMPLETED, AppointmentStatus.COMPLETED, AppointmentStatus.COMPLETED,
    AppointmentStatus.CONFIRMED, AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ];
  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const targetDate = new Date();
    targetDate.setDate(now.getDate() - i);
    
    // Évite les dimanches
    if (targetDate.getDay() === 0) continue;

    // 1 à 3 rendez-vous par jour
    const dailyCount = Math.floor(Math.random() * 3) + 1;

    for (let j = 0; j < dailyCount; j++) {
      const startHour = 9 + Math.floor(Math.random() * 8); // 9h à 17h
      const startMin = Math.random() > 0.5 ? 30 : 0;
      
      const slotStart = new Date(targetDate);
      slotStart.setHours(startHour, startMin, 0, 0);
      
      const duration = Math.random() > 0.5 ? 60 : 90;
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotStart.getMinutes() + duration);

      const service = services[Math.floor(Math.random() * services.length)];
      const staff = staffs[Math.floor(Math.random() * staffs.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      const estimatedPrice = service.name.toLowerCase().includes('tonte') ? 65.0 : 40.0;

      appointmentsToCreate.push({
        clientId: client.id,
        salonId: salon.id,
        serviceId: service.id,
        petId: pet.id,
        staffId: staff.id,
        status,
        slotStart,
        slotEnd,
        estimatedPrice,
        actualDurationMinutes: duration,
        clientDurationMax: duration,
        tableDurationMinutes: duration,
        theoreticalDurationMinutes: duration,
        priceDisplayMode: 'FLAT',
      });
    }
  }

  const result = await prisma.appointment.createMany({
    data: appointmentsToCreate,
  });

  console.log(`✅ Succès ! ${result.count} faux rendez-vous ont été ajoutés en toute sécurité sans effacer vos données.`);
}

main()
  .catch((e) => {
    console.error('Une erreur est survenue :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
