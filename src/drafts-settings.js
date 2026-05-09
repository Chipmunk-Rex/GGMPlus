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

async function loadDrafts() {
  const badge = document.getElementById("draftCountBadge");
  const list = document.getElementById("draftList");
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_DRAFTS" });
    const items = response.items || [];
    badge.textContent = `${items.length}개`;
    badge.className = items.length ? "badge success" : "badge";
    list.replaceChildren();
    if (!items.length) {
      list.appendChild(createEmpty("저장된 임시글이 없습니다"));
      return;
    }
    items.forEach((item) => list.appendChild(createDraftItem(item)));
  } catch (error) {
    badge.textContent = "-";
    list.replaceChildren(createEmpty("임시저장 목록을 불러오지 못했습니다"));
  }
}

function createEmpty(message) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.textContent = message;
  return element;
}

function createDraftItem(item) {
  const entry = document.createElement("div");
  entry.className = "list-item";
  const time = document.createElement("span");
  time.className = "list-time";
  time.textContent = formatDate(item.updatedAt);
  const message = document.createElement("span");
  message.className = "list-message";
  message.textContent = item.preview || item.path || item.key;
  entry.append(time, message);
  return entry;
}

async function clearDrafts() {
  if (!confirm("임시저장된 글/댓글 데이터를 모두 삭제하시겠습니까?")) return;
  await chrome.runtime.sendMessage({ type: "CLEAR_DRAFTS" });
  showToast("임시저장 데이터를 삭제했습니다");
  loadDrafts();
}

document.getElementById("backBtn").addEventListener("click", () => { window.location.href = "drafts.html"; });
document.getElementById("globalSettingsBtn").addEventListener("click", () => { window.location.href = "settings.html"; });
document.getElementById("clearDraftsBtn").addEventListener("click", clearDrafts);

loadDrafts();
