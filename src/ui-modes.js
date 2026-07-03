/**
 * UI: Modes
 *
 * Handles different view modes for the video modal, such as fullscreen and miniplayer.
 */

function toggleModalMode() {
  if (isModeMiniplayer()) {
    // Toggle from miniplayer -> fullscreen mode
    setModeMiniplayer(false, "fullscreen");
    setModeFullscreen(true);

    if (!getHistoryPopstate()) {
      /**
       * When `restoreVideoQueue()` opens in miniplayer mode, the popstate is not yet added.
       * Thus, if expanding back to fullscreen mode, we need to add it here to avoid routing back a page,
       * and instead just close the modal.
       */
      pushHistoryState("modalOpen", true);
    }

    const modal = getModalVideo();
    if (!modal) return;
    const entryId = modal.getAttribute("data-entry");
    if (entryId) addVideoParamUrl(entryId);
  } else {
    // Toggle from fullscreen -> miniplayer mode
    setModeMiniplayer(true);
    setModeFullscreen(false, "miniplayer");
    removeVideoParamUrl();
  }
}

function setModeMiniplayer(state, prevState) {
  const modal = getModalVideo();

  if (state === true) {
    if (app.state.modal.activeType === "article") {
      modal ? (app.state.modal.miniplayerScrollTop = modal.scrollTop) : null;
    }
    document.body.classList.add(app.modal.class.modeMiniplayer);
    setModeState("miniplayer");
    setModalState(false); // Miniplayer mode is not considered active.
    modal ? modal.scrollTo({ top: 0 }) : null;
  } else if (state === false) {
    if (modal) {
      let transitionRan = false;
      const onTransitionEnd = () => {
        transitionRan = true;
        // Scroll back to previous position when exiting miniplayer mode.
        modal.scrollTo({
          top: app.state.modal.miniplayerScrollTop,
          behavior: "smooth",
        });
      };
      modal.addEventListener("transitionend", onTransitionEnd, { once: true });
      setTimeout(() => {
        // Fallback if transition event is not detected.
        if (!transitionRan) {
          modal.scrollTo({
            top: app.state.modal.miniplayerScrollTop,
            behavior: "smooth",
          });
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
      localStorage.setItem(
        app.modal.queue.localStorageKey,
        JSON.stringify(obj),
      );
    }
  } catch (e) {}
}

function setModeFullscreen(state, prevState) {
  if (state === true) {
    document.body.classList.add(app.modal.class.modeFullscreen);
    document.body.classList.remove(app.modal.class.modeMiniplayer);
    setModeState("fullscreen");
    setModalState(true);
  } else if (state === false) {
    document.body.classList.remove(app.modal.class.modeFullscreen);
    app.state.modal.mode = prevState || null;
    setModalState(false);
  }
}

function setupSwipeToMiniplayer(modal) {
  // Allow video modal overscroll to enter miniplayer mode on touch devices.

  modal = modal || getModalVideo();
  if (!modal) return;

  // Remove any previous swipe listeners
  if (modal._videoModalListeners && Array.isArray(modal._videoModalListeners)) {
    modal._videoModalListeners = modal._videoModalListeners.filter(
      ({ el, type, handler }) => {
        if (
          el === modal &&
          (type === "touchstart" ||
            type === "touchmove" ||
            type === "touchend" ||
            type === "touchcancel")
        ) {
          el.removeEventListener(type, handler);
          return false;
        }
        return true;
      },
    );
  }

  let touchStartY = null;
  let overscrollActive = false;
  const swipeThreshold = 50; // Minimum distance in pixels to consider a swipe.
  const scrollTolerance = 30; // Allow a larger tolerance for scrollTop to improve swipe reliability
  const intentThreshold = 12; // Minimum downward travel before the gesture claims the touch. Prevents `preventDefault()` on tap jitter, which can cause click suppresses on Firefox Android.

  // Track the initial Y position when a single touch starts near the top of the modal.
  function touchStartHandler(e) {
    // If chapter list is scrollable, don't activate swipe to miniplayer within that area.
    const chapterList = e.target.closest(`#${app.modal.id.chapterList}`);
    if (chapterList && chapterList.scrollHeight > chapterList.clientHeight)
      return;

    // Prevent taps to be claimed if they begin on interactive elements (close, minimize, favorite, etc.).
    if (e.target.closest('button, a, select, input, [role="button"]')) return;

    if (modal.scrollTop <= scrollTolerance && e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      overscrollActive = false;
    }
  }

  // Detect downward movement from the top of the modal to track overscroll gesture.
  function touchMoveHandler(e) {
    if (
      touchStartY !== null &&
      modal.scrollTop <= scrollTolerance &&
      e.touches.length === 1
    ) {
      const moveY = e.touches[0].clientY;
      if (moveY - touchStartY > intentThreshold) {
        overscrollActive = true;
        e.preventDefault(); // Prevent native scroll bounce to allow custom overscroll detection.
      }
    }
  }

  // If a downward swipe of sufficient distance is detected, triggers miniplayer mode.
  function touchEndHandler(e) {
    if (
      touchStartY !== null &&
      overscrollActive &&
      e.changedTouches.length === 1
    ) {
      const endY = e.changedTouches[0].clientY;
      if (
        endY - touchStartY > swipeThreshold &&
        modal.scrollTop <= scrollTolerance
      ) {
        toggleModalMode(true);
      }
    }
    touchStartY = null;
    overscrollActive = false;
  }

  // Reset gesture state when the touch is interrupted,
  // e.g. Android backgrounding the app mid-gesture,
  // otherwise stale state can cause the next tap to be swallowed.
  function touchCancelHandler() {
    touchStartY = null;
    overscrollActive = false;
  }

  modal.addEventListener("touchstart", touchStartHandler, { passive: true });
  modal.addEventListener("touchmove", touchMoveHandler, { passive: false }); // Only `touchmove` needs `passive: false` (uses `preventDefault()`).
  modal.addEventListener("touchend", touchEndHandler, { passive: true });
  modal.addEventListener("touchcancel", touchCancelHandler, { passive: true });

  if (modal._videoModalListeners) {
    modal._videoModalListeners.push(
      { el: modal, type: "touchstart", handler: touchStartHandler },
      { el: modal, type: "touchmove", handler: touchMoveHandler },
      { el: modal, type: "touchend", handler: touchEndHandler },
      { el: modal, type: "touchcancel", handler: touchCancelHandler },
    );
  }
}

function handleArticleSplitView() {
  // Actions to take when clicking an article while article split view is enabled.
  const articleContentPane = document.getElementById(
    app.modal.id.splitPaneContent,
  );
  if (!articleContentPane) return;

  const streamContainer = document.getElementById("stream");
  if (!streamContainer) return;

  const activeArticle = document.querySelector(app.frss.el.current);
  articleContentPane.classList.add("loading");

  function getStickyHeights() {
    // TODO: Extract as utility function.
    const topNavHeight =
      document.querySelector("body > header")?.offsetHeight || 57;
    const stickyHeaderHeight =
      document.getElementById(app.ui.id.toolbar)?.offsetHeight || 60;
    return { topNavHeight, stickyHeaderHeight };
  }

  function isArticleEntryVisible(element, container) {
    // Check if article entry is fully visible within its container
    const elementRect = element.getBoundingClientRect();
    const { topNavHeight, stickyHeaderHeight } = getStickyHeights();
    const visibleTop =
      container.getBoundingClientRect().top + topNavHeight + stickyHeaderHeight;

    return (
      elementRect.top >= visibleTop && elementRect.bottom <= window.innerHeight
    );
  }

  // If active article entry isn't fully visible, scroll the stream container.
  // Especially useful when using FreshRSS' article navigation feature.
  function scrollToActiveArticle(element, container) {
    const elementRect = element.getBoundingClientRect();
    const { topNavHeight, stickyHeaderHeight } = getStickyHeights();

    const offsetTop = topNavHeight + stickyHeaderHeight + 20;
    const offsetBottom = 70; // Enough to reveal next article's headline

    // Suppress toolbar reaction (show/hide) during programmatic scroll
    setToolbarStickyState(true);

    // Element is partially covered
    if (elementRect.top < offsetTop) {
      const scrollAmount = offsetTop - elementRect.top;
      container.scrollTo({
        top: container.scrollTop - scrollAmount,
        behavior: "smooth",
      });
    } else if (elementRect.bottom > window.innerHeight) {
      const scrollAmount =
        elementRect.bottom - window.innerHeight + offsetBottom;
      container.scrollTo({
        top: container.scrollTop + scrollAmount,
        behavior: "smooth",
      });
    }

    setTimeout(() => {
      setToolbarStickyState(false);
    }, 500);
  }

  // Copy article content to the content pane
  function copyActiveArticleContent(article) {
    if (article) {
      const activeArticleContent = article.querySelector(
        "article.flux_content",
      );
      if (activeArticleContent) {
        articleContentPane.classList.remove("loading");
        articleContentPane.innerHTML = activeArticleContent.innerHTML;
        articleContentPane.scrollTop = 0;

        if (!isArticleEntryVisible(article, streamContainer)) {
          // If active article entry isn't fully visible, scroll the stream container.
          scrollToActiveArticle(article, streamContainer);
        }

        return true;
      }
    }
    return false;
  }

  // MutationObserver to display the article once active
  const timeout = setTimeout(() => {
    if (observer) observer.disconnect();
    articleContentPane.classList.remove("loading");
    articleContentPane.innerHTML = "";
    const errorState = document.createElement("div");
    errorState.className = "yl-article-split-view__empty-state-content";
    errorState.textContent = "Article could not be loaded.";
    articleContentPane.appendChild(errorState);
  }, 10000); // Timeout

  let observer = null;

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class"
      ) {
        // Get fresh active article on each mutation
        const currentActiveArticle = document.querySelector(
          app.frss.el.current,
        );
        if (copyActiveArticleContent(currentActiveArticle)) {
          observer.disconnect();
          clearTimeout(timeout);
          return;
        }
      }
    }
  });

  observer.observe(streamContainer, {
    attributes: true,
    attributeFilter: ["class"],
    subtree: true,
    attributeOldValue: false,
  });

  // Fallback: try to load the article on the next animation frame in case it's available, to reduce loading time.
  requestAnimationFrame(() => {
    if (copyActiveArticleContent(activeArticle)) {
      if (observer) observer.disconnect();
      clearTimeout(timeout);
    }
  });
}
