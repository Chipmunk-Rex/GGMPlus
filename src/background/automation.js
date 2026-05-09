// Automation rule normalization, scheduling, and execution.

function createRuleId() {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTime(value, fallback = "21:00") {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeDaysOfWeek(value) {
  const days = Array.isArray(value) ? value : [];
  const normalized = [...new Set(days
    .map((day) => Number.parseInt(day, 10))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  return normalized.length ? normalized : [1, 2, 3, 4, 5];
}

function normalizeCondition(condition = {}) {
  const type = CONDITION_TYPES.includes(condition.type) ? condition.type : "always";
  return {
    type,
    options: {
      ...(condition.options || {}),
    },
  };
}

function normalizeAction(action = {}) {
  const type = ACTION_TYPES.includes(action.type) ? action.type : "notify";
  const options = action.options || {};

  if (type === "notify") {
    return {
      type,
      options: {
        title: String(options.title || "GGMPlus 자동 알림").slice(0, 80),
        message: String(options.message || "조건에 맞는 자동 알림이 실행되었습니다.").slice(0, 240),
      },
    };
  }

  if (type === "openPage") {
    return {
      type,
      options: {
        url: String(options.url || "/").slice(0, 240),
      },
    };
  }

  return {
    type,
    options: {
      content: String(options.content || "").slice(0, 100),
      autoSubmit: false,
    },
  };
}

function normalizeAutomationRule(rule = {}, fallback = {}) {
  const normalized = {
    id: String(rule.id || fallback.id || createRuleId()),
    enabled: rule.enabled === true,
    name: String(rule.name || fallback.name || "자동 알림").slice(0, 60),
    schedule: {
      time: normalizeTime(rule.schedule && rule.schedule.time, fallback.schedule && fallback.schedule.time),
      daysOfWeek: normalizeDaysOfWeek(rule.schedule && rule.schedule.daysOfWeek),
    },
    conditions: Array.isArray(rule.conditions) && rule.conditions.length
      ? rule.conditions.map(normalizeCondition)
      : [normalizeCondition(rule.condition || fallback.condition || { type: "always" })],
    actions: Array.isArray(rule.actions) && rule.actions.length
      ? rule.actions.map(normalizeAction)
      : [normalizeAction((fallback.actions && fallback.actions[0]) || { type: "notify" })],
    lastRunAt: rule.lastRunAt || null,
    lastResult: rule.lastResult || null,
  };

  if (normalized.actions.some((action) => action.type === "fillDailyReport")) {
    const hasDailyReportCondition = normalized.conditions
      .some((condition) => condition.type === "dailyReportMissing");
    if (!hasDailyReportCondition) {
      normalized.conditions.push({
        type: "dailyReportMissing",
        options: {
          teamId: "auto",
        },
      });
    }
  }

  normalized.conditions = normalized.conditions
    .filter((condition, index, list) => (
      list.findIndex((item) => item.type === condition.type) === index
    ));

  normalized.actions = normalized.actions
    .filter((action, index, list) => (
      list.findIndex((item) => item.type === action.type) === index
    ));

  return normalized;
}

function mergeAutomationDefaults(rules) {
  const byId = new Map((Array.isArray(rules) ? rules : []).map((rule) => [rule.id, rule]));
  const merged = DEFAULT_AUTOMATION_RULES.map((defaultRule) => (
    normalizeAutomationRule(byId.get(defaultRule.id) || defaultRule, defaultRule)
  ));

  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!DEFAULT_AUTOMATION_RULES.some((defaultRule) => defaultRule.id === rule.id)) {
      merged.push(normalizeAutomationRule(rule));
    }
  }

  return merged;
}

function normalizeAutomationRules(rules) {
  return (Array.isArray(rules) ? rules : [])
    .map((rule) => normalizeAutomationRule(rule));
}

async function getAutomationRules() {
  const stored = await chrome.storage.local.get(["automationRules"]);
  if (!Array.isArray(stored.automationRules)) {
    const defaults = normalizeAutomationRules(DEFAULT_AUTOMATION_RULES);
    await chrome.storage.local.set({ automationRules: defaults });
    return defaults;
  }

  return normalizeAutomationRules(stored.automationRules);
}

async function saveAutomationRules(rules) {
  const normalized = normalizeAutomationRules(rules);
  await chrome.storage.local.set({ automationRules: normalized });
  await setupAutomationAlarms(normalized);
  return normalized;
}

function getDateStrForTeamApi(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function getWeekStartDate(date = new Date()) {
  const day = date.getDay() === 0 ? 6 : date.getDay() - 1;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
}

function normalizeDateOnly(value) {
  const match = String(value || "").match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[3])).padStart(2, "0")}`;
}

async function getCurrentUserInfo() {
  const stored = await chrome.storage.local.get(["userInfo"]);
  if (stored.userInfo && stored.userInfo.id) {
    return stored.userInfo;
  }

  try {
    return await requestGgmApi("/api/user");
  } catch (error) {
    console.warn("[GGMAuto] 사용자 정보 조회 실패:", error);
    return stored.userInfo || null;
  }
}

async function resolveProjectTeamId(options = {}) {
  const explicit = String(options.teamId || "").trim();
  if (/^\d+$/.test(explicit)) return explicit;

  const stored = await chrome.storage.local.get(["automationProjectTeamId"]);
  if (/^\d+$/.test(String(stored.automationProjectTeamId || ""))) {
    return String(stored.automationProjectTeamId);
  }

  const data = await requestGgmApi("/api/team/init");
  const team = data && data.team;
  const teamId = typeof team === "object" ? team.id : team;
  if (!teamId || !/^\d+$/.test(String(teamId))) {
    throw new Error("소속된 졸업작품 팀을 찾지 못했습니다.");
  }

  await chrome.storage.local.set({ automationProjectTeamId: String(teamId) });
  return String(teamId);
}

async function getDailyReportStatus(options = {}) {
  const teamId = await resolveProjectTeamId(options);
  const user = await getCurrentUserInfo();
  const userId = user && String(user.id || user.user_id || "");
  const startDay = getDateStrForTeamApi(getWeekStartDate());
  const today = normalizeDateOnly(getDateStrForTeamApi());
  const data = await requestGgmApi(
    `/api/team/record/daily?team=${encodeURIComponent(teamId)}&start_day=${encodeURIComponent(startDay)}`,
  );
  const list = extractArray(data, ["list", "data", "records"]);
  const exists = list.some((record) => {
    const recordDay = normalizeDateOnly(record.record_day || record.date || record.created_at);
    const recordUserId = String(record.user_id || record.userId || record.user || "");
    return recordDay === today && (!userId || recordUserId === userId);
  });

  return {
    teamId,
    url: `/project/team/${teamId}`,
    missing: !exists,
    exists,
    count: list.length,
  };
}

function getCheerSignature(log) {
  if (!log || typeof log !== "object") return "";
  return String(
    log.id ||
    log.cheer_id ||
    log.created_at ||
    log.updated_at ||
    `${log.user_id || ""}:${log.target_id || ""}:${log.content || log.message || ""}`,
  );
}

async function getJobCheerUpdateStatus() {
  const [data, user, stored] = await Promise.all([
    requestGgmApi("/api/town/cheer_logs"),
    getCurrentUserInfo(),
    chrome.storage.local.get(["jobCheerLastSignature", "jobCheerLastNotifiedSignature"]),
  ]);
  const logs = extractArray(data, ["logs", "list", "data"]);
  const userId = user && String(user.id || user.user_id || "");
  const mine = logs.filter((log) => {
    const candidates = [
      log.target_id,
      log.target_user_id,
      log.to_user_id,
      log.user_id,
      log.user && log.user.id,
      log.target && log.target.id,
    ].map((value) => String(value || ""));
    return !userId || candidates.includes(userId);
  });
  const latest = mine[0] || logs[0] || null;
  const signature = getCheerSignature(latest);

  if (!signature) {
    return { updated: false, signature: "", url: "/user" };
  }

  const lastSignature = stored.jobCheerLastSignature || "";
  await chrome.storage.local.set({ jobCheerLastSignature: signature });

  return {
    updated:
      signature !== lastSignature &&
      signature !== stored.jobCheerLastNotifiedSignature,
    signature,
    url: "/user",
  };
}

function resolveAutomationUrl(url, context = {}) {
  const rawUrl = String(url || "/");
  return rawUrl.replace(/\{teamId\}/g, context.teamId || "");
}

async function evaluateAutomationCondition(condition, context) {
  if (condition.type === "always") return true;

  if (condition.type === "dailyReportMissing") {
    const status = await getDailyReportStatus(condition.options || {});
    context.teamId = status.teamId;
    context.dailyReportUrl = status.url;
    context.dailyReportMissing = status.missing;
    return status.missing;
  }

  if (condition.type === "jobCheerUpdated") {
    const status = await getJobCheerUpdateStatus();
    context.jobCheerSignature = status.signature;
    context.jobCheerUrl = status.url;
    return status.updated;
  }

  return false;
}

async function runAutomationAction(action, context, rule) {
  if (action.type === "notify") {
    await createNotificationWithUrl(
      action.options.title || rule.name,
      action.options.message || "자동 알림이 실행되었습니다.",
      context.dailyReportUrl || context.jobCheerUrl || null,
    );
    return;
  }

  if (action.type === "openPage") {
    if (String(action.options.url || "").includes("{teamId}") && !context.teamId) {
      context.teamId = await resolveProjectTeamId({});
      context.dailyReportUrl = `/project/team/${context.teamId}`;
    }
    const url = resolveAutomationUrl(action.options.url, context);
    await openGgmPage(url || context.dailyReportUrl || "/");
    context.pageOpened = true;
    return;
  }

  if (action.type === "fillDailyReport") {
    const teamId = context.teamId || await resolveProjectTeamId({});
    const url = `/project/team/${teamId}`;
    await chrome.storage.local.set({
      pendingDailyReportFill: {
        teamId,
        content: String(action.options.content || "").slice(0, 100),
        autoSubmit: false,
        createdAt: new Date().toISOString(),
      },
    });
    if (!context.pageOpened) {
      await openGgmPage(url);
      context.pageOpened = true;
    }
  }
}

async function runAutomationRule(rule, options = {}) {
  const normalized = normalizeAutomationRule(rule);
  const context = {
    manual: options.manual === true,
  };

  try {
    for (const condition of normalized.conditions) {
      const ok = await evaluateAutomationCondition(condition, context);
      if (!ok) {
        return {
          success: true,
          executed: false,
          reason: "conditions-not-met",
        };
      }
    }

    for (const action of normalized.actions) {
      await runAutomationAction(action, context, normalized);
    }

    if (context.jobCheerSignature) {
      await chrome.storage.local.set({
        jobCheerLastNotifiedSignature: context.jobCheerSignature,
      });
    }

    await saveActivity(
      "automation",
      normalized.name,
      "자동 알림 조건이 맞아 행동을 실행했습니다.",
      context.dailyReportUrl || context.jobCheerUrl || null,
      { ruleId: normalized.id },
    );

    return {
      success: true,
      executed: true,
      reason: "executed",
    };
  } catch (error) {
    console.error("[GGMAuto] 자동 알림 실행 실패:", error);
    await saveActivity(
      "automation-error",
      normalized.name,
      error.message,
      null,
      { ruleId: normalized.id },
    );
    return {
      success: false,
      executed: false,
      reason: "error",
      error: error.message,
    };
  }
}

function getNextAutomationRun(schedule = {}) {
  const [hour, minute] = normalizeTime(schedule.time).split(":").map(Number);
  const days = new Set(normalizeDaysOfWeek(schedule.daysOfWeek));
  const now = new Date();

  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      hour,
      minute,
      0,
      0,
    );

    if (candidate <= now) continue;
    if (days.has(candidate.getDay())) return candidate;
  }

  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

async function clearAutomationAlarms() {
  const alarms = await chrome.alarms.getAll();
  await Promise.all(
    alarms
      .filter((alarm) => alarm.name.startsWith(AUTOMATION_ALARM_PREFIX))
      .map((alarm) => chrome.alarms.clear(alarm.name)),
  );
}

async function setupAutomationAlarmForRule(rule) {
  const alarmName = `${AUTOMATION_ALARM_PREFIX}${rule.id}`;
  await chrome.alarms.clear(alarmName);
  if (!rule.enabled) return;

  const nextRun = getNextAutomationRun(rule.schedule);
  await chrome.alarms.create(alarmName, {
    when: nextRun.getTime(),
  });
  console.log(`[GGMAuto] 자동 알림 예약: ${rule.name} - ${nextRun.toLocaleString()}`);
}

async function setupAutomationAlarms(rules = null) {
  const normalizedRules = rules || await getAutomationRules();
  await clearAutomationAlarms();
  await Promise.all(normalizedRules.map((rule) => setupAutomationAlarmForRule(rule)));
}
