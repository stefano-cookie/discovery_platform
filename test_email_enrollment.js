// Test script to verify enrollment email template

const emailService = require('./backend/dist/services/emailService').default;

async function testEnrollmentEmail() {
  console.log('📧 Testing enrollment confirmation email...\n');
  
  // Test data
  const testData = {
    nome: 'Mario',
    cognome: 'Rossi',
    email: 'test@example.com',
    registrationId: 'test-reg-123456',
    courseName: 'TFA Sostegno IX Ciclo - Romania',  // This will be the template.name
    offerType: 'TFA_ROMANIA',
    partnerName: 'Giovanni Bianchi'
  };
  
  console.log('Email data:');
  console.log('- Recipient:', testData.email);
  console.log('- Course Name (template.name):', testData.courseName);
  console.log('- User:', `${testData.nome} ${testData.cognome}`);
  console.log('- Partner:', testData.partnerName);
  console.log('- Registration ID:', testData.registrationId);
  console.log();
  
  try {
    // Test email connection first
    const isConnected = await emailService.testConnection();
    if (!isConnected) {
      console.log('⚠️  Email service not configured properly');
      console.log('Using Ethereal email for testing (check console for preview URL)');
    }
    
    // Send test email
    await emailService.sendEnrollmentConfirmation(testData.email, testData);
    
    console.log('✅ Email sent successfully!');
    console.log('\nThe email will display:');
    console.log(`- Course name: "${testData.courseName}"`);
    console.log(`- User will see they enrolled in: "${testData.courseName}"`);
    
    // In development, show preview URL if using Ethereal
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n💡 If using Ethereal email, check the console output above for the preview URL');
    }
    
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
  }
}

// Run test
testEnrollmentEmail();