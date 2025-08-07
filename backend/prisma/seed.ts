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

  // Create Certification course (solo certificazioni generiche)
  const certGeneric = await prisma.course.upsert({
    where: { id: 'cert-generic' },
    update: {},
    create: {
      id: 'cert-generic',
      name: 'Certificazioni Professionali',
      description: 'Certificazioni e corsi professionali vari',
      templateType: 'CERTIFICATION',
      isActive: true
    }
  });

  // Offerta con pagamento unico
  await prisma.partnerOffer.upsert({
    where: { id: 'certification-offer' },
    update: {},
    create: {
      id: 'certification-offer',
      partnerId: partner.id,
      courseId: certGeneric.id,
      name: 'Certificazione Professionale - Pagamento Unico',
      offerType: 'CERTIFICATION',
      totalAmount: 1500,
      installments: 1,
      installmentFrequency: 1,
      referralLink: 'MAIN001-CERT',
      customPaymentPlan: {
        payments: [
          { amount: 1500, dueDate: '2025-02-01' }
        ]
      },
      isActive: true
    }
  });

  // Offerta con 3 rate
  await prisma.partnerOffer.upsert({
    where: { id: 'certification-installments-offer' },
    update: {},
    create: {
      id: 'certification-installments-offer',
      partnerId: partner.id,
      courseId: certGeneric.id,
      name: 'Certificazione Professionale - 3 Rate',
      offerType: 'CERTIFICATION',
      totalAmount: 1500,
      installments: 3,
      installmentFrequency: 1,
      referralLink: 'MAIN001-CERT3',
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