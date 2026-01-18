
/**
 * Events
 * 
 * Handles initialization and event-related functionalities.
 */


function init() {
  if (!app.state.youlag.init) console.log('Initializing YouLag script');
  if (app.state.youlag.init) console.log('YouLag script already initialized, skipping.');
  if (app.state.youlag.init) return;
  
  clearPathHash();
  setBodyPageClass();
  if (isFeedPage()) {
    setupClickListener();
    setupTagsDropdownOverride();
    renderToolbar();
    if (app.state.page.layout === 'video') {
      updateVideoAuthor();
      updateVideoDateFormat();
    }
    onNewFeedItems()
    restoreVideoQueue();
  }
  updateSidenavLinks();
  // setTimeout(() => {
  //   // HACK: Delay referencing the settings elements.
  //   youlagSettingsPageEventListeners();
  // }, 1500);
  youlagSettingsPageEventListeners();
  setVideoLabelsTitle('yl-page-playlists', 'Playlists');
  setVideoLabelsTitle('yl-page-watch_later', 'Watch later');
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
