function formatResult(rule) {
  if (!rule.lastRunAt) return "아직 실행 전";
  const date = new Date(rule.lastRunAt);
  const time = Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const result = rule.lastResult && rule.lastResult.executed ? "실행됨" : "조건 불일치";
  return `${time} · ${result}`;
}

function describeRule(rule) {
  const conditionCount = (rule.conditions || []).length;
  const actionCount = (rule.actions || []).length;
  return `${rule.schedule.time} · 조건 ${conditionCount}개 · 행동 ${actionCount}개`;
}

function createRuleItem(rule) {
  const item = document.createElement("div");
  item.className = "list-item";
  const time = document.createElement("span");
  time.className = "list-time";
  time.textContent = rule.enabled ? "켜짐" : "꺼짐";
  const message = document.createElement("span");
  message.className = "list-message";
  message.textContent = `${rule.name} - ${describeRule(rule)} - ${formatResult(rule)}`;
  item.append(time, message);
  item.addEventListener("click", () => {
    window.location.href = "automation-settings.html";
  });
  return item;
}

async function loadAutomationPage() {
  const response = await chrome.runtime.sendMessage({ type: "GET_AUTOMATION_RULES" });
  const rules = response.rules || [];
  const activeCount = rules.filter((rule) => rule.enabled).length;

  const badge = document.getElementById("automationBadge");
  badge.textContent = activeCount ? `${activeCount}개 켜짐` : "꺼짐";
  badge.className = activeCount ? "badge success" : "badge";

  document.getElementById("activeRuleCount").textContent = `${activeCount}개`;
  document.getElementById("activeRuleCount").className = activeCount ? "metric-value success" : "metric-value";
  document.getElementById("totalRuleCount").textContent = `${rules.length}개`;

  const list = document.getElementById("automationList");
  list.replaceChildren();
  if (!rules.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "자동 알림이 없습니다";
    list.appendChild(empty);
    return;
  }

  rules.forEach((rule) => list.appendChild(createRuleItem(rule)));
}

document.getElementById("backBtn").addEventListener("click", () => { window.location.href = "popup.html"; });
document.getElementById("featureSettingsBtn").addEventListener("click", () => { window.location.href = "automation-settings.html"; });
document.getElementById("globalSettingsBtn").addEventListener("click", () => { window.location.href = "settings.html"; });

loadAutomationPage().catch((error) => {
  console.error("자동 알림 조회 실패:", error);
});
