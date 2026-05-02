// ============================================
// 🔧 사용자 설정 영역 (User Configuration)
// ============================================

// 📌 대상 사이트 도메인
const TARGET_DOMAIN = "ggm.gondr.net";
const SITE_TIME_ZONE = "Asia/Seoul";

// 📌 출석체크 API 설정
const ATTENDANCE_CONFIG = {
  url: "https://ggm.gondr.net/api/town/goldbox/attendance",
  method: "POST",
  // 요청 본문 (빈 객체)
  body: JSON.stringify({}),
  contentType: "application/json",
};

// 📌 알람 설정 (기본값)
const DEFAULT_ALARM_CONFIG = {
  name: "attendanceAlarm",
  dailyAlarmName: "dailyMidnightAlarm",
  initialCheckName: "initialAttendanceCheck",
  delayInMinutes: 1,
  periodInMinutes: 1440, // 24시간 (하루에 한 번)
};

const UTILITY_MONITOR_ALARM_NAME = "utilityMonitorAlarm";
const MAX_ACTIVITY_ITEMS = 120;

const DEFAULT_FEATURE_SETTINGS = {
  utilityMonitorIntervalMinutes: 15,
  notifyNewPosts: true,
  notifyGoldboxQuest: true,
  notifyStockWatch: true,
  watchedBoardCategories: ["free"],
  watchedCirclePostIds: [],
  stockWatchCircleIds: [],
};

function getSiteDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeTokenExpiry(expiry) {
  if (!expiry) return null;

  if (typeof expiry === "number") {
    return expiry < 100000000000 ? expiry * 1000 : expiry;
  }

  if (typeof expiry === "string") {
    const numeric = Number(expiry);
    if (Number.isFinite(numeric)) {
      return normalizeTokenExpiry(numeric);
    }

    const parsedDate = Date.parse(expiry);
    return Number.isNaN(parsedDate) ? null : parsedDate;
  }

  return null;
}

function maskHeaders(headers) {
  return {
    ...headers,
    Authorization: headers.Authorization ? "Bearer ***" : undefined,
    "X-XSRF-TOKEN": headers["X-XSRF-TOKEN"] ? "***" : undefined,
  };
}

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

function toGgmUrl(pathOrUrl) {
  if (!pathOrUrl) return `https://${TARGET_DOMAIN}`;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = String(pathOrUrl).startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `https://${TARGET_DOMAIN}${path}`;
}

async function openGgmPage(pathOrUrl) {
  await chrome.tabs.create({ url: toGgmUrl(pathOrUrl) });
}

async function requestGgmApi(path, options = {}) {
  const authRequired = options.authRequired !== false;
  const bearerToken = await getBearerToken();

  if (authRequired && !bearerToken) {
    throw new Error("로그인 토큰이 없어 확인할 수 없습니다.");
  }

  const headers = {
    Accept: "application/json",
  };

  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const response = await fetch(toGgmUrl(path), {
    method: "GET",
    headers,
    credentials: "include",
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
  }

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("JSON 응답을 해석하지 못했습니다.");
  }
}

async function saveActivity(type, title, message, url = null, meta = {}) {
  try {
    const stored = await chrome.storage.local.get(["activityTimeline"]);
    const timeline = Array.isArray(stored.activityTimeline)
      ? stored.activityTimeline
      : [];
    timeline.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      time: new Date().toISOString(),
      type,
      title,
      message,
      url,
      meta,
    });

    await chrome.storage.local.set({
      activityTimeline: timeline.slice(0, MAX_ACTIVITY_ITEMS),
    });
  } catch (error) {
    console.warn("[GGMAuto] 활동 기록 저장 실패:", error);
  }
}

