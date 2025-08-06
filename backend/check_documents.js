const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDocuments() {
  try {
    // Check UserDocument table
    const userDocs = await prisma.userDocument.findMany({
      include: {
        user: true,
        registration: true
      }
    });
    
    console.log('=== UserDocument Table ===');
    console.log('Total UserDocuments:', userDocs.length);
    userDocs.forEach(doc => {
      console.log({
        id: doc.id,
        userId: doc.userId,
        userEmail: doc.user.email,
        registrationId: doc.registrationId,
        type: doc.type,
        uploadSource: doc.uploadSource,
        status: doc.status,
        uploadedAt: doc.uploadedAt
      });
    });
    
    // Check legacy Document table
    const legacyDocs = await prisma.document.findMany({
      include: {
        registration: {
          include: {
            user: true
          }
        }
      }
    });
    
    console.log('\n=== Legacy Document Table ===');
    console.log('Total Legacy Documents:', legacyDocs.length);
    legacyDocs.forEach(doc => {
      console.log({
        id: doc.id,
        registrationId: doc.registrationId,
        userEmail: doc.registration?.user.email,
        fileName: doc.fileName,
        filePath: doc.filePath,
        uploadedAt: doc.uploadedAt
      });
    });
    
    // Check registrations
    const registrations = await prisma.registration.findMany({
      include: {
        user: true,
        documents: true,
        userDocuments: true
      }
    });
    
    console.log('\n=== Registrations with Documents ===');
    registrations.forEach(reg => {
      console.log({
        registrationId: reg.id,
        userEmail: reg.user.email,
        legacyDocuments: reg.documents.length,
        userDocuments: reg.userDocuments.length,
        status: reg.status
      });
    });
    
    // Check specific user
    const specificUser = await prisma.user.findUnique({
      where: { email: 'stefanojpriolo@gmail.com' },
      include: {
        registrations: {
          include: {
            documents: true,
            userDocuments: true
          }
        },
        documents: true
      }
    });
    
    if (specificUser) {
      console.log('\n=== Specific User: stefanojpriolo@gmail.com ===');
      console.log('User ID:', specificUser.id);
      console.log('Total UserDocuments:', specificUser.documents.length);
      console.log('Registrations:', specificUser.registrations.length);
      
      specificUser.registrations.forEach((reg, idx) => {
        console.log(`\nRegistration ${idx + 1}:`, {
          id: reg.id,
          status: reg.status,
          legacyDocuments: reg.documents.length,
          userDocuments: reg.userDocuments.length
        });
        
        if (reg.documents.length > 0) {
          console.log('Legacy Documents:', reg.documents.map(d => ({
            fileName: d.fileName,
            filePath: d.filePath
          })));
        }
        
        if (reg.userDocuments.length > 0) {
          console.log('User Documents:', reg.userDocuments.map(d => ({
            type: d.type,
            status: d.status,
            uploadSource: d.uploadSource
          })));
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDocuments();