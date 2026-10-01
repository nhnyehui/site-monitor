// ============================================================
// copy.js — 리포트/이미지를 공유 폴더(구글 드라이브 등)로 복사
// share.txt 에 적힌 폴더 경로로 reports/screenshots/diffs 를 복사합니다.
// (배치 대신 Node로 복사 → 한글/공백 경로도 안전)
//
// [2026-09-28 추가] 복사 성공/실패를 results/copy-status.json 에 기록합니다.
//   notify.js 가 이 파일을 읽어 두레이 알림에 저장 상태를 함께 표시합니다.
//   (이전에는 복사가 실패해도 알림엔 아무 표시가 없어, 3주간 드라이브가 비어 있는 걸 아무도 몰랐습니다)
// ============================================================
const fs = require('fs');
const path = require('path');
const { load } = require('./config.js');   // [변경] 설정은 config.js 한 곳에서 읽는다

// 복사 결과를 파일로 남긴다. 이 함수 자체가 실패해도 본 작업은 계속되도록 try로 감싼다.
function writeStatus(s) {
  try {
    fs.mkdirSync('results', { recursive: true });
    fs.writeFileSync('results/copy-status.json', JSON.stringify(s, null, 2));
  } catch (e) {
    console.error('상태 기록 실패: ' + (e.message || e));
  }
}

const dest = load().sharePath;
// ok=최종 성공 여부, copied=복사된 폴더 목록, error=실패 사유, at=기록 시각
const status = { ok: false, dest, copied: [], error: null, at: new Date().toISOString() };

if (!dest) {
  // 경로를 일부러 비워둔 것은 '쓰지 않겠다'는 뜻이므로 실패가 아니라 '사용 안 함' 으로 기록한다.
  //  (고칠 수 없는 실패 알림이 매일 뜨는 것을 막는다)
  status.ok = true;
  status.skipped = true;
  console.log('공유폴더를 사용하지 않는 설정입니다. 복사를 건너뜁니다.');
  writeStatus(status);
  process.exit(0);
}
if (!fs.existsSync(dest)) {
  // 구글 드라이브 계정이 풀리면 G: 드라이브가 사라져 여기에 걸린다 — 09/07 사고가 정확히 이 경우였다.
  status.error = '공유 폴더에 접근할 수 없습니다: ' + dest;
  console.error(status.error + '  (config.json 의 "공유폴더" 경로 / 구글 드라이브 로그인 확인)');
  writeStatus(status);
  process.exit(0);
}

let ok = 0, failed = 0;
for (const sub of ['reports', 'screenshots', 'diffs']) {
  if (!fs.existsSync(sub)) continue;
  try {
    fs.cpSync(sub, path.join(dest, sub), { recursive: true });
    console.log('복사 완료: ' + sub + ' → ' + dest);
    status.copied.push(sub);
    ok++;
  } catch (e) {
    failed++;
    // 실패 사유를 누적해 둔다(여러 폴더가 동시에 실패할 수 있으므로)
    status.error = (status.error ? status.error + ' / ' : '') + sub + ': ' + (e.message || e);
    console.error('복사 실패(' + sub + '): ' + (e.message || e));
  }
}

// 하나라도 복사됐고 실패가 하나도 없을 때만 정상으로 본다
status.ok = ok > 0 && failed === 0;
if (ok === 0 && !status.error) status.error = '복사할 항목이 없습니다';
writeStatus(status);
console.log(ok > 0 ? '공유 폴더 복사 완료' : '복사할 항목이 없습니다.');
