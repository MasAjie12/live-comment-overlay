/**
 * Halaman overlay untuk OBS (Browser Source). Satu berkas HTML mandiri: latar transparan, hanya komentar,
 * tanpa tombol. Semua isi komentar dipasang lewat textContent / node teks (tidak pernah innerHTML), dan gambar
 * emoji hanya dari alamat https.
 *
 * Parameter URL (semuanya opsional):
 *   size   ukuran huruf dalam px (8-120, default 22)
 *   lines  jumlah baris maksimum (1-50, default 8)
 *   fade   komentar hilang setelah N detik (0 = tidak hilang, default 0)
 *   tag    auto | on | off  penanda sumber (default auto: tampil bila dua platform aktif)
 *   tagstyle  text | logo  bentuk penanda sumber: teks TT/YT atau logo TikTok/YouTube (default text)
 *   bg     1 = baris berlatar gelap semi-transparan (default 0)
 *   align  bottom | top  posisi daftar (default bottom)
 *   badges 0 = sembunyikan badge level gift dan badge team (default 1)
 *
 * Catatan penulisan: skrip di bawah sengaja tanpa backtick dan tanpa tanda dolar-kurung-kurawal agar aman
 * berada di dalam template literal TypeScript.
 */
// Logo disederhanakan dari path publik (Simple Icons, 24x24). Nama dan logo TikTok / YouTube milik pemiliknya masing-masing.
const TIKTOK_PATH =
  'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z'
const YOUTUBE_PATH =
  'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z'

