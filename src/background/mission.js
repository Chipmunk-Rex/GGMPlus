// Mission automation settings, alarms, execution, and logs.

const MISSION_LOG_STORAGE_KEY = "missionAutomationLogs";
const MISSION_STATE_STORAGE_KEY = "missionAutomationState";
const MAX_MISSION_LOGS = 80;

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeMissionTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeMissionSettings(raw = {}) {
  const defaults = DEFAULT_MISSION_SETTINGS;
  return {
    autoMissionEnabled: raw.autoMissionEnabled === true,
    missionIntervalMinutes: clampInteger(
      raw.missionIntervalMinutes,
      15,
      1440,
      defaults.missionIntervalMinutes,
    ),
    missionRunTime: normalizeMissionTime(raw.missionRunTime),
    enablePortfolioVisitMission: raw.enablePortfolioVisitMission !== false,
    portfolioVisitUserId: 1,
    enablePortfolioRate: raw.enablePortfolioRate !== false,
    portfolioRatePortfolioId: clampInteger(
      raw.portfolioRatePortfolioId,
      1,
      99999999,
      defaults.portfolioRatePortfolioId,
    ),
    portfolioRateScore: clampInteger(raw.portfolioRateScore, 1, 5, defaults.portfolioRateScore),
    portfolioRateComment: String(
      raw.portfolioRateComment === undefined
        ? defaults.portfolioRateComment
        : raw.portfolioRateComment,
    ).slice(0, 300),
    enableCheerComment: raw.enableCheerComment !== false,
    cheerTargetUserId: clampInteger(raw.cheerTargetUserId, 1, 99999999, defaults.cheerTargetUserId),
    cheerContent: String(raw.cheerContent || defaults.cheerContent).slice(0, 200),
  };
}

async function getMissionSettings() {
  const keys = Object.keys(DEFAULT_MISSION_SETTINGS);
  const stored = await chrome.storage.local.get(keys);
  return normalizeMissionSettings(stored);
}

async function saveMissionSettings(settings = {}) {
  const normalized = normalizeMissionSettings(settings);
  await chrome.storage.local.set(normalized);
  await setupMissionAlarm(normalized);
  return normalized;
}

