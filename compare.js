// ============================================================
// compare.js — 2단계: 전일/금일 스크린샷 1장씩 단순 비교 (빠른 버전)
// ============================================================
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

const SCREENSHOT_DIR = 'screenshots';
const DIFF_DIR = 'diffs';
const RESULT_DIR = 'results';
const CHANGE_THRESHOLD = 0.3;   // 변경률(%) 이 값 초과면 변경으로 판단 (오탐 많으면 키우기)
const PIXEL_SENSITIVITY = 0.1;

function todayKST() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); }
// 예전 버전 형식(fulls/regions 배열)도 호환되게 대표 이미지 1장 추출
function getFull(s) { return s ? (s.full || (s.fulls && s.fulls[0]) || null) : null; }
function getRegion(s) { return s ? (s.region || (s.regions && s.regions[0]) || null) : null; }
function findPrevDate(today) {
  if (!fs.existsSync(SCREENSHOT_DIR)) return null;
  const dates = fs.readdirSync(SCREENSHOT_DIR).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n) && n < today).sort();
  return dates.length ? dates[dates.length - 1] : null;
}
function padTo(img, w, h) {
  if (img.width === w && img.height === h) return img;
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
  return out;
}
function compareImages(prevPath, todayPath, diffPath) {
  let a = PNG.sync.read(fs.readFileSync(prevPath));
  let b = PNG.sync.read(fs.readFileSync(todayPath));
  const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
  a = padTo(a, w, h); b = padTo(b, w, h);
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: PIXEL_SENSITIVITY });
  fs.mkdirSync(path.dirname(diffPath), { recursive: true });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  return Math.round((n / (w * h)) * 100 * 100) / 100;
}

(async () => {
  const today = todayKST();
  const todayMetaPath = path.join(SCREENSHOT_DIR, today, 'meta.json');
  if (!fs.existsSync(todayMetaPath)) { console.error('오늘 스크린샷이 없습니다. 먼저 node monitor.js 를 실행하세요.'); process.exit(1); }
  const todayMeta = JSON.parse(fs.readFileSync(todayMetaPath, 'utf-8'));
  // 이번 한 번만 기준일을 지정하고 싶으면 baseline-once.txt 에 날짜(YYYY-MM-DD) 한 줄.
  // 사용 후 자동 삭제되어, 다음 실행부터는 평소처럼 전일과 비교합니다.
  let prevDate;
  const onceFile = 'baseline-once.txt';
  if (fs.existsSync(onceFile)) {
    prevDate = fs.readFileSync(onceFile, 'utf-8').replace(/^﻿/, '').trim();
    try { fs.unlinkSync(onceFile); } catch {}
    console.log('※ 이번만 기준일 지정 → ' + prevDate + ' 와 비교합니다 (다음부터는 전일 비교).');
  } else {
    prevDate = findPrevDate(today);
  }
  let prevMeta = null;
  try { if (prevDate) prevMeta = JSON.parse(fs.readFileSync(path.join(SCREENSHOT_DIR, prevDate, 'meta.json'), 'utf-8')); } catch { }

  const results = [];
  for (const site of todayMeta.sites) {
    const r = { id: site.id, name: site.name, url: site.url, importance: site.importance,
      status: 'ok', changed: false, changeRate: 0, basis: 'full',
      today: { full: getFull(site), region: getRegion(site) }, prev: null, diff: null, errorMessage: null };
    try {
      const prevSite = prevMeta ? prevMeta.sites.find(s => s.id === site.id) : null;
      if (site.error) { r.status = 'error'; r.errorMessage = site.error; }
      else if (!prevSite || prevSite.error || !getFull(prevSite)) { r.status = 'first'; }
      else {
        r.prev = { full: getFull(prevSite), region: getRegion(prevSite) };
        const useRegion = !!(getRegion(site) && getRegion(prevSite));
        r.basis = useRegion ? 'region' : 'full';
        const diffPath = path.join(DIFF_DIR, today, `${site.id}.png`);
        r.changeRate = compareImages(useRegion ? getRegion(prevSite) : getFull(prevSite), useRegion ? getRegion(site) : getFull(site), diffPath);
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
