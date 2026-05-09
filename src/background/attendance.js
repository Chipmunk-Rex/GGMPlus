// Attendance check flow and alarms.

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
    }

    // 3. 요청 헤더 구성
    const authMeta = await getAuthMeta();
    const headers = {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    };

    if (authMeta.spaToken) {
      headers["X-Spa-Token"] = authMeta.spaToken;
    }

    if (bearerToken) {
      headers.Authorization = `${authMeta.tokenType || "Bearer"} ${bearerToken}`;
    }

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
      headers["Content-Type"] = ATTENDANCE_CONFIG.contentType;
    }

    console.log("[GGMAuto] 📡 요청 전송:", ATTENDANCE_CONFIG.url);
    console.log("[GGMAuto] 📋 헤더:", JSON.stringify(maskHeaders(headers), null, 2));
    console.log("[GGMAuto] 📦 Body:", fetchOptions.body || "(없음)");

    const response = await fetchGgmWithCorsFallback(ATTENDANCE_CONFIG.url, fetchOptions);
    const responseText = response.text;
    
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
  const today = getSiteDateKey(now); // YYYY-MM-DD 형식

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

  await saveActivity(
    success ? "attendance" : "attendance-error",
    success ? "출석체크 성공" : "출석체크 실패",
    message,
    "/town",
    { alreadyChecked },
  );

  console.log("[GGMAuto] 💾 결과 저장 완료:", record);
}

// ============================================
// 🔔 알림 함수
// ============================================

/**
 * 데스크톱 알림 표시
 */

async function isTodayChecked() {
  const data = await chrome.storage.local.get(["todayChecked"]);
  const today = getSiteDateKey();
  return data.todayChecked === today;
}

/**
 * 자정까지 남은 시간(분) 계산
 */
function getMinutesUntilMidnight() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 30, 0); // 자정 + 30초 (안전 마진)
  const diffMs = midnight - now;
  return Math.ceil(diffMs / 60000);
}

/**
 * 자정 알람 설정
 */
async function setupMidnightAlarm() {
  const minutesUntilMidnight = getMinutesUntilMidnight();
  
  await chrome.alarms.clear(DEFAULT_ALARM_CONFIG.dailyAlarmName);
  await chrome.alarms.create(DEFAULT_ALARM_CONFIG.dailyAlarmName, {
    delayInMinutes: minutesUntilMidnight,
    periodInMinutes: 1440, // 24시간마다 반복
  });
  
  console.log(`[GGMAuto] ⏰ 자정 알람 설정: ${minutesUntilMidnight}분 후 실행`);
}

async function setupAttendanceAlarm(config) {
  const alarmConfig = config || await getAlarmConfig();

  await chrome.alarms.clear(DEFAULT_ALARM_CONFIG.name);
  await chrome.alarms.create(DEFAULT_ALARM_CONFIG.name, {
    delayInMinutes: Math.max(1, Number(alarmConfig.delayInMinutes) || DEFAULT_ALARM_CONFIG.delayInMinutes),
    periodInMinutes: Math.max(1, Number(alarmConfig.periodInMinutes) || DEFAULT_ALARM_CONFIG.periodInMinutes),
  });

  console.log(
    `[GGMAuto] ⏰ 주기 알람 설정: ${alarmConfig.delayInMinutes}분 후 첫 실행, ${alarmConfig.periodInMinutes}분마다 반복`,
  );
}

async function scheduleInitialCheckAlarm() {
  const alarmConfig = await getAlarmConfig();
  await chrome.alarms.clear(DEFAULT_ALARM_CONFIG.initialCheckName);
  if (Number(alarmConfig.delayInMinutes) <= DEFAULT_ALARM_CONFIG.delayInMinutes) {
    return;
  }

  await chrome.alarms.create(DEFAULT_ALARM_CONFIG.initialCheckName, {
    delayInMinutes: DEFAULT_ALARM_CONFIG.delayInMinutes,
  });
}

/**
 * 출석체크 필요 시 실행
 */
async function checkAndAttend() {
  const checked = await isTodayChecked();
  if (!checked) {
    console.log("[GGMAuto] 📋 오늘 출석체크 미완료 - 출석체크 시도");
    await sendAttendance();
  } else {
    console.log("[GGMAuto] ✅ 오늘 이미 출석체크 완료됨 - 스킵");
  }
}

/**
 * 확장 프로그램 설치/업데이트 시
 */
