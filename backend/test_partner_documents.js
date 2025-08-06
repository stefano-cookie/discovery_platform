const fetch = require('node-fetch');

async function testPartnerDocuments() {
  try {
    // Login as partner
    console.log('🔐 Logging in as partner...');
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'partner@diamante.com',
        password: 'partner123'
      })
    });
    
    const loginData = await loginRes.json();
    
    if (!loginData.token) {
      console.error('❌ Partner login failed:', loginData);
      return;
    }
    
    console.log('✅ Partner login successful');
    const token = loginData.token;
    
    // Get partner users
    console.log('\n📋 Getting partner users...');
    const usersRes = await fetch('http://localhost:3001/api/partners/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const usersData = await usersRes.json();
    console.log('Total users:', usersData.users?.length || 0);
    
    if (usersData.users && usersData.users.length > 0) {
      const user = usersData.users[0];
      const registration = user.registrations?.[0] || { id: user.registrationId };
      console.log('First user:', {
        email: user.email,
        registrationId: registration.id || user.registrationId,
        status: user.status
      });
      
      // Get documents for registration (unified endpoint)
      console.log(`\n📑 Getting documents for registration...`);
      const docsRes = await fetch(`http://localhost:3001/api/partners/registrations/${registration.id}/documents/unified`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const docsData = await docsRes.json();
      console.log('Documents response:', docsData);
      
      if (docsData.documents && docsData.documents.length > 0) {
        console.log('\n📄 Documents found:');
        docsData.documents.forEach(doc => {
          console.log(`  - ${doc.type}: ${doc.name || 'N/A'}`);
          console.log(`    Uploaded: ${doc.uploaded ? 'Yes' : 'No'}`);
          console.log(`    Status: ${doc.status || 'N/A'}`);
          console.log(`    Document ID: ${doc.documentId || 'N/A'}`);
        });
        
        // Find a pending document to approve
        const pendingDoc = docsData.documents.find(d => d.uploaded && d.status === 'PENDING' && d.documentId);
        
        if (pendingDoc) {
          console.log(`\n✅ Approving document: ${pendingDoc.type} (${pendingDoc.documentId})`);
          
          const approveRes = await fetch(`http://localhost:3001/api/partners/documents/${pendingDoc.documentId}/approve`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notes: 'Documento conforme' })
          });
          
          const approveData = await approveRes.json();
          console.log('Approval response:', approveData);
        } else {
          console.log('\n⚠️ No pending documents to approve');
        }
      } else {
        console.log('No documents found for this registration');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testPartnerDocuments();