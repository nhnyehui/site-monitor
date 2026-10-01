// ============================================================
// history.js — 지난 점검 기록을 한 화면에서 넘겨보는 뷰어를 만든다.
//   → reports/history.html
//
// 핵심 기능: "어디가 바뀌었는지" 를 바로 보여준다.
//   compare.js 가 만든 diffs/날짜/사이트.png 에서 변경 픽셀이 몰린 세로 구간을 찾아내고,
//   그 구간만 잘라서 전일 / 금일 을 나란히 보여준다.
//   (페이지 전체가 1만 픽셀이 넘어 통째로 보면 어디가 바뀌었는지 찾기 어렵다)
//
// 이미지는 base64 로 박지 않고 파일 경로로 참조한다 → HTML 이 가볍고 빨리 열린다.
// ============================================================
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const RESULT_DIR = 'results';
const OUT = path.join('reports', 'history.html');
const CACHE = path.join(RESULT_DIR, 'bands-cache.json');

// 이 파일은 두 가지로 쓰인다.
//   · 직접 실행 → reports/history.html (로컬용, 이미지를 원본 파일로 참조)
//   · web-history.js 가 require → 같은 화면을 웹용으로 다시 그림 (이미지는 축소본)

// ─── 변경 구간(밴드) 찾기 ───────────────────────────────────
const MIN_ROW_PIXELS = 6;    // 한 행에 변경 픽셀이 이보다 많아야 "변경된 행"
const MERGE_GAP = 60;        // 변경된 행 사이가 이보다 가까우면 한 구간으로 합친다
const MIN_BAND_H = 12;       // 이보다 얇은 구간은 noise 로 버린다
const PAD = 24;              // 구간 위아래 여유 (맥락이 보이게)
const MAX_BANDS = 6;         // 한 사이트당 최대 구간 수

// pixelmatch 가 칠한 변경 픽셀은 빨강(255,0,0) 계열, 안티앨리어싱은 노랑(255,255,0)
function isDiffPixel(d, i) {
  return d[i] > 180 && d[i + 2] < 120;
}

function findBands(diffPath) {
  const png = PNG.sync.read(fs.readFileSync(diffPath));
  const { width: w, height: h, data } = png;

  // 각 행의 변경 픽셀 수와, 변경이 있는 x 범위를 센다
  const rows = new Uint32Array(h);
  const xMin = new Int32Array(h).fill(w);
  const xMax = new Int32Array(h).fill(-1);
  for (let y = 0; y < h; y++) {
    const base = y * w * 4;
    let c = 0, lo = w, hi = -1;
    for (let x = 0; x < w; x++) {
      if (isDiffPixel(data, base + x * 4)) { c++; if (x < lo) lo = x; if (x > hi) hi = x; }
    }
    rows[y] = c; xMin[y] = lo; xMax[y] = hi;
  }

  // 변경된 행들을 이어 붙여 구간으로 만든다
  const bands = [];
  let start = -1, lastHit = -1;
  for (let y = 0; y < h; y++) {
    const hit = rows[y] >= MIN_ROW_PIXELS;
    if (hit) {
      if (start === -1) start = y;
      lastHit = y;
    } else if (start !== -1 && y - lastHit > MERGE_GAP) {
      bands.push([start, lastHit]);
      start = -1;
    }
  }
  if (start !== -1) bands.push([start, lastHit]);

  // 구간별로 픽셀 수를 세고, 변경량이 큰 순서로 추린다
  const out = [];
  for (const [a, b] of bands) {
    if (b - a < MIN_BAND_H) continue;
    let pixels = 0, lo = w, hi = -1;
    for (let y = a; y <= b; y++) {
      pixels += rows[y];
      if (xMax[y] >= 0) { if (xMin[y] < lo) lo = xMin[y]; if (xMax[y] > hi) hi = xMax[y]; }
    }
    out.push({
      top: Math.max(0, a - PAD),
      bottom: Math.min(h - 1, b + PAD),
      left: Math.max(0, lo), right: hi,
      pixels,
    });
  }
  out.sort((p, q) => q.pixels - p.pixels);
  const top = out.slice(0, MAX_BANDS);
  // 전체 변경량에서 각 구간이 차지하는 비중. 비중이 낮은 구간은 대개 세로 밀림에서 온 잡음이라
  // 화면에서 접어두고, 큰 구간만 펼쳐 보여준다.
  const total = top.reduce((a, b) => a + b.pixels, 0) || 1;
  top.forEach(b => { b.share = Math.round((b.pixels / total) * 1000) / 10; });
  top.sort((p, q) => p.top - q.top);   // 화면에는 위에서 아래 순서로
  return { w, h, bands: top };
}

