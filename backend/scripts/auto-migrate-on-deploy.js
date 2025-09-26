#!/usr/bin/env node

/**
 * Auto-migration trigger for R2 - runs during deployment
 * This will be called by the deploy script
 */

require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIGRATION_MARKER = path.join(__dirname, '../.r2-migrated');

async function runMigration() {
  // Check if migration already completed
  if (fs.existsSync(MIGRATION_MARKER)) {
    console.log('✅ R2 migration already completed, skipping...');
    return;
  }

  console.log('🚀 Running R2 document migration...');

  return new Promise((resolve, reject) => {
    exec('node scripts/migrate-documents-to-r2.js', { cwd: __dirname + '/..' }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Migration failed:', error);
        reject(error);
        return;
      }

      console.log(stdout);
      if (stderr) console.error(stderr);

      // Mark migration as completed
      fs.writeFileSync(MIGRATION_MARKER, new Date().toISOString());
      console.log('✅ R2 migration completed and marked');
      resolve();
    });
  });
}

// Only run if this script is called directly
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { runMigration };