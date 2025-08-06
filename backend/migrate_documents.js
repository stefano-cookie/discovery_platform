const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function migrateDocuments() {
  try {
    console.log('🔄 Starting document migration from legacy to UserDocument table...\n');
    
    // Get all legacy documents
    const legacyDocuments = await prisma.document.findMany({
      include: {
        registration: {
          include: {
            user: true
          }
        }
      }
    });
    
    console.log(`Found ${legacyDocuments.length} legacy documents to migrate\n`);
    
    let migrated = 0;
    let failed = 0;
    
    for (const legacyDoc of legacyDocuments) {
      try {
        console.log(`Processing: ${legacyDoc.fileName}`);
        
        // Determine document type based on fileName or default to OTHER
        let documentType = 'OTHER';
        const fileName = legacyDoc.fileName.toLowerCase();
        
        if (fileName.includes('identit') || fileName.includes('carta')) {
          documentType = 'IDENTITY_CARD';
        } else if (fileName.includes('tessera') || fileName.includes('sanitaria')) {
          documentType = 'TESSERA_SANITARIA';
        } else if (fileName.includes('laurea')) {
          if (fileName.includes('magistrale')) {
            documentType = 'MASTER_DEGREE';
          } else if (fileName.includes('triennale')) {
            documentType = 'BACHELOR_DEGREE';
          } else {
            documentType = 'BACHELOR_DEGREE';
          }
        } else if (fileName.includes('diploma')) {
          documentType = 'DIPLOMA';
        } else if (fileName.includes('medic')) {
          documentType = 'MEDICAL_CERT';
        } else if (fileName.includes('nascita')) {
          documentType = 'BIRTH_CERT';
        } else if (fileName.includes('cv') || fileName.includes('curriculum')) {
          documentType = 'CV';
        }
        
        // Check if file exists
        const fileExists = fs.existsSync(legacyDoc.filePath);
        let fileSize = 0;
        let mimeType = 'application/pdf'; // Default
        
        if (fileExists) {
          const stats = fs.statSync(legacyDoc.filePath);
          fileSize = stats.size;
          
          // Determine MIME type from extension
          const ext = path.extname(legacyDoc.fileName).toLowerCase();
          if (ext === '.pdf') mimeType = 'application/pdf';
          else if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
          else if (ext === '.png') mimeType = 'image/png';
        } else {
          console.log(`  ⚠️ File not found: ${legacyDoc.filePath}`);
          fileSize = 1000; // Default size for missing files
        }
        
        // Check if already migrated
        const existing = await prisma.userDocument.findFirst({
          where: {
            userId: legacyDoc.registration.userId,
            registrationId: legacyDoc.registrationId,
            originalName: legacyDoc.fileName
          }
        });
        
        if (existing) {
          console.log(`  ⏭️ Already migrated, skipping...`);
          continue;
        }
        
        // Create UserDocument record
        const userDocument = await prisma.userDocument.create({
          data: {
            userId: legacyDoc.registration.userId,
            registrationId: legacyDoc.registrationId,
            type: documentType,
            originalName: legacyDoc.fileName,
            mimeType: mimeType,
            size: fileSize,
            url: legacyDoc.filePath,
            status: 'PENDING',
            uploadSource: 'ENROLLMENT',
            uploadedBy: legacyDoc.registration.userId,
            uploadedByRole: 'USER',
            uploadedAt: legacyDoc.uploadedAt || new Date()
          }
        });
        
        console.log(`  ✅ Migrated as ${documentType} (ID: ${userDocument.id})`);
        migrated++;
        
      } catch (error) {
        console.error(`  ❌ Failed to migrate: ${error.message}`);
        failed++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${migrated} documents`);
    console.log(`❌ Failed: ${failed} documents`);
    console.log(`📄 Total processed: ${legacyDocuments.length} documents`);
    
    // Verify migration
    const userDocCount = await prisma.userDocument.count();
    console.log(`\n✨ Total UserDocuments in database: ${userDocCount}`);
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateDocuments();