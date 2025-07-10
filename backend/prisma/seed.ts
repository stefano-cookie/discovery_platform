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
      passwordChanged: true
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
      passwordChanged: true
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
  const course = await prisma.course.upsert({
    where: { id: 'default-course' },
    update: {},
    create: {
      id: 'default-course',
      name: 'Corso di Formazione Diamante',
      description: 'Corso principale della piattaforma',
      isActive: true
    }
  });

  // Create partner offer
  await prisma.partnerOffer.upsert({
    where: { id: 'default-offer' },
    update: {},
    create: {
      id: 'default-offer',
      partnerId: partner.id,
      courseId: course.id,
      name: 'Offerta Standard',
      totalAmount: 5000,
      installments: 10,
      installmentFrequency: 1,
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