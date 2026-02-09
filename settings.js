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
    const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    
    // 오늘 출석 상태
    const todayStatus = document.getElementById("todayStatus");
    if (response.todayChecked) {
      todayStatus.textContent = "✅ 완료";
      todayStatus.className = "status-value success";
    } else {
      todayStatus.textContent = "⏳ 미완료";
      todayStatus.className = "status-value pending";
    }
    
    // 다음 실행 시간 (자정)
    const nextCheckTime = document.getElementById("nextCheckTime");
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const hoursLeft = Math.floor((midnight - now) / 3600000);
    const minutesLeft = Math.floor(((midnight - now) % 3600000) / 60000);
    
    if (response.todayChecked) {
      nextCheckTime.textContent = `내일 자정 (${hoursLeft}시간 ${minutesLeft}분 후)`;
    } else {
      nextCheckTime.textContent = "오늘 자정 또는 브라우저 시작 시";
    }
  } catch (error) {
    console.error("설정 불러오기 실패:", error);
  }
}

// 수동 출석체크
async function manualCheck() {
  const btn = document.getElementById("manualCheckBtn");
  btn.disabled = true;
  btn.textContent = "처리 중...";
  
  try {
    const response = await chrome.runtime.sendMessage({ type: "MANUAL_ATTENDANCE" });
    
    if (response.success) {
      if (response.alreadyChecked) {
        showToast("✅ 이미 출석 완료!");
      } else {
        showToast("✅ 출석 성공!");
      }
    } else {
      showToast("❌ 출석체크 실패");
    }
  } catch (error) {
    showToast("❌ 오류 발생");
  }
  
  btn.disabled = false;
  btn.textContent = "🚀 지금 출석체크";
  loadSettings();
  loadLogs();
}

// 로그 저장 (클릭 시 상세보기용)
let logsData = [];

// 로그 불러오기
async function loadLogs() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_LOGS" });
    const container = document.getElementById("logContainer");
    
    if (!response.logs || response.logs.length === 0) {
      container.innerHTML = '<div class="log-entry log-info">로그가 없습니다</div>';
      logsData = [];
      return;
    }
    
    logsData = response.logs;
    
    container.innerHTML = response.logs.map((log, index) => {
      const time = formatLogTime(log.lastAttempt || log.time);
      const statusClass = log.success ? "log-success" : "log-error";
      const statusIcon = log.success ? "✅" : "❌";
      const message = log.message ? ` - ${truncate(log.message, 30)}` : "";
      
      return `<div class="log-entry ${statusClass}" data-index="${index}">
        <span class="log-time">${time}</span>
        ${statusIcon}${message}
      </div>`;
    }).join("");
    
    // 클릭 이벤트 추가
    container.querySelectorAll('.log-entry[data-index]').forEach(entry => {
      entry.addEventListener('click', () => {
        const index = parseInt(entry.dataset.index);
        showLogDetail(logsData[index]);
      });
    });
    
  } catch (error) {
    console.error("로그 불러오기 실패:", error);
    document.getElementById("logContainer").innerHTML = 
      '<div class="log-entry log-error">로그 불러오기 실패</div>';
  }
}

// 로그 상세 모달 표시
function showLogDetail(log) {
  const modal = document.getElementById('logModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalContent = document.getElementById('modalContent');
  
  const time = formatLogTime(log.lastAttempt || log.time);
  const status = log.success ? '✅ 성공' : '❌ 실패';
  
  modalTitle.textContent = `📋 로그 상세 - ${status}`;
  modalContent.textContent = `시간: ${time}\n\n메시지:\n${log.message || '(메시지 없음)'}`;
  
  modal.classList.add('show');
}

// 모달 닫기
function closeModal() {
  document.getElementById('logModal').classList.remove('show');
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
document.getElementById("manualCheckBtn").addEventListener("click", manualCheck);
document.getElementById("refreshLogBtn").addEventListener("click", loadLogs);
document.getElementById("clearLogsBtn").addEventListener("click", clearLogs);
document.getElementById("resetAllBtn").addEventListener("click", resetAll);
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("logModal").addEventListener("click", (e) => {
  if (e.target.id === 'logModal') closeModal();
});

// 초기화
loadSettings();
loadLogs();
