function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function createEmpty(message) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.textContent = message;
  return element;
}

function createReadPostItem(item) {
  const entry = document.createElement("div");
  entry.className = "list-item";
  const time = document.createElement("span");
  time.className = "list-time";
  time.textContent = formatDate(item.readAt);
  const message = document.createElement("span");
  message.className = "list-message";
  message.textContent = item.title || item.path || item.key;
  entry.append(time, message);
  return entry;
}

async function loadReadPosts() {
  const badge = document.getElementById("readPostCountBadge");
  const list = document.getElementById("readPostList");
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_READ_POSTS" });
    const items = response.items || [];
    items.sort((a, b) => new Date(b.readAt || 0) - new Date(a.readAt || 0));
    badge.textContent = `${items.length}개`;
    badge.className = items.length ? "badge success" : "badge";
    list.replaceChildren();
    if (!items.length) {
      list.appendChild(createEmpty("읽은 글 기록이 없습니다"));
      return;
    }
    items.slice(0, 12).forEach((item) => list.appendChild(createReadPostItem(item)));
  } catch (error) {
    badge.textContent = "-";
    list.replaceChildren(createEmpty("읽음 기록을 불러오지 못했습니다"));
  }
}

async function clearReadPosts() {
  if (!confirm("자유게시판 읽음 기록을 모두 삭제하시겠습니까?")) return;
  await chrome.runtime.sendMessage({ type: "CLEAR_READ_POSTS" });
  showToast("읽음 기록을 삭제했습니다");
  loadReadPosts();
}

document.getElementById("backBtn").addEventListener("click", () => { window.location.href = "site.html"; });
document.getElementById("globalSettingsBtn").addEventListener("click", () => { window.location.href = "settings.html"; });
document.getElementById("clearReadPostsBtn").addEventListener("click", clearReadPosts);

loadReadPosts();
