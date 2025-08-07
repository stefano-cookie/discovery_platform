// Test script to verify document saving in UserDocument table

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDocumentSave() {
  try {
    console.log('🔍 Testing document save functionality...\n');
    
    // Count documents before test
    const beforeCount = await prisma.userDocument.count();
    console.log(`📊 Documents in UserDocument table before test: ${beforeCount}`);
    
    // Get recent registrations to check if they have documents
    const recentRegistrations = await prisma.registration.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        userDocuments: true,
        user: {
          select: {
            email: true
          }
        }
      }
    });
    
    console.log('\n📋 Recent registrations and their documents:');
    for (const reg of recentRegistrations) {
      console.log(`\n  Registration ID: ${reg.id}`);
      console.log(`  User: ${reg.user.email}`);
      console.log(`  Created: ${reg.createdAt.toISOString()}`);
      console.log(`  Documents: ${reg.userDocuments.length}`);
      
      if (reg.userDocuments.length > 0) {
        console.log('  Document details:');
        for (const doc of reg.userDocuments) {
          console.log(`    - ${doc.type}: ${doc.originalName} (${doc.status})`);
          console.log(`      Path: ${doc.url}`);
          console.log(`      Size: ${doc.size} bytes`);
        }
      }
    }
    
    // Check for orphaned documents (without registrationId)
    const orphanedDocs = await prisma.userDocument.count({
      where: {
        registrationId: null
      }
    });
    console.log(`\n⚠️  Orphaned documents (no registrationId): ${orphanedDocs}`);
    
    // Check documents by upload source
    const bySource = await prisma.userDocument.groupBy({
      by: ['uploadSource'],
      _count: true
    });
    
    console.log('\n📤 Documents by upload source:');
    for (const source of bySource) {
      console.log(`  ${source.uploadSource || 'NULL'}: ${source._count} documents`);
    }
    
    // Check documents by status
    const byStatus = await prisma.userDocument.groupBy({
      by: ['status'],
      _count: true
    });
    
    console.log('\n📊 Documents by status:');
    for (const status of byStatus) {
      console.log(`  ${status.status || 'NULL'}: ${status._count} documents`);
    }
    
    // Get the most recent document
    const mostRecent = await prisma.userDocument.findFirst({
      orderBy: { uploadedAt: 'desc' },
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    });
    
    if (mostRecent) {
      console.log('\n🆕 Most recent document:');
      console.log(`  ID: ${mostRecent.id}`);
      console.log(`  User: ${mostRecent.user.email}`);
      console.log(`  Type: ${mostRecent.type}`);
      console.log(`  File: ${mostRecent.originalName}`);
      console.log(`  Uploaded: ${mostRecent.uploadedAt.toISOString()}`);
      console.log(`  Status: ${mostRecent.status}`);
      console.log(`  Path: ${mostRecent.url}`);
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDocumentSave();