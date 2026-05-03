// ============================================
// 🔧 사용자 설정 영역 (User Configuration)
// ============================================

// 📌 토큰을 찾을 localStorage 키 목록 (우선순위 순)
const TOKEN_KEYS = [
  "token",
  "access_token",
  "accessToken",
  "auth_token",
  "authToken",
  "jwt",
  "jwtToken",
  "bearer_token",
  "bearerToken",
];

// 📌 사용자 정보를 찾을 localStorage 키 목록
const USER_KEYS = [
  "user",
  "userInfo",
  "user_info",
  "currentUser",
  "profile",
  "me"
];

// 📌 토큰 갱신 체크 주기 (밀리초)
const TOKEN_CHECK_INTERVAL = 30000; // 30초마다 체크

// ============================================
// 🔍 토큰 추출 함수
// ============================================

/**
 * localStorage에서 토큰 찾기
 */
function findTokenInLocalStorage() {
  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key);
    if (value) {
      console.log(`[GGMAuto Content] 🔑 localStorage에서 토큰 발견: ${key}`);
      return parseTokenValue(value);
    }
  }
  return null;
}

/**
 * sessionStorage에서 토큰 찾기
 */
function findTokenInSessionStorage() {
  for (const key of TOKEN_KEYS) {
    const value = sessionStorage.getItem(key);
    if (value) {
      console.log(`[GGMAuto Content] 🔑 sessionStorage에서 토큰 발견: ${key}`);
      return parseTokenValue(value);
    }
  }
  return null;
}

/**
 * 토큰 값 파싱 (JSON으로 저장된 경우 처리)
 */
function parseTokenValue(value) {
  try {
    // JSON 형태인지 확인
    const parsed = JSON.parse(value);
    
    // 객체인 경우 토큰 필드 찾기
    if (typeof parsed === "object" && parsed !== null) {
      // 일반적인 토큰 필드명들
      const tokenFields = ["token", "access_token", "accessToken", "jwt", "value"];
      for (const field of tokenFields) {
        if (parsed[field]) {
          return {
            token: parsed[field],
            expiry: parsed.expiry || parsed.exp || parsed.expires_at || null
          };
        }
      }
      // 필드를 못찾으면 원본 반환
      return { token: value, expiry: null };
    }
    
    // 문자열인 경우 그대로 반환
    return { token: parsed, expiry: null };
  } catch (e) {
    // JSON 파싱 실패 시 원본 문자열 반환
    return { token: value, expiry: null };
  }
}

/**
 * 페이지 전역 변수에서 토큰 찾기 (고급)
 * 일부 사이트는 window 객체에 토큰을 저장함
 */
function findTokenInWindow() {
  // 공통적인 전역 변수명들
  const windowKeys = [
    "__INITIAL_STATE__",
    "__NUXT__",
    "__NEXT_DATA__",
    "APP_STATE",
    "window.auth",
    "window.user"
  ];
  
  try {
    // __INITIAL_STATE__ 체크 (Redux 등)
    if (window.__INITIAL_STATE__) {
      const state = window.__INITIAL_STATE__;
      const token = findTokenInObject(state);
      if (token) {
        console.log("[GGMAuto Content] 🔑 __INITIAL_STATE__에서 토큰 발견");
        return { token, expiry: null };
      }
    }
    
    // __NUXT__ 체크 (Nuxt.js)
    if (window.__NUXT__) {
      const token = findTokenInObject(window.__NUXT__);
      if (token) {
        console.log("[GGMAuto Content] 🔑 __NUXT__에서 토큰 발견");
        return { token, expiry: null };
      }
    }
    
  } catch (e) {
    console.log("[GGMAuto Content] ⚠️ 전역 변수 검색 중 오류:", e);
  }
  
  return null;
}

/**
 * 객체 내에서 토큰 찾기 (재귀)
 */
function findTokenInObject(obj, depth = 0) {
  if (depth > 5 || !obj || typeof obj !== "object") return null;
  
  const tokenFields = ["token", "access_token", "accessToken", "jwt", "bearer"];
  
  for (const key of Object.keys(obj)) {
    if (tokenFields.includes(key) && typeof obj[key] === "string" && obj[key].length > 20) {
      return obj[key];
    }
    
    if (typeof obj[key] === "object") {
      const found = findTokenInObject(obj[key], depth + 1);
      if (found) return found;
    }
  }
  
  return null;
}

// ============================================
// 📤 토큰 전송 함수
// ============================================

/**
 * localStorage에서 사용자 정보 찾기
 */
function findUserInfo() {
  for (const key of USER_KEYS) {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === "object" && parsed !== null) {
          console.log(`[GGMAuto Content] 👤 사용자 정보 발견: ${key}`);
          return parsed;
        }
      } catch (e) {
        // JSON 파싱 실패 시 무시
      }
    }
  }
  return null;
}

/**
 * 발견한 토큰을 background.js로 전송
 */
async function sendTokenToBackground(tokenData) {
  if (!tokenData || !tokenData.token) {
    console.log("[GGMAuto Content] ⚠️ 전송할 토큰이 없습니다.");
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: "TOKEN_UPDATE",
      data: tokenData
    });
    
    if (response && response.success) {
      console.log("[GGMAuto Content] ✅ 토큰이 성공적으로 저장되었습니다.");
    }
  } catch (error) {
    console.error("[GGMAuto Content] ❌ 토큰 전송 실패:", error);
  }
}

