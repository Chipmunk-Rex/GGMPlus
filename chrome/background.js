const ext = globalThis.browser ?? globalThis.chrome;

const TARGET_DOMAIN = "ggm.gondr.net";
const ATTENDANCE_API_URL = "https://ggm.gondr.net/api/town/goldbox/attendance";

const DEFAULT_ALARM_CONFIG = {
  recurringName: "attendanceAlarm",
  dailyName: "dailyMidnightAlarm",
  startupName: "startupAttendanceAlarm",
  delayInMinutes: 1,
  periodInMinutes: 1440,
};

const TOKEN_REFRESH_CONFIG = {
  refreshUrl: "https://ggm.gondr.net",
  waitTimeMs: 5000,
  autoRefresh: true,
};

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

async function getAlarmConfig() {
  const stored = await ext.storage.local.get([
    "alarmDelayMinutes",
    "alarmPeriodMinutes",
  ]);

  return {
    delayInMinutes:
      stored.alarmDelayMinutes ?? DEFAULT_ALARM_CONFIG.delayInMinutes,
    periodInMinutes:
      stored.alarmPeriodMinutes ?? DEFAULT_ALARM_CONFIG.periodInMinutes,
  };
}

async function getBearerToken() {
  try {
    const result = await ext.storage.local.get(["bearerToken", "tokenExpiry"]);

    if (!result.bearerToken) {
      console.warn("[GGMPlus] No bearer token found.");
      return null;
    }

    if (result.tokenExpiry && Date.now() > result.tokenExpiry) {
      console.warn("[GGMPlus] Stored bearer token has expired.");
      return null;
    }

    return result.bearerToken;
  } catch (error) {
    console.error("[GGMPlus] Failed to read bearer token:", error);
    return null;
  }
}

async function getXsrfToken() {
  try {
    const cookie = await ext.cookies.get({
      url: `https://${TARGET_DOMAIN}`,
      name: "XSRF-TOKEN",
    });

    return cookie ? decodeURIComponent(cookie.value) : null;
  } catch (error) {
    console.error("[GGMPlus] Failed to read XSRF cookie:", error);
    return null;
  }
}

async function refreshTokenAutomatically() {
  if (!TOKEN_REFRESH_CONFIG.autoRefresh) {
    return false;
  }

  let tabId = null;

  try {
    const tab = await ext.tabs.create({
      url: TOKEN_REFRESH_CONFIG.refreshUrl,
      active: false,
    });
    tabId = tab.id;

    await new Promise((resolve) => {
      setTimeout(resolve, TOKEN_REFRESH_CONFIG.waitTimeMs);
    });

    const token = await getBearerToken();
    return !!token;
  } catch (error) {
    console.error("[GGMPlus] Automatic token refresh failed:", error);
    return false;
  } finally {
    if (tabId !== null) {
      try {
        await ext.tabs.remove(tabId);
      } catch (error) {
        console.warn("[GGMPlus] Refresh tab was already closed:", error);
      }
    }
  }
}

async function saveAttendanceResult(success, message, alreadyChecked = false) {
  const now = new Date();
  const record = {
    lastAttempt: now.toISOString(),
    lastAttemptReadable: now.toLocaleString("ko-KR"),
    success,
    message,
  };

  if (success) {
    record.lastSuccess = now.toISOString();
    record.lastSuccessReadable = now.toLocaleString("ko-KR");
    record.todayChecked = getTodayString();
    record.alreadyCheckedToday = alreadyChecked;
  }

  const existing = await ext.storage.local.get(["attendanceHistory"]);
  const history = existing.attendanceHistory || [];
  history.unshift(record);

  if (history.length > 100) {
    history.pop();
  }

  await ext.storage.local.set({
    ...record,
    attendanceHistory: history,
  });
}

function showNotification(title, message) {
  ext.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: `[GGMPlus] ${title}`,
    message,
  });
}

