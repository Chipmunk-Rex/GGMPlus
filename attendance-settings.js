function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
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

async function loadSettings() {
  const [status, settings] = await Promise.all([
    chrome.runtime.sendMessage({ type: "GET_STATUS" }),
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }),
  ]);
  const { hoursLeft, minutesLeft } = getTimeUntilMidnight();
  document.getElementById("nextCheckTime").textContent = status.todayChecked
    ? `내일 자정 (${hoursLeft}시간 ${minutesLeft}분 후)`
    : "자정 또는 보조 알람 실행 시";
  document.getElementById("delayInput").value = settings.delayInMinutes;
  document.getElementById("periodInput").value = settings.periodInMinutes;
}

async function saveAttendanceSettings() {
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
    if (!response.success) throw new Error(response.error || "설정 저장 실패");
    showToast("출석 알람을 저장했습니다");
  } catch (error) {
    showToast("저장 실패");
  } finally {
    btn.disabled = false;
    btn.textContent = "출석 알람 저장";
  }
}

let logsData = [];

async function loadLogs() {
  const container = document.getElementById("logContainer");
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_LOGS" });
    const logs = response.logs || [];
    logsData = logs;
    container.replaceChildren();
    if (!logs.length) {
      container.appendChild(createEmpty("로그가 없습니다"));
      return;
    }
    logs.forEach((log, index) => container.appendChild(createLogEntry(log, index)));
  } catch (error) {
    container.replaceChildren(createEmpty("로그를 불러오지 못했습니다"));
  }
}

function createEmpty(message) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.textContent = message;
  return element;
}

function createLogEntry(log, index) {
  const entry = document.createElement("div");
  entry.className = `list-item ${log.success ? "list-success" : "list-error"}`;
  const time = document.createElement("span");
  time.className = "list-time";
  time.textContent = formatDate(log.lastAttempt || log.time);
  const message = document.createElement("span");
  message.className = "list-message";
  message.textContent = `${log.success ? "성공" : "실패"} - ${log.message || "(메시지 없음)"}`;
  entry.append(time, message);
  entry.addEventListener("click", () => showLogDetail(logsData[index]));
  return entry;
}

function showLogDetail(log) {
  document.getElementById("modalTitle").textContent = log.success ? "출석 성공" : "출석 실패";
  document.getElementById("modalContent").textContent =
    `시간: ${formatDate(log.lastAttempt || log.time)}\n\n메시지:\n${log.message || "(메시지 없음)"}`;
  document.getElementById("logModal").classList.add("show");
}

async function clearLogs() {
  if (!confirm("출석 로그를 모두 삭제하시겠습니까?")) return;
  await chrome.runtime.sendMessage({ type: "CLEAR_LOGS" });
  showToast("로그를 삭제했습니다");
  loadLogs();
}

document.getElementById("backBtn").addEventListener("click", () => { window.location.href = "attendance.html"; });
document.getElementById("globalSettingsBtn").addEventListener("click", () => { window.location.href = "settings.html"; });
document.getElementById("saveSettingsBtn").addEventListener("click", saveAttendanceSettings);
document.getElementById("refreshLogBtn").addEventListener("click", loadLogs);
document.getElementById("clearLogsBtn").addEventListener("click", clearLogs);
document.getElementById("modalClose").addEventListener("click", () => document.getElementById("logModal").classList.remove("show"));
document.getElementById("logModal").addEventListener("click", (event) => {
  if (event.target.id === "logModal") document.getElementById("logModal").classList.remove("show");
});

loadSettings();
loadLogs();
