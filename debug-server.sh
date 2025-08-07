#!/bin/bash

# Script per debug del server in produzione
# Da eseguire via SSH sul server

echo "=== Debug Discovery Platform Server ==="
echo ""

# 1. Verifica processi PM2
echo "1. PM2 Processes:"
pm2 list
echo ""

# 2. Verifica logs recenti
echo "2. Recent PM2 Logs:"
pm2 logs discovery-api --lines 30 --nostream
echo ""

# 3. Verifica variabili d'ambiente
echo "3. Environment Variables:"
pm2 env discovery-api | grep -E "FRONTEND_URL|PORT|NODE_ENV|DATABASE_URL"
echo ""

# 4. Verifica directory uploads
echo "4. Upload Directory Structure:"
ls -la /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend/uploads/
echo ""

# 5. Test API endpoint
echo "5. API Health Check:"
curl -s http://localhost:3010/api/health | python3 -m json.tool
echo ""

# 6. Verifica permessi uploads
echo "6. Upload Directory Permissions:"
stat /var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend/uploads/
echo ""

# 7. Verifica spazio disco
echo "7. Disk Space:"
df -h /var/www/vhosts/cfoeducation.it/
echo ""

# 8. Test upload endpoint con curl
echo "8. Testing upload endpoint:"
echo "Creating test file..."
echo "test content" > /tmp/test-upload.txt

curl -X POST http://localhost:3010/api/user/documents \
  -H "Content-Type: multipart/form-data" \
  -F "document=@/tmp/test-upload.txt" \
  -F "type=TEST" \
  -v 2>&1 | head -50

rm /tmp/test-upload.txt
echo ""

# 9. Check nginx configuration
echo "9. Nginx Configuration (relevant parts):"
grep -A 5 -B 5 "discovery" /etc/nginx/sites-enabled/* 2>/dev/null | head -30
echo ""

# 10. Check if backend can write to uploads
echo "10. Write Permission Test:"
UPLOAD_DIR="/var/www/vhosts/cfoeducation.it/discovery.cfoeducation.it/backend/uploads"
if [ -w "$UPLOAD_DIR" ]; then
    echo "✓ Upload directory is writable"
    touch "$UPLOAD_DIR/test-write-$(date +%s).tmp" && echo "✓ Successfully created test file" && rm "$UPLOAD_DIR"/test-write-*.tmp
else
    echo "✗ Upload directory is NOT writable!"
fi
echo ""

echo "=== Debug Complete ==="