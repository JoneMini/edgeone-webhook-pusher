import * as esbuild from 'esbuild';
import { mkdirSync, existsSync, rmSync } from 'fs';

// Output to .output/node-functions (outside dist, not deployed to EdgeOne)
const OUT_DIR = '../../.output/node-functions';

// Clean and create output directory
if (existsSync(OUT_DIR)) {
  rmSync(OUT_DIR, { recursive: true });
}
mkdirSync(`${OUT_DIR}/send`, { recursive: true });

// Common esbuild options
const commonOptions: esbuild.BuildOptions = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  external: [
    'node:*',
    'fs',
    'path',
    'crypto',
    'http',
    'https',
    'stream',
    'url',
    'util',
    'events',
    'buffer',
    'querystring',
    'net',
    'tls',
    'zlib',
    'os',
  ],
  packages: 'bundle',
  minify: false,
  sourcemap: false,
};

console.log('Building Node Functions...');

// Webhook handler: /send/{sendKey}
await esbuild.build({
  ...commonOptions,
  entryPoints: ['./src/webhook.ts'],
  outfile: `${OUT_DIR}/send/[key].js`,
  banner: {
    js: '// EdgeOne Node Functions - Webhook Handler\n// Route: /send/{sendKey}\n',
  },
});
console.log(`✓ Webhook: .output/node-functions/send/[key].js -> /send/{sendKey}`);

console.log('\nBuild complete!');