async function sendAttendance(retryAfterRefresh = true) {
  try {
    let bearerToken = await getBearerToken();
    const xsrfToken = await getXsrfToken();

    if (!bearerToken && retryAfterRefresh) {
      const refreshed = await refreshTokenAutomatically();
      if (refreshed) {
        return sendAttendance(false);
      }
    }

    if (!bearerToken) {
      const errorMessage = "Login is required before attendance can run.";
      await saveAttendanceResult(false, errorMessage);
      showNotification("Attendance failed", errorMessage);
      return { success: false, error: errorMessage };
    }

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${bearerToken}`,
    };

    if (xsrfToken) {
      headers["X-XSRF-TOKEN"] = xsrfToken;
    }

    const response = await fetch(ATTENDANCE_API_URL, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({}),
    });

    const responseText = await response.text();
    let message = responseText;

    try {
      const parsed = JSON.parse(responseText);
      if (parsed.msg) {
        message = parsed.msg;
      }
    } catch (error) {
      // Keep the raw text response when JSON parsing is not possible.
    }

    if (response.ok) {
      await saveAttendanceResult(true, message);
      showNotification("Attendance complete", "Attendance check succeeded.");
      return { success: true, data: responseText };
    }

    if (response.status === 400) {
      const alreadyChecked =
        /already|done|duplicate|exist|complete|today|completed/i.test(message);

      if (alreadyChecked) {
        await saveAttendanceResult(true, "Attendance already completed today.", true);
        return { success: true, alreadyChecked: true, data: responseText };
      }
    }

    if (response.status === 401 || response.status === 403) {
      await ext.storage.local.remove(["bearerToken", "tokenExpiry"]);
    }

    const errorMessage = `HTTP ${response.status}: ${message}`;
    await saveAttendanceResult(false, errorMessage);
    showNotification("Attendance failed", errorMessage);
    return { success: false, error: errorMessage };
  } catch (error) {
    const errorMessage = error?.message || "Unknown network error";
    await saveAttendanceResult(false, errorMessage);
    showNotification("Attendance failed", errorMessage);
    return { success: false, error: errorMessage };
  }
}

async function isTodayChecked() {
  const data = await ext.storage.local.get(["todayChecked"]);
  return data.todayChecked === getTodayString();
}

function getMinutesUntilMidnight() {
  const now = new Date();
  const nextMidnight = new Date();
  nextMidnight.setHours(24, 0, 30, 0);
  return Math.ceil((nextMidnight - now) / 60000);
}

async function setupMidnightAlarm() {
  await ext.alarms.clear(DEFAULT_ALARM_CONFIG.dailyName);
  await ext.alarms.create(DEFAULT_ALARM_CONFIG.dailyName, {
    delayInMinutes: getMinutesUntilMidnight(),
    periodInMinutes: 1440,
  });
}

async function scheduleStartupAlarm() {
  await ext.alarms.clear(DEFAULT_ALARM_CONFIG.startupName);
  await ext.alarms.create(DEFAULT_ALARM_CONFIG.startupName, {
    delayInMinutes: DEFAULT_ALARM_CONFIG.delayInMinutes,
  });
}

async function setupRecurringAlarm(delayInMinutes, periodInMinutes) {
  await ext.alarms.clear(DEFAULT_ALARM_CONFIG.recurringName);
  await ext.alarms.create(DEFAULT_ALARM_CONFIG.recurringName, {
    delayInMinutes,
    periodInMinutes,
  });
}

async function checkAndAttend() {
  if (!(await isTodayChecked())) {
    await sendAttendance();
  }
}

async function initializeAlarms() {
  const config = await getAlarmConfig();
  await setupMidnightAlarm();
  await setupRecurringAlarm(config.delayInMinutes, config.periodInMinutes);
  await scheduleStartupAlarm();
}

ext.runtime.onInstalled.addListener(async (details) => {
  console.log("[GGMPlus] Installed:", details.reason);
  await initializeAlarms();

  if (details.reason === "install") {
    showNotification("Extension installed", "Open GGM and log in to capture your token.");
  }
});

ext.runtime.onStartup.addListener(async () => {
  console.log("[GGMPlus] Browser startup");
  await initializeAlarms();
});

ext.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === DEFAULT_ALARM_CONFIG.dailyName) {
    await setupMidnightAlarm();
    await sendAttendance();
    return;
  }

  if (
    alarm.name === DEFAULT_ALARM_CONFIG.startupName ||
    alarm.name === DEFAULT_ALARM_CONFIG.recurringName
  ) {
    await checkAndAttend();
  }
});

ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "TOKEN_UPDATE") {
    const storageData = {
      bearerToken: message.data.token,
      tokenExpiry: message.data.expiry || null,
      tokenUpdatedAt: new Date().toISOString(),
    };

    if (message.data.userInfo) {
      storageData.userName =
        message.data.userInfo.name ||
        message.data.userInfo.username ||
        message.data.userInfo.id ||
        null;
      storageData.userInfo = message.data.userInfo;
    }

    ext.storage.local.set(storageData).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "MANUAL_ATTENDANCE") {
    sendAttendance().then((result) => sendResponse(result));
    return true;
  }

  if (message.type === "GET_STATUS") {
    ext.storage.local
      .get([
        "bearerToken",
        "userName",
        "lastAttempt",
        "lastSuccess",
        "success",
        "todayChecked",
      ])
      .then((data) => {
        sendResponse({
          hasToken: !!data.bearerToken,
          userName: data.userName || null,
          lastAttempt: data.lastAttempt || null,
          lastSuccess: data.lastSuccess || null,
          lastResult: data.success ?? null,
          todayChecked: data.todayChecked === getTodayString(),
        });
      });
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    getAlarmConfig().then((config) => sendResponse(config));
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    (async () => {
      try {
        const { delayInMinutes, periodInMinutes } = message.data;
        await ext.storage.local.set({
          alarmDelayMinutes: delayInMinutes,
          alarmPeriodMinutes: periodInMinutes,
        });
        await setupRecurringAlarm(delayInMinutes, periodInMinutes);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === "GET_LOGS") {
    ext.storage.local
      .get(["attendanceHistory"])
      .then((data) => sendResponse({ logs: data.attendanceHistory || [] }));
    return true;
  }

  if (message.type === "CLEAR_LOGS") {
    ext.storage.local.remove(["attendanceHistory"]).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "RESET_ALL") {
    (async () => {
      try {
        await ext.storage.local.clear();
        await ext.alarms.clear(DEFAULT_ALARM_CONFIG.recurringName);
        await ext.alarms.clear(DEFAULT_ALARM_CONFIG.dailyName);
        await ext.alarms.clear(DEFAULT_ALARM_CONFIG.startupName);
        await initializeAlarms();
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  return false;
});

console.log("[GGMPlus] Background initialized");
