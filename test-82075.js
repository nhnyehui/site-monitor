// 82075 PC 캡쳐 테스트 — 애니메이션 정지 없이(자연 렌더링) 텍스트 확인
const { chromium } = require('playwright');
const VIEWPORT = { width: 1440, height: 900 };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--lang=ko-KR'] });
  const ctx = await browser.newContext({ viewport: VIEWPORT, userAgent: UA, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const url = 'https://www.lguplus.com/internet-iptv/soho/event/82075';
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 }); } catch { await page.goto(url, { waitUntil: 'load', timeout: 40000 }); }
  // 천천히 스크롤(스크롤로 나타나는 요소 트리거) → 위로
  await page.evaluate(async () => { await new Promise(r => { let t = 0; const i = setInterval(() => { window.scrollBy(0, 600); t += 600; if (t >= document.body.scrollHeight) { clearInterval(i); r(); } }, 120); }); });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2500);
  // 애니메이션은 건드리지 않음. 하단 고정배너만 흐름으로.
  await page.evaluate(() => { for (const el of document.querySelectorAll('*')) { const p = getComputedStyle(el).position; if (p === 'fixed' || p === 'sticky') { el.style.setProperty('position', 'static', 'important'); el.style.setProperty('transform', 'none', 'important'); } } });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test_82075.png', fullPage: true });
  console.log('저장 → test_82075.png');
  await browser.close();
})();
