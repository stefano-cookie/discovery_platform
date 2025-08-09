import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import * as puppeteer from 'puppeteer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ContractData {
  fullName: string;
  birthDate: string;
  birthPlace: string;
  address: string;
  province: string;
  zipCode: string;
  fiscalCode: string;
  email: string;
  phone: string;
  totalAmount: string;
  contractDate: string;
  selectedServices: Array<{
    name: string;
    price: string;
    secondService?: string;
    secondPrice?: string;
  }>;
  paymentPlan: Array<{
    number: string;
    amount: string;
    dueDate: string;
    secondNumber?: string;
    secondAmount?: string;
    secondDueDate?: string;
  }>;
}

export class ContractService {
  private templatePath = path.join(__dirname, '../../templates/contract-template.html');

  constructor() {
    // Registra helper Handlebars
    Handlebars.registerHelper('formatCurrency', (amount: number) => {
      return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
      }).format(amount);
    });

    Handlebars.registerHelper('formatDate', (date: Date) => {
      return new Intl.DateTimeFormat('it-IT').format(date);
    });
  }

  async generateContract(registrationId: string): Promise<Buffer> {
    try {
      console.log(`[CONTRACT_SERVICE] Starting contract generation for: ${registrationId}`);
      
      // Recupera i dati dell'iscrizione dal database
      const registration = await prisma.registration.findUnique({
        where: { id: registrationId },
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
        console.log(`[CONTRACT_SERVICE] Error: Registration not found: ${registrationId}`);
        throw new Error('Registrazione non trovata');
      }
      
      console.log(`[CONTRACT_SERVICE] Registration data loaded for user: ${registration.user?.email}`);

      console.log('Registration data:', {
        id: registration.id,
        user: registration.user?.email,
        profile: registration.user?.profile ? 'PRESENT' : 'MISSING',
        profileData: registration.user?.profile,
        offer: registration.offer?.name,
        originalAmount: registration.originalAmount,
        finalAmount: registration.finalAmount,
        installments: registration.installments
      });

      // Prepara i dati per il template
      const contractData = this.prepareContractData(registration);
      
      console.log('Contract data prepared:', JSON.stringify(contractData, null, 2));

      // Legge il template HTML
      console.log(`[CONTRACT_SERVICE] Reading template from: ${this.templatePath}`);
      if (!fs.existsSync(this.templatePath)) {
        console.log(`[CONTRACT_SERVICE] Error: Template file not found: ${this.templatePath}`);
        throw new Error(`Template file not found: ${this.templatePath}`);
      }
      const templateHtml = fs.readFileSync(this.templatePath, 'utf8');
      console.log(`[CONTRACT_SERVICE] Template loaded, length: ${templateHtml.length}`);
      
      // Compila il template con Handlebars
      const template = Handlebars.compile(templateHtml);
      const html = template(contractData);

      // Genera il PDF usando Puppeteer
      console.log('[CONTRACT_SERVICE] Launching Puppeteer...');
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('[CONTRACT_SERVICE] Puppeteer browser launched successfully');

      const page = await browser.newPage();
      console.log('[CONTRACT_SERVICE] Setting page content...');
      await page.setContent(html, { waitUntil: 'networkidle0' });
      console.log('[CONTRACT_SERVICE] Generating PDF...');

      const pdfBuffer = Buffer.from(await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm'
        }
      }));
      
      console.log(`[CONTRACT_SERVICE] PDF generated, buffer size: ${pdfBuffer.length}`);
      await browser.close();
      console.log('[CONTRACT_SERVICE] Browser closed');

      return pdfBuffer;

    } catch (error) {
      console.error('Errore generazione contratto:', error);
      throw new Error('Errore durante la generazione del contratto');
    }
  }

  private prepareContractData(registration: any): ContractData {
    const user = registration.user;
    const profile = registration.user?.profile;
    const offer = registration.offer;

    // Formato data italiana
    const formatDate = (date: Date | string) => {
      if (!date) return '';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('it-IT');
    };

    // Calcola l'importo totale corretto - converti string in number
    const finalAmount = registration.finalAmount ? parseFloat(registration.finalAmount.toString()) : null;
    const originalAmount = registration.originalAmount ? parseFloat(registration.originalAmount.toString()) : null;
    const offerPrice = offer?.totalAmount ? parseFloat(offer.totalAmount.toString()) : null;
    
    const totalAmount = finalAmount || offerPrice || originalAmount || 1500;
    
    console.log('Amount calculation:', {
      finalAmount,
      originalAmount, 
      offerPrice,
      totalAmount
    });

    // Prepara servizi selezionati basati sul tipo di offerta
    const selectedServices = this.prepareServices(registration, offer, totalAmount);

    // Prepara piano pagamenti con importi reali
    const paymentPlan = this.preparePaymentPlan(registration, totalAmount);

    return {
      fullName: profile ? `${profile.nome} ${profile.cognome}`.toUpperCase() : 'NOME COGNOME',
      birthDate: profile?.dataNascita ? formatDate(profile.dataNascita) : '',
      birthPlace: profile?.luogoNascita?.toUpperCase() || '',
      address: profile ? `${profile.residenzaVia} - ${profile.residenzaCitta}` : '',
      province: profile?.residenzaProvincia?.toUpperCase() || '',
      zipCode: profile?.residenzaCap || '',
      fiscalCode: profile?.codiceFiscale?.toUpperCase() || '',
      email: user?.email || '',
      phone: profile?.telefono || '',
      totalAmount: totalAmount ? `${totalAmount.toFixed(2).replace('.', ',')}` : '0,00',
      contractDate: formatDate(registration.createdAt),
      selectedServices,
      paymentPlan
    };
  }

  private prepareServices(registration: any, offer: any, totalAmount: number): Array<{
    name: string;
    price: string;
    secondService?: string;
    secondPrice?: string;
  }> {
    // Servizi standard basati sul tipo di offerta della registrazione
    const services = [];
    const offerType = offer?.offerType || 'TFA_ROMANIA';

    if (offerType === 'TFA_ROMANIA') {
      services.push({
        name: 'Certificazione Lingua Inglese Livello B2',
        price: '122,00',
        secondService: 'Corso per Realizzazione U.D.A.',
        secondPrice: ''
      });
      services.push({
        name: 'Certificazione Lingua Inglese Livello C1',
        price: '120,78',
        secondService: 'Autocad Expert',
        secondPrice: ''
      });
      services.push({
        name: 'Certificazione Lingua Inglese Livello C2',
        price: '117,12',
        secondService: '',
        secondPrice: ''
      });
      services.push({
        name: 'Corso di Dattilografia',
        price: '732,00',
        secondService: '',
        secondPrice: ''
      });
      services.push({
        name: 'Corso Tablet',
        price: '1.525,00',
        secondService: '',
        secondPrice: ''
      });
    } else {
      // Per certificazioni, servizi più semplici
      services.push({
        name: 'Servizi di Formazione e Certificazione',
        price: totalAmount ? `${totalAmount.toFixed(2).replace('.', ',')}` : '0,00',
        secondService: '',
        secondPrice: ''
      });
    }

    return services;
  }

  private preparePaymentPlan(registration: any, totalAmount: number): Array<{
    number: string;
    amount: string;
    dueDate: string;
    secondNumber?: string;
    secondAmount?: string;
    secondDueDate?: string;
  }> {
    const paymentPlan = [];
    let allPayments: any[] = [];
    
    // Verifica se esistono pagamenti già registrati
    if (registration.payments && registration.payments.length > 0) {
      // Usa i pagamenti reali dalla registrazione
      allPayments = registration.payments.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    } else if (registration.offer?.customPaymentPlan?.payments) {
      // Usa il piano pagamenti personalizzato dall'offerta
      allPayments = registration.offer.customPaymentPlan.payments;
    } else {
      // Piano pagamenti di default basato su installments della registrazione
      const today = new Date();
      const installments = registration.installments || 12;
      const monthlyAmount = totalAmount / installments;
      
      for (let i = 0; i < installments; i++) {
        const dueDate = new Date(today);
        dueDate.setMonth(today.getMonth() + i + 1);
        
        // Calcola importo per ultima rata (remainder)
        let amount = monthlyAmount;
        if (i === installments - 1) {
          // Ultima rata: aggiusta per eventuali differenze di arrotondamento
          const totalPaid = monthlyAmount * (installments - 1);
          amount = totalAmount - totalPaid;
        }
        
        allPayments.push({
          amount: amount,
          dueDate: dueDate
        });
      }
    }

    // Organizza i pagamenti per la visualizzazione in tabella
    // Se ci sono pochi pagamenti (<=6), li mostriamo verticalmente (uno per riga)
    // Se ci sono molti pagamenti (>6), li organizziamo in 2 colonne
    if (allPayments.length <= 6) {
      // Layout verticale - un pagamento per riga
      for (let i = 0; i < allPayments.length; i++) {
        const payment = allPayments[i];
        paymentPlan.push({
          number: (i + 1).toString(),
          amount: `${payment.amount.toFixed(2).replace('.', ',')}`,
          dueDate: new Date(payment.dueDate).toLocaleDateString('it-IT'),
          secondNumber: undefined,
          secondAmount: undefined,
          secondDueDate: undefined
        });
      }
    } else {
      // Layout a 2 colonne per molti pagamenti
      for (let i = 0; i < allPayments.length; i += 2) {
        const firstPayment = allPayments[i];
        const secondPayment = allPayments[i + 1];
        
        paymentPlan.push({
          number: (i + 1).toString(),
          amount: `${firstPayment.amount.toFixed(2).replace('.', ',')}`,
          dueDate: new Date(firstPayment.dueDate).toLocaleDateString('it-IT'),
          secondNumber: secondPayment ? (i + 2).toString() : undefined,
          secondAmount: secondPayment ? `${secondPayment.amount.toFixed(2).replace('.', ',')}` : undefined,
          secondDueDate: secondPayment ? new Date(secondPayment.dueDate).toLocaleDateString('it-IT') : undefined
        });
      }
    }

    return paymentPlan;
  }

  async saveContract(registrationId: string, pdfBuffer: Buffer): Promise<string> {
    try {
      // Crea directory per i contratti se non exists
      const contractsDir = path.join(__dirname, '../../uploads/contracts');
      if (!fs.existsSync(contractsDir)) {
        fs.mkdirSync(contractsDir, { recursive: true });
      }

      // Salva il file PDF
      const fileName = `contract_${registrationId}.pdf`;
      const filePath = path.join(contractsDir, fileName);
      
      fs.writeFileSync(filePath, pdfBuffer);

      return `/uploads/contracts/${fileName}`;
    } catch (error) {
      console.error('Errore salvataggio contratto:', error);
      throw new Error('Errore durante il salvataggio del contratto');
    }
  }
}