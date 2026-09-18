// Free local preview. Serves only public website assets; no directory listing or proxy.
import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  const fail = code => { res.writeHead(code); res.end(); };
  if (!['GET', 'HEAD'].includes(req.method)) return fail(405);
  try {
    const url = new URL(req.url, 'http://localhost:4173');
    if (!['localhost:4173', '127.0.0.1:4173'].includes(req.headers.host)) return fail(403);
    if (url.pathname === '/') {
      res.writeHead(302, { Location: '/Cyber-Us/comunidade.html' });
      return res.end();
    }
    const pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith('/Cyber-Us/')) return fail(404);
    let relative = pathname.slice('/Cyber-Us/'.length);
    if (!relative) relative = 'index.html';
    if (relative.includes('\\') || relative.split('/').some(part => part.startsWith('.') || part === 'scripts' || part === 'tests')) return fail(404);
    const type = types[path.extname(relative).toLowerCase()];
    if (!type) return fail(404);
    const file = await realpath(path.join(root, relative));
    if (!file.startsWith(root + path.sep)) return fail(404);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { fail(404); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(4173, '127.0.0.1', () => console.log('Preview: http://localhost:4173/Cyber-Us/comunidade.html (local machine only; Ctrl+C to stop)'));
