const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function testPartnerUpload() {
  console.log('🧪 Testing Partner Upload Functionality...\n');
  
  try {
    // Login as partner
    console.log('1️⃣ Partner Login...');
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'partner@diamante.com',
        password: 'partner123'
      })
    });
    const { token } = await loginRes.json();
    console.log('✅ Partner logged in');

    // Get user ID (stefanojpriolo@gmail.com)
    const userId = '9221f0a5-bc52-4096-b2fb-d363f73d854f';
    const registrationId = '00991c9e-81f1-4d25-b8d4-5cafb786e66d';

    // Create a test file to upload
    console.log('\n2️⃣ Creating test document...');
    const testContent = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000199 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n293\n%%EOF');
    const testFile = 'test_tessera_sanitaria.pdf';
    fs.writeFileSync(testFile, testContent);
    console.log('✅ Test PDF created');

    // Test upload
    console.log('\n3️⃣ Testing partner upload...');
    const formData = new FormData();
    formData.append('document', fs.createReadStream(testFile));
    formData.append('type', 'TESSERA_SANITARIA');
    formData.append('registrationId', registrationId);

    const uploadRes = await fetch(`http://localhost:3001/api/partners/users/${userId}/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    console.log('Upload response status:', uploadRes.status);
    
    if (uploadRes.ok) {
      const uploadData = await uploadRes.json();
      console.log('✅ Upload successful!');
      console.log('Document details:', {
        id: uploadData.document.id,
        type: uploadData.document.type,
        fileName: uploadData.document.fileName,
        status: uploadData.document.status,
        uploadSource: uploadData.document.uploadSource
      });
      
      // Verify document exists
      console.log('\n4️⃣ Verifying document was created...');
      const userLoginRes = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'stefanojpriolo@gmail.com',
          password: 'test123'
        })
      });
      const { token: userToken } = await userLoginRes.json();

      const userDocsRes = await fetch('http://localhost:3001/api/documents', {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      const userDocsData = await userDocsRes.json();
      
      console.log(`📄 User now has ${userDocsData.documents?.length || 0} documents:`);
      userDocsData.documents?.forEach(doc => {
        console.log(`  - ${doc.type}: ${doc.fileName} (${doc.status}) - Source: ${doc.uploadSource || 'N/A'}`);
      });

      // Test partner view
      console.log('\n5️⃣ Testing partner document view...');
      const partnerDocsRes = await fetch(`http://localhost:3001/api/partners/registrations/${registrationId}/documents/unified`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const partnerDocsData = await partnerDocsRes.json();
      console.log(`🏢 Partner view: ${partnerDocsData.uploadedCount}/${partnerDocsData.totalCount} documents uploaded`);

      console.log('\n🎉 Partner upload test SUCCESSFUL!');

    } else {
      const errorText = await uploadRes.text();
      console.error('❌ Upload failed:', errorText);
    }

    // Cleanup
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
      console.log('🧹 Test file cleaned up');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPartnerUpload();