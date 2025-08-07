const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const prisma = new PrismaClient();

async function testEnrollmentDocumentFix() {
  try {
    console.log('🧪 Testing enrollment document processing fix...');
    
    // Get a test user
    const testUser = await prisma.user.findFirst({
      include: { profile: true }
    });
    
    if (!testUser || !testUser.profile) {
      console.log('❌ No test user found with profile. Please create one first.');
      return;
    }
    
    console.log('✅ Using test user:', testUser.email);
    
    // Create a dummy temp document file
    const tempDir = path.join(__dirname, 'backend', 'uploads', 'temp-enrollment');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const dummyContent = 'Test document content';
    const tempFileName = `test_${Date.now()}.txt`;
    const tempFilePath = path.join(tempDir, tempFileName);
    fs.writeFileSync(tempFilePath, dummyContent);
    
    console.log('📄 Created test temp document:', tempFilePath);
    
    // Get a course and partner offer for testing
    const course = await prisma.course.findFirst();
    const partnerOffer = await prisma.partnerOffer.findFirst({
      include: { partner: true }
    });
    
    if (!course || !partnerOffer) {
      console.log('❌ No course or partner offer found for testing');
      return;
    }
    
    console.log('✅ Using course:', course.name, 'and offer:', partnerOffer.name);
    
    // Test the enrollment with temp documents
    const enrollmentData = {
      partnerOfferId: partnerOffer.id,
      offerType: 'TFA_ROMANIA',
      courseId: course.id,
      paymentPlan: 'standard',
      tipoLaurea: 'Magistrale',
      laureaConseguita: 'Test Degree',
      laureaUniversita: 'Test University',
      laureaData: '2020-01-01',
      tipoProfessione: 'Test',
      verifiedEmail: testUser.email,
      documents: [
        {
          fileName: tempFileName,
          originalFileName: 'test_document.txt',
          type: 'cartaIdentita',
          fileSize: dummyContent.length,
          mimeType: 'text/plain'
        }
      ]
    };
    
    console.log('📋 Submitting enrollment with temp document...');
    
    const response = await axios.post('http://localhost:3001/api/enrollment/submit', enrollmentData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Enrollment response:', response.data);
    
    // Check if UserDocument was created
    const userDocuments = await prisma.userDocument.findMany({
      where: { 
        userId: testUser.id,
        registrationId: response.data.registrationId
      }
    });
    
    console.log('📁 UserDocuments created:', userDocuments.length);
    userDocuments.forEach(doc => {
      console.log('  -', doc.type, doc.originalName, doc.status);
    });
    
    if (userDocuments.length > 0) {
      console.log('🎉 SUCCESS! UserDocument table is now being populated during enrollment!');
    } else {
      console.log('❌ FAILED: No UserDocument records were created');
    }
    
    // Cleanup temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log('🧹 Cleaned up temp file');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testEnrollmentDocumentFix();