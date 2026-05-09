// Extension notification helpers.

async function createNotificationWithUrl(title, message, pathOrUrl) {
  const id = `ggmplus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: `[GGMPlus] ${title}`,
    message,
    priority: 2,
  });

  if (pathOrUrl) {
    const stored = await chrome.storage.local.get(["notificationUrls"]);
    const notificationUrls = stored.notificationUrls || {};
    notificationUrls[id] = toGgmUrl(pathOrUrl);
    await chrome.storage.local.set({ notificationUrls });
  }

  return id;
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: `[GGMAuto] ${title}`,
    message: message,
    priority: 2,
  });
}

// ============================================
// ⏰ 알람 및 이벤트 리스너
// ============================================

/**
 * 오늘 출석체크 완료 여부 확인
 */

chrome.notifications.onClicked.addListener(async (notificationId) => {
  const stored = await chrome.storage.local.get(["notificationUrls"]);
  const notificationUrls = stored.notificationUrls || {};
  const url = notificationUrls[notificationId];

  if (url) {
    await openGgmPage(url);
    delete notificationUrls[notificationId];
    await chrome.storage.local.set({ notificationUrls });
  }

  chrome.notifications.clear(notificationId);
});
