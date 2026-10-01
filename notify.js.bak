// ============================================================
// notify.js — 4단계: 점검 결과를 두레이(Dooray!) 메신저로 전송
// 실행 방법: node report.js 다음에 node notify.js
// 준비물:
//   webhook.txt — 두레이 웹훅 주소 한 줄
//   share.txt   — (선택) 공유폴더 경로 한 줄 (예: \\nas\team\site-monitor)
//                 있으면 메시지에 날짜별 리포트 경로가 함께 표시됩니다.
// ============================================================
const fs = require('fs');

// 변경 "없음"일 때도 매일 메시지를 보낼지 여부
// true = 매일 결과 전송 / false = 변경이 있거나 오류일 때만 전송
const SEND_WHEN_NO_CHANGE = true;

// 파일에서 설정 한 줄 읽기 (없으면 빈 문자열, 메모장 BOM 제거)
function readConfig(file) {
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf-8').replace(/^﻿/, '').trim();
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
  const webhookUrl = readConfig('webhook.txt');
  if (!webhookUrl) {
    console.log('webhook.txt 파일이 없어 메신저 전송을 건너뜁니다.');
    return;
  }
  if (!webhookUrl.startsWith('http')) {
    console.log('webhook.txt 안의 주소가 올바르지 않습니다.');
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
  const lines = [];
  lines.push(`[사이트 변경 점검] ${data.date}`);

  if (changed.length > 0) lines.push(`🔔 변경 있음 ${changed.length}건 (전체 ${data.results.length}개)`);
  else lines.push(`✅ 변경 없음 (전체 ${data.results.length}개)`);
  if (errors.length > 0) lines.push(`⚠️ 접속 오류 ${errors.length}건`);

  lines.push('');
  lines.push('사이트명 - 변경률 - 코멘트');
  for (const r of data.results) {
    const rate = r.status === 'ok' ? `${r.changeRate}%` : '-';
    const mark = r.changed ? '🔴 ' : '';
    lines.push(`${mark}${r.name} - ${rate} - ${commentFor(r)}`);
  }

  // weblink.txt = GitHub Pages 웹 리포트(바로 열림), link.txt = 구글 드라이브(원본)
  const pages = readConfig('weblink.txt');
  const drive = readConfig('link.txt');
  if (pages.startsWith('http') || drive.startsWith('http')) lines.push('');
  if (pages.startsWith('http')) lines.push(`📋 웹 리포트(바로 열림): ${pages}`);
  if (drive.startsWith('http')) lines.push(`🗂 원본 이미지(구글 드라이브): ${drive}`);

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
    console.error(`두레이 전송 실패: HTTP ${res.status} — webhook.txt의 주소를 확인하세요.`);
  }
})();