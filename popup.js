// 상태 조회 및 UI 업데이트
async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    
    // 로그인 상태
    const loginStatus = document.getElementById("loginStatus");
    const loginBtn = document.getElementById("loginBtn");
    const checkBtn = document.getElementById("checkBtn");
    
    if (response.hasToken && response.userName) {
      loginStatus.textContent = `✅ ${response.userName}`;
      loginStatus.className = "status-value success";
      loginBtn.style.display = "none";
      checkBtn.disabled = false;
    } else if (response.hasToken) {
      loginStatus.textContent = "✅ 로그인됨";
      loginStatus.className = "status-value success";
      loginBtn.style.display = "none";
      checkBtn.disabled = false;
    } else {
      loginStatus.textContent = "❌ 로그인 필요";
      loginStatus.className = "status-value error";
      loginBtn.style.display = "block";
      checkBtn.disabled = true;
    }
    
    // 오늘 출석 상태
    const todayStatus = document.getElementById("todayStatus");
    if (response.todayChecked) {
      todayStatus.textContent = "✅ 완료";
      todayStatus.className = "status-value success";
      checkBtn.textContent = "✅ 오늘 출석 완료";
      checkBtn.disabled = true;
    } else if (response.hasToken) {
      todayStatus.textContent = "⏳ 미완료";
      todayStatus.className = "status-value pending";
      checkBtn.textContent = "🚀 수동 출석체크";
      checkBtn.disabled = false;
    } else {
      todayStatus.textContent = "-";
      todayStatus.className = "status-value";
    }
    
    // 마지막 성공
    const lastSuccess = document.getElementById("lastSuccess");
    lastSuccess.textContent = response.lastSuccess 
      ? formatDate(response.lastSuccess) 
      : "-";
    
  } catch (error) {
    console.error("상태 조회 실패:", error);
  }
}

// 날짜 포맷팅
function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  
  // 1분 이내
  if (diff < 60000) {
    return "방금 전";
  }
  
  // 1시간 이내
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}분 전`;
  }
  
  // 오늘
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }
  
  // 그 외
  return date.toLocaleDateString("ko-KR", { 
    month: "short", 
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// 수동 출석체크
async function manualCheck() {
  const btn = document.getElementById("checkBtn");
  
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>처리 중...';
  
  try {
    const response = await chrome.runtime.sendMessage({ type: "MANUAL_ATTENDANCE" });
    
    if (response.success) {
      if (response.alreadyChecked) {
        btn.innerHTML = "✅ 이미 출석 완료!";
      } else {
        btn.innerHTML = "✅ 출석 성공!";
      }
    } else {
      btn.innerHTML = "❌ 실패";
    }
    
    // 상태 업데이트 (버튼 텍스트는 updateStatus에서 처리)
    setTimeout(() => {
      updateStatus();
    }, 2000);
    
  } catch (error) {
    btn.innerHTML = "❌ 오류 발생";
    setTimeout(() => {
      updateStatus();
    }, 2000);
  }
}

// 로그인 페이지로 이동
function goToLogin() {
  chrome.tabs.create({ url: "https://ggm.gondr.net/user/login" });
  window.close();
}

// 설정 페이지로 이동
function goToSettings() {
  window.location.href = "settings.html";
}

// 탭 전환 기능
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      
      // 모든 탭 버튼 비활성화
      tabBtns.forEach(b => b.classList.remove('active'));
      // 클릭된 탭 버튼 활성화
      btn.classList.add('active');
      
      // 모든 탭 콘텐츠 숨기기
      tabContents.forEach(content => content.classList.remove('active'));
      // 해당 탭 콘텐츠 표시
      document.getElementById(`tab-${tabId}`).classList.add('active');
      
      // 선택된 탭 저장
      chrome.storage.local.set({ lastTab: tabId });
    });
  });
  
  // 마지막 선택 탭 복원
  chrome.storage.local.get(['lastTab'], (result) => {
    if (result.lastTab) {
      const savedTabBtn = document.querySelector(`[data-tab="${result.lastTab}"]`);
      if (savedTabBtn) {
        savedTabBtn.click();
      }
    }
  });
}

// 이벤트 리스너
document.getElementById("checkBtn").addEventListener("click", manualCheck);
document.getElementById("loginBtn").addEventListener("click", goToLogin);
document.getElementById("settingsBtn").addEventListener("click", goToSettings);

// 초기화
initTabs();
updateStatus();
