// Shared constants for the extension runtime.

const TARGET_DOMAIN = "ggm.gondr.net";
const SITE_TIME_ZONE = "Asia/Seoul";

// 📌 출석체크 API 설정

function getSiteDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
