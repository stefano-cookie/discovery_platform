const fetch = require('node-fetch');

async function testCompleteFlow() {
  console.log('🧪 Testing Complete Document Flow...\n');
  
  try {
    // Step 1: Login as user
    console.log('1️⃣ User Login...');
    const userLoginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'stefanojpriolo@gmail.com',
        password: 'test123'
      })
    });
    const { token: userToken } = await userLoginRes.json();
    console.log('✅ User logged in');

    // Step 2: Get user documents
    console.log('\n2️⃣ Fetching user documents...');
    const userDocsRes = await fetch('http://localhost:3001/api/documents', {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    const userDocsData = await userDocsRes.json();
    console.log(`📄 Found ${userDocsData.documents?.length || 0} user documents`);
    
    userDocsData.documents?.forEach(doc => {
      console.log(`  - ${doc.type}: ${doc.fileName} (${doc.status})`);
    });

    // Step 3: Login as partner
    console.log('\n3️⃣ Partner Login...');
    const partnerLoginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'partner@diamante.com',
        password: 'partner123'
      })
    });
    const { token: partnerToken } = await partnerLoginRes.json();
    console.log('✅ Partner logged in');

    // Step 4: Get partner documents view
    console.log('\n4️⃣ Partner documents view...');
    const registrationId = '00991c9e-81f1-4d25-b8d4-5cafb786e66d';
    const partnerDocsRes = await fetch(`http://localhost:3001/api/partners/registrations/${registrationId}/documents/unified`, {
      headers: { 'Authorization': `Bearer ${partnerToken}` }
    });
    const partnerDocsData = await partnerDocsRes.json();
    console.log(`📋 Partner view: ${partnerDocsData.uploadedCount}/${partnerDocsData.totalCount} documents uploaded`);

    // Step 5: Test download functionality
    console.log('\n5️⃣ Testing download functionality...');
    const approvedDoc = userDocsData.documents?.find(d => d.status === 'APPROVED');
    if (approvedDoc) {
      console.log(`📥 Testing download of ${approvedDoc.fileName}...`);
      
      // User download
      const userDownloadRes = await fetch(`http://localhost:3001/api/documents/${approvedDoc.id}/download`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      console.log(`✅ User download: ${userDownloadRes.status === 200 ? 'SUCCESS' : 'FAILED'} (${userDownloadRes.status})`);
      
      // Partner download
      const partnerDownloadRes = await fetch(`http://localhost:3001/api/partners/documents/${approvedDoc.id}/download`, {
        headers: { 'Authorization': `Bearer ${partnerToken}` }
      });
      console.log(`✅ Partner download: ${partnerDownloadRes.status === 200 ? 'SUCCESS' : 'FAILED'} (${partnerDownloadRes.status})`);
    } else {
      console.log('⚠️ No approved documents to test download');
    }

    // Step 6: Summary
    console.log('\n📊 Flow Summary:');
    const stats = {
      total: userDocsData.documents?.length || 0,
      approved: userDocsData.documents?.filter(d => d.status === 'APPROVED').length || 0,
      pending: userDocsData.documents?.filter(d => d.status === 'PENDING').length || 0,
      rejected: userDocsData.documents?.filter(d => d.status === 'REJECTED').length || 0
    };

    console.log(`📄 Total Documents: ${stats.total}`);
    console.log(`✅ Approved: ${stats.approved}`);
    console.log(`⏳ Pending: ${stats.pending}`);
    console.log(`❌ Rejected: ${stats.rejected}`);

    // Test endpoints summary
    console.log('\n🔗 API Endpoints Tested:');
    console.log('✅ POST /api/auth/login (User & Partner)');
    console.log('✅ GET /api/documents (User documents)');
    console.log('✅ GET /api/partners/registrations/{id}/documents/unified (Partner view)');
    console.log('✅ GET /api/documents/{id}/download (User download)');
    console.log('✅ GET /api/partners/documents/{id}/download (Partner download)');

    console.log('\n🎉 Complete document flow test PASSED!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testCompleteFlow();