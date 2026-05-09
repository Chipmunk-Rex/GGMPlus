// Small DOM helpers shared by content modules.
function getMetaContent(name) {
  const element = document.querySelector(`meta[name="${name}"]`);
  return element ? element.getAttribute("content") : null;
}
