function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  const now = new Date();
  const diff = now - date;
  if (diff >= 0 && diff < 60000) return "방금 전";
  if (diff >= 0 && diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function loadAttendancePage() {
  const status = await chrome.runtime.sendMessage({ type: "GET_STATUS" });

  const loginStatus = document.getElementById("loginStatus");
  const loginBtn = document.getElementById("loginBtn");
  const checkBtn = document.getElementById("checkBtn");

  if (status.hasToken && status.userName) {
    loginStatus.textContent = status.userName;
    loginStatus.className = "metric-value success";
    loginBtn.style.display = "none";
    checkBtn.disabled = false;
  } else if (status.hasToken) {
    loginStatus.textContent = "로그인됨";
    loginStatus.className = "metric-value success";
    loginBtn.style.display = "none";
    checkBtn.disabled = false;
  } else {
    loginStatus.textContent = "로그인 필요";
    loginStatus.className = "metric-value error";
    loginBtn.style.display = "block";
    checkBtn.disabled = true;
  }

  const badge = document.getElementById("todayStatusBadge");
  if (status.todayChecked) {
    badge.textContent = "완료";
    badge.className = "badge success";
    checkBtn.textContent = "오늘 출석 완료";
    checkBtn.disabled = true;
  } else if (status.hasToken) {
    badge.textContent = "미완료";
    badge.className = "badge pending";
    checkBtn.textContent = "출석체크 실행";
  } else {
    badge.textContent = "로그인 필요";
    badge.className = "badge error";
  }

  document.getElementById("lastSuccess").textContent = status.lastSuccess
    ? formatDate(status.lastSuccess)
    : "-";
}

async function manualCheck() {
  const btn = document.getElementById("checkBtn");
  btn.disabled = true;
  const spinner = document.createElement("span");
  spinner.className = "spinner";
  btn.replaceChildren(spinner, document.createTextNode("처리 중..."));

  try {
    const response = await chrome.runtime.sendMessage({ type: "MANUAL_ATTENDANCE" });
    btn.textContent = response.success
      ? (response.alreadyChecked ? "이미 출석 완료" : "출석 성공")
      : "실패";
    showToast(response.success ? "출석체크 완료" : "출석체크 실패");
  } catch (error) {
    btn.textContent = "오류 발생";
    showToast("오류가 발생했습니다");
  } finally {
    setTimeout(loadAttendancePage, 1200);
  }
}

function openGgmPage(url) {
  chrome.runtime.sendMessage({ type: "OPEN_GGM_PAGE", url });
}

document.getElementById("backBtn").addEventListener("click", () => { window.location.href = "popup.html"; });
document.getElementById("featureSettingsBtn").addEventListener("click", () => { window.location.href = "attendance-settings.html"; });
document.getElementById("globalSettingsBtn").addEventListener("click", () => { window.location.href = "settings.html"; });
document.getElementById("loginBtn").addEventListener("click", () => openGgmPage("/user/login"));
document.getElementById("checkBtn").addEventListener("click", manualCheck);

loadAttendancePage();
