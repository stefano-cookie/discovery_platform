const { ContractService } = require('./dist/services/contractService');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const contractService = new ContractService();

async function testContractGeneration() {
  try {
    console.log('Starting contract generation test...');
    
    // Get a test registration
    const registration = await prisma.registration.findFirst({
      include: {
        user: {
          include: {
            profile: true
          }
        },
        offer: {
          include: {
            course: true
          }
        },
        payments: true
      }
    });
    
    if (!registration) {
      console.log('❌ No registration found for testing');
      return;
    }
    
    console.log('✅ Found registration:', registration.id);
    console.log('User:', registration.user?.email);
    console.log('Profile exists:', !!registration.user?.profile);
    
    // Test contract generation
    console.log('Generating contract...');
    const pdfBuffer = await contractService.generateContract(registration.id);
    
    console.log('✅ Contract generated successfully');
    console.log('PDF buffer size:', pdfBuffer.length, 'bytes');
    
    // Test saving contract
    console.log('Saving contract...');
    const contractUrl = await contractService.saveContract(registration.id, pdfBuffer);
    
    console.log('✅ Contract saved successfully');
    console.log('Contract URL:', contractUrl);
    
  } catch (error) {
    console.error('❌ Contract generation failed:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testContractGeneration();