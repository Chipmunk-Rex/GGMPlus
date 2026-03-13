const ext = globalThis.browser ?? globalThis.chrome;

const TOKEN_KEYS = [
  "token",
  "access_token",
  "accessToken",
  "auth_token",
  "authToken",
  "jwt",
  "jwtToken",
  "bearer_token",
  "bearerToken",
];

const USER_KEYS = [
  "user",
  "userInfo",
  "user_info",
  "currentUser",
  "profile",
  "me",
];

const TOKEN_CHECK_INTERVAL_MS = 30000;

function parseTokenValue(value) {
  try {
    const parsed = JSON.parse(value);

    if (typeof parsed === "object" && parsed !== null) {
      const tokenFields = ["token", "access_token", "accessToken", "jwt", "value"];
      for (const field of tokenFields) {
        if (parsed[field]) {
          return {
            token: parsed[field],
            expiry: parsed.expiry || parsed.exp || parsed.expires_at || null,
          };
        }
      }
    }

    return { token: parsed, expiry: null };
  } catch (error) {
    return { token: value, expiry: null };
  }
}

function findTokenInStorage(storage) {
  for (const key of TOKEN_KEYS) {
    const value = storage.getItem(key);
    if (value) {
      console.log(`[GGMPlus] Found token in storage key: ${key}`);
      return parseTokenValue(value);
    }
  }

  return null;
}

function findTokenInObject(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 5) {
    return null;
  }

  const tokenFields = ["token", "access_token", "accessToken", "jwt", "bearer"];

  for (const key of Object.keys(obj)) {
    if (
      tokenFields.includes(key) &&
      typeof obj[key] === "string" &&
      obj[key].length > 20
    ) {
      return obj[key];
    }

    const nested = findTokenInObject(obj[key], depth + 1);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function findTokenInWindow() {
  const candidates = [window.__INITIAL_STATE__, window.__NUXT__, window.__NEXT_DATA__];

  for (const candidate of candidates) {
    const token = findTokenInObject(candidate);
    if (token) {
      return { token, expiry: null };
    }
  }

  return null;
}

function findUserInfo() {
  for (const key of USER_KEYS) {
    const value = localStorage.getItem(key);
    if (!value) {
      continue;
    }

    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed;
      }
    } catch (error) {
      // Ignore non-JSON values.
    }
  }

  return null;
}

async function sendTokenToBackground(tokenData) {
  if (!tokenData?.token) {
    return;
  }

  try {
    await ext.runtime.sendMessage({
      type: "TOKEN_UPDATE",
      data: tokenData,
    });
  } catch (error) {
    console.error("[GGMPlus] Failed to send token update:", error);
  }
}

function findAndSendToken() {
  let tokenData = findTokenInStorage(localStorage);

  if (!tokenData) {
    tokenData = findTokenInStorage(sessionStorage);
  }

  if (!tokenData) {
    tokenData = findTokenInWindow();
  }

  if (!tokenData) {
    return null;
  }

  const userInfo = findUserInfo();
  if (userInfo) {
    tokenData.userInfo = userInfo;
  }

  sendTokenToBackground(tokenData);
  return tokenData;
}

window.addEventListener("storage", (event) => {
  if (TOKEN_KEYS.includes(event.key) || USER_KEYS.includes(event.key)) {
    findAndSendToken();
  }
});

const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function patchedSetItem(key, value) {
  originalSetItem(key, value);

  if (TOKEN_KEYS.includes(key) || USER_KEYS.includes(key)) {
    findAndSendToken();
  }
};

function startTokenWatcher() {
  findAndSendToken();
  setInterval(findAndSendToken, TOKEN_CHECK_INTERVAL_MS);
}

if (document.readyState === "complete") {
  startTokenWatcher();
} else {
  window.addEventListener("load", startTokenWatcher, { once: true });
}
