function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
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

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function loadFeatureSettings() {
  const settings = await chrome.runtime.sendMessage({ type: "GET_FEATURE_SETTINGS" });
  document.getElementById("notifyNewPostsInput").checked = settings.notifyNewPosts;
  document.getElementById("notifyGoldboxQuestInput").checked = settings.notifyGoldboxQuest;
  document.getElementById("notifyStockWatchInput").checked = settings.notifyStockWatch;
  document.getElementById("utilityIntervalInput").value = settings.utilityMonitorIntervalMinutes;
  document.getElementById("boardCategoriesInput").value = (settings.watchedBoardCategories || []).join(", ");
  document.getElementById("circlePostIdsInput").value = (settings.watchedCirclePostIds || []).join(", ");
  document.getElementById("stockWatchIdsInput").value = (settings.stockWatchCircleIds || []).join(", ");
}

async function saveFeatureSettings() {
  const btn = document.getElementById("saveFeatureSettingsBtn");
  btn.disabled = true;
  btn.textContent = "저장 중...";
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_FEATURE_SETTINGS",
      data: {
        notifyNewPosts: document.getElementById("notifyNewPostsInput").checked,
        notifyGoldboxQuest: document.getElementById("notifyGoldboxQuestInput").checked,
        notifyStockWatch: document.getElementById("notifyStockWatchInput").checked,
        utilityMonitorIntervalMinutes: readPositiveInteger("utilityIntervalInput", 15),
        watchedBoardCategories: readCsv("boardCategoriesInput"),
        watchedCirclePostIds: readCsv("circlePostIdsInput"),
        stockWatchCircleIds: readCsv("stockWatchIdsInput"),
      },
    });
    if (!response.success) throw new Error(response.error || "저장 실패");
    showToast("알림 설정을 저장했습니다");
  } catch (error) {
    showToast("저장 실패");
  } finally {
    btn.disabled = false;
    btn.textContent = "알림 저장";
  }
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
    loadActivity();
  } catch (error) {
    showToast("확인 실패");
  } finally {
    btn.disabled = false;
    btn.textContent = "지금 확인";
  }
}

async function loadActivity() {
  const container = document.getElementById("activityContainer");
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_ACTIVITY" });
    const items = (response.items || []).filter((item) => item.type !== "attendance");
    container.replaceChildren();
    if (!items.length) {
      container.appendChild(createEmpty("관심 알림 기록이 없습니다"));
      return;
    }
    items.slice(0, 8).forEach((item) => container.appendChild(createActivityItem(item)));
  } catch (error) {
    container.replaceChildren(createEmpty("기록을 불러오지 못했습니다"));
  }
}

function createEmpty(message) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.textContent = message;
  return element;
}

function createActivityItem(item) {
  const entry = document.createElement("div");
  entry.className = "list-item";
  const time = document.createElement("span");
  time.className = "list-time";
  time.textContent = formatDate(item.time);
  const message = document.createElement("span");
  message.className = "list-message";
  message.textContent = `${item.title || "활동"} - ${item.message || ""}`;
  entry.append(time, message);
  if (item.url) {
    entry.addEventListener("click", () => chrome.runtime.sendMessage({ type: "OPEN_GGM_PAGE", url: item.url }));
  }
  return entry;
}

document.getElementById("backBtn").addEventListener("click", () => { window.location.href = "alerts.html"; });
document.getElementById("globalSettingsBtn").addEventListener("click", () => { window.location.href = "settings.html"; });
document.getElementById("saveFeatureSettingsBtn").addEventListener("click", saveFeatureSettings);
document.getElementById("runMonitorBtn").addEventListener("click", runMonitor);

loadFeatureSettings();
loadActivity();
