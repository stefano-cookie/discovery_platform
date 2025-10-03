/**
 * Migration Script: Popola assignedPartnerCompanyId per utenti legacy
 *
 * Questo script migra gli utenti dal vecchio sistema (assignedPartnerId -> Partner)
 * al nuovo sistema (assignedPartnerCompanyId -> PartnerCompany)
 *
 * Strategia:
 * 1. Per ogni User con assignedPartnerId ma senza assignedPartnerCompanyId
 * 2. Trova il Partner legacy corrispondente
 * 3. Trova la PartnerCompany con lo stesso referralCode
 * 4. Aggiorna assignedPartnerCompanyId
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateAssignedPartnerToCompany() {
  console.log('🔄 Starting migration: assignedPartnerId → assignedPartnerCompanyId\n');

  try {
    // 1. Trova tutti gli utenti con assignedPartnerId ma senza assignedPartnerCompanyId
    const usersToMigrate = await prisma.user.findMany({
      where: {
        assignedPartnerId: { not: null },
        assignedPartnerCompanyId: null
      },
      include: {
        assignedPartner: {
          select: {
            id: true,
            referralCode: true
          }
        }
      }
    });

    console.log(`📊 Found ${usersToMigrate.length} users to migrate\n`);

    if (usersToMigrate.length === 0) {
      console.log('✅ No users to migrate. All done!');
      return;
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // 2. Per ogni utente, trova la PartnerCompany corrispondente
    for (const user of usersToMigrate) {
      try {
        if (!user.assignedPartner) {
          console.log(`⚠️  User ${user.email}: No assignedPartner found (orphaned reference)`);
          skipCount++;
          continue;
        }

        const referralCode = user.assignedPartner.referralCode;

        // Trova PartnerCompany con stesso referralCode
        const partnerCompany = await prisma.partnerCompany.findUnique({
          where: { referralCode }
        });

        if (!partnerCompany) {
          console.log(`⚠️  User ${user.email}: No PartnerCompany found for referralCode ${referralCode}`);
          skipCount++;
          continue;
        }

        // Aggiorna assignedPartnerCompanyId
        await prisma.user.update({
          where: { id: user.id },
          data: {
            assignedPartnerCompanyId: partnerCompany.id
          }
        });

        console.log(`✅ User ${user.email}: ${referralCode} → ${partnerCompany.name}`);
        successCount++;

      } catch (error) {
        console.error(`❌ Error migrating user ${user.email}:`, error);
        errorCount++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ⚠️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors:  ${errorCount}`);
    console.log(`   📊 Total:   ${usersToMigrate.length}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateAssignedPartnerToCompany()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
