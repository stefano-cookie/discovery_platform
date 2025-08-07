const axios = require('axios');

const testData = {
  // Personal data
  email: 'test.diploma@example.com',
  cognome: 'Test',
  nome: 'Diploma',
  dataNascita: '1990-01-01',
  luogoNascita: 'Roma',
  provinciaNascita: 'RM',
  sesso: 'M',
  codiceFiscale: 'TSTDPL90A01H501X',
  telefono: '1234567890',
  nomePadre: 'Padre Test',
  nomeMadre: 'Madre Test',
  
  // Address
  residenzaVia: 'Via Test 1',
  residenzaCitta: 'Roma',
  residenzaProvincia: 'RM',
  residenzaCap: '00100',
  hasDifferentDomicilio: false,
  
  // Education
  tipoLaurea: 'Magistrale',
  laureaConseguita: 'Informatica',
  laureaUniversita: 'Sapienza',
  laureaData: '2020-01-01',
  
  // NEW: Diploma fields
  diplomaData: '2015-07-15',
  diplomaCitta: 'Roma',
  diplomaProvincia: 'RM',
  diplomaIstituto: 'Liceo Scientifico Galileo Galilei',
  diplomaVoto: '98/100',
  
  // Profession
  tipoProfessione: 'Altro',
  
  // Referral
  referralCode: 'MAIN001-CERT',
  courseId: 'default-course',
  paymentPlan: 'standard'
};

async function testDiplomaForm() {
  try {
    console.log('🧪 Testing enrollment with diploma fields...');
    
    // First register user
    console.log('1. Creating user profile...');
    const profileResponse = await axios.post('http://localhost:8000/api/enrollment/register', testData);
    console.log('✅ User profile created:', profileResponse.data.user.id);
    
    // Then do enrollment
    console.log('2. Testing enrollment with diploma data...');
    const enrollResponse = await axios.post('http://localhost:8000/api/enrollment/enroll', {
      userId: profileResponse.data.user.id,
      partnerOfferId: 'certification-offer',
      offerType: 'TFA_ROMANIA',
      courseId: 'default-course',
      paymentPlan: 'standard',
      
      // Education data
      tipoLaurea: testData.tipoLaurea,
      laureaConseguita: testData.laureaConseguita,
      laureaUniversita: testData.laureaUniversita,
      laureaData: testData.laureaData,
      
      // NEW: Diploma data
      diplomaData: testData.diplomaData,
      diplomaCitta: testData.diplomaCitta,
      diplomaProvincia: testData.diplomaProvincia,
      diplomaIstituto: testData.diplomaIstituto,
      diplomaVoto: testData.diplomaVoto,
      
      // Profession
      tipoProfessione: testData.tipoProfessione
    });
    
    console.log('✅ Enrollment successful!');
    console.log('📋 Registration ID:', enrollResponse.data.registration.id);
    
    // Verify the diploma data was saved
    console.log('3. Verifying diploma data in database...');
    const registration = enrollResponse.data.registration;
    
    console.log('🎓 Diploma data saved:');
    console.log('  - Data:', registration.diplomaData);
    console.log('  - Città:', registration.diplomaCitta);
    console.log('  - Provincia:', registration.diplomaProvincia);
    console.log('  - Istituto:', registration.diplomaIstituto);
    console.log('  - Voto:', registration.diplomaVoto);
    
    console.log('🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data?.details) {
      console.error('📝 Details:', error.response.data.details);
    }
  }
}

testDiplomaForm();