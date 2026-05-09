// Bridge GGM API requests through the page context.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== MESSAGE_TYPES.GGM_API_REQUEST) return false;

  (async () => {
    try {
      const requestUrl = new URL(message.url, location.origin);
      if (requestUrl.origin !== location.origin) {
        throw new Error("Blocked cross-origin page-context request.");
      }

      const headers = {
        ...(message.options?.headers || {}),
      };
      const spaToken = getMetaContent("spa-token");
      if (spaToken && !headers["X-Spa-Token"]) {
        headers["X-Spa-Token"] = spaToken;
      }
      if (!headers["X-Requested-With"]) {
        headers["X-Requested-With"] = "XMLHttpRequest";
      }

      const response = await fetch(requestUrl.href, {
        ...(message.options || {}),
        headers,
        credentials: "include",
      });
      const text = await response.text();

      sendResponse({
        success: true,
        response: {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          text,
        },
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message || "GGM page request failed.",
      });
    }
  })();

  return true;
});

// ============================================
// 🚀 초기화
// ============================================

// 페이지 로드 완료 후 실행
