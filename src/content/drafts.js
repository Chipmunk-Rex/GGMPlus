// Post and comment draft autosave.
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
