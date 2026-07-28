// ============================================================
// compare.js — 2단계: 전일/금일 비교
//  - 모션마스크(스스로 움직이는 영역) 자동 제외
//  - 세로 밀림 보정(±19px)
// ============================================================
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

const SCREENSHOT_DIR = 'screenshots';
const DIFF_DIR = 'diffs';
const RESULT_DIR = 'results';
const CHANGE_THRESHOLD = 0.3;   // 변경률(%) 이 값 초과면 변경
const PIXEL_SENSITIVITY = 0.1;

function todayKST() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); }
function findPrevDate(today) {
  if (!fs.existsSync(SCREENSHOT_DIR)) return null;
  const dates = fs.readdirSync(SCREENSHOT_DIR).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n) && n < today).sort();
  return dates.length ? dates[dates.length - 1] : null;
}
// 예전 형식 호환
function getFull(s) { return s ? (s.full || (s.fulls && s.fulls[0]) || null) : null; }
function getRegion(s) { return s ? (s.region || (s.regions && s.regions[0]) || null) : null; }
function getMotion(s) { return s ? (s.motion || null) : null; }

function padTo(img, w, h) { if (img.width === w && img.height === h) return img; const o = new PNG({ width: w, height: h }); PNG.bitblt(img, o, 0, 0, img.width, img.height, 0, 0); return o; }

// 마스크 PNG → {data:Uint8(1=움직임), w, h}
function loadMask(p) {
  if (!p || !fs.existsSync(p)) return null;
  try { const img = PNG.sync.read(fs.readFileSync(p)); const m = new Uint8Array(img.width * img.height); for (let i = 0; i < m.length; i++) m[i] = img.data[i * 4] > 127 ? 1 : 0; return { data: m, w: img.width, h: img.height }; }
  catch { return null; }
}
function unionMask(a, b) {
  if (!a) return b; if (!b) return a;
  const w = Math.max(a.w, b.w), h = Math.max(a.h, b.h); const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const av = (x < a.w && y < a.h) && a.data[y * a.w + x]; const bv = (x < b.w && y < b.h) && b.data[y * b.w + x]; if (av || bv) m[y * w + x] = 1; }
  return { data: m, w, h };
}
function moving(mask, x, y) { return mask && x < mask.w && y < mask.h && mask.data[y * mask.w + x] === 1; }

function shiftBy(aData, bImg, w, h, dy) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) { const sy = y - dy; for (let x = 0; x < w; x++) { const di = (y * w + x) * 4; if (sy >= 0 && sy < h) { const si = (sy * w + x) * 4; out[di] = bImg.data[si]; out[di + 1] = bImg.data[si + 1]; out[di + 2] = bImg.data[si + 2]; out[di + 3] = bImg.data[si + 3]; } else { out[di] = aData[di]; out[di + 1] = aData[di + 1]; out[di + 2] = aData[di + 2]; out[di + 3] = aData[di + 3]; } } }
  return out;
}
// 움직이는 픽셀은 제외하고 차이 픽셀 수 (오프셋 탐색용)
function fastCount(aData, bData, w, h, tol, mask) {
  let c = 0;
  for (let p = 0; p < w * h; p++) {
    if (mask && mask.data[p]) continue;
    const j = p * 4;
    if (Math.abs(aData[j] - bData[j]) + Math.abs(aData[j + 1] - bData[j + 1]) + Math.abs(aData[j + 2] - bData[j + 2]) > tol) c++;
  }
  return c;
}

function compareImages(prevPath, todayPath, diffPath, maskInfo) {
  let a = PNG.sync.read(fs.readFileSync(prevPath));
  let b = PNG.sync.read(fs.readFileSync(todayPath));
  const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
  a = padTo(a, w, h); b = padTo(b, w, h);
  // 마스크를 (w,h)에 맞춘 평면 배열로
  let flatMask = null;
  if (maskInfo) { flatMask = { data: new Uint8Array(w * h), w, h }; for (let y = 0; y < Math.min(h, maskInfo.h); y++) for (let x = 0; x < Math.min(w, maskInfo.w); x++) if (maskInfo.data[y * maskInfo.w + x]) flatMask.data[y * w + x] = 1; }
  // 밀림 보정: 1차 넓게(±16,4칸) → 2차 미세(±3,1칸), 움직임 제외하고 탐색
  let bestDy = 0, bestCount = Infinity; const tried = new Set();
  const ev = (dy) => { if (tried.has(dy)) return; tried.add(dy); const s = shiftBy(a.data, b, w, h, dy); const c = fastCount(a.data, s, w, h, 90, flatMask); if (c < bestCount) { bestCount = c; bestDy = dy; } };
  for (let dy = -16; dy <= 16; dy += 4) ev(dy);
  const coarse = bestDy; for (let dy = coarse - 3; dy <= coarse + 3; dy++) ev(dy);
  const bAligned = shiftBy(a.data, b, w, h, bestDy);
  // 움직이는 영역은 두 이미지를 같게 만들어 비교에서 제외
  let ignored = 0;
  if (flatMask) { for (let p = 0; p < w * h; p++) { if (flatMask.data[p]) { const i = p * 4; bAligned[i] = a.data[i]; bAligned[i + 1] = a.data[i + 1]; bAligned[i + 2] = a.data[i + 2]; bAligned[i + 3] = a.data[i + 3]; ignored++; } } }
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(a.data, bAligned, diff.data, w, h, { threshold: PIXEL_SENSITIVITY });
  fs.mkdirSync(path.dirname(diffPath), { recursive: true });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  const denom = (w * h) - ignored;
  return denom > 0 ? Math.round((n / denom) * 100 * 100) / 100 : 0;
}

