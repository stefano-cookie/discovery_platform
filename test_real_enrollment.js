// Test real enrollment with actual file upload
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function testRealEnrollment() {
  console.log('🧪 Testing real enrollment with actual document upload...\n');
  
  // Step 1: Create a real test PDF file
  console.log('📄 Step 1: Creating test PDF file...');
  const testPdfPath = path.join(__dirname, 'test_identity_card.pdf');
  const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\n0000000000 65535 f\n0000000010 00000 n\ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n50\n%%EOF');
  fs.writeFileSync(testPdfPath, pdfContent);
  console.log('✅ Test PDF created:', testPdfPath);
  
  // Step 2: Upload document to temp storage
  console.log('\n📤 Step 2: Uploading document to temp storage...');
  
  // Use curl to upload the file
  const uploadCommand = `curl -s -X POST http://localhost:3001/api/document-upload/temp \
    -F "document=@${testPdfPath}" \
    -F "type=cartaIdentita" \
    -F "tempUserId=test_${Date.now()}"`;
  
  const uploadResult = await new Promise((resolve) => {
    exec(uploadCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Upload failed:', error);
        resolve(null);
        return;
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        console.error('❌ Failed to parse upload response:', stdout);
        resolve(null);
      }
    });
  });
  
  if (!uploadResult || !uploadResult.success) {
    console.error('❌ Document upload failed');
    fs.unlinkSync(testPdfPath);
    return;
  }
  
  console.log('✅ Document uploaded successfully');
  console.log('   File name:', uploadResult.document.fileName);
  console.log('   File path:', uploadResult.document.filePath);
  
  // Step 3: Register a new user
  console.log('\n👤 Step 3: Registering new user...');
  
  const timestamp = Date.now();
  const userData = {
    email: `testreal${timestamp}@example.com`,
    password: "Test123!",
    confirmPassword: "Test123!",
    cognome: "Test",
    nome: "Real",
    dataNascita: "1990-01-01",
    luogoNascita: "Roma",
    provinciaNascita: "RM",
    sesso: "M",
    codiceFiscale: `REA${timestamp.toString().slice(-13)}X`,
    telefono: "3331234567",
    residenzaVia: "Via Test 1",
    residenzaCitta: "Roma",
    residenzaProvincia: "RM",
    residenzaCap: "00100",
    referralCode: "MAIN001"
  };
  
  const registerResponse = await fetch('http://localhost:3001/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });
  
  if (!registerResponse.ok) {
    const error = await registerResponse.text();
    console.error('❌ Registration failed:', error);
    fs.unlinkSync(testPdfPath);
    return;
  }
  
  const registerResult = await registerResponse.json();
  console.log('✅ User registered successfully:', userData.email);
  
  // Get the actual user ID from database
  const getUserIdCommand = `cd backend && PGPASSWORD=password psql -h localhost -p 5432 -U postgres -d discovery_db -t -c "SELECT id FROM \\"User\\" WHERE email = '${userData.email}' LIMIT 1"`;
  
  const userId = await new Promise((resolve) => {
    exec(getUserIdCommand, (error, stdout) => {
      if (error || !stdout) {
        resolve(null);
      } else {
        resolve(stdout.trim());
      }
    });
  });
  
  console.log('   User ID:', userId);
  
  // Step 4: Mark user as verified
  console.log('\n✉️ Step 4: Marking user as verified...');
  
  await new Promise((resolve) => {
    exec(`cd backend && PGPASSWORD=password psql -h localhost -p 5432 -U postgres -d discovery_db -c "UPDATE \\"User\\" SET \\"emailVerified\\" = true WHERE email = '${userData.email}'"`, (error) => {
      if (!error) {
        console.log('✅ User marked as verified');
      }
      resolve();
    });
  });
  
  // Step 5: Submit enrollment with the uploaded document
  console.log('\n📝 Step 5: Submitting enrollment with document...');
  
  const enrollmentData = {
    // User data
    ...userData,
    
    // Course data
    courseId: "tfa-romania-2024",
    paymentPlan: "standard",
    partnerOfferId: null,
    
    // Education data for TFA
    tipoLaurea: "Magistrale",
    laureaConseguita: "Ingegneria Informatica",
    laureaUniversita: "Sapienza",
    laureaData: "2020-07-15",
    tipoProfessione: "Docente",
    
    // Include the uploaded document with correct path
    tempDocuments: [
      {
        fileName: uploadResult.document.fileName,
        originalFileName: uploadResult.document.originalFileName || "test_identity_card.pdf",
        url: uploadResult.document.filePath,
        filePath: uploadResult.document.filePath,
        type: "cartaIdentita",
        fileSize: uploadResult.document.fileSize,
        mimeType: uploadResult.document.mimeType || "application/pdf"
      }
    ],
    
    // Mark as verified user
    verifiedEmail: userData.email
  };
  
  console.log('📄 Sending enrollment with real document:', enrollmentData.tempDocuments[0].fileName);
  
  const enrollmentResponse = await fetch('http://localhost:3001/api/enrollment/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(enrollmentData)
  });
  
  if (!enrollmentResponse.ok) {
    const error = await enrollmentResponse.text();
    console.error('❌ Enrollment failed:', error);
    fs.unlinkSync(testPdfPath);
    return;
  }
  
  const enrollmentResult = await enrollmentResponse.json();
  console.log('✅ Enrollment completed successfully!');
  console.log('   Registration ID:', enrollmentResult.registrationId);
  console.log('   Documents saved:', enrollmentResult.documents);
  
  // Step 6: Verify documents in database
  console.log('\n🔍 Step 6: Verifying documents in database...');
  
  const verifyQuery = `SELECT id, type, \\"originalName\\", status, \\"registrationId\\" FROM \\"UserDocument\\" WHERE \\"registrationId\\" = '${enrollmentResult.registrationId}'`;
  
  exec(`cd backend && PGPASSWORD=password psql -h localhost -p 5432 -U postgres -d discovery_db -c "${verifyQuery}"`, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Database query failed:', error);
    } else {
      console.log('\n📊 Documents in database:');
      console.log(stdout);
      
      if (stdout.includes('IDENTITY_CARD') || stdout.includes('(1 row)')) {
        console.log('\n✅✅✅ SUCCESS: Document was saved to UserDocument table! ✅✅✅');
        console.log('The document enrollment system is working correctly!');
      } else if (stdout.includes('(0 rows)')) {
        console.log('\n❌ FAILURE: No documents found in UserDocument table');
        console.log('Check the enrollment processing logic');
      }
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    
    // Delete test user
    exec(`cd backend && PGPASSWORD=password psql -h localhost -p 5432 -U postgres -d discovery_db -c "DELETE FROM \\"User\\" WHERE email = '${userData.email}'"`, () => {
      console.log('✅ Test user deleted');
    });
    
    // Delete test file
    if (fs.existsSync(testPdfPath)) {
      fs.unlinkSync(testPdfPath);
      console.log('✅ Test file deleted');
    }
  });
}

// Run the test
testRealEnrollment();