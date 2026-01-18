
/**
 * Events
 * 
 * Handles initialization and event-related functionalities.
 */


function init() {
  if (app.state.youlag.init) return;
  
  clearPathHash();
  setBodyClass();
  if (isFeedPage()) {
    setupClickListener();
    setupTagsDropdownOverride();
    renderToolbar();
    if (isLayoutVideo()) {
      updateVideoAuthor();
      updateVideoDateFormat();
    }
    onNewFeedItems()
    restoreVideoQueue();
  }
  updateSidenavLinks();
  settingsPageEventListeners();
  setVideoLabelsTitle('playlists', 'Playlists');
  setVideoLabelsTitle('watch_later', 'Watch later');
  updateAddFeedLink();
  setAddFeedCategoryValue();
  removeYoulagLoadingState();
  app.state.youlag.init = true;
}

function removeYoulagLoadingState() {
  // By default, the youlag CSS is set to a loading state.
  // This will remove the loading state when the script is ready.
  document.body.classList.add('youlag-loaded');
}

function initFallback() {
  // NOTE: Using FreshRSS' `freshrss:globalContextLoaded` event hasn't been reliable, thus this fallback method.
  if (document.readyState === 'complete' || document.readyState === 'interactive' || app.state.youlag.init === true) {
    init();
  }
  else {
    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('load', init);
  }
}

// Fallback interval check
const checkInitInterval = setInterval(() => {
  if (document.readyState === 'complete' || app.state.youlag.init === true) {
    init();
    clearInterval(checkInitInterval);
  }
}, 1000);

// Ensure init runs
initFallback();
