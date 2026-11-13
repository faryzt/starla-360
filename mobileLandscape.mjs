export function isMobileEnvironment(env = {}) {
  const {
    userAgent = '',
    maxTouchPoints = 0,
    innerWidth = 0,
    innerHeight = 0,
    hasCoarsePointer = false,
    hasAnyCoarsePointer = false,
  } = env;

  const uaMobile =
    /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent) ||
    (/iPad/i.test(userAgent) && Math.min(innerWidth || 9999, innerHeight || 9999) <= 900);

  const minDim = Math.min(Number(innerWidth) || 0, Number(innerHeight) || 0);
  const maxDim = Math.max(Number(innerWidth) || 0, Number(innerHeight) || 0);
  const touchCapable = Boolean(hasCoarsePointer || hasAnyCoarsePointer || maxTouchPoints > 0);

  const smallTouchViewport = touchCapable && minDim > 0 && minDim <= 600 && maxDim <= 1024;
  return Boolean(uaMobile || smallTouchViewport);
}

export function computeStageLayout({ innerWidth, innerHeight, isMobile = false } = {}) {
  const w = Math.max(1, Number(innerWidth) || 1);
  const h = Math.max(1, Number(innerHeight) || 1);
  const isPortrait = h > w;
  const mobile = Boolean(isMobile);
  const autoRotateLandscape = mobile && isPortrait;
  const stageWidth = autoRotateLandscape ? h : w;
  const stageHeight = autoRotateLandscape ? w : h;

  return {
    isMobile: mobile,
    isPortrait,
    autoRotateLandscape,
    isMobileLandscape: mobile && !isPortrait,
    stageWidth,
    stageHeight,
  };
}

export function mapClientPointToStage(clientX, clientY, { autoRotateLandscape = false, viewportWidth = 0 } = {}) {
  if (!autoRotateLandscape) {
    return { x: clientX, y: clientY };
  }
  return {
    x: clientY,
    y: viewportWidth - clientX,
  };
}

export function mapClientDeltaToStage(dx, dy, { autoRotateLandscape = false } = {}) {
  if (!autoRotateLandscape) {
    return { dx, dy };
  }
  return {
    dx: dy,
    dy: -dx,
  };
}

export function mapRectPointToCanvas(
  clientX,
  clientY,
  rect,
  canvasWidth,
  canvasHeight,
  { autoRotateLandscape = false } = {}
) {
  if (!rect || !rect.width || !rect.height) {
    return { x: 0, y: 0 };
  }
  if (!autoRotateLandscape) {
    return {
      x: ((clientX - rect.left) / rect.width) * canvasWidth,
      y: ((clientY - rect.top) / rect.height) * canvasHeight,
    };
  }
  return {
    x: ((clientY - rect.top) / rect.height) * canvasWidth,
    y: ((rect.right - clientX) / rect.width) * canvasHeight,
  };
}

export async function activateMobileFullscreenAndLandscape({ doc, win } = {}) {
  const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
  const targetWin = win || (typeof window !== 'undefined' ? window : null);
  let fullscreenAttempted = false;
  let orientationAttempted = false;

  if (targetDoc) {
    try {
      const activeFs = targetDoc.fullscreenElement || targetDoc.webkitFullscreenElement;
      const rootEl = targetDoc.documentElement;
      if (!activeFs && rootEl) {
        if (typeof rootEl.requestFullscreen === 'function') {
          fullscreenAttempted = true;
          try {
            const p = rootEl.requestFullscreen({ navigationUI: 'hide' });
            if (p && typeof p.catch === 'function') await p.catch(() => {});
          } catch {
            try {
              const p2 = rootEl.requestFullscreen();
              if (p2 && typeof p2.catch === 'function') await p2.catch(() => {});
            } catch {}
          }
        } else if (typeof rootEl.webkitRequestFullscreen === 'function') {
          fullscreenAttempted = true;
          try {
            rootEl.webkitRequestFullscreen();
          } catch {}
        }
      }
    } catch {}
  }

  if (targetWin && targetWin.screen && targetWin.screen.orientation) {
    try {
      if (typeof targetWin.screen.orientation.lock === 'function') {
        orientationAttempted = true;
        const p = targetWin.screen.orientation.lock('landscape');
        if (p && typeof p.catch === 'function') await p.catch(() => {});
      }
    } catch {}
  }

  return { fullscreenAttempted, orientationAttempted };
}
