import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function runHealthChecks() {
  console.log('🏥 Running post-deployment health checks...');

  const checks = [];

  try {
    // Database connectivity
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection: OK');
    checks.push({ name: 'Database', status: 'OK' });
  } catch (error) {
    console.log('❌ Database connection: FAILED');
    console.error(error);
    checks.push({ name: 'Database', status: 'FAILED', error: String(error) });
  }

  try {
    // API health endpoint
    const response = await axios.get('http://localhost:3001/api/health', { timeout: 5000 });
    console.log('✅ API health endpoint: OK');
    checks.push({ name: 'API Health', status: 'OK' });
  } catch (error) {
    console.log('❌ API health endpoint: FAILED');
    checks.push({ name: 'API Health', status: 'FAILED', error: String(error) });
  }

  try {
    // Check critical tables exist
    const userCount = await prisma.user.count();
    const partnerCount = await prisma.partner.count();
    console.log(`✅ Critical tables: OK (${userCount} users, ${partnerCount} partners)`);
    checks.push({ name: 'Critical Tables', status: 'OK' });
  } catch (error) {
    console.log('❌ Critical tables: FAILED');
    checks.push({ name: 'Critical Tables', status: 'FAILED', error: String(error) });
  }

  const failedChecks = checks.filter(check => check.status === 'FAILED');

  if (failedChecks.length > 0) {
    console.log(`❌ Health checks completed with ${failedChecks.length} failures`);
    process.exit(1);
  } else {
    console.log('✅ All health checks passed');
    process.exit(0);
  }
}

runHealthChecks().catch((error) => {
  console.error('🚨 Health check script failed:', error);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});