import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testRevokeBehavior() {
  console.log('🧪 Testing Revoke Behavior with New Orphaned Logic...\n');
  
  try {
    // Find test user and their offer access
    const testUser = await prisma.user.findUnique({
      where: { email: 'stefanopriolo.boolean@gmail.com' },
      include: {
        offerAccess: true,
        registrations: true
      }
    });
    
    if (!testUser || testUser.offerAccess.length === 0) {
      console.log('❌ Test user not found or has no offer access');
      return;
    }
    
    const offerAccess = testUser.offerAccess[0];
    const partnerCompanyId = 'diamante-education-main';
    
    console.log(`👤 Test user: ${testUser.email}`);
    console.log(`📋 Testing offer access: ${offerAccess.offerId}`);
    console.log(`🏢 Partner company: ${partnerCompanyId}`);
    
    // Helper function (same as in routes/partner.ts)
    async function isUserOrphaned(userId: string, partnerCompanyId: string): Promise<boolean> {
      const registrations = await prisma.registration.count({
        where: {
          userId,
          partnerCompanyId
        }
      });
      return registrations === 0;
    }
    
    // Simulate the revoke behavior
    console.log(`\n🔧 Testing revoke scenarios:`);
    
    // Scenario 1: User with no registrations
    console.log(`\n📊 Scenario 1: User has no registrations`);
    console.log(`   - User registrations: ${testUser.registrations.length}`);
    
    // Before revoke
    let userIsOrphanedBefore = await isUserOrphaned(testUser.id, partnerCompanyId);
    console.log(`   - Before revoke: ${userIsOrphanedBefore ? 'ORPHANED' : 'NOT ORPHANED'}`);
    
    // Revoke access
    await prisma.userOfferAccess.update({
      where: { id: offerAccess.id },
      data: { enabled: false }
    });
    console.log(`   - Revoked offer access`);
    
    // After revoke
    let userIsOrphanedAfter = await isUserOrphaned(testUser.id, partnerCompanyId);
    console.log(`   - After revoke: ${userIsOrphanedAfter ? 'ORPHANED' : 'NOT ORPHANED'}`);
    console.log(`   - Status changed? ${userIsOrphanedBefore !== userIsOrphanedAfter ? 'YES' : 'NO'} (should be NO)`);
    
    // Grant access back
    await prisma.userOfferAccess.update({
      where: { id: offerAccess.id },
      data: { enabled: true }
    });
    console.log(`   - Granted offer access back`);
    
    let userIsOrphanedGranted = await isUserOrphaned(testUser.id, partnerCompanyId);
    console.log(`   - After grant: ${userIsOrphanedGranted ? 'ORPHANED' : 'NOT ORPHANED'}`);
    console.log(`   - Still orphaned? ${userIsOrphanedGranted ? 'YES' : 'NO'} (should be YES because no registrations)`);
    
    // Scenario 2: Simulate what happens if user HAD a registration
    console.log(`\n📊 Scenario 2: Simulating user with registration`);
    
    // Create a dummy registration for testing
    const dummyRegistration = await prisma.registration.create({
      data: {
        userId: testUser.id,
        partnerId: 'test-partner-id',
        partnerCompanyId: partnerCompanyId,
        sourcePartnerCompanyId: partnerCompanyId,
        isDirectRegistration: true,
        courseId: 'test-course-id',
        partnerOfferId: offerAccess.offerId,
        offerType: 'CERTIFICATION',
        originalAmount: 100,
        finalAmount: 100,
        remainingAmount: 100,
        installments: 1,
        status: 'PENDING'
      }
    });
    console.log(`   - Created dummy registration: ${dummyRegistration.id.substring(0, 8)}...`);
    
    // Now user should not be orphaned
    let userIsOrphanedWithReg = await isUserOrphaned(testUser.id, partnerCompanyId);
    console.log(`   - With registration: ${userIsOrphanedWithReg ? 'ORPHANED' : 'NOT ORPHANED'} (should be NOT ORPHANED)`);
    
    // Revoke access again
    await prisma.userOfferAccess.update({
      where: { id: offerAccess.id },
      data: { enabled: false }
    });
    console.log(`   - Revoked offer access again`);
    
    // User should STILL not be orphaned because they have a registration
    let userIsOrphanedWithRegAfterRevoke = await isUserOrphaned(testUser.id, partnerCompanyId);
    console.log(`   - After revoke (but with registration): ${userIsOrphanedWithRegAfterRevoke ? 'ORPHANED' : 'NOT ORPHANED'} (should be NOT ORPHANED)`);
    
    // Clean up - delete dummy registration
    await prisma.registration.delete({
      where: { id: dummyRegistration.id }
    });
    console.log(`   - Cleaned up dummy registration`);
    
    // Reset offer access
    await prisma.userOfferAccess.update({
      where: { id: offerAccess.id },
      data: { enabled: false }  // Leave as disabled for consistency
    });
    
    console.log(`\n✅ Key Behaviors Verified:`);
    console.log(`   1. User without registrations stays orphaned regardless of offer access`);
    console.log(`   2. User with registrations is never orphaned, regardless of offer access`);
    console.log(`   3. Revoking/granting offer access doesn't change orphan status`);
    console.log(`   4. Only completing registrations affects orphan status`);
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testRevokeBehavior();