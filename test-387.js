// 387 PC 캡쳐 테스트 — monitor.js 최종 로직(Swiper 1번 고정 포함)과 동일
const { chromium } = require('playwright');
const VIEWPORT = { width: 1440, height: 900 };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--lang=ko-KR'] });
  const ctx = await browser.newContext({ viewport: VIEWPORT, userAgent: UA, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const url = 'https://www.lguplus.com/benefit-event/ongoing/387';
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 }); } catch { await page.goto(url, { waitUntil: 'load', timeout: 40000 }); }
  await page.evaluate(async () => { await new Promise(r => { let t = 0; const i = setInterval(() => { window.scrollBy(0, 1000); t += 1000; if (t >= document.body.scrollHeight + 1000) { clearInterval(i); r(); } }, 80); }); });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed') continue;
      const r = el.getBoundingClientRect();
      const isBottomBar = r.bottom >= vh - 4 && r.bottom <= vh + 4 && r.top < vh && r.width >= vw * 0.6 && r.height > 20 && r.height < vh * 0.5 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;
      if (isBottomBar) { el.style.setProperty('position', 'static', 'important'); el.style.setProperty('transform', 'none', 'important'); }
    }
  });
  await page.waitForTimeout(600);
  // Swiper 1번 고정 + 자동재생 정지
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach(el => {
      if (el.swiper && typeof el.swiper.slideTo === 'function') {
        try { if (el.swiper.autoplay && el.swiper.autoplay.stop) el.swiper.autoplay.stop(); if (el.swiper.slideToLoop) el.swiper.slideToLoop(0, 0); else el.swiper.slideTo(0, 0); } catch (e) {}
      }
    });
  });
  await page.waitForTimeout(700);
  // 지연 로딩 이미지 강제 로드 + 대기
  await page.evaluate(async () => {
    document.querySelectorAll('img').forEach(img => { try { img.loading = 'eager'; img.removeAttribute('loading'); } catch (e) {} });
    await Promise.all([...document.querySelectorAll('img')].map(img => (img.complete && img.naturalWidth > 0) ? 0 : new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); setTimeout(res, 4000); })));
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test_387.png', fullPage: true });
  console.log('저장 → test_387.png (중간 혜택 배너가 1번 슬라이드인지 확인)');
  await browser.close();
})();
