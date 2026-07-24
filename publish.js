// ============================================================
// publish.js — 4단계: 웹용 자체완결 리포트 생성 (이미지 축소 후 파일 하나에 포함)
//   → docs/index.html (최신) + docs/YYYY-MM-DD.html (보관)
//   GitHub Pages(main /docs)로 올리면 링크 하나로 이미지까지 웹에서 바로 보임
// ============================================================
const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const DOCS = 'docs';
const IMG_WIDTH = 480;      // 웹 리포트용 축소 폭
const JPEG_QUALITY = 60;

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function embed(relPath) {
  if (!relPath || !fs.existsSync(relPath)) return '';
  try {
    const img = await Jimp.read(relPath);
    if (img.bitmap.width > IMG_WIDTH) img.resize({ w: IMG_WIDTH });
    const buf = await img.getBuffer('image/jpeg', { quality: JPEG_QUALITY });
    return 'data:image/jpeg;base64,' + buf.toString('base64');
  } catch { return ''; }
}
function comment(r) {
  if (r.status === 'error') return '⚠️ ' + (r.errorMessage || '접속 실패') + ' — 확인 필요';
  if (r.status === 'first') return '첫 실행 — 다음 실행부터 비교';
  if (!r.changed) return '변경 없음';
  if (r.importance === '상') return '🚨 중요도[상] 변경 감지 — 즉시 확인';
  return '변경 감지 — 확인 권장';
}
function badge(r) {
  if (r.status === 'error') return '<span class="b orange">오류</span>';
  if (r.status === 'first') return '<span class="b gray">첫 실행</span>';
  return r.changed ? '<span class="b red">있음</span>' : '<span class="b green">없음</span>';
}
function fig(label, src) { return src ? `<figure><figcaption>${label}</figcaption><img src="${src}" alt="${label}"></figure>` : ''; }

(async () => {
  if (!fs.existsSync('results/latest.json')) { console.error('결과 없음 — 먼저 compare.js 실행'); process.exit(1); }
  const data = JSON.parse(fs.readFileSync('results/latest.json', 'utf-8'));

  // 사이트별 이미지 임베드 (변경/오류/첫실행은 전일·금일·변경부위, 변경없음은 금일만 → 용량 절약)
  const blocks = [];
  for (const r of data.results) {
    const todaySrc = r.basis === 'region' ? (r.today && r.today.region) : (r.today && r.today.full);
    let imgs = '';
    if (r.status === 'ok' && (r.changed)) {
      const prevSrc = r.prev ? (r.basis === 'region' ? r.prev.region : r.prev.full) : null;
      imgs = `<div class="imgs">${fig('전일', await embed(prevSrc))}${fig('금일', await embed(todaySrc))}${fig('변경 부위', await embed(r.diff))}</div>`;
    } else if (todaySrc) {
      imgs = `<div class="imgs">${fig('금일', await embed(todaySrc))}</div>`;
    }
    blocks.push({ r, imgs });
  }

  const changedCount = data.results.filter(r => r.changed).length;
  const rows = data.results.map(r => `<tr><td>${esc(r.name)}</td><td><a href="${esc(r.url)}" target="_blank">열기</a></td><td>${esc(r.importance)}</td><td>${badge(r)}</td><td>${r.status === 'ok' ? r.changeRate + '%' : '-'}</td><td>${esc(comment(r))}</td></tr>`).join('');

  // 변경/오류 먼저, 그다음 나머지
  const order = [...blocks].sort((a, b) => {
    const rank = x => x.r.changed ? 0 : x.r.status === 'error' ? 1 : x.r.status === 'first' ? 2 : 3;
    return rank(a) - rank(b);
  });
  const cards = order.map(({ r, imgs }) => `
    <div class="card${r.changed ? ' hit' : ''}">
      <h3>${badge(r)} ${esc(r.name)} <small>중요도 ${esc(r.importance)} · ${r.basis === 'region' ? '확인영역' : '전체'} · ${r.status === 'ok' ? r.changeRate + '%' : '-'}</small></h3>
      <p><a href="${esc(r.url)}" target="_blank">${esc(r.url)}</a></p>
      <p class="cmt">${esc(comment(r))}</p>${imgs}
    </div>`).join('');

  // docs 폴더의 과거 리포트 목록(달력식 링크)
  fs.mkdirSync(DOCS, { recursive: true });
  const past = fs.readdirSync(DOCS).filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f)).sort().reverse();
  const historyLinks = past.slice(0, 30).map(f => `<a href="${f}">${f.replace('.html', '')}</a>`).join(' · ');

  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>사이트 변경 리포트 ${data.date}</title><style>
  body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;margin:0;background:#f5f6f8;color:#222}
  .wrap{max-width:1100px;margin:0 auto;padding:20px}h1{font-size:22px}
  .sum{background:#fff;border-radius:10px;padding:14px 18px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .sum .red{color:#d93025;font-weight:bold}
  .hist{font-size:13px;color:#555;margin:10px 0}.hist a{color:#1a73e8;text-decoration:none}
  .b{display:inline-block;padding:2px 9px;border-radius:11px;font-size:12px;color:#fff}
  .b.red{background:#d93025}.b.green{background:#188038}.b.gray{background:#888}.b.orange{background:#e8710a}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:18px}
  th,td{padding:9px 11px;border-bottom:1px solid #eee;font-size:14px;text-align:left}th{background:#fafafa}
  .card{background:#fff;border-radius:10px;padding:14px 18px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .card.hit{border-left:5px solid #d93025}
  .card h3{margin:0 0 4px;font-size:16px}.card h3 small{color:#888;font-weight:normal;font-size:12px}
  .cmt{background:#fff8e1;border-left:4px solid #f4b400;padding:6px 10px;font-size:13px;margin:6px 0}
  .imgs{display:flex;gap:10px;flex-wrap:wrap}
  .imgs figure{margin:0;flex:1;min-width:200px;max-width:32%}
  .imgs figcaption{font-size:12px;color:#666;margin-bottom:3px}
  .imgs img{width:100%;border:1px solid #ddd;border-radius:6px;max-height:600px;object-fit:cover;object-position:top}
</style></head><body><div class="wrap">
  <h1>📋 사이트 변경 리포트 <small>${data.date}</small></h1>
  <div class="sum">기준일 <strong>${data.prevDate || '없음'}</strong> → <strong>${data.date}</strong> · 전체 <strong>${data.results.length}</strong>개 중 변경 <span class="red">${changedCount}</span>건 (기준 ${data.threshold}% 초과)
  <div class="hist">지난 리포트: ${historyLinks || '없음'}</div></div>
  <table><tr><th>사이트명</th><th>URL</th><th>중요도</th><th>변경</th><th>변경률</th><th>코멘트</th></tr>${rows}</table>
  ${cards}
  <p style="color:#999;font-size:12px">site-monitor 자동 생성 · 이미지는 웹 표시용으로 축소되었습니다(원본은 구글 드라이브)</p>
</div></body></html>`;

  fs.writeFileSync(path.join(DOCS, 'index.html'), html);
  fs.writeFileSync(path.join(DOCS, `${data.date}.html`), html);
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  console.log(`웹 리포트 생성 완료 → ${DOCS}/index.html (${kb}KB)`);
})();
