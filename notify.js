// ============================================================
// notify.js — 4단계: 점검 결과를 두레이(Dooray!) 메신저로 전송
// 실행 방법: node report.js 다음에 node notify.js
// 준비물:
//   webhook.txt — 두레이 웹훅 주소 한 줄
//   share.txt   — (선택) 공유폴더 경로 한 줄 (예: \\nas\team\site-monitor)
//                 있으면 메시지에 날짜별 리포트 경로가 함께 표시됩니다.
// ============================================================
const fs = require('fs');
const { load, readTxt } = require('./config.js');   // [변경] 설정은 config.js 한 곳에서 읽는다

const CFG = load();
const SEND_WHEN_NO_CHANGE = CFG.sendWhenNoChange;   // config.json 의 "변경없어도알림"

// 상태 기록용 작은 파일을 읽을 때 쓴다 (설정 파일이 아니라 results/ 아래 기록들)
function readConfig(file) { return readTxt(file); }

// ─── [2026-09-28 추가] 저장·게시 상태 점검 ───────────────────────────
// 왜 필요한가: 기존에는 드라이브 복사나 웹 게시가 실패해도 알림엔 표시가 없어,
//   09/07~09/21 3주간 드라이브가 비어 있는 것을 아무도 알아채지 못했습니다.

