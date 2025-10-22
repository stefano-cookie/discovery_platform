#!/bin/bash

# Script to install Chromium for Puppeteer PDF generation
# This script must be run with sudo privileges on the production server

echo "=========================================="
echo "Installing Chromium for Puppeteer"
echo "=========================================="

# Update package lists
echo "Updating package lists..."
apt-get update

# Install Chromium and required dependencies
echo "Installing Chromium and dependencies..."
apt-get install -y \
  chromium-browser \
  libx11-xcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxi6 \
  libxtst6 \
  libnss3 \
  libcups2 \
  libxss1 \
  libxrandr2 \
  libasound2 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libpangocairo-1.0-0 \
  libgtk-3-0 \
  libgbm1

# Verify installation
echo ""
echo "Verifying installation..."
if command -v chromium-browser &> /dev/null; then
    echo "✅ Chromium installed successfully at: $(which chromium-browser)"
    chromium-browser --version
else
    echo "❌ Chromium installation failed"
    exit 1
fi

echo ""
echo "=========================================="
echo "Installation complete!"
echo "=========================================="
echo ""
echo "Now restart the backend server:"
echo "  pm2 restart discovery-backend"
