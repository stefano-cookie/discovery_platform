const fetch = require('node-fetch');

async function testDocumentsAPI() {
  try {
    // First login to get token
    console.log('🔐 Logging in...');
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'stefanojpriolo@gmail.com',
        password: 'test123'
      })
    });
    
    const loginData = await loginRes.json();
    
    if (!loginData.token) {
      console.error('❌ Login failed:', loginData);
      return;
    }
    
    console.log('✅ Login successful');
    const token = loginData.token;
    
    // Get user info
    console.log('\n👤 Getting user info...');
    const userRes = await fetch('http://localhost:3001/api/user/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const userData = await userRes.json();
    console.log('User:', userData.email, 'ID:', userData.id);
    
    // Get all user documents
    console.log('\n📄 Getting all user documents...');
    const docsRes = await fetch('http://localhost:3001/api/documents', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const docsData = await docsRes.json();
    console.log('Total documents:', docsData.documents?.length || 0);
    
    if (docsData.documents && docsData.documents.length > 0) {
      docsData.documents.forEach(doc => {
        console.log(`  - ${doc.type}: ${doc.fileName} (${doc.status})`);
      });
    }
    
    // Get user registrations
    console.log('\n📋 Getting user registrations...');
    const regsRes = await fetch('http://localhost:3001/api/user/registrations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const regsData = await regsRes.json();
    console.log('Total registrations:', regsData.registrations?.length || 0);
    
    if (regsData.registrations && regsData.registrations.length > 0) {
      const registration = regsData.registrations[0];
      console.log('Registration ID:', registration.id);
      
      // Get documents for specific registration
      console.log(`\n📑 Getting documents for registration ${registration.id}...`);
      const regDocsRes = await fetch(`http://localhost:3001/api/documents/registration/${registration.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const regDocsData = await regDocsRes.json();
      console.log('Documents for registration:', regDocsData.documents?.length || 0);
      
      if (regDocsData.documents && regDocsData.documents.length > 0) {
        regDocsData.documents.forEach(doc => {
          console.log(`  - ${doc.type}: ${doc.fileName} (${doc.status}) - Source: ${doc.uploadSource}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDocumentsAPI();