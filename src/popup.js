const QUICK_LINKS = [
  { id: "freeboard", label: "자유게시판", icon: "freeboard", url: "/town/freeboard", tone: "" },
  { id: "quest", label: "퀘스트", icon: "quest", url: "/town/quest", tone: "green" },
  { id: "market", label: "주식", icon: "market", url: "/town/market", tone: "purple" },
  { id: "shop", label: "상점", icon: "shop", url: "/town/shop/sticker", tone: "orange" },
  { id: "circle", label: "동아리", icon: "circle", url: "/circle", tone: "" },
  { id: "project", label: "프로젝트", icon: "project", url: "/project", tone: "green" },
  { id: "graduate", label: "졸업작품", icon: "graduate", url: "/graduate", tone: "orange" },
  { id: "portfolio", label: "포트폴리오", icon: "portfolio", url: "/portfolio", tone: "" },
  { id: "user", label: "내 정보", icon: "user", url: "/user", tone: "green" },
];

const ICONS = {
  attendance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v3M16 3v3M5 9h14"/><rect x="4" y="5" width="16" height="15" rx="3"/><path d="m8 14 2.2 2.2L16 11"/></svg>',
  mission: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l2 2 4-5"/><path d="M5 4h14v16H5z"/><path d="M8 17h8"/></svg>',
  reward: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v8H4v-8"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 2.1-3.9C10.4 4.2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 1 0-2.1-3.9C13.6 4.2 12 7 12 7z"/></svg>',
  launcher: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/><path d="M5 5h5M5 19h5"/></svg>',
  alerts: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',
  automation: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
  drafts: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M8 12h8M8 16h6"/></svg>',
  site: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h18M8 14h4M16 14h2"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1 1.6v.2h-4V21a1.8 1.8 0 0 0-1-1.6 1.8 1.8 0 0 0-2 .4l-.1.1-2.8-2.8.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.6-1H3v-4h.2a1.8 1.8 0 0 0 1.6-1 1.8 1.8 0 0 0-.4-2l-.1-.1 2.8-2.8.1.1a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1-1.6V3h4v.2a1.8 1.8 0 0 0 1 1.6 1.8 1.8 0 0 0 2-.4l.1-.1 2.8 2.8-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.6 1h.2v4h-.2a1.8 1.8 0 0 0-1.8 1Z"/></svg>',
  freeboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v12H8l-3 3z"/><path d="M8 9h8M8 13h5"/></svg>',
  quest: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8l3 5-7 11L5 9z"/><path d="M9 9h6M10 13h4"/></svg>',
  market: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18 9 13l4 4 7-9"/><path d="M16 8h4v4"/></svg>',
  shop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10h14l-1 10H6z"/><path d="M8 10a4 4 0 0 1 8 0M4 10l2-5h12l2 5"/></svg>',
  circle: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0"/></svg>',
  project: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h7l2 3h7v10H4z"/><path d="M8 13h8"/></svg>',
  graduate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 8 9-4 9 4-9 4z"/><path d="M7 11v5c3 2 7 2 10 0v-5M19 9v6"/></svg>',
  portfolio: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M9 5V3h6v2M8 12h8M8 16h5"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>',
  add: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
};

function createIconMarkup(name) {
  return ICONS[name] || ICONS.settings;
}

const FEATURES = [
  {
    id: "attendance",
    title: "출석체크",
    desc: "출석 상태와 수동 실행",
    icon: "attendance",
    tone: "",
    page: "attendance.html",
  },
  {
    id: "mission",
    title: "자동 미션",
    desc: "미션 수행 자동화",
    icon: "mission",
    tone: "green",
    page: "mission.html",
  },
  {
    id: "reward",
    title: "자동 수령",
    desc: "미션과 우편함 보상 수령",
    icon: "reward",
    tone: "orange",
    page: "reward.html",
  },
  {
    id: "launcher",
    title: "빠른 이동 전체",
    desc: "모든 바로가기 보기",
    icon: "launcher",
    tone: "green",
    page: "launcher.html",
  },
  {
    id: "alerts",
    title: "관심 알림",
    desc: "새 글, 퀘스트, 주식 확인",
    icon: "alerts",
    tone: "orange",
    page: "alerts.html",
  },
  {
    id: "automation",
    title: "자동 알림",
    desc: "시간, 조건, 행동을 조합",
    icon: "automation",
    tone: "teal",
    page: "automation.html",
  },
  {
    id: "drafts",
    title: "임시저장",
    desc: "저장된 글과 댓글 관리",
    icon: "drafts",
    tone: "purple",
    page: "drafts.html",
  },
  {
    id: "site",
    title: "사이트 화면 보조",
    desc: "사이트 위 편의 기능",
    icon: "site",
    tone: "teal",
    page: "site.html",
  },
  {
    id: "settings",
    title: "전체 설정",
    desc: "토큰, 로그, 초기화",
    icon: "settings",
    tone: "red",
    page: "settings.html",
  },
];

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

async function openGgmPage(url) {
  await chrome.runtime.sendMessage({ type: "OPEN_GGM_PAGE", url });
}

function getQuickLink(id) {
  return QUICK_LINKS.find((link) => link.id === id);
}

function getFeature(id) {
  return FEATURES.find((feature) => feature.id === id);
}

function createActionButton({ label, detail, tone = "", onClick }) {
  const button = document.createElement("button");
  button.className = `action-btn ${tone}`.trim();
  const labelNode = document.createElement("span");
  labelNode.className = "action-label";
  labelNode.textContent = label;
  const detailNode = document.createElement("span");
  detailNode.className = "action-detail";
  detailNode.textContent = detail;
  button.append(labelNode, detailNode);
  button.addEventListener("click", onClick);
  return button;
}

async function runAttendance(button) {
  button.disabled = true;
  button.querySelector(".action-label").textContent = "출석 처리 중...";
  try {
    const response = await chrome.runtime.sendMessage({ type: "MANUAL_ATTENDANCE" });
    showToast(response.success ? "출석체크 완료" : "출석체크 실패");
    await loadHome();
  } catch (error) {
    showToast("출석체크 중 오류가 발생했습니다");
    button.disabled = false;
  }
}

function renderActions(status, drafts, automationRules) {
  const list = document.getElementById("actionList");
  const badge = document.getElementById("todayStatusBadge");
  list.replaceChildren();

  if (!status.hasToken) {
    badge.textContent = "로그인 필요";
    badge.className = "badge error";
    list.appendChild(createActionButton({
      label: "GGM 로그인",
      detail: "로그인 후 출석과 알림을 사용할 수 있습니다",
      tone: "red",
      onClick: () => openGgmPage("/user/login"),
    }));
    return;
  }

  if (!status.todayChecked) {
    badge.textContent = "출석 필요";
    badge.className = "badge pending";
    list.appendChild(createActionButton({
      label: "출석체크 실행",
      detail: "오늘 보상을 바로 받습니다",
      onClick: (event) => runAttendance(event.currentTarget),
    }));
  } else {
    badge.textContent = "출석 완료";
    badge.className = "badge success";
  }

  const draftCount = (drafts.items || []).length;
  if (draftCount > 0) {
    list.appendChild(createActionButton({
      label: `임시저장 ${draftCount}개`,
      detail: "작성 중이던 내용을 확인합니다",
      tone: "purple",
      onClick: () => { window.location.href = "drafts-settings.html"; },
    }));
  }

  const activeAutomationCount = (automationRules || []).filter((rule) => rule.enabled).length;
  if (activeAutomationCount > 0) {
    list.appendChild(createActionButton({
      label: `자동 알림 ${activeAutomationCount}개`,
      detail: "시간이 되면 조건을 확인합니다",
      tone: "green",
      onClick: () => { window.location.href = "automation.html"; },
    }));
  }

  if (!list.children.length) {
    list.appendChild(createActionButton({
      label: "GGM Town 열기",
      detail: "지금 처리할 작업이 없습니다",
      tone: "green",
      onClick: () => openGgmPage("/town"),
    }));
  }
}

function renderQuickLinks(settings) {
  const grid = document.getElementById("favoriteQuickGrid");
  const selected = settings.favoriteQuickLinks || ["freeboard", "quest", "market", "shop"];
  const links = selected.map(getQuickLink).filter(Boolean);
  grid.replaceChildren();

  if (!links.length) {
    const empty = document.createElement("button");
    empty.className = "quick-btn";
    empty.innerHTML = `<span class="quick-icon">${createIconMarkup("add")}</span>추가`;
    empty.addEventListener("click", () => {
      window.location.href = "home-settings.html";
    });
    grid.appendChild(empty);
    return;
  }

  links.forEach((link) => {
    const button = document.createElement("button");
    button.className = "quick-btn";
    button.dataset.url = link.url;
    button.innerHTML = `<span class="quick-icon ${link.tone}">${createIconMarkup(link.icon)}</span>${link.label}`;
    button.addEventListener("click", async () => {
      await openGgmPage(link.url);
      window.close();
    });
    grid.appendChild(button);
  });
}

function renderFeatures(settings) {
  const container = document.getElementById("homeFeatures");
  const order = settings.homeFeatureOrder || FEATURES.map((feature) => feature.id);
  const hidden = new Set(settings.hiddenHomeFeatures || []);
  const visible = order.map(getFeature).filter((feature) => feature && !hidden.has(feature.id));
  container.replaceChildren();

  if (!visible.length) {
    const empty = document.createElement("section");
    empty.className = "card";
    empty.innerHTML = `<div class="empty-state">보이는 도구가 없습니다. 메인 편집에서 다시 추가할 수 있습니다.</div>`;
    container.appendChild(empty);
    return;
  }

  visible.forEach((feature) => {
    const button = document.createElement("button");
    button.className = "tool-card";
    button.innerHTML = `
      <span class="feature-icon ${feature.tone}">${createIconMarkup(feature.icon)}</span>
      <span class="tool-copy">
        <span class="feature-title">${feature.title}</span>
        <span class="feature-desc">${feature.desc}</span>
      </span>
      <span class="tool-arrow">›</span>
    `;
    button.addEventListener("click", () => {
      window.location.href = feature.page;
    });
    container.appendChild(button);
  });
}

async function loadHome() {
  try {
    const [status, settings, drafts, automations] = await Promise.all([
      chrome.runtime.sendMessage({ type: "GET_STATUS" }),
      chrome.runtime.sendMessage({ type: "GET_FEATURE_SETTINGS" }),
      chrome.runtime.sendMessage({ type: "GET_DRAFTS" }),
      chrome.runtime.sendMessage({ type: "GET_AUTOMATION_RULES" }),
    ]);

    renderActions(status, drafts, automations.rules || []);
    renderQuickLinks(settings);
    renderFeatures(settings);
  } catch (error) {
    console.error("홈 조회 실패:", error);
  }
}

document.getElementById("settingsBtn").addEventListener("click", () => {
  window.location.href = "settings.html";
});

document.getElementById("editHomeBtn").addEventListener("click", () => {
  window.location.href = "home-settings.html";
});

document.getElementById("editToolsBtn").addEventListener("click", () => {
  window.location.href = "home-settings.html";
});

document.getElementById("allLinksBtn").addEventListener("click", () => {
  window.location.href = "launcher.html";
});

loadHome();
