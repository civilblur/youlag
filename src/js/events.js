/**
 * Events
 *
 * Handles initialization and event-related functionalities.
 */

function init() {
  // Gatekeeps init until it's safe to set up Youlag's features:
  // - `app.state.youlag.init`: already set up, so it never runs twice.
  // - `document.readyState === "loading"`: DOM not ready.
  // - `isFreshRssContextPending()`: FreshRSS hasn't loaded `context` yet, which holds Youlag's user settings.
  if (
    app.state.youlag.init ||
    document.readyState === "loading" ||
    isFreshRssContextPending()
  )
    return;

  clearPathHash();
  setFreshRssUrlPrefix();
  setBodyClass();
  setupSync();
  if (isFeedPage()) {
    setupClickListener();
    setupSwipeSidebar();
    setupVisibilityEventListeners(); // Refresh related videos, swipe, and playback positions when returning to the tab.
    setupTagsDropdownOverride();
    setupShareDropdownOverride();
    setupFeedEntryFavoriteObserver();
    renderToolbar();
    if (isLayoutVideo()) {
      updateVideoAuthor();
      updateVideoDateFormat();
      setVideoCardLink();
      if (isWatchLaterPage()) {
        setWatchLaterCategoryFilter();
      }
    }
    if (isLayoutArticle()) {
      setupArticleSplitView();
    }
    handleFeedDearrowFeatures();
    onNewFeedItems();
    isUpdateCheckEnabled() && checkForUpdates();
  }
  setupWatchLaterCountObserver();
  renderWatchHistoryLink();
  setupWatchHistoryPage();
  setupWatchHistorySettings();
  renderContinueWatchingToggle();
  setupVideoDataSettings();
  settingsPageEventListeners();
  updateAddFeedLink();
  setAddFeedCategoryValue();
  setMissingLogo();
  showUpdateAvailableInSettings();
  handleSliderHashChange(); // TODO: Remove once `FreshRSS/FreshRSS/issues/8488` is addressed.
  handleExperimentalFeature(); // TODO: Temporary handler for experimental features, remove once experimental features are fully implemented or omitted.
  removeYoulagLoadingState();
  app.state.youlag.init = true;

  if (isDebugEnabled()) {
    document.body.classList.add("yl-debug");
    renderDebugButtons();
    autoOpenDebugPanels();
  }

  initVideoState();
}

async function initVideoState() {
  if (hasQueryParam("ylvideo")) {
    await handleVideoDirectLink();
  } else {
    restoreVideoQueue();
  }
}

function setupVisibilityEventListeners() {
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      renderPendingRelatedVideos();
      setupSwipeSidebar();
      // Another tab may have saved positions meanwhile. A position missing from the database is only dropped
      // after a clear: another tab's prune also deletes old records, which the server still has.
      const clearFlag = getVideoDataClearFlag();
      const cleared =
        app.state.sync.videoDataClearSeen !== undefined &&
        clearFlag !== app.state.sync.videoDataClearSeen;
      app.state.sync.videoDataClearSeen = clearFlag;
      loadPlaybackPositions(cleared).then(() => renderWatchProgress());
    }
  });
}

function handleExperimentalFeature() {
  // Temporary handler for experimental features, remove once experimental features are fully implemented or omitted.

  // Show the category filter toggle if the feature is disabled.
  if (!isWatchLaterPage()) return;
  const categoryFilterToggle = document.getElementById(
    "yl_stream_category_filter_toggle",
  );
  const isWatchLaterCategoryFilterEnabled =
    getSetting("yl_watch_later_category_filter_enabled") === true;
  if (isWatchLaterCategoryFilterEnabled && categoryFilterToggle) {
    app.state.youlag.experimentalFeatureEnabled = true;
    categoryFilterToggle.style.setProperty("display", "flex", "important");
  }
}

function removeYoulagLoadingState() {
  // By default, the youlag CSS is set to a loading state.
  // This will remove the loading state when the script is ready.
  document.body.classList.add("yl-loaded");
}

function isFreshRssContextPending() {
  // Whether FreshRSS has yet to read `#jsonVars` into `context`, which holds Youlag's user settings.
  return (
    typeof context === "undefined" &&
    document.getElementById("jsonVars") !== null
  );
}

function initFallback() {
  // Tries init now, and falls back to these events if the DOM or `context` isn't ready yet.
  document.addEventListener("freshrss:globalContextLoaded", init);
  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", init);
  init();
}

initFallback();
