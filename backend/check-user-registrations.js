const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUserRegistrations() {
  try {
    console.log('Checking all users and their registrations...');
    
    const users = await prisma.user.findMany({
      include: {
        registrations: {
          include: {
            deadlines: true,
            payments: true
          }
        }
      }
    });
    
    console.log(`Found ${users.length} users`);
    
    for (const user of users) {
      console.log(`\nUser: ${user.email} (${user.role})`);
      console.log(`  - Registrations: ${user.registrations.length}`);
      
      for (const registration of user.registrations) {
        console.log(`  - Registration ${registration.id}:`);
        console.log(`    - Course: ${registration.courseId}`);
        console.log(`    - Status: ${registration.status}`);
        console.log(`    - Amount: €${registration.finalAmount}`);
        console.log(`    - Installments: ${registration.installments}`);
        console.log(`    - Deadlines: ${registration.deadlines.length}`);
        console.log(`    - Payments: ${registration.payments.length}`);
        
        if (registration.deadlines.length > 0) {
          console.log(`    - Deadline details:`);
          registration.deadlines.forEach((deadline, index) => {
            console.log(`      ${index + 1}. €${deadline.amount} - Due: ${deadline.dueDate.toISOString().split('T')[0]} - Paid: ${deadline.isPaid}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking user registrations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserRegistrations();