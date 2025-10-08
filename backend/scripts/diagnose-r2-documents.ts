import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { S3Client, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

// Initialize R2 client - using CLOUDFLARE_ prefix (legacy naming)
const ACCOUNT_ID = process.env.R2_DOCUMENTS_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_DOCUMENTS_ACCESS_KEY_ID || process.env.CLOUDFLARE_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_DOCUMENTS_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.R2_DOCUMENTS_BUCKET_NAME || process.env.CLOUDFLARE_BUCKET_NAME || 'discovery-documents-dev';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID!,
    secretAccessKey: SECRET_ACCESS_KEY!,
  },
});

interface DiagnosticResult {
  totalDocuments: number;
  existsOnR2: number;
  missingOnR2: number;
  invalidPaths: number;
  missingDocuments: Array<{
    id: string;
    userId: string;
    type: string;
    url: string;
    uploadedAt: Date;
  }>;
}

async function checkFileExistsOnR2(key: string): Promise<boolean> {
  try {
    await r2Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

async function listR2Objects(prefix: string = 'documents/'): Promise<string[]> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: 1000,
    });
    const response = await r2Client.send(command);
    return response.Contents?.map(obj => obj.Key || '') || [];
  } catch (error) {
    console.error('❌ Error listing R2 objects:', error);
    return [];
  }
}

async function diagnoseDocuments(): Promise<DiagnosticResult> {
  console.log('🔍 Starting R2 documents diagnostic...\n');
  console.log(`📦 Bucket: ${BUCKET_NAME}`);
  console.log(`🔑 Account ID: ${ACCOUNT_ID}\n`);

  // Get all documents from database
  const documents = await prisma.userDocument.findMany({
    select: {
      id: true,
      userId: true,
      type: true,
      url: true,
      uploadedAt: true,
      originalName: true,
    },
    orderBy: { uploadedAt: 'desc' },
  });

  console.log(`📊 Total documents in database: ${documents.length}\n`);

  const result: DiagnosticResult = {
    totalDocuments: documents.length,
    existsOnR2: 0,
    missingOnR2: 0,
    invalidPaths: 0,
    missingDocuments: [],
  };

  // Sample check: verify first 10 documents
  console.log('🔍 Checking sample of documents on R2...\n');
  const sampleSize = Math.min(10, documents.length);

  for (let i = 0; i < sampleSize; i++) {
    const doc = documents[i];
    console.log(`\n📄 Document ${i + 1}/${sampleSize}:`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Type: ${doc.type}`);
    console.log(`   Original Name: ${doc.originalName}`);
    console.log(`   Storage Path: ${doc.url}`);
    console.log(`   Uploaded: ${doc.uploadedAt.toISOString()}`);

    // Check if path looks valid
    if (!doc.url || doc.url.includes('temp_') || doc.url.includes('undefined')) {
      console.log(`   ⚠️  INVALID PATH DETECTED`);
      result.invalidPaths++;
      continue;
    }

    // Check if file exists on R2
    const exists = await checkFileExistsOnR2(doc.url);
    console.log(`   ${exists ? '✅' : '❌'} File ${exists ? 'EXISTS' : 'MISSING'} on R2`);

    if (exists) {
      result.existsOnR2++;
    } else {
      result.missingOnR2++;
      result.missingDocuments.push({
        id: doc.id,
        userId: doc.userId,
        type: doc.type,
        url: doc.url,
        uploadedAt: doc.uploadedAt,
      });
    }
  }

  // List some R2 objects
  console.log('\n\n📦 Sample R2 bucket contents:');
  const r2Objects = await listR2Objects('documents/');
  console.log(`   Total objects with 'documents/' prefix: ${r2Objects.length}`);
  if (r2Objects.length > 0) {
    console.log('\n   First 10 objects:');
    r2Objects.slice(0, 10).forEach((key, idx) => {
      console.log(`   ${idx + 1}. ${key}`);
    });
  }

  return result;
}

async function main() {
  try {
    const result = await diagnoseDocuments();

    console.log('\n\n' + '='.repeat(60));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total documents in database: ${result.totalDocuments}`);
    console.log(`Sample checked: 10 documents`);
    console.log(`✅ Exist on R2: ${result.existsOnR2}`);
    console.log(`❌ Missing on R2: ${result.missingOnR2}`);
    console.log(`⚠️  Invalid paths: ${result.invalidPaths}`);

    if (result.missingDocuments.length > 0) {
      console.log('\n❌ MISSING DOCUMENTS DETAILS:');
      result.missingDocuments.forEach((doc, idx) => {
        console.log(`\n${idx + 1}. Document ID: ${doc.id}`);
        console.log(`   User ID: ${doc.userId}`);
        console.log(`   Type: ${doc.type}`);
        console.log(`   Path: ${doc.url}`);
        console.log(`   Uploaded: ${doc.uploadedAt.toISOString()}`);
      });

      console.log('\n💡 RECOMMENDED ACTIONS:');
      console.log('1. Check if files were uploaded to wrong bucket');
      console.log('2. Verify R2 credentials and bucket name in .env');
      console.log('3. Check if files were deleted manually from R2');
      console.log('4. Review upload logs for errors');
    }

    if (result.invalidPaths > 0) {
      console.log('\n⚠️  WARNING: Some documents have invalid paths');
      console.log('   These may be from incomplete uploads or migration issues');
    }

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
