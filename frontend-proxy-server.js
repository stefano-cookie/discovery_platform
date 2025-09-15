const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// API Proxy - redirect all /api requests to backend
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:3010',
  changeOrigin: true,
  logLevel: 'warn',
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).send('Backend not available');
  }
}));

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'build')));

// Handle React routing - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server with API proxy running on port ${PORT}`);
  console.log(`Proxying /api/* requests to http://localhost:3010`);
});