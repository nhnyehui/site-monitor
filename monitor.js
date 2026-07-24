// ============================================================
// monitor.js — 1단계: 사이트당 스크린샷 1장 저장 (빠른 단순 버전)
// - 스텔스 없음(일반 IP에서 불필요, 모바일 에뮬레이션 방해했음)
// - 모바일(Y): 안드로이드 Pixel 7 프로필 + 새로고침 1회 → 실제 모바일 화면
// - 하단 고정배너(fixed/sticky)는 캡쳐 직전 일반 흐름으로 바꿔 본문을 안 가리고 맨 아래에 찍힘
// urls.csv 열: 사이트명,URL,중요도,확인영역,무시영역,다음버튼,탭버튼,모바일
// ============================================================
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'screenshots';
const KEEP_DAYS = 14;
const VIEWPORT = { width: 1440, height: 900 };
const MOBILE = devices['Pixel 7'];   // 안드로이드 크롬 모바일 프로필
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

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
  const result = { id: site.id, name: site.name, url: site.url, importance: site.importance, mobile: site.mobile, full: null, region: null, error: null };
  try {
    try { await page.goto(site.url, { waitUntil: 'networkidle', timeout: 40000 }); }
    catch { await page.goto(site.url, { waitUntil: 'load', timeout: 40000 }); }

    // 모바일: 새로고침 1회 → 실제 모바일 레이아웃으로 다시 렌더링
    if (site.mobile) {
      try { await page.reload({ waitUntil: 'networkidle', timeout: 40000 }); }
      catch { await page.reload({ waitUntil: 'load', timeout: 40000 }); }
      await page.waitForTimeout(1200);
    }

    if (await isBlocked(page)) {
      await page.waitForTimeout(15000);
      if (await isBlocked(page)) throw new Error('보안(봇 차단) 페이지에 막힘');
    }

    // 지연 로딩 대비 끝까지 스크롤 후 맨 위로
    await page.evaluate(async () => {
      await new Promise(resolve => { let t = 0; const timer = setInterval(() => { window.scrollBy(0, 1200); t += 1200; if (t >= document.body.scrollHeight) { clearInterval(timer); resolve(); } }, 60); });
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    // fade-in 텍스트/지연 로딩이 다 나타날 때까지 대기 (애니메이션은 건드리지 않음 → 텍스트 유지)
    await page.waitForTimeout(2500);

    // 무시영역만 숨김 (애니메이션 정지는 fade-in 텍스트를 사라지게 해서 넣지 않음)
    if (site.ignoreSelector) await page.addStyleTag({ content: `${site.ignoreSelector}{visibility:hidden !important;}` });

    // 화면에 붙어다니는 고정(fixed/sticky) 요소를 일반 흐름으로 → 본문 안 가리고 제자리(주로 맨 아래)에 찍힘
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('*')) {
        const p = getComputedStyle(el).position;
        if (p === 'fixed' || p === 'sticky') {
          el.style.setProperty('position', 'static', 'important');
          el.style.setProperty('transform', 'none', 'important'); // 중앙정렬 transform 제거(잘림 방지)
        }
      }
    });
    await page.waitForTimeout(600);

    const fp = path.join(dir, `${site.id}_full.png`);
    await page.screenshot({ path: fp, fullPage: true });
    result.full = fp.replace(/\\/g, '/');

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
