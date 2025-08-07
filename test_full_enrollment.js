// Test complete enrollment with documents
const fs = require('fs');
const path = require('path');

async function testFullEnrollment() {
  console.log('🧪 Testing complete enrollment flow with documents...\n');
  
  // Step 1: Register a new user
  console.log('👤 Step 1: Registering new user...');
  
  const timestamp = Date.now();
  const userData = {
    email: `testdoc${timestamp}@example.com`,
    password: "Test123!",
    confirmPassword: "Test123!",
    cognome: "Test",
    nome: "Doc",
    dataNascita: "1990-01-01",
    luogoNascita: "Roma",
    provinciaNascita: "RM",
    sesso: "M",
    codiceFiscale: `TST${timestamp.toString().slice(-13)}X`,
    telefono: "3331234567",
    residenzaVia: "Via Test 1",
    residenzaCitta: "Roma",
    residenzaProvincia: "RM",
    residenzaCap: "00100",
    referralCode: "MAIN001"
  };
  
  try {
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
      return;
    }
    
    const registerResult = await registerResponse.json();
    console.log('✅ User registered successfully:', userData.email);
    const userId = registerResult.user?.id || registerResult.userId || null;
    if (userId) {
      console.log('   User ID:', userId);
    }
    
    // Step 2: Mark user as verified (bypass email verification for test)
    console.log('\n✉️ Step 2: Marking user as verified...');
    
    const { exec } = require('child_process');
    await new Promise((resolve) => {
      exec(`cd backend && PGPASSWORD=password psql -h localhost -p 5432 -U postgres -d discovery_db -c "UPDATE \\"User\\" SET \\"emailVerified\\" = true WHERE email = '${userData.email}'"`, (error) => {
        if (!error) {
          console.log('✅ User marked as verified');
        }
        resolve();
      });
    });
    
    // Step 3: Submit enrollment with documents
    console.log('\n📝 Step 3: Submitting enrollment with documents...');
    
    // Simulate temporary documents that would be uploaded during form
    const tempDocuments = [
      {
        fileName: "test_carta_identita.pdf",
        originalFileName: "carta_identita.pdf",
        url: "/uploads/temp-enrollment/test_carta_identita.pdf",
        filePath: "/uploads/temp-enrollment/test_carta_identita.pdf",
        type: "cartaIdentita",
        fileSize: 1024,
        mimeType: "application/pdf"
      },
      {
        fileName: "test_diploma.pdf",
        originalFileName: "diploma.pdf", 
        url: "/uploads/temp-enrollment/test_diploma.pdf",
        filePath: "/uploads/temp-enrollment/test_diploma.pdf",
        type: "diplomaMaturita",
        fileSize: 2048,
        mimeType: "application/pdf"
      }
    ];
    
    const enrollmentData = {
      // All user data is already in profile
      courseId: "tfa-romania-2024", // Use a valid course ID
      paymentPlan: "standard",
      partnerOfferId: null,
      
      // Education data for TFA
      tipoLaurea: "Magistrale",
      laureaConseguita: "Ingegneria Informatica",
      laureaUniversita: "Sapienza",
      laureaData: "2020-07-15",
      tipoProfessione: "Docente",
      
      // Include temporary documents
      tempDocuments: tempDocuments
    };
    
    console.log(`📄 Sending enrollment with ${tempDocuments.length} documents`);
    
    // Use verified-user-enrollment endpoint since we bypassed login
    const enrollmentResponse = await fetch('http://localhost:3001/api/enrollment/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...enrollmentData,
        ...userData, // Include all user data
        verifiedEmail: userData.email // Mark as verified user
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
    
    // Step 4: Check database for documents
    console.log('\n🔍 Step 4: Verifying documents in database...');
    const query = `SELECT id, type, "originalName", status, "registrationId" FROM "UserDocument" WHERE "userId" = '${userId}'`;
    
    exec(`cd backend && PGPASSWORD=password psql -h localhost -p 5432 -U postgres -d discovery_db -c "${query}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Database query failed:', error);
        return;
      }
      
      console.log('📊 Documents in database:');
      console.log(stdout);
      
      if (stdout.includes('IDENTITY_CARD') || stdout.includes('DIPLOMA')) {
        console.log('\n✅ SUCCESS: Documents were saved to UserDocument table!');
      } else if (stdout.includes('(0 rows)')) {
        console.log('\n❌ FAILURE: No documents found in UserDocument table');
        console.log('   This indicates the document processing is not working correctly');
      }
      
      // Cleanup: Delete test user
      console.log('\n🧹 Cleaning up test data...');
      const deleteQuery = `DELETE FROM "User" WHERE email = '${userData.email}'`;
      exec(`cd backend && PGPASSWORD=password psql -h localhost -p 5432 -U postgres -d discovery_db -c "${deleteQuery}"`, (err) => {
        if (!err) {
          console.log('✅ Test user deleted');
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testFullEnrollment();