async function createNotificationWithUrl(title, message, pathOrUrl) {
  const id = `ggmplus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: `[GGMPlus] ${title}`,
    message,
    priority: 2,
  });

  if (pathOrUrl) {
    const stored = await chrome.storage.local.get(["notificationUrls"]);
    const notificationUrls = stored.notificationUrls || {};
    notificationUrls[id] = toGgmUrl(pathOrUrl);
    await chrome.storage.local.set({ notificationUrls });
  }

  return id;
}

function extractArray(data, candidates) {
  if (Array.isArray(data)) return data;

  for (const key of candidates) {
    const value = data && data[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function extractPosts(data) {
  const posts = data && data.posts;
  if (Array.isArray(posts)) return posts;
  if (posts && Array.isArray(posts.data)) return posts.data;
  if (posts && Array.isArray(posts.list)) return posts.list;
  return [];
}

function getMaxNumericId(items) {
  return Math.max(0, ...items.map((item) => Number(item.id)).filter(Number.isFinite));
}

function isOpenFlag(value) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "Y";
}

function isQuestFull(quest) {
  const maxUser = Number(quest.max_user || quest.maxUser || 0);
  if (!maxUser) return false;

  if (Array.isArray(quest.users)) {
    return quest.users.length >= maxUser;
  }

  const count = Number(quest.user_count || quest.count || 0);
  return count >= maxUser;
}

function normalizeStockValue(stock) {
  if (stock && typeof stock === "object") {
    const candidate =
      stock.price ??
      stock.current ??
      stock.value ??
      stock.point ??
      stock.amount ??
      stock.count;
    return Number.isFinite(Number(candidate)) ? Number(candidate) : JSON.stringify(stock);
  }

  return Number.isFinite(Number(stock)) ? Number(stock) : String(stock ?? "");
}

function getUtilityStateDefaults() {
  return {
    boardLastIds: {},
    circlePostLastIds: {},
    questSignature: null,
    goldboxReminderDate: null,
    stockSnapshots: {},
  };
}

async function getUtilityState() {
  const stored = await chrome.storage.local.get(["utilityMonitorState"]);
  return {
    ...getUtilityStateDefaults(),
    ...(stored.utilityMonitorState || {}),
  };
}

async function setUtilityState(state) {
  await chrome.storage.local.set({ utilityMonitorState: state });
}

async function monitorBoardPosts(settings, state, summary) {
  if (!settings.notifyNewPosts) return;

  const nextLastIds = { ...(state.boardLastIds || {}) };

  for (const category of settings.watchedBoardCategories) {
    const data = await requestGgmApi(
      `/api/town/freeboard?category=${encodeURIComponent(category)}&page=1`,
    );
    const list = extractArray(data, ["list", "data"]);
    const maxId = getMaxNumericId(list);
    const previousMaxId = Number(nextLastIds[category] || 0);

    if (previousMaxId > 0 && maxId > previousMaxId) {
      const newItems = list.filter((item) => Number(item.id) > previousMaxId);
      const newest = newItems[0] || list[0] || {};
      const title = newest.title || `${category} 게시판 새 글`;
      const message = `${category} 게시판에 새 글 ${newItems.length}개가 올라왔습니다.`;
      await createNotificationWithUrl("새 게시글", message, "/town/freeboard");
      await saveActivity("post", "새 게시글", `${message}\n${title}`, "/town/freeboard", {
        category,
        count: newItems.length,
      });
      summary.notifications += 1;
    }

    if (maxId > previousMaxId) {
      nextLastIds[category] = maxId;
    }
  }

  state.boardLastIds = nextLastIds;
}

async function monitorCirclePosts(settings, state, summary) {
  if (!settings.notifyNewPosts || settings.watchedCirclePostIds.length === 0) return;

  const nextLastIds = { ...(state.circlePostLastIds || {}) };

  for (const circleId of settings.watchedCirclePostIds) {
    const data = await requestGgmApi(`/api/circle/${circleId}/posts`);
    const list = extractPosts(data);
    const maxId = getMaxNumericId(list);
    const previousMaxId = Number(nextLastIds[circleId] || 0);

    if (previousMaxId > 0 && maxId > previousMaxId) {
      const newItems = list.filter((item) => Number(item.id) > previousMaxId);
      const message = `동아리 ${circleId}에 새 글 ${newItems.length}개가 올라왔습니다.`;
      const url = `/circle/info/${circleId}`;
      await createNotificationWithUrl("동아리 새 글", message, url);
      await saveActivity("circle-post", "동아리 새 글", message, url, {
        circleId,
        count: newItems.length,
      });
      summary.notifications += 1;
    }

    if (maxId > previousMaxId) {
      nextLastIds[circleId] = maxId;
    }
  }

  state.circlePostLastIds = nextLastIds;
}

async function monitorGoldboxAndQuest(settings, state, summary) {
  if (!settings.notifyGoldboxQuest) return;

  const today = getSiteDateKey();

  if (state.goldboxReminderDate !== today) {
    const goldbox = await requestGgmApi("/api/town/goldbox");
    const list = extractArray(goldbox, ["list", "data"]);

    if (list.length > 0) {
      await createNotificationWithUrl(
        "골드박스 확인",
        "오늘 확인할 골드박스 정보가 있습니다.",
        "/town",
      );
      await saveActivity(
        "goldbox",
        "골드박스 확인",
        "오늘 확인할 골드박스 정보가 있습니다.",
        "/town",
      );
      summary.notifications += 1;
      state.goldboxReminderDate = today;
    }
  }

  const questData = await requestGgmApi("/api/town/quest");
  const quests = extractArray(questData, ["quests", "list", "data"]);
  const availableQuests = quests.filter((quest) => isOpenFlag(quest.open) && !isQuestFull(quest));
  const signature = availableQuests
    .map((quest) => `${quest.id}:${Array.isArray(quest.users) ? quest.users.length : quest.count || 0}`)
    .join("|");

  if (state.questSignature !== null && signature && signature !== state.questSignature) {
    const message = `참여 가능한 퀘스트 ${availableQuests.length}개를 확인해보세요.`;
    await createNotificationWithUrl("퀘스트 알림", message, "/town/quest");
    await saveActivity("quest", "퀘스트 알림", message, "/town/quest", {
      questIds: availableQuests.map((quest) => quest.id),
    });
    summary.notifications += 1;
  }

  state.questSignature = signature;
}

async function monitorStockWatch(settings, state, summary) {
  if (!settings.notifyStockWatch || settings.stockWatchCircleIds.length === 0) return;

  const market = await requestGgmApi("/api/stock/market");
  const circles = extractArray(market, ["circles", "list", "data"]);
  const snapshots = { ...(state.stockSnapshots || {}) };

  for (const circleId of settings.stockWatchCircleIds) {
    const circle = circles.find((item) => Number(item.id) === Number(circleId));
    if (!circle) continue;

    const nextSnapshot = {
      name: circle.name || `동아리 ${circleId}`,
      stock: normalizeStockValue(circle.stock),
      gold: Number.isFinite(Number(circle.gold)) ? Number(circle.gold) : null,
      updatedAt: new Date().toISOString(),
    };
    const previous = snapshots[circleId];

    if (
      previous &&
      (previous.stock !== nextSnapshot.stock || previous.gold !== nextSnapshot.gold)
    ) {
      const message = `${nextSnapshot.name} 주식 정보가 변경되었습니다.`;
      await createNotificationWithUrl("주식 관심 알림", message, "/town/market");
      await saveActivity("stock", "주식 관심 알림", message, "/town/market", {
        circleId,
        previous,
        next: nextSnapshot,
      });
      summary.notifications += 1;
    }

    snapshots[circleId] = nextSnapshot;
  }

  state.stockSnapshots = snapshots;
}

async function runUtilityMonitor(options = {}) {
  const settings = await getFeatureSettings();
  const summary = {
    notifications: 0,
    errors: [],
    checkedAt: new Date().toISOString(),
  };

  if (!hasEnabledUtilityMonitor(settings)) {
    return summary;
  }

  const state = await getUtilityState();
  const monitors = [
    () => monitorBoardPosts(settings, state, summary),
    () => monitorCirclePosts(settings, state, summary),
    () => monitorGoldboxAndQuest(settings, state, summary),
    () => monitorStockWatch(settings, state, summary),
  ];

  for (const monitor of monitors) {
    try {
      await monitor();
    } catch (error) {
      console.warn("[GGMAuto] 유틸리티 모니터 실패:", error);
      summary.errors.push(error.message || String(error));
    }
  }

  await setUtilityState(state);

  if (options.manual) {
    const message = summary.errors.length
      ? `확인 완료, 오류 ${summary.errors.length}건`
      : `확인 완료, 알림 ${summary.notifications}건`;
    await saveActivity("monitor", "수동 모니터링", message, null, summary);
  }

  return summary;
}

// 📌 현재 알람 설정 가져오기
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
const TOKEN_REFRESH_CONFIG = {
  // 토큰 갱신을 위해 열 페이지 URL
  refreshUrl: "https://ggm.gondr.net",
  // 탭이 토큰을 수집할 때까지 대기 시간 (밀리초)
  waitTime: 5000,
  // 자동 갱신 활성화
  autoRefresh: true,
};

// ============================================
// 🔐 토큰 관리 함수
// ============================================

/**
 * 저장된 Bearer 토큰 가져오기
 */
async function getBearerToken() {
  try {
    const result = await chrome.storage.local.get([
      "bearerToken",
      "tokenExpiry",
    ]);

    if (!result.bearerToken) {
      console.warn(
        "[GGMAuto] ⚠️ Bearer 토큰이 없습니다. 사이트 방문 후 토큰을 수집해주세요.",
      );
      return null;
    }

    // 토큰 만료 체크 (선택적)
    const tokenExpiry = normalizeTokenExpiry(result.tokenExpiry);
    if (tokenExpiry && Date.now() > tokenExpiry) {
      console.warn(
        "[GGMAuto] ⚠️ Bearer 토큰이 만료되었습니다. 사이트 재방문이 필요합니다.",
      );
      await chrome.storage.local.remove(["bearerToken", "tokenExpiry"]);
      return null;
    }

    return result.bearerToken;
  } catch (error) {
    console.error("[GGMAuto] ❌ 토큰 조회 실패:", error);
    return null;
  }
}

/**
 * X-XSRF-TOKEN 쿠키 가져오기
 */
async function getXsrfToken() {
  try {
    const cookie = await chrome.cookies.get({
      url: `https://${TARGET_DOMAIN}`,
      name: "XSRF-TOKEN", // Laravel 기본 XSRF 쿠키명
    });

    if (!cookie) {
      console.log("[GGMAuto] ℹ️ XSRF-TOKEN 쿠키 없음 (필수 아닐 수 있음)");
      return null;
    }

    // URL 디코딩 (쿠키 값이 인코딩되어 있는 경우)
    return decodeURIComponent(cookie.value);
  } catch (error) {
    console.error("[GGMAuto] ❌ XSRF 토큰 조회 실패:", error);
    return null;
  }
}

