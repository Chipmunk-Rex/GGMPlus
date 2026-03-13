const ext = globalThis.browser ?? globalThis.chrome;

async function updateStatus() {
  try {
    const response = await ext.runtime.sendMessage({ type: "GET_STATUS" });

    const loginStatus = document.getElementById("loginStatus");
    const loginBtn = document.getElementById("loginBtn");
    const checkBtn = document.getElementById("checkBtn");
    const todayStatus = document.getElementById("todayStatus");
    const lastSuccess = document.getElementById("lastSuccess");

    if (response.hasToken && response.userName) {
      loginStatus.textContent = response.userName;
      loginStatus.className = "status-value success";
      loginBtn.style.display = "none";
      checkBtn.disabled = false;
    } else if (response.hasToken) {
      loginStatus.textContent = "Logged in";
      loginStatus.className = "status-value success";
      loginBtn.style.display = "none";
      checkBtn.disabled = false;
    } else {
      loginStatus.textContent = "Login required";
      loginStatus.className = "status-value error";
      loginBtn.style.display = "block";
      checkBtn.disabled = true;
    }

    if (response.todayChecked) {
      todayStatus.textContent = "Completed";
      todayStatus.className = "status-value success";
      checkBtn.textContent = "Attendance already completed";
      checkBtn.disabled = true;
    } else if (response.hasToken) {
      todayStatus.textContent = "Pending";
      todayStatus.className = "status-value pending";
      checkBtn.textContent = "Run attendance now";
      checkBtn.disabled = false;
    } else {
      todayStatus.textContent = "-";
      todayStatus.className = "status-value";
      checkBtn.textContent = "Run attendance now";
    }

    lastSuccess.textContent = response.lastSuccess
      ? formatDate(response.lastSuccess)
      : "-";
  } catch (error) {
    console.error("[GGMPlus] Failed to load popup status:", error);
  }
}

function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return "Just now";
  }

  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}m ago`;
  }

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function manualCheck() {
  const button = document.getElementById("checkBtn");
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span>Running...';

  try {
    const response = await ext.runtime.sendMessage({ type: "MANUAL_ATTENDANCE" });

    if (response.success) {
      button.textContent = response.alreadyChecked
        ? "Already completed today"
        : "Attendance succeeded";
    } else {
      button.textContent = "Attendance failed";
    }
  } catch (error) {
    button.textContent = "Unexpected error";
  }

  setTimeout(() => {
    updateStatus();
  }, 1500);
}

function goToLogin() {
  ext.tabs.create({ url: "https://ggm.gondr.net/user/login" });
  window.close();
}

function goToSettings() {
  window.location.href = "settings.html";
}

function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const tabId = button.dataset.tab;

      tabButtons.forEach((item) => item.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(`tab-${tabId}`).classList.add("active");
      await ext.storage.local.set({ lastTab: tabId });
    });
  });

  ext.storage.local.get(["lastTab"]).then((result) => {
    if (!result.lastTab) {
      return;
    }

    const savedButton = document.querySelector(`[data-tab="${result.lastTab}"]`);
    if (savedButton) {
      savedButton.click();
    }
  });
}

document.getElementById("checkBtn").addEventListener("click", manualCheck);
document.getElementById("loginBtn").addEventListener("click", goToLogin);
document.getElementById("settingsBtn").addEventListener("click", goToSettings);

initTabs();
updateStatus();
