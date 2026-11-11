import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const API_DIR = path.join(ROOT_DIR, 'api');

console.log('[Build] Starting Pharos Multi-Protocol Aggregator build...');

if (!fs.existsSync(API_DIR)) {
  fs.mkdirSync(API_DIR, { recursive: true });
}

// Bundle API endpoints for Vercel serverless functions
try {
  console.log('[Build] Bundling API endpoints via esbuild...');
  execSync(
    'npx esbuild src/api/*.ts --bundle --platform=node --format=esm --target=node20 --outdir=api',
    { cwd: ROOT_DIR, stdio: 'inherit' }
  );
  console.log('[Build] Serverless API functions bundled successfully into api/');
} catch (err: any) {
  console.error('[Build] esbuild error:', err.message);
  process.exit(1);
}

console.log('[Build] Build complete.');
