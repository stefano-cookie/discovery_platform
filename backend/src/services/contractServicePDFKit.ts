import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
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
  totalAmount: number;
  contractDate: string;
  courseName: string;
  paymentPlan: Array<{
    label: string;
    amount: number;
    dueDate: string;
  }>;
}

export class ContractServicePDFKit {
  /**
   * Calculate the project root directory
   */
  private getProjectRoot(): string {
    let currentDir = __dirname;

    while (currentDir !== path.dirname(currentDir)) {
      const parentDir = path.dirname(currentDir);

      if (fs.existsSync(path.join(parentDir, 'backend')) &&
          (fs.existsSync(path.join(parentDir, 'package.json')) ||
           fs.existsSync(path.join(parentDir, 'frontend')))) {
        return parentDir;
      }

      currentDir = parentDir;
    }

    return process.cwd();
  }

  async generateContract(registrationId: string): Promise<Buffer> {
    try {
      console.log('[CONTRACT_PDF] Starting contract generation for:', registrationId);

      // Fetch registration data
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
          payments: {
            orderBy: {
              paymentNumber: 'asc'
            }
          }
        }
      });

      if (!registration) {
        throw new Error('Registrazione non trovata');
      }

      console.log('[CONTRACT_PDF] Registration data loaded, preparing contract data');

      // Prepare contract data
      const contractData = this.prepareContractData(registration);

      console.log('[CONTRACT_PDF] Contract data prepared, generating PDF');

      // Generate PDF
      const pdfBuffer = await this.generatePDF(contractData);

      console.log('[CONTRACT_PDF] PDF generated successfully');

      return pdfBuffer;

    } catch (error) {
      console.error('[CONTRACT_PDF] Error generating contract:', error);
      throw new Error('Errore durante la generazione del contratto');
    }
  }

  private prepareContractData(registration: any): ContractData {
    const user = registration.user;
    const profile = registration.user?.profile;
    const offer = registration.offer;

    // Format date in Italian
    const formatDate = (date: Date | string) => {
      if (!date) return '';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('it-IT');
    };

    // Calculate total amount - convert string to number
    const finalAmount = registration.finalAmount ? parseFloat(registration.finalAmount.toString()) : null;
    const originalAmount = registration.originalAmount ? parseFloat(registration.originalAmount.toString()) : null;
    const offerPrice = offer?.totalAmount ? parseFloat(offer.totalAmount.toString()) : null;

    const totalAmount = finalAmount || offerPrice || originalAmount || 1500;

    // Course name
    const courseName = offer?.course?.name || offer?.name || 'Corso di Formazione';

    // Prepare payment plan with real amounts
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
      totalAmount,
      contractDate: formatDate(registration.createdAt),
      courseName,
      paymentPlan
    };
  }

  private preparePaymentPlan(registration: any, totalAmount: number): Array<{
    label: string;
    amount: number;
    dueDate: string;
  }> {
    const paymentPlan: Array<{ label: string; amount: number; dueDate: string }> = [];
    let allPayments: any[] = [];

    console.log('[CONTRACT_PDF] Preparing payment plan - Total amount:', totalAmount);
    console.log('[CONTRACT_PDF] Installments:', registration.installments);
    console.log('[CONTRACT_PDF] Existing payments:', registration.payments?.length || 0);

    // Check if there are existing payments in database
    if (registration.payments && registration.payments.length > 0) {
      console.log('[CONTRACT_PDF] Using existing payments from database');
      allPayments = registration.payments
        .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .map((p: any) => ({
          amount: parseFloat(p.amount.toString()),
          dueDate: p.dueDate,
          paymentNumber: p.paymentNumber,
          paymentType: p.paymentType
        }));
    } else {
      console.log('[CONTRACT_PDF] No existing payments, generating default payment plan');
      // Generate default payment plan based on installments
      const today = new Date();
      const installments = registration.installments || 1;

      if (installments > 1) {
        // Multiple installments: deposit €1500 + monthly installments
        const downPayment = 1500;
        const installmentableAmount = Math.max(0, totalAmount - downPayment);
        const monthlyAmount = installments > 0 ? installmentableAmount / installments : installmentableAmount;

        console.log('[CONTRACT_PDF] Multi-installment plan:');
        console.log('[CONTRACT_PDF] - Deposit: €1500');
        console.log('[CONTRACT_PDF] - Installmentable amount:', installmentableAmount);
        console.log('[CONTRACT_PDF] - Number of installments:', installments);
        console.log('[CONTRACT_PDF] - Monthly amount:', monthlyAmount.toFixed(2));

        // Add deposit (paymentNumber 0)
        const downPaymentDate = new Date(today);
        downPaymentDate.setDate(downPaymentDate.getDate() + 7); // 7 days after registration

        allPayments.push({
          amount: downPayment,
          dueDate: downPaymentDate,
          paymentNumber: 0,
          paymentType: 'DEPOSIT'
        });

        // Calculate monthly installments starting 37 days after registration
        const baseDate = new Date(today);
        baseDate.setDate(baseDate.getDate() + 37); // 7 days deposit + 30 days first installment

        for (let i = 0; i < installments; i++) {
          const dueDate = new Date(baseDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          // Calculate amount for last installment (adjust for rounding)
          let amount = monthlyAmount;
          if (i === installments - 1) {
            const totalPaid = monthlyAmount * (installments - 1);
            amount = installmentableAmount - totalPaid;
          }

          allPayments.push({
            amount: amount,
            dueDate: dueDate,
            paymentNumber: i + 1,
            paymentType: 'INSTALLMENT'
          });
        }
      } else {
        console.log('[CONTRACT_PDF] Single payment plan:', totalAmount);
        // Single payment
        allPayments.push({
          amount: totalAmount,
          dueDate: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days after
          paymentNumber: 1,
          paymentType: 'INSTALLMENT'
        });
      }
    }

    // Convert to payment plan format
    for (const payment of allPayments) {
      const label = payment.paymentType === 'DEPOSIT' ? 'Acconto' :
                   `Rata ${payment.paymentNumber}`;

      paymentPlan.push({
        label,
        amount: payment.amount,
        dueDate: new Date(payment.dueDate).toLocaleDateString('it-IT')
      });
    }

    console.log('[CONTRACT_PDF] Final payment plan:', paymentPlan.map(p => `${p.label}: €${p.amount.toFixed(2)} - ${p.dueDate}`).join(', '));

    return paymentPlan;
  }

  private async generatePDF(data: ContractData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc
          .fontSize(24)
          .fillColor('#003366')
          .text('CFO EDUCATION S.R.L.', { align: 'center' })
          .moveDown(0.5);

        doc
          .fontSize(20)
          .text('CONTRATTO DI ISCRIZIONE', { align: 'center' })
          .moveDown(1.5);

        // Student data section
        doc
          .fontSize(14)
          .fillColor('#003366')
          .text('DATI DELLO STUDENTE', { underline: true })
          .moveDown(0.5);

        doc.fontSize(11).fillColor('#000000');

        const leftColumn = 70;
        const rightColumn = 320;
        let yPos = doc.y;

        doc.text('Nome Completo:', leftColumn, yPos, { continued: true, width: 200 });
        doc.font('Helvetica-Bold').text(data.fullName, { width: 250 });
        doc.font('Helvetica');
        yPos += 20;

        doc.text('Data di Nascita:', leftColumn, yPos, { continued: true, width: 200 });
        doc.font('Helvetica-Bold').text(data.birthDate, { width: 250 });
        doc.font('Helvetica');
        yPos += 20;

        doc.text('Luogo di Nascita:', leftColumn, yPos, { continued: true, width: 200 });
        doc.font('Helvetica-Bold').text(data.birthPlace, { width: 250 });
        doc.font('Helvetica');
        yPos += 20;

        doc.text('Indirizzo:', leftColumn, yPos, { continued: true, width: 200 });
        doc.font('Helvetica-Bold').text(data.address, { width: 250 });
        doc.font('Helvetica');
        yPos += 20;

        doc.text('Provincia:', leftColumn, yPos, { continued: true, width: 200 });
        doc.font('Helvetica-Bold').text(data.province, { width: 250 });
        doc.font('Helvetica');
        yPos += 20;

        doc.text('CAP:', leftColumn, yPos, { continued: true, width: 200 });
        doc.font('Helvetica-Bold').text(data.zipCode, { width: 250 });
        doc.font('Helvetica');
        yPos += 20;

        doc.text('Codice Fiscale:', leftColumn, yPos, { continued: true, width: 200 });
        doc.font('Helvetica-Bold').text(data.fiscalCode, { width: 250 });
        doc.font('Helvetica');
        yPos += 20;

        doc.text('Email:', leftColumn, yPos, { continued: true, width: 200 });
        doc.font('Helvetica-Bold').text(data.email, { width: 250 });
        doc.font('Helvetica');
        yPos += 20;

        doc.text('Telefono:', leftColumn, yPos, { continued: true, width: 200 });
        doc.font('Helvetica-Bold').text(data.phone, { width: 250 });
        doc.font('Helvetica');

        doc.moveDown(2);

        // Course section
        doc
          .fontSize(14)
          .fillColor('#003366')
          .text('SERVIZIO SELEZIONATO', { underline: true })
          .moveDown(0.5);

        doc.fontSize(11).fillColor('#000000');
        doc.text(`Corso: ${data.courseName}`, leftColumn);
        doc.text(`Importo Totale: €${data.totalAmount.toFixed(2).replace('.', ',')}`, leftColumn);

        doc.moveDown(2);

        // Payment plan section
        doc
          .fontSize(14)
          .fillColor('#003366')
          .text('PIANO DI PAGAMENTO', { underline: true })
          .moveDown(0.5);

        doc.fontSize(11).fillColor('#000000');

        // Payment table
        const tableTop = doc.y;
        const colLabel = leftColumn;
        const colAmount = leftColumn + 200;
        const colDate = leftColumn + 350;
        const rowHeight = 25;

        // Table header
        doc.font('Helvetica-Bold').fillColor('#FFFFFF').rect(colLabel, tableTop, 445, rowHeight).fill('#003366');
        doc.text('Rata', colLabel + 5, tableTop + 7);
        doc.text('Importo', colAmount + 5, tableTop + 7);
        doc.text('Scadenza', colDate + 5, tableTop + 7);

        // Table rows
        doc.font('Helvetica').fillColor('#000000');
        let currentY = tableTop + rowHeight;

        for (let i = 0; i < data.paymentPlan.length; i++) {
          const payment = data.paymentPlan[i];
          const bgColor = i % 2 === 0 ? '#F5F5F5' : '#FFFFFF';

          doc.rect(colLabel, currentY, 445, rowHeight).fill(bgColor);
          doc.fillColor('#000000');
          doc.text(payment.label, colLabel + 5, currentY + 7);
          doc.text(`€${payment.amount.toFixed(2).replace('.', ',')}`, colAmount + 5, currentY + 7);
          doc.text(payment.dueDate, colDate + 5, currentY + 7);

          currentY += rowHeight;
        }

        // Total
        doc.moveDown(1);
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .fillColor('#003366')
          .text(`IMPORTO TOTALE: €${data.totalAmount.toFixed(2).replace('.', ',')}`, { align: 'right' });

        // Signature section
        doc.moveDown(3);
        doc.fontSize(11).fillColor('#000000').font('Helvetica');

        const signatureY = doc.y;
        doc.text('Data: ' + data.contractDate, leftColumn, signatureY);

        doc.moveDown(2);
        const lineY = doc.y;

        doc.text('Firma del Cliente', leftColumn, lineY + 30);
        doc.moveTo(leftColumn, lineY + 25).lineTo(leftColumn + 150, lineY + 25).stroke();

        doc.text('Firma CFO Education', rightColumn, lineY + 30);
        doc.moveTo(rightColumn, lineY + 25).lineTo(rightColumn + 150, lineY + 25).stroke();

        // Footer
        doc.fontSize(8).fillColor('#666666');
        doc.text(
          'CFO EDUCATION S.R.L. - Via Example, 123 - 00100 Roma - P.IVA: XXXXXXXX',
          50,
          doc.page.height - 50,
          { align: 'center', width: doc.page.width - 100 }
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  async saveContract(registrationId: string, pdfBuffer: Buffer): Promise<string> {
    try {
      console.log('[CONTRACT_PDF] Starting contract save for:', registrationId);

      // Calculate project root directory for consistent path resolution
      const projectRoot = this.getProjectRoot();
      const contractsDir = path.join(projectRoot, 'backend/uploads/contracts');
      console.log('[CONTRACT_PDF] Contracts directory:', contractsDir);

      if (!fs.existsSync(contractsDir)) {
        console.log('[CONTRACT_PDF] Creating contracts directory');
        fs.mkdirSync(contractsDir, { recursive: true });
      }

      // Save PDF file
      const fileName = `contract_${registrationId}.pdf`;
      const filePath = path.join(contractsDir, fileName);
      console.log('[CONTRACT_PDF] Saving contract to:', filePath);

      fs.writeFileSync(filePath, pdfBuffer);
      console.log('[CONTRACT_PDF] File saved successfully');

      const returnPath = `/uploads/contracts/${fileName}`;
      console.log('[CONTRACT_PDF] Returning URL path:', returnPath);
      return returnPath;
    } catch (error) {
      console.error('[CONTRACT_PDF] Error saving contract:', error);
      throw new Error('Errore durante il salvataggio del contratto');
    }
  }
}
