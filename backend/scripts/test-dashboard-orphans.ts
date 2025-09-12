import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simulate the dashboard logic for orphaned users
async function simulateDashboardOrphanedQuery(partnerCompanyId: string) {
  console.log(`🔍 Simulating dashboard orphaned query for company: ${partnerCompanyId}\n`);
  
  // This is the NEW logic we implemented
  const partnerCompany = await prisma.partnerCompany.findUnique({
    where: { id: partnerCompanyId },
    select: { referralCode: true, name: true }
  });
  
  console.log(`🏢 Partner company: ${partnerCompany?.name} (${partnerCompany?.referralCode})`);
  
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
  
  // Get all users assigned to this partner (both new and legacy systems)
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
      },
      offerAccess: {
        where: {
          partnerCompanyId: partnerCompanyId,
          enabled: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`👥 Found ${assignedUsers.length} assigned users:`);
  assignedUsers.forEach(user => {
    console.log(`  - ${user.email} (${user.assignedPartnerId}): ${user.registrations.length} reg, ${user.offerAccess.length} access`);
  });

  // Filter users who are truly orphaned: no active registrations AND no enabled offer access
  const orphanedUsers = assignedUsers.filter(user => 
    user.registrations.length === 0 && user.offerAccess.length === 0
  );

  console.log(`\n🚫 Found ${orphanedUsers.length} orphaned users:`);
  orphanedUsers.forEach(user => {
    console.log(`  - ${user.email} (${user.assignedPartnerId})`);
  });

  const users = orphanedUsers.map((user: any) => ({
    id: user.id,
    registrationId: null,
    email: user.email,
    profile: user.profile,
    status: 'ORPHANED',
    course: 'Nessuna iscrizione attiva',
    courseId: null,
    offerType: null,
    isDirectUser: true,
    partnerName: 'Utente orfano',
    canManagePayments: false,
    isOrphaned: true,
    createdAt: user.createdAt,
    enrollmentDate: null,
    originalAmount: 0,
    finalAmount: 0,
    installments: 0,
    contractTemplateUrl: null,
    contractSignedUrl: null,
    contractGeneratedAt: null,
    contractUploadedAt: null,
  }));

  return { users, total: users.length };
}

async function testDashboardOrphans() {
  console.log('🧪 Testing Dashboard Orphaned Users Query...\n');
  
  try {
    // Test with the main partner company
    const result = await simulateDashboardOrphanedQuery('diamante-education-main');
    
    console.log(`\n📊 Dashboard result: ${result.total} orphaned users`);
    
    // Check if our problem user is included
    const problemUser = result.users.find((u: any) => u.email === 'stefanopriolo.boolean@gmail.com');
    
    if (problemUser) {
      console.log(`✅ SUCCESS: Problem user ${problemUser.email} is now shown in dashboard!`);
    } else {
      console.log(`❌ FAIL: Problem user is still not shown in dashboard.`);
    }
    
    // Show the final result structure
    console.log('\n📋 Final dashboard data:');
    result.users.forEach((user: any) => {
      console.log(`  - ${user.email}: ${user.status} (${user.partnerName})`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDashboardOrphans();