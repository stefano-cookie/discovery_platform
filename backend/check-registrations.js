const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkRegistrations() {
  try {
    const count = await prisma.registration.count();
    console.log('Total registrations:', count);
    
    if (count > 0) {
      const recent = await prisma.registration.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true
            }
          },
          offer: {
            select: {
              name: true,
              offerType: true
            }
          }
        }
      });
      
      console.log('Recent registrations:');
      recent.forEach((reg, index) => {
        console.log(`${index + 1}. ID: ${reg.id}`);
        console.log(`   User: ${reg.user?.email || 'N/A'}`);
        console.log(`   Offer: ${reg.offer?.name || 'N/A'} (${reg.offer?.offerType || 'N/A'})`);
        console.log(`   Status: ${reg.status}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRegistrations();