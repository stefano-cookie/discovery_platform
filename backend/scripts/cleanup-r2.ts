import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
  },
});

interface CleanupOptions {
  bucket: string;
  prefix?: string;
  olderThanDays?: number;
  dryRun?: boolean;
}

async function cleanupR2Bucket(options: CleanupOptions) {
  const { bucket, prefix = '', olderThanDays, dryRun = true } = options;

  console.log(`\n🧹 R2 Cleanup Script`);
  console.log(`📦 Bucket: ${bucket}`);
  console.log(`📁 Prefix: ${prefix || 'ALL'}`);
  console.log(`📅 Older than: ${olderThanDays ? `${olderThanDays} days` : 'ANY'}`);
  console.log(`🔒 Dry run: ${dryRun ? 'YES (no files will be deleted)' : 'NO (files WILL be deleted)'}`);
  console.log('');

  let continuationToken: string | undefined;
  let totalFiles = 0;
  let totalSize = 0;
  let filesToDelete: string[] = [];

  const cutoffDate = olderThanDays
    ? new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
    : null;

  try {
    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(listCommand);

      if (response.Contents) {
        for (const object of response.Contents) {
          const shouldDelete = !cutoffDate ||
            (object.LastModified && object.LastModified < cutoffDate);

          if (shouldDelete && object.Key) {
            totalFiles++;
            totalSize += object.Size || 0;
            filesToDelete.push(object.Key);

            if (dryRun) {
              console.log(`Would delete: ${object.Key} (${formatBytes(object.Size || 0)}) - ${object.LastModified?.toISOString()}`);
            }
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    console.log(`\n📊 Summary:`);
    console.log(`Files to delete: ${totalFiles}`);
    console.log(`Total size: ${formatBytes(totalSize)}`);

    if (!dryRun && filesToDelete.length > 0) {
      console.log(`\n🗑️  Deleting files...`);

      // Delete in batches of 1000 (S3 limit)
      const batchSize = 1000;
      for (let i = 0; i < filesToDelete.length; i += batchSize) {
        const batch = filesToDelete.slice(i, i + batchSize);

        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: batch.map(key => ({ Key: key })),
            Quiet: false,
          },
        });

        const deleteResponse = await s3Client.send(deleteCommand);
        console.log(`✅ Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} files`);

        if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
          console.error('❌ Errors:', deleteResponse.Errors);
        }
      }

      console.log(`\n✅ Cleanup complete! Deleted ${totalFiles} files (${formatBytes(totalSize)})`);
    } else if (dryRun) {
      console.log(`\n⚠️  DRY RUN - No files were actually deleted`);
      console.log(`Run with --no-dry-run to actually delete files`);
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// CLI Usage
const args = process.argv.slice(2);
const bucket = args[0] || 'discovery-documents-dev';
const prefix = args[1] || '';
const olderThanDays = args[2] ? parseInt(args[2]) : undefined;
const dryRun = !args.includes('--no-dry-run');

if (!process.env.CLOUDFLARE_ENDPOINT) {
  console.error('❌ Missing CLOUDFLARE_ENDPOINT in .env');
  process.exit(1);
}

cleanupR2Bucket({
  bucket,
  prefix,
  olderThanDays,
  dryRun,
}).catch(console.error);