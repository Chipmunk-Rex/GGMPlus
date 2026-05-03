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
  { id: "drafts", title: "임시저장", desc: "저장된 글과 댓글 관리" },
  { id: "site", title: "사이트 화면 보조", desc: "사이트 위 편의 기능" },
  { id: "settings", title: "전체 설정", desc: "토큰, 로그, 초기화" },
];

let currentSettings = {};
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
    label.append(checkbox, copy);

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