/**
 * 백그라운드에서 탭을 열어 토큰 자동 갱신
 * @returns {Promise<boolean>} 갱신 성공 여부
 */
async function refreshTokenAutomatically() {
  if (!TOKEN_REFRESH_CONFIG.autoRefresh) {
    console.log("[GGMAuto] ℹ️ 자동 토큰 갱신이 비활성화됨");
    return false;
  }

  console.log("[GGMAuto] 🔄 토큰 자동 갱신 시도...");

  try {
    // 1. 백그라운드에서 탭 열기 (비활성 상태)
    const tab = await chrome.tabs.create({
      url: TOKEN_REFRESH_CONFIG.refreshUrl,
      active: false, // 백그라운드에서 열기
    });

    console.log("[GGMAuto] 📑 토큰 갱신용 탭 열림:", tab.id);

    // 2. 페이지 로드 및 토큰 수집 대기
    await new Promise((resolve) =>
      setTimeout(resolve, TOKEN_REFRESH_CONFIG.waitTime),
    );

    // 3. 탭 닫기
    try {
      await chrome.tabs.remove(tab.id);
      console.log("[GGMAuto] 📑 토큰 갱신용 탭 닫힘");
    } catch (e) {
      // 이미 닫혔을 수 있음
    }

    // 4. 토큰 수집 확인
    const token = await getBearerToken();
    if (token) {
      console.log("[GGMAuto] ✅ 토큰 자동 갱신 성공!");
      return true;
    } else {
      console.log("[GGMAuto] ⚠️ 토큰 갱신 실패 - 로그인 필요할 수 있음");
      return false;
    }
  } catch (error) {
    console.error("[GGMAuto] ❌ 토큰 자동 갱신 오류:", error);
    return false;
  }
}

