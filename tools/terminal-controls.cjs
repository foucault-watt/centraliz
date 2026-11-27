function handleHistoryKey(dashboard, key) {
  if (key.name === 'l') { dashboard.showLogs(); return true; }
  if (key.name === 'c' && !key.ctrl) { dashboard.copyLogs(); return true; }
  if (key.name === 'pageup') { dashboard.scrollBy(10); return true; }
  if (key.name === 'pagedown') { dashboard.scrollBy(-10); return true; }
  if (key.name === 'home') { dashboard.scrollBy(5000); return true; }
  if (key.name === 'end') { dashboard.scrollOffset = 0; dashboard.render(true); return true; }
  return false;
}

function attachControls(dashboard, quit) {
  if (!dashboard.animated || !process.stdin.isTTY) return () => {};
  const previousRaw = process.stdin.isRaw;
  require('node:readline').emitKeypressEvents(process.stdin);
  const listener = (text, key = {}) => {
    if (key.ctrl && key.name === 'c') quit(); else handleHistoryKey(dashboard, key);
  };
  process.stdin.setRawMode(true); process.stdin.on('keypress', listener); process.stdin.resume();
  return () => {
    process.stdin.removeListener('keypress', listener);
    process.stdin.setRawMode(Boolean(previousRaw)); process.stdin.pause();
  };
}
module.exports = { handleHistoryKey, attachControls };
