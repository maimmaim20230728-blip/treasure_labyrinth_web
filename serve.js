/* ローカル確認用の簡易サーバ（キャッシュ無効） */
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
const port = Number(process.argv[2]) || 3030;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};
http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { p = '/'; }
  if (p === '/') p = '/index.html';
  const f = path.normalize(path.join(root, p));
  if (!f.startsWith(root) || !fs.existsSync(f) || !fs.statSync(f).isFile()) {
    res.writeHead(404); res.end('404'); return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log('takara-no-meikyu http://localhost:' + port));
