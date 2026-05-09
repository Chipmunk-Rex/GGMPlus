const DAY_LABELS = [
  ["0", "일"],
  ["1", "월"],
  ["2", "화"],
  ["3", "수"],
  ["4", "목"],
  ["5", "금"],
  ["6", "토"],
];

const CONDITION_OPTIONS = [
  ["always", "항상"],
  ["dailyReportMissing", "일간보고서 미작성"],
  ["jobCheerUpdated", "취업 응원 업데이트"],
];

const ACTION_OPTIONS = [
  ["notify", "알림"],
  ["openPage", "페이지 열기"],
  ["fillDailyReport", "일간보고서 자동 입력"],
];

let rules = [];

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

function getRuleCard(id) {
  return document.querySelector(`[data-rule-id="${CSS.escape(id)}"]`);
}

function createCheckboxChip(name, value, label, checked) {
  const chip = document.createElement("label");
  chip.className = "chip-check";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.name = name;
  checkbox.value = value;
  checkbox.checked = checked;
  const text = document.createElement("span");
  text.textContent = label;
  chip.append(checkbox, text);
  return chip;
}

function createField(labelText, input) {
  const field = document.createElement("div");
  field.className = "field";
  const label = document.createElement("label");
  label.textContent = labelText;
  field.append(label, input);
  return field;
}

function getAction(rule, type) {
  return (rule.actions || []).find((action) => action.type === type) || { type, options: {} };
}

function syncRuleCard(card) {
  const fillChecked = card.querySelector('[name="action"][value="fillDailyReport"]').checked;
  const dailyCondition = card.querySelector('[name="condition"][value="dailyReportMissing"]');
  if (fillChecked) {
    dailyCondition.checked = true;
    dailyCondition.disabled = true;
  } else {
    dailyCondition.disabled = false;
  }

  card.querySelectorAll("[data-action-options]").forEach((box) => {
    const actionType = box.dataset.actionOptions;
    const checkbox = card.querySelector(`[name="action"][value="${actionType}"]`);
    box.classList.toggle("show", Boolean(checkbox && checkbox.checked));
  });
}

function renderRule(rule) {
  const card = document.createElement("div");
  card.className = "automation-rule-card";
  card.dataset.ruleId = rule.id;

  const head = document.createElement("div");
  head.className = "automation-rule-head";
  const titleWrap = document.createElement("label");
  titleWrap.className = "automation-rule-title";
  const enabled = document.createElement("input");
  enabled.type = "checkbox";
  enabled.dataset.field = "enabled";
  enabled.checked = rule.enabled;
  const name = document.createElement("input");
  name.className = "setting-input";
  name.dataset.field = "name";
  name.value = rule.name;
  titleWrap.append(enabled, name);
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "mini-link";
  deleteBtn.textContent = "삭제";
  deleteBtn.addEventListener("click", () => {
    rules = rules.filter((item) => item.id !== rule.id);
    renderRules();
  });
  head.append(titleWrap, deleteBtn);
  card.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "automation-rule-grid";
  const days = document.createElement("div");
  days.className = "day-row";
  const selectedDays = new Set((rule.schedule.daysOfWeek || []).map(String));
  DAY_LABELS.forEach(([value, label]) => {
    days.appendChild(createCheckboxChip("day", value, label, selectedDays.has(value)));
  });
  const time = document.createElement("input");
  time.type = "time";
  time.className = "setting-input";
  time.dataset.field = "time";
  time.value = rule.schedule.time || "21:00";
  grid.append(days, time);
  card.appendChild(grid);

  const conditionTitle = document.createElement("div");
  conditionTitle.className = "hint";
  conditionTitle.textContent = "조건";
  card.appendChild(conditionTitle);
  const conditions = document.createElement("div");
  conditions.className = "check-row";
  const selectedConditions = new Set((rule.conditions || []).map((condition) => condition.type));
  CONDITION_OPTIONS.forEach(([value, label]) => {
    conditions.appendChild(createCheckboxChip("condition", value, label, selectedConditions.has(value)));
  });
  card.appendChild(conditions);

  const actionTitle = document.createElement("div");
  actionTitle.className = "hint";
  actionTitle.textContent = "행동";
  card.appendChild(actionTitle);
  const actions = document.createElement("div");
  actions.className = "check-row";
  const selectedActions = new Set((rule.actions || []).map((action) => action.type));
  ACTION_OPTIONS.forEach(([value, label]) => {
    actions.appendChild(createCheckboxChip("action", value, label, selectedActions.has(value)));
  });
  card.appendChild(actions);

  const optionWrap = document.createElement("div");
  optionWrap.className = "action-options";

  const notify = getAction(rule, "notify");
  const notifyBox = document.createElement("div");
  notifyBox.className = "action-option-box";
  notifyBox.dataset.actionOptions = "notify";
  const notifyTitle = document.createElement("input");
  notifyTitle.className = "setting-input";
  notifyTitle.dataset.option = "notifyTitle";
  notifyTitle.value = notify.options.title || "";
  const notifyMessage = document.createElement("input");
  notifyMessage.className = "setting-input";
  notifyMessage.dataset.option = "notifyMessage";
  notifyMessage.value = notify.options.message || "";
  notifyBox.append(createField("알림 제목", notifyTitle), createField("알림 내용", notifyMessage));

  const openPage = getAction(rule, "openPage");
  const openBox = document.createElement("div");
  openBox.className = "action-option-box";
  openBox.dataset.actionOptions = "openPage";
  const openUrl = document.createElement("input");
  openUrl.className = "setting-input";
  openUrl.dataset.option = "openUrl";
  openUrl.value = openPage.options.url || "https://ggm.gondr.net/project/team/{teamId}";
  openBox.appendChild(createField("열 페이지 URL", openUrl));

  const fill = getAction(rule, "fillDailyReport");
  const fillBox = document.createElement("div");
  fillBox.className = "action-option-box";
  fillBox.dataset.actionOptions = "fillDailyReport";
  const fillContent = document.createElement("textarea");
  fillContent.className = "setting-input";
  fillContent.maxLength = 100;
  fillContent.dataset.option = "fillContent";
  fillContent.value = fill.options.content || "";
  fillBox.appendChild(createField("자동 입력할 일간보고서 내용", fillContent));
  const fillHint = document.createElement("p");
  fillHint.className = "hint";
  fillHint.textContent = "저장은 자동으로 누르지 않습니다. 페이지에 내용을 채워두고 사용자가 확인 후 저장합니다.";
  fillBox.appendChild(fillHint);

  optionWrap.append(notifyBox, openBox, fillBox);
  card.appendChild(optionWrap);

  card.addEventListener("change", () => syncRuleCard(card));
  syncRuleCard(card);
  return card;
}

function renderRules() {
  const list = document.getElementById("ruleEditorList");
  list.replaceChildren();
  rules.forEach((rule) => list.appendChild(renderRule(rule)));
  const badge = document.getElementById("ruleCountBadge");
  badge.textContent = `${rules.length}개`;
  badge.className = rules.some((rule) => rule.enabled) ? "badge success" : "badge";
}

function collectRule(card) {
  const actions = [...card.querySelectorAll('[name="action"]:checked')].map((checkbox) => {
    if (checkbox.value === "notify") {
      return {
        type: "notify",
        options: {
          title: card.querySelector('[data-option="notifyTitle"]').value,
          message: card.querySelector('[data-option="notifyMessage"]').value,
        },
      };
    }

    if (checkbox.value === "openPage") {
      return {
        type: "openPage",
        options: {
          url: card.querySelector('[data-option="openUrl"]').value,
        },
      };
    }

    return {
      type: "fillDailyReport",
      options: {
        content: card.querySelector('[data-option="fillContent"]').value,
        autoSubmit: false,
      },
    };
  });

  const conditionTypes = [...card.querySelectorAll('[name="condition"]:checked')]
    .map((checkbox) => checkbox.value);
  if (actions.some((action) => action.type === "fillDailyReport") && !conditionTypes.includes("dailyReportMissing")) {
    conditionTypes.push("dailyReportMissing");
  }

  return {
    id: card.dataset.ruleId,
    enabled: card.querySelector('[data-field="enabled"]').checked,
    name: card.querySelector('[data-field="name"]').value,
    schedule: {
      time: card.querySelector('[data-field="time"]').value,
      daysOfWeek: [...card.querySelectorAll('[name="day"]:checked')]
        .map((checkbox) => Number(checkbox.value)),
    },
    conditions: conditionTypes.map((type) => ({
      type,
      options: type === "dailyReportMissing" ? { teamId: "auto" } : {},
    })),
    actions,
  };
}

async function loadRules() {
  const response = await chrome.runtime.sendMessage({ type: "GET_AUTOMATION_RULES" });
  rules = response.rules || [];
  renderRules();
}

async function saveRules() {
  const collected = [...document.querySelectorAll("[data-rule-id]")].map(collectRule);
  const response = await chrome.runtime.sendMessage({
    type: "SAVE_AUTOMATION_RULES",
    rules: collected,
  });
  if (!response.success) {
    showToast(response.error || "자동 알림 저장 실패");
    return;
  }
  rules = response.rules;
  renderRules();
  showToast("자동 알림을 저장했습니다");
}

function addRule() {
  rules.push({
    id: `rule-${Date.now()}`,
    enabled: false,
    name: "새 자동 알림",
    schedule: {
      time: "21:00",
      daysOfWeek: [1, 2, 3, 4, 5],
    },
    conditions: [{ type: "always", options: {} }],
    actions: [{
      type: "notify",
      options: {
        title: "자동 알림",
        message: "설정한 시간이 되었습니다.",
      },
    }],
  });
  renderRules();
}

async function resetRules() {
  if (!confirm("기본 자동 알림 목록을 다시 불러오시겠습니까? 현재 수정한 규칙은 초기화됩니다.")) return;
  const response = await chrome.runtime.sendMessage({ type: "RESET_AUTOMATION_RULES" });
  if (response.success) {
    rules = response.rules;
    renderRules();
    showToast("기본 자동 알림을 복구했습니다");
  }
}

document.getElementById("backBtn").addEventListener("click", () => { window.location.href = "automation.html"; });
document.getElementById("globalSettingsBtn").addEventListener("click", () => { window.location.href = "settings.html"; });
document.getElementById("addRuleBtn").addEventListener("click", addRule);
document.getElementById("resetRulesBtn").addEventListener("click", resetRules);
document.getElementById("saveBtn").addEventListener("click", saveRules);

loadRules().catch((error) => {
  console.error("자동 알림 설정 조회 실패:", error);
});
