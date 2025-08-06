const fetch = require('node-fetch');

async function testPartnerDocumentsDirect() {
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
    
    // Known registration ID from database
    const registrationId = '00991c9e-81f1-4d25-b8d4-5cafb786e66d';
    
    // Get documents for registration (unified endpoint)
    console.log(`\n📑 Getting documents for registration ${registrationId}...`);
    const docsRes = await fetch(`http://localhost:3001/api/partners/registrations/${registrationId}/documents/unified`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!docsRes.ok) {
      console.error('Response status:', docsRes.status);
      const text = await docsRes.text();
      console.error('Response:', text);
      return;
    }
    
    const docsData = await docsRes.json();
    console.log('Documents response:', JSON.stringify(docsData, null, 2));
    
    if (docsData.documents && docsData.documents.length > 0) {
      console.log('\n📄 Documents found:');
      docsData.documents.forEach(doc => {
        console.log(`\n  Document Type: ${doc.type}`);
        console.log(`    Name: ${doc.name || 'N/A'}`);
        console.log(`    Uploaded: ${doc.uploaded ? 'Yes' : 'No'}`);
        console.log(`    Status: ${doc.status || 'N/A'}`);
        console.log(`    Document ID: ${doc.documentId || 'N/A'}`);
        console.log(`    File Name: ${doc.fileName || 'N/A'}`);
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
        
        if (!approveRes.ok) {
          console.error('Approval failed:', approveRes.status);
          const errorText = await approveRes.text();
          console.error('Error:', errorText);
        } else {
          const approveData = await approveRes.json();
          console.log('Approval response:', approveData);
          
          // Check if email was sent
          if (approveData.emailSent) {
            console.log('✉️ Email notification sent to user');
          }
        }
      } else {
        console.log('\n⚠️ No pending documents to approve');
      }
    } else {
      console.log('No documents found for this registration');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testPartnerDocumentsDirect();