// ============================================
// 📤 출석체크 요청 함수
// ============================================

/**
 * 출석체크 요청 보내기
 */
async function sendAttendance(retryAfterRefresh = true) {
  console.log("[GGMAuto] 🚀 출석체크 시작...", new Date().toLocaleString());

  try {
    // 1. 토큰 수집
    let bearerToken = await getBearerToken();
    const xsrfToken = await getXsrfToken();

    // 2. 토큰 유효성 검사 - 없으면 자동 갱신 시도
    if (!bearerToken) {
      console.log("[GGMAuto] ⚠️ 토큰 없음 - 자동 갱신 시도...");

      if (retryAfterRefresh) {
        const refreshed = await refreshTokenAutomatically();
        if (refreshed) {
          // 갱신 성공 시 다시 시도 (재귀 방지를 위해 retryAfterRefresh=false)
          return await sendAttendance(false);
        }
      }

      const errorMsg = "Bearer 토큰 없음 - 사이트 로그인 필요";
      console.error("[GGMAuto] ❌", errorMsg);
      await saveAttendanceResult(false, errorMsg);
      showNotification("출석체크 실패", errorMsg);
      return { success: false, error: errorMsg };
    }

    // 3. 요청 헤더 구성
    const headers = {
      "Content-Type": ATTENDANCE_CONFIG.contentType,
      Authorization: `Bearer ${bearerToken}`,
      Accept: "application/json",
    };

    // XSRF 토큰이 있는 경우에만 추가
    if (xsrfToken) {
      headers["X-XSRF-TOKEN"] = xsrfToken;
    }

    // 4. Fetch 요청
    const fetchOptions = {
      method: ATTENDANCE_CONFIG.method,
      headers: headers,
      credentials: "include", // 쿠키 포함
    };

    // GET 요청이 아닌 경우에만 body 추가
    if (ATTENDANCE_CONFIG.method !== "GET" && ATTENDANCE_CONFIG.body) {
      fetchOptions.body = ATTENDANCE_CONFIG.body;
    }

    console.log("[GGMAuto] 📡 요청 전송:", ATTENDANCE_CONFIG.url);
    console.log("[GGMAuto] 📋 헤더:", JSON.stringify(maskHeaders(headers), null, 2));
    console.log("[GGMAuto] 📦 Body:", fetchOptions.body || "(없음)");

    const response = await fetch(ATTENDANCE_CONFIG.url, fetchOptions);
    const responseText = await response.text();
    
    // JSON 응답 파싱 시도 (유니코드 이스케이프 디코딩)
    let decodedMessage = responseText;
    try {
      const jsonResponse = JSON.parse(responseText);
      if (jsonResponse.msg) {
        decodedMessage = jsonResponse.msg;
      }
    } catch (e) {
      // JSON 파싱 실패 시 원본 텍스트 사용
    }

    // 5. 응답 처리
    if (response.ok) {
      console.log("[GGMAuto] ✅ 출석체크 성공!", response.status);
      console.log("[GGMAuto] 📄 응답:", decodedMessage);

      await saveAttendanceResult(true, decodedMessage);
      showNotification("출석체크 성공", "출석체크가 완료되었습니다!");

      return { success: true, data: responseText };
    } else {
      const errorMsg = `HTTP ${response.status}: ${decodedMessage}`;

      // 400 에러 - 이미 출석체크 완료인 경우 처리
      console.log("[GGMAuto] 📄 응답 상태:", response.status);
      console.log("[GGMAuto] 📄 디코딩된 메시지:", decodedMessage);

      if (response.status === 400) {
        // 디코딩된 메시지에서 "이미", "already", "완료", "하셨습니다" 등 키워드 확인
        const alreadyChecked =
          /이미|완료|하셨습니다|already|done|exist|duplicate/i.test(
            decodedMessage,
          );

        if (alreadyChecked) {
          console.log("[GGMAuto] ✅ 오늘 이미 출석체크 완료!");
          console.log("[GGMAuto] 📄 응답:", decodedMessage);

          await saveAttendanceResult(true, "오늘 이미 출석체크 완료", true);
          // 알림 표시 안함 (이미 출석한 건 알림 필요 없음)

          return { success: true, alreadyChecked: true, data: responseText };
        }
      }

      console.error("[GGMAuto] ❌ 출석체크 실패:", errorMsg);

      // 401/403 에러 시 토큰 만료 처리
      if (response.status === 401 || response.status === 403) {
        console.warn("[GGMAuto] ⚠️ 인증 오류 - 토큰이 만료되었을 수 있습니다.");
        await chrome.storage.local.remove(["bearerToken", "tokenExpiry"]);
      }

      await saveAttendanceResult(false, errorMsg);
      showNotification("출석체크 실패", `오류: ${response.status}`);

      return { success: false, error: errorMsg };
    }
  } catch (error) {
    const errorMsg = error.message || "네트워크 오류";
    console.error("[GGMAuto] ❌ 출석체크 예외:", error);

    await saveAttendanceResult(false, errorMsg);
    showNotification("출석체크 실패", errorMsg);

    return { success: false, error: errorMsg };
  }
}

