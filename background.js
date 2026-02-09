// ============================================
// 🔧 사용자 설정 영역 (User Configuration)
// ============================================

// 📌 대상 사이트 도메인
const TARGET_DOMAIN = "ggm.gondr.net";

// 📌 출석체크 API 설정
const ATTENDANCE_CONFIG = {
  url: "https://ggm.gondr.net/api/town/goldbox/attendance",
  method: "POST",
  // 요청 본문 (빈 객체)
  body: JSON.stringify({}),
  contentType: "application/json"
};

// 📌 알람 설정 (기본값)
const DEFAULT_ALARM_CONFIG = {
  name: "attendanceAlarm",
  delayInMinutes: 1,
  periodInMinutes: 60
};

// 📌 현재 알람 설정 가져오기
async function getAlarmConfig() {
  const stored = await chrome.storage.local.get(["alarmDelayMinutes", "alarmPeriodMinutes"]);
  return {
    name: DEFAULT_ALARM_CONFIG.name,
    delayInMinutes: stored.alarmDelayMinutes || DEFAULT_ALARM_CONFIG.delayInMinutes,
    periodInMinutes: stored.alarmPeriodMinutes || DEFAULT_ALARM_CONFIG.periodInMinutes
  };
}

// 📌 토큰 자동 갱신 설정
const TOKEN_REFRESH_CONFIG = {
  // 토큰 갱신을 위해 열 페이지 URL
  refreshUrl: "https://ggm.gondr.net",
  // 탭이 토큰을 수집할 때까지 대기 시간 (밀리초)
  waitTime: 5000,
  // 자동 갱신 활성화
  autoRefresh: true
};

// ============================================
// 🔐 토큰 관리 함수
// ============================================

/**
 * 저장된 Bearer 토큰 가져오기
 */
async function getBearerToken() {
  try {
    const result = await chrome.storage.local.get(["bearerToken", "tokenExpiry"]);
    
    if (!result.bearerToken) {
      console.warn("[GGMAuto] ⚠️ Bearer 토큰이 없습니다. 사이트 방문 후 토큰을 수집해주세요.");
      return null;
    }
    
    // 토큰 만료 체크 (선택적)
    if (result.tokenExpiry && Date.now() > result.tokenExpiry) {
      console.warn("[GGMAuto] ⚠️ Bearer 토큰이 만료되었습니다. 사이트 재방문이 필요합니다.");
      return null;
    }
    
    return result.bearerToken;
  } catch (error) {
    console.error("[GGMAuto] ❌ 토큰 조회 실패:", error);
    return null;
  }
}

/**
 * X-XSRF-TOKEN 쿠키 가져오기
 */
async function getXsrfToken() {
  try {
    const cookie = await chrome.cookies.get({
      url: `https://${TARGET_DOMAIN}`,
      name: "XSRF-TOKEN" // Laravel 기본 XSRF 쿠키명
    });
    
    if (!cookie) {
      console.log("[GGMAuto] ℹ️ XSRF-TOKEN 쿠키 없음 (필수 아닐 수 있음)");
      return null;
    }
    
    // URL 디코딩 (쿠키 값이 인코딩되어 있는 경우)
    return decodeURIComponent(cookie.value);
  } catch (error) {
    console.error("[GGMAuto] ❌ XSRF 토큰 조회 실패:", error);
    return null;
  }
}

/**
 * 백그라운드에서 탭을 열어 토큰 자동 갱신
 * @returns {Promise<boolean>} 갱신 성공 여부
 */
async function refreshTokenAutomatically() {
  if (!TOKEN_REFRESH_CONFIG.autoRefresh) {
    console.log("[GGMAuto] ℹ️ 자동 토큰 갱신이 비활성화됨");
    return false;
  }
  
  console.log("[GGMAuto] 🔄 토큰 자동 갱신 시도...");
  
  try {
    // 1. 백그라운드에서 탭 열기 (비활성 상태)
    const tab = await chrome.tabs.create({
      url: TOKEN_REFRESH_CONFIG.refreshUrl,
      active: false // 백그라운드에서 열기
    });
    
    console.log("[GGMAuto] 📑 토큰 갱신용 탭 열림:", tab.id);
    
    // 2. 페이지 로드 및 토큰 수집 대기
    await new Promise(resolve => setTimeout(resolve, TOKEN_REFRESH_CONFIG.waitTime));
    
    // 3. 탭 닫기
    try {
      await chrome.tabs.remove(tab.id);
      console.log("[GGMAuto] 📑 토큰 갱신용 탭 닫힘");
    } catch (e) {
      // 이미 닫혔을 수 있음
    }
    
    // 4. 토큰 수집 확인
    const token = await getBearerToken();
    if (token) {
      console.log("[GGMAuto] ✅ 토큰 자동 갱신 성공!");
      return true;
    } else {
      console.log("[GGMAuto] ⚠️ 토큰 갱신 실패 - 로그인 필요할 수 있음");
      return false;
    }
    
  } catch (error) {
    console.error("[GGMAuto] ❌ 토큰 자동 갱신 오류:", error);
    return false;
  }
}

// ============================================
// 📤 출석체크 요청 함수
// ============================================

/**
 * 출석체크 요청 보내기
 */
async function sendAttendance(retryAfterRefresh = true) {
  console.log("[GGMAuto] 🚀 출석체크 시작...", new Date().toLocaleString());

  try {
    // 1. 토큰 수집
    let bearerToken = await getBearerToken();
    const xsrfToken = await getXsrfToken();

    // 2. 토큰 유효성 검사 - 없으면 자동 갱신 시도
    if (!bearerToken) {
      console.log("[GGMAuto] ⚠️ 토큰 없음 - 자동 갱신 시도...");

      if (retryAfterRefresh) {
        const refreshed = await refreshTokenAutomatically();
        if (refreshed) {
          // 갱신 성공 시 다시 시도 (재귀 방지를 위해 retryAfterRefresh=false)
          return await sendAttendance(false);
        }
      }

      const errorMsg = "Bearer 토큰 없음 - 사이트 로그인 필요";
      console.error("[GGMAuto] ❌", errorMsg);
      await saveAttendanceResult(false, errorMsg);
      showNotification("출석체크 실패", errorMsg);
      return { success: false, error: errorMsg };
    }

    // 3. 요청 헤더 구성
    const headers = {
      "Content-Type": ATTENDANCE_CONFIG.contentType,
      Authorization: `Bearer ${bearerToken}`,
      Accept: "application/json",
    };

    // XSRF 토큰이 있는 경우에만 추가
    if (xsrfToken) {
      headers["X-XSRF-TOKEN"] = xsrfToken;
    }

    // 4. Fetch 요청
    const fetchOptions = {
      method: ATTENDANCE_CONFIG.method,
      headers: headers,
      credentials: "include", // 쿠키 포함
    };

    // GET 요청이 아닌 경우에만 body 추가
    if (ATTENDANCE_CONFIG.method !== "GET" && ATTENDANCE_CONFIG.body) {
      fetchOptions.body = ATTENDANCE_CONFIG.body;
    }

    console.log("[GGMAuto] 📡 요청 전송:", ATTENDANCE_CONFIG.url);
    console.log("[GGMAuto] 📋 헤더:", JSON.stringify(headers, null, 2));
    console.log("[GGMAuto] 📦 Body:", fetchOptions.body || "(없음)");

    const response = await fetch(ATTENDANCE_CONFIG.url, fetchOptions);
    const responseText = await response.text();
    
    // JSON 응답 파싱 시도 (유니코드 이스케이프 디코딩)
    let decodedMessage = responseText;
    try {
      const jsonResponse = JSON.parse(responseText);
      if (jsonResponse.msg) {
        decodedMessage = jsonResponse.msg;
      }
    } catch (e) {
      // JSON 파싱 실패 시 원본 텍스트 사용
    }

    // 5. 응답 처리
    if (response.ok) {
      console.log("[GGMAuto] ✅ 출석체크 성공!", response.status);
      console.log("[GGMAuto] 📄 응답:", decodedMessage);

      await saveAttendanceResult(true, decodedMessage);
      showNotification("출석체크 성공", "출석체크가 완료되었습니다!");

      return { success: true, data: responseText };
    } else {
      const errorMsg = `HTTP ${response.status}: ${decodedMessage}`;

      // 400 에러 - 이미 출석체크 완료인 경우 처리
      console.log("[GGMAuto] 📄 응답 상태:", response.status);
      console.log("[GGMAuto] 📄 디코딩된 메시지:", decodedMessage);

      if (response.status === 400) {
        // 디코딩된 메시지에서 "이미", "already", "완료", "하셨습니다" 등 키워드 확인
        const alreadyChecked =
          /이미|완료|하셨습니다|already|done|exist|duplicate/i.test(
            decodedMessage,
          );

        if (alreadyChecked) {
          console.log("[GGMAuto] ✅ 오늘 이미 출석체크 완료!");
          console.log("[GGMAuto] 📄 응답:", decodedMessage);

          await saveAttendanceResult(true, "오늘 이미 출석체크 완료", true);
          // 알림 표시 안함 (이미 출석한 건 알림 필요 없음)

          return { success: true, alreadyChecked: true, data: responseText };
        }
      }

      console.error("[GGMAuto] ❌ 출석체크 실패:", errorMsg);

      // 401/403 에러 시 토큰 만료 처리
      if (response.status === 401 || response.status === 403) {
        console.warn("[GGMAuto] ⚠️ 인증 오류 - 토큰이 만료되었을 수 있습니다.");
        await chrome.storage.local.remove(["bearerToken", "tokenExpiry"]);
      }

      await saveAttendanceResult(false, errorMsg);
      showNotification("출석체크 실패", `오류: ${response.status}`);

      return { success: false, error: errorMsg };
    }
  } catch (error) {
    const errorMsg = error.message || "네트워크 오류";
    console.error("[GGMAuto] ❌ 출석체크 예외:", error);

    await saveAttendanceResult(false, errorMsg);
    showNotification("출석체크 실패", errorMsg);

    return { success: false, error: errorMsg };
  }
}

// ============================================
// 💾 결과 저장 함수
// ============================================

/**
 * 출석체크 결과 저장
 * @param {boolean} success - 성공 여부
 * @param {string} message - 메시지
 * @param {boolean} alreadyChecked - 이미 출석체크 완료 여부
 */
async function saveAttendanceResult(success, message, alreadyChecked = false) {
  const now = new Date();
  const today = now.toISOString().split("T")[0]; // YYYY-MM-DD 형식

  const record = {
    lastAttempt: now.toISOString(),
    lastAttemptReadable: now.toLocaleString("ko-KR"),
    success: success,
    message: message,
  };

  if (success) {
    record.lastSuccess = now.toISOString();
    record.lastSuccessReadable = now.toLocaleString("ko-KR");
    record.todayChecked = today; // 오늘 출석체크 완료 날짜 저장
    record.alreadyCheckedToday = alreadyChecked;
  }

  // 기존 기록 유지하면서 업데이트
  const existing = await chrome.storage.local.get(["attendanceHistory"]);
  const history = existing.attendanceHistory || [];

  // 최근 100개 기록만 유지
  history.unshift(record);
  if (history.length > 100) {
    history.pop();
  }

  await chrome.storage.local.set({
    ...record,
    attendanceHistory: history,
  });

  console.log("[GGMAuto] 💾 결과 저장 완료:", record);
}

// ============================================
// 🔔 알림 함수
// ============================================

/**
 * 데스크톱 알림 표시
 */
function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: `[GGMAuto] ${title}`,
    message: message,
    priority: 2
  });
}

// ============================================
// ⏰ 알람 및 이벤트 리스너
// ============================================

/**
 * 확장 프로그램 설치/업데이트 시
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[GGMAuto] 📦 확장 프로그램 설치됨:", details.reason);
  
  const alarmConfig = await getAlarmConfig();
  
  // 기존 알람 제거 후 새로 설정
  await chrome.alarms.clear(alarmConfig.name);
  
  await chrome.alarms.create(alarmConfig.name, {
    delayInMinutes: alarmConfig.delayInMinutes,
    periodInMinutes: alarmConfig.periodInMinutes
  });
  
  console.log(`[GGMAuto] ⏰ 알람 설정 완료: ${alarmConfig.delayInMinutes}분 후 첫 실행, ${alarmConfig.periodInMinutes}분마다 반복`);
  
  // 설치 알림
  if (details.reason === "install") {
    showNotification("설치 완료", "대상 사이트 방문하여 로그인해주세요.");
  }
});

/**
 * 브라우저 시작 시
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log("[GGMAuto] 🌅 브라우저 시작됨");
  
  const alarmConfig = await getAlarmConfig();
  
  // 알람이 없으면 다시 설정
  const alarm = await chrome.alarms.get(alarmConfig.name);
  if (!alarm) {
    await chrome.alarms.create(alarmConfig.name, {
      delayInMinutes: alarmConfig.delayInMinutes,
      periodInMinutes: alarmConfig.periodInMinutes
    });
    console.log("[GGMAuto] ⏰ 알람 재설정 완료");
  }
});

/**
 * 알람 발생 시
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === DEFAULT_ALARM_CONFIG.name) {
    console.log("[GGMAuto] ⏰ 알람 트리거됨:", new Date().toLocaleString());
    await sendAttendance();
  }
});

/**
 * Content Script에서 메시지 수신 (토큰 저장)
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TOKEN_UPDATE") {
    console.log("[GGMAuto] 🔑 토큰 업데이트 수신:", message.data ? "토큰 있음" : "토큰 없음");
    
    const storageData = {
      bearerToken: message.data.token,
      tokenExpiry: message.data.expiry || null,
      tokenUpdatedAt: new Date().toISOString()
    };
    
    // 사용자 정보가 있으면 함께 저장
    if (message.data.userInfo) {
      storageData.userName = message.data.userInfo.name || message.data.userInfo.username || message.data.userInfo.id || null;
      storageData.userInfo = message.data.userInfo;
      console.log("[GGMAuto] 👤 사용자 정보:", storageData.userName);
    }
    
    chrome.storage.local.set(storageData).then(() => {
      console.log("[GGMAuto] 💾 토큰 저장 완료");
      sendResponse({ success: true });
    });
    
    return true; // 비동기 응답을 위해 true 반환
  }
  
  // 수동 출석체크 요청 (팝업 등에서 사용)
  if (message.type === "MANUAL_ATTENDANCE") {
    console.log("[GGMAuto] 🖱️ 수동 출석체크 요청");
    sendAttendance().then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  // 상태 조회
  if (message.type === "GET_STATUS") {
    chrome.storage.local.get([
      "bearerToken", 
      "userName",
      "lastAttempt", 
      "lastSuccess", 
      "success",
      "todayChecked"
    ]).then(data => {
      const today = new Date().toISOString().split('T')[0];
      const isTodayChecked = data.todayChecked === today;
      
      sendResponse({
        hasToken: !!data.bearerToken,
        userName: data.userName || null,
        lastAttempt: data.lastAttempt,
        lastSuccess: data.lastSuccess,
        lastResult: data.success,
        todayChecked: isTodayChecked
      });
    });
    return true;
  }
  
  // 설정 조회
  if (message.type === "GET_SETTINGS") {
    getAlarmConfig().then(config => {
      sendResponse({
        delayInMinutes: config.delayInMinutes,
        periodInMinutes: config.periodInMinutes
      });
    });
    return true;
  }
  
  // 설정 저장
  if (message.type === "SAVE_SETTINGS") {
    (async () => {
      try {
        const { delayInMinutes, periodInMinutes } = message.data;
        
        // 설정 저장
        await chrome.storage.local.set({
          alarmDelayMinutes: delayInMinutes,
          alarmPeriodMinutes: periodInMinutes
        });
        
        // 알람 재설정
        await chrome.alarms.clear(DEFAULT_ALARM_CONFIG.name);
        await chrome.alarms.create(DEFAULT_ALARM_CONFIG.name, {
          delayInMinutes: delayInMinutes,
          periodInMinutes: periodInMinutes
        });
        
        console.log(`[GGMAuto] ⏰ 알람 설정 변경: ${delayInMinutes}분 후 첫 실행, ${periodInMinutes}분마다 반복`);
        sendResponse({ success: true });
      } catch (error) {
        console.error("[GGMAuto] ❌ 설정 저장 실패:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  // 로그 조회
  if (message.type === "GET_LOGS") {
    chrome.storage.local.get(["attendanceHistory"]).then(data => {
      sendResponse({ logs: data.attendanceHistory || [] });
    });
    return true;
  }
  
  // 로그 삭제
  if (message.type === "CLEAR_LOGS") {
    chrome.storage.local.remove(["attendanceHistory"]).then(() => {
      console.log("[GGMAuto] 🗑️ 로그 삭제됨");
      sendResponse({ success: true });
    });
    return true;
  }
  
  // 전체 초기화
  if (message.type === "RESET_ALL") {
    (async () => {
      try {
        // 모든 데이터 삭제
        await chrome.storage.local.clear();
        
        // 알람 재설정 (기본값으로)
        await chrome.alarms.clear(DEFAULT_ALARM_CONFIG.name);
        await chrome.alarms.create(DEFAULT_ALARM_CONFIG.name, {
          delayInMinutes: DEFAULT_ALARM_CONFIG.delayInMinutes,
          periodInMinutes: DEFAULT_ALARM_CONFIG.periodInMinutes
        });
        
        console.log("[GGMAuto] 🗑️ 전체 초기화 완료");
        sendResponse({ success: true });
      } catch (error) {
        console.error("[GGMAuto] ❌ 초기화 실패:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

// ============================================
// 🚀 초기화
// ============================================

console.log("[GGMAuto] 🎉 Service Worker 시작됨");
