// ============================================================
// config.js — 모든 설정을 한 곳에서 읽어오는 공용 모듈
//
// 우선순위: config.json  →  (없으면) 예전 방식인 낱개 txt 파일
//   예전 방식으로도 계속 동작하므로, config.json 이 없어도 툴은 멈추지 않습니다.
// 다른 스크립트들은 이 파일만 부르면 되고, 설정 파일 위치를 알 필요가 없습니다.
// ============================================================
const fs = require('fs');

// txt 파일 한 줄 읽기. 메모장이 앞에 붙이는 BOM(﻿)을 제거한다.
function readTxt(file) {
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '').trim();
}

function load() {
  let c = {};
  if (fs.existsSync('config.json')) {
    try {
      c = JSON.parse(fs.readFileSync('config.json', 'utf-8').replace(/^\uFEFF/, ''));
    } catch (e) {
      // 설정 파일이 깨졌는데 그냥 진행하면 엉뚱하게 동작하므로 여기서 멈춘다.
      console.error('');
      console.error('[오류] config.json 을 읽지 못했습니다: ' + e.message);
      console.error('       쉼표(,)가 빠졌거나 따옴표(")의 짝이 안 맞는 경우가 대부분입니다.');
      console.error('       진단.bat 을 실행하면 어디가 문제인지 알려줍니다.');
      console.error('');
      process.exit(1);
    }
  }

  // 값이 있으면 쓰고, 항목 자체가 없으면 예전 txt 파일을 본다.
  // 빈 문자열("")은 "일부러 비움"으로 보고 txt 로 되돌아가지 않는다.
  const pick = (key, legacyFile) => {
    const v = c[key];
    if (typeof v === 'string') return v.trim();
    if (legacyFile) return readTxt(legacyFile);
    return '';
  };

  return {
    webhook:   pick('두레이웹훅',     'webhook.txt'),
    sharePath: pick('공유폴더',       'share.txt'),
    driveLink: pick('드라이브링크',   'link.txt'),
    webLink:   pick('웹리포트링크',   'weblink.txt'),
    // 아래 두 개는 예전 txt 방식에 없던 항목이라 기본값을 둔다.
    enabled:          c['사용']         !== false,    // 기본 true (false 면 전체 중지)
    // 매일 자동 실행할 시각 (HH:MM). 바꾼 뒤에는 설치.bat 을 다시 눌러야 반영된다.
    runAt:            /^([01]\d|2[0-3]):[0-5]\d$/.test(String(c['실행시각'] || '')) ? String(c['실행시각']) : '09:00',
    // 캡쳐·비교이미지를 며칠치 보관할지. 공유폴더 저장이 막혀 있는 동안 로컬 기록이
    // 사라지지 않도록 기본을 넉넉히 60일로 둔다. config.json 에 값이 있으면 그 값을 쓴다.
    keepDays:         (typeof c['보관일수'] === 'number' && c['보관일수'] > 0) ? Math.floor(c['보관일수']) : 60,
    sendWhenNoChange: c['변경없어도알림'] !== false,  // 기본 true (매일 알림 → 툴이 살아있는지 확인 가능)
    useWebPublish:    c['웹게시사용']   === true,     // 기본 false (GitHub 업로드 안 함)
    // 웹(GitHub Pages)에 올려 둘 기간. 저장소가 무한정 커지지 않도록 기본 30일.
    webKeepDays:      (typeof c['웹보관일수'] === 'number' && c['웹보관일수'] > 0) ? Math.floor(c['웹보관일수']) : 30,
  };
}

module.exports = { load, readTxt };