// ─── 분석 결과 캐시 (매번 큰 PNG 를 다시 읽지 않도록) ────────
let cache = {};
try { if (fs.existsSync(CACHE)) cache = JSON.parse(fs.readFileSync(CACHE, 'utf-8')); } catch {}

function bandsFor(diffPath) {
  if (!diffPath || !fs.existsSync(diffPath)) return null;
  const key = diffPath.replace(/\\/g, '/');
  const mtime = fs.statSync(diffPath).mtimeMs;
  if (cache[key] && cache[key].mtime === mtime) return cache[key].data;
  let data = null;
  try { data = findBands(diffPath); } catch (e) { console.error('  구간 분석 실패: ' + key + ' — ' + (e.message || e)); }
  cache[key] = { mtime, data };
  return data;
}

// ─── 지난 결과 모으기 ───────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = p => p ? String(p).replace(/\\/g, '/') : null;
const exists = p => p && fs.existsSync(p);

// 지난 결과를 모아 화면에 필요한 형태로 만든다.
//   limit: 최근 며칠치만 (0 이면 전체)
//   반환되는 이미지 경로는 프로젝트 기준 상대경로("screenshots/...") 이며,
//   화면에 넣을 주소는 renderHtml 의 mapSrc 가 결정한다.
function collect(limit) {
if (!fs.existsSync(RESULT_DIR)) { console.error('results 폴더가 없습니다. 먼저 한 번 실행하세요.'); process.exit(1); }

let files = fs.readdirSync(RESULT_DIR).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
if (files.length === 0) { console.error('점검 기록이 없습니다.'); process.exit(1); }
if (limit > 0) files = files.slice(0, limit);

console.log(files.length + '일치 기록을 정리합니다...');
const days = [];
for (const f of files) {
  let day;
  try { day = JSON.parse(fs.readFileSync(path.join(RESULT_DIR, f), 'utf-8')); } catch { continue; }
  const sites = (day.results || []).map(r => {
    const todaySrc = r.today ? (r.basis === 'region' ? r.today.region : r.today.full) : null;
    const prevSrc = r.prev ? (r.basis === 'region' ? r.prev.region : r.prev.full) : null;
    const item = {
      name: r.name, url: r.url, importance: r.importance,
      status: r.status, changed: !!r.changed, rate: r.changeRate ?? 0,
      err: r.errorMessage || null,
      today: exists(todaySrc) ? norm(todaySrc) : null,
      prev: exists(prevSrc) ? norm(prevSrc) : null,
      diff: exists(r.diff) ? norm(r.diff) : null,
      bands: null,
    };
    // 변경이 감지된 건만 구간을 분석한다 (변경 없는 날은 볼 일이 없다)
    if (r.changed && exists(r.diff) && exists(todaySrc) && exists(prevSrc)) {
      const b = bandsFor(r.diff);
      if (b && b.bands.length) item.bands = b;
    }
    return item;
  });
  days.push({ date: day.date, prevDate: day.prevDate || null, threshold: day.threshold ?? 0.3, sites });
  process.stdout.write('.');
}
console.log('');
return days;
}

function saveCache(){ try { fs.writeFileSync(CACHE, JSON.stringify(cache)); } catch {} }