// ============================================
// 💾 결과 저장 함수
// ============================================

/**
 * 출석체크 결과 저장
 * @param {boolean} success - 성공 여부
 * @param {string} message - 메시지
 * @param {boolean} alreadyChecked - 이미 출석체크 완료 여부
 */
async function saveAttendanceResult(success, message, alreadyChecked = false) {
  const now = new Date();
  const today = getSiteDateKey(now); // YYYY-MM-DD 형식

  const record = {
    lastAttempt: now.toISOString(),
    lastAttemptReadable: now.toLocaleString("ko-KR"),
    success: success,
    message: message,
  };

  if (success) {
    record.lastSuccess = now.toISOString();
    record.lastSuccessReadable = now.toLocaleString("ko-KR");
    record.todayChecked = today; // 오늘 출석체크 완료 날짜 저장
    record.alreadyCheckedToday = alreadyChecked;
  }

  // 기존 기록 유지하면서 업데이트
  const existing = await chrome.storage.local.get(["attendanceHistory"]);
  const history = existing.attendanceHistory || [];

  // 최근 100개 기록만 유지
  history.unshift(record);
  if (history.length > 100) {
    history.pop();
  }

  await chrome.storage.local.set({
    ...record,
    attendanceHistory: history,
  });

  await saveActivity(
    success ? "attendance" : "attendance-error",
    success ? "출석체크 성공" : "출석체크 실패",
    message,
    "/town",
    { alreadyChecked },
  );

  console.log("[GGMAuto] 💾 결과 저장 완료:", record);
}

