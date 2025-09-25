#!/usr/bin/env node

/**
 * Script per finalizzare documenti orfani nella directory temp-enrollment
 * Trova documenti in temp che non sono stati finalizzati e li associa alle registrazioni
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function finalizeOrphanDocuments() {
    console.log('🔍 Looking for orphan documents in temp-enrollment...');

    try {
        const tempDir = path.join(process.cwd(), 'uploads', 'temp-enrollment');

        if (!fs.existsSync(tempDir)) {
            console.log('❌ Temp directory does not exist');
            return;
        }

        const files = fs.readdirSync(tempDir);
        console.log(`📁 Found ${files.length} files in temp directory`);

        for (const file of files) {
            if (!file.endsWith('.pdf') && !file.endsWith('.jpg') && !file.endsWith('.png') && !file.endsWith('.jpeg')) {
                continue;
            }

            const filePath = path.join(tempDir, file);
            const stats = fs.statSync(filePath);

            console.log(`\n📄 Processing file: ${file}`);
            console.log(`⏰ Created: ${stats.birthtime.toISOString()}`);

            // Find recent registrations that might match this file timing
            const timeWindow = 10 * 60 * 1000; // 10 minutes
            const registrations = await prisma.registration.findMany({
                where: {
                    createdAt: {
                        gte: new Date(stats.birthtime.getTime() - timeWindow),
                        lte: new Date(stats.birthtime.getTime() + timeWindow)
                    }
                },
                include: {
                    user: true,
                    offer: true
                },
                orderBy: { createdAt: 'desc' }
            });

            console.log(`🔎 Found ${registrations.length} registrations in time window`);

            if (registrations.length === 0) {
                console.log('⚠️ No matching registration found for this timeframe');
                continue;
            }

            // Take the most recent registration
            const registration = registrations[0];
            console.log(`📋 Matching with registration: ${registration.id} (${registration.user.email})`);

            // Check if this registration already has documents
            const existingDocs = await prisma.userDocument.findMany({
                where: { registrationId: registration.id }
            });

            if (existingDocs.length > 0) {
                console.log(`⚠️ Registration already has ${existingDocs.length} documents, skipping`);
                continue;
            }

            // Create document record for CERTIFICATION (CIAD) offer
            if (registration.offer?.offerType === 'CERTIFICATION') {
                console.log('🎯 Creating IDENTITY_CARD document for CERTIFICATION offer');

                const permanentPath = `uploads/documents/user-uploads/${Date.now()}-${Math.random().toString(36).substring(2)}-${file}`;
                const absolutePermanentPath = path.join(process.cwd(), permanentPath);

                // Ensure target directory exists
                const targetDir = path.dirname(absolutePermanentPath);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                // Move file to permanent location
                fs.copyFileSync(filePath, absolutePermanentPath);
                console.log(`📁 File moved to: ${permanentPath}`);

                // Create document record
                const document = await prisma.userDocument.create({
                    data: {
                        userId: registration.userId,
                        registrationId: registration.id,
                        type: 'IDENTITY_CARD', // Standard type for CIAD
                        originalName: file,
                        url: permanentPath,
                        size: stats.size,
                        mimeType: file.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
                        uploadSource: 'ENROLLMENT',
                        uploadedBy: registration.userId,
                        uploadedByRole: 'USER',
                        status: 'PENDING'
                    }
                });

                console.log(`✅ Document created: ${document.id}`);

                // Remove temp file
                fs.unlinkSync(filePath);
                console.log(`🗑️ Temp file removed`);

            } else {
                console.log(`⚠️ Unsupported offer type: ${registration.offer?.offerType}`);
            }
        }

        console.log('\n🎉 Orphan document finalization completed!');

    } catch (error) {
        console.error('❌ Error finalizing orphan documents:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Execute if called directly
if (require.main === module) {
    finalizeOrphanDocuments()
        .then(() => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Script failed:', error);
            process.exit(1);
        });
}

module.exports = { finalizeOrphanDocuments };