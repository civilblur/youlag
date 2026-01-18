/**
 * UI: Modes
 * 
 * Handles different view modes for the video modal, such as fullscreen and miniplayer.
 */

function toggleModalMode() {
  if (app.state.modal.mode === 'miniplayer') {
    setModeMiniplayer(false, 'fullscreen');
    setModeFullscreen(true);

    if (!app.state.popstate.added) {
      /**
       * When `restoreVideoQueue()` opens in miniplayer mode, the popstate is not yet added.
       * Thus, if expanding back to fullscreen mode, we need to add it here to avoid routing back a page,
       * and instead just close the modal.
       */
      pushHistoryState('modalOpen', true);
    }
  }
  else {
    setModeMiniplayer(true);
    setModeFullscreen(false, 'miniplayer');
  }
}

function setModeMiniplayer(state, prevState) {
  const modal = getModalVideo();

  if (state === true) {
    if (app.state.modal.activeType === 'article') {
      modal ? (app.state.modal.miniplayerScrollTop = modal.scrollTop) : null;
    }
    document.body.classList.add(app.modal.class.modeMiniplayer);
    app.state.modal.mode = 'miniplayer';
    app.state.modal.active = false; // Miniplayer mode is not considered active.
    modal ? modal.scrollTo({ top: 0 }) : null;
  }
  else if (state === false) {
    if (modal) {
      let transitionRan = false;
      const onTransitionEnd = () => {
        transitionRan = true;
        // Scroll back to previous position when exiting miniplayer mode.
        modal.scrollTo({ top: app.state.modal.miniplayerScrollTop, behavior: 'smooth' });
      };
      modal.addEventListener('transitionend', onTransitionEnd, { once: true });
      setTimeout(() => {
        // Fallback if transition event is not detected.
        if (!transitionRan) {
          modal.scrollTo({ top: app.state.modal.miniplayerScrollTop, behavior: 'smooth' });
        }
      }, 500);
    }
    document.body.classList.remove(app.modal.class.modeMiniplayer);
    app.state.modal.mode = prevState || null;
  }
  try {
    const stored = localStorage.getItem(app.modal.queue.localStorageKey);
    if (stored) {
      const obj = JSON.parse(stored);
      obj.isMiniplayer = !!state;
      localStorage.setItem(app.modal.queue.localStorageKey, JSON.stringify(obj));
    }
  } catch (e) { }
}

function setModeFullscreen(state, prevState) {
  if (state === true) {
    document.body.classList.add(app.modal.class.modeFullscreen);
    document.body.classList.remove(app.modal.class.modeMiniplayer);
    app.state.modal.mode = 'fullscreen';
    app.state.modal.active = true;
  }
  else if (state === false) {
    document.body.classList.remove(app.modal.class.modeFullscreen);
    app.state.modal.mode = prevState || null;
    app.state.modal.active = false;
  }
}

function setupSwipeToMiniplayer(modal) {
  // Allow video modal overscroll to enter miniplayer mode on touch devices.
  if (modal._swipeToMiniplayer) return;

  let touchStartY = null;
  let overscrollActive = false;

  modal.addEventListener('touchstart', function (e) {
    if (modal.scrollTop === 0 && e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      overscrollActive = false;
    }
  }, { passive: false });
  modal.addEventListener('touchmove', function (e) {
    if (touchStartY !== null && modal.scrollTop === 0 && e.touches.length === 1) {
      const moveY = e.touches[0].clientY;
      if (moveY - touchStartY > 0) {
        // Touch is moving downward while scroll is at the very top; start tracking overscroll gesture
        overscrollActive = true;
        e.preventDefault(); // Prevent native scroll bounce to allow custom overscroll detection
      }
    }
  }, { passive: false });
  modal.addEventListener('touchend', function (e) {
    if (touchStartY !== null && overscrollActive && e.changedTouches.length === 1) {
      const endY = e.changedTouches[0].clientY;
      if (endY - touchStartY > 40 && modal.scrollTop === 0) {
        // Overscroll (pull-down) detected at top, toggle miniplayer mode.
        toggleModalMode(true);
      }
    }
    touchStartY = null;
    overscrollActive = false;
  }, { passive: false });

  modal._swipeToMiniplayer = true;
}