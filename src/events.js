/**
 * Events
 *
 * Handles initialization and event-related functionalities.
 */

function init() {
  if (app.state.youlag.init) return;

  clearPathHash();
  setFreshRssUrlPrefix();
  setBodyClass();
  if (isFeedPage()) {
    setupClickListener();
    setupSwipeSidebar();
    setupVisibilityEventListeners(); // Restore event listeners after page inactvity, e.g. when switching tabs.
    setupTagsDropdownOverride();
    setupShareDropdownOverride();
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
  updateSidenavLinks();
  settingsPageEventListeners();
  setVideoLabelsTitle("playlists", "Playlists");
  setVideoLabelsTitle("watch_later", "Watch later");
  updateAddFeedLink();
  setAddFeedCategoryValue();
  setMissingLogo();
  showUpdateAvailableInSettings();
  handleSliderHashChange(); // TODO: Remove once `FreshRSS/FreshRSS/issues/8488` is addressed.
  handleExperimentalFeature(); // TODO: Temporary handler for experimental features, remove once experimental features are fully implemented or omitted.
  removeYoulagLoadingState();
  app.state.youlag.init = true;

  if (isDebugEnabled()) {
    renderDebugButtons();
    autoOpenDebugPanels();
  }
}

async function initialVideoState() {
  if (hasQueryParam("ylvideo")) {
    await handleVideoDirectLink();
  } else {
    restoreVideoQueue();
  }
}

function setupVisibilityEventListeners() {
  // Restore event listeners when the page becomes visible, primarily for the video modal.
  // E.g. when the user switches tabs and returns, reset and reattach event listeners to improve reliability.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      restoreModalEventListeners();
      setupSwipeSidebar();
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
  const watchLaterCategoryFilterEnabledElement = document.getElementById(
    "yl_watch_later_category_filter_enabled",
  );
  const watchLaterCategoryFilterEnabledSetting =
    watchLaterCategoryFilterEnabledElement?.getAttribute(
      "data-yl-watch-later-category-filter-enabled",
    );
  const isWatchLaterCategoryFilterEnabled =
    watchLaterCategoryFilterEnabledSetting === "true";
  if (isWatchLaterCategoryFilterEnabled && categoryFilterToggle) {
    app.state.youlag.experimentalFeatureEnabled = true;
    categoryFilterToggle.style.setProperty("display", "flex", "important");
  }
}

function removeYoulagLoadingState() {
  // By default, the youlag CSS is set to a loading state.
  // This will remove the loading state when the script is ready.
  document.body.classList.add("youlag-loaded");
}

function initFallback() {
  // NOTE: Using FreshRSS' `freshrss:globalContextLoaded` event hasn't been reliable, hence this fallback method.
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive" ||
    app.state.youlag.init === true
  ) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
    window.addEventListener("load", init);
  }
}

// Fallback interval check
const checkInitInterval = setInterval(() => {
  if (document.readyState === "complete" || app.state.youlag.init === true) {
    init();
    clearInterval(checkInitInterval);
  }
}, 1000);

// Ensure init runs
initFallback();
(async () => {
  await initialVideoState();
})();
