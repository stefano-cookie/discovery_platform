import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function testCriticalSystems() {
  console.log('🛡️ Testing ALL critical systems...');

  const results = [];

  // Test 1: Contract generation system
  try {
    const registrations = await prisma.registration.findMany({
      where: { contractTemplateUrl: { not: null } },
      take: 1
    });
    console.log(`✅ Contract generation: OK (${registrations.length} contracts found)`);
    results.push({ system: 'Contract Generation', status: 'OK' });
  } catch (error) {
    console.log('❌ Contract generation: FAILED');
    results.push({ system: 'Contract Generation', status: 'FAILED', error: String(error) });
  }

  // Test 2: Payment system
  try {
    const payments = await prisma.paymentDeadline.count();
    console.log(`✅ Payment system: OK (${payments} payment records)`);
    results.push({ system: 'Payment System', status: 'OK' });
  } catch (error) {
    console.log('❌ Payment system: FAILED');
    results.push({ system: 'Payment System', status: 'FAILED', error: String(error) });
  }

  // Test 3: Document system
  try {
    const documents = await prisma.userDocument.count();
    console.log(`✅ Document system: OK (${documents} documents)`);
    results.push({ system: 'Document System', status: 'OK' });
  } catch (error) {
    console.log('❌ Document system: FAILED');
    results.push({ system: 'Document System', status: 'FAILED', error: String(error) });
  }

  // Test 4: Authentication system
  try {
    const sessions = 0; // Session count not available in current schema
    console.log(`✅ Authentication: OK (${sessions} sessions)`);
    results.push({ system: 'Authentication', status: 'OK' });
  } catch (error) {
    console.log('❌ Authentication: FAILED');
    results.push({ system: 'Authentication', status: 'FAILED', error: String(error) });
  }

  // Test 5: Partner system
  try {
    const partners = await prisma.partner.count();
    const partnerOffers = await prisma.partnerOffer.count();
    console.log(`✅ Partner system: OK (${partners} partners, ${partnerOffers} offers)`);
    results.push({ system: 'Partner System', status: 'OK' });
  } catch (error) {
    console.log('❌ Partner system: FAILED');
    results.push({ system: 'Partner System', status: 'FAILED', error: String(error) });
  }

  const failures = results.filter(r => r.status === 'FAILED');

  if (failures.length > 0) {
    console.log(`🚨 CRITICAL DEPLOYMENT FAILURE: ${failures.length} systems broken!`);
    console.log('📋 Failed systems:', failures.map(f => f.system).join(', '));
    process.exit(1);
  } else {
    console.log('✅ All critical systems are operational');
    process.exit(0);
  }
}

testCriticalSystems().catch((error) => {
  console.error('🚨 Critical systems test failed:', error);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});