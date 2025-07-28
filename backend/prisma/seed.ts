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
      isActive: true
    }
  });

  // Create TFA Romania offer
  await prisma.partnerOffer.upsert({
    where: { id: 'tfa-romania-offer' },
    update: {},
    create: {
      id: 'tfa-romania-offer',
      partnerId: partner.id,
      courseId: tfaCourse.id,
      name: 'TFA Romania - Corso Completo',
      offerType: 'TFA_ROMANIA',
      totalAmount: 5000,
      installments: 10,
      installmentFrequency: 1,
      referralLink: 'MAIN001-TFA',
      isActive: true
    }
  });

  // Create Certification courses
  const certSpagnolo = await prisma.course.upsert({
    where: { id: 'cert-spagnolo-a2' },
    update: {},
    create: {
      id: 'cert-spagnolo-a2',
      name: 'Certificazione Spagnolo A2',
      description: 'Certificazione linguistica Spagnolo livello A2',
      isActive: true
    }
  });

  const certInglese = await prisma.course.upsert({
    where: { id: 'cert-inglese-b2' },
    update: {},
    create: {
      id: 'cert-inglese-b2',
      name: 'Certificazione Inglese B2',
      description: 'Certificazione linguistica Inglese livello B2',
      isActive: true
    }
  });

  await prisma.partnerOffer.upsert({
    where: { id: 'certification-offer' },
    update: {},
    create: {
      id: 'certification-offer',
      partnerId: partner.id,
      courseId: certSpagnolo.id,
      name: 'Certificazione Spagnolo A2 - Sconto Partner',
      offerType: 'CERTIFICATION',
      totalAmount: 1500,
      installments: 3,
      installmentFrequency: 1,
      referralLink: 'MAIN001-CERT',
      customPaymentPlan: {
        payments: [
          { amount: 500, dueDate: '2025-01-30' },
          { amount: 500, dueDate: '2025-02-28' },
          { amount: 500, dueDate: '2025-03-30' }
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