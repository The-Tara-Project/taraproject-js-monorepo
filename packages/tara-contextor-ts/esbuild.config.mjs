import { build } from 'esbuild';
import builtinModules from 'builtin-modules';

const isProduction = process.argv.includes('production');

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: !isProduction,
  minify: isProduction,
  external: [
    ...builtinModules,
    ...builtinModules.map(m => `node:${m}`),
    '@jose_pereiro/taralib-js'
  ],
});

console.log(`Build complete (${isProduction ? 'production' : 'development'})`);
