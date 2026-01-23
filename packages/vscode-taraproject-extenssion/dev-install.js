#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const PKG_PATH = path.join(ROOT, 'package.json');

function run(cmd, opts = {}) {
    console.log(`\n> ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function main() {
    // Read package.json to get version
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
    const vsixName = `${pkg.name}-${pkg.version}.vsix`;
    const vsixPath = path.join(ROOT, "dist", vsixName);

    console.log('=== Tara Reader Dev Install ===\n');

    // 1. Build
    console.log('[1/4] Building...');
    run('npm run build');

    // 2. Remove old vsix if exists
    console.log('\n[2/4] Cleaning old package...');
    const oldVsix = fs.readdirSync(ROOT).filter(f => f.endsWith('.vsix'));
    for (const f of oldVsix) {
        fs.unlinkSync(path.join(ROOT, f));
        console.log(`  Removed: ${f}`);
    }

    // 3. Package (--no-dependencies since we bundle with esbuild)
    console.log('\n[3/4] Packaging extension...');
    run('npx @vscode/vsce package --allow-missing-repository --no-dependencies');

    // 4. Install
    console.log('\n[4/4] Installing in VS Code...');
    run(`code --install-extension "${vsixPath}"`);

    console.log('\n=== Done! ===');
    console.log('Reload VS Code: Cmd+Shift+P → "Developer: Reload Window"');

    // // 5. Delete vsix
    // console.log('\nCleaning up package file...');
    // fs.unlinkSync(vsixPath);
    // console.log('Removed package file.');
}

main();
