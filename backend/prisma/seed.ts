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

  // ===== NEW PARTNER COMPANY SYSTEM =====

  // Create Premium Partner Company (Diamante Learning)
  const premiumCompany = await prisma.partnerCompany.upsert({
    where: { referralCode: 'DIAMANTE001' },
    update: {},
    create: {
      id: 'diamante-premium-company',
      name: 'Diamante Learning - Premium',
      referralCode: 'DIAMANTE001',
      isPremium: true,
      canCreateChildren: true,
      commissionPerUser: 1500,
      totalEarnings: 0,
      isActive: true
    }
  });

  // Create Premium Company Owner/Admin Employee
  const premiumEmployeePassword = await bcrypt.hash('partner123', 10);
  const premiumEmployee = await prisma.partnerEmployee.upsert({
    where: { email: 'partner@diamante.com' },
    update: {},
    create: {
      partnerCompanyId: premiumCompany.id,
      email: 'partner@diamante.com',
      password: premiumEmployeePassword,
      firstName: 'Premium',
      lastName: 'Partner',
      role: 'ADMINISTRATIVE',
      isActive: true,
      isOwner: true,
      acceptedAt: new Date()
    }
  });

  // ===== LEGACY COMPATIBILITY =====

  // Create legacy partner user for compatibility
  const partnerUser = await prisma.user.upsert({
    where: { email: 'legacy@diamante.com' },
    update: {},
    create: {
      email: 'legacy@diamante.com',
      password: await bcrypt.hash('legacy123', 10),
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

  // ===== COURSE TEMPLATES =====

  // Template 1: TFA Romania Course
  const tfaCourse = await prisma.course.upsert({
    where: { id: 'tfa-romania-2025' },
    update: {},
    create: {
      id: 'tfa-romania-2025',
      name: 'TFA Romania 2025 - Abilitazione Insegnamento',
      description: 'Corso completo per abilitazione all\'insegnamento in Romania con riconoscimento MIUR',
      templateType: 'TFA',
      isActive: true
    }
  });

  // Template 2: Professional Certification Course
  const certificationCourse = await prisma.course.upsert({
    where: { id: 'professional-cert-2025' },
    update: {},
    create: {
      id: 'professional-cert-2025',
      name: 'Certificazioni Professionali 2025',
      description: 'Certificazioni professionali riconosciute per competenze specialistiche',
      templateType: 'CERTIFICATION',
      isActive: true
    }
  });

  // ===== PREMIUM COMPANY OFFERS =====

  // TFA Romania Offer - Premium Company
  await prisma.partnerOffer.upsert({
    where: { id: 'premium-tfa-offer' },
    update: {},
    create: {
      id: 'premium-tfa-offer',
      partnerId: partner.id, // Legacy compatibility
      partnerCompanyId: premiumCompany.id, // New system
      createdByEmployeeId: premiumEmployee.id,
      courseId: tfaCourse.id,
      name: 'TFA Romania Premium - Corso Completo 2025',
      offerType: 'TFA_ROMANIA',
      totalAmount: 7200, // Premium pricing
      installments: 12,
      installmentFrequency: 1,
      referralLink: 'DIAMANTE001-TFA2025',
      customPaymentPlan: {
        description: 'Piano Premium - 12 rate mensili',
        payments: [
          { amount: 600, dueDate: '2025-01-15', description: 'Prima rata' },
          { amount: 600, dueDate: '2025-02-15', description: 'Seconda rata' },
          { amount: 600, dueDate: '2025-03-15', description: 'Terza rata' },
          { amount: 600, dueDate: '2025-04-15', description: 'Quarta rata' },
          { amount: 600, dueDate: '2025-05-15', description: 'Quinta rata' },
          { amount: 600, dueDate: '2025-06-15', description: 'Sesta rata' },
          { amount: 600, dueDate: '2025-07-15', description: 'Settima rata' },
          { amount: 600, dueDate: '2025-08-15', description: 'Ottava rata' },
          { amount: 600, dueDate: '2025-09-15', description: 'Nona rata' },
          { amount: 600, dueDate: '2025-10-15', description: 'Decima rata' },
          { amount: 600, dueDate: '2025-11-15', description: 'Undicesima rata' },
          { amount: 600, dueDate: '2025-12-15', description: 'Dodicesima rata' }
        ]
      },
      isActive: true
    }
  });

  // Professional Certification Offer - Premium Company
  await prisma.partnerOffer.upsert({
    where: { id: 'premium-cert-offer' },
    update: {},
    create: {
      id: 'premium-cert-offer',
      partnerId: partner.id, // Legacy compatibility
      partnerCompanyId: premiumCompany.id, // New system
      createdByEmployeeId: premiumEmployee.id,
      courseId: certificationCourse.id,
      name: 'Certificazioni Professionali Premium 2025',
      offerType: 'CERTIFICATION',
      totalAmount: 850, // Premium certification pricing
      installments: 2,
      installmentFrequency: 2,
      referralLink: 'DIAMANTE001-CERT2025',
      customPaymentPlan: {
        description: 'Piano Certificazione - 2 rate bimestrali',
        payments: [
          { amount: 425, dueDate: '2025-01-15', description: 'Acconto iscrizione' },
          { amount: 425, dueDate: '2025-03-15', description: 'Saldo pre-esame' }
        ]
      },
      isActive: true
    }
  });

  // ===== LEGACY OFFERS (for compatibility) =====

  // Legacy TFA offer
  await prisma.partnerOffer.upsert({
    where: { id: 'legacy-tfa-offer' },
    update: {},
    create: {
      id: 'legacy-tfa-offer',
      partnerId: partner.id,
      courseId: tfaCourse.id,
      name: 'TFA Romania - Standard',
      offerType: 'TFA_ROMANIA',
      totalAmount: 6500,
      installments: 10,
      installmentFrequency: 1,
      referralLink: 'MAIN001-TFA',
      isActive: true
    }
  });

  // Legacy Certification offer
  await prisma.partnerOffer.upsert({
    where: { id: 'legacy-cert-offer' },
    update: {},
    create: {
      id: 'legacy-cert-offer',
      partnerId: partner.id,
      courseId: certificationCourse.id,
      name: 'Certificazione Standard',
      offerType: 'CERTIFICATION',
      totalAmount: 450,
      installments: 1,
      installmentFrequency: 1,
      referralLink: 'MAIN001-CERT',
      isActive: true
    }
  });


  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('🔑 LOGIN CREDENTIALS:');
  console.log('Admin user: admin@diamante.com / admin123');
  console.log('Premium Partner: partner@diamante.com / partner123');
  console.log('Legacy Partner: legacy@diamante.com / legacy123');
  console.log('');
  console.log('🏢 COMPANIES:');
  console.log('Premium Company: Diamante Learning - Premium (DIAMANTE001)');
  console.log('- Can create sub-partners');
  console.log('- Commission: €1500 per user');
  console.log('');
  console.log('📚 COURSES & OFFERS:');
  console.log('TFA Romania 2025: Premium €7200 (12 rate) | Standard €6500 (10 rate)');
  console.log('Professional Certifications 2025: Premium €850 (2 rate) | Standard €450 (1 rata)');
  console.log('');
  console.log('🔗 REFERRAL LINKS:');
  console.log('Premium TFA: DIAMANTE001-TFA2025');
  console.log('Premium Cert: DIAMANTE001-CERT2025');
  console.log('Legacy TFA: MAIN001-TFA');
  console.log('Legacy Cert: MAIN001-CERT');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });