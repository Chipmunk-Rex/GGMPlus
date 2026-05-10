// Reward claiming settings, alarms, execution, and logs.

const REWARD_LOG_STORAGE_KEY = "rewardAutomationLogs";
const MAX_REWARD_LOGS = 80;

function normalizeRewardTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeRewardInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeRewardSettings(raw = {}) {
  const defaults = DEFAULT_REWARD_SETTINGS;
  return {
    autoRewardEnabled: raw.autoRewardEnabled === true,
    rewardIntervalMinutes: normalizeRewardInteger(
      raw.rewardIntervalMinutes,
      15,
      1440,
      defaults.rewardIntervalMinutes,
    ),
    rewardRunTime: normalizeRewardTime(raw.rewardRunTime),
    rewardClaimDailyMissions: raw.rewardClaimDailyMissions !== false,
    rewardClaimWeeklyMissions: raw.rewardClaimWeeklyMissions !== false,
    rewardClaimMailbox: raw.rewardClaimMailbox !== false,
  };
}

async function getRewardSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_REWARD_SETTINGS));
  return normalizeRewardSettings(stored);
}

async function saveRewardSettings(settings = {}) {
  const normalized = normalizeRewardSettings(settings);
  await chrome.storage.local.set(normalized);
  await setupRewardAlarm(normalized);
  return normalized;
}

