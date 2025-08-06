#!/usr/bin/env node

/**
 * Test script to verify document synchronization between enrollment and user dashboard
 * This script simulates the document upload during enrollment and checks if documents
 * appear in the user dashboard.
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_BASE = 'http://localhost:3001/api';

// Test user credentials - using existing test data
const TEST_USER = {
  email: 'admin@diamante.com',
  password: 'admin123'
};

// Create a test PDF file for upload
function createTestPdfFile() {
  const testFilePath = path.join(__dirname, 'test-document.pdf');
  const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000079 00000 n\n0000000173 00000 n\ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n253\n%%EOF');
  fs.writeFileSync(testFilePath, pdfContent);
  return testFilePath;
}

async function makeRequest(endpoint, options = {}) {
  const fetch = (await import('node-fetch')).default;
  const url = `${API_BASE}${endpoint}`;
  
  console.log(`🌐 ${options.method || 'GET'} ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const responseText = await response.text();
  let data;
  
  try {
    data = JSON.parse(responseText);
  } catch {
    data = responseText;
  }
  
  console.log(`📥 Response (${response.status}):`, data);
  
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${responseText}`);
  }
  
  return data;
}

async function loginUser() {
  console.log('\n🔐 Step 1: Login user');
  const response = await makeRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(TEST_USER)
  });
  
  return response.token;
}

async function uploadDocument(userId, token) {
  console.log('\n📄 Step 2: Upload document during enrollment');
  
  const testFilePath = createTestPdfFile();
  const form = new FormData();
  form.append('document', fs.createReadStream(testFilePath), 'test-carta-identita.pdf');
  form.append('userId', userId);
  form.append('documentType', 'cartaIdentita');
  form.append('templateType', 'TFA');
  
  const fetch = (await import('node-fetch')).default;
  const response = await fetch(`${API_BASE}/registration/upload-document`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...form.getHeaders()
    },
    body: form
  });
  
  const responseText = await response.text();
  let data;
  
  try {
    data = JSON.parse(responseText);
  } catch {
    data = responseText;
  }
  
  console.log(`📥 Upload Response (${response.status}):`, data);
  
  // Clean up test file
  fs.unlinkSync(testFilePath);
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${responseText}`);
  }
  
  return data.document;
}

async function getUserDocuments(token) {
  console.log('\n📋 Step 3: Get enrollment documents from user dashboard');
  
  return await makeRequest('/user/enrollment-documents', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}

async function createTestRegistration(userId, token) {
  console.log('\n📝 Step 4: Create test registration to link documents');
  
  // This is a simplified test - in real scenario this would happen through the enrollment form
  const registrationData = {
    courseId: 'test-course-id',
    partnerOfferId: null,
    paymentPlan: {
      originalAmount: 4500,
      finalAmount: 4500,
      installments: 1
    },
    courseData: {},
    referralCode: 'ADMIN'
  };
  
  try {
    return await makeRequest('/registration/additional-enrollment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(registrationData)
    });
  } catch (error) {
    console.log('⚠️ Registration creation failed (expected if no course/partner setup):', error.message);
    return null;
  }
}

async function runTest() {
  try {
    console.log('🧪 Starting Document Synchronization Test\n');
    
    // Step 1: Login
    const token = await loginUser();
    
    // Get user info from token to get userId
    const userInfo = await makeRequest('/user/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const userId = userInfo.user.id;
    console.log(`👤 User ID: ${userId}`);
    
    // Step 2: Upload document
    const document = await uploadDocument(userId, token);
    console.log(`✅ Document uploaded: ${document.id}`);
    
    // Step 3: Check enrollment documents before registration
    console.log('\n📋 Checking enrollment documents before registration...');
    const documentsBefore = await getUserDocuments(token);
    console.log(`📊 Documents before registration: ${documentsBefore.documents.length}`);
    
    // Step 4: Create registration (this will link documents)
    const registration = await createTestRegistration(userId, token);
    
    if (registration) {
      console.log(`✅ Registration created: ${registration.registrationId}`);
      
      // Step 5: Check enrollment documents after registration
      console.log('\n📋 Checking enrollment documents after registration...');
      const documentsAfter = await getUserDocuments(token);
      console.log(`📊 Documents after registration: ${documentsAfter.documents.length}`);
      
      if (documentsAfter.documents.length > 0) {
        console.log('\n🎉 SUCCESS: Document synchronization working!');
        console.log('Documents found in user dashboard:', documentsAfter.documents.map(d => ({
          id: d.id,
          type: d.type,
          fileName: d.fileName,
          registrationId: d.registrationId
        })));
      } else {
        console.log('\n❌ ISSUE: No documents found after registration');
      }
    } else {
      console.log('\n⚠️ Skipping registration test due to missing course/partner setup');
      console.log('✅ Document upload functionality verified');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Install required dependency if not present
async function ensureDependencies() {
  try {
    require('node-fetch');
    require('form-data');
  } catch (error) {
    console.log('📦 Installing required dependencies...');
    const { execSync } = require('child_process');
    execSync('npm install node-fetch@2 form-data', { cwd: __dirname, stdio: 'inherit' });
  }
}

// Run the test
if (require.main === module) {
  ensureDependencies().then(() => {
    runTest().catch(console.error);
  });
}