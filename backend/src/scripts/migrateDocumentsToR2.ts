import { PrismaClient } from '@prisma/client';
import storageService from '../services/storageService';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
}

/**
 * Migra tutti i documenti esistenti dal filesystem locale a Cloudflare R2
 */
async function migrateDocumentsToR2() {
  console.log('🔄 MIGRAZIONE DOCUMENTI A R2');
  console.log('===========================');

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  };

  try {
    // 1. Trova tutti i documenti con path locali
    console.log('1. 📊 Analisi documenti esistenti...');

    const documentsToMigrate = await prisma.userDocument.findMany({
      where: {
        OR: [
          { url: { startsWith: '/uploads/' } },
          { url: { startsWith: './uploads/' } },
          { url: { startsWith: 'uploads/' } },
          { url: { contains: '/uploads/' } }
        ]
      },
      include: {
        user: {
          select: { id: true, email: true }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });

    stats.total = documentsToMigrate.length;
    console.log(`📄 Trovati ${stats.total} documenti da migrare`);

    if (stats.total === 0) {
      console.log('✅ Nessun documento da migrare - tutti già su R2!');
      return stats;
    }

    // 2. Migrazione documento per documento
    console.log('\n2. 🚀 Avvio migrazione...');

    for (const [index, doc] of documentsToMigrate.entries()) {
      const progress = `[${index + 1}/${stats.total}]`;
      console.log(`\n${progress} Elaborando documento: ${doc.originalName}`);

      try {
        // Risolvi path completo del file locale
        const localPath = resolveLocalPath(doc.url);
        console.log(`   📁 Path locale: ${localPath}`);

        // Controlla se il file esiste
        if (!fs.existsSync(localPath)) {
          console.log(`   ⚠️  File non trovato localmente - skip`);
          stats.skipped++;
          continue;
        }

        // Leggi file dal filesystem
        const fileBuffer = fs.readFileSync(localPath);
        const fileStat = fs.statSync(localPath);

        console.log(`   📦 Dimensione file: ${fileBuffer.length} bytes`);

        // Carica su R2
        const uploadResult = await storageService.uploadFile(
          fileBuffer,
          doc.originalName,
          doc.mimeType,
          doc.userId,
          doc.type
        );

        console.log(`   ☁️  Caricato su R2: ${uploadResult.key}`);

        // Aggiorna database con nuovo R2 key
        await prisma.userDocument.update({
          where: { id: doc.id },
          data: {
            url: uploadResult.key, // Sostituisce path locale con R2 key
            size: fileBuffer.length, // Aggiorna dimensione corretta
            // Mantieni checksum per integrità
            checksum: crypto.createHash('sha256').update(fileBuffer).digest('hex')
          }
        });

        console.log(`   ✅ Database aggiornato`);
        stats.migrated++;

        // Optional: rimuovi file locale dopo migrazione
        // fs.unlinkSync(localPath);
        // console.log(`   🗑️  File locale rimosso`);

      } catch (error) {
        const errorMsg = `Errore su documento ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`   ❌ ${errorMsg}`);
        stats.errors++;
        stats.errorDetails.push(errorMsg);
      }
    }

    // 3. Report finale
    console.log('\n📊 MIGRAZIONE COMPLETATA');
    console.log('========================');
    console.log(`📄 Totale documenti: ${stats.total}`);
    console.log(`✅ Migrati con successo: ${stats.migrated}`);
    console.log(`⚠️  Saltati (file mancanti): ${stats.skipped}`);
    console.log(`❌ Errori: ${stats.errors}`);

    if (stats.errors > 0) {
      console.log('\n❌ DETTAGLI ERRORI:');
      stats.errorDetails.forEach(error => console.log(`   - ${error}`));
    }

    const successRate = stats.total > 0 ? ((stats.migrated / stats.total) * 100).toFixed(1) : '0';
    console.log(`\n🎯 Tasso di successo: ${successRate}%`);

    return stats;

  } catch (error) {
    console.error('💥 Errore fatale durante migrazione:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Risolve il path locale completo del file
 */
function resolveLocalPath(dbPath: string): string {
  // Rimuovi prefissi comuni
  let cleanPath = dbPath.replace(/^\.?\//, '');

  // Se inizia con 'uploads/', è relativo alla root del progetto
  if (cleanPath.startsWith('uploads/')) {
    return path.join(process.cwd(), cleanPath);
  }

  // Se contiene '/uploads/', prova a estrarre la parte uploads
  const uploadsIndex = cleanPath.indexOf('/uploads/');
  if (uploadsIndex >= 0) {
    const uploadsPath = cleanPath.substring(uploadsIndex + 1);
    return path.join(process.cwd(), uploadsPath);
  }

  // Fallback: aggiungi backend/uploads se necessario
  if (!cleanPath.includes('uploads')) {
    return path.join(process.cwd(), 'backend', 'uploads', cleanPath);
  }

  return path.resolve(cleanPath);
}

/**
 * Funzione di verifica pre-migrazione
 */
async function verifyMigrationReadiness() {
  console.log('🔍 VERIFICA PRE-MIGRAZIONE');
  console.log('=========================');

  // Verifica connessione R2
  try {
    const testResult = await storageService.uploadFile(
      Buffer.from('test-migration'),
      'test-migration.txt',
      'text/plain',
      'migration-test',
      'test'
    );
    console.log(`✅ R2 funzionante: ${testResult.key}`);

    // Cleanup test file
    await storageService.deleteFile(testResult.key);
  } catch (error) {
    console.error('❌ R2 non raggiungibile:', error);
    return false;
  }

  // Verifica database
  try {
    const docCount = await prisma.userDocument.count();
    console.log(`✅ Database connesso: ${docCount} documenti totali`);
  } catch (error) {
    console.error('❌ Database non raggiungibile:', error);
    return false;
  }

  console.log('✅ Sistema pronto per migrazione');
  return true;
}

// Script eseguibile
if (require.main === module) {
  async function run() {
    try {
      console.log('🚀 AVVIO SCRIPT MIGRAZIONE R2');
      console.log('============================\n');

      const isReady = await verifyMigrationReadiness();
      if (!isReady) {
        console.error('💥 Sistema non pronto per migrazione');
        process.exit(1);
      }

      console.log('\n⚠️  ATTENZIONE: Questa operazione modificherà il database!');
      console.log('   Assicurati di avere un backup recente.');
      console.log('\nProcedendo in 3 secondi...\n');

      await new Promise(resolve => setTimeout(resolve, 3000));

      const stats = await migrateDocumentsToR2();

      if (stats.migrated > 0) {
        console.log('\n🎉 Migrazione completata con successo!');
        console.log('   I documenti sono ora protetti dai deploy.');
      }

    } catch (error) {
      console.error('💥 Migrazione fallita:', error);
      process.exit(1);
    }
  }

  run();
}

export { migrateDocumentsToR2, verifyMigrationReadiness };
export default migrateDocumentsToR2;