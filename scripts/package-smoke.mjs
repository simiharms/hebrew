// Tests the Mac package end to end: unzips it, runs serve.py and checks the
// app, the server's safety checks, saving progress into the folder, restoring
// it after the browser's data is cleared, a second start taking over, stop,
// a busy port, and the app still opening after the server has stopped.
// Usage: npm run package && node scripts/package-smoke.mjs  (PYTHON=python3.9 to pick a Python)
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const python = process.env.PYTHON ?? 'python3';
const zip = readdirSync('release').find((f) => f.endsWith('.zip'));
const root = mkdtempSync(join(process.env.SHORESH_TEST_DIR ?? tmpdir(), 'shoresh-'));
execFileSync('unzip', ['-q', join('release', zip), '-d', root]);
const dir = join(root, 'Shoresh');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

const children = new Set();
process.on('exit', () => children.forEach((p) => p.kill()));

function startServer() {
  const p = spawn(python, ['serve.py', '--no-browser'], { cwd: dir });
  children.add(p);
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  p.stderr.on('data', (d) => (out += d));
  const exited = new Promise((res) => p.on('exit', (code) => (children.delete(p), res(code))));
  const ready = new Promise((res, rej) => {
    const t = setInterval(() => out.includes('is running') && (clearInterval(t), res()), 50);
    setTimeout(() => (clearInterval(t), rej(new Error(`server did not start:\n${out}`))), 10000);
  });
  return { ready, exited, out: () => out };
}

function http(method, path, { headers = {}, body, port = 8790 } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] ?? '', body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const progressFile = join(dir, 'progress', 'shoresh-progress.json');
const readProgress = () => JSON.parse(readFileSync(progressFile, 'utf8')).state;

// The package itself
check('start/stop are executable', [statSync(join(dir, 'start_shoresh.command')), statSync(join(dir, 'stop_shoresh.command'))].every((s) => s.mode & 0o111));
check('no headlines file', !existsSync(join(dir, 'app', 'news.json')));
check('README has the version', !readFileSync(join(dir, 'README.txt'), 'utf8').includes('{{VERSION}}'));
check('nothing running yet', execFileSync(python, ['serve.py', '--stop'], { cwd: dir }).toString().includes("wasn't running"));

// The server
const a = startServer();
await a.ready;
const js = readdirSync(join(dir, 'app', 'assets')).find((f) => f.endsWith('.js'));
const page = await http('GET', '/');
check('serves the app', page.status === 200 && page.type.startsWith('text/html') && page.body.includes('<div id="app">'));
check('JavaScript has a JS type', (await http('GET', `/assets/${js}`)).type.startsWith('text/javascript'));
check('no folder listings', (await http('GET', '/assets/')).status === 404);
check('nothing outside app/', (await http('GET', '/../serve.py')).status === 404);
const ok = { 'X-Shoresh': '1', 'Content-Type': 'application/json' };
const sample = JSON.stringify({ app: 'shoresh', state: { version: 1, cards: {} } });
check('progress needs the Shoresh header', (await http('GET', '/__shoresh/progress')).status === 403);
check('no progress yet', (await http('GET', '/__shoresh/progress', { headers: ok })).status === 204);
check('other websites cannot save', (await http('PUT', '/__shoresh/progress', { headers: { ...ok, Origin: 'https://evil.example' }, body: sample })).status === 403);
check('other host names are refused', (await http('GET', '/', { headers: { Host: 'evil.example:8790' } })).status === 403);
check('rejects non-Shoresh data', (await http('PUT', '/__shoresh/progress', { headers: ok, body: '{"x":1}' })).status === 400);
check('quit needs the Shoresh header', (await http('POST', '/__shoresh/quit')).status === 403 && (await http('GET', '/')).status === 200);
check('no stray progress file', !existsSync(progressFile));

// The app: first visit, progress lands in the folder
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const newContext = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.setDefaultTimeout(6000);
  return { ctx, p };
};
const first = await newContext();
await first.p.goto('http://localhost:8790/');
await first.p.getByText("Let's set up").click();
await first.p.getByText('Next →').click();
await first.p.getByText(/Start at/).click();
await first.p.evaluate(() => navigator.serviceWorker.ready);
await first.p.waitForTimeout(1800); // debounce + precache
check('progress saved in the folder', existsSync(progressFile) && readProgress().onboarded === true);
await first.p.evaluate(() => (location.hash = '#/me'));
check('settings show the folder copy', await first.p.getByText('in the progress folder inside your Shoresh folder').isVisible());
check('no iPhone install card', !(await first.p.getByText('Install on your iPhone').count()));
check('no AI download offered', !(await first.p.getByText('on-device AI grading').count()));
await first.p.evaluate(() => (location.hash = '#/news'));
await first.p.waitForTimeout(300);
check('no live headlines section', !(await first.p.getByText("Today's real headlines").count()) && (await first.p.getByText('This version never goes online').isVisible()));

// Browser data cleared (a fresh profile): progress comes back from the folder
const fresh = await newContext();
await fresh.p.goto('http://localhost:8790/');
await fresh.p.waitForTimeout(800);
check('restored after clearing browser data', !(await fresh.p.getByText("Let's set up").count()) && (await fresh.p.getByText('Progress restored from the Shoresh folder').isVisible()));
check('daily backup kept', readdirSync(join(dir, 'progress', 'backups')).some((f) => f.startsWith('shoresh-progress-')));

// Starting again takes over from the running copy
const b = startServer();
await b.ready;
check('second start stops the first', (await a.exited) === 0 && a.out().includes('stopped by another start') && b.out().includes('Stopped the Shoresh that was already running'));
check('new copy answers on the same port', JSON.parse((await http('GET', '/__shoresh/info')).body).app === 'shoresh');

// stop_shoresh
const stopOut = execFileSync(python, ['serve.py', '--stop'], { cwd: dir }).toString();
check('stop stops it', stopOut.includes('Shoresh stopped.') && (await b.exited) === 0);

// With the server stopped, the app still opens from the browser's copy
await first.p.reload();
await first.p.waitForTimeout(800);
await first.p.evaluate(() => (location.hash = '#/me'));
await first.p.waitForTimeout(300);
check('opens while stopped, and says so', await first.p.getByText("Shoresh isn't running right now").isVisible());

// Another program on 8790: Shoresh moves to the next port
const blocker = createServer().listen(8790, '127.0.0.1');
await new Promise((r) => blocker.once('listening', r));
const c = startServer();
await c.ready;
check('busy port: uses 8791', c.out().includes('localhost:8791') && JSON.parse((await http('GET', '/__shoresh/info', { port: 8791 })).body).app === 'shoresh');
execFileSync(python, ['serve.py', '--stop'], { cwd: dir });
await c.exited;
blocker.close();

await browser.close();
check('no page errors', !errors.length, errors.join(' | '));
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok || !r.detail ? '' : ` — ${r.detail}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `${failed} failed` : `all ${results.length} passed (${execFileSync(python, ['--version']).toString().trim()})`);
process.exit(failed ? 1 : 0);
