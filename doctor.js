// ============================================================
// doctor.js — 자가 진단. "뭐가 잘못됐는지" 를 스스로 알려준다.
// 진단.bat 을 더블클릭하면 실행된다. 인수인계 직후, 그리고 알림이 이상할 때 돌린다.
// 아무것도 고치지 않고 확인만 하므로 언제 돌려도 안전하다.
// ============================================================
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OK = '  [정상] ', NG = '  [문제] ', INFO = '  [참고] ';
let problems = [];
function ng(msg, fix) { problems.push({ msg, fix }); console.log(NG + msg); }
function ok(msg) { console.log(OK + msg); }
function info(msg) { console.log(INFO + msg); }

// 오늘 날짜(한국 기준) — 다른 스크립트들과 같은 기준을 쓴다
function todayKST() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); }

console.log('');
console.log('============================================');
console.log(' 사이트 모니터링 자가 진단   ' + todayKST());
console.log('============================================');

// ─── 1. 실행 환경 ───────────────────────────────
console.log('\n[1] 실행 환경');
ok('Node.js ' + process.version);

if (fs.existsSync('node_modules')) ok('프로그램 라이브러리 설치됨 (node_modules)');
else ng('프로그램 라이브러리가 없습니다', '설치.bat 을 더블클릭하세요.');

// Playwright 브라우저(크로미움)가 실제로 내려받아졌는지 확인
try {
  require.resolve('playwright');
  const base = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'ms-playwright')
    : '';
  if (base && fs.existsSync(base) && fs.readdirSync(base).some(d => d.startsWith('chromium'))) {
    ok('캡쳐용 브라우저(크로미움) 설치됨');
  } else {
    info('캡쳐용 브라우저 설치 여부를 확인하지 못했습니다 (실행이 되면 정상입니다)');
  }
} catch {
  ng('playwright 라이브러리가 없습니다', '설치.bat 을 더블클릭하세요.');
}

// ─── 2. 설정 ───────────────────────────────────
console.log('\n[2] 설정 (config.json)');
let CFG = null;
if (!fs.existsSync('config.json')) {
  ng('config.json 이 없습니다', '설치.bat 을 더블클릭하면 자동으로 만들어집니다.');
} else {
  try {
    JSON.parse(fs.readFileSync('config.json', 'utf-8').replace(/^﻿/, ''));
    ok('config.json 형식 정상');
  } catch (e) {
    ng('config.json 형식 오류 — ' + e.message,
       '메모장으로 열어 쉼표(,)와 따옴표(") 짝을 확인하고, 저장할 때 인코딩을 UTF-8 로 선택하세요.');
  }
}
try { CFG = require('./config.js').load(); } catch { CFG = null; }

if (CFG) {
  if (!CFG.webhook) ng('두레이 웹훅 주소가 비어 있습니다 → 알림이 안 갑니다',
                       'config.json 의 "두레이웹훅" 에 주소를 넣으세요.');
  else if (!CFG.webhook.startsWith('http')) ng('두레이 웹훅 주소 형식이 이상합니다', 'http 로 시작하는 주소여야 합니다.');
  else ok('두레이 웹훅 주소 설정됨');

  if (!CFG.sharePath) info('공유폴더가 비어 있습니다 → 리포트를 복사하지 않습니다 (의도한 설정이면 정상)');
  else if (!fs.existsSync(CFG.sharePath)) ng('공유폴더에 접근할 수 없습니다: ' + CFG.sharePath,
       '구글 드라이브면 로그인 상태와 G: 드라이브를, 사내 공유폴더면 네트워크 연결을 확인하세요.');
  else ok('공유폴더 접근 가능: ' + CFG.sharePath);

  info('실행 시각: 매일 ' + CFG.runAt + ' (바꾸려면 config.json 수정 후 설치.bat 재실행)');
  info('보관일수: ' + CFG.keepDays + '일 (이보다 오래된 캡쳐는 자동 삭제)');
  info('웹 게시(GitHub): ' + (CFG.useWebPublish ? '사용함' : '사용 안 함'));
  info('변경 없어도 매일 알림: ' + (CFG.sendWhenNoChange ? '보냄' : '안 보냄'));
}

