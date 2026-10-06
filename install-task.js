// ============================================================
// install-task.js — 윈도우 작업 스케줄러에 "매일 아침 9시 실행" 을 등록한다.
// 배치에서 직접 등록하면 폴더 경로의 공백·한글·특수문자(★) 때문에 자주 깨지므로,
// Node 가 작업 정의 XML 을 만들어 schtasks 로 등록한다. (경로가 어디든 안전)
// ============================================================
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const TASK_NAME = 'site-monitor-daily';   // 영문 이름 — 한글 이름은 인코딩 문제를 일으킬 수 있다

// 실행 시각은 config.json 의 "실행시각" 에서 읽는다 (없으면 09:00)
let RUN_AT = '09:00:00';
try { RUN_AT = require('./config.js').load().runAt + ':00'; } catch { /* 설정을 못 읽으면 기본값 */ }

const dir = process.cwd();
const runBat = path.join(dir, 'run.bat');

if (!fs.existsSync(runBat)) {
  console.error('  run.bat 을 찾을 수 없어 자동 실행 등록을 건너뜁니다: ' + runBat);
  process.exit(0);
}

// XML 에 넣을 수 없는 문자를 바꾼다
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>LG U+ 랜딩페이지 캡쳐 모니터링 - 매일 09:00 실행 (주말은 run.bat 이 스스로 건너뜀)</Description>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2026-01-01T${RUN_AT}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <WakeToRun>false</WakeToRun>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>cmd.exe</Command>
      <Arguments>/c "${esc(runBat)}"</Arguments>
      <WorkingDirectory>${esc(dir)}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>`;

// schtasks /XML 은 UTF-16 파일을 요구한다 (BOM 포함)
const xmlPath = path.join(os.tmpdir(), 'site-monitor-task.xml');
fs.writeFileSync(xmlPath, '﻿' + xml, 'utf16le');

try {
  execFileSync('schtasks', ['/Create', '/TN', TASK_NAME, '/XML', xmlPath, '/F'],
               { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  console.log('  자동 실행 등록 완료 — 작업 이름 "' + TASK_NAME + '", 매일 ' + RUN_AT.slice(0, 5));
  console.log('  ("예약된 시작을 놓친 경우 즉시 실행" 옵션이 켜져 있어, 9시에 PC가 꺼져 있었어도');
  console.log('   켜는 순간 그날 분이 실행됩니다)');
} catch (e) {
  const msg = (e.stderr || e.stdout || '').toString().trim() || e.message;
  console.error('  [주의] 자동 실행 등록에 실패했습니다: ' + msg);
  console.error('  설치.bat 을 마우스 오른쪽 클릭 > 관리자 권한으로 실행 으로 다시 시도해 보세요.');
} finally {
  try { fs.unlinkSync(xmlPath); } catch {}
}
