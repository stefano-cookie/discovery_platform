-- Add Documents System - Enterprise Grade Implementation
-- Based on CLAUDE.md specifications

-- Create DocumentStatus enum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Create DocumentType enum for consistency
CREATE TYPE "DocumentType" AS ENUM (
  'CARTA_IDENTITA',
  'TESSERA_SANITARIA', 
  'CERTIFICATO_TRIENNALE',
  'CERTIFICATO_MAGISTRALE',
  'PIANO_STUDIO_TRIENNALE', 
  'PIANO_STUDIO_MAGISTRALE',
  'CERTIFICATO_MEDICO',
  'CERTIFICATO_NASCITA',
  'DIPLOMA_LAUREA',
  'PERGAMENA_LAUREA',
  'DIPLOMA_MATURITA',
  'CONTRATTO',
  'ALTRO'
);

-- Main UserDocument table (replaces simple Document model)
CREATE TABLE "UserDocument" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "registrationId" TEXT,
  "type" "DocumentType" NOT NULL,
  "fileName" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedBy" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "UserDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserDocument_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "UserDocument_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- DocumentAuditLog for compliance and audit trail
CREATE TABLE "DocumentAuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "documentId" TEXT NOT NULL,
  "action" TEXT NOT NULL, -- UPLOADED, APPROVED, REJECTED, DELETED, REPLACED
  "performedBy" TEXT NOT NULL,
  "previousStatus" "DocumentStatus",
  "newStatus" "DocumentStatus",
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "DocumentAuditLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UserDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DocumentAuditLog_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- DocumentTypeConfig for dynamic document requirements
CREATE TABLE "DocumentTypeConfig" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "type" "DocumentType" NOT NULL UNIQUE,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "acceptedMimeTypes" TEXT[] NOT NULL DEFAULT ARRAY['application/pdf', 'image/jpeg', 'image/png'],
  "maxFileSize" INTEGER NOT NULL DEFAULT 10485760, -- 10MB default
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add partner document fields to Registration table
ALTER TABLE "Registration" 
ADD COLUMN "cnredUrl" TEXT,
ADD COLUMN "cnredUploadedAt" TIMESTAMP(3),
ADD COLUMN "adverintiaUrl" TEXT, 
ADD COLUMN "adverintiaUploadedAt" TIMESTAMP(3);

-- Indexes for performance
CREATE INDEX "UserDocument_userId_idx" ON "UserDocument"("userId");
CREATE INDEX "UserDocument_registrationId_idx" ON "UserDocument"("registrationId");
CREATE INDEX "UserDocument_type_idx" ON "UserDocument"("type");
CREATE INDEX "UserDocument_status_idx" ON "UserDocument"("status");
CREATE INDEX "UserDocument_uploadedAt_idx" ON "UserDocument"("uploadedAt");
CREATE INDEX "DocumentAuditLog_documentId_idx" ON "DocumentAuditLog"("documentId");
CREATE INDEX "DocumentAuditLog_performedBy_idx" ON "DocumentAuditLog"("performedBy");
CREATE INDEX "DocumentAuditLog_createdAt_idx" ON "DocumentAuditLog"("createdAt");

-- Insert default document type configurations
INSERT INTO "DocumentTypeConfig" ("type", "label", "description", "isRequired", "sortOrder") VALUES
('CARTA_IDENTITA', 'Carta d''Identità', 'Documento di identità valido', true, 1),
('TESSERA_SANITARIA', 'Tessera Sanitaria / Codice Fiscale', 'Tessera sanitaria o documento con codice fiscale', true, 2),
('CERTIFICATO_TRIENNALE', 'Certificato Laurea Triennale', 'Certificato di laurea triennale', false, 3),
('CERTIFICATO_MAGISTRALE', 'Certificato Laurea Magistrale', 'Certificato di laurea magistrale', false, 4),
('PIANO_STUDIO_TRIENNALE', 'Piano di Studio Triennale', 'Piano di studio della laurea triennale', false, 5),
('PIANO_STUDIO_MAGISTRALE', 'Piano di Studio Magistrale', 'Piano di studio della laurea magistrale', false, 6),
('CERTIFICATO_MEDICO', 'Certificato Medico', 'Certificato medico di idoneità', false, 7),
('CERTIFICATO_NASCITA', 'Certificato di Nascita', 'Certificato o estratto di nascita', false, 8),
('DIPLOMA_LAUREA', 'Diploma di Laurea', 'Diploma di laurea originale', false, 9),
('PERGAMENA_LAUREA', 'Pergamena di Laurea', 'Pergamena di laurea', false, 10),
('DIPLOMA_MATURITA', 'Diploma di Maturità', 'Diploma di scuola superiore', false, 11),
('CONTRATTO', 'Contratto', 'Contratto firmato', false, 12),
('ALTRO', 'Altro', 'Altri documenti', false, 13);

-- Create function for automatic audit logging
CREATE OR REPLACE FUNCTION log_document_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "DocumentAuditLog" ("documentId", "action", "performedBy", "newStatus", "notes")
    VALUES (NEW."id", 'UPLOADED', NEW."userId", NEW."status", 'Document uploaded');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD."status" != NEW."status" THEN
      INSERT INTO "DocumentAuditLog" ("documentId", "action", "performedBy", "previousStatus", "newStatus", "notes")
      VALUES (NEW."id", 
              CASE 
                WHEN NEW."status" = 'APPROVED' THEN 'APPROVED'
                WHEN NEW."status" = 'REJECTED' THEN 'REJECTED'
                ELSE 'STATUS_CHANGED'
              END,
              COALESCE(NEW."verifiedBy", NEW."userId"), 
              OLD."status", 
              NEW."status",
              COALESCE(NEW."rejectionReason", 'Status changed'));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO "DocumentAuditLog" ("documentId", "action", "performedBy", "previousStatus", "notes")
    VALUES (OLD."id", 'DELETED', OLD."userId", OLD."status", 'Document deleted');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic audit logging
CREATE TRIGGER document_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "UserDocument"
  FOR EACH ROW EXECUTE FUNCTION log_document_changes();

-- Update trigger for updatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_document_updated_at
  BEFORE UPDATE ON "UserDocument"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_type_config_updated_at
  BEFORE UPDATE ON "DocumentTypeConfig"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();