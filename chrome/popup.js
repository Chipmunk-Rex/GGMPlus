async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });

    const loginStatus = document.getElementById("loginStatus");
    const loginBtn = document.getElementById("loginBtn");
    const checkBtn = document.getElementById("checkBtn");

    if (response.hasToken && response.userName) {
      loginStatus.textContent = response.userName;
      loginStatus.className = "status-value success";
      loginBtn.style.display = "none";
      checkBtn.disabled = false;
    } else if (response.hasToken) {
      loginStatus.textContent = "로그인됨";
      loginStatus.className = "status-value success";
      loginBtn.style.display = "none";
      checkBtn.disabled = false;
    } else {
      loginStatus.textContent = "로그인 필요";
      loginStatus.className = "status-value error";
      loginBtn.style.display = "block";
      checkBtn.disabled = true;
    }

    const todayStatus = document.getElementById("todayStatus");
    if (response.todayChecked) {
      todayStatus.textContent = "완료";
      todayStatus.className = "status-value success";
      checkBtn.textContent = "오늘 출석 완료";
      checkBtn.disabled = true;
    } else if (response.hasToken) {
      todayStatus.textContent = "미완료";
      todayStatus.className = "status-value pending";
      checkBtn.textContent = "수동 출석체크";
      checkBtn.disabled = false;
    } else {
      todayStatus.textContent = "-";
      todayStatus.className = "status-value";
    }

    const lastSuccess = document.getElementById("lastSuccess");
    lastSuccess.textContent = response.lastSuccess
      ? formatDate(response.lastSuccess)
      : "-";
  } catch (error) {
    console.error("상태 조회 실패:", error);
  }
}

async function updateFeatureSummary() {
  try {
    const settings = await chrome.runtime.sendMessage({ type: "GET_FEATURE_SETTINGS" });
    const activeCount = [
      settings.notifyNewPosts,
      settings.notifyGoldboxQuest,
      settings.notifyStockWatch,
    ].filter(Boolean).length;

    const monitorSummary = document.getElementById("monitorSummary");
    monitorSummary.textContent = activeCount > 0 ? `${activeCount}개 활성` : "꺼짐";
    monitorSummary.className = activeCount > 0 ? "status-value success" : "status-value";

    document.getElementById("utilityInterval").textContent =
      `${settings.utilityMonitorIntervalMinutes}분`;
    setStatusText("postMonitorStatus", settings.notifyNewPosts, "활성", "꺼짐");
    setStatusText("questMonitorStatus", settings.notifyGoldboxQuest, "활성", "꺼짐");
    setStatusText("stockMonitorStatus", settings.notifyStockWatch, "활성", "꺼짐");
  } catch (error) {
    console.error("기능 설정 조회 실패:", error);
  }
}

function setStatusText(id, enabled, onText, offText) {
  const element = document.getElementById(id);
  element.textContent = enabled ? onText : offText;
  element.className = enabled ? "status-value success" : "status-value";
}

async function loadActivity() {
  const container = document.getElementById("activityList");

  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_ACTIVITY" });
    const items = response.items || [];
    container.replaceChildren();

    if (items.length === 0) {
      container.appendChild(createEmptyState("아직 활동 기록이 없습니다."));
      return;
    }

    items.slice(0, 8).forEach((item) => {
      container.appendChild(createActivityItem(item));
    });
  } catch (error) {
    container.replaceChildren(createEmptyState("활동 기록을 불러오지 못했습니다."));
  }
}

function createActivityItem(item) {
  const button = document.createElement("button");
  button.className = "activity-item";
  button.type = "button";

  const title = document.createElement("span");
  title.className = "activity-title";
  title.textContent = item.title || "활동";

  const meta = document.createElement("span");
  meta.className = "activity-meta";
  meta.textContent = `${formatDate(item.time)} · ${item.message || ""}`;

  button.append(title, meta);
  if (item.url) {
    button.addEventListener("click", () => openGgmPage(item.url));
  } else {
    button.disabled = true;
  }

  return button;
}

function createEmptyState(message) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.textContent = message;
  return element;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";

  const now = new Date();
  const diff = now - date;

  if (diff >= 0 && diff < 60000) {
    return "방금 전";
  }

  if (diff >= 0 && diff < 3600000) {
    return `${Math.floor(diff / 60000)}분 전`;
  }

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function manualCheck() {
  const btn = document.getElementById("checkBtn");

  btn.disabled = true;
  const spinner = document.createElement("span");
  spinner.className = "spinner";
  btn.replaceChildren(spinner, document.createTextNode("처리 중..."));

  try {
    const response = await chrome.runtime.sendMessage({ type: "MANUAL_ATTENDANCE" });

    if (response.success) {
      btn.textContent = response.alreadyChecked ? "이미 출석 완료" : "출석 성공";
    } else {
      btn.textContent = "실패";
    }

    setTimeout(() => {
      updateStatus();
      loadActivity();
    }, 1500);
  } catch (error) {
    btn.textContent = "오류 발생";
    setTimeout(updateStatus, 1500);
  }
}

async function runUtilityMonitor() {
  const btn = document.getElementById("monitorNowBtn");
  btn.disabled = true;
  btn.textContent = "확인 중...";

  try {
    const response = await chrome.runtime.sendMessage({ type: "RUN_UTILITY_MONITOR" });
    if (!response.success) {
      throw new Error(response.error || "확인 실패");
    }

    const summary = response.summary || {};
    btn.textContent = summary.errors && summary.errors.length
      ? "오류 있음"
      : `알림 ${summary.notifications || 0}건`;
    loadActivity();
  } catch (error) {
    btn.textContent = "실패";
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "지금 확인";
    }, 1600);
  }
}

function goToLogin() {
  openGgmPage("/user/login");
  window.close();
}

function goToSettings() {
  window.location.href = "settings.html";
}

async function openGgmPage(url) {
  await chrome.runtime.sendMessage({ type: "OPEN_GGM_PAGE", url });
}

function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;

      tabBtns.forEach((button) => button.classList.remove("active"));
      btn.classList.add("active");

      tabContents.forEach((content) => content.classList.remove("active"));
      document.getElementById(`tab-${tabId}`).classList.add("active");

      chrome.storage.local.set({ lastTab: tabId });
    });
  });

  chrome.storage.local.get(["lastTab"], (result) => {
    if (result.lastTab) {
      const savedTabBtn = document.querySelector(`[data-tab="${result.lastTab}"]`);
      if (savedTabBtn) savedTabBtn.click();
    }
  });
}

function initLauncher() {
  document.querySelectorAll("[data-url]").forEach((button) => {
    button.addEventListener("click", async () => {
      await openGgmPage(button.dataset.url);
      window.close();
    });
  });
}

document.getElementById("checkBtn").addEventListener("click", manualCheck);
document.getElementById("loginBtn").addEventListener("click", goToLogin);
document.getElementById("settingsBtn").addEventListener("click", goToSettings);
document.getElementById("alertSettingsBtn").addEventListener("click", goToSettings);
document.getElementById("monitorNowBtn").addEventListener("click", runUtilityMonitor);

initTabs();
initLauncher();
updateStatus();
updateFeatureSummary();
loadActivity();
