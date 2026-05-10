const QUICK_LINKS = [
  { id: "freeboard", label: "자유게시판" },
  { id: "quest", label: "퀘스트" },
  { id: "market", label: "주식" },
  { id: "shop", label: "상점" },
  { id: "circle", label: "동아리" },
  { id: "project", label: "프로젝트" },
  { id: "graduate", label: "졸업작품" },
  { id: "portfolio", label: "포트폴리오" },
  { id: "user", label: "내 정보" },
];

const FEATURES = [
  { id: "attendance", title: "출석체크", desc: "출석 상태와 수동 실행" },
  { id: "launcher", title: "빠른 이동 전체", desc: "모든 바로가기 보기" },
  { id: "alerts", title: "관심 알림", desc: "새 글, 퀘스트, 주식 확인" },
  { id: "automation", title: "자동 알림", desc: "시간, 조건, 행동 조합" },
  { id: "drafts", title: "임시저장", desc: "저장된 글과 댓글 관리" },
  { id: "site", title: "사이트 화면 보조", desc: "사이트 위 편의 기능" },
  { id: "settings", title: "전체 설정", desc: "토큰, 로그, 초기화" },
];

let currentSettings = {};
FEATURES.splice(1, 0, {
  id: "mission",
  title: "자동 미션",
  desc: "미션 수행 자동화",
});
FEATURES.splice(2, 0, {
  id: "reward",
  title: "자동 수령",
  desc: "미션과 우편함 보상 수령",
});
let featureOrder = FEATURES.map((feature) => feature.id);

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

function getFeature(id) {
  return FEATURES.find((feature) => feature.id === id);
}

const FEATURE_ICON_META = {
  attendance: { icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v3M16 3v3M5 9h14"/><rect x="4" y="5" width="16" height="15" rx="3"/><path d="m8 14 2.2 2.2L16 11"/></svg>', tone: "" },
  launcher: { icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/><path d="M5 5h5M5 19h5"/></svg>', tone: "green" },
  alerts: { icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>', tone: "orange" },
  automation: { icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>', tone: "teal" },
  drafts: { icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M8 12h8M8 16h6"/></svg>', tone: "purple" },
  site: { icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h18M8 14h4M16 14h2"/></svg>', tone: "teal" },
  settings: { icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1 1.6v.2h-4V21a1.8 1.8 0 0 0-1-1.6 1.8 1.8 0 0 0-2 .4l-.1.1-2.8-2.8.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.6-1H3v-4h.2a1.8 1.8 0 0 0 1.6-1 1.8 1.8 0 0 0-.4-2l-.1-.1 2.8-2.8.1.1a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1-1.6V3h4v.2a1.8 1.8 0 0 0 1 1.6 1.8 1.8 0 0 0 2-.4l.1-.1 2.8 2.8-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.6 1h.2v4h-.2a1.8 1.8 0 0 0-1.8 1Z"/></svg>', tone: "red" },
};

FEATURE_ICON_META.mission = {
  icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l2 2 4-5"/><path d="M5 4h14v16H5z"/><path d="M8 17h8"/></svg>',
  tone: "green",
};

FEATURE_ICON_META.reward = {
  icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v8H4v-8"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 2.1-3.9C10.4 4.2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 1 0-2.1-3.9C13.6 4.2 12 7 12 7z"/></svg>',
  tone: "orange",
};

function createFeatureIcon(featureId) {
  const meta = FEATURE_ICON_META[featureId] || FEATURE_ICON_META.settings;
  const icon = document.createElement("span");
  icon.className = `feature-icon ${meta.tone}`.trim();
  icon.innerHTML = meta.icon;
  return icon;
}

function moveFeature(id, direction) {
  const index = featureOrder.indexOf(id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= featureOrder.length) return;
  [featureOrder[index], featureOrder[nextIndex]] = [featureOrder[nextIndex], featureOrder[index]];
  renderFeatureManageList();
}

function renderFeatureManageList() {
  const list = document.getElementById("featureManageList");
  const hidden = new Set(currentSettings.hiddenHomeFeatures || []);
  list.replaceChildren();

  featureOrder.map(getFeature).filter(Boolean).forEach((feature, index) => {
    const item = document.createElement("div");
    item.className = "manage-item";
    item.dataset.featureId = feature.id;

    const label = document.createElement("label");
    label.className = "manage-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !hidden.has(feature.id);
    checkbox.dataset.featureToggle = feature.id;
    const copy = document.createElement("span");
    copy.innerHTML = `<strong>${feature.title}</strong><small>${feature.desc}</small>`;
    label.append(checkbox, createFeatureIcon(feature.id), copy);

    const actions = document.createElement("div");
    actions.className = "manage-actions";
    const up = document.createElement("button");
    up.type = "button";
    up.className = "mini-link";
    up.textContent = "↑";
    up.disabled = index === 0;
    up.addEventListener("click", () => moveFeature(feature.id, -1));
    const down = document.createElement("button");
    down.type = "button";
    down.className = "mini-link";
    down.textContent = "↓";
    down.disabled = index === featureOrder.length - 1;
    down.addEventListener("click", () => moveFeature(feature.id, 1));
    actions.append(up, down);

    item.append(label, actions);
    list.appendChild(item);
  });
}

function updateQuickCount() {
  const selected = document.querySelectorAll("[data-quick-toggle]:checked").length;
  const badge = document.getElementById("quickCountBadge");
  badge.textContent = `${selected}개`;
  badge.className = selected > 0 ? "badge success" : "badge";
}

function renderQuickManageGrid() {
  const grid = document.getElementById("quickManageGrid");
  const selected = new Set(currentSettings.favoriteQuickLinks || []);
  grid.replaceChildren();

  QUICK_LINKS.forEach((link) => {
    const label = document.createElement("label");
    label.className = "toggle-card";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.has(link.id);
    checkbox.dataset.quickToggle = link.id;
    checkbox.addEventListener("change", () => {
      const checked = [...document.querySelectorAll("[data-quick-toggle]:checked")];
      if (checked.length > 6) {
        checkbox.checked = false;
        showToast("빠른 이동은 최대 6개까지 표시할 수 있습니다");
      }
      updateQuickCount();
    });
    const visual = document.createElement("span");
    visual.className = "toggle-visual";
    const name = document.createElement("span");
    name.className = "toggle-name";
    name.textContent = link.label;
    label.append(checkbox, visual, name);
    grid.appendChild(label);
  });

  updateQuickCount();
}

async function loadSettings() {
  currentSettings = await chrome.runtime.sendMessage({ type: "GET_FEATURE_SETTINGS" });
  featureOrder = [
    ...(currentSettings.homeFeatureOrder || []),
    ...FEATURES.map((feature) => feature.id),
  ].filter((id, index, list) => list.indexOf(id) === index);
  renderFeatureManageList();
  renderQuickManageGrid();
}

async function saveSettings() {
  const hiddenHomeFeatures = [...document.querySelectorAll("[data-feature-toggle]")]
    .filter((checkbox) => !checkbox.checked)
    .map((checkbox) => checkbox.dataset.featureToggle);
  const favoriteQuickLinks = [...document.querySelectorAll("[data-quick-toggle]:checked")]
    .map((checkbox) => checkbox.dataset.quickToggle)
    .slice(0, 6);

  const response = await chrome.runtime.sendMessage({
    type: "SAVE_FEATURE_SETTINGS",
    data: {
      ...currentSettings,
      homeFeatureOrder: featureOrder,
      hiddenHomeFeatures,
      favoriteQuickLinks,
    },
  });

  if (!response.success) {
    showToast(response.error || "설정을 저장하지 못했습니다");
    return;
  }

  currentSettings = response.settings;
  showToast("메인 구성을 저장했습니다");
  loadSettings();
}

document.getElementById("backBtn").addEventListener("click", () => { window.location.href = "popup.html"; });
document.getElementById("globalSettingsBtn").addEventListener("click", () => { window.location.href = "settings.html"; });
document.getElementById("saveBtn").addEventListener("click", saveSettings);

loadSettings().catch((error) => {
  console.error("메인 편집 설정 조회 실패:", error);
});
