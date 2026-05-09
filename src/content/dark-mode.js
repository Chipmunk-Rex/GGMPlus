// Site dark-mode helper.
let darkModeStarted = false;

function ensureDarkModeStyle() {
  if (document.getElementById("ggmplus-dark-mode-style")) return;

  const style = document.createElement("style");
  style.id = "ggmplus-dark-mode-style";
  style.textContent = `
    html.ggmplus-dark-mode,
    html.ggmplus-dark-mode body {
      color-scheme: dark;
      background: #0b1020 !important;
      color: #e5edf8 !important;
    }
    html.ggmplus-dark-mode body {
      background:
        radial-gradient(circle at top left, rgba(52, 91, 218, 0.14), transparent 34rem),
        #0b1020 !important;
    }
    html.ggmplus-dark-mode :is(main, section, article, aside, nav, form, table, thead, tbody, tr, td, th, ul, li),
    html.ggmplus-dark-mode :is(.container, .content, .contents, .wrap, .wrapper, .panel, .box, .card, .board, .table, .list, .item) {
      border-color: #263449 !important;
      color: #e5edf8 !important;
    }
    html.ggmplus-dark-mode :is(.container, .content, .contents, .wrap, .wrapper, .panel, .box, .card, .board, .table, table, input, textarea, select) {
      background-color: #121a2b !important;
    }
    html.ggmplus-dark-mode :is(td, th, li, .item, .list-item) {
      background-color: transparent !important;
    }
    html.ggmplus-dark-mode :is(input, textarea, select) {
      border-color: #33445f !important;
      color: #e5edf8 !important;
    }
    html.ggmplus-dark-mode :is(input, textarea, select)::placeholder {
      color: #8fa0b8 !important;
    }
    html.ggmplus-dark-mode a {
      color: #84a7ff !important;
    }
    html.ggmplus-dark-mode hr,
    html.ggmplus-dark-mode :is(td, th, tr) {
      border-color: #263449 !important;
    }
    html.ggmplus-dark-mode .ggmplus-read-post-row,
    html.ggmplus-dark-mode .ggmplus-read-post-row a,
    html.ggmplus-dark-mode a.ggmplus-read-post-link {
      color: #7f8ea3 !important;
    }
    html.ggmplus-dark-mode .ggmplus-read-post-row {
      background: rgba(148, 163, 184, 0.10) !important;
    }
    html.ggmplus-dark-mode .ggmplus-floating-root,
    html.ggmplus-dark-mode .ggmplus-floating-root * {
      color-scheme: light;
    }
  `;
  document.documentElement.appendChild(style);
}

async function applyDarkModeSetting() {
  const stored = await chrome.storage.local.get(["darkModeEnabled"]);
  ensureDarkModeStyle();
  document.documentElement.classList.toggle("ggmplus-dark-mode", stored.darkModeEnabled === true);
}

function startDarkModeManager() {
  if (darkModeStarted) return;
  darkModeStarted = true;
  applyDarkModeSetting();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.darkModeEnabled) {
      applyDarkModeSetting();
    }
  });
}

// ============================================
// 사이트 플로팅 도구함
// ============================================
