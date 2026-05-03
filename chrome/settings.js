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

async function loadAccountStatus() {
  const status = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  const tokenBadge = document.getElementById("tokenBadge");
  const loginStatus = document.getElementById("loginStatus");
  const userName = document.getElementById("userName");
  const loginBtn = document.getElementById("loginBtn");

  if (status.hasToken) {
    tokenBadge.textContent = "토큰 있음";
    tokenBadge.className = "badge success";
    loginStatus.textContent = "로그인됨";
    loginStatus.className = "metric-value success";
    userName.textContent = status.userName || "-";
    loginBtn.style.display = "none";
  } else {
    tokenBadge.textContent = "토큰 없음";
    tokenBadge.className = "badge error";
    loginStatus.textContent = "로그인 필요";
    loginStatus.className = "metric-value error";
    userName.textContent = "-";
    loginBtn.style.display = "block";
  }
}

let activityItems = [];

async function loadActivity() {
  const container = document.getElementById("activityContainer");
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_ACTIVITY" });
    activityItems = response.items || [];
    container.replaceChildren();
    if (!activityItems.length) {
      container.appendChild(createEmpty("활동 기록이 없습니다"));
      return;
    }
    activityItems.slice(0, 8).forEach((item, index) => container.appendChild(createActivityItem(item, index)));
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

function createActivityItem(item, index) {
  const entry = document.createElement("div");
  entry.className = "list-item";
  const time = document.createElement("span");
  time.className = "list-time";
  time.textContent = formatDate(item.time);
  const message = document.createElement("span");
  message.className = "list-message";
  message.textContent = `${item.title || "활동"} - ${item.message || ""}`;
  entry.append(time, message);
  entry.addEventListener("click", () => showDetail(activityItems[index]));
  return entry;
}

function showDetail(item) {
  document.getElementById("modalTitle").textContent = item.title || "활동 상세";
  document.getElementById("modalContent").textContent =
    `시간: ${formatDate(item.time)}\n종류: ${item.type || "-"}\n\n메시지:\n${item.message || "(메시지 없음)"}`;
  document.getElementById("detailModal").classList.add("show");
}

async function clearLogs() {
  if (!confirm("출석 로그를 모두 삭제하시겠습니까?")) return;
  await chrome.runtime.sendMessage({ type: "CLEAR_LOGS" });
  showToast("출석 로그를 삭제했습니다");
}

async function clearActivity() {
  if (!confirm("활동 기록을 모두 삭제하시겠습니까?")) return;
  await chrome.runtime.sendMessage({ type: "CLEAR_ACTIVITY" });
  showToast("활동 기록을 삭제했습니다");
  loadActivity();
}

async function clearDrafts() {
  if (!confirm("임시저장된 글/댓글 데이터를 모두 삭제하시겠습니까?")) return;
  await chrome.runtime.sendMessage({ type: "CLEAR_DRAFTS" });
  showToast("임시저장 데이터를 삭제했습니다");
}

async function resetAll() {
  if (!confirm("모든 데이터(토큰, 로그, 설정, 임시저장)를 초기화하시겠습니까?\n\n다시 로그인이 필요합니다.")) return;
  if (!confirm("정말로 초기화하시겠습니까?")) return;
  await chrome.runtime.sendMessage({ type: "RESET_ALL" });
  showToast("전체 초기화를 완료했습니다");
  loadAccountStatus();
  loadActivity();
}

function openGgmPage(url) {
  chrome.runtime.sendMessage({ type: "OPEN_GGM_PAGE", url });
}

document.getElementById("backBtn").addEventListener("click", () => { window.location.href = "popup.html"; });
document.getElementById("loginBtn").addEventListener("click", () => openGgmPage("/user/login"));
document.getElementById("refreshActivityBtn").addEventListener("click", loadActivity);
document.getElementById("clearLogsBtn").addEventListener("click", clearLogs);
document.getElementById("clearActivityBtn").addEventListener("click", clearActivity);
document.getElementById("clearDraftsBtn").addEventListener("click", clearDrafts);
document.getElementById("resetAllBtn").addEventListener("click", resetAll);
document.getElementById("modalClose").addEventListener("click", () => document.getElementById("detailModal").classList.remove("show"));
document.getElementById("detailModal").addEventListener("click", (event) => {
  if (event.target.id === "detailModal") document.getElementById("detailModal").classList.remove("show");
});

loadAccountStatus();
loadActivity();
