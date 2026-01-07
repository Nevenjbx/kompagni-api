import { PrismaClient, Role, AnimalType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Début du seeding...');

    // Nettoyage optionnel (à manipuler avec précaution en prod)
    // await prisma.appointment.deleteMany();
    // await prisma.workingHours.deleteMany();
    // await prisma.service.deleteMany();
    // await prisma.providerProfile.deleteMany();
    // await prisma.user.deleteMany();

    const providers = [
        {
            email: 'pattes-soyeuses@kompagni.com',
            firstName: 'Julie',
            lastName: 'Lavigne',
            businessName: 'Pattes Soyeuses',
            description: 'Toilettage de luxe pour chiens et chats.',
            address: '15 Rue de la République',
            city: 'Lyon',
            postalCode: '69002',
            services: [
                { name: 'Toilettage complet Petit Chien', duration: 60, price: 45, animalType: AnimalType.DOG },
                { name: 'Toilettage complet Chat', duration: 45, price: 55, animalType: AnimalType.CAT },
            ]
        },
        {
            email: 'clinique-veto-bellecour@kompagni.com',
            firstName: 'Marc',
            lastName: 'Durand',
            businessName: 'Clinique Vétérinaire Bellecour',
            description: 'Soins vétérinaires complets et urgences.',
            address: '5 Place Bellecour',
            city: 'Lyon',
            postalCode: '69002',
            services: [
                { name: 'Consultation Générale', duration: 30, price: 40, animalType: AnimalType.DOG },
                { name: 'Vaccination', duration: 15, price: 50, animalType: AnimalType.CAT },
            ]
        },
        {
            email: 'la-niche-lyonnaise@kompagni.com',
            firstName: 'Sophie',
            lastName: 'Martin',
            businessName: 'La Niche Lyonnaise',
            description: 'Pension canine familiale au cœur de la ville.',
            address: '28 Quai Saint-Antoine',
            city: 'Lyon',
            postalCode: '69001',
            services: [
                { name: 'Garde à la journée', duration: 480, price: 25, animalType: AnimalType.DOG },
            ]
        }
    ];

    for (const p of providers) {
        const user = await prisma.user.upsert({
            where: { email: p.email },
            update: {},
            create: {
                email: p.email,
                firstName: p.firstName,
                lastName: p.lastName,
                role: Role.PROVIDER,
                providerProfile: {
                    create: {
                        businessName: p.businessName,
                        description: p.description,
                        address: p.address,
                        city: p.city,
                        postalCode: p.postalCode,
                    }
                }
            },
            include: { providerProfile: true }
        });

        const providerProfile = user.providerProfile as { id: string } | null;
        if (providerProfile) {
            console.log(`Création des services et horaires pour : ${p.businessName}`);

            // Ajout des services
            for (const s of p.services) {
                await prisma.service.create({
                    data: {
                        ...s,
                        providerId: providerProfile.id
                    }
                });
            }

            // Ajout des horaires par défaut (Lundi au Vendredi, 09:00 - 18:00 avec pause)
            for (let day = 1; day <= 5; day++) {
                await prisma.workingHours.create({
                    data: {
                        dayOfWeek: day,
                        startTime: '09:00',
                        endTime: '18:00',
                        breakStartTime: '12:00',
                        breakEndTime: '13:30',
                        providerId: providerProfile.id
                    }
                });
            }
        }
    }

    console.log('Seeding terminé avec succès !');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