function getNextMissionRunAt(settings) {
  if (!settings.missionRunTime) return null;

  const [hour, minute] = settings.missionRunTime.split(":").map(Number);
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

async function setupMissionAlarm(config = null) {
  const settings = config || await getMissionSettings();

  await chrome.alarms.clear(MISSION_ALARM_NAME);
  if (!settings.autoMissionEnabled) {
    console.log("[GGMAuto] Mission automation alarm disabled.");
    return;
  }

  const nextRun = getNextMissionRunAt(settings);
  if (nextRun) {
    await chrome.alarms.create(MISSION_ALARM_NAME, {
      when: nextRun.getTime(),
      periodInMinutes: 1440,
    });
    console.log(`[GGMAuto] Mission automation alarm set: ${nextRun.toLocaleString()}`);
    return;
  }

  const interval = Math.max(15, Number(settings.missionIntervalMinutes) || 60);
  await chrome.alarms.create(MISSION_ALARM_NAME, {
    delayInMinutes: Math.min(5, interval),
    periodInMinutes: interval,
  });
  console.log(`[GGMAuto] Mission automation interval set: ${interval} minutes.`);
}

async function getMissionState() {
  const stored = await chrome.storage.local.get([MISSION_STATE_STORAGE_KEY]);
  return stored[MISSION_STATE_STORAGE_KEY] || {};
}

async function setMissionState(state) {
  await chrome.storage.local.set({ [MISSION_STATE_STORAGE_KEY]: state });
}

function getMissionList(data) {
  return extractArray(data, ["missions", "list", "data", "items"]);
}

function getMissionKey(mission) {
  return String(mission && (mission.key || mission.mission_key || mission.id || mission.name) || "");
}

function isMissionCompleted(mission) {
  if (!mission) return false;
  if (mission.completed === true || mission.is_completed === true) return true;
  if (mission.completed === 1 || mission.is_completed === 1) return true;

  const progress = Number(mission.progress ?? mission.count ?? mission.current ?? 0);
  const target = Number(mission.target_count ?? mission.target ?? mission.required_count ?? 1);
  return Number.isFinite(progress) && Number.isFinite(target) && target > 0 && progress >= target;
}

function isMissionRewardClaimed(mission) {
  return (
    mission &&
    (mission.gold_claimed === true ||
      mission.gold_claimed === 1 ||
      mission.claimed === true ||
      mission.reward_claimed === true)
  );
}

function getMissionPeriodKey(data, fallback) {
  return String(data && (data.period_key || data.periodKey || data.week_key || data.date) || fallback);
}

function findMissionByKey(missions, patterns) {
  return missions.find((mission) => {
    const key = getMissionKey(mission);
    return patterns.some((pattern) => pattern.test(key));
  });
}

async function appendMissionLog(entry) {
  const stored = await chrome.storage.local.get([MISSION_LOG_STORAGE_KEY]);
  const logs = Array.isArray(stored[MISSION_LOG_STORAGE_KEY])
    ? stored[MISSION_LOG_STORAGE_KEY]
    : [];
  const nextLogs = [{
    time: new Date().toISOString(),
    ...entry,
  }, ...logs].slice(0, MAX_MISSION_LOGS);

  await chrome.storage.local.set({ [MISSION_LOG_STORAGE_KEY]: nextLogs });
  return nextLogs;
}

async function saveMissionRunActivity(summary) {
  const message = summary.success
    ? `Mission automation finished: ${summary.actions.length} actions.`
    : `Mission automation failed: ${summary.errors.length} errors.`;

  await appendMissionLog({
    success: summary.success,
    message,
    details: summary,
  });

  await saveActivity(
    summary.success ? "mission" : "mission-error",
    "자동 미션",
    message,
    null,
    summary,
  );
}

async function getMissionLogs() {
  const stored = await chrome.storage.local.get([MISSION_LOG_STORAGE_KEY]);
  return Array.isArray(stored[MISSION_LOG_STORAGE_KEY]) ? stored[MISSION_LOG_STORAGE_KEY] : [];
}

async function clearMissionLogs() {
  await chrome.storage.local.remove([MISSION_LOG_STORAGE_KEY]);
}

async function fetchDailyMissions() {
  return await requestGgmApi("/api/mission/daily");
}

async function fetchWeeklyMissions() {
  return await requestGgmApi("/api/mission/weekly");
}

async function trackMissionAction(action, payload = {}) {
  return await requestGgmApi("/api/mission/track", {
    method: "POST",
    body: {
      action,
      ...payload,
    },
  });
}

async function runPortfolioVisitMissionIfEnabled(context = {}) {
  const settings = context.settings || await getMissionSettings();
  if (!settings.enablePortfolioVisitMission) {
    return { executed: false, reason: "disabled" };
  }

  const dailyData = context.dailyData || await fetchDailyMissions();
  const missions = getMissionList(dailyData);
  const mission = findMissionByKey(missions, [/^portfolio_visit$/, /portfolio.*visit/]);
  if (!mission) return { executed: false, reason: "mission-not-found" };
  if (isMissionCompleted(mission)) return { executed: false, reason: "already-completed" };

  const periodKey = getMissionPeriodKey(dailyData, getSiteDateKey());
  const state = context.state || await getMissionState();
  if (state.portfolioVisitPeriod === periodKey) {
    return { executed: false, reason: "already-run-this-period" };
  }

  await trackMissionAction("portfolio_visit", {
    profile_user_id: 1,
  });

  state.portfolioVisitPeriod = periodKey;
  if (!context.state) await setMissionState(state);
  return { executed: true, key: getMissionKey(mission) };
}

async function runPortfolioRateMissionIfEnabled(context = {}) {
  const settings = context.settings || await getMissionSettings();
  if (!settings.enablePortfolioRate) {
    return { executed: false, reason: "disabled" };
  }

  const weeklyData = context.weeklyData || await fetchWeeklyMissions();
  const dailyData = context.dailyData || null;
  const missions = [
    ...getMissionList(dailyData),
    ...getMissionList(weeklyData),
  ];
  const mission = findMissionByKey(missions, [/portfolio.*rate/, /portfolio_rating/]);
  if (mission && isMissionCompleted(mission)) {
    return { executed: false, reason: "already-completed" };
  }

  const periodKey = getMissionPeriodKey(weeklyData, getSiteDateKey());
  const state = context.state || await getMissionState();
  if (state.portfolioRatePeriod === periodKey) {
    return { executed: false, reason: "already-run-this-period" };
  }

  await requestGgmApi(`/api/portfolio/${settings.portfolioRatePortfolioId}/rating`, {
    method: "POST",
    body: {
      rating: settings.portfolioRateScore,
      comment: settings.portfolioRateComment,
    },
  });

  state.portfolioRatePeriod = periodKey;
  if (!context.state) await setMissionState(state);
  return { executed: true, key: mission ? getMissionKey(mission) : "portfolio_rate" };
}

async function runCheerMissionIfEnabled(context = {}) {
  const settings = context.settings || await getMissionSettings();
  if (!settings.enableCheerComment) {
    return { executed: false, reason: "disabled" };
  }

  const weeklyData = context.weeklyData || await fetchWeeklyMissions();
  const dailyData = context.dailyData || null;
  const missions = [
    ...getMissionList(dailyData),
    ...getMissionList(weeklyData),
  ];
  const mission = findMissionByKey(missions, [/cheer.*comment/, /cheer_?3times/, /cheer/]);
  if (mission && isMissionCompleted(mission)) {
    return { executed: false, reason: "already-completed" };
  }

  const today = getSiteDateKey();
  const state = context.state || await getMissionState();
  if (state.cheerCommentDate === today) {
    return { executed: false, reason: "already-run-today" };
  }

  await requestGgmApi(`/api/user/${settings.cheerTargetUserId}/cheer`, {
    method: "POST",
    body: {
      content: settings.cheerContent,
    },
  });

  state.cheerCommentDate = today;
  if (!context.state) await setMissionState(state);
  return { executed: true, key: mission ? getMissionKey(mission) : "cheer_comment" };
}

function collectSkippedStockMissions(dailyData, summary) {
  const stockMission = findMissionByKey(getMissionList(dailyData), [/stock/]);
  if (stockMission && !isMissionCompleted(stockMission)) {
    summary.skipped.push({
      key: getMissionKey(stockMission),
      reason: "stock-automation-excluded",
    });
  }
}

async function runMissionAutomation(options = {}) {
  const settings = options.settings || await getMissionSettings();
  const summary = {
    success: true,
    manual: options.manual === true,
    startedAt: new Date().toISOString(),
    actions: [],
    skipped: [],
    errors: [],
  };

  if (!settings.autoMissionEnabled) {
    summary.skipped.push({ reason: "disabled" });
    await saveMissionRunActivity(summary);
    return summary;
  }

  const state = await getMissionState();
  let dailyData = null;
  let weeklyData = null;

  try {
    dailyData = await fetchDailyMissions();
    weeklyData = await fetchWeeklyMissions();

    const portfolioVisit = await runPortfolioVisitMissionIfEnabled({ settings, dailyData, state });
    if (portfolioVisit.executed) {
      summary.actions.push({ action: "portfolio_visit", key: portfolioVisit.key });
    } else {
      summary.skipped.push({ action: "portfolio_visit", reason: portfolioVisit.reason });
    }

    collectSkippedStockMissions(dailyData, summary);

    const portfolioRate = await runPortfolioRateMissionIfEnabled({
      settings,
      dailyData,
      weeklyData,
      state,
    });
    if (portfolioRate.executed) {
      summary.actions.push({ action: "portfolio_rate", key: portfolioRate.key });
    } else if (portfolioRate.reason !== "disabled") {
      summary.skipped.push({ action: "portfolio_rate", reason: portfolioRate.reason });
    }

    const cheer = await runCheerMissionIfEnabled({
      settings,
      dailyData,
      weeklyData,
      state,
    });
    if (cheer.executed) {
      summary.actions.push({ action: "cheer_comment", key: cheer.key });
    } else if (cheer.reason !== "disabled") {
      summary.skipped.push({ action: "cheer_comment", reason: cheer.reason });
    }

    await setMissionState(state);
  } catch (error) {
    console.error("[GGMAuto] Mission automation failed:", error);
    summary.success = false;
    summary.errors.push(error.message || String(error));
  }

  summary.finishedAt = new Date().toISOString();
  if (summary.errors.length > 0) {
    summary.success = false;
  }

  await saveMissionRunActivity(summary);
  return summary;
}
