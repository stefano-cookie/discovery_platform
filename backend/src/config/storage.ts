import * as fs from 'fs';
import * as path from 'path';

// 🔥 ANTI-DEPLOYMENT BREAKAGE SYSTEM
// Configurazione centralizzata per storage paths
export const StorageConfig = {
  uploadBasePath: process.env.UPLOAD_BASE_PATH || path.join(process.cwd(), 'uploads'),
  documentsPath: path.join(process.env.UPLOAD_BASE_PATH || path.join(process.cwd(), 'uploads'), 'documents'),
  tempPath: path.join(process.env.UPLOAD_BASE_PATH || path.join(process.cwd(), 'uploads'), 'temp'),

  // Environment detection
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',

  // Auto-create paths on startup
  initializeDirectories() {
    const dirs = [this.uploadBasePath, this.documentsPath, this.tempPath];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        // Console output removed
      }
    });
  },

  // Resolve storage path from relative URL
  getStoragePath(relativeUrl: string): string {
    return path.join(this.uploadBasePath, relativeUrl);
  },

  // Normalize path for DB storage (always relative)
  normalizeForDB(absolutePath: string): string {
    return path.relative(this.uploadBasePath, absolutePath);
  },

  // Ensure directory exists for file path
  ensureDirectoryExists(fullPath: string): void {
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
};

// Document Path Resolver - ANTI-DEPLOYMENT BREAKAGE
export class DocumentPathResolver {
  private static readonly UPLOAD_BASE = process.env.UPLOAD_BASE_PATH || path.join(process.cwd(), 'uploads');

  static getStoragePath(relativeUrl: string): string {
    return path.join(this.UPLOAD_BASE, relativeUrl);
  }

  static normalizeForDB(absolutePath: string): string {
    return path.relative(this.UPLOAD_BASE, absolutePath);
  }

  static ensureDirectoryExists(fullPath: string): void {
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Resolve path from document URL (handles both absolute and relative)
  static resolvePath(documentUrl: string): string {
    if (path.isAbsolute(documentUrl)) {
      return documentUrl; // Already absolute
    }
    return path.join(this.UPLOAD_BASE, documentUrl);
  }
}