// ============================================================
// copy.js — 리포트/이미지를 공유 폴더(구글 드라이브 등)로 복사
// share.txt 에 적힌 폴더 경로로 reports/screenshots/diffs 를 복사합니다.
// (배치 대신 Node로 복사 → 한글/공백 경로도 안전)
// ============================================================
const fs = require('fs');
const path = require('path');

function cfg(f) { if (!fs.existsSync(f)) return ''; return fs.readFileSync(f, 'utf-8').replace(/^﻿/, '').trim(); }

const dest = cfg('share.txt');
if (!dest) { console.log('share.txt 가 없어 공유 폴더 복사를 건너뜁니다.'); process.exit(0); }
if (!fs.existsSync(dest)) { console.error('공유 폴더를 찾을 수 없습니다: ' + dest + '  (share.txt 경로 확인)'); process.exit(0); }

let ok = 0;
for (const sub of ['reports', 'screenshots', 'diffs']) {
  if (!fs.existsSync(sub)) continue;
  try {
    fs.cpSync(sub, path.join(dest, sub), { recursive: true });
    console.log('복사 완료: ' + sub + ' → ' + dest);
    ok++;
  } catch (e) {
    console.error('복사 실패(' + sub + '): ' + (e.message || e));
  }
}
console.log(ok > 0 ? '공유 폴더 복사 완료' : '복사할 항목이 없습니다.');
