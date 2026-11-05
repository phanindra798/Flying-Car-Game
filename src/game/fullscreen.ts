/** User-initiated fullscreen only; normal play remains available when unsupported. */
export function setupFullscreen(onExit: () => void) {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-fullscreen]')];
  const messages = [...document.querySelectorAll<HTMLElement>('[data-fullscreen-status]')];
  const supported = !!document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function';
  let busy = false, wasFullscreen = !!document.fullscreenElement;
  const message = (text: string) => messages.forEach(node => { node.textContent = text; });
  const sync = () => {
    const active = !!document.fullscreenElement;
    for (const button of buttons) {
      button.disabled = busy || !supported;
      button.textContent = active ? 'Exit fullscreen' : 'Play fullscreen';
      button.setAttribute('aria-pressed', String(active));
    }
  };
  if (!supported) message('Fullscreen is unavailable in this browser. You can keep playing in this window.');
  for (const button of buttons) button.addEventListener('click', async () => {
    if (busy || !supported) return;
    busy = true; sync(); message('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { message('Fullscreen could not change. Try again, or keep playing in this window.'); }
    finally { busy = false; sync(); }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = !!document.fullscreenElement;
    if (wasFullscreen && !active) onExit();
    wasFullscreen = active; sync();
  });
  sync();
}