// ─── 3. 감시 대상 ───────────────────────────────
console.log('\n[3] 감시 대상 (urls.csv)');
if (!fs.existsSync('urls.csv')) {
  ng('urls.csv 가 없습니다', '감시할 사이트 목록 파일이 필요합니다.');
} else {
  const rows = fs.readFileSync('urls.csv', 'utf-8').split(/\r?\n/).slice(1)
    .filter(l => l.trim() && l.split(',')[1] && l.split(',')[1].trim().startsWith('http'));
  if (rows.length === 0) ng('urls.csv 에 유효한 사이트가 없습니다', '메모장으로 열어 URL 열을 확인하세요.');
  else ok(rows.length + '개 사이트 등록됨');
  // 메모장 외 프로그램으로 저장하면 한글이 깨지는 일이 잦아 함께 점검한다
  if (fs.readFileSync('urls.csv', 'utf-8').includes('�'))
    ng('urls.csv 의 한글이 깨져 있습니다', '메모장으로 열어 [다른 이름으로 저장] > 인코딩 UTF-8 로 저장하세요.');
}

// ─── 3-2. 쉬는날 설정 ───────────────────────────
console.log('\n[3-2] 쉬는날 설정 (쉬는날.txt)');
if (CFG && CFG.enabled === false) {
  ng('현재 전체 중지 상태입니다 → 매일 아침에 아무것도 실행되지 않습니다',
     'config.json 을 메모장으로 열어 "사용": true 로 바꾸세요.');
} else {
  ok('전체 실행 상태: 켜짐');
}
if (!fs.existsSync('쉬는날.txt')) {
  info('쉬는날.txt 가 없습니다 → 공휴일에도 실행됩니다 (주말은 자동으로 건너뜀)');
} else {
  const days = fs.readFileSync('쉬는날.txt', 'utf-8').replace(/^\uFEFF/, '').split(/\r?\n/)
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => l.split(/\s+/)[0]).filter(l => /^\d{4}-\d{2}-\d{2}$/.test(l));
  const future = days.filter(x => x >= todayKST());
  if (days.length === 0) info('쉬는날.txt 에 등록된 날짜가 없습니다');
  else if (future.length === 0)
    ng('쉬는날.txt 에 앞으로 남은 휴무일이 없습니다 → 다음 공휴일에도 실행됩니다',
       '쉬는날.txt 를 메모장으로 열어 올해/내년 공휴일을 채워 넣으세요.');
  else ok('쉬는날 ' + days.length + '일 등록됨 (앞으로 남은 날 ' + future.length + '일, 다음 휴무일 ' + future.sort()[0] + ')');
}

// ─── 4. 최근 실행 상태 ──────────────────────────
console.log('\n[4] 최근 실행 상태');
const SHOT = 'screenshots';
if (!fs.existsSync(SHOT)) {
  info('아직 한 번도 실행되지 않았습니다 (첫 실행 전이면 정상)');
} else {
  const days = fs.readdirSync(SHOT).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
  const last = days[days.length - 1];
  if (!last) { info('실행 기록이 없습니다'); }
  else {
    const today = todayKST();
    // 마지막 실행일로부터 며칠이 지났는지 (UTC 기준 계산으로 시간대 오차 방지)
    const gap = Math.round((new Date(today + 'T00:00:00Z') - new Date(last + 'T00:00:00Z')) / 86400000);
    if (gap === 0) ok('오늘(' + last + ') 실행됨');
    else if (gap <= 3) ok('마지막 실행: ' + last + ' (' + gap + '일 전)');
    else ng('마지막 실행이 ' + last + ' 입니다 (' + gap + '일 전) — 자동 실행이 멈춰 있을 수 있습니다',
            'PC가 켜져 있었는지, 아래 [5] 자동 실행 등록 상태를 확인하세요.');
  }
}

// copy.js 가 남긴 마지막 저장 결과
if (fs.existsSync('results/copy-status.json')) {
  try {
    const cs = JSON.parse(fs.readFileSync('results/copy-status.json', 'utf-8'));
    if (cs.skipped) info('공유폴더 저장: 사용 안 함 (설정)');
    else if (cs.ok) ok('마지막 공유폴더 저장: 성공');
    else ng('마지막 공유폴더 저장 실패 — ' + (cs.error || '원인 불명'), '위 [2]의 공유폴더 항목을 확인하세요.');
  } catch { info('저장 기록을 읽지 못했습니다'); }
}

// ─── 5. 자동 실행 등록 ──────────────────────────
console.log('\n[5] 자동 실행(작업 스케줄러) 등록');
const TASK_NAME = 'site-monitor-daily';