(async () => {
  const today = todayKST();
  const todayMetaPath = path.join(SCREENSHOT_DIR, today, 'meta.json');
  if (!fs.existsSync(todayMetaPath)) { console.error('오늘 스크린샷이 없습니다. 먼저 node monitor.js 를 실행하세요.'); process.exit(1); }
  const todayMeta = JSON.parse(fs.readFileSync(todayMetaPath, 'utf-8'));

  // 이번 한 번만 기준일 지정(baseline-once.txt) — 사용 후 자동 삭제
  let prevDate;
  const onceFile = 'baseline-once.txt';
  if (fs.existsSync(onceFile)) { prevDate = fs.readFileSync(onceFile, 'utf-8').replace(/^﻿/, '').trim(); try { fs.unlinkSync(onceFile); } catch {} console.log('※ 이번만 기준일 지정 → ' + prevDate); }
  else prevDate = findPrevDate(today);

  let prevMeta = null;
  try { if (prevDate) prevMeta = JSON.parse(fs.readFileSync(path.join(SCREENSHOT_DIR, prevDate, 'meta.json'), 'utf-8')); } catch {}

  const results = [];
  for (const site of todayMeta.sites) {
    const r = { id: site.id, name: site.name, url: site.url, importance: site.importance, status: 'ok', changed: false, changeRate: 0, basis: 'full', today: { full: getFull(site), region: getRegion(site) }, prev: null, diff: null, errorMessage: null };
    try {
      const prevSite = prevMeta ? prevMeta.sites.find(s => s.id === site.id) : null;
      if (site.error) { r.status = 'error'; r.errorMessage = site.error; }
      else if (!prevSite || prevSite.error || !getFull(prevSite)) { r.status = 'first'; }
      else {
        r.prev = { full: getFull(prevSite), region: getRegion(prevSite) };
        const useRegion = !!(getRegion(site) && getRegion(prevSite));
        r.basis = useRegion ? 'region' : 'full';
        const diffPath = path.join(DIFF_DIR, today, `${site.id}.png`);
        // 전체 페이지 비교에만 모션마스크 적용(확인영역은 그대로)
        const mask = useRegion ? null : unionMask(loadMask(getMotion(site)), loadMask(getMotion(prevSite)));
        r.changeRate = compareImages(useRegion ? getRegion(prevSite) : getFull(prevSite), useRegion ? getRegion(site) : getFull(site), diffPath, mask);
        r.diff = diffPath.replace(/\\/g, '/');
        r.changed = r.changeRate > CHANGE_THRESHOLD;
      }
    } catch (e) { r.status = 'error'; r.errorMessage = '비교 실패: ' + String(e.message || e).split('\n')[0]; }
    results.push(r);
    const label = r.status === 'error' ? '오류(' + r.errorMessage + ')' : r.status === 'first' ? '첫 실행' : r.changed ? `있음 (${r.changeRate}%)` : `없음 (${r.changeRate}%)`;
    console.log(`  [${site.name}] 변경: ${label}`);
  }

  fs.mkdirSync(RESULT_DIR, { recursive: true });
  const output = { date: today, prevDate, threshold: CHANGE_THRESHOLD, results };
  fs.writeFileSync(path.join(RESULT_DIR, `${today}.json`), JSON.stringify(output, null, 2));
  fs.writeFileSync(path.join(RESULT_DIR, 'latest.json'), JSON.stringify(output, null, 2));
  console.log(`비교 완료 — 변경 있음 ${results.filter(x => x.changed).length}건 / 전체 ${results.length}건`);
})();
