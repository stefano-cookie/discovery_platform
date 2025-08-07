// Test script to verify document enrollment
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

async function testDocumentUpload() {
  console.log('🧪 Testing document upload during enrollment...\n');
  
  // Step 1: Upload a temporary document
  console.log('📤 Step 1: Uploading temporary document...');
  
  // Create a test file
  const testFilePath = path.join(__dirname, 'test_document.pdf');
  const testContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\n0000000000 65535 f\n0000000010 00000 n\ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n50\n%%EOF');
  fs.writeFileSync(testFilePath, testContent);
  
  const formData = new FormData();
  formData.append('document', fs.createReadStream(testFilePath), 'test_document.pdf');
  formData.append('type', 'cartaIdentita');
  formData.append('tempUserId', 'test_user_' + Date.now());
  
  try {
    const uploadResponse = await fetch('http://localhost:3001/api/document-upload/temp', {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error('❌ Upload failed:', error);
      return;
    }
    
    const uploadResult = await uploadResponse.json();
    console.log('✅ Document uploaded successfully:', uploadResult.document.fileName);
    console.log('   Path:', uploadResult.document.filePath);
    
    // Step 2: Simulate enrollment with the uploaded document
    console.log('\n📝 Step 2: Simulating enrollment with document...');
    
    const enrollmentData = {
      // User data
      email: 'test_' + Date.now() + '@example.com',
      nome: 'Test',
      cognome: 'User',
      dataNascita: '1990-01-01',
      luogoNascita: 'Roma',
      codiceFiscale: 'TSTUSR90A01H501X',
      telefono: '1234567890',
      
      // Address
      residenzaVia: 'Via Test 1',
      residenzaCitta: 'Roma', 
      residenzaProvincia: 'RM',
      residenzaCap: '00100',
      
      // Education (minimal for test)
      tipoLaurea: 'Magistrale',
      laureaConseguita: 'Test',
      laureaUniversita: 'Test University',
      laureaData: '2020-01-01',
      
      // Course info
      courseId: 'default-course',
      paymentPlan: 'standard',
      
      // Include the temporary document
      tempDocuments: [
        {
          fileName: uploadResult.document.fileName,
          originalFileName: uploadResult.document.originalFileName || 'test_document.pdf',
          url: uploadResult.document.filePath,
          filePath: uploadResult.document.filePath,
          type: 'cartaIdentita',
          fileSize: uploadResult.document.fileSize || testContent.length,
          mimeType: uploadResult.document.mimeType || 'application/pdf'
        }
      ]
    };
    
    console.log('📄 Sending enrollment with document:', enrollmentData.tempDocuments[0].fileName);
    
    // Use the enrollment endpoint
    const enrollmentResponse = await fetch('http://localhost:3001/api/enrollment/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...enrollmentData,
        verifiedEmail: enrollmentData.email // Simulate verified email
      })
    });
    
    if (!enrollmentResponse.ok) {
      const error = await enrollmentResponse.text();
      console.error('❌ Enrollment failed:', error);
      return;
    }
    
    const enrollmentResult = await enrollmentResponse.json();
    console.log('✅ Enrollment completed successfully!');
    console.log('   Registration ID:', enrollmentResult.registrationId);
    console.log('   Documents saved:', enrollmentResult.documents);
    
    // Step 3: Verify documents in database
    console.log('\n🔍 Step 3: Verifying documents in database...');
    
    // Query database to check if documents were saved
    const { exec } = require('child_process');
    const query = `SELECT id, type, "originalName", status FROM "UserDocument" WHERE "registrationId" = '${enrollmentResult.registrationId}'`;
    
    exec(`cd backend && PGPASSWORD=password psql -h localhost -p 5432 -U postgres -d discovery_db -c "${query}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Database query failed:', error);
        return;
      }
      
      console.log('📊 Documents in database:');
      console.log(stdout);
      
      if (stdout.includes('cartaIdentita') || stdout.includes('IDENTITY_CARD')) {
        console.log('✅ SUCCESS: Document was saved to UserDocument table!');
      } else if (stdout.includes('(0 rows)')) {
        console.log('❌ FAILURE: No documents found in UserDocument table');
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }
}

// Run the test
testDocumentUpload();