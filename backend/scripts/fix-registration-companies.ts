import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixRegistrationCompanies() {
  console.log('🔧 Starting migration to fix registration partnerCompanyId and sourcePartnerCompanyId...');
  
  try {
    // 1. Find all registrations with NULL partnerCompanyId
    const registrationsToFix = await prisma.registration.findMany({
      where: {
        partnerCompanyId: { isSet: false },
        NOT: {
          partnerId: { equals: 'default-partner-id' }
        }
      }
    });
    
    console.log(`📊 Found ${registrationsToFix.length} registrations to fix`);
    
    let fixed = 0;
    let failed = 0;
    
    for (const registration of registrationsToFix) {
      try {
        let partnerCompanyId = null;
        let sourcePartnerCompanyId = null;
        let isDirectRegistration = true;
        
        // Method 1: Try to get from offer
        if (registration.partnerOfferId) {
          const offer = await prisma.partnerOffer.findUnique({
            where: { id: registration.partnerOfferId }
          });
          
          if (offer?.partnerCompanyId) {
            const offerCompany = await prisma.partnerCompany.findUnique({
              where: { id: offer.partnerCompanyId },
              include: { parent: true }
            });
            
            if (offerCompany) {
              if (offerCompany.parentId) {
                // Sub-partner registration
                partnerCompanyId = offerCompany.parentId;
                sourcePartnerCompanyId = offerCompany.id;
                isDirectRegistration = false;
                console.log(`  📋 Sub-partner registration: ${registration.id} - source=${offerCompany.name}, parent=${offerCompany.parent?.name}`);
              } else {
                // Direct registration
                partnerCompanyId = offerCompany.id;
                sourcePartnerCompanyId = offerCompany.id;
                isDirectRegistration = true;
                console.log(`  📋 Direct registration: ${registration.id} - company=${offerCompany.name}`);
              }
            }
          }
        }
        
        // Method 2: Fallback to partner referral code
        if (!partnerCompanyId && registration.partnerId) {
          const partner = await prisma.partner.findUnique({
            where: { id: registration.partnerId }
          });
          
          if (partner?.referralCode) {
            const baseReferralCode = partner.referralCode.split('-')[0];
            
            const partnerCompany = await prisma.partnerCompany.findFirst({
              where: { 
                OR: [
                  { referralCode: baseReferralCode },
                  { referralCode: { startsWith: baseReferralCode } }
                ]
              },
              include: { parent: true },
              orderBy: { createdAt: 'asc' }
            });
            
            if (partnerCompany) {
              // For now, assume direct registration with the found company
              partnerCompanyId = partnerCompany.id;
              sourcePartnerCompanyId = partnerCompany.id;
              isDirectRegistration = true;
              console.log(`  📋 Via referralCode: ${registration.id} - company=${partnerCompany.name}`);
            }
          }
        }
        
        // Update the registration if we found the company
        if (partnerCompanyId) {
          await prisma.registration.update({
            where: { id: registration.id },
            data: {
              partnerCompanyId,
              sourcePartnerCompanyId,
              isDirectRegistration
            }
          });
          fixed++;
          console.log(`  ✅ Fixed registration ${registration.id}`);
        } else {
          failed++;
          console.log(`  ❌ Could not determine company for registration ${registration.id} (partnerId: ${registration.partnerId})`);
        }
        
      } catch (error) {
        failed++;
        console.error(`  ❌ Error fixing registration ${registration.id}:`, error);
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Fixed: ${fixed} registrations`);
    console.log(`  ❌ Failed: ${failed} registrations`);
    
    // 2. Verify the fix
    const stillBroken = await prisma.registration.count({
      where: {
        partnerCompanyId: { equals: null },
        partnerId: { not: { equals: null } }
      }
    });
    
    if (stillBroken > 0) {
      console.log(`  ⚠️  Still ${stillBroken} registrations without partnerCompanyId`);
    } else {
      console.log(`  🎉 All registrations now have partnerCompanyId!`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
fixRegistrationCompanies();