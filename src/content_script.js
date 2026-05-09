// Content script entrypoint. Feature modules are loaded by manifest content_scripts in order.
function startGgmPlusContentFeatures() {
  startTokenWatcher();
  startDraftManager();
  startReadPostManager();
  startDarkModeManager();
  startFloatingPanel();
  startDailyReportFillManager();
}

if (document.readyState === "complete") {
  startGgmPlusContentFeatures();
} else {
  window.addEventListener("load", startGgmPlusContentFeatures);
}

console.log("[GGMAuto Content] Content script loaded:", window.location.hostname);