export function overlayHtml(nonce: string): string {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Live Comment Overlay</title>
<style nonce="${nonce}">
html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
body { font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif; font-size: var(--fs, 22px); line-height: 1.3; color: #fff; }
#list { position: fixed; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 8px 10px; box-sizing: border-box; }
body.top #list { justify-content: flex-start; }
.row { margin: 3px 0; overflow-wrap: anywhere; text-shadow: 0 0 3px #000, 0 0 6px #000, 1px 1px 2px #000; transition: opacity 0.4s ease; }
.row.out { opacity: 0; }
body.bg .row { background: rgba(0, 0, 0, 0.55); border-radius: 8px; padding: 3px 9px; text-shadow: none; width: fit-content; max-width: 100%; box-sizing: border-box; }
.name { font-weight: 700; margin-right: 6px; }
.tag { display: none; font-size: 0.6em; font-weight: 800; border-radius: 4px; padding: 0 4px; margin-right: 5px; vertical-align: 0.15em; text-shadow: none; }
body.tags .tag { display: inline-block; }
.tag-logo { background: none; padding: 0; width: 1.15em; height: 1.15em; vertical-align: -0.2em; }
.tag-logo svg { width: 100%; height: 100%; display: block; }
.tag-tiktok { background: #25f4ee; color: #06222b; }
.tag-youtube { background: #ff3030; color: #fff; }
.tag-logo.tag-tiktok, .tag-logo.tag-youtube { background: none; }
.lv { display: inline-block; font-size: 0.6em; font-weight: 800; border-radius: 4px; padding: 0 5px; margin-right: 5px; background: #6b5bd6; color: #fff; vertical-align: 0.1em; text-shadow: none; }
.team { position: relative; display: inline-block; width: 1.5em; height: 1.4em; vertical-align: -0.32em; margin-right: 4px; color: #ff8a3d; }
.team svg { width: 100%; height: 100%; display: block; }
.team b { position: absolute; left: 0; top: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; padding-bottom: 0.12em; font-size: 0.62em; font-weight: 800; color: #fff; text-shadow: none; }
.team-2 b { font-size: 0.5em; }
.emoji { width: 1.35em; height: 1.35em; vertical-align: -0.3em; margin: 0 1px; }
.amt { font-weight: 800; margin-right: 6px; color: #ffb84d; }
.row.paid { border-left: 4px solid #ffb84d; padding-left: 8px; }
.row.paid-member { border-left-color: #4cd694; }
.row.paid-member .amt { color: #4cd694; }
.row.paid-gift { border-left-color: #c77dff; }
.row.paid-gift .amt { color: #c77dff; }
.row.k-gift { border-left: 4px solid #c77dff; padding-left: 8px; }
.row.k-gift .txt { color: #e6c9ff; font-weight: 700; }
.row.k-follow { border-left: 4px solid #4cc9f0; padding-left: 8px; }
.row.k-share { border-left: 4px solid #ffb84d; padding-left: 8px; }
.row.k-follow .txt, .row.k-share .txt { opacity: 0.85; }
</style>
</head>
<body>
<div id="list"></div>
<script nonce="${nonce}">
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  var token = q.get('token') || '';
  function num(name, def, min, max) {
    var v = parseFloat(q.get(name));
    if (!isFinite(v)) return def;
    return Math.min(max, Math.max(min, v));
  }
  var size = num('size', 22, 8, 120);
  var maxLines = Math.round(num('lines', 8, 1, 50));
  var fadeMs = num('fade', 0, 0, 3600) * 1000;
  var tagParam = q.get('tag');
  var tagMode = tagParam === 'on' || tagParam === 'off' ? tagParam : 'auto';
  var badges = q.get('badges') !== '0';
  var tagLogo = q.get('tagstyle') === 'logo';
  var TIKTOK_PATH = '${TIKTOK_PATH}';
  var YOUTUBE_PATH = '${YOUTUBE_PATH}';
  var body = document.body;
  document.documentElement.style.setProperty('--fs', size + 'px');
  if (q.get('bg') === '1') body.classList.add('bg');
  if (q.get('align') === 'top') body.classList.add('top');
  if (tagMode === 'on') body.classList.add('tags');

  var list = document.getElementById('list');
  var seenPlatform = { tiktok: false, youtube: false };
  var seenIds = {};
  var seenOrder = [];

  function colorOf(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 'hsl(' + (h % 360) + ', 75%, 72%)';
  }
  function httpsUrl(u) {
    return typeof u === 'string' && u.indexOf('https://') === 0 ? u : '';
  }
  function span(cls, text) {
    var e = document.createElement('span');
    e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function paidText(p) {
    if (p.kind === 'member') return 'Member baru';
    if (p.kind === 'gift') return p.amount ? 'Gift ' + p.amount : 'Gift';
    if (p.kind === 'sticker') return p.amount ? 'Sticker ' + p.amount : 'Sticker';
    return p.amount || 'Super Chat';
  }
  function heart(level) {
    var w = span('team' + (level >= 10 ? ' team-2' : ''));
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 22');
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M12 21S4 15.8 4 10a4.6 4.6 0 0 1 8-3.1A4.6 4.6 0 0 1 20 10c0 5.8-8 11-8 11z');
    p.setAttribute('fill', 'currentColor');
    svg.appendChild(p);
    w.appendChild(svg);
    var b = document.createElement('b');
    b.textContent = String(level);
    w.appendChild(b);
    return w;
  }
  function svgPath(d, fill, transform, evenodd) {
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', fill);
    if (transform) p.setAttribute('transform', transform);
    if (evenodd) p.setAttribute('fill-rule', 'evenodd');
    return p;
  }
  function tagEl(platform) {
    if (!tagLogo) return span('tag tag-' + platform, platform === 'tiktok' ? 'TT' : 'YT');
    var w = span('tag tag-logo tag-' + platform);
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    if (platform === 'youtube') svg.appendChild(svgPath(YOUTUBE_PATH, '#ff0000', '', true));
    else {
      svg.appendChild(svgPath(TIKTOK_PATH, '#25f4ee', 'translate(-0.8 -0.6)', false));
      svg.appendChild(svgPath(TIKTOK_PATH, '#fe2c55', 'translate(0.8 0.6)', false));
      svg.appendChild(svgPath(TIKTOK_PATH, '#ffffff', '', false));
    }
    w.appendChild(svg);
    return w;
  }
  function emojiImg(part) {
    var u = httpsUrl(part.url);
    if (!u) return null;
    var im = document.createElement('img');
    im.className = 'emoji';
    im.src = u;
    im.alt = part.alt || '';
    im.referrerPolicy = 'no-referrer';
    im.onerror = function () { im.style.display = 'none'; };
    return im;
  }
  function build(r) {
    var el = document.createElement('div');
    el.className = 'row k-' + r.kind + (r.paid ? ' paid paid-' + r.paid.kind : '');
    el.appendChild(tagEl(r.platform));
    if (badges && r.level) el.appendChild(span('lv', String(r.level)));
    if (badges && r.team) el.appendChild(heart(r.team));
    var name = span('name', r.nick || '');
    name.style.color = colorOf(r.user || r.nick || '');
    el.appendChild(name);
    if (r.paid) el.appendChild(span('amt', paidText(r.paid)));
    var txt = span('txt');
    if (r.kind === 'follow') txt.textContent = 'mulai mengikuti';
    else if (r.kind === 'share') txt.textContent = 'membagikan live';
    else if (r.parts && r.parts.length) {
      for (var i = 0; i < r.parts.length; i++) {
        var part = r.parts[i];
        if (part.t === 'emoji') {
          var im = emojiImg(part);
          if (im) txt.appendChild(im);
        } else {
          txt.appendChild(document.createTextNode(String(part.v || '')));
        }
      }
    } else txt.textContent = r.text || '';
    el.appendChild(txt);
    return el;
  }
  function removeRow(el) {
    if (!el.parentNode) return;
    el.classList.add('out');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 400);
  }
  function add(r) {
    if (!r || seenIds[r.id]) return;
    seenIds[r.id] = 1;
    seenOrder.push(r.id);
    if (seenOrder.length > 600) delete seenIds[seenOrder.shift()];
    var remaining = 0;
    if (fadeMs > 0) {
      remaining = fadeMs - (Date.now() - r.t);
      if (remaining <= 0) return;
    }
    seenPlatform[r.platform] = true;
    var el = build(r);
    list.appendChild(el);
    while (list.children.length > maxLines) list.removeChild(list.firstChild);
    if (fadeMs > 0) setTimeout(function () { removeRow(el); }, remaining);
  }
  function updateTags() {
    if (tagMode !== 'auto') return;
    if (seenPlatform.tiktok && seenPlatform.youtube) body.classList.add('tags');
    else body.classList.remove('tags');
  }

  var es = new EventSource('/events?token=' + encodeURIComponent(token));
  es.onmessage = function (ev) {
    var rows;
    try { rows = JSON.parse(ev.data); } catch (e) { return; }
    if (!Array.isArray(rows)) return;
    for (var i = 0; i < rows.length; i++) add(rows[i]);
    updateTags();
  };
})();
</script>
</body>
</html>`
}
