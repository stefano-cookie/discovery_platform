const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    console.log('🔄 Creazione/Verifica utenti di test...\n');

    // 1. Admin
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminEmail = 'admin@diamante.com';
    
    let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: adminEmail,
          password: adminPassword,
          role: 'ADMIN',
          isActive: true,
          emailVerified: true,
          emailVerifiedAt: new Date()
        }
      });
      console.log('✅ Admin creato:', adminEmail);
    } else {
      // Aggiorna password per sicurezza
      await prisma.user.update({
        where: { id: admin.id },
        data: { 
          password: adminPassword,
          emailVerified: true,
          emailVerifiedAt: admin.emailVerifiedAt || new Date()
        }
      });
      console.log('✅ Admin esistente aggiornato:', adminEmail);
    }

    // 2. Partner
    const partnerPassword = await bcrypt.hash('partner123', 10);
    const partnerEmail = 'partner@diamante.com';
    
    let partnerUser = await prisma.user.findUnique({ where: { email: partnerEmail } });
    
    if (!partnerUser) {
      partnerUser = await prisma.user.create({
        data: {
          email: partnerEmail,
          password: partnerPassword,
          role: 'PARTNER',
          isActive: true,
          emailVerified: true,
          emailVerifiedAt: new Date()
        }
      });
      console.log('✅ Partner user creato:', partnerEmail);
    } else {
      // Aggiorna password per sicurezza
      await prisma.user.update({
        where: { id: partnerUser.id },
        data: { 
          password: partnerPassword,
          role: 'PARTNER',
          emailVerified: true,
          emailVerifiedAt: partnerUser.emailVerifiedAt || new Date()
        }
      });
      console.log('✅ Partner user esistente aggiornato:', partnerEmail);
    }

    // 3. Crea record Partner se non esiste
    let partner = await prisma.partner.findUnique({ where: { userId: partnerUser.id } });
    
    if (!partner) {
      partner = await prisma.partner.create({
        data: {
          userId: partnerUser.id,
          referralCode: 'MAIN001',
          canCreateChildren: true,
          commissionPerUser: 1000,
          commissionToAdmin: 3000
        }
      });
      console.log('✅ Partner record creato con referral code:', partner.referralCode);
    } else {
      console.log('✅ Partner record esistente:', partner.referralCode);
    }

    // 4. Verifica finale
    console.log('\n📊 Riepilogo utenti:');
    const users = await prisma.user.findMany({
      where: {
        email: { in: [adminEmail, partnerEmail] }
      },
      select: {
        email: true,
        role: true,
        isActive: true,
        emailVerified: true
      }
    });
    
    users.forEach(user => {
      console.log(`- ${user.email}: ${user.role}, Attivo: ${user.isActive}, Verificato: ${user.emailVerified}`);
    });

    console.log('\n✅ Utenti di test pronti!');
    console.log('\nCredenziali:');
    console.log('- Admin: admin@diamante.com / admin123');
    console.log('- Partner: partner@diamante.com / partner123');

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();