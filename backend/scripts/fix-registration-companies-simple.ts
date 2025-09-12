import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixRegistrationCompanies() {
  console.log('🔧 Starting migration to fix registration partnerCompanyId and sourcePartnerCompanyId...');
  
  try {
    // 1. Get all registrations without partnerCompanyId
    const registrationsToFix = await prisma.$queryRaw<any[]>`
      SELECT r.id, r."partnerId", r."partnerOfferId"
      FROM "Registration" r
      WHERE r."partnerCompanyId" IS NULL
        AND r."partnerId" IS NOT NULL
        AND r."partnerId" != 'default-partner-id'
    `;
    
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
                // Check if the offer's referral link contains the sub-partner's code
                if (offer.referralLink?.includes(offerCompany.referralCode)) {
                  // This is a sub-partner offer
                  partnerCompanyId = offerCompany.parentId;
                  sourcePartnerCompanyId = offerCompany.id;
                  isDirectRegistration = false;
                  console.log(`  📋 Sub-partner: ${registration.id.substring(0,8)}... - source=${offerCompany.name}`);
                } else {
                  // Parent company offer but registered through sub-partner context
                  partnerCompanyId = offerCompany.id;
                  sourcePartnerCompanyId = offerCompany.id;
                  isDirectRegistration = true;
                  console.log(`  📋 Direct: ${registration.id.substring(0,8)}... - company=${offerCompany.name}`);
                }
              } else {
                // Direct registration with main company
                partnerCompanyId = offerCompany.id;
                sourcePartnerCompanyId = offerCompany.id;
                isDirectRegistration = true;
                console.log(`  📋 Direct: ${registration.id.substring(0,8)}... - company=${offerCompany.name}`);
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
            // Extract base code (e.g., "DIAMANTE001" from "DIAMANTE001-LEGACY")
            const baseCode = partner.referralCode.split('-')[0];
            
            // First try exact match
            let partnerCompany = await prisma.partnerCompany.findUnique({
              where: { referralCode: baseCode }
            });
            
            // If not found, try with startsWith
            if (!partnerCompany) {
              partnerCompany = await prisma.partnerCompany.findFirst({
                where: { 
                  referralCode: { startsWith: baseCode }
                },
                orderBy: { createdAt: 'asc' }
              });
            }
            
            if (partnerCompany) {
              partnerCompanyId = partnerCompany.id;
              sourcePartnerCompanyId = partnerCompany.id;
              isDirectRegistration = true;
              console.log(`  📋 Via partner: ${registration.id.substring(0,8)}... - company=${partnerCompany.name}`);
            }
          }
        }
        
        // Update the registration if we found the company
        if (partnerCompanyId && sourcePartnerCompanyId) {
          await prisma.$executeRaw`
            UPDATE "Registration"
            SET "partnerCompanyId" = ${partnerCompanyId},
                "sourcePartnerCompanyId" = ${sourcePartnerCompanyId},
                "isDirectRegistration" = ${isDirectRegistration}
            WHERE id = ${registration.id}
          `;
          fixed++;
        } else {
          failed++;
          console.log(`  ❌ Could not determine company for registration ${registration.id.substring(0,8)}...`);
        }
        
      } catch (error) {
        failed++;
        console.error(`  ❌ Error fixing registration ${registration.id.substring(0,8)}...:`, error);
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Fixed: ${fixed} registrations`);
    console.log(`  ❌ Failed: ${failed} registrations`);
    
    // 2. Verify the fix
    const stillBroken = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count
      FROM "Registration"
      WHERE "partnerCompanyId" IS NULL
        AND "partnerId" IS NOT NULL
        AND "partnerId" != 'default-partner-id'
    `;
    
    const brokenCount = Number(stillBroken[0]?.count || 0);
    
    if (brokenCount > 0) {
      console.log(`  ⚠️  Still ${brokenCount} registrations without partnerCompanyId`);
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