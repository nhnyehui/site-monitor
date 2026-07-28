// 모바일 소호 메인의 롤링 배너 클래스 찾기 (진단용)
const { chromium, devices } = require('playwright');
const MOBILE = devices['Pixel 7'];
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--lang=ko-KR'] });
  const ctx = await browser.newContext({ ...MOBILE, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const url = 'https://m.lguplus.com/internet-iptv/soho';
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 }); } catch { await page.goto(url, { waitUntil: 'load', timeout: 40000 }); }
  try { await page.reload({ waitUntil: 'networkidle', timeout: 40000 }); } catch {}
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => {
    // 캐러셀/배너/슬라이드 관련 클래스 후보 수집
    const hits = new Set();
    for (const el of document.querySelectorAll('*')) {
      const c = (el.className || '').toString();
      if (/slick|swiper|carousel|slide|key-?visual|banner|visual|rolling|indicator|paging/i.test(c)) {
        c.split(/\s+/).forEach(x => { if (x) hits.add(x); });
      }
    }
    // "1/3" 페이저를 포함한 요소의 조상 클래스 체인
    let pagerChain = [];
    const pager = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && /^\s*\d+\s*\/\s*\d+\s*$/.test(e.textContent || ''));
    if (pager) { let el = pager; for (let i = 0; i < 6 && el; i++) { pagerChain.push((el.className || '').toString().slice(0, 50)); el = el.parentElement; } }
    return { classCandidates: [...hits].slice(0, 40), pagerAncestors: pagerChain };
  });
  console.log('=== 캐러셀/배너 관련 클래스 후보 ===');
  console.log(info.classCandidates.join('\n'));
  console.log('\n=== "1/3" 페이저의 조상 클래스(위→아래) ===');
  console.log(info.pagerAncestors.join('\n'));
  await browser.close();
})();
