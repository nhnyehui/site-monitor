// 모바일 캡쳐 테스트 — monitor.js 최종 로직과 동일 (소호 메인 모바일, 롤링배너 페이지)
const { chromium, devices } = require('playwright');
const MOBILE = devices['Pixel 7'];
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--lang=ko-KR'] });
  const ctx = await browser.newContext({ ...MOBILE, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const url = 'https://m.lguplus.com/internet-iptv/soho';
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 }); } catch { await page.goto(url, { waitUntil: 'load', timeout: 40000 }); }
  try { await page.reload({ waitUntil: 'networkidle', timeout: 40000 }); } catch {}
  await page.waitForTimeout(1200);
  await page.evaluate(async () => { await new Promise(r => { let t = 0; const i = setInterval(() => { window.scrollBy(0, 1000); t += 1000; if (t >= document.body.scrollHeight + 1000) { clearInterval(i); r(); } }, 80); }); });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2500);
  // 하단 바만 흐름으로
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
    let n = 0;
    document.querySelectorAll('*').forEach(el => { if (el.swiper && typeof el.swiper.slideTo === 'function') { n++; try { if (el.swiper.autoplay && el.swiper.autoplay.stop) el.swiper.autoplay.stop(); if (el.swiper.slideToLoop) el.swiper.slideToLoop(0, 0); else el.swiper.slideTo(0, 0); } catch (e) {} } });
    if (window.jQuery) { try { window.jQuery('.slick-slider').each(function () { window.jQuery(this).slick('slickPause'); window.jQuery(this).slick('slickGoTo', 0, true); }); } catch (e) {} }
    console.log('Swiper 개수:', n, 'Slick 개수:', document.querySelectorAll('.slick-slider').length);
  });
  await page.waitForTimeout(700);
  // 지연 이미지 강제 로드
  await page.evaluate(async () => {
    document.querySelectorAll('img').forEach(img => { try { img.loading = 'eager'; img.removeAttribute('loading'); } catch (e) {} });
    await Promise.all([...document.querySelectorAll('img')].map(img => (img.complete && img.naturalWidth > 0) ? 0 : new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); setTimeout(res, 4000); })));
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test_mo.png', fullPage: true });
  console.log('저장 → test_mo.png (배너 1번 슬라이드 + 하단 공백/가림 없는지 확인)');
  await browser.close();
})();
