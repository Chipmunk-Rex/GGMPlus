// Authentication, token refresh, and GGM API requests.

function normalizeTokenExpiry(expiry) {
  if (!expiry) return null;

  if (typeof expiry === "number") {
    return expiry < 100000000000 ? expiry * 1000 : expiry;
  }

  if (typeof expiry === "string") {
    const numeric = Number(expiry);
    if (Number.isFinite(numeric)) {
      return normalizeTokenExpiry(numeric);
    }

    const parsedDate = Date.parse(expiry);
    return Number.isNaN(parsedDate) ? null : parsedDate;
  }

  return null;
}

function maskHeaders(headers) {
  return {
    ...headers,
    Authorization: headers.Authorization ? "Bearer ***" : undefined,
    "X-XSRF-TOKEN": headers["X-XSRF-TOKEN"] ? "***" : undefined,
    "X-Spa-Token": headers["X-Spa-Token"] ? "***" : undefined,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getGgmRequestTab() {
  const existingTabs = await chrome.tabs.query({ url: `https://${TARGET_DOMAIN}/*` });
  if (existingTabs.length > 0) {
    return { tab: existingTabs[0], temporary: false };
  }

  const tab = await chrome.tabs.create({
    url: `https://${TARGET_DOMAIN}/`,
    active: false,
  });
  return { tab, temporary: true };
}

function sendTabMessageWithTimeout(tabId, message) {
  return Promise.race([
    chrome.tabs.sendMessage(tabId, message),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("GGM page request timed out.")),
        GGM_PAGE_REQUEST_TIMEOUT_MS,
      ),
    ),
  ]);
}

function withoutHeader(fetchOptions, headerName) {
  const nextOptions = {
    ...fetchOptions,
    headers: {
      ...(fetchOptions.headers || {}),
    },
  };
  const lowerHeaderName = headerName.toLowerCase();

  for (const key of Object.keys(nextOptions.headers)) {
    if (key.toLowerCase() === lowerHeaderName) {
      delete nextOptions.headers[key];
    }
  }

  return nextOptions;
}

async function requestFromGgmPage(pathOrUrl, fetchOptions) {
  const { tab, temporary } = await getGgmRequestTab();
  let lastError = null;

  try {
    for (let attempt = 0; attempt < GGM_CONTENT_READY_RETRIES; attempt += 1) {
      try {
        const result = await sendTabMessageWithTimeout(tab.id, {
          type: MESSAGE_TYPES.GGM_API_REQUEST,
          url: toGgmUrl(pathOrUrl),
          options: fetchOptions,
        });

        if (!result || !result.success) {
          throw new Error(result?.error || "GGM page request failed.");
        }

        return result.response;
      } catch (error) {
        lastError = error;
        await sleep(GGM_CONTENT_READY_DELAY_MS);
      }
    }

    throw lastError || new Error("GGM page request failed.");
  } finally {
    if (temporary && tab.id) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch (error) {
        console.warn("[GGMAuto] 임시 GGM 탭 닫기 실패:", error);
      }
    }
  }
}

async function fetchGgmWithCorsFallback(pathOrUrl, fetchOptions) {
  const response = await fetch(toGgmUrl(pathOrUrl), fetchOptions);
  const text = await response.text();

  if (response.status !== 401 && response.status !== 403) {
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      text,
      fromPageContext: false,
    };
  }

  console.warn(
    `[GGMAuto] ${response.status} 응답 감지 - GGM 페이지 컨텍스트에서 재시도합니다.`,
  );

  try {
    let pageResponse = await requestFromGgmPage(pathOrUrl, fetchOptions);

    if (
      (pageResponse.status === 401 || pageResponse.status === 403) &&
      fetchOptions.headers?.Authorization
    ) {
      console.warn("[GGMAuto] Bearer 인증 실패 - 쿠키 기반 요청으로 재시도합니다.");
      pageResponse = await requestFromGgmPage(
        pathOrUrl,
        withoutHeader(fetchOptions, "Authorization"),
      );
    }

    return {
      ...pageResponse,
      fromPageContext: true,
    };
  } catch (error) {
    console.warn("[GGMAuto] GGM 페이지 컨텍스트 재시도 실패:", error);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      text,
      fromPageContext: false,
    };
  }
}

async function requestGgmApi(path, options = {}) {
  const bearerToken = await getBearerToken();
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

  const response = await fetchGgmWithCorsFallback(path, {
    method: "GET",
    headers,
    credentials: "include",
  });
  const text = response.text;

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
  }

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("JSON 응답을 해석하지 못했습니다.");
  }
}

async function getBearerToken() {
  try {
    const result = await chrome.storage.local.get([
      "bearerToken",
      "tokenExpiry",
    ]);

    if (!result.bearerToken) {
      console.warn(
        "[GGMAuto] ⚠️ Bearer 토큰이 없습니다. 사이트 방문 후 토큰을 수집해주세요.",
      );
      return null;
    }

    // 토큰 만료 체크 (선택적)
    const tokenExpiry = normalizeTokenExpiry(result.tokenExpiry);
    if (tokenExpiry && Date.now() > tokenExpiry) {
      console.warn(
        "[GGMAuto] ⚠️ Bearer 토큰이 만료되었습니다. 사이트 재방문이 필요합니다.",
      );
      await chrome.storage.local.remove(["bearerToken", "tokenExpiry"]);
      return null;
    }

    return result.bearerToken;
  } catch (error) {
    console.error("[GGMAuto] ❌ 토큰 조회 실패:", error);
    return null;
  }
}

async function getAuthMeta() {
  try {
    const result = await chrome.storage.local.get([
      "tokenType",
      "spaToken",
      "csrfToken",
    ]);

    return {
      tokenType: result.tokenType || "Bearer",
      spaToken: result.spaToken || null,
      csrfToken: result.csrfToken || null,
    };
  } catch (error) {
    console.error("[GGMAuto] 인증 메타 조회 실패:", error);
    return { tokenType: "Bearer", spaToken: null, csrfToken: null };
  }
}

/**
 * X-XSRF-TOKEN 쿠키 가져오기
 */
async function getXsrfToken() {
  try {
    const cookie = await chrome.cookies.get({
      url: `https://${TARGET_DOMAIN}`,
      name: "XSRF-TOKEN", // Laravel 기본 XSRF 쿠키명
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
      active: false, // 백그라운드에서 열기
    });

    console.log("[GGMAuto] 📑 토큰 갱신용 탭 열림:", tab.id);

    // 2. 페이지 로드 및 토큰 수집 대기
    await new Promise((resolve) =>
      setTimeout(resolve, TOKEN_REFRESH_CONFIG.waitTime),
    );

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
