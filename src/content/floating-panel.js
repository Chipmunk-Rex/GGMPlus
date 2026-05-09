// Floating extension panel.
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
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATUS }),
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_FEATURE_SETTINGS }),
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_DRAFTS }),
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
      await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.MANUAL_ATTENDANCE });
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
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATUS }),
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_FEATURE_SETTINGS }),
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_DRAFTS }),
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_READ_POSTS }),
  ]);

  const topLine = document.createElement("div");
  topLine.className = "ggmplus-floating-topline";
  topLine.appendChild(createFloatingButton("간단히 보기", "ggmplus-floating-action secondary", () => {
    floatingPanelMode = "mini";
    renderFloatingPanel(root);
  }));
  topLine.appendChild(createFloatingButton("메인 편집", "ggmplus-floating-action secondary", () => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OPEN_EXTENSION_PAGE, page: "home-settings.html" });
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
      await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.MANUAL_ATTENDANCE });
      renderFloatingPanel(root);
    },
  ));
  const draftCount = (drafts.items || []).length;
  if (draftCount > 0) {
    actionSection.appendChild(createFloatingTool(
      `임시저장 ${draftCount}개`,
      "확장 설정 화면에서 목록을 확인합니다",
      () => chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OPEN_EXTENSION_PAGE, page: "drafts-settings.html" }),
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
      await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RUN_UTILITY_MONITOR });
      renderFloatingPanel(root);
    },
  ));
  toolsSection.appendChild(createFloatingTool(
    "자동 알림",
    "일간보고서와 취업 응원 알림 설정",
    () => chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OPEN_EXTENSION_PAGE, page: "automation-settings.html" }),
  ));
  toolsSection.appendChild(createFloatingTool(
    "사이트 화면 보조",
    `읽은 글 ${settings.markReadPosts ? "표시 중" : "꺼짐"} · 기록 ${(readPosts.items || []).length}개`,
    () => chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OPEN_EXTENSION_PAGE, page: "site-settings.html" }),
  ));
  toolsSection.appendChild(createFloatingTool(
    "전체 설정",
    "토큰, 로그, 초기화 관리",
    () => chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OPEN_EXTENSION_PAGE, page: "settings.html" }),
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
