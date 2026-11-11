import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import healthHandler from './api/health.ts';
import protocolsHandler from './api/protocols.ts';
import positionsHandler from './api/positions.ts';
import routeHandler from './api/route.ts';
import prepareHandler from './api/prepare.ts';
import faultTestHandler from './api/fault-test.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // API Routes
  if (pathname === '/api/health') {
    return healthHandler(req, res);
  }
  if (pathname === '/api/protocols') {
    return protocolsHandler(req, res);
  }
  if (pathname === '/api/positions') {
    return positionsHandler(req, res);
  }
  if (pathname === '/api/route') {
    return routeHandler(req, res);
  }
  if (pathname === '/api/prepare') {
    return prepareHandler(req, res);
  }
  if (pathname === '/api/fault-test') {
    return faultTestHandler(req, res);
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[Pharos Multi-Protocol Aggregator] Listening on http://localhost:${PORT}`);
  console.log(`- Health Check: http://localhost:${PORT}/api/health`);
  console.log(`- Protocol Venues: http://localhost:${PORT}/api/protocols`);
  console.log(`- Intelligent Route: http://localhost:${PORT}/api/route?asset=PROS&amount=10&priority=MAX_YIELD`);
});
