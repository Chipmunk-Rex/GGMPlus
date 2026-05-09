// Board, quest, goldbox, and stock monitoring.

function getUtilityStateDefaults() {
  return {
    boardLastIds: {},
    circlePostLastIds: {},
    questSignature: null,
    goldboxReminderDate: null,
    stockSnapshots: {},
  };
}

async function getUtilityState() {
  const stored = await chrome.storage.local.get(["utilityMonitorState"]);
  return {
    ...getUtilityStateDefaults(),
    ...(stored.utilityMonitorState || {}),
  };
}

async function setUtilityState(state) {
  await chrome.storage.local.set({ utilityMonitorState: state });
}

async function monitorBoardPosts(settings, state, summary) {
  if (!settings.notifyNewPosts) return;

  const nextLastIds = { ...(state.boardLastIds || {}) };

  for (const category of settings.watchedBoardCategories) {
    const data = await requestGgmApi(
      `/api/town/freeboard?category=${encodeURIComponent(category)}&page=1`,
    );
    const list = extractArray(data, ["list", "data"]);
    const maxId = getMaxNumericId(list);
    const previousMaxId = Number(nextLastIds[category] || 0);

    if (previousMaxId > 0 && maxId > previousMaxId) {
      const newItems = list.filter((item) => Number(item.id) > previousMaxId);
      const newest = newItems[0] || list[0] || {};
      const title = newest.title || `${category} 게시판 새 글`;
      const message = `${category} 게시판에 새 글 ${newItems.length}개가 올라왔습니다.`;
      await createNotificationWithUrl("새 게시글", message, "/town/freeboard");
      await saveActivity("post", "새 게시글", `${message}\n${title}`, "/town/freeboard", {
        category,
        count: newItems.length,
      });
      summary.notifications += 1;
    }

    if (maxId > previousMaxId) {
      nextLastIds[category] = maxId;
    }
  }

  state.boardLastIds = nextLastIds;
}

async function monitorCirclePosts(settings, state, summary) {
  if (!settings.notifyNewPosts || settings.watchedCirclePostIds.length === 0) return;

  const nextLastIds = { ...(state.circlePostLastIds || {}) };

  for (const circleId of settings.watchedCirclePostIds) {
    const data = await requestGgmApi(`/api/circle/${circleId}/posts`);
    const list = extractPosts(data);
    const maxId = getMaxNumericId(list);
    const previousMaxId = Number(nextLastIds[circleId] || 0);

    if (previousMaxId > 0 && maxId > previousMaxId) {
      const newItems = list.filter((item) => Number(item.id) > previousMaxId);
      const message = `동아리 ${circleId}에 새 글 ${newItems.length}개가 올라왔습니다.`;
      const url = `/circle/info/${circleId}`;
      await createNotificationWithUrl("동아리 새 글", message, url);
      await saveActivity("circle-post", "동아리 새 글", message, url, {
        circleId,
        count: newItems.length,
      });
      summary.notifications += 1;
    }

    if (maxId > previousMaxId) {
      nextLastIds[circleId] = maxId;
    }
  }

  state.circlePostLastIds = nextLastIds;
}

async function monitorGoldboxAndQuest(settings, state, summary) {
  if (!settings.notifyGoldboxQuest) return;

  const today = getSiteDateKey();

  if (state.goldboxReminderDate !== today) {
    const goldbox = await requestGgmApi("/api/town/goldbox");
    const list = extractArray(goldbox, ["list", "data"]);

    if (list.length > 0) {
      await createNotificationWithUrl(
        "골드박스 확인",
        "오늘 확인할 골드박스 정보가 있습니다.",
        "/town",
      );
      await saveActivity(
        "goldbox",
        "골드박스 확인",
        "오늘 확인할 골드박스 정보가 있습니다.",
        "/town",
      );
      summary.notifications += 1;
      state.goldboxReminderDate = today;
    }
  }

  const questData = await requestGgmApi("/api/town/quest");
  const quests = extractArray(questData, ["quests", "list", "data"]);
  const availableQuests = quests.filter((quest) => isOpenFlag(quest.open) && !isQuestFull(quest));
  const signature = availableQuests
    .map((quest) => `${quest.id}:${Array.isArray(quest.users) ? quest.users.length : quest.count || 0}`)
    .join("|");

  if (state.questSignature !== null && signature && signature !== state.questSignature) {
    const message = `참여 가능한 퀘스트 ${availableQuests.length}개를 확인해보세요.`;
    await createNotificationWithUrl("퀘스트 알림", message, "/town/quest");
    await saveActivity("quest", "퀘스트 알림", message, "/town/quest", {
      questIds: availableQuests.map((quest) => quest.id),
    });
    summary.notifications += 1;
  }

  state.questSignature = signature;
}

