// Activity timeline persistence.
async function saveActivity(type, title, message, url = null, meta = {}) {
  try {
    const stored = await chrome.storage.local.get(["activityTimeline"]);
    const timeline = Array.isArray(stored.activityTimeline)
      ? stored.activityTimeline
      : [];
    timeline.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      time: new Date().toISOString(),
      type,
      title,
      message,
      url,
      meta,
    });

    await chrome.storage.local.set({
      activityTimeline: timeline.slice(0, MAX_ACTIVITY_ITEMS),
    });
  } catch (error) {
    console.warn("[GGMAuto] 활동 기록 저장 실패:", error);
  }
}
