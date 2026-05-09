// URL helpers for GGM pages.
function toGgmUrl(pathOrUrl) {
  if (!pathOrUrl) return `https://${TARGET_DOMAIN}`;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = String(pathOrUrl).startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `https://${TARGET_DOMAIN}${path}`;
}

async function openGgmPage(pathOrUrl) {
  await chrome.tabs.create({ url: toGgmUrl(pathOrUrl) });
}
