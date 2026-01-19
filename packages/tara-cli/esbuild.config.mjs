import { build } from 'esbuild';
import builtinModules from 'builtin-modules';

const isProduction = process.argv.includes('production');

await build({
  entryPoints: ['src/cli.ts'],
  outfile: 'dist/cli.js',
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: !isProduction,
  minify: isProduction,
  banner: {
    js: '#!/usr/bin/env node'
  },
  external: [
    ...builtinModules,
    ...builtinModules.map(m => `node:${m}`)
  ],
});

console.log(`Build complete (${isProduction ? 'production' : 'development'})`);
