// Builds the Mac package: the app, a small local web server (offline/serve.py)
// and double-click starters in one folder, zipped as release/Shoresh-mac-<date>.zip.
// Usage: npm run package (builds dist-offline first).
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const date = new Date().toISOString().slice(0, 10);
const version = `${pkg.version.replace(/\.0$/, '')} (${date})`;
const dir = 'release/Shoresh';

if (!existsSync('dist-offline/index.html')) throw new Error('Run `vite build --mode offline` first.');
rmSync('release', { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

cpSync('dist-offline', `${dir}/app`, { recursive: true });
rmSync(`${dir}/app/news.json`, { force: true }); // live headlines are for the hosted app only

const serve = readFileSync('offline/serve.py', 'utf8');
if (!serve.includes('VERSION = "dev"')) throw new Error('serve.py: VERSION line not found');
writeFileSync(`${dir}/serve.py`, serve.replace('VERSION = "dev"', `VERSION = "${version}"`));
writeFileSync(`${dir}/README.txt`, readFileSync('offline/README.txt', 'utf8').replaceAll('{{VERSION}}', version));
for (const f of ['start_shoresh.command', 'stop_shoresh.command']) {
  cpSync(`offline/${f}`, `${dir}/${f}`);
  chmodSync(`${dir}/${f}`, 0o755);
}

// zip keeps the executable bit, so the .command files open with a double-click.
const zip = `Shoresh-mac-${date}.zip`;
execFileSync('zip', ['-r', '-X', '-q', zip, 'Shoresh'], { cwd: 'release' });
console.log(`release/${zip}`);
