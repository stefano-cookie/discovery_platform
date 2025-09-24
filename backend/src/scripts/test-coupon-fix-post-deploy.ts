#!/usr/bin/env node

/**
 * Post-deployment test script for coupon fix verification
 * This script verifies that the coupon fix is properly implemented
 */

import fs from 'fs';
import path from 'path';

async function testCouponFix() {
  console.log('🔒 Testing coupon fix implementation...');

  try {
    // Path to the partner.ts file
    const partnerFilePath = path.join(__dirname, '../../src/routes/partner.ts');

    if (!fs.existsSync(partnerFilePath)) {
      console.error('❌ partner.ts file not found at:', partnerFilePath);
      process.exit(1);
    }

    // Read the file content
    const fileContent = fs.readFileSync(partnerFilePath, 'utf8');

    // Check for the correct coupon creation pattern
    const correctPattern = /partnerCompanyId:\s*partnerCompanyId[,\s]/;
    const incorrectPattern = /partnerCompanyId:\s*legacyPartner\.id[,\s]/;

    if (correctPattern.test(fileContent)) {
      console.log('✅ Coupon fix verified: partnerCompanyId correctly uses partnerCompanyId');

      // Additional check: ensure we're not using legacyPartner.id for partnerCompanyId
      if (incorrectPattern.test(fileContent)) {
        console.error('❌ CRITICAL: Found incorrect usage of legacyPartner.id for partnerCompanyId');
        process.exit(1);
      }

      console.log('✅ Coupon fix implementation is correct');
      process.exit(0);
    } else {
      console.error('❌ Coupon fix not found or incorrect');
      console.error('Expected: partnerCompanyId: partnerCompanyId');

      // Show context around coupon creation
      const lines = fileContent.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('coupon.create')) {
          console.error('Context around line', i + 1, ':');
          const start = Math.max(0, i - 3);
          const end = Math.min(lines.length, i + 10);
          for (let j = start; j < end; j++) {
            const prefix = j === i ? '>>>' : '   ';
            console.error(`${prefix} ${j + 1}: ${lines[j]}`);
          }
          break;
        }
      }

      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error testing coupon fix:', error);
    process.exit(1);
  }
}

// Run the test
testCouponFix().catch((error) => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});