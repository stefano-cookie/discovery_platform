import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testOrphanedUserFix() {
  console.log('🔧 Testing Orphaned User Fix...\n');
  
  try {
    // 1. Find the problem user
    const problemUser = await prisma.user.findUnique({
      where: { email: 'stefanopriolo.boolean@gmail.com' },
      include: {
        registrations: true,
        offerAccess: true
      }
    });
    
    if (!problemUser) {
      console.log('❌ Problem user not found');
      return;
    }
    
    console.log(`👤 Problem user: ${problemUser.email}`);
    console.log(`   - assignedPartnerId: ${problemUser.assignedPartnerId}`);
    console.log(`   - registrations: ${problemUser.registrations.length}`);
    console.log(`   - offerAccess: ${problemUser.offerAccess.length}`);
    
    // 2. Find the corresponding partner company
    const partnerCompany = await prisma.partnerCompany.findUnique({
      where: { id: 'diamante-education-main' }
    });
    
    if (!partnerCompany) {
      console.log('❌ Partner company not found');
      return;
    }
    
    console.log(`\n🏢 Partner company: ${partnerCompany.name} (${partnerCompany.id})`);
    console.log(`   - referralCode: ${partnerCompany.referralCode}`);
    
    // 3. Test the legacy partner lookup logic
    const baseCode = partnerCompany.referralCode.split('-')[0];
    console.log(`\n🔍 Looking for legacy partners with base code: ${baseCode}`);
    
    const legacyPartners = await prisma.partner.findMany({
      where: {
        OR: [
          { referralCode: { startsWith: partnerCompany.referralCode } },
          { referralCode: { endsWith: 'LEGACY' } }
        ]
      },
      select: { id: true, referralCode: true }
    });
    
    console.log(`   Found ${legacyPartners.length} potential legacy partners:`);
    legacyPartners.forEach(p => console.log(`   - ${p.id} (${p.referralCode})`));
    
    // Filter to only include partners that match this company's base referral code
    const legacyPartnerIds = legacyPartners
      .filter(p => p.referralCode.startsWith(baseCode))
      .map(p => p.id);
    
    console.log(`\n✅ Filtered legacy partner IDs: ${legacyPartnerIds}`);
    console.log(`   Problem user's assignedPartnerId: ${problemUser.assignedPartnerId}`);
    console.log(`   Is problem user in legacy list? ${legacyPartnerIds.includes(problemUser.assignedPartnerId || '')}`);
    
    // 4. Test the new query logic
    console.log('\n🔍 Testing new orphaned user query logic:');
    
    const assignedUsers = await prisma.user.findMany({
      where: {
        OR: [
          { assignedPartnerId: partnerCompany.id }, // New system
          { assignedPartnerId: { in: legacyPartnerIds } } // Legacy system
        ]
      },
      include: {
        profile: true,
        registrations: {
          where: {
            partnerCompanyId: partnerCompany.id
          }
        },
        offerAccess: {
          where: {
            partnerCompanyId: partnerCompany.id,
            enabled: true
          }
        }
      }
    });
    
    console.log(`   Found ${assignedUsers.length} assigned users:`);
    
    const orphanedUsers = assignedUsers.filter(user => 
      user.registrations.length === 0 && user.offerAccess.length === 0
    );
    
    console.log(`   Found ${orphanedUsers.length} orphaned users:`);
    orphanedUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.assignedPartnerId})`);
    });
    
    // 5. Verify the problem user is now included
    const problemUserInList = orphanedUsers.find(u => u.email === problemUser.email);
    if (problemUserInList) {
      console.log(`\n✅ SUCCESS: Problem user is now correctly identified as orphaned!`);
    } else {
      console.log(`\n❌ FAIL: Problem user is still not identified as orphaned.`);
    }
    
    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testOrphanedUserFix();