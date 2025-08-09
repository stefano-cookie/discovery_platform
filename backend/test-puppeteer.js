#!/usr/bin/env node

/**
 * Script per testare Puppeteer sul server di produzione
 * Esegui con: node test-puppeteer.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const { execSync } = require('child_process');

console.log('=== PUPPETEER TEST SCRIPT ===\n');

// 1. Verifica installazione Puppeteer
console.log('1. Checking Puppeteer installation...');
try {
  console.log('   Puppeteer version:', require('puppeteer/package.json').version);
  console.log('   Executable path:', puppeteer.executablePath());
  console.log('   ✓ Puppeteer installed\n');
} catch (e) {
  console.error('   ✗ Puppeteer not found:', e.message);
  process.exit(1);
}

// 2. Verifica esistenza Chrome/Chromium
console.log('2. Checking Chrome/Chromium executables...');
const possiblePaths = [
  puppeteer.executablePath(),
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium'
];

let foundChrome = false;
for (const path of possiblePaths) {
  if (fs.existsSync(path)) {
    console.log(`   ✓ Found: ${path}`);
    foundChrome = true;
  }
}
if (!foundChrome) {
  console.log('   ✗ No Chrome/Chromium executable found');
}
console.log();

// 3. Verifica dipendenze di sistema
console.log('3. Checking system dependencies...');
try {
  const lddOutput = execSync(`ldd ${puppeteer.executablePath()} 2>&1`).toString();
  const missingLibs = lddOutput.split('\n').filter(line => line.includes('not found'));
  
  if (missingLibs.length > 0) {
    console.log('   ✗ Missing libraries:');
    missingLibs.forEach(lib => console.log(`     ${lib.trim()}`));
  } else {
    console.log('   ✓ All libraries present');
  }
} catch (e) {
  console.log('   ! Could not check dependencies:', e.message);
}
console.log();

// 4. Test di lancio Puppeteer con diverse configurazioni
console.log('4. Testing Puppeteer launch configurations...\n');

const configs = [
  {
    name: 'Default config',
    options: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  },
  {
    name: 'Production config',
    options: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    }
  },
  {
    name: 'New headless mode',
    options: {
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
  },
  {
    name: 'System Chromium',
    options: {
      headless: true,
      executablePath: '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  }
];

async function testConfig(config) {
  console.log(`   Testing: ${config.name}`);
  try {
    const browser = await puppeteer.launch(config.options);
    const version = await browser.version();
    console.log(`   ✓ Success! Browser version: ${version}`);
    
    // Test page creation
    const page = await browser.newPage();
    await page.setContent('<h1>Test</h1>');
    const title = await page.evaluate(() => document.querySelector('h1').textContent);
    console.log(`   ✓ Page creation works: ${title}`);
    
    await browser.close();
    return true;
  } catch (error) {
    console.log(`   ✗ Failed: ${error.message}`);
    if (error.message.includes('ENOENT')) {
      console.log('     → Executable not found');
    } else if (error.message.includes('Failed to launch')) {
      console.log('     → Browser failed to start');
    }
    return false;
  }
}

(async () => {
  let successCount = 0;
  
  for (const config of configs) {
    if (await testConfig(config)) {
      successCount++;
    }
    console.log();
  }
  
  // 5. Suggerimenti finali
  console.log('=== SUMMARY ===\n');
  console.log(`Successful configurations: ${successCount}/${configs.length}\n`);
  
  if (successCount === 0) {
    console.log('SOLUTION: Install missing dependencies with:');
    console.log('sudo apt-get update && sudo apt-get install -y \\');
    console.log('  chromium-browser \\');
    console.log('  chromium-chromedriver \\');
    console.log('  fonts-liberation \\');
    console.log('  libappindicator3-1 \\');
    console.log('  libasound2 \\');
    console.log('  libatk-bridge2.0-0 \\');
    console.log('  libatk1.0-0 \\');
    console.log('  libcups2 \\');
    console.log('  libdrm2 \\');
    console.log('  libgbm1 \\');
    console.log('  libgtk-3-0 \\');
    console.log('  libnspr4 \\');
    console.log('  libnss3 \\');
    console.log('  libxcomposite1 \\');
    console.log('  libxdamage1 \\');
    console.log('  libxrandr2 \\');
    console.log('  libxss1 \\');
    console.log('  libxtst6 \\');
    console.log('  xdg-utils');
  }
})();