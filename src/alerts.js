function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

async function loadAlertStatus() {
  const settings = await chrome.runtime.sendMessage({ type: "GET_FEATURE_SETTINGS" });
  const activeCount = [
    settings.notifyNewPosts,
    settings.notifyGoldboxQuest,
    settings.notifyStockWatch,
  ].filter(Boolean).length;

  const summary = document.getElementById("monitorSummary");
  summary.textContent = activeCount ? `${activeCount}개 활성` : "꺼짐";
  summary.className = activeCount ? "badge success" : "badge";

  setMetricState("postMonitorStatus", settings.notifyNewPosts);
  setMetricState("questStockStatus", settings.notifyGoldboxQuest || settings.notifyStockWatch);
}

function setMetricState(id, enabled) {
  const element = document.getElementById(id);
  element.textContent = enabled ? "활성" : "꺼짐";
  element.className = enabled ? "metric-value success" : "metric-value";
}

async function runMonitor() {
  const btn = document.getElementById("runMonitorBtn");
  btn.disabled = true;
  btn.textContent = "확인 중...";
  try {
    const response = await chrome.runtime.sendMessage({ type: "RUN_UTILITY_MONITOR" });
    if (!response.success) throw new Error(response.error || "확인 실패");
    const summary = response.summary || {};
    showToast(`확인 완료, 알림 ${summary.notifications || 0}건`);
  } catch (error) {
    showToast("확인 실패");
  } finally {
    btn.disabled = false;
    btn.textContent = "지금 확인";
  }
}

document.getElementById("backBtn").addEventListener("click", () => { window.location.href = "popup.html"; });
document.getElementById("featureSettingsBtn").addEventListener("click", () => { window.location.href = "alerts-settings.html"; });
document.getElementById("globalSettingsBtn").addEventListener("click", () => { window.location.href = "settings.html"; });
document.getElementById("runMonitorBtn").addEventListener("click", runMonitor);

loadAlertStatus();
