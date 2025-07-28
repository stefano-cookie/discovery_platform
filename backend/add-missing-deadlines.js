const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addMissingDeadlines() {
  try {
    console.log('Checking for registrations without payment deadlines...');
    
    // Find all registrations that don't have payment deadlines
    const registrations = await prisma.registration.findMany({
      include: {
        deadlines: true,
        offer: true
      }
    });
    
    console.log(`Found ${registrations.length} total registrations`);
    
    for (const registration of registrations) {
      if (registration.deadlines.length === 0) {
        console.log(`Adding deadlines for registration ${registration.id}...`);
        
        const installments = registration.installments || 1;
        const finalAmount = Number(registration.finalAmount) || 0;
        const offerType = registration.offerType || 'TFA_ROMANIA';
        
        let downPayment = 0;
        let installmentableAmount = finalAmount;
        
        if (offerType === 'TFA_ROMANIA') {
          downPayment = 1500;
          installmentableAmount = Math.max(0, finalAmount - downPayment);
        }
        
        console.log(`Registration details:`, {
          id: registration.id,
          installments,
          finalAmount,
          offerType,
          downPayment,
          installmentableAmount
        });
        
        if (installments > 1) {
          const amountPerInstallment = installmentableAmount / installments;
          
          // Create down payment deadline for TFA Romania
          if (downPayment > 0) {
            const downPaymentDate = new Date();
            downPaymentDate.setDate(downPaymentDate.getDate() + 1);
            
            await prisma.paymentDeadline.create({
              data: {
                registrationId: registration.id,
                amount: downPayment,
                dueDate: downPaymentDate,
                paymentNumber: 0,
                isPaid: false
              }
            });
            
            console.log(`Created down payment deadline: €${downPayment}`);
          }
          
          // Create installment deadlines
          for (let i = 0; i < installments; i++) {
            const dueDate = new Date();
            dueDate.setMonth(dueDate.getMonth() + i + 1);
            
            await prisma.paymentDeadline.create({
              data: {
                registrationId: registration.id,
                amount: amountPerInstallment,
                dueDate: dueDate,
                paymentNumber: i + 1,
                isPaid: false
              }
            });
            
            console.log(`Created installment ${i + 1}: €${amountPerInstallment.toFixed(2)}`);
          }
        } else {
          // Single payment
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 1);
          
          await prisma.paymentDeadline.create({
            data: {
              registrationId: registration.id,
              amount: finalAmount,
              dueDate: dueDate,
              paymentNumber: 1,
              isPaid: false
            }
          });
          
          console.log(`Created single payment deadline: €${finalAmount}`);
        }
        
        console.log(`✅ Added deadlines for registration ${registration.id}`);
      } else {
        console.log(`Registration ${registration.id} already has ${registration.deadlines.length} deadlines`);
      }
    }
    
    console.log('✅ Finished processing all registrations');
  } catch (error) {
    console.error('Error adding missing deadlines:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingDeadlines();