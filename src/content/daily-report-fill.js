// Daily report fill helper.
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
// GGM 페이지 API 요청 브리지
// ============================================
