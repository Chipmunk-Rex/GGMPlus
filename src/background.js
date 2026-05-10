// Chrome MV3 loads only this service worker; Firefox loads the same files from manifest background.scripts.
if (typeof importScripts === "function") {
  importScripts(
    "shared/constants.js",
    "shared/message-types.js",
    "shared/ggm-url.js",
    "background/config.js",
    "background/storage.js",
    "background/activity.js",
    "background/notifications.js",
    "background/auth.js",
    "background/utility-monitor.js",
    "background/automation.js",
    "background/attendance.js",
    "background/mission.js",
    "background/reward.js",
    "background/messages.js",
  );
}

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[GGMAuto] 📦 확장 프로그램 설치됨:", details.reason);

  // 자정 알람 설정
  await setupMidnightAlarm();
  await setupAttendanceAlarm();
  await setupUtilityMonitorAlarm();
  await setupAutomationAlarms();
  await setupMissionAlarm();
  await setupRewardAlarm();

  // 설치 알림
  if (details.reason === "install") {
    showNotification("설치 완료", "대상 사이트 방문하여 로그인해주세요.");
  }
  
  await scheduleInitialCheckAlarm();
});

/**
 * 브라우저 시작 시
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log("[GGMAuto] 🌅 브라우저 시작됨");

  // 자정 알람 재설정
  await setupMidnightAlarm();
  await setupAttendanceAlarm();
  await setupUtilityMonitorAlarm();
  await setupAutomationAlarms();
  await setupMissionAlarm();
  await setupRewardAlarm();
  
  await scheduleInitialCheckAlarm();
});

/**
 * 알람 발생 시 (자정)
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === DEFAULT_ALARM_CONFIG.dailyAlarmName) {
    console.log("[GGMAuto] ⏰ 자정 알람 트리거됨:", new Date().toLocaleString());
    
    // 다음 자정 알람 재설정 (정확한 시간 유지)
    await setupMidnightAlarm();
    
    // 출석체크 실행
    await sendAttendance();
  } else if (
    alarm.name === DEFAULT_ALARM_CONFIG.name ||
    alarm.name === DEFAULT_ALARM_CONFIG.initialCheckName
  ) {
    console.log("[GGMAuto] ⏰ 출석체크 알람 트리거됨:", alarm.name);
    await checkAndAttend();
  } else if (alarm.name === UTILITY_MONITOR_ALARM_NAME) {
    console.log("[GGMAuto] 유틸리티 모니터 알람 트리거됨");
    await runUtilityMonitor();
  } else if (alarm.name === MISSION_ALARM_NAME) {
    console.log("[GGMAuto] Mission automation alarm triggered.");
    await runMissionAutomation();
  } else if (alarm.name === REWARD_ALARM_NAME) {
    console.log("[GGMAuto] Reward automation alarm triggered.");
    await runRewardAutomation();
  } else if (alarm.name.startsWith(AUTOMATION_ALARM_PREFIX)) {
    const ruleId = alarm.name.slice(AUTOMATION_ALARM_PREFIX.length);
    const rules = await getAutomationRules();
    const rule = rules.find((item) => item.id === ruleId);
    if (rule) {
      const result = await runAutomationRule(rule);
      const nextRules = rules.map((item) => item.id === ruleId
        ? {
            ...item,
            lastRunAt: new Date().toISOString(),
            lastResult: result,
          }
        : item);
      await chrome.storage.local.set({ automationRules: nextRules });
      await setupAutomationAlarmForRule(rule);
    }
  }
});

console.log("[GGMAuto] Service worker started");
