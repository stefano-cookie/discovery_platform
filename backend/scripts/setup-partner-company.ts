import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupPartnerCompany() {
  try {
    console.log('🔧 Setting up PartnerCompany...');

    // Check if PartnerCompany already exists
    const existingCompanies = await prisma.partnerCompany.findMany();

    if (existingCompanies.length > 0) {
      console.log(`Found ${existingCompanies.length} existing PartnerCompany records`);
      return existingCompanies[0];
    }

    // Create main PartnerCompany based on legacy Partner
    const legacyPartner = await prisma.partner.findFirst({
      where: {
        referralCode: {
          not: {
            endsWith: '-LEGACY'
          }
        }
      }
    });

    if (!legacyPartner) {
      console.error('❌ No legacy partner found to base PartnerCompany on');
      return null;
    }

    console.log(`📦 Creating PartnerCompany based on legacy partner ${legacyPartner.referralCode}`);

    const partnerCompany = await prisma.partnerCompany.create({
      data: {
        id: 'diamante-company-main',
        name: 'Diamante Company',
        referralCode: legacyPartner.referralCode || 'DIAMANTE01'
      }
    });

    console.log(`✅ Created PartnerCompany: ${partnerCompany.name} (${partnerCompany.referralCode})`);

    // Now assign all orphaned users to this company
    const orphanedUsers = await prisma.user.updateMany({
      where: {
        role: 'USER',
        assignedPartnerCompanyId: null
      },
      data: {
        assignedPartnerCompanyId: partnerCompany.id
      }
    });

    console.log(`📌 Assigned ${orphanedUsers.count} orphaned users to ${partnerCompany.name}`);

    return partnerCompany;

  } catch (error) {
    console.error('Error setting up PartnerCompany:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
setupPartnerCompany()
  .then((company) => {
    if (company) {
      console.log('\n✅ Setup completed successfully');
      console.log(`PartnerCompany ID: ${company.id}`);
      console.log(`PartnerCompany Name: ${company.name}`);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });