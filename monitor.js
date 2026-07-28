// ============================================================
// monitor.js — 1단계: 스크린샷 + "스스로 움직이는 영역(모션마스크)" 저장
// - 같은 날 몇 초 간격으로 여러 장을 찍어, 그 사이 변하는 픽셀 = 롤링배너 등 움직이는 영역.
//   그 영역은 비교에서 자동 제외(셀렉터 불필요).
// - 스텔스 없음 / 모바일(Y): 아이폰 Pixel + 새로고침 / 하단 고정배너는 맨 아래로
// urls.csv 열: 사이트명,URL,중요도,확인영역,무시영역,다음버튼,탭버튼,모바일
// ============================================================
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SCREENSHOT_DIR = 'screenshots';
const KEEP_DAYS = 14;
const VIEWPORT = { width: 1440, height: 900 };
const MOBILE = devices['Pixel 7'];
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// 모션마스크 설정
const MASK_PROBES = 3;         // 같은 날 촬영 횟수
const MASK_GAP_MS = 2200;      // 촬영 간격 (롤링 1회전 정도 포착)
const MASK_TOL = 40;           // 픽셀 색 차이 허용치(이보다 크면 "움직임")
const MASK_DILATE = 3;         // 움직임 영역 약간 확장(글자 테두리까지)

function todayKST() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); }

function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.some(v => v.trim() !== '')) rows.push(row); row = []; }
    else field += c;
  }
  row.push(field); if (row.some(v => v.trim() !== '')) rows.push(row);
  return rows;
}

function loadSites() {
  const rows = parseCSV(fs.readFileSync('urls.csv', 'utf-8'));
  return rows.slice(1)
    .filter(r => r[1] && r[1].trim().startsWith('http'))
    .map((r, i) => ({
      id: String(i + 1).padStart(2, '0') + '_' + (r[0] || '이름없음').trim().replace(/[^가-힣a-zA-Z0-9]/g, ''),
      name: (r[0] || '이름없음').trim(),
      url: r[1].trim(),
      importance: (r[2] || '중').trim(),
      checkSelector: (r[3] || '').trim(),
      ignoreSelector: (r[4] || '').trim(),
      mobile: /^y$/i.test((r[7] || '').trim()),
    }));
}

// ─── 모션마스크 도우미 ───
function padTo(img, w, h) { if (img.width === w && img.height === h) return img; const o = new PNG({ width: w, height: h }); PNG.bitblt(img, o, 0, 0, img.width, img.height, 0, 0); return o; }
function dilate(m, w, h, r) {
  const t = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let on = 0; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < w && m[y * w + xx]) { on = 1; break; } } t[y * w + x] = on; }
  const o = Buffer.alloc(w * h);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { let on = 0; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < h && t[yy * w + x]) { on = 1; break; } } o[y * w + x] = on; }
  return o;
}
// 여러 컷에서 첫 컷과 달라지는 픽셀 = 움직임 → 흰색 마스크 PNG 버퍼
function buildMotionMask(probeBufs) {
  const imgs = probeBufs.map(b => PNG.sync.read(b));
  const w = Math.max(...imgs.map(i => i.width)), h = Math.max(...imgs.map(i => i.height));
  const P = imgs.map(i => padTo(i, w, h));
  let m = Buffer.alloc(w * h);
  const a = P[0];
  for (let k = 1; k < P.length; k++) { const b = P[k]; for (let p = 0; p < w * h; p++) { const i = p * 4; if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > MASK_TOL) m[p] = 1; } }
  m = dilate(m, w, h, MASK_DILATE);
  const out = new PNG({ width: w, height: h });
  for (let p = 0; p < w * h; p++) { const i = p * 4; const v = m[p] ? 255 : 0; out.data[i] = v; out.data[i + 1] = v; out.data[i + 2] = v; out.data[i + 3] = 255; }
  return PNG.sync.write(out);
}

async function isBlocked(page) {
  try {
    const title = await page.title();
    const body = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 2000) : '');
    return /just a moment|verify you are human|security verification|performing security|checking your browser|attention required|보안 확인|사람인지 확인/i.test(title + ' ' + body);
  } catch { return false; }
}

async function captureSite(browser, site, dir) {
  const context = await browser.newContext(site.mobile
    ? { ...MOBILE, locale: 'ko-KR', timezoneId: 'Asia/Seoul' }
    : { viewport: VIEWPORT, userAgent: USER_AGENT, locale: 'ko-KR', timezoneId: 'Asia/Seoul' }
  );
  const page = await context.newPage();
  const result = { id: site.id, name: site.name, url: site.url, importance: site.importance, mobile: site.mobile, full: null, region: null, motion: null, error: null };
  try {
    try { await page.goto(site.url, { waitUntil: 'networkidle', timeout: 40000 }); }
    catch { await page.goto(site.url, { waitUntil: 'load', timeout: 40000 }); }

    if (site.mobile) {
      try { await page.reload({ waitUntil: 'networkidle', timeout: 40000 }); }
      catch { await page.reload({ waitUntil: 'load', timeout: 40000 }); }
      await page.waitForTimeout(1200);
    }

    if (await isBlocked(page)) {
      await page.waitForTimeout(15000);
      if (await isBlocked(page)) throw new Error('보안(봇 차단) 페이지에 막힘');
    }

    // 지연 로딩 콘텐츠 불러오기
    await page.evaluate(async () => {
      await new Promise(resolve => { let t = 0; const timer = setInterval(() => { window.scrollBy(0, 1000); t += 1000; if (t >= document.body.scrollHeight + 1000) { clearInterval(timer); resolve(); } }, 80); });
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2500);

    if (site.ignoreSelector) await page.addStyleTag({ content: `${site.ignoreSelector}{visibility:hidden !important;}` });

    // 하단 고정배너를 일반 흐름으로 (본문 안 가리게)
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('*')) {
        const p = getComputedStyle(el).position;
        if (p === 'fixed' || p === 'sticky') { el.style.setProperty('position', 'static', 'important'); el.style.setProperty('transform', 'none', 'important'); }
      }
    });
    await page.waitForTimeout(600);

    const fullShot = () => page.screenshot({ fullPage: true });
    // 첫 컷 = 저장용, 이후 컷 = 움직임 감지용
    const probes = [];
    probes.push(await fullShot());
    for (let k = 1; k < MASK_PROBES; k++) { await page.waitForTimeout(MASK_GAP_MS); probes.push(await fullShot()); }

    const fp = path.join(dir, `${site.id}_full.png`);
    fs.writeFileSync(fp, probes[0]);
    result.full = fp.replace(/\\/g, '/');

    try {
      const mp = path.join(dir, `${site.id}_motion.png`);
      fs.writeFileSync(mp, buildMotionMask(probes));
      result.motion = mp.replace(/\\/g, '/');
    } catch { }

    if (site.checkSelector) {
      try {
        const el = page.locator(site.checkSelector).first();
        await el.waitFor({ state: 'visible', timeout: 8000 });
        const rp = path.join(dir, `${site.id}_region.png`);
        await el.screenshot({ path: rp });
        result.region = rp.replace(/\\/g, '/');
      } catch { }
    }
    console.log(`  O [${site.name}]${site.mobile ? ' [모바일]' : ''} 저장`);
  } catch (e) {
    result.error = String(e.message || e).split('\n')[0];
    console.log(`  X [${site.name}] 실패: ${result.error}`);
  } finally {
    await page.close();
    await context.close();
  }
  return result;
}

function cleanupOldFolders() {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  for (const base of [SCREENSHOT_DIR, 'diffs']) {
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(name) && name < cutoff) { fs.rmSync(path.join(base, name), { recursive: true, force: true }); console.log(`오래된 폴더 삭제: ${base}/${name}`); }
    }
  }
}

(async () => {
  const date = todayKST();
  const dir = path.join(SCREENSHOT_DIR, date);
  fs.mkdirSync(dir, { recursive: true });
  const sites = loadSites();
  console.log(`${date} — ${sites.length}개 사이트 점검 시작`);
  const browser = await chromium.launch({ args: ['--no-sandbox', '--lang=ko-KR'] });
  const results = [];
  for (const site of sites) results.push(await captureSite(browser, site, dir));
  await browser.close();
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ date, sites: results }, null, 2));
  cleanupOldFolders();
  console.log(`스크린샷 저장 완료 → ${dir}`);
})();
