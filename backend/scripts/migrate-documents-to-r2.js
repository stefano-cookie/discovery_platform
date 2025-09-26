#!/usr/bin/env node

/**
 * Migration script: Upload existing documents from filesystem to R2
 * Run after R2 configuration is deployed
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Initialize R2 client
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

const bucketName = process.env.CLOUDFLARE_BUCKET_NAME || 'discovery-documents-prod';

async function migrateDocumentToR2(document, basePath) {
  const filePath = path.resolve(basePath, document.url);

  console.log(`📄 Processing: ${document.originalName} (${document.id})`);
  console.log(`   Local path: ${filePath}`);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`   ❌ File not found, skipping`);
    return { success: false, reason: 'file_not_found' };
  }

  try {
    // Read file
    const fileBuffer = fs.readFileSync(filePath);

    // Generate R2 key
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const fileExtension = path.extname(document.originalName);
    const r2Key = `documents/${document.userId}/${document.type}/${timestamp}-${randomId}${fileExtension}`;

    // Upload to R2
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: r2Key,
      Body: fileBuffer,
      ContentType: document.mimeType,
      Metadata: {
        originalName: document.originalName,
        userId: document.userId,
        documentType: document.type,
        migratedAt: new Date().toISOString(),
        originalPath: document.url,
      },
    });

    await s3Client.send(uploadCommand);
    console.log(`   ✅ Uploaded to R2: ${r2Key}`);

    // Update database with R2 key
    await prisma.userDocument.update({
      where: { id: document.id },
      data: {
        url: r2Key, // Replace local path with R2 key
      }
    });

    console.log(`   ✅ Database updated`);

    return {
      success: true,
      r2Key,
      size: fileBuffer.length,
      originalPath: filePath
    };

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function main() {
  console.log('🚀 Starting document migration to R2...');

  // Base paths to check for documents
  const possibleBasePaths = [
    '/var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend',
    '/var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it',
    process.cwd(),
  ];

  // Get all documents from database
  const documents = await prisma.userDocument.findMany({
    where: {
      // Only documents that don't look like R2 keys yet
      url: {
        not: {
          startsWith: 'documents/'
        }
      }
    },
    orderBy: { uploadedAt: 'desc' }
  });

  console.log(`📊 Found ${documents.length} documents to migrate`);

  if (documents.length === 0) {
    console.log('✅ No documents to migrate (all already on R2 or none found)');
    return;
  }

  let migrated = 0;
  let failed = 0;
  let notFound = 0;

  for (const document of documents) {
    console.log(`\n--- Document ${migrated + failed + notFound + 1}/${documents.length} ---`);

    let result = null;

    // Try different base paths
    for (const basePath of possibleBasePaths) {
      console.log(`🔍 Trying base path: ${basePath}`);
      result = await migrateDocumentToR2(document, basePath);
      if (result.success) break;
    }

    if (result?.success) {
      migrated++;
      console.log(`   🎉 Success! Total migrated: ${migrated}`);
    } else if (result?.reason === 'file_not_found') {
      notFound++;
      console.log(`   ⚠️  File not found in any location`);
    } else {
      failed++;
      console.log(`   💥 Failed: ${result?.reason}`);
    }

    // Small delay to avoid overwhelming R2
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n🏁 Migration completed!');
  console.log(`✅ Migrated: ${migrated}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Not found: ${notFound}`);
  console.log(`📊 Total: ${documents.length}`);

  if (migrated > 0) {
    console.log('\n🎯 Next steps:');
    console.log('1. Test document uploads/downloads');
    console.log('2. All new documents will automatically go to R2');
    console.log('3. Consider cleanup of old filesystem documents');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());