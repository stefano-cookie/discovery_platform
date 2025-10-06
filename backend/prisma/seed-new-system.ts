import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with new partner system...');

  // 1. Create Admin User
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@discovery.com' },
    update: {},
    create: {
      email: 'admin@discovery.com',
      password: adminPassword,
      role: 'ADMIN',
      isActive: true,
      emailVerified: true,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // 2. Create Courses
  const tfaCourse = await prisma.course.upsert({
    where: { id: 'tfa-course-001' },
    update: {},
    create: {
      id: 'tfa-course-001',
      name: 'TFA Romania Sostegno',
      description: 'Corso di specializzazione per il sostegno didattico',
      templateType: 'TFA',
      isActive: true,
    },
  });
  console.log('✅ TFA Course created:', tfaCourse.name);

  const certCourse = await prisma.course.upsert({
    where: { id: 'cert-course-001' },
    update: {},
    create: {
      id: 'cert-course-001',
      name: 'Certificazioni Informatiche',
      description: 'Certificazioni informatiche riconosciute MIUR',
      templateType: 'CERTIFICATION',
      isActive: true,
    },
  });
  console.log('✅ Certification Course created:', certCourse.name);

  // 3. Create PartnerCompany Diamante
  const diamante = await prisma.partnerCompany.upsert({
    where: { referralCode: 'DIAMANTE01' },
    update: {},
    create: {
      id: 'diamante-company-001',
      name: 'Diamante',
      referralCode: 'DIAMANTE01',
      canCreateChildren: true,
      isActive: true,
      isPremium: true,
      commissionPerUser: 100,
      totalEarnings: 0,
    },
  });
  console.log('✅ PartnerCompany Diamante created:', diamante.name);

  // 4. Create PartnerEmployee (Owner) for Diamante
  const employeePassword = await bcrypt.hash('diamante123', 10);
  const employee = await prisma.partnerEmployee.upsert({
    where: { email: 'admin@diamante.com' },
    update: {},
    create: {
      email: 'admin@diamante.com',
      password: employeePassword,
      firstName: 'Admin',
      lastName: 'Diamante',
      partnerCompanyId: diamante.id,
      role: 'ADMINISTRATIVE',
      isOwner: true,
      isActive: true,
      acceptedAt: new Date(),
    },
  });
  console.log('✅ PartnerEmployee created:', employee.email);

  // 5. Create Legacy Partner (for compatibility, but not required anymore)
  const legacyPartner = await prisma.partner.upsert({
    where: { referralCode: 'DIAMANTE01' },
    update: {},
    create: {
      id: diamante.id, // Same ID as company for easier migration
      userId: admin.id, // Link to admin for legacy compatibility
      referralCode: 'DIAMANTE01',
      commissionPerUser: 0,
    },
  });
  console.log('✅ Legacy Partner created (for compatibility)');

  // 6. Create Template Offers (using NEW system only)
  const tfaTemplate = await prisma.partnerOffer.upsert({
    where: { id: 'tfa-template-1500' },
    update: {},
    create: {
      id: 'tfa-template-1500',
      partnerId: null, // NULL - non serve più!
      partnerCompanyId: diamante.id, // Nuovo sistema
      courseId: tfaCourse.id,
      name: 'Template TFA - Acconto 1500€',
      offerType: 'TFA_ROMANIA',
      totalAmount: 5000,
      installments: 10,
      installmentFrequency: 1,
      customPaymentPlan: {
        deposit: 1500,
        installmentAmount: 350,
        description: 'Acconto 1500€ + 10 rate da 350€',
      },
      referralLink: 'tfa-1500-tmpl',
      isActive: true,
    },
  });
  console.log('✅ TFA Template created:', tfaTemplate.name);

  const certTemplate = await prisma.partnerOffer.upsert({
    where: { id: 'cert-template-standard' },
    update: {},
    create: {
      id: 'cert-template-standard',
      partnerId: null, // NULL - non serve più!
      partnerCompanyId: diamante.id, // Nuovo sistema
      courseId: certCourse.id,
      name: 'Template Certificazioni',
      offerType: 'CERTIFICATION',
      totalAmount: 3000,
      installments: 6,
      installmentFrequency: 1,
      customPaymentPlan: {
        deposit: 500,
        installmentAmount: 416.67,
        description: 'Acconto 500€ + 6 rate da 416.67€',
      },
      referralLink: 'cert-std-tmpl',
      isActive: true,
    },
  });
  console.log('✅ Certification Template created:', certTemplate.name);

  console.log('\n🎉 Seed completed successfully!\n');
  console.log('📋 Summary:');
  console.log('- Admin: admin@discovery.com / admin123');
  console.log('- Partner Employee: admin@diamante.com / diamante123');
  console.log('- Company: Diamante (DIAMANTE01)');
  console.log('- Courses: TFA Romania, Certificazioni');
  console.log('- Templates: TFA (1500€), Cert (500€)');
  console.log('\n✅ New Partner System is active!');
  console.log('   partnerId = nullable (legacy)');
  console.log('   partnerCompanyId = required (new system)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