// 날짜 문자열(YYYY-MM-DD)에서 직전 영업일을 구한다.
// UTC 기준으로 계산해 시간대에 따른 하루 밀림을 방지한다.
function prevBusinessDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  do { d.setUTCDate(d.getUTCDate() - 1); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

// 저장·게시·실행 상태를 점검해 알림에 넣을 줄들을 만든다.
// 반환: { lines: [표시할 줄], bad: 문제 건수 }
function checkStatus(data) {
  const lines = [];
  let bad = 0;

  // (1) 공유 폴더(구글 드라이브) 복사 — copy.js 가 남긴 기록을 읽는다
  let cs = null;
  try {
    if (fs.existsSync('results/copy-status.json')) {
      cs = JSON.parse(fs.readFileSync('results/copy-status.json', 'utf-8'));
    }
  } catch (e) { /* 기록 파일이 깨졌으면 아래에서 '기록 없음'으로 처리 */ }

  if (!cs) { lines.push('❗ 드라이브 저장: 실행 기록 없음 (copy.js 가 실행되지 않았습니다)'); bad++; }
  else if (cs.skipped) { lines.push('· 공유폴더 저장: 사용 안 함 (설정)'); }
  else if (cs.ok) { lines.push('✔ 드라이브 저장: 정상'); }
  else { lines.push('❗ 드라이브 저장 실패 — ' + shortErr(cs.error) + ' · 진단.bat 확인'); bad++; }

  // (2) 웹 리포트 게시(git push) — run.bat 이 남긴 한 줄 기록을 읽는다
  const push = readConfig('results/push-status.txt');
  if (push === 'ok') { lines.push('✔ 웹 리포트 게시: 정상'); }
  else if (push === 'fail') { lines.push('❗ 웹 리포트 게시 실패 — web-fix.bat 실행 필요'); bad++; }
  // 기록이 아예 없으면 웹 게시를 쓰지 않는 구성으로 보고 아무것도 표시하지 않는다

  // (3) 비교 기준일 점검 — 직전 영업일이 아니면 그 사이 실행이 빠졌다는 뜻
  //     (09/14 월요일 실행 누락이 이렇게 조용히 지나갔습니다)
  if (data.prevDate) {
    const expected = prevBusinessDay(data.date);
    if (data.prevDate !== expected) {
      lines.push('❗ 비교 기준일이 ' + data.prevDate + ' 입니다 (정상: ' + expected + ') — 그 사이 실행이 누락되었습니다');
      bad++;
    }
  } else {
    lines.push('❗ 비교할 이전 데이터가 없습니다');
    bad++;
  }

  return { lines, bad };
}

// ─── [2026-09-30 추가] 변경 위치 요약 ───────────────────────────
// history.js 가 계산해 둔 변경 구간 정보를 읽어 "어디가 바뀌었는지" 를 한 줄로 만든다.
// (알림만 보고도 페이지 어디를 봐야 하는지 알 수 있게 한다)
let BANDS = {};
try {
  if (fs.existsSync('results/bands-cache.json')) {
    BANDS = JSON.parse(fs.readFileSync('results/bands-cache.json', 'utf-8'));
  }
} catch { /* 없으면 위치 요약을 생략한다 */ }

function bandLine(r) {
  if (!r.diff) return null;
  const hit = BANDS[String(r.diff).replace(/\\/g, '/')];
  const info = hit && hit.data;
  if (!info || !info.bands || !info.bands.length) return null;

  const H = info.h;
  const where = b => {
    const pct = Math.round((b.top / H) * 100);
    return (pct < 33 ? '상단' : pct < 66 ? '중단' : '하단') + ' ' + pct + '%';
  };
  const major = info.bands.filter(b => (b.share ?? 100) >= 15);
  const minor = info.bands.length - major.length;

  let txt;
  if (major.length === 0) txt = '뚜렷한 구간 없음';
  else if (major.length === 1) txt = where(major[0]) + ' 지점 (' + (major[0].bottom - major[0].top) + 'px)';
  else txt = major.slice(0, 3).map(where).join(' · ') + ' 등 ' + major.length + '곳';
  if (minor > 0) txt += ' · 미세 ' + minor + '곳';
  return txt;
}

// 저장 실패 사유를 한 줄로 줄인다. 원문은 길고 같은 경로가 반복돼 알림을 가린다.
function shortErr(e) {
  if (!e) return '원인 불명';
  if (/ECONNRESET|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH/.test(e)) return '연결 차단 (사내망 정책 확인 필요)';
  if (/접근할 수 없습니다|ENOENT/.test(e)) return '폴더를 찾을 수 없음 (경로 확인 필요)';
  if (/EACCES|EPERM/.test(e)) return '권한 없음';
  return String(e).split(/[\r\n\/]/)[0].slice(0, 50);
}

// 사이트별 코멘트 (report.js와 동일한 기준)
function commentFor(r) {
  if (r.status === 'error') return `⚠️ 접속 오류 (${r.errorMessage || '접속 실패'})`;
  if (r.status === 'first') return '첫 실행';
  if (!r.changed) return '변경 없음';
  if (r.importance === '상') return '🚨 변경 감지 — 즉시 확인 필요';
  if (r.changeRate >= 10) return '대규모 변경 감지 — 확인 필요';
  return '변경 감지 — 확인 권장';
}

(async () => {
  const webhookUrl = CFG.webhook;
  if (!webhookUrl) {
    console.log('두레이 웹훅 주소가 비어 있어 메신저 전송을 건너뜁니다. (config.json 의 "두레이웹훅")');
    return;
  }
  if (!webhookUrl.startsWith('http')) {
    console.log('두레이 웹훅 주소 형식이 올바르지 않습니다. (config.json 의 "두레이웹훅")');
    return;
  }

  if (!fs.existsSync('results/latest.json')) {
    console.error('비교 결과가 없습니다. 먼저 node compare.js 를 실행하세요.');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync('results/latest.json', 'utf-8'));

  const changed = data.results.filter(r => r.changed);
  const errors = data.results.filter(r => r.status === 'error');

  if (!SEND_WHEN_NO_CHANGE && changed.length === 0 && errors.length === 0) {
    console.log('변경사항이 없어 메신저 전송을 건너뜁니다.');
    return;
  }

  // ─── 메시지 만들기 ───
  const status = checkStatus(data);   // [추가] 저장·게시·실행 상태 점검

  const lines = [];
  lines.push(`[사이트 변경 점검] ${data.date}`);

  if (changed.length > 0) lines.push(`🔔 변경 있음 ${changed.length}건 (전체 ${data.results.length}개)`);
  else lines.push(`✅ 변경 없음 (전체 ${data.results.length}개)`);
  if (errors.length > 0) lines.push(`⚠️ 접속 오류 ${errors.length}건`);
  // [추가] 저장·게시에 문제가 있으면 맨 위에서 바로 눈에 띄게 한다
  if (status.bad > 0) lines.push(`❗ 점검 필요 ${status.bad}건 — 맨 아래 확인`);

  lines.push('');
  lines.push('사이트명 - 변경률 - 코멘트');
  for (const r of data.results) {
    const rate = r.status === 'ok' ? `${r.changeRate}%` : '-';
    const mark = r.changed ? '🔴 ' : '';
    lines.push(`${mark}${r.name} - ${rate} - ${commentFor(r)}`);
    if (r.changed) {
      const where = bandLine(r);
      if (where) lines.push('   └ ' + where);
    }
  }

  // weblink.txt = GitHub Pages 웹 리포트(바로 열림), link.txt = 구글 드라이브(원본)
  const pages = CFG.useWebPublish ? CFG.webLink : '';   // 웹 게시를 쓸 때만 링크를 건다
  const drive = CFG.driveLink;
  if (pages.startsWith('http') || drive.startsWith('http')) lines.push('');
  if (pages.startsWith('http')) lines.push(`📋 변경 내역 보기: ${pages}`);
  if (drive.startsWith('http')) lines.push(`🗂 원본 이미지(구글 드라이브): ${drive}`);

  // 저장·게시 상태는 맨 아래에 짧게. 문제가 있을 때만 눈에 띄면 된다.
  const notable = status.lines.filter(l => l.startsWith('❗'));
  if (notable.length) { lines.push(''); for (const l of notable) lines.push(l); }

  // ─── 두레이 웹훅으로 전송 ───
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      botName: '사이트 모니터링',
      botIconImage: 'https://static.dooray.com/static_images/dooray-bot.png',
      text: lines.join('\n'),
    }),
  });

  if (res.ok) {
    console.log('두레이 메신저 전송 완료');
  } else {
    console.error(`두레이 전송 실패: HTTP ${res.status} — config.json 의 "두레이웹훅" 주소를 확인하세요.`);
  }
})();