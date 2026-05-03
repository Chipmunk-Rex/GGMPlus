async function openGgmPage(url) {
  await chrome.runtime.sendMessage({ type: "OPEN_GGM_PAGE", url });
}

document.querySelectorAll("[data-url]").forEach((button) => {
  button.addEventListener("click", async () => {
    await openGgmPage(button.dataset.url);
    window.close();
  });
});

document.getElementById("backBtn").addEventListener("click", () => {
  window.location.href = "popup.html";
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  window.location.href = "settings.html";
});

document.getElementById("featureSettingsBtn").addEventListener("click", () => {
  window.location.href = "launcher-settings.html";
});
