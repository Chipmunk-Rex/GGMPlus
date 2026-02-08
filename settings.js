// 토스트 메시지 표시
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

// 설정 불러오기
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    
    document.getElementById("intervalInput").value = response.periodInMinutes || 60;
    document.getElementById("delayInput").value = response.delayInMinutes || 1;
  } catch (error) {
    console.error("설정 불러오기 실패:", error);
  }
}

// 알람 설정 저장
async function saveAlarmSettings() {
  const interval = parseInt(document.getElementById("intervalInput").value) || 60;
  const delay = parseInt(document.getElementById("delayInput").value) || 1;
  
  // 유효성 검사
  if (interval < 1 || interval > 1440) {
    showToast("⚠️ 실행 간격은 1~1440분 사이로 설정하세요");
    return;
  }
  
  if (delay < 1 || delay > 60) {
    showToast("⚠️ 첫 실행 대기는 1~60분 사이로 설정하세요");
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_SETTINGS",
      data: {
        periodInMinutes: interval,
        delayInMinutes: delay
      }
    });
    
    if (response.success) {
      showToast("✅ 설정이 저장되었습니다");
    } else {
      showToast("❌ 저장 실패");
    }
  } catch (error) {
    showToast("❌ 오류 발생");
    console.error(error);
  }
}

// 로그 불러오기
async function loadLogs() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_LOGS" });
    const container = document.getElementById("logContainer");
    
    if (!response.logs || response.logs.length === 0) {
      container.innerHTML = '<div class="log-entry log-info">로그가 없습니다</div>';
      return;
    }
    
    container.innerHTML = response.logs.map(log => {
      const time = formatLogTime(log.lastAttempt || log.time);
      const statusClass = log.success ? "log-success" : "log-error";
      const statusIcon = log.success ? "✅" : "❌";
      const message = log.message ? ` - ${truncate(log.message, 30)}` : "";
      
      return `<div class="log-entry ${statusClass}">
        <span class="log-time">${time}</span>
        ${statusIcon}${message}
      </div>`;
    }).join("");
    
  } catch (error) {
    console.error("로그 불러오기 실패:", error);
    document.getElementById("logContainer").innerHTML = 
      '<div class="log-entry log-error">로그 불러오기 실패</div>';
  }
}

// 시간 포맷팅
function formatLogTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// 문자열 자르기
function truncate(str, maxLength) {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
}

// 로그 삭제
async function clearLogs() {
  if (!confirm("로그를 모두 삭제하시겠습니까?")) return;
  
  try {
    await chrome.runtime.sendMessage({ type: "CLEAR_LOGS" });
    showToast("✅ 로그가 삭제되었습니다");
    loadLogs();
  } catch (error) {
    showToast("❌ 삭제 실패");
  }
}

// 전체 초기화
async function resetAll() {
  if (!confirm("모든 데이터(토큰, 로그, 설정)를 초기화하시겠습니까?\n\n다시 로그인이 필요합니다.")) return;
  if (!confirm("정말로 초기화하시겠습니까?")) return;
  
  try {
    await chrome.runtime.sendMessage({ type: "RESET_ALL" });
    showToast("✅ 초기화 완료");
    
    // 설정 및 로그 새로고침
    setTimeout(() => {
      loadSettings();
      loadLogs();
    }, 500);
  } catch (error) {
    showToast("❌ 초기화 실패");
  }
}

// 뒤로가기
function goBack() {
  window.location.href = "popup.html";
}

// 이벤트 리스너
document.getElementById("backBtn").addEventListener("click", goBack);
document.getElementById("saveAlarmBtn").addEventListener("click", saveAlarmSettings);
document.getElementById("refreshLogBtn").addEventListener("click", loadLogs);
document.getElementById("clearLogsBtn").addEventListener("click", clearLogs);
document.getElementById("resetAllBtn").addEventListener("click", resetAll);

// 초기화
loadSettings();
loadLogs();
