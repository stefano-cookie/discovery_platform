import { Router } from 'express';
import multer from 'multer';
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authenticate, AuthRequest, authenticateUnified } from '../../middleware/auth';
import { r2ClientFactory, R2Account } from '../../services/r2ClientFactory';

const router = Router();

// Get R2 configuration from centralized factory
const getNoticesConfig = () => {
  if (!r2ClientFactory.isConfigured(R2Account.NOTICES)) {
    throw new Error('Notices R2 account not configured');
  }
  return r2ClientFactory.getClient(R2Account.NOTICES);
};

// Configure multer for memory storage (upload to R2 instead of disk)
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed file types
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo file non supportato: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

/**
 * Generate unique filename
 */
function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const ext = originalName.substring(originalName.lastIndexOf('.'));
  const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));

  // Clean filename (remove special chars)
  const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '-');

  return `${cleanName}-${timestamp}-${randomStr}${ext}`;
}

/**
 * Determine file type from mimetype
 */
function getFileType(mimetype: string): string {
  if (mimetype.startsWith('image/')) {
    return 'image';
  } else if (mimetype === 'application/pdf') {
    return 'pdf';
  } else if (
    mimetype.includes('word') ||
    mimetype.includes('excel') ||
    mimetype.includes('powerpoint') ||
    mimetype.includes('spreadsheet') ||
    mimetype.includes('presentation')
  ) {
    return 'document';
  }
  return 'file';
}

/**
 * POST /api/notices/upload
 * Upload file attachment for notice to R2
 * Accessible by: ADMIN only
 */
router.post('/', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const user = req.user;

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can upload files' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const uniqueFilename = generateUniqueFilename(file.originalname);
    const fileKey = `notices/${uniqueFilename}`;

    // Get R2 config from factory
    const config = getNoticesConfig();

    // Upload to R2
    const uploadCommand = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        'original-name': file.originalname,
        'uploaded-by': user.id,
        'uploaded-at': new Date().toISOString(),
      },
    });

    await config.client.send(uploadCommand);

    // Generate signed URL (7 days expiry) - no need for public bucket
    const getCommand = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: fileKey,
    });

    const signedUrl = await getSignedUrl(config.client, getCommand, { expiresIn: 604800 }); // 7 days
    const type = getFileType(file.mimetype);

    const attachment = {
      name: file.originalname,
      url: signedUrl, // Use signed URL instead of public URL
      type: type,
      size: file.size,
      mimeType: file.mimetype,
      key: fileKey, // Store the R2 key for future deletion
    };

    console.log('File uploaded to R2 successfully:', attachment);

    res.status(201).json({ attachment });
  } catch (error: any) {
    console.error('Error uploading file to R2:', error);
    res.status(500).json({ error: 'Failed to upload file', details: error.message });
  }
});

/**
 * DELETE /api/notices/upload/:filename
 * Delete uploaded file from R2
 * Accessible by: ADMIN only
 * Filename can be URL-encoded path like "notices/filename.jpg" or just "filename.jpg"
 */
router.delete('/:filename', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can delete files' });
    }

    // Decode the filename parameter (it may contain URL-encoded slashes)
    let fileKey = decodeURIComponent(req.params.filename);

    // If it doesn't start with "notices/", assume it's just the filename
    if (!fileKey.startsWith('notices/')) {
      fileKey = `notices/${fileKey}`;
    }

    // Get R2 config from factory
    const config = getNoticesConfig();

    // Delete from R2
    const deleteCommand = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: fileKey,
    });

    await config.client.send(deleteCommand);

    console.log('File deleted from R2:', fileKey);
    res.json({ success: true, message: 'File deleted' });
  } catch (error: any) {
    console.error('Error deleting file from R2:', error);

    // If file not found, still return success (idempotent)
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return res.json({ success: true, message: 'File already deleted or not found' });
    }

    res.status(500).json({ error: 'Failed to delete file', details: error.message });
  }
});

export default router;
