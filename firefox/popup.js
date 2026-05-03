const QUICK_LINKS = [
  { id: "freeboard", label: "자유게시판", icon: "게", url: "/town/freeboard", tone: "" },
  { id: "quest", label: "퀘스트", icon: "퀘", url: "/town/quest", tone: "green" },
  { id: "market", label: "주식", icon: "주", url: "/town/market", tone: "purple" },
  { id: "shop", label: "상점", icon: "상", url: "/town/shop/sticker", tone: "orange" },
  { id: "circle", label: "동아리", icon: "동", url: "/circle", tone: "" },
  { id: "project", label: "프로젝트", icon: "프", url: "/project", tone: "green" },
  { id: "graduate", label: "졸업작품", icon: "졸", url: "/graduate", tone: "orange" },
  { id: "portfolio", label: "포트폴리오", icon: "포", url: "/portfolio", tone: "" },
  { id: "user", label: "내 정보", icon: "나", url: "/user", tone: "green" },
];

const FEATURES = [
  {
    id: "attendance",
    title: "출석체크",
    desc: "출석 상태와 수동 실행",
    icon: "출",
    tone: "",
    page: "attendance.html",
  },
  {
    id: "launcher",
    title: "빠른 이동 전체",
    desc: "모든 바로가기 보기",
    icon: "이",
    tone: "green",
    page: "launcher.html",
  },
  {
    id: "alerts",
    title: "관심 알림",
    desc: "새 글, 퀘스트, 주식 확인",
    icon: "알",
    tone: "orange",
    page: "alerts.html",
  },
  {
    id: "drafts",
    title: "임시저장",
    desc: "저장된 글과 댓글 관리",
    icon: "글",
    tone: "purple",
    page: "drafts.html",
  },
  {
    id: "site",
    title: "사이트 화면 보조",
    desc: "사이트 위 편의 기능",
    icon: "화",
    tone: "teal",
    page: "site.html",
  },
  {
    id: "settings",
    title: "전체 설정",
    desc: "토큰, 로그, 초기화",
    icon: "설",
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

function renderActions(status, drafts) {
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
    empty.innerHTML = `<span class="quick-icon">＋</span>추가`;
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
    button.innerHTML = `<span class="quick-icon ${link.tone}">${link.icon}</span>${link.label}`;
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
      <span class="feature-icon ${feature.tone}">${feature.icon}</span>
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
    const [status, settings, drafts] = await Promise.all([
      chrome.runtime.sendMessage({ type: "GET_STATUS" }),
      chrome.runtime.sendMessage({ type: "GET_FEATURE_SETTINGS" }),
      chrome.runtime.sendMessage({ type: "GET_DRAFTS" }),
    ]);

    renderActions(status, drafts);
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
