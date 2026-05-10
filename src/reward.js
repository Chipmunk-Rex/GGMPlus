let currentRewardSettings = {};
let rewardLogs = [];

const REWARD_DEFAULTS = {
  autoRewardEnabled: false,
  rewardIntervalMinutes: 60,
  rewardRunTime: "",
  rewardClaimDailyMissions: true,
  rewardClaimWeeklyMissions: true,
  rewardClaimMailbox: true,
};

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function getValue(id) {
  return document.getElementById(id).value;
}

function setValue(id, value) {
  document.getElementById(id).value = value ?? "";
}

function getChecked(id) {
  return document.getElementById(id).checked;
}

function setChecked(id, value) {
  document.getElementById(id).checked = value === true;
}

function updateRewardVisibility() {
  const enabled = getChecked("autoRewardEnabled");
  document.querySelectorAll(".reward-detail-section").forEach((element) => {
    element.hidden = !enabled;
  });

  const badge = document.getElementById("rewardStatusBadge");
  badge.textContent = enabled ? "활성" : "꺼짐";
  badge.className = enabled ? "badge success" : "badge";
}

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLogMessage(log) {
  if (!log) return "";
  if (log.message) return log.message;
  const details = log.details || {};
  return `보상 ${details.claimedRewards || 0}개, 작업 ${details.actions?.length || 0}개`;
}

function renderSettings(settings) {
  currentRewardSettings = {
    ...REWARD_DEFAULTS,
    ...(settings || {}),
  };

  setChecked("autoRewardEnabled", currentRewardSettings.autoRewardEnabled);
  setValue("rewardIntervalMinutes", currentRewardSettings.rewardIntervalMinutes);
  setValue("rewardRunTime", currentRewardSettings.rewardRunTime);
  setChecked("rewardClaimDailyMissions", currentRewardSettings.rewardClaimDailyMissions);
  setChecked("rewardClaimWeeklyMissions", currentRewardSettings.rewardClaimWeeklyMissions);
  setChecked("rewardClaimMailbox", currentRewardSettings.rewardClaimMailbox);
  updateRewardVisibility();
}

function collectSettings() {
  return {
    autoRewardEnabled: getChecked("autoRewardEnabled"),
    rewardIntervalMinutes: Number(getValue("rewardIntervalMinutes")),
    rewardRunTime: getValue("rewardRunTime"),
    rewardClaimDailyMissions: getChecked("rewardClaimDailyMissions"),
    rewardClaimWeeklyMissions: getChecked("rewardClaimWeeklyMissions"),
    rewardClaimMailbox: getChecked("rewardClaimMailbox"),
  };
}

function createEmpty(message) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.textContent = message;
  return element;
}

function renderLogs() {
  const list = document.getElementById("rewardLogList");
  list.replaceChildren();

  if (!rewardLogs.length) {
    list.appendChild(createEmpty("아직 실행 로그가 없습니다."));
    return;
  }

  rewardLogs.slice(0, 12).forEach((log, index) => {
    const row = document.createElement("div");
    row.className = `list-item ${log.success === false ? "list-error" : "list-success"}`;
    const time = document.createElement("span");
    time.className = "list-time";
    time.textContent = formatDate(log.time);
    const message = document.createElement("span");
    message.className = "list-message";
    message.textContent = getLogMessage(log);
    row.append(time, message);
    row.addEventListener("click", () => showLogDetail(index));
    list.appendChild(row);
  });
}

function showLogDetail(index) {
  const log = rewardLogs[index];
  document.getElementById("modalTitle").textContent = log.success === false
    ? "실행 실패"
    : "실행 상세";
  document.getElementById("modalContent").textContent = JSON.stringify(log, null, 2);
  document.getElementById("detailModal").classList.add("show");
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: "GET_REWARD_SETTINGS" });
  renderSettings(response.settings || REWARD_DEFAULTS);
}

async function saveSettings() {
  const response = await chrome.runtime.sendMessage({
    type: "SAVE_REWARD_SETTINGS",
    data: collectSettings(),
  });

  if (!response.success) {
    showToast(response.error || "자동 수령 설정 저장에 실패했습니다.");
    return;
  }

  renderSettings(response.settings);
  showToast("자동 수령 설정을 저장했습니다.");
}

async function loadLogs() {
  const response = await chrome.runtime.sendMessage({ type: "GET_REWARD_LOGS" });
  rewardLogs = response.logs || [];
  renderLogs();
}

async function runNow() {
  const button = document.getElementById("runNowBtn");
  button.disabled = true;
  button.textContent = "실행 중...";
  try {
    const response = await chrome.runtime.sendMessage({ type: "RUN_REWARD_AUTOMATION" });
    if (!response.success) {
      showToast(response.error || "자동 수령 실행 중 오류가 발생했습니다.");
    } else {
      const summary = response.summary || {};
      showToast(`실행 완료: 보상 ${summary.claimedRewards || 0}개`);
    }
    await loadLogs();
  } catch (error) {
    showToast(error.message || "자동 수령 실행에 실패했습니다.");
  } finally {
    button.disabled = false;
    button.textContent = "수동 실행";
  }
}

async function clearLogs() {
  if (!confirm("자동 수령 로그를 모두 삭제할까요?")) return;
  const response = await chrome.runtime.sendMessage({ type: "CLEAR_REWARD_LOGS" });
  if (!response.success) {
    showToast(response.error || "로그 삭제에 실패했습니다.");
    return;
  }
  rewardLogs = [];
  renderLogs();
  showToast("자동 수령 로그를 삭제했습니다.");
}

document.getElementById("backBtn").addEventListener("click", () => {
  window.location.href = "popup.html";
});
document.getElementById("globalSettingsBtn").addEventListener("click", () => {
  window.location.href = "settings.html";
});
document.getElementById("autoRewardEnabled").addEventListener("change", updateRewardVisibility);
document.getElementById("saveBtn").addEventListener("click", saveSettings);
document.getElementById("runNowBtn").addEventListener("click", runNow);
document.getElementById("refreshLogsBtn").addEventListener("click", loadLogs);
document.getElementById("clearLogsBtn").addEventListener("click", clearLogs);
document.getElementById("modalClose").addEventListener("click", () => {
  document.getElementById("detailModal").classList.remove("show");
});
document.getElementById("detailModal").addEventListener("click", (event) => {
  if (event.target.id === "detailModal") {
    document.getElementById("detailModal").classList.remove("show");
  }
});

updateRewardVisibility();
loadSettings().catch((error) => {
  console.error("자동 수령 설정 조회 실패:", error);
  showToast("자동 수령 설정을 불러오지 못했습니다.");
});
loadLogs().catch((error) => {
  console.error("자동 수령 로그 조회 실패:", error);
});
