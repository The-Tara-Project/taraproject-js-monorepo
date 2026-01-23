import { build } from 'esbuild';
import builtinModules from 'builtin-modules';

const isProduction = process.argv.includes('production');

await build({
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    sourcemap: !isProduction,
    minify: isProduction,
    external: [
        'vscode', // VS Code API is provided at runtime
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`)
    ],
});

console.log(`Build complete (${isProduction ? 'production' : 'development'})`);
