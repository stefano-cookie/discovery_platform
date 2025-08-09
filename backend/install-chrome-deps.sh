#!/bin/bash

# Script per installare le dipendenze necessarie per Puppeteer/Chrome
# Eseguire con: sudo bash install-chrome-deps.sh

echo "=== Installing Chrome/Puppeteer Dependencies ==="
echo ""

# Detect OS
if [ -f /etc/debian_version ]; then
    # Debian/Ubuntu
    echo "Detected Debian/Ubuntu system"
    echo "Installing dependencies..."
    
    apt-get update
    apt-get install -y \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libatspi2.0-0 \
        libxdamage1 \
        libasound2 \
        libxcomposite1 \
        libxrandr2 \
        libxss1 \
        libxtst6 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libgbm1 \
        libdrm2 \
        fonts-liberation \
        libappindicator3-1 \
        xdg-utils \
        wget
        
    echo ""
    echo "✓ Dependencies installed successfully"
    
elif [ -f /etc/redhat-release ]; then
    # RedHat/CentOS/Fedora
    echo "Detected RedHat/CentOS/Fedora system"
    echo "Installing dependencies..."
    
    yum install -y \
        atk \
        at-spi2-atk \
        cups-libs \
        at-spi2-core \
        libXdamage \
        alsa-lib \
        libXcomposite \
        libXrandr \
        libXScrnSaver \
        libXtst \
        gtk3 \
        nspr \
        nss \
        mesa-libgbm \
        libdrm \
        liberation-fonts \
        libappindicator-gtk3 \
        xdg-utils \
        wget
        
    echo ""
    echo "✓ Dependencies installed successfully"
    
else
    echo "⚠ Unknown operating system"
    echo "Please install the following packages manually:"
    echo "  - libatk1.0-0"
    echo "  - libatk-bridge2.0-0"
    echo "  - libcups2"
    echo "  - libatspi2.0-0"
    echo "  - libxdamage1"
    echo "  - libasound2"
    echo "  - Additional GTK and X11 libraries"
    exit 1
fi

echo ""
echo "=== Testing Puppeteer ==="
echo ""

# Test if node and puppeteer work
cd "$(dirname "$0")"
if [ -f "test-puppeteer.js" ]; then
    echo "Running Puppeteer test..."
    node test-puppeteer.js
else
    echo "Test script not found. Testing basic Puppeteer launch..."
    node -e "
    const puppeteer = require('puppeteer');
    puppeteer.launch({ 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    })
    .then(browser => {
        console.log('✓ Puppeteer works!');
        return browser.close();
    })
    .catch(err => {
        console.error('✗ Puppeteer still failing:', err.message);
        process.exit(1);
    });
    "
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Next steps:"
echo "1. Restart the PM2 process: pm2 restart discovery-api"
echo "2. Test contract generation from the application"
echo ""