/**
 * 모든 소스에서 토큰 찾기
 */
function findAndSendToken() {
  console.log("[GGMAuto Content] 🔍 토큰 검색 시작...");
  
  // 1. localStorage 확인
  let tokenData = findTokenInLocalStorage();
  
  // 2. sessionStorage 확인
  if (!tokenData) {
    tokenData = findTokenInSessionStorage();
  }
  
  // 3. 전역 변수 확인 (선택적)
  if (!tokenData) {
    tokenData = findTokenInWindow();
  }
  
  // 4. 사용자 정보 찾기
  const userInfo = findUserInfo();
  if (tokenData && userInfo) {
    tokenData.userInfo = userInfo;
  }
  
  // 5. 토큰 발견 시 전송
  if (tokenData) {
    sendTokenToBackground(tokenData);
  } else {
    console.log("[GGMAuto Content] ⚠️ 토큰을 찾을 수 없습니다.");
  }
  
  return tokenData;
}

// ============================================
// 👀 Storage 변경 감지 (실시간 토큰 갱신)
// ============================================

/**
 * localStorage 변경 감지
 */
window.addEventListener("storage", (event) => {
  if (TOKEN_KEYS.includes(event.key) || USER_KEYS.includes(event.key)) {
    console.log(`[GGMAuto Content] 🔄 Storage 변경 감지: ${event.key}`);
    // 토큰이나 사용자 정보 변경 시 전체 재수집
    findAndSendToken();
  }
});

/**
 * localStorage.setItem 오버라이드 (더 정확한 감지)
 */
const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, value) {
  originalSetItem(key, value);
  
  if (TOKEN_KEYS.includes(key) || USER_KEYS.includes(key)) {
    console.log(`[GGMAuto Content] 🔄 localStorage.setItem 감지: ${key}`);
    // 토큰이나 사용자 정보 변경 시 전체 재수집
    findAndSendToken();
  }
};

// ============================================
// 🔄 주기적 토큰 체크
// ============================================

/**
 * 주기적으로 토큰 확인 및 갱신
 */
function startTokenWatcher() {
  // 초기 실행
  findAndSendToken();
  
  // 주기적 실행
  setInterval(() => {
    findAndSendToken();
  }, TOKEN_CHECK_INTERVAL);
}

// ============================================
// 📝 글/댓글 임시저장
// ============================================

const DRAFT_SAVE_DELAY = 700;
const DRAFT_MAX_LENGTH = 20000;
const DRAFT_MAX_ITEMS = 50;
let draftSaveTimers = new WeakMap();
let lastDraftPath = "";
let draftManagerStarted = false;

function isDraftEligiblePath(pathname = location.pathname) {
  return (
    /\/town\/(?:freeboard|devboard)\/(?:write|view\/\d+)/.test(pathname) ||
    /\/community\/write/.test(pathname) ||
    /\/circle\/info\/\d+/.test(pathname) ||
    /\/project\/board\/\d+/.test(pathname)
  );
}

function ensureDraftStyle() {
  if (document.getElementById("ggmplus-draft-style")) return;

  const style = document.createElement("style");
  style.id = "ggmplus-draft-style";
  style.textContent = `
    .ggmplus-draft-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 8px 0;
      padding: 8px 10px;
      border: 1px solid #bfcdf7;
      border-radius: 5px;
      background: #eef3ff;
      color: #2455d6;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.4;
      z-index: 2147483647;
    }
    .ggmplus-draft-bar span {
      flex: 1;
      min-width: 0;
    }
    .ggmplus-draft-bar button {
      min-height: 26px;
      padding: 0 8px;
      border: 1px solid #bfcdf7;
      border-radius: 4px;
      background: #ffffff;
      color: #2455d6;
      cursor: pointer;
      font-size: 12px;
      font-weight: 800;
    }
  `;
  document.documentElement.appendChild(style);
}

function getDraftFields() {
  if (!isDraftEligiblePath()) return [];

  return [...document.querySelectorAll("textarea, input, [contenteditable='true']")]
    .filter((element) => {
      if (element.disabled || element.readOnly) return false;
      if (element.closest(".ggmplus-draft-bar")) return false;

      const tagName = element.tagName.toLowerCase();
      if (tagName === "input") {
        const type = (element.getAttribute("type") || "text").toLowerCase();
        if (!["text", "search", "url"].includes(type)) return false;
      }

      const rect = element.getBoundingClientRect();
      return rect.width > 40 && rect.height > 14;
    });
}

function getFieldValue(element) {
  if (element.isContentEditable) {
    return element.innerText || "";
  }

  return element.value || "";
}

