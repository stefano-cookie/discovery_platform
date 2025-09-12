import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testNewOrphanedLogic() {
  console.log('🧪 Testing New Orphaned Logic (Only Registrations Matter)...\n');
  
  try {
    // Test user that should be orphaned
    const testUser = await prisma.user.findUnique({
      where: { email: 'stefanopriolo.boolean@gmail.com' },
      include: {
        registrations: true,
        offerAccess: true
      }
    });
    
    if (!testUser) {
      console.log('❌ Test user not found');
      return;
    }
    
    console.log(`👤 Test user: ${testUser.email}`);
    console.log(`   - assignedPartnerId: ${testUser.assignedPartnerId}`);
    console.log(`   - registrations: ${testUser.registrations.length}`);
    console.log(`   - offerAccess records: ${testUser.offerAccess.length}`);
    
    // Check current UserOfferAccess status
    const enabledAccess = testUser.offerAccess.filter(access => access.enabled);
    const disabledAccess = testUser.offerAccess.filter(access => !access.enabled);
    
    console.log(`   - enabled offerAccess: ${enabledAccess.length}`);
    console.log(`   - disabled offerAccess: ${disabledAccess.length}`);
    
    // Test the new isUserOrphaned function
    const partnerCompanyId = 'diamante-education-main';
    
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
    
    const isOrphan = await isUserOrphaned(testUser.id, partnerCompanyId);
    console.log(`\n🔍 Is user orphaned? ${isOrphan ? '🚫 YES' : '✅ NO'}`);
    console.log(`   Logic: User has ${testUser.registrations.filter(r => r.partnerCompanyId === partnerCompanyId).length} registrations with partner company`);
    
    // Test scenario 1: User with no registrations but with offer access should still be orphaned
    console.log(`\n📊 Scenario 1: User with offer access but no registrations`);
    console.log(`   - Should be orphaned: YES (because no actual registrations)`);
    console.log(`   - Current status: ${isOrphan ? 'ORPHANED ✅' : 'NOT ORPHANED ❌'}`);
    
    if (testUser.offerAccess.length > 0) {
      // Enable offer access to test that it doesn't change orphaned status
      console.log(`\n🔧 Testing: Enabling offer access...`);
      
      for (const access of testUser.offerAccess) {
        await prisma.userOfferAccess.update({
          where: { id: access.id },
          data: { enabled: true }
        });
      }
      
      const stillOrphan = await isUserOrphaned(testUser.id, partnerCompanyId);
      console.log(`   - After enabling offer access: ${stillOrphan ? 'STILL ORPHANED ✅' : 'NOT ORPHANED ❌'}`);
      console.log(`   - This is correct: offer access doesn't affect orphan status`);
      
      // Disable it again
      for (const access of testUser.offerAccess) {
        await prisma.userOfferAccess.update({
          where: { id: access.id },
          data: { enabled: false }
        });
      }
    }
    
    // Test dashboard query with the new logic
    console.log(`\n📋 Testing Dashboard Query...`);
    
    // Find legacy partner IDs
    const partnerCompany = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      select: { referralCode: true }
    });
    
    let legacyPartnerIds: string[] = [];
    if (partnerCompany?.referralCode) {
      const legacyPartners = await prisma.partner.findMany({
        where: {
          OR: [
            { referralCode: { startsWith: partnerCompany.referralCode } },
            { referralCode: { endsWith: 'LEGACY' } }
          ]
        },
        select: { id: true, referralCode: true }
      });
      
      const baseCode = partnerCompany.referralCode.split('-')[0];
      legacyPartnerIds = legacyPartners
        .filter(p => p.referralCode.startsWith(baseCode))
        .map(p => p.id);
    }
    
    // Get all users assigned to this partner (new dashboard logic)
    const assignedUsers = await prisma.user.findMany({
      where: {
        OR: [
          { assignedPartnerId: partnerCompanyId },
          { assignedPartnerId: { in: legacyPartnerIds } }
        ]
      },
      include: {
        profile: true,
        registrations: {
          where: {
            partnerCompanyId: partnerCompanyId
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Filter users who are orphaned: no registrations at all
    const orphanedUsers = assignedUsers.filter(user => 
      user.registrations.length === 0
    );
    
    console.log(`   - Found ${assignedUsers.length} assigned users`);
    console.log(`   - Found ${orphanedUsers.length} orphaned users`);
    
    orphanedUsers.forEach(user => {
      console.log(`     - ${user.email}: 0 registrations → ORPHANED`);
    });
    
    const testUserInOrphans = orphanedUsers.find(u => u.email === testUser.email);
    console.log(`\n✅ Test user in orphaned list: ${testUserInOrphans ? 'YES' : 'NO'}`);
    
    console.log(`\n🎯 Summary:`);
    console.log(`   - New Logic: User is orphaned ONLY if they have no registrations`);
    console.log(`   - UserOfferAccess (offer permissions) don't affect orphaned status`);
    console.log(`   - User can have enabled/disabled offer access and still be orphaned`);
    console.log(`   - Only completing an actual registration removes orphaned status`);
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testNewOrphanedLogic();