// 작업 이름을 직접 지정해 조회한다.
//  한글 Windows 는 schtasks 출력이 CP949 라서 목록을 글자로 훑으면 깨진다.
//  이름을 지정하면 "있으면 종료코드 0 / 없으면 1" 이라 인코딩과 무관하게 판정할 수 있다.
let registered = false, canQuery = true;
try {
  execSync('schtasks /Query /TN ' + TASK_NAME, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  registered = true;
} catch (e) {
  // schtasks 명령 자체를 못 찾은 경우(Windows 아님)와 "그런 작업 없음"을 구분한다.
  //  9009 = Windows cmd 의 '명령을 찾을 수 없음', 127 = 리눅스 셸의 같은 뜻
  if (e.code === 'ENOENT' || e.status === 9009 || e.status === 127) canQuery = false;
}

if (!canQuery) {
  info('작업 스케줄러를 확인할 수 없습니다 (Windows 가 아닌 환경)');
} else if (!registered) {
  ng('자동 실행이 등록되어 있지 않습니다 → 매일 아침 자동으로 돌지 않습니다',
     '설치.bat 을 마우스 오른쪽 클릭 > 관리자 권한으로 실행 해 보세요.');
} else {
  ok('자동 실행 등록됨: ' + TASK_NAME);

  // 등록된 작업이 "지금 이 폴더" 를 가리키는지 확인한다.
  //  폴더를 옮긴 뒤 설치.bat 을 다시 누르지 않으면 옛 경로를 계속 가리켜 조용히 실패한다.
  //
  //  경로에 한글이나 ★ 같은 글자가 있으면 schtasks 출력이 깨져 엉뚱하게 "다르다" 고 나온다.
  //  그래서 PowerShell 로 UTF-8 출력을 받아 정확히 비교하고,
  //  그게 안 되면 영문·숫자·기호만 남겨서 비교한다(한글이 깨져도 판정은 맞게).
  const norm = s => s.replace(/[\\\/]+$/, '').toLowerCase();
  const asciiOnly = s => norm(s).replace(/[^\x20-\x7e]/g, '');   // 깨질 수 있는 글자는 빼고 비교

  let taskDir = null, exact = false;
  try {
    const ps = 'powershell -NoProfile -ExecutionPolicy Bypass -Command '
             + '"[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; '
             + "(Get-ScheduledTask -TaskName '" + TASK_NAME + "' -ErrorAction Stop).Actions[0].WorkingDirectory\"";
    const out = execSync(ps, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim();
    if (out) { taskDir = out; exact = true; }
  } catch { /* PowerShell 로 못 읽으면 아래 XML 방식으로 */ }

  if (!taskDir) {
    try {
      const buf = execSync('schtasks /Query /TN ' + TASK_NAME + ' /XML ONE',
                           { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      let xml = buf.toString('utf16le');
      if (xml.indexOf('<Task') === -1) xml = buf.toString('utf8');
      const m = xml.match(/<WorkingDirectory>([^<]*)<\/WorkingDirectory>/);
      if (m) taskDir = m[1];
    } catch { /* 여기까지 실패하면 확인을 포기한다 */ }
  }

  if (!taskDir) {
    info('등록된 실행 폴더는 확인하지 못했습니다 (동작에는 문제 없습니다)');
  } else {
    const same = exact ? (norm(taskDir) === norm(process.cwd()))
                       : (asciiOnly(taskDir) === asciiOnly(process.cwd()));
    if (same) ok('등록된 실행 폴더가 지금 이 폴더와 같습니다');
    else ng('등록된 자동 실행이 다른 폴더를 가리킵니다: ' + taskDir,
            '지금 이 폴더(' + process.cwd() + ')에서 설치.bat 을 다시 더블클릭하면 새 경로로 등록됩니다.');
  }
}

// 예전 이름(사이트 모니터링)으로 등록된 작업이 남아 있으면 알림이 두 번 온다.
try {
  const listBuf = execSync('chcp 65001 >nul && schtasks /Query /FO CSV /NH',
                           { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  const txt = listBuf.toString('utf8');
  const hits = txt.split(/\r?\n/).filter(l => /site-monitor|사이트 모니터링/i.test(l));
  if (hits.length > 1) {
    ng('비슷한 자동 실행 작업이 ' + hits.length + '개 등록되어 있습니다 → 알림이 여러 번 올 수 있습니다',
       '작업 스케줄러를 열어 ' + TASK_NAME + ' 하나만 남기고 나머지는 삭제하세요.');
  }
} catch { /* 목록 조회 실패는 넘어간다 — 위의 이름 지정 조회가 본 판정이다 */ }

// ─── 결과 요약 ─────────────────────────────────
console.log('\n============================================');
if (problems.length === 0) {
  console.log(' 결과: 이상 없음. 정상 동작 중입니다.');
} else {
  console.log(' 결과: 문제 ' + problems.length + '건 — 아래 순서로 조치하세요.');
  problems.forEach((p, i) => {
    console.log('\n ' + (i + 1) + ') ' + p.msg);
    console.log('    → ' + p.fix);
  });
  console.log('\n 해결이 안 되면 이 창을 캡쳐해서 문의하세요.');
}
console.log('============================================\n');
