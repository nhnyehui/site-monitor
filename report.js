// ============================================================
// report.js — 3단계: HTML 리포트 생성 (단순 버전)
// ============================================================
const fs = require('fs');
const path = require('path');
const REPORT_DIR = 'reports';

async function generateComment(r) {
  if (r.status === 'error') return `⚠️ ${r.errorMessage || '접속 실패'} — 사이트 상태 확인 필요`;
  if (r.status === 'first') return '첫 실행 — 다음 실행부터 전일 비교가 시작됩니다';
  if (!r.changed) return '변경 없음';
  if (r.importance === '상') return '🚨 중요도 [상] 변경 감지 — 즉시 확인 필요';
  if (r.changeRate >= 10) return '대규모 변경 감지 — 페이지 개편/오류 가능성, 확인 필요';
  return '변경 감지 — 확인 권장';
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img = p => p ? '../' + esc(p) : '';
function badge(r) {
  if (r.status === 'error') return '<span class="badge orange">오류</span>';
  if (r.status === 'first') return '<span class="badge gray">첫 실행</span>';
  return r.changed ? '<span class="badge red">있음</span>' : '<span class="badge green">없음</span>';
}
function imageBlock(label, src) { return src ? `<figure><figcaption>${label}</figcaption><a href="${src}" target="_blank"><img src="${src}" alt="${label}"></a></figure>` : ''; }
function imagesOf(r) {
  return `<div class="images">
    ${imageBlock('전일', img(r.prev && (r.basis === 'region' ? r.prev.region : r.prev.full)))}
    ${imageBlock('금일', img(r.basis === 'region' ? r.today.region : r.today.full))}
    ${imageBlock('변경 부위(빨간색)', img(r.diff))}
  </div>`;
}
function card(r) {
  const basisLabel = r.basis === 'region' ? '확인영역' : '전체 페이지';
  return `<div class="card"><h3>${badge(r)} ${esc(r.name)} <small>중요도 ${esc(r.importance)} · ${basisLabel} · 변경률 ${r.changeRate}%</small></h3>
    <p><a href="${esc(r.url)}" target="_blank">${esc(r.url)}</a></p>
    <p class="comment">${esc(r.comment)}</p>${r.status === 'ok' ? imagesOf(r) : ''}</div>`;
}
function detailBlock(r) {
  const basisLabel = r.basis === 'region' ? '확인영역' : '전체 페이지';
  return `<details class="card"><summary>${badge(r)} <strong>${esc(r.name)}</strong> <small>중요도 ${esc(r.importance)} · ${basisLabel} · ${r.status === 'ok' ? r.changeRate + '%' : '-'}</small></summary>
    <p><a href="${esc(r.url)}" target="_blank">${esc(r.url)}</a></p>
    <p class="comment">${esc(r.comment)}</p>${r.status === 'ok' ? imagesOf(r) : (r.today && r.today.full ? imagesOf(r) : '')}</details>`;
}

(async () => {
  if (!fs.existsSync('results/latest.json')) { console.error('비교 결과가 없습니다. 먼저 node compare.js 를 실행하세요.'); process.exit(1); }
  const data = JSON.parse(fs.readFileSync('results/latest.json', 'utf-8'));
  for (const r of data.results) r.comment = await generateComment(r);
  const changedList = data.results.filter(r => r.changed || r.status === 'error');
  const changedCount = data.results.filter(r => r.changed).length;

  const tableRows = data.results.map(r => `<tr><td>${esc(r.name)}</td><td><a href="${esc(r.url)}" target="_blank">바로가기</a></td><td>${esc(r.importance)}</td><td>${badge(r)}</td><td>${r.status === 'ok' ? r.changeRate + '%' : '-'}</td><td>${esc(r.comment)}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>사이트 변경 리포트 — ${data.date}</title>
<style>
  body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;margin:0;background:#f5f6f8;color:#222}
  .wrap{max-width:1200px;margin:0 auto;padding:24px}h1{font-size:22px}
  .summary{background:#fff;border-radius:10px;padding:16px 20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .summary strong.red{color:#d93025}
  .badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;color:#fff;vertical-align:middle}
  .badge.red{background:#d93025}.badge.green{background:#188038}.badge.gray{background:#888}.badge.orange{background:#e8710a}
  .card{background:#fff;border-radius:10px;padding:16px 20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .card h3{margin:0 0 6px}.card h3 small,.card summary small{color:#888;font-weight:normal;font-size:13px}
  .card .comment{background:#fff8e1;border-left:4px solid #f4b400;padding:8px 12px;font-size:14px}
  details.card summary{cursor:pointer;font-size:15px;padding:2px 0}details.card summary:hover{color:#1a73e8}
  .images{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px}
  .images figure{margin:0;flex:1;min-width:220px;max-width:32%}
  .images figcaption{font-size:13px;color:#666;margin-bottom:4px}
  .images img{width:100%;border:1px solid #ddd;border-radius:6px;max-height:520px;object-fit:cover;object-position:top}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  th,td{padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:left}th{background:#fafafa}
</style></head><body><div class="wrap">
  <h1>📋 사이트 변경 리포트 <small>${data.date}</small></h1>
  <div class="summary">기준일: <strong>${data.prevDate || '없음(첫 실행)'}</strong> → <strong>${data.date}</strong> · 전체 <strong>${data.results.length}</strong>개 중 변경 <strong class="red">${changedCount}</strong>건 (판단 기준: 변경률 ${data.threshold}% 초과)</div>
  <h2>변경/확인 필요 사이트 (${changedList.length})</h2>
  ${changedList.length ? changedList.map(card).join('') : '<div class="card">✅ 변경된 사이트가 없습니다.</div>'}
  <h2>전체 현황</h2>
  <table><tr><th>사이트명</th><th>URL</th><th>중요도</th><th>변경</th><th>변경률</th><th>코멘트</th></tr>${tableRows}</table>
  <h2>사이트별 상세 <small style="font-size:13px;color:#888;font-weight:normal">— 클릭하면 전일/금일/변경부위를 볼 수 있습니다</small></h2>
  ${data.results.map(detailBlock).join('')}
  <p style="color:#999;font-size:12px">이미지를 클릭하면 원본 크기로 볼 수 있습니다. · site-monitor 자동 생성</p>
</div></body></html>`;

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, `${data.date}.html`), html);
  fs.writeFileSync(path.join(REPORT_DIR, 'index.html'), html);
  console.log(`리포트 생성 완료 → ${REPORT_DIR}/index.html (변경 ${changedCount}건)`);
})();
