// Background runtime configuration.

const ATTENDANCE_CONFIG = {
  url: "https://ggm.gondr.net/api/town/goldbox/attendance",
  method: "POST",
  // 요청 본문 (빈 객체)
  body: JSON.stringify({}),
  contentType: "application/json",
};

// 📌 알람 설정 (기본값)
const DEFAULT_ALARM_CONFIG = {
  name: "attendanceAlarm",
  dailyAlarmName: "dailyMidnightAlarm",
  initialCheckName: "initialAttendanceCheck",
  delayInMinutes: 1,
  periodInMinutes: 1440, // 24시간 (하루에 한 번)
};

const UTILITY_MONITOR_ALARM_NAME = "utilityMonitorAlarm";
const AUTOMATION_ALARM_PREFIX = "automationRule:";
const MISSION_ALARM_NAME = "missionAutomationAlarm";
const REWARD_ALARM_NAME = "rewardAutomationAlarm";
const MAX_ACTIVITY_ITEMS = 120;
const HOME_FEATURE_IDS = [
  "attendance",
  "mission",
  "reward",
  "launcher",
  "alerts",
  "automation",
  "drafts",
  "site",
  "settings",
];
const QUICK_LINK_IDS = [
  "freeboard",
  "quest",
  "market",
  "shop",
  "circle",
  "project",
  "graduate",
  "portfolio",
  "user",
];

const CONDITION_TYPES = ["always", "dailyReportMissing", "jobCheerUpdated"];
const ACTION_TYPES = ["notify", "openPage", "fillDailyReport"];
const DEFAULT_DAILY_REPORT_URL = "https://ggm.gondr.net/project/team/{teamId}";
const DEFAULT_MISSION_SETTINGS = {
  autoMissionEnabled: false,
  missionIntervalMinutes: 60,
  missionRunTime: "",
  enablePortfolioVisitMission: true,
  portfolioVisitUserId: 1,
  enablePortfolioRate: true,
  portfolioRatePortfolioId: 2551,
  portfolioRateScore: 5,
  portfolioRateComment: "",
  enableCheerComment: true,
  cheerTargetUserId: 1,
  cheerContent: "응원합니다!",
};
const DEFAULT_REWARD_SETTINGS = {
  autoRewardEnabled: false,
  rewardIntervalMinutes: 60,
  rewardRunTime: "",
  rewardClaimDailyMissions: true,
  rewardClaimWeeklyMissions: true,
  rewardClaimMailbox: true,
};
const DEFAULT_AUTOMATION_RULES = [
  {
    id: "daily-report-reminder",
    enabled: false,
    name: "일간보고서 작성 알림",
    schedule: {
      time: "21:00",
      daysOfWeek: [1, 2, 3, 4, 5],
    },
    conditions: [
      {
        type: "dailyReportMissing",
        options: {
          teamId: "auto",
        },
      },
    ],
    actions: [
      {
        type: "notify",
        options: {
          title: "일간보고서 작성 필요",
          message: "오늘 일간보고서를 아직 작성하지 않았습니다.",
        },
      },
    ],
  },
  {
    id: "daily-report-helper",
    enabled: false,
    name: "일간보고서 작성 도우미",
    schedule: {
      time: "22:00",
      daysOfWeek: [1, 2, 3, 4, 5],
    },
    conditions: [
      {
        type: "dailyReportMissing",
        options: {
          teamId: "auto",
        },
      },
    ],
    actions: [
      {
        type: "notify",
        options: {
          title: "일간보고서 작성 시간",
          message: "작성 페이지를 열고 미리 입력한 내용을 채워둘게요.",
        },
      },
      {
        type: "openPage",
        options: {
          url: DEFAULT_DAILY_REPORT_URL,
        },
      },
      {
        type: "fillDailyReport",
        options: {
          content: "오늘 졸업작품 개발을 진행했습니다.",
          autoSubmit: false,
        },
      },
    ],
  },
  {
    id: "job-cheer-midday",
    enabled: false,
    name: "낮 취업 응원 확인",
    schedule: {
      time: "12:30",
      daysOfWeek: [1, 2, 3, 4, 5],
    },
    conditions: [
      {
        type: "jobCheerUpdated",
        options: {},
      },
    ],
    actions: [
      {
        type: "notify",
        options: {
          title: "취업 응원이 업데이트됐어요",
          message: "내 프로필에 새로운 취업 응원이 올라왔습니다.",
        },
      },
      {
        type: "openPage",
        options: {
          url: "/user",
        },
      },
    ],
  },
];

const DEFAULT_FEATURE_SETTINGS = {
  utilityMonitorIntervalMinutes: 15,
  markReadPosts: true,
  showFloatingPanel: true,
  darkModeEnabled: false,
  homeFeatureOrder: HOME_FEATURE_IDS,
  hiddenHomeFeatures: [],
  favoriteQuickLinks: ["freeboard", "quest", "market", "shop"],
  notifyNewPosts: true,
  notifyGoldboxQuest: true,
  notifyStockWatch: true,
  watchedBoardCategories: ["free"],
  watchedCirclePostIds: [],
  stockWatchCircleIds: [],
};

const GGM_PAGE_REQUEST_TIMEOUT_MS = 15000;
const GGM_CONTENT_READY_RETRIES = 8;
const GGM_CONTENT_READY_DELAY_MS = 500;

function extractArray(data, candidates) {
  if (Array.isArray(data)) return data;

  for (const key of candidates) {
    const value = data && data[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function extractPosts(data) {
  const posts = data && data.posts;
  if (Array.isArray(posts)) return posts;
  if (posts && Array.isArray(posts.data)) return posts.data;
  if (posts && Array.isArray(posts.list)) return posts.list;
  return [];
}

function getMaxNumericId(items) {
  return Math.max(0, ...items.map((item) => Number(item.id)).filter(Number.isFinite));
}

function isOpenFlag(value) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "Y";
}

function isQuestFull(quest) {
  const maxUser = Number(quest.max_user || quest.maxUser || 0);
  if (!maxUser) return false;

  if (Array.isArray(quest.users)) {
    return quest.users.length >= maxUser;
  }

  const count = Number(quest.user_count || quest.count || 0);
  return count >= maxUser;
}

function normalizeStockValue(stock) {
  if (stock && typeof stock === "object") {
    const candidate =
      stock.price ??
      stock.current ??
      stock.value ??
      stock.point ??
      stock.amount ??
      stock.count;
    return Number.isFinite(Number(candidate)) ? Number(candidate) : JSON.stringify(stock);
  }

  return Number.isFinite(Number(stock)) ? Number(stock) : String(stock ?? "");
}

const TOKEN_REFRESH_CONFIG = {
  // 토큰 갱신을 위해 열 페이지 URL
  refreshUrl: "https://ggm.gondr.net",
  // 탭이 토큰을 수집할 때까지 대기 시간 (밀리초)
  waitTime: 5000,
  // 자동 갱신 활성화
  autoRefresh: true,
};

// ============================================
// 🔐 토큰 관리 함수
// ============================================

/**
 * 저장된 Bearer 토큰 가져오기
 */
