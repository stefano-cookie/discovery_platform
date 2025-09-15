#!/bin/bash

# Script per testare se il proxy API è configurato correttamente

echo "🔍 Testing API proxy configuration..."

# Test 1: Direct backend health check
echo "1. Testing direct backend (port 3010)..."
curl -s -w "Status: %{http_code}\n" "http://localhost:3010/api/health" || echo "❌ Direct backend not responding"

# Test 2: Proxy health check
echo "2. Testing API proxy through nginx..."
curl -s -w "Status: %{http_code}\n" "https://discovery.cfoeducation.it/api/health" || echo "❌ Proxy not working"

# Test 3: Check nginx config
echo "3. Checking nginx configuration..."
if grep -q "location /api/" /etc/nginx/sites-available/discovery.cfoeducation.it 2>/dev/null; then
    echo "✅ API proxy configuration found in nginx"
    grep -A 5 "location /api/" /etc/nginx/sites-available/discovery.cfoeducation.it
else
    echo "❌ API proxy configuration NOT found in nginx"
fi

# Test 4: Check nginx status
echo "4. Checking nginx status..."
systemctl is-active nginx && echo "✅ Nginx is running" || echo "❌ Nginx is not running"

# Test 5: Test specific problematic endpoint
echo "5. Testing contract preview endpoint..."
curl -s -w "Status: %{http_code}\n" "https://discovery.cfoeducation.it/api/partners/preview-contract/test" || echo "❌ Contract preview endpoint not accessible"

echo "🏁 API proxy test completed"