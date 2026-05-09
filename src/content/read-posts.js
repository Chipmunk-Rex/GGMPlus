// Freeboard read-post marking.
const READ_POSTS_KEY = "ggmReadPosts";
const READ_POSTS_MAX_ITEMS = 600;
let readPostManagerStarted = false;
let readPostEnabled = true;
let cachedReadPosts = {};
let lastReadPostPath = "";

function isFreeboardListPath(pathname = location.pathname) {
  return /^\/town\/freeboard(?:\/\d+)?\/?$/.test(pathname);
}

function isFreeboardPostPath(pathname = location.pathname) {
  return /\/town\/freeboard\/view\/\d+/.test(pathname);
}

function getFreeboardPostKey(urlLike) {
  try {
    const url = new URL(urlLike, location.origin);
    const match = url.pathname.match(/\/town\/freeboard\/view\/(\d+)/);
    return match ? `/town/freeboard/view/${match[1]}` : null;
  } catch (error) {
    return null;
  }
}

function ensureReadPostStyle() {
  if (document.getElementById("ggmplus-read-post-style")) return;

  const style = document.createElement("style");
  style.id = "ggmplus-read-post-style";
  style.textContent = `
    .ggmplus-read-post-row,
    .ggmplus-read-post-row a,
    a.ggmplus-read-post-link {
      color: #8b929f !important;
    }
    .ggmplus-read-post-row a,
    a.ggmplus-read-post-link {
      text-decoration-color: #c5cad3 !important;
    }
    .ggmplus-read-post-row {
      background: rgba(148, 163, 184, 0.08) !important;
    }
  `;
  document.documentElement.appendChild(style);
}

function findPostRow(link) {
  const tableRow = link.closest("tr");
  if (tableRow) return tableRow;

  const listItem = link.closest("li");
  if (listItem) return listItem;

  let current = link;
  for (let depth = 0; depth < 4 && current.parentElement; depth += 1) {
    const parent = current.parentElement;
    const links = parent.querySelectorAll("a[href*='/town/freeboard/view/']");
    const textLength = parent.textContent.trim().length;
    if (links.length <= 2 && textLength > link.textContent.trim().length + 2) {
      return parent;
    }
    current = parent;
  }

  return link;
}

async function loadReadPostState() {
  const stored = await chrome.storage.local.get([READ_POSTS_KEY, "markReadPosts"]);
  readPostEnabled = stored.markReadPosts !== false;
  cachedReadPosts = stored[READ_POSTS_KEY] || {};
}

function trimReadPosts(readPosts) {
  return Object.fromEntries(
    Object.entries(readPosts)
      .sort((a, b) => new Date(b[1].readAt || 0) - new Date(a[1].readAt || 0))
      .slice(0, READ_POSTS_MAX_ITEMS),
  );
}

async function writeReadPosts(readPosts) {
  cachedReadPosts = trimReadPosts(readPosts);
  await chrome.storage.local.set({ [READ_POSTS_KEY]: cachedReadPosts });
}

async function markReadPost(key, title = "") {
  if (!readPostEnabled || !key) return;
  if (cachedReadPosts[key]) return;

  await writeReadPosts({
    ...cachedReadPosts,
    [key]: {
      key,
      path: key,
      title: title.replace(/\s+/g, " ").trim().slice(0, 120),
      readAt: new Date().toISOString(),
    },
  });
}

function clearReadPostMarks() {
  document.querySelectorAll(".ggmplus-read-post-row").forEach((element) => {
    element.classList.remove("ggmplus-read-post-row");
  });
  document.querySelectorAll(".ggmplus-read-post-link").forEach((element) => {
    element.classList.remove("ggmplus-read-post-link");
  });
}

function bindReadPostLink(link) {
  if (link.dataset.ggmplusReadBound === "1") return;
  link.dataset.ggmplusReadBound = "1";

  const handler = () => {
    const key = getFreeboardPostKey(link.href);
    if (key) {
      markReadPost(key, link.textContent || "");
      link.classList.add("ggmplus-read-post-link");
      findPostRow(link).classList.add("ggmplus-read-post-row");
    }
  };

  link.addEventListener("pointerdown", handler);
  link.addEventListener("click", handler);
  link.addEventListener("auxclick", handler);
  link.addEventListener("keydown", (event) => {
    if (event.key === "Enter") handler();
  });
}

function applyReadPostMarks() {
  if (!readPostEnabled) {
    clearReadPostMarks();
    return;
  }

  if (!isFreeboardListPath()) {
    clearReadPostMarks();
    return;
  }

  ensureReadPostStyle();
  const links = document.querySelectorAll("a[href*='/town/freeboard/view/']");
  links.forEach((link) => {
    const key = getFreeboardPostKey(link.href);
    if (!key) return;

    bindReadPostLink(link);
    const isRead = Boolean(cachedReadPosts[key]);
    link.classList.toggle("ggmplus-read-post-link", isRead);
    findPostRow(link).classList.toggle("ggmplus-read-post-row", isRead);
  });
}

async function refreshReadPostMarks() {
  await loadReadPostState();
  if (!readPostEnabled) {
    clearReadPostMarks();
    return;
  }

  if (isFreeboardPostPath()) {
    const key = getFreeboardPostKey(location.href);
    await markReadPost(key, document.title || "");
  }

  applyReadPostMarks();
}

function startReadPostManager() {
  if (readPostManagerStarted) return;
  readPostManagerStarted = true;

  lastReadPostPath = location.pathname + location.search;
  refreshReadPostMarks();

  const observer = new MutationObserver(() => {
    applyReadPostMarks();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  setInterval(() => {
    const currentPath = location.pathname + location.search;
    if (currentPath !== lastReadPostPath) {
      lastReadPostPath = currentPath;
      refreshReadPostMarks();
    }
  }, 1000);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === "local" &&
      (changes.markReadPosts || changes[READ_POSTS_KEY])
    ) {
      refreshReadPostMarks();
    }
  });
}

// ============================================
// 사이트 다크모드
// ============================================
