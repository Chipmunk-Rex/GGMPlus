async function loadDraftSummary() {
  const count = document.getElementById("draftCount");
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_DRAFTS" });
    count.textContent = `${(response.items || []).length}개`;
  } catch (error) {
    count.textContent = "-";
  }
}

document.getElementById("backBtn").addEventListener("click", () => { window.location.href = "popup.html"; });
document.getElementById("featureSettingsBtn").addEventListener("click", () => { window.location.href = "drafts-settings.html"; });
document.getElementById("globalSettingsBtn").addEventListener("click", () => { window.location.href = "settings.html"; });

loadDraftSummary();