function setFieldValue(element, value) {
  if (element.isContentEditable) {
    element.innerText = value;
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function getDraftFieldName(element, index) {
  return (
    element.getAttribute("name") ||
    element.id ||
    element.getAttribute("placeholder") ||
    element.getAttribute("aria-label") ||
    element.dataset.vvName ||
    `${element.tagName.toLowerCase()}-${index}`
  );
}

function getDraftKey(element, index) {
  const path = `${location.pathname}${location.search}`;
  const fieldName = getDraftFieldName(element, index).slice(0, 80);
  return `${path}::${fieldName}::${index}`;
}

async function readDrafts() {
  const stored = await chrome.storage.local.get(["ggmDrafts"]);
  return stored.ggmDrafts || {};
}

async function writeDrafts(drafts) {
  const entries = Object.entries(drafts)
    .sort((a, b) => new Date(b[1].updatedAt || 0) - new Date(a[1].updatedAt || 0))
    .slice(0, DRAFT_MAX_ITEMS);
  await chrome.storage.local.set({ ggmDrafts: Object.fromEntries(entries) });
}

async function saveDraft(element, index) {
  const value = getFieldValue(element).slice(0, DRAFT_MAX_LENGTH);
  if (!value.trim()) return;

  const drafts = await readDrafts();
  const key = getDraftKey(element, index);
  drafts[key] = {
    key,
    path: `${location.pathname}${location.search}`,
    value,
    preview: value.replace(/\s+/g, " ").slice(0, 80),
    updatedAt: new Date().toISOString(),
  };
  await writeDrafts(drafts);
}

async function removeDraft(key) {
  const drafts = await readDrafts();
  delete drafts[key];
  await writeDrafts(drafts);
}

function bindDraftField(element, index, draft) {
  if (element.dataset.ggmplusDraftBound === "1") return;
  element.dataset.ggmplusDraftBound = "1";

  element.addEventListener("input", () => {
    clearTimeout(draftSaveTimers.get(element));
    draftSaveTimers.set(
      element,
      setTimeout(() => saveDraft(element, index), DRAFT_SAVE_DELAY),
    );
  });

  if (draft && draft.value && !getFieldValue(element).trim()) {
    showDraftRestoreBar(element, draft);
  }
}

function showDraftRestoreBar(element, draft) {
  const escapedKey = window.CSS && CSS.escape
    ? CSS.escape(draft.key)
    : draft.key.replace(/["\\]/g, "\\$&");

  if (document.querySelector(`[data-ggmplus-draft-key="${escapedKey}"]`)) {
    return;
  }

  ensureDraftStyle();

  const bar = document.createElement("div");
  bar.className = "ggmplus-draft-bar";
  bar.dataset.ggmplusDraftKey = draft.key;

  const label = document.createElement("span");
  label.textContent = `임시저장: ${draft.preview || "저장된 내용"}`;

  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.textContent = "복구";
  restoreBtn.addEventListener("click", () => {
    setFieldValue(element, draft.value);
    bar.remove();
  });

  const discardBtn = document.createElement("button");
  discardBtn.type = "button";
  discardBtn.textContent = "삭제";
  discardBtn.addEventListener("click", async () => {
    await removeDraft(draft.key);
    bar.remove();
  });

  bar.append(label, restoreBtn, discardBtn);
  element.insertAdjacentElement("beforebegin", bar);
}

async function scanDraftFields() {
  if (!isDraftEligiblePath()) return;

  const drafts = await readDrafts();
  const fields = getDraftFields();

  fields.forEach((element, index) => {
    const key = getDraftKey(element, index);
    bindDraftField(element, index, drafts[key]);
  });
}

function saveVisibleDraftsImmediately() {
  getDraftFields().forEach((element, index) => {
    saveDraft(element, index);
  });
}

function startDraftManager() {
  if (draftManagerStarted) return;
  draftManagerStarted = true;

  lastDraftPath = location.pathname + location.search;
  scanDraftFields();

  const observer = new MutationObserver(() => {
    scanDraftFields();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  setInterval(() => {
    const currentPath = location.pathname + location.search;
    if (currentPath !== lastDraftPath) {
      lastDraftPath = currentPath;
      scanDraftFields();
    }
  }, 1000);

  window.addEventListener("beforeunload", saveVisibleDraftsImmediately);
}

// ============================================
// 자유게시판 읽은 글 표시
// ============================================

const READ_POSTS_KEY = "ggmReadPosts";
const READ_POSTS_MAX_ITEMS = 600;
let readPostManagerStarted = false;
let readPostEnabled = true;
let cachedReadPosts = {};
let lastReadPostPath = "";

function isFreeboardListPath(pathname = location.pathname) {
  return /^\/town\/freeboard(?:\/\d+)?\/?$/.test(pathname);
}

function isFreeboardPostPath(pathname = location.pathname) {
  return /\/town\/freeboard\/view\/\d+/.test(pathname);
}

function getFreeboardPostKey(urlLike) {
  try {
    const url = new URL(urlLike, location.origin);
    const match = url.pathname.match(/\/town\/freeboard\/view\/(\d+)/);
    return match ? `/town/freeboard/view/${match[1]}` : null;
  } catch (error) {
    return null;
  }
}

function ensureReadPostStyle() {
  if (document.getElementById("ggmplus-read-post-style")) return;

  const style = document.createElement("style");
  style.id = "ggmplus-read-post-style";
  style.textContent = `
    .ggmplus-read-post-row,
    .ggmplus-read-post-row a,
    a.ggmplus-read-post-link {
      color: #8b929f !important;
    }
    .ggmplus-read-post-row a,
    a.ggmplus-read-post-link {
      text-decoration-color: #c5cad3 !important;
    }
    .ggmplus-read-post-row {
      background: rgba(148, 163, 184, 0.08) !important;
    }
  `;
  document.documentElement.appendChild(style);
}

function findPostRow(link) {
  const tableRow = link.closest("tr");
  if (tableRow) return tableRow;

  const listItem = link.closest("li");
  if (listItem) return listItem;

  let current = link;
  for (let depth = 0; depth < 4 && current.parentElement; depth += 1) {
    const parent = current.parentElement;
    const links = parent.querySelectorAll("a[href*='/town/freeboard/view/']");
    const textLength = parent.textContent.trim().length;
    if (links.length <= 2 && textLength > link.textContent.trim().length + 2) {
      return parent;
    }
    current = parent;
  }

  return link;
}

async function loadReadPostState() {
  const stored = await chrome.storage.local.get([READ_POSTS_KEY, "markReadPosts"]);
  readPostEnabled = stored.markReadPosts !== false;
  cachedReadPosts = stored[READ_POSTS_KEY] || {};
}

function trimReadPosts(readPosts) {
  return Object.fromEntries(
    Object.entries(readPosts)
      .sort((a, b) => new Date(b[1].readAt || 0) - new Date(a[1].readAt || 0))
      .slice(0, READ_POSTS_MAX_ITEMS),
  );
}

async function writeReadPosts(readPosts) {
  cachedReadPosts = trimReadPosts(readPosts);
  await chrome.storage.local.set({ [READ_POSTS_KEY]: cachedReadPosts });
}

async function markReadPost(key, title = "") {
  if (!readPostEnabled || !key) return;
  if (cachedReadPosts[key]) return;

  await writeReadPosts({
    ...cachedReadPosts,
    [key]: {
      key,
      path: key,
      title: title.replace(/\s+/g, " ").trim().slice(0, 120),
      readAt: new Date().toISOString(),
    },
  });
}

function clearReadPostMarks() {
  document.querySelectorAll(".ggmplus-read-post-row").forEach((element) => {
    element.classList.remove("ggmplus-read-post-row");
  });
  document.querySelectorAll(".ggmplus-read-post-link").forEach((element) => {
    element.classList.remove("ggmplus-read-post-link");
  });
}

function bindReadPostLink(link) {
  if (link.dataset.ggmplusReadBound === "1") return;
  link.dataset.ggmplusReadBound = "1";

  const handler = () => {
    const key = getFreeboardPostKey(link.href);
    if (key) {
      markReadPost(key, link.textContent || "");
      link.classList.add("ggmplus-read-post-link");
      findPostRow(link).classList.add("ggmplus-read-post-row");
    }
  };

  link.addEventListener("pointerdown", handler);
  link.addEventListener("click", handler);
  link.addEventListener("auxclick", handler);
  link.addEventListener("keydown", (event) => {
    if (event.key === "Enter") handler();
  });
}

function applyReadPostMarks() {
  if (!readPostEnabled) {
    clearReadPostMarks();
    return;
  }

  if (!isFreeboardListPath()) {
    clearReadPostMarks();
    return;
  }

  ensureReadPostStyle();
  const links = document.querySelectorAll("a[href*='/town/freeboard/view/']");
  links.forEach((link) => {
    const key = getFreeboardPostKey(link.href);
    if (!key) return;

    bindReadPostLink(link);
    const isRead = Boolean(cachedReadPosts[key]);
    link.classList.toggle("ggmplus-read-post-link", isRead);
    findPostRow(link).classList.toggle("ggmplus-read-post-row", isRead);
  });
}

async function refreshReadPostMarks() {
  await loadReadPostState();
  if (!readPostEnabled) {
    clearReadPostMarks();
    return;
  }

  if (isFreeboardPostPath()) {
    const key = getFreeboardPostKey(location.href);
    await markReadPost(key, document.title || "");
  }

  applyReadPostMarks();
}

function startReadPostManager() {
  if (readPostManagerStarted) return;
  readPostManagerStarted = true;

  lastReadPostPath = location.pathname + location.search;
  refreshReadPostMarks();

  const observer = new MutationObserver(() => {
    applyReadPostMarks();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  setInterval(() => {
    const currentPath = location.pathname + location.search;
    if (currentPath !== lastReadPostPath) {
      lastReadPostPath = currentPath;
      refreshReadPostMarks();
    }
  }, 1000);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === "local" &&
      (changes.markReadPosts || changes[READ_POSTS_KEY])
    ) {
      refreshReadPostMarks();
    }
  });
}

// ============================================
// 사이트 다크모드
// ============================================

let darkModeStarted = false;

function ensureDarkModeStyle() {
  if (document.getElementById("ggmplus-dark-mode-style")) return;

  const style = document.createElement("style");
  style.id = "ggmplus-dark-mode-style";
  style.textContent = `
    html.ggmplus-dark-mode,
    html.ggmplus-dark-mode body {
      color-scheme: dark;
      background: #0b1020 !important;
      color: #e5edf8 !important;
    }
    html.ggmplus-dark-mode body {
      background:
        radial-gradient(circle at top left, rgba(52, 91, 218, 0.14), transparent 34rem),
        #0b1020 !important;
    }
    html.ggmplus-dark-mode :is(main, section, article, aside, nav, form, table, thead, tbody, tr, td, th, ul, li),
    html.ggmplus-dark-mode :is(.container, .content, .contents, .wrap, .wrapper, .panel, .box, .card, .board, .table, .list, .item) {
      border-color: #263449 !important;
      color: #e5edf8 !important;
    }
    html.ggmplus-dark-mode :is(.container, .content, .contents, .wrap, .wrapper, .panel, .box, .card, .board, .table, table, input, textarea, select) {
      background-color: #121a2b !important;
    }
    html.ggmplus-dark-mode :is(td, th, li, .item, .list-item) {
      background-color: transparent !important;
    }
    html.ggmplus-dark-mode :is(input, textarea, select) {
      border-color: #33445f !important;
      color: #e5edf8 !important;
    }
    html.ggmplus-dark-mode :is(input, textarea, select)::placeholder {
      color: #8fa0b8 !important;
    }
    html.ggmplus-dark-mode a {
      color: #84a7ff !important;
    }
    html.ggmplus-dark-mode hr,
    html.ggmplus-dark-mode :is(td, th, tr) {
      border-color: #263449 !important;
    }
    html.ggmplus-dark-mode .ggmplus-read-post-row,
    html.ggmplus-dark-mode .ggmplus-read-post-row a,
    html.ggmplus-dark-mode a.ggmplus-read-post-link {
      color: #7f8ea3 !important;
    }
    html.ggmplus-dark-mode .ggmplus-read-post-row {
      background: rgba(148, 163, 184, 0.10) !important;
    }
    html.ggmplus-dark-mode .ggmplus-floating-root,
    html.ggmplus-dark-mode .ggmplus-floating-root * {
      color-scheme: light;
    }
  `;
  document.documentElement.appendChild(style);
}

async function applyDarkModeSetting() {
  const stored = await chrome.storage.local.get(["darkModeEnabled"]);
  ensureDarkModeStyle();
  document.documentElement.classList.toggle("ggmplus-dark-mode", stored.darkModeEnabled === true);
}

function startDarkModeManager() {
  if (darkModeStarted) return;
  darkModeStarted = true;
  applyDarkModeSetting();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.darkModeEnabled) {
      applyDarkModeSetting();
    }
  });
}

// ============================================
// 사이트 플로팅 도구함
// ============================================

const FLOATING_QUICK_LINKS = {
  freeboard: { label: "자유게시판", url: "/town/freeboard" },
  quest: { label: "퀘스트", url: "/town/quest" },
  market: { label: "주식", url: "/town/market" },
  shop: { label: "상점", url: "/town/shop/sticker" },
  circle: { label: "동아리", url: "/circle" },
  project: { label: "프로젝트", url: "/project" },
  graduate: { label: "졸업작품", url: "/graduate" },
  portfolio: { label: "포트폴리오", url: "/portfolio" },
  user: { label: "내 정보", url: "/user" },
};
let floatingPanelStarted = false;
let floatingPanelOpen = false;
let floatingPanelMode = "mini";

function ensureFloatingPanelStyle() {
  if (document.getElementById("ggmplus-floating-style")) return;

  const style = document.createElement("style");
  style.id = "ggmplus-floating-style";
  style.textContent = `
    .ggmplus-floating-root {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483646;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .ggmplus-floating-button {
      width: 54px;
      height: 54px;
      padding: 0;
      overflow: hidden;
      border: 0;
      border-radius: 16px;
      background: transparent;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(24, 39, 75, 0.22);
    }
    .ggmplus-floating-button img {
      display: block;
      width: 100%;
      height: 100%;
    }
    .ggmplus-floating-panel {
      position: absolute;
      right: 0;
      bottom: 58px;
      width: 292px;
      max-height: calc(100vh - 92px);
      overflow: hidden;
      border: 1px solid #dfe5f0;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.24);
    }
    .ggmplus-floating-panel.full {
      width: min(410px, calc(100vw - 32px));
      height: min(680px, calc(100vh - 92px));
    }
    .ggmplus-floating-panel[hidden] {
      display: none;
    }
    .ggmplus-floating-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      border-bottom: 1px solid #edf1f7;
      background: #f7f9fd;
    }
    .ggmplus-floating-title {
      color: #172033;
      font-size: 13px;
      font-weight: 900;
    }
    .ggmplus-floating-close {
      width: 26px;
      height: 26px;
      border: 1px solid #c9d4ea;
      border-radius: 8px;
      background: #ffffff;
      color: #345bda;
      cursor: pointer;
      font-size: 14px;
      font-weight: 900;
    }
    .ggmplus-floating-body {
      display: grid;
      gap: 10px;
      padding: 12px;
      max-height: calc(100vh - 150px);
      overflow-y: auto;
    }
    .ggmplus-floating-panel.full .ggmplus-floating-head {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 2;
      padding: 0;
      border: 0;
      background: transparent;
    }
    .ggmplus-floating-panel.full .ggmplus-floating-title {
      display: none;
    }
    .ggmplus-floating-panel.full .ggmplus-floating-body {
      display: block;
      height: 100%;
      max-height: none;
      padding: 0;
      overflow: hidden;
    }
    .ggmplus-floating-panel.full .ggmplus-floating-close {
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.20);
    }
    .ggmplus-floating-frame {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
      background: #f4f7fb;
    }
    .ggmplus-floating-action {
      min-height: 38px;
      border: 0;
      border-radius: 10px;
      background: #345bda;
      color: #ffffff;
      cursor: pointer;
      font-size: 13px;
      font-weight: 900;
    }
    .ggmplus-floating-action.secondary {
      border: 1px solid #c9d4ea;
      background: #f2f6ff;
      color: #345bda;
    }
    .ggmplus-floating-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 7px;
    }
    .ggmplus-floating-link {
      min-height: 34px;
      padding: 0 6px;
      border: 1px solid #dfe5f0;
      border-radius: 9px;
      background: #fbfcff;
      color: #263247;
      cursor: pointer;
      font-size: 12px;
      font-weight: 900;
    }
    .ggmplus-floating-meta {
      color: #7b8494;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.5;
    }
    .ggmplus-floating-section {
      display: grid;
      gap: 8px;
      padding: 10px;
      border: 1px solid #edf1f7;
      border-radius: 13px;
      background: #fbfcff;
    }
    .ggmplus-floating-section h3 {
      margin: 0;
      color: #172033;
      font-size: 13px;
      font-weight: 900;
    }
    .ggmplus-floating-section p {
      margin: -4px 0 0;
      color: #7b8494;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.45;
    }
    .ggmplus-floating-tool {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 18px;
      align-items: center;
      min-height: 44px;
      padding: 8px 10px;
      border: 1px solid #dfe5f0;
      border-radius: 10px;
      background: #ffffff;
      color: #263247;
      cursor: pointer;
      text-align: left;
    }
    .ggmplus-floating-tool strong {
      display: block;
      color: #172033;
      font-size: 12px;
      font-weight: 900;
    }
    .ggmplus-floating-tool small {
      display: block;
      overflow: hidden;
      color: #7b8494;
      font-size: 11px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ggmplus-floating-tool span:last-child {
      color: #a0a8b5;
      font-size: 20px;
      font-weight: 900;
    }
    .ggmplus-floating-topline {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
  `;
  document.documentElement.appendChild(style);
}

function createFloatingButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function setFloatingTitle(root, title) {
  root.querySelector(".ggmplus-floating-title").textContent = title;
}

function createFloatingSection(title, subtitle = "") {
  const section = document.createElement("section");
  section.className = "ggmplus-floating-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.appendChild(heading);
  if (subtitle) {
    const description = document.createElement("p");
    description.textContent = subtitle;
    section.appendChild(description);
  }
  return section;
}

function createFloatingTool(title, detail, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ggmplus-floating-tool";
  button.innerHTML = `<span><strong>${title}</strong><small>${detail}</small></span><span>›</span>`;
  button.addEventListener("click", onClick);
  return button;
}

async function renderFloatingPanel(root) {
  const panel = root.querySelector(".ggmplus-floating-panel");
  const body = root.querySelector(".ggmplus-floating-body");
  body.replaceChildren();
  panel.classList.toggle("full", floatingPanelMode === "full");

  if (floatingPanelMode === "full") {
    renderFloatingExtensionFrame(root);
    panel.hidden = !floatingPanelOpen;
    return;
  }

  setFloatingTitle(root, "GGMPlus");

  const [status, settings, drafts] = await Promise.all([
    chrome.runtime.sendMessage({ type: "GET_STATUS" }),
    chrome.runtime.sendMessage({ type: "GET_FEATURE_SETTINGS" }),
    chrome.runtime.sendMessage({ type: "GET_DRAFTS" }),
  ]);

  const attendanceLabel = status.todayChecked ? "오늘 출석 완료" : "출석체크 실행";
  const attendanceButton = createFloatingButton(
    attendanceLabel,
    status.todayChecked ? "ggmplus-floating-action secondary" : "ggmplus-floating-action",
    async () => {
      if (!status.hasToken) {
        location.href = "/user/login";
        return;
      }
      if (status.todayChecked) return;
      attendanceButton.disabled = true;
      attendanceButton.textContent = "처리 중...";
      await chrome.runtime.sendMessage({ type: "MANUAL_ATTENDANCE" });
      renderFloatingPanel(root);
    },
  );
  body.appendChild(attendanceButton);

  const grid = document.createElement("div");
  grid.className = "ggmplus-floating-grid";
  const favorites = (settings.favoriteQuickLinks || ["freeboard", "quest", "market", "shop"])
    .map((id) => FLOATING_QUICK_LINKS[id])
    .filter(Boolean)
    .slice(0, 6);
  favorites.forEach((link) => {
    grid.appendChild(createFloatingButton(link.label, "ggmplus-floating-link", () => {
      location.href = link.url;
    }));
  });
  body.appendChild(grid);

  const draftCount = (drafts.items || []).length;
  const meta = document.createElement("div");
  meta.className = "ggmplus-floating-meta";
  meta.textContent = draftCount
    ? `임시저장 ${draftCount}개가 있습니다. 전체 도구에서 확인할 수 있습니다.`
    : "필요한 기능만 작게 꺼내놓았습니다.";
  body.appendChild(meta);

  body.appendChild(createFloatingButton("전체 도구 보기", "ggmplus-floating-action secondary", () => {
    floatingPanelMode = "full";
    renderFloatingPanel(root);
  }));

  panel.hidden = !floatingPanelOpen;
}

function renderFloatingExtensionFrame(root) {
  const body = root.querySelector(".ggmplus-floating-body");
  body.replaceChildren();
  setFloatingTitle(root, "GGMPlus");

  const frame = document.createElement("iframe");
  frame.className = "ggmplus-floating-frame";
  frame.title = "GGMPlus";
  frame.src = chrome.runtime.getURL("popup.html");
  body.appendChild(frame);
}

async function renderFloatingFullPanel(root) {
  const body = root.querySelector(".ggmplus-floating-body");
  body.replaceChildren();
  setFloatingTitle(root, "GGMPlus 전체 도구");

  const [status, settings, drafts, readPosts] = await Promise.all([
    chrome.runtime.sendMessage({ type: "GET_STATUS" }),
    chrome.runtime.sendMessage({ type: "GET_FEATURE_SETTINGS" }),
    chrome.runtime.sendMessage({ type: "GET_DRAFTS" }),
    chrome.runtime.sendMessage({ type: "GET_READ_POSTS" }),
  ]);

  const topLine = document.createElement("div");
  topLine.className = "ggmplus-floating-topline";
  topLine.appendChild(createFloatingButton("간단히 보기", "ggmplus-floating-action secondary", () => {
    floatingPanelMode = "mini";
    renderFloatingPanel(root);
  }));
  topLine.appendChild(createFloatingButton("메인 편집", "ggmplus-floating-action secondary", () => {
    chrome.runtime.sendMessage({ type: "OPEN_EXTENSION_PAGE", page: "home-settings.html" });
  }));
  body.appendChild(topLine);

  const actionSection = createFloatingSection("지금 할 일", "바로 처리할 수 있는 것만 모았습니다.");
  actionSection.appendChild(createFloatingButton(
    status.todayChecked ? "오늘 출석 완료" : "출석체크 실행",
    status.todayChecked ? "ggmplus-floating-action secondary" : "ggmplus-floating-action",
    async () => {
      if (!status.hasToken) {
        location.href = "/user/login";
        return;
      }
      if (status.todayChecked) return;
      await chrome.runtime.sendMessage({ type: "MANUAL_ATTENDANCE" });
      renderFloatingPanel(root);
    },
  ));
  const draftCount = (drafts.items || []).length;
  if (draftCount > 0) {
    actionSection.appendChild(createFloatingTool(
      `임시저장 ${draftCount}개`,
      "확장 설정 화면에서 목록을 확인합니다",
      () => chrome.runtime.sendMessage({ type: "OPEN_EXTENSION_PAGE", page: "drafts-settings.html" }),
    ));
  }
  body.appendChild(actionSection);

  const quickSection = createFloatingSection("빠른 이동", "자주 쓰는 곳을 사이트 위에서 바로 엽니다.");
  const quickGrid = document.createElement("div");
  quickGrid.className = "ggmplus-floating-grid";
  const favorites = (settings.favoriteQuickLinks || ["freeboard", "quest", "market", "shop"])
    .map((id) => FLOATING_QUICK_LINKS[id])
    .filter(Boolean)
    .slice(0, 6);
  favorites.forEach((link) => {
    quickGrid.appendChild(createFloatingButton(link.label, "ggmplus-floating-link", () => {
      location.href = link.url;
    }));
  });
  quickSection.appendChild(quickGrid);
  body.appendChild(quickSection);

  const toolsSection = createFloatingSection("내 도구", "확장 팝업의 주요 기능을 이 패널 안에서 바로 다룹니다.");
  toolsSection.appendChild(createFloatingTool(
    "관심 알림",
    "새 글, 퀘스트, 주식 변화를 지금 확인",
    async () => {
      await chrome.runtime.sendMessage({ type: "RUN_UTILITY_MONITOR" });
      renderFloatingPanel(root);
    },
  ));
  toolsSection.appendChild(createFloatingTool(
    "자동 알림",
    "일간보고서와 취업 응원 알림 설정",
    () => chrome.runtime.sendMessage({ type: "OPEN_EXTENSION_PAGE", page: "automation-settings.html" }),
  ));
  toolsSection.appendChild(createFloatingTool(
    "사이트 화면 보조",
    `읽은 글 ${settings.markReadPosts ? "표시 중" : "꺼짐"} · 기록 ${(readPosts.items || []).length}개`,
    () => chrome.runtime.sendMessage({ type: "OPEN_EXTENSION_PAGE", page: "site-settings.html" }),
  ));
  toolsSection.appendChild(createFloatingTool(
    "전체 설정",
    "토큰, 로그, 초기화 관리",
    () => chrome.runtime.sendMessage({ type: "OPEN_EXTENSION_PAGE", page: "settings.html" }),
  ));
  body.appendChild(toolsSection);
}

async function refreshFloatingPanelVisibility() {
  const stored = await chrome.storage.local.get(["showFloatingPanel"]);
  const enabled = stored.showFloatingPanel !== false;
  const root = document.getElementById("ggmplus-floating-root");
  if (root) {
    root.hidden = !enabled;
  }
}

async function startFloatingPanel() {
  if (floatingPanelStarted) return;
  floatingPanelStarted = true;

  ensureFloatingPanelStyle();

  const root = document.createElement("div");
  root.id = "ggmplus-floating-root";
  root.className = "ggmplus-floating-root";
  root.innerHTML = `
    <div class="ggmplus-floating-panel" hidden>
      <div class="ggmplus-floating-head">
        <span class="ggmplus-floating-title">GGMPlus</span>
        <button type="button" class="ggmplus-floating-close">×</button>
      </div>
      <div class="ggmplus-floating-body"></div>
    </div>
    <button type="button" class="ggmplus-floating-button" title="GGMPlus">
      <img src="${chrome.runtime.getURL("icons/icon48.png")}" alt="GGMPlus">
    </button>
  `;
  document.documentElement.appendChild(root);

  const panel = root.querySelector(".ggmplus-floating-panel");
  root.querySelector(".ggmplus-floating-button").addEventListener("click", async () => {
    floatingPanelOpen = !floatingPanelOpen;
    panel.hidden = !floatingPanelOpen;
    if (!floatingPanelOpen) {
      floatingPanelMode = "mini";
    }
    if (floatingPanelOpen) {
      await renderFloatingPanel(root);
    }
  });
  root.querySelector(".ggmplus-floating-close").addEventListener("click", () => {
    floatingPanelOpen = false;
    floatingPanelMode = "mini";
    panel.hidden = true;
  });

  await refreshFloatingPanelVisibility();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.showFloatingPanel) {
      refreshFloatingPanelVisibility();
    }
  });
}

