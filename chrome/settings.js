const ext = globalThis.browser ?? globalThis.chrome;

let logsData = [];

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
    const response = await ext.runtime.sendMessage({ type: "GET_STATUS" });
    const todayStatus = document.getElementById("todayStatus");
    const nextCheckTime = document.getElementById("nextCheckTime");

    if (response.todayChecked) {
      todayStatus.textContent = "Completed";
      todayStatus.className = "status-value success";
    } else {
      todayStatus.textContent = "Pending";
      todayStatus.className = "status-value pending";
    }

    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const hoursLeft = Math.floor((midnight - now) / 3600000);
    const minutesLeft = Math.floor(((midnight - now) % 3600000) / 60000);

    nextCheckTime.textContent = response.todayChecked
      ? `Resets at midnight (${hoursLeft}h ${minutesLeft}m left)`
      : "Runs on startup and by alarm when needed";
  } catch (error) {
    console.error("[GGMPlus] Failed to load settings:", error);
  }
}

async function manualCheck() {
  const button = document.getElementById("manualCheckBtn");
  button.disabled = true;
  button.textContent = "Running...";

  try {
    const response = await ext.runtime.sendMessage({ type: "MANUAL_ATTENDANCE" });
    if (response.success) {
      showToast(response.alreadyChecked ? "Already completed today" : "Attendance succeeded");
    } else {
      showToast("Attendance failed");
    }
  } catch (error) {
    showToast("Unexpected error");
  }

  button.disabled = false;
  button.textContent = "Run attendance now";
  loadSettings();
  loadLogs();
}

function formatLogTime(isoString) {
  if (!isoString) {
    return "";
  }

  return new Date(isoString).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) {
    return value || "";
  }

  return `${value.slice(0, maxLength)}...`;
}

function showLogDetail(log) {
  const modal = document.getElementById("logModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalContent = document.getElementById("modalContent");
  const status = log.success ? "Success" : "Failure";
  const time = formatLogTime(log.lastAttempt || log.time);

  modalTitle.textContent = `Attendance log - ${status}`;
  modalContent.textContent = `Time: ${time}\n\nMessage:\n${log.message || "(no message)"}`;
  modal.classList.add("show");
}

function closeModal() {
  document.getElementById("logModal").classList.remove("show");
}

function renderInfoMessage(container, className, message) {
  container.replaceChildren();
  const entry = document.createElement("div");
  entry.className = `log-entry ${className}`;
  entry.textContent = message;
  container.appendChild(entry);
}

function createLogEntry(log, index) {
  const entry = document.createElement("div");
  entry.className = `log-entry ${log.success ? "log-success" : "log-error"}`;
  entry.dataset.index = String(index);

  const time = document.createElement("span");
  time.className = "log-time";
  time.textContent = formatLogTime(log.lastAttempt || log.time);

  const text = document.createTextNode(
    `${log.success ? "OK" : "ERR"}${log.message ? ` - ${truncate(log.message, 40)}` : ""}`,
  );

  entry.appendChild(time);
  entry.appendChild(text);
  entry.addEventListener("click", () => {
    showLogDetail(logsData[index]);
  });

  return entry;
}

async function loadLogs() {
  try {
    const response = await ext.runtime.sendMessage({ type: "GET_LOGS" });
    const container = document.getElementById("logContainer");

    if (!response.logs || response.logs.length === 0) {
      logsData = [];
      renderInfoMessage(container, "log-info", "No logs yet.");
      return;
    }

    logsData = response.logs;
    container.replaceChildren();
    response.logs.forEach((log, index) => {
      container.appendChild(createLogEntry(log, index));
    });
  } catch (error) {
    console.error("[GGMPlus] Failed to load logs:", error);
    renderInfoMessage(
      document.getElementById("logContainer"),
      "log-error",
      "Failed to load logs.",
    );
  }
}

async function clearLogs() {
  if (!window.confirm("Clear all attendance logs?")) {
    return;
  }

  try {
    await ext.runtime.sendMessage({ type: "CLEAR_LOGS" });
    showToast("Logs cleared");
    loadLogs();
  } catch (error) {
    showToast("Failed to clear logs");
  }
}

async function resetAll() {
  if (!window.confirm("Reset tokens, logs, and settings?")) {
    return;
  }

  if (!window.confirm("This requires logging in again. Continue?")) {
    return;
  }

  try {
    await ext.runtime.sendMessage({ type: "RESET_ALL" });
    showToast("Extension data reset");
    setTimeout(() => {
      loadSettings();
      loadLogs();
    }, 300);
  } catch (error) {
    showToast("Reset failed");
  }
}

function goBack() {
  window.location.href = "popup.html";
}

document.getElementById("backBtn").addEventListener("click", goBack);
document.getElementById("manualCheckBtn").addEventListener("click", manualCheck);
document.getElementById("refreshLogBtn").addEventListener("click", loadLogs);
document.getElementById("clearLogsBtn").addEventListener("click", clearLogs);
document.getElementById("resetAllBtn").addEventListener("click", resetAll);
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("logModal").addEventListener("click", (event) => {
  if (event.target.id === "logModal") {
    closeModal();
  }
});

loadSettings();
loadLogs();
