// PC + 모바일 하단배너 검증 테스트 (fixed→static + transform 제거)
const { chromium, devices } = require('playwright');
const MOBILE = devices['Pixel 7'];
const VIEWPORT = { width: 1440, height: 900 };
const PC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const URL = 'https://www.lguplus.com/benefit-event/ongoing/387';
const MURL = 'https://m.lguplus.com/benefit-event/ongoing/387';

async function neutralize(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const p = getComputedStyle(el).position;
      if (p === 'fixed' || p === 'sticky') {
        el.style.setProperty('position', 'static', 'important');
        el.style.setProperty('transform', 'none', 'important');   // 중앙정렬 transform 제거
      }
    }
  });
}
async function scrollAll(page) {
  await page.evaluate(async () => { await new Promise(r => { let t = 0; const timer = setInterval(() => { window.scrollBy(0, 1200); t += 1200; if (t >= document.body.scrollHeight) { clearInterval(timer); r(); } }, 60); }); });
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function cap(browser, mobile, out) {
  const ctx = await browser.newContext(mobile ? { ...MOBILE, locale: 'ko-KR' } : { viewport: VIEWPORT, userAgent: PC_UA, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const url = mobile ? MURL : URL;
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 }); } catch { await page.goto(url, { waitUntil: 'load', timeout: 40000 }); }
  if (mobile) { try { await page.reload({ waitUntil: 'networkidle', timeout: 40000 }); } catch { await page.reload({ waitUntil: 'load', timeout: 40000 }); } await page.waitForTimeout(1200); }
  await scrollAll(page);
  await page.addStyleTag({ content: `*,*::before,*::after{animation:none !important;transition:none !important;}` });
  await neutralize(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: out, fullPage: true });
  console.log('저장 →', out);
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--lang=ko-KR'] });
  await cap(browser, false, 'test_pc.png');
  await cap(browser, true, 'test_mobile.png');
  await browser.close();
  console.log('완료: test_pc.png / test_mobile.png 둘 다 하단배너 확인');
})();
