const fetch = require('node-fetch');
const fs = require('fs');

async function testDownload() {
  try {
    // Login to get token
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'stefanojpriolo@gmail.com',
        password: 'test123'
      })
    });
    
    const { token } = await loginRes.json();
    console.log('✅ Login successful');
    
    // Test download
    const documentId = 'caf7c7a7-a889-4b33-9ea2-899b400d637b'; // Identity card
    console.log(`📥 Testing download of document ${documentId}...`);
    
    const downloadRes = await fetch(`http://localhost:3001/api/documents/${documentId}/download`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Download response status:', downloadRes.status);
    console.log('Download response headers:', Object.fromEntries(downloadRes.headers));
    
    if (downloadRes.ok) {
      const buffer = await downloadRes.buffer();
      console.log(`✅ Downloaded ${buffer.length} bytes`);
      
      // Save to test file
      fs.writeFileSync('test_download.pdf', buffer);
      console.log('💾 Saved as test_download.pdf');
    } else {
      const error = await downloadRes.text();
      console.error('❌ Download failed:', error);
    }
    
    // Test partner download
    console.log('\n🏢 Testing partner download...');
    const partnerLoginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'partner@diamante.com',
        password: 'partner123'
      })
    });
    
    const { token: partnerToken } = await partnerLoginRes.json();
    
    const partnerDownloadRes = await fetch(`http://localhost:3001/api/partners/documents/${documentId}/download`, {
      headers: { 'Authorization': `Bearer ${partnerToken}` }
    });
    
    console.log('Partner download status:', partnerDownloadRes.status);
    
    if (partnerDownloadRes.ok) {
      const buffer = await partnerDownloadRes.buffer();
      console.log(`✅ Partner downloaded ${buffer.length} bytes`);
    } else {
      const error = await partnerDownloadRes.text();
      console.error('❌ Partner download failed:', error);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDownload();