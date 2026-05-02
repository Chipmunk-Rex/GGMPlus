function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

async function loadSettings() {
  try {
    const [status, settings, featureSettings] = await Promise.all([
      chrome.runtime.sendMessage({ type: "GET_STATUS" }),
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }),
      chrome.runtime.sendMessage({ type: "GET_FEATURE_SETTINGS" }),
    ]);

    const todayStatus = document.getElementById("todayStatus");
    if (status.todayChecked) {
      todayStatus.textContent = "완료";
      todayStatus.className = "status-value success";
    } else {
      todayStatus.textContent = "미완료";
      todayStatus.className = "status-value pending";
    }

    const nextCheckTime = document.getElementById("nextCheckTime");
    const { hoursLeft, minutesLeft } = getTimeUntilMidnight();
    nextCheckTime.textContent = status.todayChecked
      ? `내일 자정 (${hoursLeft}시간 ${minutesLeft}분 후)`
      : "자정 또는 보조 알람 실행 시";

    document.getElementById("delayInput").value = settings.delayInMinutes;
    document.getElementById("periodInput").value = settings.periodInMinutes;

    document.getElementById("notifyNewPostsInput").checked = featureSettings.notifyNewPosts;
    document.getElementById("notifyGoldboxQuestInput").checked = featureSettings.notifyGoldboxQuest;
    document.getElementById("notifyStockWatchInput").checked = featureSettings.notifyStockWatch;
    document.getElementById("utilityIntervalInput").value =
      featureSettings.utilityMonitorIntervalMinutes;
    document.getElementById("boardCategoriesInput").value =
      (featureSettings.watchedBoardCategories || []).join(", ");
    document.getElementById("circlePostIdsInput").value =
      (featureSettings.watchedCirclePostIds || []).join(", ");
    document.getElementById("stockWatchIdsInput").value =
      (featureSettings.stockWatchCircleIds || []).join(", ");
  } catch (error) {
    console.error("설정 불러오기 실패:", error);
    showToast("설정 불러오기 실패");
  }
}

function getTimeUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight - now;
  return {
    hoursLeft: Math.floor(diff / 3600000),
    minutesLeft: Math.floor((diff % 3600000) / 60000),
  };
}

function readPositiveInteger(id, fallback) {
  const value = Number.parseInt(document.getElementById(id).value, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readCsv(id) {
  return document.getElementById(id).value
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

async function saveSettings() {
  const btn = document.getElementById("saveSettingsBtn");
  const delayInMinutes = readPositiveInteger("delayInput", 1);
  const periodInMinutes = readPositiveInteger("periodInput", 1440);

  btn.disabled = true;
  btn.textContent = "저장 중...";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_SETTINGS",
      data: { delayInMinutes, periodInMinutes },
    });

    if (!response.success) {
      throw new Error(response.error || "설정 저장 실패");
    }

    document.getElementById("delayInput").value = delayInMinutes;
    document.getElementById("periodInput").value = periodInMinutes;
    showToast("출석 알람 설정이 저장되었습니다");
  } catch (error) {
    console.error("설정 저장 실패:", error);
    showToast("설정 저장 실패");
  } finally {
    btn.disabled = false;
    btn.textContent = "출석 알람 저장";
  }
}

async function saveFeatureSettings() {
  const btn = document.getElementById("saveFeatureSettingsBtn");
  const data = {
    notifyNewPosts: document.getElementById("notifyNewPostsInput").checked,
    notifyGoldboxQuest: document.getElementById("notifyGoldboxQuestInput").checked,
    notifyStockWatch: document.getElementById("notifyStockWatchInput").checked,
    utilityMonitorIntervalMinutes: readPositiveInteger("utilityIntervalInput", 15),
    watchedBoardCategories: readCsv("boardCategoriesInput"),
    watchedCirclePostIds: readCsv("circlePostIdsInput"),
    stockWatchCircleIds: readCsv("stockWatchIdsInput"),
  };

  btn.disabled = true;
  btn.textContent = "저장 중...";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_FEATURE_SETTINGS",
      data,
    });

    if (!response.success) {
      throw new Error(response.error || "관심 알림 저장 실패");
    }

    showToast("관심 알림 설정이 저장되었습니다");
    await loadSettings();
  } catch (error) {
    console.error("관심 알림 저장 실패:", error);
    showToast("관심 알림 저장 실패");
  } finally {
    btn.disabled = false;
    btn.textContent = "관심 알림 저장";
  }
}

async function runMonitor() {
  const btn = document.getElementById("runMonitorBtn");
  btn.disabled = true;
  btn.textContent = "확인 중...";

  try {
    const response = await chrome.runtime.sendMessage({ type: "RUN_UTILITY_MONITOR" });
    if (!response.success) {
      throw new Error(response.error || "확인 실패");
    }

    const summary = response.summary || {};
    const errorCount = summary.errors ? summary.errors.length : 0;
    showToast(errorCount ? `확인 완료, 오류 ${errorCount}건` : `확인 완료, 알림 ${summary.notifications || 0}건`);
    await loadActivity();
  } catch (error) {
    console.error("관심 알림 확인 실패:", error);
    showToast("관심 알림 확인 실패");
  } finally {
    btn.disabled = false;
    btn.textContent = "지금 확인";
  }
}

async function manualCheck() {
  const btn = document.getElementById("manualCheckBtn");
  btn.disabled = true;
  btn.textContent = "처리 중...";

  try {
    const response = await chrome.runtime.sendMessage({ type: "MANUAL_ATTENDANCE" });
    if (response.success) {
      showToast(response.alreadyChecked ? "이미 출석 완료입니다" : "출석체크 성공");
    } else {
      showToast("출석체크 실패");
    }
  } catch (error) {
    showToast("오류가 발생했습니다");
  } finally {
    btn.disabled = false;
    btn.textContent = "지금 출석체크";
    loadSettings();
    loadLogs();
    loadActivity();
  }
}

let logsData = [];
let activityData = [];

async function loadLogs() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_LOGS" });
    const container = document.getElementById("logContainer");
    container.replaceChildren();

    if (!response.logs || response.logs.length === 0) {
      container.appendChild(createInfoLog("로그가 없습니다"));
      logsData = [];
      return;
    }

    logsData = response.logs;
    response.logs.forEach((log, index) => {
      container.appendChild(createLogEntry(log, index));
    });
  } catch (error) {
    console.error("로그 불러오기 실패:", error);
    const container = document.getElementById("logContainer");
    container.replaceChildren(createInfoLog("로그 불러오기 실패"));
  }
}

async function loadActivity() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_ACTIVITY" });
    const container = document.getElementById("activityContainer");
    container.replaceChildren();

    if (!response.items || response.items.length === 0) {
      container.appendChild(createInfoLog("활동 기록이 없습니다"));
      activityData = [];
      return;
    }

    activityData = response.items;
    response.items.forEach((item, index) => {
      container.appendChild(createActivityEntry(item, index));
    });
  } catch (error) {
    console.error("활동 기록 불러오기 실패:", error);
    document.getElementById("activityContainer").replaceChildren(createInfoLog("활동 기록 불러오기 실패"));
  }
}

function createInfoLog(message) {
  const entry = document.createElement("div");
  entry.className = "log-entry log-info";
  entry.textContent = message;
  return entry;
}

function createLogEntry(log, index) {
  const entry = document.createElement("div");
  entry.className = `log-entry ${log.success ? "log-success" : "log-error"}`;
  entry.dataset.index = String(index);

  const time = document.createElement("span");
  time.className = "log-time";
  time.textContent = formatLogTime(log.lastAttempt || log.time);

  const message = document.createElement("span");
  message.className = "log-message";
  message.textContent = `${log.success ? "성공" : "실패"} - ${truncate(log.message || "(메시지 없음)", 34)}`;

  entry.append(time, message);
  entry.addEventListener("click", () => {
    showLogDetail(logsData[index]);
  });

  return entry;
}

function createActivityEntry(item, index) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.dataset.index = String(index);

  const time = document.createElement("span");
  time.className = "log-time";
  time.textContent = formatLogTime(item.time);

  const message = document.createElement("span");
  message.className = "log-message";
  message.textContent = `${item.title || "활동"} - ${truncate(item.message || "", 34)}`;

  entry.append(time, message);
  entry.addEventListener("click", () => {
    showActivityDetail(activityData[index]);
  });

  return entry;
}

function showLogDetail(log) {
  const time = formatLogTime(log.lastAttempt || log.time);
  const status = log.success ? "성공" : "실패";
  showModal(
    `로그 상세 - ${status}`,
    `시간: ${time}\n\n메시지:\n${log.message || "(메시지 없음)"}`,
  );
}

function showActivityDetail(item) {
  showModal(
    item.title || "활동 상세",
    `시간: ${formatLogTime(item.time)}\n종류: ${item.type || "-"}\n\n메시지:\n${item.message || "(메시지 없음)"}`,
  );
}

function showModal(title, content) {
  const modal = document.getElementById("logModal");
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalContent").textContent = content;
  modal.classList.add("show");
}

function closeModal() {
  document.getElementById("logModal").classList.remove("show");
}

function formatLogTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(str, maxLength) {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength)}...`;
}

async function clearLogs() {
  if (!confirm("출석 로그를 모두 삭제하시겠습니까?")) return;

  try {
    await chrome.runtime.sendMessage({ type: "CLEAR_LOGS" });
    showToast("출석 로그가 삭제되었습니다");
    loadLogs();
  } catch (error) {
    showToast("삭제 실패");
  }
}

async function clearActivity() {
  if (!confirm("활동 타임라인을 모두 삭제하시겠습니까?")) return;

  try {
    await chrome.runtime.sendMessage({ type: "CLEAR_ACTIVITY" });
    showToast("활동 기록이 삭제되었습니다");
    loadActivity();
  } catch (error) {
    showToast("삭제 실패");
  }
}

async function clearDrafts() {
  if (!confirm("임시저장된 글/댓글 데이터를 모두 삭제하시겠습니까?")) return;

  try {
    await chrome.runtime.sendMessage({ type: "CLEAR_DRAFTS" });
    showToast("임시저장 데이터가 삭제되었습니다");
  } catch (error) {
    showToast("삭제 실패");
  }
}

async function resetAll() {
  if (!confirm("모든 데이터(토큰, 로그, 설정, 임시저장)를 초기화하시겠습니까?\n\n다시 로그인이 필요합니다.")) return;
  if (!confirm("정말로 초기화하시겠습니까?")) return;

  try {
    await chrome.runtime.sendMessage({ type: "RESET_ALL" });
    showToast("초기화 완료");

    setTimeout(() => {
      loadSettings();
      loadLogs();
      loadActivity();
    }, 500);
  } catch (error) {
    showToast("초기화 실패");
  }
}

function goBack() {
  window.location.href = "popup.html";
}

document.getElementById("backBtn").addEventListener("click", goBack);
document.getElementById("manualCheckBtn").addEventListener("click", manualCheck);
document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
document.getElementById("saveFeatureSettingsBtn").addEventListener("click", saveFeatureSettings);
document.getElementById("runMonitorBtn").addEventListener("click", runMonitor);
document.getElementById("clearDraftsBtn").addEventListener("click", clearDrafts);
document.getElementById("refreshActivityBtn").addEventListener("click", loadActivity);
document.getElementById("clearActivityBtn").addEventListener("click", clearActivity);
document.getElementById("refreshLogBtn").addEventListener("click", loadLogs);
document.getElementById("clearLogsBtn").addEventListener("click", clearLogs);
document.getElementById("resetAllBtn").addEventListener("click", resetAll);
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("logModal").addEventListener("click", (event) => {
  if (event.target.id === "logModal") closeModal();
});

loadSettings();
loadLogs();
loadActivity();
