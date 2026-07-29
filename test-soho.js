// 소호 메인 PC 캡쳐 테스트 — Slick 배너 1번 고정(실제 클릭) 확인
const { chromium } = require('playwright');
const VIEWPORT = { width: 1440, height: 900 };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const indicatorNum = () => {
  const el = document.querySelector('.slide-controller-wrap .indicator-wrap p:nth-child(2) strong') || document.querySelector('.indicator-wrap p:nth-child(2) strong') || document.querySelector('.indicator-wrap strong');
  if (el) { const m = (el.textContent || '').match(/\d+/); if (m) return parseInt(m[0]); }
  return -1;
};
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--lang=ko-KR'] });
  const ctx = await browser.newContext({ viewport: VIEWPORT, userAgent: UA, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const url = 'https://www.lguplus.com/internet-iptv/soho';
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 }); } catch { await page.goto(url, { waitUntil: 'load', timeout: 40000 }); }
  await page.waitForTimeout(1500);
  await page.evaluate(async () => { await new Promise(r => { let t = 0; const i = setInterval(() => { window.scrollBy(0, 1000); t += 1000; if (t >= document.body.scrollHeight + 1000) { clearInterval(i); r(); } }, 80); }); });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const vw = innerWidth, vh = innerHeight; for (const el of document.querySelectorAll('*')) { const cs = getComputedStyle(el); if (cs.position !== 'fixed') continue; const r = el.getBoundingClientRect(); const bar = r.bottom >= vh - 4 && r.bottom <= vh + 4 && r.top < vh && r.width >= vw * 0.6 && r.height > 20 && r.height < vh * 0.5 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0; if (bar) { el.style.setProperty('position', 'static', 'important'); el.style.setProperty('transform', 'none', 'important'); } } });
  await page.waitForTimeout(500);
  await page.evaluate(async () => { document.querySelectorAll('img').forEach(img => { try { img.loading = 'eager'; img.removeAttribute('loading'); } catch (e) {} }); await Promise.all([...document.querySelectorAll('img')].map(img => (img.complete && img.naturalWidth > 0) ? 0 : new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); setTimeout(res, 4000); }))); });
  await page.waitForTimeout(400);

  // Slick 실제 클릭으로 1번까지
  const before = await page.evaluate(indicatorNum);
  const pauseBtn = await page.$('.slide-controller-wrap [class*="pause"], .section-box-keyvisual-ma-5 [class*="pause"], [class*="btn-pause"]');
  if (pauseBtn) { await pauseBtn.click({ timeout: 2000 }).catch(() => {}); }
  let clicks = 0;
  for (let i = 0; i < 12; i++) {
    const num = await page.evaluate(indicatorNum);
    if (num === -1 || num <= 1) break;
    const prev = await page.$('.section-box-keyvisual-ma-5 .btn-move.btn-prev, .btn-move.btn-prev, .slick-slider .slick-prev');
    if (!prev) break;
    await prev.click({ timeout: 2000 }).catch(() => {});
    clicks++;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1800); // 전환(페이드) 정착 대기
  const after = await page.evaluate(indicatorNum);
  console.log('=== Slick 실제클릭 결과 ===');
  console.log(JSON.stringify({ pauseFound: !!pauseBtn, before, clicks, after }));

  await page.screenshot({ path: 'test_soho.png', fullPage: true });
  console.log('저장 → test_soho.png (배너 지시자가 1/N 이면 성공)');
  await browser.close();
})();
