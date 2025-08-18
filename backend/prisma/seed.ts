import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@diamante.com' },
    update: {},
    create: {
      email: 'admin@diamante.com',
      password: adminPassword,
      role: 'ADMIN',
      isActive: true,
      emailVerified: true
    }
  });

  // Create main partner
  const partnerPassword = await bcrypt.hash('partner123', 10);
  const partnerUser = await prisma.user.upsert({
    where: { email: 'partner@diamante.com' },
    update: {},
    create: {
      email: 'partner@diamante.com',
      password: partnerPassword,
      role: 'PARTNER',
      isActive: true,
      emailVerified: true
    }
  });

  const partner = await prisma.partner.upsert({
    where: { userId: partnerUser.id },
    update: {},
    create: {
      userId: partnerUser.id,
      referralCode: 'MAIN001',
      canCreateChildren: true,
      commissionPerUser: 1000,
      commissionToAdmin: 3000
    }
  });

  // Create default course
  // Create TFA Romania course
  const tfaCourse = await prisma.course.upsert({
    where: { id: 'tfa-romania-2024' },
    update: {},
    create: {
      id: 'tfa-romania-2024',
      name: 'TFA Romania 2024',
      description: 'Corso di abilitazione all\'insegnamento in Romania',
      templateType: 'TFA',
      isActive: true
    }
  });

  // Create TFA Romania offer - 6500€ con 10 rate
  await prisma.partnerOffer.upsert({
    where: { id: 'tfa-romania-offer' },
    update: {
      totalAmount: 6500,
      installments: 10
    },
    create: {
      id: 'tfa-romania-offer',
      partnerId: partner.id,
      courseId: tfaCourse.id,
      name: 'TFA Romania - Corso Completo',
      offerType: 'TFA_ROMANIA',
      totalAmount: 6500,
      installments: 10,
      installmentFrequency: 1,
      referralLink: 'MAIN001-TFA',
      isActive: true
    }
  });

  // Create C2 English Certification course
  const c2EnglishCourse = await prisma.course.upsert({
    where: { id: 'c2-english-cert' },
    update: {},
    create: {
      id: 'c2-english-cert',
      name: 'Certificazione C2 Inglese',
      description: 'Certificazione C2 livello avanzato lingua inglese',
      templateType: 'CERTIFICATION',
      isActive: true
    }
  });

  // Offerta Certificazione C2 Inglese - 400€ rata unica
  await prisma.partnerOffer.upsert({
    where: { id: 'c2-english-offer' },
    update: {},
    create: {
      id: 'c2-english-offer',
      partnerId: partner.id,
      courseId: c2EnglishCourse.id,
      name: 'Certificazione C2 Inglese - Pagamento Unico',
      offerType: 'CERTIFICATION',
      totalAmount: 400,
      installments: 1,
      installmentFrequency: 1,
      referralLink: 'MAIN001-C2ENG',
      customPaymentPlan: {
        payments: [
          { amount: 400, dueDate: '2025-02-01' }
        ]
      },
      isActive: true
    }
  });


  console.log('✅ Database seeded successfully!');
  console.log('Admin user: admin@diamante.com / admin123');
  console.log('Partner user: partner@diamante.com / partner123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });