import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOrphanedUsersAssignment() {
  try {
    console.log('🔍 Searching for orphaned users without assignedPartnerCompanyId...');

    // Find all users with role USER who don't have assignedPartnerCompanyId
    const orphanedUsers = await prisma.user.findMany({
      where: {
        role: 'USER',
        assignedPartnerCompanyId: null
      },
      include: {
        registrations: {
          include: {
            partnerCompany: true
          }
        }
      }
    });

    console.log(`Found ${orphanedUsers.length} users without assignedPartnerCompanyId`);

    let updated = 0;

    for (const user of orphanedUsers) {
      // Check if user has or had any registrations
      if (user.registrations.length > 0) {
        // Take the partnerCompanyId from the most recent registration
        const mostRecentRegistration = user.registrations.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        const partnerCompanyId = mostRecentRegistration.partnerCompanyId;

        if (partnerCompanyId) {
          console.log(`📌 Updating user ${user.email} with partnerCompanyId ${partnerCompanyId} from registration`);

          await prisma.user.update({
            where: { id: user.id },
            data: { assignedPartnerCompanyId: partnerCompanyId }
          });

          updated++;
        }
      } else {
        // User has no registrations at all - check if they have any partner company association
        // This would need additional logic based on your business rules
        console.log(`⚠️ User ${user.email} has no registrations - needs manual review`);
      }
    }

    console.log(`\n✅ Updated ${updated} users with assignedPartnerCompanyId`);
    console.log(`⚠️ ${orphanedUsers.length - updated} users need manual review`);

  } catch (error) {
    console.error('Error fixing orphaned users:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixOrphanedUsersAssignment()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });