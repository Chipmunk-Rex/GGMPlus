let currentSettings = {};

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

function updateFeatureBadge() {
  const enabledCount = [
    currentSettings.showFloatingPanel !== false,
    currentSettings.markReadPosts !== false,
    currentSettings.darkModeEnabled === true,
  ].filter(Boolean).length;
  const badge = document.getElementById("featureBadge");
  badge.textContent = enabledCount ? `${enabledCount}개 활성` : "비활성";
  badge.className = enabledCount ? "badge success" : "badge";
}

async function saveSiteToggles() {
  const response = await chrome.runtime.sendMessage({
    type: "SAVE_FEATURE_SETTINGS",
    data: {
      ...currentSettings,
      showFloatingPanel: document.getElementById("showFloatingPanelToggle").checked,
      markReadPosts: document.getElementById("markReadPostsToggle").checked,
      darkModeEnabled: document.getElementById("darkModeToggle").checked,
    },
  });

  if (!response.success) {
    showToast(response.error || "설정을 저장하지 못했습니다");
    return;
  }

  currentSettings = response.settings;
  updateFeatureBadge();
  showToast("화면 보조 설정을 저장했습니다");
}

async function loadSiteStatus() {
  const [settings, readPosts] = await Promise.all([
    chrome.runtime.sendMessage({ type: "GET_FEATURE_SETTINGS" }),
    chrome.runtime.sendMessage({ type: "GET_READ_POSTS" }),
  ]);

  currentSettings = settings;
  document.getElementById("showFloatingPanelToggle").checked = currentSettings.showFloatingPanel !== false;
  document.getElementById("markReadPostsToggle").checked = currentSettings.markReadPosts !== false;
  document.getElementById("darkModeToggle").checked = currentSettings.darkModeEnabled === true;
  updateFeatureBadge();

  const badge = document.getElementById("readPostBadge");
  const count = document.getElementById("readPostCount");
  const items = readPosts.items || [];

  if (currentSettings.markReadPosts !== false) {
    badge.textContent = "활성";
    badge.className = "badge success";
  } else {
    badge.textContent = "비활성";
    badge.className = "badge";
  }

  count.textContent = `${items.length}개`;
  count.className = items.length ? "metric-value success" : "metric-value";
}

function openGgmPage(url) {
  chrome.runtime.sendMessage({ type: "OPEN_GGM_PAGE", url });
}

document.getElementById("backBtn").addEventListener("click", () => { window.location.href = "popup.html"; });
document.getElementById("featureSettingsBtn").addEventListener("click", () => { window.location.href = "site-settings.html"; });
document.getElementById("globalSettingsBtn").addEventListener("click", () => { window.location.href = "settings.html"; });
document.getElementById("openSettingsBtn").addEventListener("click", () => { window.location.href = "site-settings.html"; });
document.getElementById("openFreeboardBtn").addEventListener("click", () => openGgmPage("/town/freeboard"));
document.getElementById("showFloatingPanelToggle").addEventListener("change", saveSiteToggles);
document.getElementById("markReadPostsToggle").addEventListener("change", saveSiteToggles);
document.getElementById("darkModeToggle").addEventListener("change", saveSiteToggles);

loadSiteStatus().catch((error) => {
  console.error("사이트 화면 보조 상태 조회 실패:", error);
});
