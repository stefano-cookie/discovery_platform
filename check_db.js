const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUserDocuments() {
  try {
    const documents = await prisma.userDocument.findMany({
      where: {
        userId: '7d97da48-8e33-449d-89b7-5ca74ad2a186'
      },
      orderBy: { uploadedAt: 'desc' },
      take: 5
    });
    
    console.log('📄 UserDocuments in database:');
    console.log(documents.map(doc => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.fileName,
      originalFileName: doc.originalFileName,
      status: doc.status,
      registrationId: doc.registrationId,
      uploadedAt: doc.uploadedAt
    })));
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

checkUserDocuments();