async function monitorStockWatch(settings, state, summary) {
  if (!settings.notifyStockWatch || settings.stockWatchCircleIds.length === 0) return;

  const market = await requestGgmApi("/api/stock/market");
  const circles = extractArray(market, ["circles", "list", "data"]);
  const snapshots = { ...(state.stockSnapshots || {}) };

  for (const circleId of settings.stockWatchCircleIds) {
    const circle = circles.find((item) => Number(item.id) === Number(circleId));
    if (!circle) continue;

    const nextSnapshot = {
      name: circle.name || `동아리 ${circleId}`,
      stock: normalizeStockValue(circle.stock),
      gold: Number.isFinite(Number(circle.gold)) ? Number(circle.gold) : null,
      updatedAt: new Date().toISOString(),
    };
    const previous = snapshots[circleId];

    if (
      previous &&
      (previous.stock !== nextSnapshot.stock || previous.gold !== nextSnapshot.gold)
    ) {
      const message = `${nextSnapshot.name} 주식 정보가 변경되었습니다.`;
      await createNotificationWithUrl("주식 관심 알림", message, "/town/market");
      await saveActivity("stock", "주식 관심 알림", message, "/town/market", {
        circleId,
        previous,
        next: nextSnapshot,
      });
      summary.notifications += 1;
    }

    snapshots[circleId] = nextSnapshot;
  }

  state.stockSnapshots = snapshots;
}

async function runUtilityMonitor(options = {}) {
  const settings = await getFeatureSettings();
  const summary = {
    notifications: 0,
    errors: [],
    checkedAt: new Date().toISOString(),
  };

  if (!hasEnabledUtilityMonitor(settings)) {
    return summary;
  }

  const state = await getUtilityState();
  const monitors = [
    () => monitorBoardPosts(settings, state, summary),
    () => monitorCirclePosts(settings, state, summary),
    () => monitorGoldboxAndQuest(settings, state, summary),
    () => monitorStockWatch(settings, state, summary),
  ];

  for (const monitor of monitors) {
    try {
      await monitor();
    } catch (error) {
      console.warn("[GGMAuto] 유틸리티 모니터 실패:", error);
      summary.errors.push(error.message || String(error));
    }
  }

  await setUtilityState(state);

  if (options.manual) {
    const message = summary.errors.length
      ? `확인 완료, 오류 ${summary.errors.length}건`
      : `확인 완료, 알림 ${summary.notifications}건`;
    await saveActivity("monitor", "수동 모니터링", message, null, summary);
  }

  return summary;
}

// 📌 현재 알람 설정 가져오기

async function setupUtilityMonitorAlarm(config) {
  const settings = config || await getFeatureSettings();

  await chrome.alarms.clear(UTILITY_MONITOR_ALARM_NAME);
  if (!hasEnabledUtilityMonitor(settings)) {
    console.log("[GGMAuto] 유틸리티 모니터 알람 비활성화");
    return;
  }

  const interval = Math.max(5, Number(settings.utilityMonitorIntervalMinutes) || 15);
  await chrome.alarms.create(UTILITY_MONITOR_ALARM_NAME, {
    delayInMinutes: Math.min(5, interval),
    periodInMinutes: interval,
  });

  console.log(`[GGMAuto] 유틸리티 모니터 알람 설정: ${interval}분마다 반복`);
}
