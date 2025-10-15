/**
 * Backfill script to populate performedBy field in existing DiscoveryAdminLog records
 * This adds "Nome Cognome" to all logs that don't have it yet
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillPerformedBy() {
  console.log('🔄 Starting backfill of performedBy field...\n');

  try {
    // Get all logs without performedBy
    const logsWithoutPerformedBy = await prisma.discoveryAdminLog.findMany({
      where: {
        OR: [
          { performedBy: null },
          { performedBy: '' },
        ],
      },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    console.log(`📊 Found ${logsWithoutPerformedBy.length} logs without performedBy\n`);

    if (logsWithoutPerformedBy.length === 0) {
      console.log('✅ All logs already have performedBy field populated!');
      return;
    }

    // Get all admin accounts
    const adminAccounts = await prisma.adminAccount.findMany({
      select: {
        id: true,
        userId: true,
        nome: true,
        cognome: true,
      },
    });

    console.log(`👥 Found ${adminAccounts.length} admin accounts\n`);

    // Create maps
    const adminNameMap = new Map<string, string>();
    const adminAccountIdMap = new Map<string, string>();
    adminAccounts.forEach((admin) => {
      adminNameMap.set(admin.userId, `${admin.nome} ${admin.cognome}`);
      adminAccountIdMap.set(admin.userId, admin.id);
    });

    // Update logs
    let updated = 0;
    let skipped = 0;

    for (const log of logsWithoutPerformedBy) {
      const fullName = adminNameMap.get(log.adminId);
      const adminAccountId = adminAccountIdMap.get(log.adminId);

      if (fullName && adminAccountId) {
        await prisma.discoveryAdminLog.update({
          where: { id: log.id },
          data: {
            performedBy: fullName,
            adminAccountId: adminAccountId,
          },
        });
        updated++;
        console.log(`✅ Updated log ${log.id}: ${log.admin.email} → ${fullName}`);
      } else {
        // No admin account found, use email as fallback
        await prisma.discoveryAdminLog.update({
          where: { id: log.id },
          data: {
            performedBy: log.admin.email,
          },
        });
        skipped++;
        console.log(`⚠️  No admin account for ${log.admin.email}, using email as performedBy`);
      }
    }

    console.log('\n📈 Backfill Summary:');
    console.log(`   ✅ Updated with nome/cognome: ${updated}`);
    console.log(`   ⚠️  Fallback to email: ${skipped}`);
    console.log(`   📊 Total processed: ${updated + skipped}`);
    console.log('\n✅ Backfill completed successfully!');
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillPerformedBy()
  .then(() => {
    console.log('\n🎉 Script finished!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
