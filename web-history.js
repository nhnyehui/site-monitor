// ============================================================
// web-history.js — 같은 히스토리 화면을 웹(GitHub Pages)용으로 만든다.
//   → docs/history.html  +  docs/img/날짜/사이트.jpg (축소본)
//
// 왜 축소본인가:
//   예전 publish.js 는 원본 이미지를 base64 로 HTML 안에 통째로 박아서 하루 35MB 였다.
//   그대로 쌓으면 저장소가 금방 GitHub 한도를 넘는다.
//   여기서는 필요한 이미지만 폭 720px JPEG 로 줄여 파일로 올린다 → 하루 1~5MB.
//
// 올리는 이미지도 최소한으로 고른다:
//   · 변경이 감지된 사이트만 (변경 없는 날의 캡쳐는 다시 볼 일이 없다)
//   · 그중에서도 전일/금일 두 장만 (변경 부위 이미지는 로컬에서 보면 된다)
// ============================================================
const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');
const { collect, renderHtml, saveCache } = require('./history.js');
const { load } = require('./config.js');

const DOCS = 'docs';
const IMG_DIR = path.join(DOCS, 'img');
const IMG_WIDTH = 720;       // 웹에 올릴 이미지 폭
const JPEG_QUALITY = 62;

(async () => {
  const CFG = load();
  const keep = CFG.webKeepDays;

  const days = collect(keep);
  saveCache();

  fs.mkdirSync(IMG_DIR, { recursive: true });

  // ─── 필요한 이미지만 골라 축소 복사 ───────────────────────
  const map = {};            // 원본 경로 → 웹 경로
  let made = 0, bytes = 0, reused = 0;

  async function put(src, date) {
    if (!src || map[src]) return map[src] || null;
    if (!fs.existsSync(src)) return null;
    const outName = path.basename(src).replace(/\.png$/i, '.jpg');
    const outRel = 'img/' + date + '/' + outName;
    const outAbs = path.join(DOCS, outRel);
    // 이미 만들어 둔 파일이면 다시 만들지 않는다 (매일 전체를 다시 압축하면 느리다)
    if (fs.existsSync(outAbs)) { map[src] = outRel; reused++; return outRel; }
    try {
      fs.mkdirSync(path.dirname(outAbs), { recursive: true });
      const img = await Jimp.read(src);
      if (img.bitmap.width > IMG_WIDTH) img.resize({ w: IMG_WIDTH });
      const buf = await img.getBuffer('image/jpeg', { quality: JPEG_QUALITY });
      fs.writeFileSync(outAbs, buf);
      map[src] = outRel; made++; bytes += buf.length;
      return outRel;
    } catch (e) {
      console.error('  이미지 변환 실패: ' + src + ' — ' + (e.message || e));
      return null;
    }
  }

  for (const d of days) {
    for (const s of d.sites) {
      if (!s.changed) continue;               // 변경된 것만 올린다
      await put(s.today, d.date);
      if (s.prev) await put(s.prev, d.prevDate || d.date);
    }
  }
  console.log('이미지 ' + made + '장 새로 변환(' + Math.round(bytes / 1024) + 'KB), ' + reused + '장 재사용');

  // ─── HTML 만들기 (이미지는 방금 만든 축소본을 가리킨다) ────
  const html = renderHtml(days, p => (p && map[p]) ? map[p] : null);
  fs.writeFileSync(path.join(DOCS, 'history.html'), html);

  // 첫 화면도 히스토리로 (기존 index.html 은 예전 방식이라 덮어쓴다)
  fs.writeFileSync(path.join(DOCS, 'index.html'),
    '<!DOCTYPE html><meta charset="UTF-8">' +
    '<meta http-equiv="refresh" content="0; url=history.html">' +
    '<title>사이트 변경 히스토리</title>' +
    '<p>이동 중입니다… <a href="history.html">변경 히스토리 열기</a></p>');

  // ─── 보관 기간이 지난 이미지 폴더 정리 ────────────────────
  const keepDates = new Set();
  for (const d of days) { keepDates.add(d.date); if (d.prevDate) keepDates.add(d.prevDate); }
  let removed = 0;
  for (const name of fs.readdirSync(IMG_DIR)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) continue;
    if (keepDates.has(name)) continue;
    try { fs.rmSync(path.join(IMG_DIR, name), { recursive: true, force: true }); removed++; } catch {}
  }
  if (removed) console.log('보관 기간이 지난 이미지 폴더 ' + removed + '개 삭제');

  const total = (function size(dir) {
    let n = 0;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      n += f.isDirectory() ? size(p) : fs.statSync(p).size;
    }
    return n;
  })(IMG_DIR);

  console.log('웹 히스토리 생성 완료 → ' + DOCS + '/history.html (' +
              Math.round(Buffer.byteLength(html) / 1024) + 'KB, ' + days.length + '일치)');
  console.log('웹 이미지 폴더 용량: ' + (total / 1024 / 1024).toFixed(1) + 'MB (최근 ' + keep + '일 보관)');
})();
