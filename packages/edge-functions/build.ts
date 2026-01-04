import * as esbuild from 'esbuild';
import { readdirSync, statSync, mkdirSync, existsSync, rmSync, writeFileSync } from 'fs';
import { join, relative, dirname, basename } from 'path';

const SRC_DIR = './src';
// Output to project root edge-functions directory
const OUT_DIR = '../../edge-functions';

interface EdgeFunctionMeta {
  name: string;
  entry: string;
  routes: string[];
}

// Find all TS files in src directory
function findTsFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findTsFiles(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Convert file path to route pattern
// e.g., api/kv/channels.ts -> /api/kv/channels
function filePathToRoute(relativePath: string): string {
  const withoutExt = relativePath.replace(/\.ts$/, '');
  // Handle index files
  if (withoutExt.endsWith('/index') || withoutExt === 'index') {
    return '/' + withoutExt.replace(/\/index$/, '').replace(/^index$/, '');
  }
  return '/' + withoutExt;
}

// Generate meta.json for edge functions
function generateMeta(sourceFiles: string[]): EdgeFunctionMeta[] {
  const functions: EdgeFunctionMeta[] = [];

  for (const srcFile of sourceFiles) {
    const relativePath = relative(SRC_DIR, srcFile);
    const jsPath = relativePath.replace(/\.ts$/, '.js');
    const route = filePathToRoute(relativePath);
    const name = basename(relativePath, '.ts');

    functions.push({
      name,
      entry: jsPath,
      routes: [route],
    });
  }

  return functions;
}

async function build() {
  // Clean output directory
  if (existsSync(OUT_DIR)) {
    rmSync(OUT_DIR, { recursive: true });
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const sourceFiles = findTsFiles(SRC_DIR);
  console.log(`Building ${sourceFiles.length} edge functions...`);

  for (const srcFile of sourceFiles) {
    const relativePath = relative(SRC_DIR, srcFile);
    const outFile = join(OUT_DIR, relativePath.replace(/\.ts$/, '.js'));

    // Ensure output directory exists
    const outDir = dirname(outFile);
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    await esbuild.build({
      entryPoints: [srcFile],
      outfile: outFile,
      bundle: false,
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      minify: false,
      sourcemap: false,
    });

    console.log(`  ✓ ${relativePath.replace(/\.ts$/, '.js')}`);
  }

  // Generate meta.json
  const meta = generateMeta(sourceFiles);
  const metaPath = join(OUT_DIR, 'meta.json');
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  console.log(`  ✓ meta.json (${meta.length} functions)`);

  console.log('Build complete!');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
