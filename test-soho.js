// 소호 메인 PC 캡쳐 테스트 — monitor.js 최종 로직(자동재생 정지 + 실제클릭 백업 리셋)과 동일
const { chromium } = require('playwright');
const VIEWPORT = { width: 1440, height: 900 };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--lang=ko-KR'] });
  const ctx = await browser.newContext({ viewport: VIEWPORT, userAgent: UA, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const url = 'https://www.lguplus.com/internet-iptv/soho';
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 }); } catch { await page.goto(url, { waitUntil: 'load', timeout: 40000 }); }

  // 자동재생 정지 (접속 직후) → 1번 슬라이드 고정
  try { const pb = await page.$$('[class*="btn-pause"], .slick-autoplay-toggle-button'); for (const b of pb) { try { await b.click({ timeout: 1500 }); } catch {} } } catch {}

  await page.waitForTimeout(1500);
  await page.evaluate(async () => { await new Promise(r => { let t = 0; const i = setInterval(() => { window.scrollBy(0, 400); t += 400; if (t >= document.body.scrollHeight + 800) { clearInterval(i); r(); } }, 200); }); });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(3000);
  await page.evaluate(() => { for (const el of document.querySelectorAll('*')) { const p = getComputedStyle(el).position; if (p === 'fixed' || p === 'sticky') { el.style.setProperty('position', 'static', 'important'); el.style.setProperty('transform', 'none', 'important'); } } });

  // 백업: 넘어갔으면 실제 클릭으로 1번까지 되돌림
  try {
    for (let i = 0; i < 12; i++) {
      const idx = await page.evaluate(() => {
        const sl = document.querySelector('.slick-slider'); if (!sl) return -1;
        const list = sl.querySelector('.slick-list'); if (!list) return -1;
        const lr = list.getBoundingClientRect();
        const reals = [...sl.querySelectorAll('.slick-slide:not(.slick-cloned)')];
        return reals.findIndex(s => { const r = s.getBoundingClientRect(); const cx = r.left + r.width / 2; return cx > lr.left + 5 && cx < lr.right - 5; });
      });
      if (idx <= 0) break;
      const prev = await page.$('.btn-move.btn-prev, .slick-slider .btn-prev, [class*="key-visual"] [class*="prev"]');
      if (!prev) break;
      await prev.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(400);
    }
  } catch {}
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'test_soho.png', fullPage: true });
  console.log('저장 → test_soho.png (상단 롤링배너가 1번 슬라이드인지 확인)');
  await browser.close();
})();
