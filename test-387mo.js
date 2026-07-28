// 387 모바일 캡쳐 테스트 — Swiper 1번 고정 확인 (로그 포함)
const { chromium, devices } = require('playwright');
const MOBILE = devices['Pixel 7'];
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--lang=ko-KR'] });
  const ctx = await browser.newContext({ ...MOBILE, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const url = 'https://m.lguplus.com/benefit-event/ongoing/387';
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 }); } catch { await page.goto(url, { waitUntil: 'load', timeout: 40000 }); }
  try { await page.reload({ waitUntil: 'networkidle', timeout: 40000 }); } catch {}
  await page.waitForTimeout(1500);
  await page.evaluate(async () => { await new Promise(r => { let t = 0; const i = setInterval(() => { window.scrollBy(0, 1000); t += 1000; if (t >= document.body.scrollHeight + 1000) { clearInterval(i); r(); } }, 80); }); });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    for (const el of document.querySelectorAll('*')) { const cs = getComputedStyle(el); if (cs.position !== 'fixed') continue; const r = el.getBoundingClientRect(); const bar = r.bottom >= vh - 4 && r.bottom <= vh + 4 && r.top < vh && r.width >= vw * 0.6 && r.height > 20 && r.height < vh * 0.5 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0; if (bar) { el.style.setProperty('position', 'static', 'important'); el.style.setProperty('transform', 'none', 'important'); } }
  });
  await page.waitForTimeout(600);
  // Swiper 고정(API + PREV 클릭 백업) + 로그
  const log = await page.evaluate(async () => {
    const swipers = [...document.querySelectorAll('*')].filter(el => el.swiper && typeof el.swiper.slideTo === 'function');
    const before = swipers.map(el => (el.swiper.realIndex ?? el.swiper.activeIndex));
    swipers.forEach(el => { try { if (el.swiper.autoplay && el.swiper.autoplay.stop) el.swiper.autoplay.stop(); if (el.swiper.slideToLoop) el.swiper.slideToLoop(0, 0); else el.swiper.slideTo(0, 0); } catch (e) {} });
    let clicks = 0;
    const roots = new Set([...document.querySelectorAll('.swiper-wrapper')].map(w => w.closest('[data-event-carousel], [class*="ev-slide"], [class*="swiper"]') || w.parentElement));
    for (const root of roots) { try { const act = root.querySelector('.swiper-slide-active[data-swiper-slide-index]'); let idx = act ? parseInt(act.getAttribute('data-swiper-slide-index')) : 0; const prev = root.querySelector('[data-swiper="PREV"], .ev-slide-controls__arrow--prev, .swiper-button-prev, [class*="prev"]'); if (prev && isFinite(idx) && idx > 0) { for (let k = 0; k < idx && k < 12; k++) { prev.click(); clicks++; await new Promise(r => setTimeout(r, 300)); } } } catch (e) {} }
    const activeAfter = [...document.querySelectorAll('.swiper-slide-active[data-swiper-slide-index]')].map(e => e.getAttribute('data-swiper-slide-index'));
    return { swiperCount: swipers.length, beforeIndex: before, afterIndexAPI: swipers.map(el => (el.swiper.realIndex ?? el.swiper.activeIndex)), backupClicks: clicks, activeSlideIndex: activeAfter, slickCount: document.querySelectorAll('.slick-slider').length };
  });
  console.log('=== Swiper 고정 결과 ===');
  console.log(JSON.stringify(log));
  await page.waitForTimeout(1200); // 고정 후 다시 안 넘어가는지
  await page.evaluate(async () => { document.querySelectorAll('img').forEach(img => { try { img.loading = 'eager'; img.removeAttribute('loading'); } catch (e) {} }); await Promise.all([...document.querySelectorAll('img')].map(img => (img.complete && img.naturalWidth > 0) ? 0 : new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); setTimeout(res, 4000); }))); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test_387mo.png', fullPage: true });
  console.log('저장 → test_387mo.png');
  await browser.close();
})();
