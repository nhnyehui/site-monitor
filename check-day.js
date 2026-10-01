// ============================================================
// check-day.js — 오늘 실행할 날인지 판단한다.
//   실행해야 하면 종료코드 0, 건너뛰어야 하면 1 을 돌려준다.
//   run.bat 이 이 값을 보고 진행 여부를 정한다.
//
// 건너뛰는 경우 세 가지
//   1) config.json 의 "사용" 이 false   → 당분간 전체 중지 (휴가 등)
//   2) 토요일·일요일
//   3) 쉬는날.txt 에 오늘 날짜가 적혀 있음 → 공휴일·사내 휴무일
// ============================================================
const fs = require('fs');

const HOLIDAY_FILE = '쉬는날.txt';

// 한국 시간 기준 오늘 날짜 (YYYY-MM-DD). 다른 스크립트들과 같은 기준을 쓴다.
function todayKST() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); }

// 한국 시간 기준 요일 (0=일요일, 6=토요일)
function weekdayKST() {
  const s = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' });
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(s);
}

// 쉬는날.txt 를 읽어 날짜 목록으로 만든다.
// '#' 으로 시작하는 줄과 빈 줄은 무시한다(메모용).
function loadHolidays() {
  if (!fs.existsSync(HOLIDAY_FILE)) return [];
  return fs.readFileSync(HOLIDAY_FILE, 'utf-8')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split(/\s+/)[0])            // "2026-10-05  개천절 대체" 처럼 뒤에 메모를 적어도 된다
    .filter(l => /^\d{4}-\d{2}-\d{2}$/.test(l));
}

const today = todayKST();

// (1) 전체 사용 여부
let enabled = true;
try {
  enabled = require('./config.js').load().enabled;
} catch { /* 설정을 못 읽으면 일단 실행한다 */ }

if (!enabled) {
  console.log('  실행 중지 상태입니다. (config.json 의 "사용" 이 false)');
  console.log('  다시 켜려면 config.json 을 메모장으로 열어 "사용": true 로 바꾸세요.');
  process.exit(1);
}

// (2) 주말
const wd = weekdayKST();
if (wd === 0 || wd === 6) {
  console.log('  주말(' + (wd === 0 ? '일' : '토') + ')이라 실행하지 않습니다.');
  process.exit(1);
}

// (3) 쉬는날
const holidays = loadHolidays();
if (holidays.includes(today)) {
  console.log('  쉬는날(' + today + ')로 등록되어 있어 실행하지 않습니다. — 쉬는날.txt');
  process.exit(1);
}

process.exit(0);