// ============================================
// 🔔 알림 함수
// ============================================

/**
 * 데스크톱 알림 표시
 */
function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: `[GGMAuto] ${title}`,
    message: message,
    priority: 2,
  });
}

// ============================================
// ⏰ 알람 및 이벤트 리스너
// ============================================

/**
 * 오늘 출석체크 완료 여부 확인
 */
async function isTodayChecked() {
  const data = await chrome.storage.local.get(["todayChecked"]);
  const today = getSiteDateKey();
  return data.todayChecked === today;
}

/**
 * 자정까지 남은 시간(분) 계산
 */
function getMinutesUntilMidnight() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 30, 0); // 자정 + 30초 (안전 마진)
  const diffMs = midnight - now;
  return Math.ceil(diffMs / 60000);
}

/**
 * 자정 알람 설정
 */
async function setupMidnightAlarm() {
  const minutesUntilMidnight = getMinutesUntilMidnight();
  
  await chrome.alarms.clear(DEFAULT_ALARM_CONFIG.dailyAlarmName);
  await chrome.alarms.create(DEFAULT_ALARM_CONFIG.dailyAlarmName, {
    delayInMinutes: minutesUntilMidnight,
    periodInMinutes: 1440, // 24시간마다 반복
  });
  
  console.log(`[GGMAuto] ⏰ 자정 알람 설정: ${minutesUntilMidnight}분 후 실행`);
}

