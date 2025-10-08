import { PrismaClient } from '@prisma/client';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';
import * as readline from 'readline';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

// Initialize R2 client
const ACCOUNT_ID = process.env.R2_DOCUMENTS_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_DOCUMENTS_ACCESS_KEY_ID || process.env.CLOUDFLARE_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_DOCUMENTS_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.R2_DOCUMENTS_BUCKET_NAME || process.env.CLOUDFLARE_BUCKET_NAME || 'discovery-documents-prod';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID!,
    secretAccessKey: SECRET_ACCESS_KEY!,
  },
});

interface OrphanedFile {
  key: string;
  userId: string | null;
  reason: string;
}

async function listAllR2Files(prefix: string = 'documents/'): Promise<string[]> {
  const files: string[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const response = await r2Client.send(command);

    if (response.Contents) {
      files.push(...response.Contents.map(obj => obj.Key || '').filter(Boolean));
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
}

async function extractUserIdFromPath(filePath: string): Promise<string | null> {
  // Path format: documents/{userId}/{type}/{filename}
  const parts = filePath.split('/');
  if (parts.length >= 2 && parts[0] === 'documents') {
    return parts[1]; // userId
  }
  return null;
}

async function findOrphanedFiles(): Promise<OrphanedFile[]> {
  console.log('🔍 Scanning R2 bucket for orphaned files...\n');

  const r2Files = await listAllR2Files('documents/');
  console.log(`📦 Found ${r2Files.length} files on R2\n`);

  const orphanedFiles: OrphanedFile[] = [];
  const checkedUserIds = new Set<string>();

  for (const file of r2Files) {
    const userId = await extractUserIdFromPath(file);

    if (!userId) {
      orphanedFiles.push({
        key: file,
        userId: null,
        reason: 'Invalid path format'
      });
      continue;
    }

    // Check if we already verified this userId
    if (checkedUserIds.has(userId)) {
      continue;
    }

    // Check if user exists in database
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!userExists) {
      // Mark all files for this userId as orphaned
      const userFiles = r2Files.filter(f => f.includes(`documents/${userId}/`));
      userFiles.forEach(f => {
        orphanedFiles.push({
          key: f,
          userId,
          reason: 'User deleted from database'
        });
      });
      checkedUserIds.add(userId);
    } else {
      checkedUserIds.add(userId);
    }
  }

  return orphanedFiles;
}

async function deleteFile(key: string): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    await r2Client.send(command);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting ${key}:`, error);
    return false;
  }
}

async function promptUser(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  try {
    console.log('=' .repeat(70));
    console.log('🧹 R2 ORPHANED FILES CLEANUP');
    console.log('='.repeat(70));
    console.log(`📦 Bucket: ${BUCKET_NAME}`);
    console.log(`🔑 Account: ${ACCOUNT_ID?.substring(0, 8)}...`);
    console.log('');

    // Find orphaned files
    const orphanedFiles = await findOrphanedFiles();

    if (orphanedFiles.length === 0) {
      console.log('✅ No orphaned files found! Everything is clean.');
      return;
    }

    // Group by userId
    const filesByUser = orphanedFiles.reduce((acc, file) => {
      const userId = file.userId || 'invalid-path';
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push(file);
      return {};
    }, {} as Record<string, OrphanedFile[]>);

    console.log('\n' + '='.repeat(70));
    console.log('📊 ORPHANED FILES SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total orphaned files: ${orphanedFiles.length}`);
    console.log(`Unique users: ${Object.keys(filesByUser).length}`);
    console.log('');

    // Show details
    console.log('📋 Files to be deleted:\n');
    orphanedFiles.slice(0, 20).forEach((file, idx) => {
      console.log(`${idx + 1}. ${file.key}`);
      console.log(`   User: ${file.userId || 'N/A'}`);
      console.log(`   Reason: ${file.reason}\n`);
    });

    if (orphanedFiles.length > 20) {
      console.log(`... and ${orphanedFiles.length - 20} more files\n`);
    }

    // Ask for confirmation
    console.log('⚠️  WARNING: This will permanently delete these files from R2!');
    const confirmed = await promptUser('\nDo you want to proceed? (y/N): ');

    if (!confirmed) {
      console.log('\n❌ Operation cancelled by user.');
      return;
    }

    // Delete files
    console.log('\n🗑️  Deleting orphaned files...\n');
    let deletedCount = 0;

    for (const file of orphanedFiles) {
      process.stdout.write(`Deleting: ${file.key}...`);
      const success = await deleteFile(file.key);
      if (success) {
        console.log(' ✅');
        deletedCount++;
      } else {
        console.log(' ❌');
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ CLEANUP COMPLETE');
    console.log('='.repeat(70));
    console.log(`Deleted: ${deletedCount}/${orphanedFiles.length} files`);
    console.log(`Failed: ${orphanedFiles.length - deletedCount} files`);
    console.log('');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
