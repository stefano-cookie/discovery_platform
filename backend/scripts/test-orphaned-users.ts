import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to check if a user is orphaned for a specific partner
async function isUserOrphaned(userId: string, partnerCompanyId: string): Promise<boolean> {
  // Check if user has any active registrations with this partner
  const activeRegistrations = await prisma.registration.count({
    where: {
      userId,
      partnerCompanyId
    }
  });

  // Check if user has any enabled offer access with this partner
  const enabledOfferAccess = await prisma.userOfferAccess.count({
    where: {
      userId,
      partnerCompanyId,
      enabled: true
    }
  });

  // User is orphaned if they have no registrations AND no enabled offer access
  return activeRegistrations === 0 && enabledOfferAccess === 0;
}

async function testOrphanedUserSystem() {
  console.log('🧪 Testing Orphaned User System...\n');
  
  try {
    // 1. Find a partner company to test with
    const partnerCompany = await prisma.partnerCompany.findFirst({
      where: { parentId: null } // Use a main partner company
    });
    
    if (!partnerCompany) {
      console.log('❌ No partner company found');
      return;
    }
    
    console.log(`🏢 Using partner company: ${partnerCompany.name} (${partnerCompany.id})`);
    
    // 2. Check current users assigned to this partner
    const assignedUsers = await prisma.user.findMany({
      where: {
        assignedPartnerId: { 
          in: [
            partnerCompany.id, 
            `legacy-partner-${partnerCompany.id}`,
            'legacy-partner-diamante-education-main'
          ]
        }
      },
      include: {
        registrations: {
          where: { partnerCompanyId: partnerCompany.id }
        },
        offerAccess: {
          where: { 
            partnerCompanyId: partnerCompany.id,
            enabled: true 
          }
        }
      }
    });
    
    console.log(`👥 Found ${assignedUsers.length} users assigned to this partner:`);
    
    for (const user of assignedUsers) {
      const isOrphan = user.registrations.length === 0 && user.offerAccess.length === 0;
      console.log(`  - ${user.email}: ${user.registrations.length} registrations, ${user.offerAccess.length} offer access → ${isOrphan ? '🚫 ORPHAN' : '✅ Active'}`);
    }
    
    // 3. Test the isUserOrphaned function
    console.log('\n🔍 Testing isUserOrphaned function:');
    for (const user of assignedUsers.slice(0, 3)) { // Test first 3 users
      const isOrphan = await isUserOrphaned(user.id, partnerCompany.id);
      console.log(`  - ${user.email}: ${isOrphan ? '🚫 ORPHAN' : '✅ Active'}`);
    }
    
    // 4. Test creating an offer access and then removing it
    const testUser = assignedUsers[0];
    if (testUser) {
      console.log(`\n🧪 Testing offer access for user: ${testUser.email}`);
      
      // Find an active offer for this partner
      const activeOffer = await prisma.partnerOffer.findFirst({
        where: { 
          partnerCompanyId: partnerCompany.id,
          isActive: true 
        }
      });
      
      if (activeOffer) {
        console.log(`📋 Using offer: ${activeOffer.name}`);
        
        // Check if user already has access
        let userAccess = await prisma.userOfferAccess.findUnique({
          where: {
            userId_offerId: {
              userId: testUser.id,
              offerId: activeOffer.id
            }
          }
        });
        
        // Grant access if not exists
        if (!userAccess) {
          userAccess = await prisma.userOfferAccess.create({
            data: {
              userId: testUser.id,
              offerId: activeOffer.id,
              partnerId: 'legacy-partner-diamante-education-main', // dummy
              partnerCompanyId: partnerCompany.id,
              enabled: true
            }
          });
          console.log('  ✅ Granted offer access');
        } else if (!userAccess.enabled) {
          await prisma.userOfferAccess.update({
            where: { id: userAccess.id },
            data: { enabled: true }
          });
          console.log('  ✅ Enabled existing offer access');
        } else {
          console.log('  ℹ️  User already has access');
        }
        
        // Check orphan status after granting access
        let isOrphan = await isUserOrphaned(testUser.id, partnerCompany.id);
        console.log(`  📊 After granting access: ${isOrphan ? '🚫 ORPHAN' : '✅ Active'}`);
        
        // Now revoke access
        await prisma.userOfferAccess.update({
          where: { id: userAccess.id },
          data: { enabled: false }
        });
        console.log('  ❌ Revoked offer access');
        
        // Check orphan status after revoking access
        isOrphan = await isUserOrphaned(testUser.id, partnerCompany.id);
        console.log(`  📊 After revoking access: ${isOrphan ? '🚫 ORPHAN' : '✅ Active'}`);
        
      } else {
        console.log('  ⚠️  No active offers found for this partner');
      }
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testOrphanedUserSystem();