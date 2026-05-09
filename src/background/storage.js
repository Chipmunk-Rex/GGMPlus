// Storage normalization and access helpers.

function uniqueNumbers(values) {
  return [...new Set((values || [])
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0))];
}

function parseNumberList(value) {
  if (Array.isArray(value)) {
    return uniqueNumbers(value);
  }

  if (typeof value === "string") {
    return uniqueNumbers(value.split(/[\s,]+/));
  }

  return [];
}

function normalizeStringList(value, allowedValues, fallback = []) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[\s,]+/);
  const allowed = new Set(allowedValues);
  const cleaned = source
    .map((item) => String(item || "").trim())
    .filter((item) => allowed.has(item));
  const unique = [...new Set(cleaned)];
  return unique.length ? unique : fallback;
}

function normalizeBoardCategories(value) {
  const categories = Array.isArray(value) ? value : String(value || "").split(/[\s,]+/);
  const cleaned = categories
    .map((category) => String(category || "").trim().toLowerCase())
    .filter((category) => /^[a-z0-9_-]+$/.test(category));
  return [...new Set(cleaned)].slice(0, 6);
}

function normalizeFeatureSettings(raw = {}) {
  return {
    utilityMonitorIntervalMinutes: Math.max(
      5,
      Number.parseInt(
        raw.utilityMonitorIntervalMinutes ||
          DEFAULT_FEATURE_SETTINGS.utilityMonitorIntervalMinutes,
        10,
      ) || DEFAULT_FEATURE_SETTINGS.utilityMonitorIntervalMinutes,
    ),
    markReadPosts: raw.markReadPosts !== false,
    showFloatingPanel: raw.showFloatingPanel !== false,
    darkModeEnabled: raw.darkModeEnabled === true,
    homeFeatureOrder: [
      ...normalizeStringList(raw.homeFeatureOrder, HOME_FEATURE_IDS, HOME_FEATURE_IDS),
      ...HOME_FEATURE_IDS,
    ].filter((item, index, list) => list.indexOf(item) === index),
    hiddenHomeFeatures: normalizeStringList(raw.hiddenHomeFeatures, HOME_FEATURE_IDS, []),
    favoriteQuickLinks: normalizeStringList(
      raw.favoriteQuickLinks,
      QUICK_LINK_IDS,
      DEFAULT_FEATURE_SETTINGS.favoriteQuickLinks,
    ).slice(0, 6),
    notifyNewPosts: raw.notifyNewPosts !== false,
    notifyGoldboxQuest: raw.notifyGoldboxQuest !== false,
    notifyStockWatch: raw.notifyStockWatch !== false,
    watchedBoardCategories:
      normalizeBoardCategories(raw.watchedBoardCategories).length > 0
        ? normalizeBoardCategories(raw.watchedBoardCategories)
        : DEFAULT_FEATURE_SETTINGS.watchedBoardCategories,
    watchedCirclePostIds: parseNumberList(raw.watchedCirclePostIds),
    stockWatchCircleIds: parseNumberList(raw.stockWatchCircleIds),
  };
}

function hasEnabledUtilityMonitor(settings) {
  return (
    settings.notifyNewPosts ||
    settings.notifyGoldboxQuest ||
    settings.notifyStockWatch
  );
}

async function getFeatureSettings() {
  const keys = Object.keys(DEFAULT_FEATURE_SETTINGS);
  const stored = await chrome.storage.local.get(keys);
  return normalizeFeatureSettings(stored);
}

async function saveFeatureSettings(settings) {
  const normalized = normalizeFeatureSettings(settings);
  await chrome.storage.local.set(normalized);
  return normalized;
}

async function getAlarmConfig() {
  const stored = await chrome.storage.local.get([
    "alarmDelayMinutes",
    "alarmPeriodMinutes",
  ]);
  return {
    name: DEFAULT_ALARM_CONFIG.name,
    delayInMinutes:
      stored.alarmDelayMinutes || DEFAULT_ALARM_CONFIG.delayInMinutes,
    periodInMinutes:
      stored.alarmPeriodMinutes || DEFAULT_ALARM_CONFIG.periodInMinutes,
  };
}

// 📌 토큰 자동 갱신 설정
