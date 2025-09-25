#!/usr/bin/env node

/**
 * Script per verificare se i documenti nel database esistono fisicamente
 * Da eseguire periodicamente per monitorare la perdita di documenti
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function checkMissingDocuments() {
    console.log('🔍 Checking for missing document files...');

    try {
        // Ottieni tutti i documenti dal database
        const documents = await prisma.userDocument.findMany({
            include: {
                user: {
                    select: { email: true }
                }
            },
            orderBy: { uploadedAt: 'desc' }
        });

        let missingCount = 0;
        let totalCount = documents.length;
        const missingDocs = [];

        console.log(`📊 Found ${totalCount} documents in database`);

        for (const doc of documents) {
            let filePath;

            // Determina il path del file basandosi sull'URL
            if (doc.url.startsWith('/var/www/')) {
                filePath = doc.url;
            } else if (doc.url.startsWith('uploads/')) {
                filePath = path.join(process.cwd(), doc.url);
            } else {
                filePath = path.join(process.cwd(), 'uploads', doc.url);
            }

            // Verifica se il file esiste
            if (!fs.existsSync(filePath)) {
                missingCount++;
                missingDocs.push({
                    id: doc.id,
                    type: doc.type,
                    originalName: doc.originalName,
                    url: doc.url,
                    userEmail: doc.user.email,
                    uploadedAt: doc.uploadedAt,
                    calculatedPath: filePath
                });
            }
        }

        console.log(`\n📋 REPORT:`);
        console.log(`✅ Total documents: ${totalCount}`);
        console.log(`❌ Missing files: ${missingCount}`);
        console.log(`📊 Missing percentage: ${((missingCount / totalCount) * 100).toFixed(2)}%`);

        if (missingDocs.length > 0) {
            console.log(`\n🚨 MISSING DOCUMENTS:`);
            console.table(missingDocs.map(doc => ({
                Type: doc.type,
                User: doc.userEmail,
                UploadedAt: doc.uploadedAt.toISOString().split('T')[0],
                OriginalName: doc.originalName.substring(0, 30) + '...'
            })));

            // Crea un report dettagliato
            const reportPath = path.join(process.cwd(), 'missing-documents-report.json');
            fs.writeFileSync(reportPath, JSON.stringify(missingDocs, null, 2));
            console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        }

        return { total: totalCount, missing: missingCount, missingDocs };

    } catch (error) {
        console.error('❌ Error checking documents:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
    checkMissingDocuments()
        .then(result => {
            if (result.missing > 0) {
                process.exit(1); // Exit con errore se ci sono documenti mancanti
            }
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { checkMissingDocuments };