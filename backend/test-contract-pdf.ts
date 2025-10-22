import { ContractServicePDFKit } from './src/services/contractServicePDFKit';
import * as fs from 'fs';
import * as path from 'path';

const testContractGeneration = async () => {
  console.log('Testing PDFKit contract generation...\n');

  const contractService = new ContractServicePDFKit();

  // Mock registration data (similar to what would come from database)
  const mockRegistration = {
    id: 'test-registration-id',
    user: {
      email: 'test@example.com',
      profile: {
        nome: 'Mario',
        cognome: 'Rossi',
        dataNascita: new Date('1990-01-15'),
        luogoNascita: 'Roma',
        residenzaVia: 'Via Roma 123',
        residenzaCitta: 'Milano',
        residenzaProvincia: 'MI',
        residenzaCap: '20100',
        codiceFiscale: 'RSSMRA90A15H501Z',
        telefono: '+39 333 1234567'
      }
    },
    offer: {
      course: {
        name: 'TFA Romania - Acconto 1500€'
      },
      totalAmount: 7500
    },
    finalAmount: 7500,
    installments: 10,
    createdAt: new Date(),
    payments: [
      {
        amount: 1500,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        paymentNumber: 0,
        paymentType: 'DEPOSIT'
      },
      {
        amount: 600,
        dueDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
        paymentNumber: 1,
        paymentType: 'INSTALLMENT'
      },
      {
        amount: 600,
        dueDate: new Date(Date.now() + 67 * 24 * 60 * 60 * 1000),
        paymentNumber: 2,
        paymentType: 'INSTALLMENT'
      }
    ]
  };

  try {
    console.log('Generating PDF...');
    const pdfBuffer = await contractService.generateContract('test-registration-id');

    console.log('✅ PDF generated successfully!');
    console.log('PDF buffer size:', pdfBuffer.length, 'bytes');

    // Save test PDF
    const testOutputDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    const outputPath = path.join(testOutputDir, 'test-contract.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    console.log('✅ Test PDF saved to:', outputPath);

    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

// Run test
testContractGeneration();
