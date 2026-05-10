// Runtime message handlers.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MESSAGE_TYPES.TOKEN_UPDATE) {
    console.log(
      "[GGMAuto] 🔑 토큰 업데이트 수신:",
      message.data ? "토큰 있음" : "토큰 없음",
    );

    const storageData = {
      bearerToken: message.data.token,
      tokenType: message.data.type || "Bearer",
      spaToken: message.data.spaToken || null,
      csrfToken: message.data.csrfToken || null,
      tokenExpiry: normalizeTokenExpiry(message.data.expiry),
      tokenUpdatedAt: new Date().toISOString(),
    };

    // 사용자 정보가 있으면 함께 저장
    if (message.data.userInfo) {
      storageData.userName =
        message.data.userInfo.name ||
        message.data.userInfo.username ||
        message.data.userInfo.id ||
        null;
      storageData.userInfo = message.data.userInfo;
      console.log("[GGMAuto] 👤 사용자 정보:", storageData.userName);
    }

    chrome.storage.local.set(storageData).then(() => {
      console.log("[GGMAuto] 💾 토큰 저장 완료");
      sendResponse({ success: true });
    });

    return true; // 비동기 응답을 위해 true 반환
  }

  // 수동 출석체크 요청 (팝업 등에서 사용)
  if (message.type === MESSAGE_TYPES.MANUAL_ATTENDANCE) {
    console.log("[GGMAuto] 🖱️ 수동 출석체크 요청");
    sendAttendance().then((result) => {
      sendResponse(result);
    });
    return true;
  }

  // 상태 조회
  if (message.type === MESSAGE_TYPES.GET_STATUS) {
    chrome.storage.local
      .get([
        "bearerToken",
        "userName",
        "lastAttempt",
        "lastSuccess",
        "success",
        "todayChecked",
      ])
      .then((data) => {
        const today = getSiteDateKey();
        const isTodayChecked = data.todayChecked === today;

        sendResponse({
          hasToken: !!data.bearerToken,
          userName: data.userName || null,
          lastAttempt: data.lastAttempt,
          lastSuccess: data.lastSuccess,
          lastResult: data.success,
          todayChecked: isTodayChecked,
        });
      });
    return true;
  }

  // 설정 조회
  if (message.type === MESSAGE_TYPES.GET_SETTINGS) {
    getAlarmConfig().then((config) => {
      sendResponse({
        delayInMinutes: config.delayInMinutes,
        periodInMinutes: config.periodInMinutes,
      });
    });
    return true;
  }

  // 설정 저장
  if (message.type === MESSAGE_TYPES.SAVE_SETTINGS) {
    (async () => {
      try {
        const { delayInMinutes, periodInMinutes } = message.data;

        // 설정 저장
        await chrome.storage.local.set({
          alarmDelayMinutes: delayInMinutes,
          alarmPeriodMinutes: periodInMinutes,
        });

        await setupAttendanceAlarm({ delayInMinutes, periodInMinutes });

        console.log(
          `[GGMAuto] ⏰ 알람 설정 변경: ${delayInMinutes}분 후 첫 실행, ${periodInMinutes}분마다 반복`,
        );
        sendResponse({ success: true });
      } catch (error) {
        console.error("[GGMAuto] ❌ 설정 저장 실패:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 로그 조회
  if (message.type === MESSAGE_TYPES.GET_LOGS) {
    chrome.storage.local.get(["attendanceHistory"]).then((data) => {
      sendResponse({ logs: data.attendanceHistory || [] });
    });
    return true;
  }

  // 로그 삭제
  if (message.type === MESSAGE_TYPES.CLEAR_LOGS) {
    chrome.storage.local.remove(["attendanceHistory"]).then(() => {
      console.log("[GGMAuto] 🗑️ 로그 삭제됨");
      sendResponse({ success: true });
    });
    return true;
  }

  // 유틸리티 기능 설정 조회
  if (message.type === MESSAGE_TYPES.GET_FEATURE_SETTINGS) {
    getFeatureSettings().then((settings) => {
      sendResponse(settings);
    });
    return true;
  }

  // 유틸리티 기능 설정 저장
  if (message.type === MESSAGE_TYPES.SAVE_FEATURE_SETTINGS) {
    (async () => {
      try {
        const settings = await saveFeatureSettings(message.data || {});
        await setupUtilityMonitorAlarm(settings);
        await saveActivity(
          "settings",
          "알림 설정 변경",
          "유틸리티 알림 설정을 저장했습니다.",
        );
        sendResponse({ success: true, settings });
      } catch (error) {
        console.error("[GGMAuto] 유틸리티 설정 저장 실패:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 유틸리티 모니터 수동 실행
  if (message.type === MESSAGE_TYPES.RUN_UTILITY_MONITOR) {
    runUtilityMonitor({ manual: true }).then((summary) => {
      sendResponse({ success: true, summary });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === MESSAGE_TYPES.GET_AUTOMATION_RULES) {
    getAutomationRules().then((rules) => {
      sendResponse({ rules });
    }).catch((error) => {
      sendResponse({ rules: [], error: error.message });
    });
    return true;
  }

  if (message.type === MESSAGE_TYPES.SAVE_AUTOMATION_RULES) {
    (async () => {
      try {
        const rules = await saveAutomationRules(message.rules || []);
        await saveActivity(
          "settings",
          "자동 알림 설정 변경",
          "자동 알림 규칙을 저장했습니다.",
        );
        sendResponse({ success: true, rules });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === MESSAGE_TYPES.RESET_AUTOMATION_RULES) {
    (async () => {
      try {
        const rules = await saveAutomationRules(DEFAULT_AUTOMATION_RULES);
        sendResponse({ success: true, rules });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === MESSAGE_TYPES.RUN_AUTOMATION_RULE) {
    (async () => {
      const rules = await getAutomationRules();
      const rule = rules.find((item) => item.id === message.ruleId);
      if (!rule) {
        sendResponse({ success: false, error: "자동 알림을 찾지 못했습니다." });
        return;
      }

      const result = await runAutomationRule(rule, { manual: true });
      const nextRules = rules.map((item) => item.id === rule.id
        ? {
            ...item,
            lastRunAt: new Date().toISOString(),
            lastResult: result,
          }
        : item);
      await chrome.storage.local.set({ automationRules: nextRules });
      sendResponse(result);
    })().catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // GGM 페이지 열기
  if (message.type === MESSAGE_TYPES.GET_MISSION_SETTINGS) {
    getMissionSettings().then((settings) => {
      sendResponse({ settings });
    }).catch((error) => {
      sendResponse({ settings: DEFAULT_MISSION_SETTINGS, error: error.message });
    });
    return true;
  }

  if (message.type === MESSAGE_TYPES.SAVE_MISSION_SETTINGS) {
    (async () => {
      try {
        const settings = await saveMissionSettings(message.data || {});
        await saveActivity(
          "settings",
          "자동 미션 설정 변경",
          "자동 미션 설정을 저장했습니다.",
        );
        sendResponse({ success: true, settings });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === MESSAGE_TYPES.RUN_MISSION_AUTOMATION) {
    runMissionAutomation({ manual: true }).then((summary) => {
      sendResponse({ success: summary.success, summary });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === MESSAGE_TYPES.GET_MISSION_LOGS) {
    getMissionLogs().then((logs) => {
      sendResponse({ logs });
    }).catch((error) => {
      sendResponse({ logs: [], error: error.message });
    });
    return true;
  }

  if (message.type === MESSAGE_TYPES.CLEAR_MISSION_LOGS) {
    clearMissionLogs().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === MESSAGE_TYPES.GET_REWARD_SETTINGS) {
    getRewardSettings().then((settings) => {
      sendResponse({ settings });
    }).catch((error) => {
      sendResponse({ settings: DEFAULT_REWARD_SETTINGS, error: error.message });
    });
    return true;
  }

  if (message.type === MESSAGE_TYPES.SAVE_REWARD_SETTINGS) {
    (async () => {
      try {
        const settings = await saveRewardSettings(message.data || {});
        await saveActivity(
          "settings",
          "자동 수령 설정 변경",
          "자동 수령 설정을 저장했습니다.",
        );
        sendResponse({ success: true, settings });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === MESSAGE_TYPES.RUN_REWARD_AUTOMATION) {
    runRewardAutomation({ manual: true }).then((summary) => {
      sendResponse({ success: summary.success, summary });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === MESSAGE_TYPES.GET_REWARD_LOGS) {
    getRewardLogs().then((logs) => {
      sendResponse({ logs });
    }).catch((error) => {
      sendResponse({ logs: [], error: error.message });
    });
    return true;
  }

  if (message.type === MESSAGE_TYPES.CLEAR_REWARD_LOGS) {
    clearRewardLogs().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === MESSAGE_TYPES.OPEN_GGM_PAGE) {
    openGgmPage(message.url || "/").then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === MESSAGE_TYPES.OPEN_EXTENSION_PAGE) {
    const page = String(message.page || "popup.html").replace(/^\/+/, "");
    if (!/^[a-z0-9-]+\.html$/i.test(page)) {
      sendResponse({ success: false, error: "잘못된 페이지입니다." });
      return true;
    }
    chrome.tabs.create({ url: chrome.runtime.getURL(page) }).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // 활동 타임라인 조회
  if (message.type === MESSAGE_TYPES.GET_ACTIVITY) {
    chrome.storage.local.get(["activityTimeline"]).then((data) => {
      sendResponse({ items: data.activityTimeline || [] });
    });
    return true;
  }

  // 활동 타임라인 삭제
  if (message.type === MESSAGE_TYPES.CLEAR_ACTIVITY) {
    chrome.storage.local.remove(["activityTimeline"]).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // 글/댓글 임시저장 데이터 삭제
  if (message.type === MESSAGE_TYPES.GET_DRAFTS) {
    chrome.storage.local.get(["ggmDrafts"]).then((data) => {
      const drafts = data.ggmDrafts || {};
      sendResponse({
        items: Object.entries(drafts).map(([key, draft]) => ({
          key,
          preview: draft.preview || "",
          path: draft.path || "",
          updatedAt: draft.updatedAt || null,
        })),
      });
    });
    return true;
  }

  // 글/댓글 임시저장 데이터 삭제
  if (message.type === MESSAGE_TYPES.CLEAR_DRAFTS) {
    chrome.storage.local.remove(["ggmDrafts"]).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === MESSAGE_TYPES.GET_READ_POSTS) {
    chrome.storage.local.get(["ggmReadPosts"]).then((data) => {
      const readPosts = data.ggmReadPosts || {};
      sendResponse({
        items: Object.entries(readPosts).map(([key, item]) => ({
          key,
          title: item.title || "",
          path: item.path || key,
          readAt: item.readAt || null,
        })),
      });
    });
    return true;
  }

  if (message.type === MESSAGE_TYPES.CLEAR_READ_POSTS) {
    chrome.storage.local.remove(["ggmReadPosts"]).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // 전체 초기화
  if (message.type === MESSAGE_TYPES.RESET_ALL) {
    (async () => {
      try {
        // 모든 데이터 삭제
        await chrome.storage.local.clear();

        await setupMidnightAlarm();
        await setupAttendanceAlarm(DEFAULT_ALARM_CONFIG);
        await setupUtilityMonitorAlarm(DEFAULT_FEATURE_SETTINGS);
        await setupAutomationAlarms(DEFAULT_AUTOMATION_RULES);
        await setupMissionAlarm(DEFAULT_MISSION_SETTINGS);
        await setupRewardAlarm(DEFAULT_REWARD_SETTINGS);

        console.log("[GGMAuto] 🗑️ 전체 초기화 완료");
        sendResponse({ success: true });
      } catch (error) {
        console.error("[GGMAuto] ❌ 초기화 실패:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

// ============================================
// 🚀 초기화
// ============================================