// ============================================
// 일간보고서 자동 입력
// ============================================

let dailyReportFillStarted = false;
let lastDailyReportFillPath = "";

function getProjectTeamIdFromPath(pathname = location.pathname) {
  const match = pathname.match(/\/project\/team\/(\d+)/);
  return match ? match[1] : null;
}

function ensureDailyReportFillStyle() {
  if (document.getElementById("ggmplus-daily-fill-style")) return;

  const style = document.createElement("style");
  style.id = "ggmplus-daily-fill-style";
  style.textContent = `
    .ggmplus-daily-fill-note {
      margin: 8px 0;
      padding: 9px 10px;
      border: 1px solid #bfcdf7;
      border-radius: 8px;
      background: #eef3ff;
      color: #2455d6;
      font-size: 12px;
      font-weight: 800;
      line-height: 1.45;
    }
  `;
  document.documentElement.appendChild(style);
}

function setNativeValue(element, value) {
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(element),
    "value",
  );
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function findDailyReportTextarea() {
  const candidates = [...document.querySelectorAll("textarea")]
    .filter((textarea) => {
      const placeholder = textarea.getAttribute("placeholder") || "";
      const container = textarea.closest(".daily-record-card, .content-panel, form, section, div");
      const text = container ? container.textContent : "";
      return (
        placeholder.includes("오늘") ||
        placeholder.includes("기록") ||
        text.includes("오늘 한 일") ||
        text.includes("하루하루 기록")
      );
    });

  return candidates[0] || null;
}

function showDailyReportFillNote(textarea) {
  if (document.getElementById("ggmplus-daily-fill-note")) return;
  ensureDailyReportFillStyle();

  const note = document.createElement("div");
  note.id = "ggmplus-daily-fill-note";
  note.className = "ggmplus-daily-fill-note";
  note.textContent = "GGMPlus가 일간보고서 내용을 입력했습니다. 확인 후 직접 저장해주세요.";
  textarea.insertAdjacentElement("beforebegin", note);
}

async function tryFillDailyReport() {
  const teamId = getProjectTeamIdFromPath();
  if (!teamId) return;

  const stored = await chrome.storage.local.get(["pendingDailyReportFill"]);
  const pending = stored.pendingDailyReportFill;
  if (!pending || String(pending.teamId) !== String(teamId)) return;

  const createdAt = Date.parse(pending.createdAt || "");
  if (Number.isFinite(createdAt) && Date.now() - createdAt > 30 * 60 * 1000) {
    await chrome.storage.local.remove(["pendingDailyReportFill"]);
    return;
  }

  const textarea = findDailyReportTextarea();
  if (!textarea) return;

  const content = String(pending.content || "").slice(0, 100);
  if (!content.trim()) return;

  setNativeValue(textarea, content);
  showDailyReportFillNote(textarea);
  await chrome.storage.local.remove(["pendingDailyReportFill"]);
}

function startDailyReportFillManager() {
  if (dailyReportFillStarted) return;
  dailyReportFillStarted = true;

  lastDailyReportFillPath = location.pathname + location.search;
  tryFillDailyReport();

  const observer = new MutationObserver(() => {
    tryFillDailyReport();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  setInterval(() => {
    const currentPath = location.pathname + location.search;
    if (currentPath !== lastDailyReportFillPath) {
      lastDailyReportFillPath = currentPath;
      tryFillDailyReport();
    }
  }, 1000);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.pendingDailyReportFill) {
      tryFillDailyReport();
    }
  });
}

// ============================================
// 🚀 초기화
// ============================================

// 페이지 로드 완료 후 실행
if (document.readyState === "complete") {
  startTokenWatcher();
  startDraftManager();
  startReadPostManager();
  startDarkModeManager();
  startFloatingPanel();
  startDailyReportFillManager();
} else {
  window.addEventListener("load", () => {
    startTokenWatcher();
    startDraftManager();
    startReadPostManager();
    startDarkModeManager();
    startFloatingPanel();
    startDailyReportFillManager();
  });
}

console.log("[GGMAuto Content] 🎉 Content Script 로드됨:", window.location.hostname);