// ─── HTML 만들기 ────────────────────────────────────────────
// mapSrc: 데이터에 담긴 상대경로를 화면에 넣을 주소로 바꾸는 함수
function renderHtml(days, mapSrc){
const shown = days.map(d => ({ ...d, sites: d.sites.map(s => ({
  ...s, today: mapSrc(s.today), prev: mapSrc(s.prev), diff: mapSrc(s.diff),
})) }));
const payload = JSON.stringify(shown).replace(/</g, '\\u003c');

const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>사이트 변경 히스토리</title>
<style>
  :root{
    --bg:#f5f6f8; --card:#fff; --ink:#1f2328; --muted:#6b7280; --line:#e5e7eb;
    --hit:#d93025; --ok:#188038; --warn:#e8710a; --accent:#1a73e8;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
       font-family:'Malgun Gothic','Apple SD Gothic Neo',system-ui,sans-serif;font-size:14px;line-height:1.5}
  .wrap{max-width:1180px;margin:0 auto;padding:20px 16px 60px}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:var(--muted);font-size:13px;margin-bottom:16px}

  .bar{position:sticky;top:0;z-index:10;background:var(--bg);padding:10px 0 12px;border-bottom:1px solid var(--line);margin-bottom:16px}
  .bar .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  select,button{font:inherit;padding:7px 12px;border:1px solid var(--line);border-radius:8px;background:#fff;cursor:pointer}
  button:hover{border-color:var(--accent);color:var(--accent)}
  button:disabled{opacity:.4;cursor:default}
  .pill{padding:3px 10px;border-radius:999px;font-size:12px;color:#fff;display:inline-block}
  .pill.hit{background:var(--hit)}.pill.ok{background:var(--ok)}.pill.err{background:var(--warn)}.pill.new{background:#888}

  table{width:100%;border-collapse:collapse;background:var(--card);border-radius:10px;overflow:hidden;
        box-shadow:0 1px 3px rgba(0,0,0,.07);margin-bottom:20px}
  th,td{padding:9px 12px;border-bottom:1px solid var(--line);text-align:left}
  th{background:#fafbfc;font-size:12px;color:var(--muted);font-weight:600}
  tr.clickable{cursor:pointer}
  tr.clickable:hover td{background:#f0f6ff}
  td.rate{font-variant-numeric:tabular-nums;font-weight:600}

  .card{background:var(--card);border-radius:10px;padding:16px 18px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.07)}
  .card.hit{border-left:4px solid var(--hit)}
  .card h3{margin:0 0 2px;font-size:15px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .card h3 small{color:var(--muted);font-weight:400;font-size:12px}
  .card .link{font-size:12px;margin:0 0 12px}
  .card .link a{color:var(--accent);text-decoration:none}

  .band{border:1px solid var(--line);border-radius:8px;margin-top:12px;overflow:hidden}
  .band .head{background:#fafbfc;padding:7px 12px;font-size:12px;color:var(--muted);
              display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
  .band .head b{color:var(--ink)}
  .band.faint{opacity:.72}
  details.minor{margin-top:12px}
  details.minor > summary{font-size:12px;color:var(--accent);padding:6px 0}
  .mini .thumb .mark.faint{background:rgba(217,48,37,.18);border-color:rgba(217,48,37,.4)}
  .pair{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line)}
  .pane{background:#fff}
  .pane .cap{font-size:11px;color:var(--muted);padding:5px 10px;border-bottom:1px solid var(--line)}
  .pane .cap.now{color:var(--hit);font-weight:600}
  .cropbox{position:relative;width:100%;height:0;overflow:hidden;background:#fff}
  .cropbox img{position:absolute;left:0;width:100%;display:block}

  .mini{display:flex;gap:12px;align-items:center;margin-top:10px}
  .mini .thumb{position:relative;width:52px;height:210px;flex:0 0 52px;border:1px solid var(--line);border-radius:4px;overflow:hidden;background:#fff}
  .mini .thumb img{width:100%;height:100%;display:block;object-fit:fill}
  .mini .thumb .mark{position:absolute;left:0;right:0;background:rgba(217,48,37,.45);border-top:1px solid var(--hit);border-bottom:1px solid var(--hit)}
  .mini .note{font-size:12px;color:var(--muted);line-height:1.7}
  .mini .note b{color:var(--ink)}

  details{margin-top:12px}
  summary{cursor:pointer;font-size:13px;color:var(--accent)}
  .full{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
  .full figure{margin:0;flex:1;min-width:210px}
  .full figcaption{font-size:11px;color:var(--muted);margin-bottom:4px}
  .full img{width:100%;border:1px solid var(--line);border-radius:6px;max-height:520px;object-fit:cover;object-position:top}

  .empty{color:var(--muted);padding:28px;text-align:center;background:var(--card);border-radius:10px}
  @media (max-width:640px){ .pair{grid-template-columns:1fr} .wrap{padding:16px 12px 40px} }
  @media (prefers-color-scheme:dark){
    :root:not([data-theme="light"]){--bg:#15181c;--card:#1e2227;--ink:#e6e9ee;--muted:#9aa4b2;--line:#2c323a}
    :root:not([data-theme="light"]) th{background:#232830}
    :root:not([data-theme="light"]) tr.clickable:hover td{background:#22303f}
    :root:not([data-theme="light"]) .band .head{background:#232830}
    :root:not([data-theme="light"]) .pane,:root:not([data-theme="light"]) .cropbox,
    :root:not([data-theme="light"]) .mini .thumb{background:#fff}
    :root:not([data-theme="light"]) select,:root:not([data-theme="light"]) button{background:#232830;color:var(--ink)}
  }
</style></head><body><div class="wrap">
  <h1>사이트 변경 히스토리</h1>
  <div class="sub" id="sub"></div>

  <div class="bar"><div class="row">
    <button id="prev">← 이전</button>
    <select id="pick"></select>
    <button id="next">다음 →</button>
    <span style="flex:1"></span>
    <label style="font-size:13px;color:var(--muted)">
      <input type="checkbox" id="onlyHit" checked> 변경된 것만 보기
    </label>
  </div></div>

  <div id="summary"></div>
  <div id="detail"></div>
</div>
<script>
const DAYS = ${payload};
let idx = 0;

const el = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function pill(s){
  if (s.status === 'error') return '<span class="pill err">오류</span>';
  if (s.status === 'first') return '<span class="pill new">첫 실행</span>';
  return s.changed ? '<span class="pill hit">변경</span>' : '<span class="pill ok">없음</span>';
}

// 변경 구간을 잘라 보여준다. 퍼센트 값을 쓰므로 창 크기가 바뀌어도 비율이 유지된다.
function crop(src, b, w){
  const top = (b.top / w) * 100;
  const hgt = ((b.bottom - b.top) / w) * 100;
  return '<div class="cropbox" style="padding-bottom:' + hgt.toFixed(3) + '%">' +
         '<img src="' + esc(src) + '" style="top:-' + top.toFixed(3) + '%">' +
         '</div>';
}

function render(){
  const d = DAYS[idx];
  el('sub').textContent = '전체 ' + DAYS.length + '일치 기록 · 기준일 ' + (d.prevDate || '없음') + ' → ' + d.date +
                          ' · 변경 판정 기준 ' + d.threshold + '% 초과';
  el('prev').disabled = idx >= DAYS.length - 1;
  el('next').disabled = idx <= 0;
  el('pick').value = String(idx);

  const hits = d.sites.filter(s => s.changed).length;
  const errs = d.sites.filter(s => s.status === 'error').length;

  el('summary').innerHTML =
    '<table><tr><th>사이트</th><th style="width:88px">변경</th><th style="width:88px">변경률</th><th style="width:70px">중요도</th></tr>' +
    d.sites.map((s,i) =>
      '<tr class="clickable" data-i="' + i + '"><td>' + esc(s.name) + '</td><td>' + pill(s) + '</td>' +
      '<td class="rate">' + (s.status === 'ok' ? s.rate + '%' : '-') + '</td><td>' + esc(s.importance) + '</td></tr>'
    ).join('') + '</table>';

  const onlyHit = el('onlyHit').checked;
  const list = onlyHit ? d.sites.filter(s => s.changed || s.status === 'error') : d.sites;

  if (!list.length){
    el('detail').innerHTML = '<div class="empty">' + (hits === 0 && errs === 0
      ? '이 날은 변경이 없었습니다.' : '표시할 항목이 없습니다.') + '</div>';
  } else {
    el('detail').innerHTML = list.map(s => card(s, d, d.sites.indexOf(s))).join('');
  }

  document.querySelectorAll('tr.clickable').forEach(tr => tr.onclick = () => {
    const t = document.getElementById('site-' + tr.dataset.i);
    if (t) { t.scrollIntoView({behavior:'smooth', block:'start'}); }
    else { el('onlyHit').checked = false; render(); setTimeout(() => {
      const t2 = document.getElementById('site-' + tr.dataset.i);
      if (t2) t2.scrollIntoView({behavior:'smooth', block:'start'});
    }, 60); }
  });
}

function card(s, d, i){
  let body = '';

  if (s.status === 'error'){
    body = '<p style="color:var(--warn);margin:8px 0 0">⚠️ ' + esc(s.err || '접속 실패') + '</p>';
  } else if (s.bands){
    const w = s.bands.w, H = s.bands.h;
    const MAIN = 15;   // 변경량 비중이 이 값 이상이면 주요 구간으로 보고 펼친다
    const major = s.bands.bands.filter(b => (b.share ?? 100) >= MAIN);
    const minor = s.bands.bands.filter(b => (b.share ?? 100) < MAIN);

    const one = (b, n, faint) => {
      const posPct = Math.round((b.top / H) * 100);
      const hPx = b.bottom - b.top;
      return '<div class="band' + (faint ? ' faint' : '') + '">' +
        '<div class="head"><b>구간 ' + n + '</b>' +
        '<span>페이지 위에서 ' + posPct + '% 지점 · 높이 ' + hPx + 'px · 변경량 ' + (b.share ?? '-') + '%</span></div>' +
        '<div class="pair">' +
          '<div class="pane"><div class="cap">전일 (' + esc(d.prevDate || '') + ')</div>' + crop(s.prev, b, w) + '</div>' +
          '<div class="pane"><div class="cap now">금일 (' + esc(d.date) + ')</div>' + crop(s.today, b, w) + '</div>' +
        '</div></div>';
    };

    const nOf = b => s.bands.bands.indexOf(b) + 1;
    body = major.map(b => one(b, nOf(b), false)).join('');
    if (minor.length) {
      body += '<details class="minor"><summary>미세 변경 ' + minor.length + '건 더 보기 ' +
              '<span style="color:var(--muted)">(대부분 페이지가 위아래로 밀려 생긴 차이입니다)</span></summary>' +
              minor.map(b => one(b, nOf(b), true)).join('') + '</details>';
    }
    if (!major.length) body = '<p style="color:var(--muted);margin:10px 0 0">뚜렷한 변경 구간이 없습니다. 아래 미세 변경을 확인하세요.</p>' + body;

    // 페이지 전체에서 변경 구간이 어디쯤인지 표시하는 작은 지도
    const marks = s.bands.bands.map(b =>
      '<div class="mark' + ((b.share ?? 100) >= 15 ? '' : ' faint') + '" style="top:' + ((b.top/H)*100).toFixed(2) + '%;height:' +
      Math.max(0.8, ((b.bottom-b.top)/H)*100).toFixed(2) + '%"></div>').join('');
    body = '<div class="mini"><div class="thumb"><img src="' + esc(s.today) + '">' + marks + '</div>' +
           '<div class="note"><b>주요 변경 ' + major.length + '곳</b>' + (minor.length ? ' · 미세 ' + minor.length + '곳' : '') + '<br>' +
           '왼쪽 세로 막대가 페이지 전체이고,<br>빨간 띠가 바뀐 위치입니다.<br>' +
           '<span style="color:var(--muted)">전체 높이 ' + H.toLocaleString() + 'px</span></div></div>' + body;
  } else if (s.changed){
    body = '<p style="color:var(--muted);margin:8px 0 0">변경은 감지되었으나 구간을 특정하지 못했습니다. 아래 전체 이미지를 확인하세요.</p>';
  } else {
    body = '<p style="color:var(--muted);margin:8px 0 0">변경 없음</p>';
  }

  const full = (s.prev || s.today || s.diff) ?
    '<details><summary>전체 화면 보기</summary><div class="full">' +
      (s.prev ? '<figure><figcaption>전일</figcaption><a href="' + esc(s.prev) + '" target="_blank"><img src="' + esc(s.prev) + '"></a></figure>' : '') +
      (s.today ? '<figure><figcaption>금일</figcaption><a href="' + esc(s.today) + '" target="_blank"><img src="' + esc(s.today) + '"></a></figure>' : '') +
      (s.diff ? '<figure><figcaption>변경 부위(빨간 점)</figcaption><a href="' + esc(s.diff) + '" target="_blank"><img src="' + esc(s.diff) + '"></a></figure>' : '') +
    '</div></details>' : '';

  return '<div class="card' + (s.changed ? ' hit' : '') + '" id="site-' + i + '">' +
    '<h3>' + pill(s) + esc(s.name) +
    '<small>중요도 ' + esc(s.importance) + (s.status === 'ok' ? ' · 변경률 ' + s.rate + '%' : '') + '</small></h3>' +
    '<p class="link"><a href="' + esc(s.url) + '" target="_blank">' + esc(s.url) + '</a></p>' +
    body + full + '</div>';
}

el('pick').innerHTML = DAYS.map((d,i) => {
  const n = d.sites.filter(s => s.changed).length;
  return '<option value="' + i + '">' + d.date + (n ? '  (변경 ' + n + '건)' : '  (변경 없음)') + '</option>';
}).join('');
el('pick').onchange = e => { idx = +e.target.value; render(); window.scrollTo({top:0}); };
el('prev').onclick = () => { if (idx < DAYS.length-1){ idx++; render(); window.scrollTo({top:0}); } };
el('next').onclick = () => { if (idx > 0){ idx--; render(); window.scrollTo({top:0}); } };
el('onlyHit').onchange = render;
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') el('prev').click();
  if (e.key === 'ArrowRight') el('next').click();
});
render();
</script></body></html>`;

return html;
}

// 직접 실행하면 로컬용 히스토리를 만든다 (이미지는 원본 파일을 그대로 참조)
if (require.main === module) {
  const days = collect(0);
  saveCache();
  const html = renderHtml(days, p => p ? '../' + p : null);
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(OUT, html);
  console.log('히스토리 생성 완료 → ' + OUT + ' (' + Math.round(Buffer.byteLength(html)/1024) + 'KB, ' + days.length + '일치)');
}

module.exports = { collect, renderHtml, saveCache, bandsFor };