async function setupAttendanceAlarm(config) {
  const alarmConfig = config || await getAlarmConfig();

  await chrome.alarms.clear(DEFAULT_ALARM_CONFIG.name);
  await chrome.alarms.create(DEFAULT_ALARM_CONFIG.name, {
    delayInMinutes: Math.max(1, Number(alarmConfig.delayInMinutes) || DEFAULT_ALARM_CONFIG.delayInMinutes),
    periodInMinutes: Math.max(1, Number(alarmConfig.periodInMinutes) || DEFAULT_ALARM_CONFIG.periodInMinutes),
  });

  console.log(
    `[GGMAuto] ⏰ 주기 알람 설정: ${alarmConfig.delayInMinutes}분 후 첫 실행, ${alarmConfig.periodInMinutes}분마다 반복`,
  );
}

async function setupUtilityMonitorAlarm(config) {
  const settings = config || await getFeatureSettings();

  await chrome.alarms.clear(UTILITY_MONITOR_ALARM_NAME);
  if (!hasEnabledUtilityMonitor(settings)) {
    console.log("[GGMAuto] 유틸리티 모니터 알람 비활성화");
    return;
  }

  const interval = Math.max(5, Number(settings.utilityMonitorIntervalMinutes) || 15);
  await chrome.alarms.create(UTILITY_MONITOR_ALARM_NAME, {
    delayInMinutes: Math.min(5, interval),
    periodInMinutes: interval,
  });

  console.log(`[GGMAuto] 유틸리티 모니터 알람 설정: ${interval}분마다 반복`);
}

async function scheduleInitialCheckAlarm() {
  const alarmConfig = await getAlarmConfig();
  await chrome.alarms.clear(DEFAULT_ALARM_CONFIG.initialCheckName);
  if (Number(alarmConfig.delayInMinutes) <= DEFAULT_ALARM_CONFIG.delayInMinutes) {
    return;
  }

  await chrome.alarms.create(DEFAULT_ALARM_CONFIG.initialCheckName, {
    delayInMinutes: DEFAULT_ALARM_CONFIG.delayInMinutes,
  });
}

/**
 * 출석체크 필요 시 실행
 */
async function checkAndAttend() {
  const checked = await isTodayChecked();
  if (!checked) {
    console.log("[GGMAuto] 📋 오늘 출석체크 미완료 - 출석체크 시도");
    await sendAttendance();
  } else {
    console.log("[GGMAuto] ✅ 오늘 이미 출석체크 완료됨 - 스킵");
  }
}

