#!/usr/bin/env node

/**
 * Post-Build Script per Discovery Platform
 *
 * Aggiunge meta tag no-cache all'index.html per prevenire problemi di caching
 * durante i deploy in produzione.
 */

const fs = require('fs');
const path = require('path');

const buildPath = path.join(__dirname, '..', 'build');
const indexPath = path.join(buildPath, 'index.html');

console.log('📦 Post-build: Adding cache-busting meta tags...');

try {
  let indexHtml = fs.readFileSync(indexPath, 'utf8');

  // Aggiungi meta tag per disabilitare cache su index.html
  const metaTags = `
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">`;

  // Inserisci dopo <head>
  indexHtml = indexHtml.replace('<head>', `<head>${metaTags}`);

  fs.writeFileSync(indexPath, indexHtml);

  console.log('✅ Cache-busting meta tags added successfully');
  console.log('📝 Build timestamp:', new Date().toISOString());
} catch (error) {
  console.error('❌ Error adding cache-busting tags:', error);
  process.exit(1);
}
