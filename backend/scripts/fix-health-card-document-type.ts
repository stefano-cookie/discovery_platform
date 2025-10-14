/**
 * Script to fix incorrectly stored health card documents
 *
 * Problem: Documents uploaded as 'certificatoMedico' (health card) were being
 * stored as DocumentType.CV instead of DocumentType.TESSERA_SANITARIA
 *
 * This script:
 * 1. Finds all documents with type CV that belong to CERTIFICATION registrations
 * 2. Updates them to TESSERA_SANITARIA type
 * 3. Logs all changes for verification
 *
 * Usage:
 *   npx ts-node scripts/fix-health-card-document-type.ts [--dry-run]
 */

import { PrismaClient, DocumentType } from '@prisma/client';

const prisma = new PrismaClient();

async function fixHealthCardDocuments(dryRun: boolean = true) {
  console.log('🔍 Finding incorrectly typed health card documents...\n');

  try {
    // Find all registrations for CERTIFICATION offers
    const certificationRegistrations = await prisma.registration.findMany({
      where: {
        offer: {
          offerType: 'CERTIFICATION'
        }
      },
      select: {
        id: true,
        userId: true,
        offer: {
          select: {
            course: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    console.log(`📋 Found ${certificationRegistrations.length} CERTIFICATION registrations\n`);

    const registrationIds = certificationRegistrations.map(r => r.id);

    if (registrationIds.length === 0) {
      console.log('✅ No CERTIFICATION registrations found. Nothing to fix.');
      return;
    }

    // Find CV documents linked to these registrations
    const incorrectDocuments = await prisma.userDocument.findMany({
      where: {
        registrationId: {
          in: registrationIds
        },
        type: DocumentType.CV
      },
      include: {
        registration: {
          include: {
            user: {
              include: {
                profile: true
              }
            },
            offer: {
              include: {
                course: true
              }
            }
          }
        }
      }
    });

    console.log(`❌ Found ${incorrectDocuments.length} documents with incorrect type (CV)\n`);

    if (incorrectDocuments.length === 0) {
      console.log('✅ No documents need fixing!');
      return;
    }

    // Display documents to be fixed
    console.log('📄 Documents to be updated:\n');
    incorrectDocuments.forEach((doc, index) => {
      const userName = doc.registration?.user?.profile
        ? `${doc.registration.user.profile.nome} ${doc.registration.user.profile.cognome}`
        : doc.registration?.user?.email || 'Unknown';
      const courseName = doc.registration?.offer?.course?.name || 'Unknown';

      console.log(`  ${index + 1}. Document ID: ${doc.id}`);
      console.log(`     User: ${userName}`);
      console.log(`     Course: ${courseName}`);
      console.log(`     File: ${doc.originalName}`);
      console.log(`     Current Type: ${doc.type} → Will change to: TESSERA_SANITARIA`);
      console.log(`     Uploaded: ${doc.uploadedAt.toISOString()}`);
      console.log('');
    });

    if (dryRun) {
      console.log('⚠️  DRY RUN MODE - No changes made');
      console.log('   Run without --dry-run flag to apply changes\n');
      return;
    }

    // Update documents
    console.log('🔧 Updating documents...\n');

    const updateResult = await prisma.userDocument.updateMany({
      where: {
        id: {
          in: incorrectDocuments.map(d => d.id)
        }
      },
      data: {
        type: DocumentType.TESSERA_SANITARIA
      }
    });

    console.log(`✅ Successfully updated ${updateResult.count} documents`);
    console.log('   Type changed: CV → TESSERA_SANITARIA\n');

    // Verify the fix
    const verifyCount = await prisma.userDocument.count({
      where: {
        registrationId: {
          in: registrationIds
        },
        type: DocumentType.TESSERA_SANITARIA
      }
    });

    console.log(`🔍 Verification: ${verifyCount} TESSERA_SANITARIA documents now exist for CERTIFICATION registrations`);

  } catch (error) {
    console.error('❌ Error fixing documents:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.length === 0;

console.log('='.repeat(80));
console.log('🏥 Health Card Document Type Fix Script');
console.log('='.repeat(80));
console.log('');

if (dryRun) {
  console.log('🔍 Running in DRY RUN mode (no changes will be made)\n');
} else {
  console.log('⚠️  LIVE MODE - Changes will be applied!\n');
}

fixHealthCardDocuments(dryRun)
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