/**
 * 확장 프로그램 설치/업데이트 시
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[GGMAuto] 📦 확장 프로그램 설치됨:", details.reason);

  // 자정 알람 설정
  await setupMidnightAlarm();
  await setupAttendanceAlarm();
  await setupUtilityMonitorAlarm();

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
  }
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  const stored = await chrome.storage.local.get(["notificationUrls"]);
  const notificationUrls = stored.notificationUrls || {};
  const url = notificationUrls[notificationId];

  if (url) {
    await openGgmPage(url);
    delete notificationUrls[notificationId];
    await chrome.storage.local.set({ notificationUrls });
  }

  chrome.notifications.clear(notificationId);
});

/**
 * Content Script에서 메시지 수신 (토큰 저장)
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TOKEN_UPDATE") {
    console.log(
      "[GGMAuto] 🔑 토큰 업데이트 수신:",
      message.data ? "토큰 있음" : "토큰 없음",
    );

    const storageData = {
      bearerToken: message.data.token,
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
  if (message.type === "MANUAL_ATTENDANCE") {
    console.log("[GGMAuto] 🖱️ 수동 출석체크 요청");
    sendAttendance().then((result) => {
      sendResponse(result);
    });
    return true;
  }

  // 상태 조회
  if (message.type === "GET_STATUS") {
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
  if (message.type === "GET_SETTINGS") {
    getAlarmConfig().then((config) => {
      sendResponse({
        delayInMinutes: config.delayInMinutes,
        periodInMinutes: config.periodInMinutes,
      });
    });
    return true;
  }

  // 설정 저장
  if (message.type === "SAVE_SETTINGS") {
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
  if (message.type === "GET_LOGS") {
    chrome.storage.local.get(["attendanceHistory"]).then((data) => {
      sendResponse({ logs: data.attendanceHistory || [] });
    });
    return true;
  }

  // 로그 삭제
  if (message.type === "CLEAR_LOGS") {
    chrome.storage.local.remove(["attendanceHistory"]).then(() => {
      console.log("[GGMAuto] 🗑️ 로그 삭제됨");
      sendResponse({ success: true });
    });
    return true;
  }

  // 유틸리티 기능 설정 조회
  if (message.type === "GET_FEATURE_SETTINGS") {
    getFeatureSettings().then((settings) => {
      sendResponse(settings);
    });
    return true;
  }

  // 유틸리티 기능 설정 저장
  if (message.type === "SAVE_FEATURE_SETTINGS") {
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
  if (message.type === "RUN_UTILITY_MONITOR") {
    runUtilityMonitor({ manual: true }).then((summary) => {
      sendResponse({ success: true, summary });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // GGM 페이지 열기
  if (message.type === "OPEN_GGM_PAGE") {
    openGgmPage(message.url || "/").then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // 활동 타임라인 조회
  if (message.type === "GET_ACTIVITY") {
    chrome.storage.local.get(["activityTimeline"]).then((data) => {
      sendResponse({ items: data.activityTimeline || [] });
    });
    return true;
  }

  // 활동 타임라인 삭제
  if (message.type === "CLEAR_ACTIVITY") {
    chrome.storage.local.remove(["activityTimeline"]).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // 글/댓글 임시저장 데이터 삭제
  if (message.type === "CLEAR_DRAFTS") {
    chrome.storage.local.remove(["ggmDrafts"]).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // 전체 초기화
  if (message.type === "RESET_ALL") {
    (async () => {
      try {
        // 모든 데이터 삭제
        await chrome.storage.local.clear();

        await setupMidnightAlarm();
        await setupAttendanceAlarm(DEFAULT_ALARM_CONFIG);
        await setupUtilityMonitorAlarm(DEFAULT_FEATURE_SETTINGS);

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

console.log("[GGMAuto] 🎉 Service Worker 시작됨");
