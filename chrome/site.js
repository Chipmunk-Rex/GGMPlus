async function loadSiteStatus() {
  const [settings, readPosts] = await Promise.all([
    chrome.runtime.sendMessage({ type: "GET_FEATURE_SETTINGS" }),
    chrome.runtime.sendMessage({ type: "GET_READ_POSTS" }),
  ]);

  const badge = document.getElementById("readPostBadge");
  const count = document.getElementById("readPostCount");
  const items = readPosts.items || [];

  if (settings.markReadPosts) {
    badge.textContent = "켜짐";
    badge.className = "badge success";
  } else {
    badge.textContent = "꺼짐";
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

loadSiteStatus().catch((error) => {
  console.error("사이트 화면 보조 상태 조회 실패:", error);
});
