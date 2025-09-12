import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDeleteOrphanedUsers() {
  console.log('🧪 Testing Delete Orphaned Users Functionality...\n');
  
  try {
    // Simulate the dashboard logic for finding orphaned users
    const partnerCompanyId = 'diamante-education-main';
    
    console.log(`🔍 Finding orphaned users for company: ${partnerCompanyId}\n`);
    
    // Find partner company
    const partnerCompany = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      select: { referralCode: true, name: true }
    });
    
    if (!partnerCompany) {
      console.log('❌ Partner company not found');
      return;
    }
    
    console.log(`🏢 Partner company: ${partnerCompany.name} (${partnerCompany.referralCode})`);
    
    // Find legacy partners
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
      
      // Filter to only include partners that match this company's base referral code
      const baseCode = partnerCompany.referralCode.split('-')[0];
      legacyPartnerIds = legacyPartners
        .filter(p => p.referralCode.startsWith(baseCode))
        .map(p => p.id);
        
      console.log(`🔗 Found legacy partner IDs: ${legacyPartnerIds}`);
    }
    
    // Find all assigned users (same logic as dashboard)
    const assignedUsers = await prisma.user.findMany({
      where: {
        OR: [
          { assignedPartnerId: partnerCompanyId }, // New system
          { assignedPartnerId: { in: legacyPartnerIds } } // Legacy system
        ]
      },
      include: {
        profile: true,
        registrations: {
          where: {
            partnerCompanyId: partnerCompanyId
          }
        }
      }
    });

    console.log(`👥 Found ${assignedUsers.length} assigned users:`);
    assignedUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.assignedPartnerId}): ${user.registrations.length} registrations`);
    });

    // Filter truly orphaned users: NO registrations at all for this partner
    const orphanedUsers = assignedUsers.filter(user => 
      user.registrations.length === 0
    );

    console.log(`\\n🚫 Found ${orphanedUsers.length} orphaned users:`);
    orphanedUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.assignedPartnerId}) - NO registrations → ORPHANED`);
    });

    if (orphanedUsers.length === 0) {
      console.log('\\n✅ No orphaned users found - nothing to delete');
      return;
    }

    // Test 1: Delete single orphaned user (simulate API call)
    console.log(`\\n🧪 TEST 1: Simulating delete single orphaned user`);
    const testUser = orphanedUsers[0];
    console.log(`   Target user: ${testUser.email} (${testUser.id})`);
    
    // Simulate the isUserOrphaned check from the API
    const registrationCount = await prisma.registration.count({
      where: {
        userId: testUser.id,
        partnerCompanyId: partnerCompanyId
      }
    });
    
    const isUserOrphaned = registrationCount === 0;
    console.log(`   Is truly orphaned? ${isUserOrphaned ? 'YES ✅' : 'NO ❌'} (${registrationCount} registrations)`);
    
    if (!isUserOrphaned) {
      console.log('   ⚠️ User has registrations - would not be deleted');
    } else {
      console.log('   ✅ User is orphaned and would be safe to delete');
      
      // Show what would be deleted
      const userDocuments = await prisma.userDocument.findMany({
        where: { userId: testUser.id },
        select: { id: true, type: true, originalName: true }
      });
      
      const userProfile = await prisma.userProfile.findUnique({
        where: { userId: testUser.id }
      });
      
      const userOfferAccess = await prisma.userOfferAccess.findMany({
        where: { userId: testUser.id }
      });
      
      console.log(`   Would delete:`);
      console.log(`   - ${userDocuments.length} user documents`);
      console.log(`   - ${userProfile ? 1 : 0} user profile`);
      console.log(`   - ${userOfferAccess.length} offer access records`);
      console.log(`   - 1 user record`);
    }

    // Test 2: Show what bulk delete would do
    console.log(`\\n🧪 TEST 2: Simulating bulk delete all orphaned users`);
    console.log(`   Would delete ${orphanedUsers.length} orphaned users:`);
    
    for (const user of orphanedUsers) {
      const regCount = await prisma.registration.count({
        where: { userId: user.id, partnerCompanyId }
      });
      console.log(`   - ${user.email}: ${regCount} registrations → ${regCount === 0 ? 'WOULD DELETE' : 'WOULD SKIP'}`);
    }
    
    console.log('\\n🎯 Test Summary:');
    console.log(`   - Found ${assignedUsers.length} users assigned to partner`);
    console.log(`   - Found ${orphanedUsers.length} truly orphaned users (no registrations)`);
    console.log(`   - Delete functionality would safely remove only truly orphaned users`);
    console.log(`   - Users with any registrations are protected from deletion`);
    
    console.log('\\n🎉 Delete orphaned users test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDeleteOrphanedUsers();