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
// 🚀 초기화
// ============================================

// 페이지 로드 완료 후 실행
if (document.readyState === "complete") {
  startTokenWatcher();
  startDraftManager();
} else {
  window.addEventListener("load", () => {
    startTokenWatcher();
    startDraftManager();
  });
}

console.log("[GGMAuto Content] 🎉 Content Script 로드됨:", window.location.hostname);