function getNextRewardRunAt(settings) {
  if (!settings.rewardRunTime) return null;

  const [hour, minute] = settings.rewardRunTime.split(":").map(Number);
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

async function setupRewardAlarm(config = null) {
  const settings = config || await getRewardSettings();

  await chrome.alarms.clear(REWARD_ALARM_NAME);
  if (!settings.autoRewardEnabled) {
    console.log("[GGMAuto] Reward automation alarm disabled.");
    return;
  }

  const nextRun = getNextRewardRunAt(settings);
  if (nextRun) {
    await chrome.alarms.create(REWARD_ALARM_NAME, {
      when: nextRun.getTime(),
      periodInMinutes: 1440,
    });
    console.log(`[GGMAuto] Reward automation alarm set: ${nextRun.toLocaleString()}`);
    return;
  }

  const interval = Math.max(15, Number(settings.rewardIntervalMinutes) || 60);
  await chrome.alarms.create(REWARD_ALARM_NAME, {
    delayInMinutes: Math.min(5, interval),
    periodInMinutes: interval,
  });
  console.log(`[GGMAuto] Reward automation interval set: ${interval} minutes.`);
}

async function appendRewardLog(entry) {
  const stored = await chrome.storage.local.get([REWARD_LOG_STORAGE_KEY]);
  const logs = Array.isArray(stored[REWARD_LOG_STORAGE_KEY])
    ? stored[REWARD_LOG_STORAGE_KEY]
    : [];
  const nextLogs = [{
    time: new Date().toISOString(),
    ...entry,
  }, ...logs].slice(0, MAX_REWARD_LOGS);

  await chrome.storage.local.set({ [REWARD_LOG_STORAGE_KEY]: nextLogs });
  return nextLogs;
}

async function getRewardLogs() {
  const stored = await chrome.storage.local.get([REWARD_LOG_STORAGE_KEY]);
  return Array.isArray(stored[REWARD_LOG_STORAGE_KEY]) ? stored[REWARD_LOG_STORAGE_KEY] : [];
}

async function clearRewardLogs() {
  await chrome.storage.local.remove([REWARD_LOG_STORAGE_KEY]);
}

function isRewardAlreadyHandledMessage(message) {
  return /already|claimed|received|duplicate|완료|수령|이미|없/i.test(message || "");
}

function isRewardAmountPresent(item) {
  if (!item || typeof item !== "object") return false;
  const gold = Number(item.gold || item.gold_amount || item.amount || 0);
  const piece = Number(item.piece || item.pieces || item.piece_amount || 0);
  return gold > 0 || piece > 0;
}

function isReceived(item) {
  if (!item || typeof item !== "object") return false;
  return item.received === 1
    || item.received === true
    || item.is_received === 1
    || item.is_received === true
    || item.received_at
    || item.receivedAt;
}

async function rewardClaimMissionReward(key) {
  if (!key) {
    throw new Error("Mission reward key is empty.");
  }

  return await requestGgmApi(`/api/mission/claim/${encodeURIComponent(key)}`, {
    method: "POST",
    body: {},
  });
}

async function rewardClaimCompletedMissionRewards(kind) {
  const data = kind === "weekly" ? await fetchWeeklyMissions() : await fetchDailyMissions();
  const missions = getMissionList(data);
  const claimed = [];
  const skipped = [];
  const errors = [];

  for (const mission of missions) {
    const key = getMissionKey(mission);
    if (!isMissionCompleted(mission)) {
      skipped.push({ key, reason: "not-completed" });
      continue;
    }

    if (isMissionRewardClaimed(mission)) {
      skipped.push({ key, reason: "already-claimed" });
      continue;
    }

    try {
      await rewardClaimMissionReward(key);
      claimed.push(key);
    } catch (error) {
      const message = error.message || String(error);
      if (isRewardAlreadyHandledMessage(message)) {
        skipped.push({ key, reason: "already-claimed" });
      } else {
        errors.push({ key, error: message });
      }
    }
  }

  return {
    kind,
    claimed,
    skipped,
    errors,
  };
}

async function rewardClaimMailboxRewards() {
  const goldbox = await requestGgmApi("/api/town/goldbox");
  const list = extractArray(goldbox, ["list", "data", "items", "mails"]);
  const rewardItems = list.filter((item) => !isReceived(item) && isRewardAmountPresent(item));
  const result = {
    checked: list.length,
    claimed: 0,
    skipped: list.length - rewardItems.length,
    errors: [],
  };

  if (rewardItems.length === 0) {
    return result;
  }

  try {
    await requestGgmApi("/api/town/goldbox/receive");
    result.claimed += rewardItems.length;
  } catch (error) {
    const message = error.message || String(error);
    if (isRewardAlreadyHandledMessage(message)) {
      result.skipped += rewardItems.length;
    } else {
      result.errors.push(message);
    }
  }

  const mailIds = rewardItems
    .map((item) => item.mail_id || item.mailId)
    .filter((id) => Number.isFinite(Number(id)));

  for (const mailId of mailIds) {
    try {
      await requestGgmApi(`/api/town/mail/receive/${encodeURIComponent(mailId)}`, {
        method: "PUT",
        body: {},
      });
    } catch (error) {
      const message = error.message || String(error);
      if (!isRewardAlreadyHandledMessage(message)) {
        result.errors.push(message);
      }
    }
  }

  return result;
}

async function saveRewardRunActivity(summary) {
  const message = summary.success
    ? `Reward automation finished: ${summary.claimedRewards} rewards claimed.`
    : `Reward automation failed: ${summary.errors.length} errors.`;

  await appendRewardLog({
    success: summary.success,
    message,
    details: summary,
  });

  await saveActivity(
    summary.success ? "reward" : "reward-error",
    "자동 수령",
    message,
    null,
    summary,
  );
}

async function runRewardAutomation(options = {}) {
  const settings = options.settings || await getRewardSettings();
  const summary = {
    success: true,
    manual: options.manual === true,
    startedAt: new Date().toISOString(),
    actions: [],
    claimedRewards: 0,
    errors: [],
    skipped: [],
  };

  if (!settings.autoRewardEnabled) {
    summary.skipped.push({ reason: "disabled" });
    await saveRewardRunActivity(summary);
    return summary;
  }

  try {
    if (settings.rewardClaimDailyMissions) {
      const result = await rewardClaimCompletedMissionRewards("daily");
      summary.claimedRewards += result.claimed.length;
      summary.actions.push({ action: "claim_daily_rewards", ...result });
      summary.errors.push(...result.errors.map((item) => `${item.key}: ${item.error}`));
    }

    if (settings.rewardClaimWeeklyMissions) {
      const result = await rewardClaimCompletedMissionRewards("weekly");
      summary.claimedRewards += result.claimed.length;
      summary.actions.push({ action: "claim_weekly_rewards", ...result });
      summary.errors.push(...result.errors.map((item) => `${item.key}: ${item.error}`));
    }

    if (settings.rewardClaimMailbox) {
      const result = await rewardClaimMailboxRewards();
      summary.claimedRewards += result.claimed || 0;
      summary.actions.push({ action: "claim_mailbox_rewards", ...result });
      summary.errors.push(...(result.errors || []));
    }
  } catch (error) {
    console.error("[GGMAuto] Reward automation failed:", error);
    summary.success = false;
    summary.errors.push(error.message || String(error));
  }

  summary.finishedAt = new Date().toISOString();
  if (summary.errors.length > 0) {
    summary.success = false;
  }

  await saveRewardRunActivity(summary);
  return summary;
}
