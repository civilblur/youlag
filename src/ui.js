/**
 * UI: General
 * 
 * Handles general UI interactions, including click listeners, popstate handling, etc.
 */

/*****************************************
 *
 * INDEX
 * - Event listeners
 * - UI class handlers
 * - UI components
 * - UI utilities
 *
 ****************************************/


/*****************************************
 * BEGIN "EVENT LISTENERS"
 * Related to click listeners and popstate handling.
 ****************************************/

function setupClickListener() {
  if (app.state.youlag.clickListenerInit) return;

  if (isLayoutVideo()) {
    setupVideoClickListener();
  }
  else if (isLayoutArticle()) {
    setupArticleClickListener();
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (isLayoutVideo() && !isModeMiniplayer()) {
        const modal = getModalVideo();
        if (modal) closeModalVideo();
      }
      else if (isLayoutArticle()) {
        const openedArticle = document.querySelector(app.frss.el.current);
        if (openedArticle) closeArticle(event);
      }
    }
  });

  app.state.youlag.clickListenerInit = true;
}

function setupVideoClickListener() {
  const streamContainer = getFeedRoot();
  if (!streamContainer) return;
  streamContainer.addEventListener('click', (event) => {
    const target = event.target.closest(app.frss.el.entry);
    if (!target) return;
    const actionButtons = [
      'li.manage',
      'li.labels',
      'li.share',
      'li.link',
      '.website a[href^="./?get=f_"]'
    ].join(', ');
    if (event.target.closest(actionButtons)) return;
    handleActiveVideo(event);
    if (target.classList.contains('active')) {
      forceFrssEntryToCollapse(target);
    }
    else {
      const observer = new MutationObserver((observer) => {
        if (target.classList.contains('active')) {
          forceFrssEntryToCollapse(target);
          observer.disconnect();
        }
      });
      observer.observe(target, { attributes: true, attributeFilter: ['class'] });
    }

    if (event.target.closest('a.yl-video-card__link')) {
      // Prioritize the click event to open the dialog, opposed to navigating to video link.
      event.preventDefault();
    }
  });

  window.addEventListener('popstate', function popstateHandler(e) {
    if (isHashUrl()) return;
    if (isModeFullscreen() && getModalVideo()) {
      app.state.popstate.allowBack = false;
      closeModalVideo();
      return;
    }
    if (app.state.popstate.ignoreNext) {
      app.state.popstate.ignoreNext = false;
      app.state.popstate.allowBack = false;
      removeVideoParamUrl();
      return;
    }
    if (isModeMiniplayer()) {
      app.state.popstate.ignoreNext = true;
      history.back();
      return;
    }
    else {
      app.state.popstate.ignoreNext = false;
    }
  });
}

function setupArticleClickListener() {
  const streamContainer = getFeedRoot();

  if (!streamContainer) return;
  streamContainer.addEventListener('click', function (event) {
    const target = event.target.closest(app.frss.el.entry);

    if (!target) return;

    const actionButtons = [
      '.flux_header li.manage',
      '.flux_header li.labels',
      '.flux_header li.share',
      '.flux_header li.link',
      '.flux_header li.website',
      '.flux_content',
    ].join(', ');
    if (event.target.closest(actionButtons)) return;

    // Auto-detect if item is a video and open in video modal if so
    if (target.getAttribute('data-yl-is-video') === 'true') {
      handleActiveVideo(event);
      return;
    }

    if (!getModalState()) {
      setModalState(true);
      handleActiveArticle(event);
    }
    const scrollToTarget = () => {
      const rect = target.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      let offset = 0;
      if (window.getComputedStyle) {
        const root = document.documentElement;
        const val = getComputedStyle(root).getPropertyValue('--yl-topnav-height');
        offset = parseInt(val, 10) || 0;
      }
      return rect.top + scrollTop - offset;
    };

    const toolbar = document.getElementById(app.ui.id.toolbar);
    setToolbarStickyState(true);
    toolbar.classList.remove('sticky-visible');
    toolbar.classList.add('sticky-hidden');

    // Scroll to article top position
    let attempts = 0;
    const maxAttempts = 4;
    const scroll = () => {
      const targetScroll = scrollToTarget();
      window.scrollTo({ top: targetScroll });
      const assessScrollPosition = () => {
        // Ensure correct position after layout shifts, due to expanding article content.
        attempts++;
        const newTargetScroll = scrollToTarget();
        if (Math.abs(window.pageYOffset - newTargetScroll) > 2 && attempts < maxAttempts) {
          window.requestAnimationFrame(scroll);
        }
        else {
          setTimeout(() => { setToolbarStickyState(false); }, 50);
        }
      };
      window.setTimeout(assessScrollPosition, 180);
    };
    scroll();
  });

  window.addEventListener('popstate', function (event) {
    function getOpenArticle() { return getModalState(); } // Alias for clarity

    if (isHashUrl()) return;
    if (isModeMiniplayer() && getOpenArticle()) {
      closeArticle(event);
      return;
    }
    if (isModeMiniplayer() && !getOpenArticle()) {
      if (!app.state.popstate.ignoreNext) {
        app.state.popstate.ignoreNext = true;
        history.back();
      }
      else {
        app.state.popstate.ignoreNext = false;
      }
      return;
    }
    if (!getOpenArticle()) {
      if (!app.state.popstate.ignoreNext) {
        app.state.popstate.ignoreNext = true;
        history.back();
      }
      else {
        app.state.popstate.ignoreNext = false;
      }
      return;
    }
    if (getOpenArticle()) {
      closeArticle(event);
    }
  });


}

function setupTagsDropdownOverride() {
  // Delegated eventlistener to override tags (labels/playlists) dropdown click
  const streamContainer = document.querySelector(app.frss.el.feedRoot);
  if (!streamContainer) return;

  streamContainer.addEventListener('click', async function (event) {
    const modal = getModalVideo();
    if (modal && modal.contains(event.target)) return;

    const entryItem = event.target.closest(`${app.frss.el.entry} .flux_header li.labels`);
    const entryItemDropdown = entryItem ? entryItem.querySelector('a.dropdown-toggle') : null;
    const entryItemFooterDropdown = event.target.closest('.item.labels a.dropdown-toggle[href^="#dropdown-labels-"]');

    if (entryItemDropdown || entryItemFooterDropdown) {
      // Prevent default tag dropdown behavior
      event.preventDefault();
      event.stopImmediatePropagation();
      let entryId = null;
      let entryIdRegex = '([0-9]+)$';
      let iconImg = null; // Tag icon in card element 

      if (entryItemDropdown) {
        // Card tags button: Get feed entry ID
        entryId = entryItem.querySelector('.dropdown-target')?.id;
        entryId = entryId ? entryId.match(new RegExp(entryIdRegex)) : null;
        entryId = entryId ? entryId[1] : null;
        iconImg = entryItemDropdown.closest('li.labels')?.querySelector('img.icon');
      }
      if (entryItemFooterDropdown) {
        // Footer tags button: Get feed entry ID
        entryId = entryItemFooterDropdown.href;
        entryId = entryId ? entryId.match(new RegExp(entryIdRegex)) : null;
        entryId = entryId ? entryId[1] : null;
        iconImg = entryItemFooterDropdown.closest('li.labels, .item.labels')?.querySelector('img.icon');
      }
      let prevSrc = null;
      if (iconImg) {
        prevSrc = iconImg.src;
        iconImg.classList.add('loading');
        iconImg.src = app.frss.img.spinner;
      }
      let tags = await getItemTags(entryId);
      if (iconImg) {
        iconImg.classList.remove('loading');
        iconImg.src = prevSrc;
      }
      // Open custom tags modal
      renderTagsModal(entryId, tags);
    }
  }, true);
}

function setupSidenavStateListener() {
  // Listen for class changes on #aside_feed and update body classes
  const sidenav = document.getElementById('aside_feed');
  if (!sidenav) return;
  setSidenavState();
  const observer = new MutationObserver(setSidenavState);
  observer.observe(sidenav, { attributes: true, attributeFilter: ['class'] });
}

function handleSliderHashChange() {
  // Temporary fix for page scroll being locked after closing a slider via browser's back navigation.
  // FreshRSS/FreshRSS/issues/8488

  if (!app.state.youlag.sliderListeners) app.state.youlag.sliderListeners = [];

  const sliderHandler = function () {
    if (window.location.hash !== '#slider') {
      document.documentElement.classList.remove('slider-active');
      clearPathHash();
    }
  };
  window.addEventListener('hashchange', sliderHandler);
  app.state.youlag.sliderListeners.push({ el: window, type: 'hashchange', handler: sliderHandler });
}

function isHashUrl() {
  const currentPathnameSearch = window.location.pathname + window.location.search;
  const isHash = app.state.popstate.pathPrev === currentPathnameSearch && window.location.hash;
  app.state.popstate.pathPrev = currentPathnameSearch;
  return isHash;
}

function renderConsoleLogs() {
  
}

function renderLocalStorageStates() {

}

/*****************************************
 * END "EVENT LISTENERS"
 ****************************************/



/*****************************************
 * BEGIN "UI CLASS HANDLERS"
 * Adding/removing classes based on user settings and page state.
 ****************************************/

function setBodyClass() {
  // TODO: Shorten class name prefix from 'youlag-' to 'yl-' as the amount of classes have grown.

  document.body.className += ' ' + getCurrentPage().class;
  currentPageParams = new URLSearchParams(window.location.search).get('get');
  setMobileLayoutGrid();
  setupSidenavStateListener();
  getSubpageParentId(currentPageParams) && (document.body.className += ' yl-page-' + getSubpageParentId(currentPageParams));
  setVideoLabelsClass();
  setCategoryWhitelistClass();
  setUnreadBadgeClass();
  setPageSortingClass();
  document.body.setAttribute('data-youlag-version', app.metadata.version);
  shouldCustomThumbnailTitle() && document.body.classList.add('yl-feed-custom-thumbnail-title');
}

function setCategoryWhitelistClass() {
  // Quickly apply youlag-category-whitelist class based on localStorage to reduce layout shifts.

  let localStorageWhitelist = [];
  try {
    const stored = localStorage.getItem('youlagCategoryWhitelist');
    if (stored) localStorageWhitelist = JSON.parse(stored);
  } catch (e) { }

  const currentPageClass = getCurrentPage().class;
  const isWhitelisted = isPageWhitelisted(localStorageWhitelist, currentPageClass);
  app.state.page.layout = isWhitelisted ? 'video' : 'article';

  // Apply class based on localStorage
  document.body.classList.toggle('youlag-active', isWhitelisted);
  document.body.classList.toggle('youlag-inactive', !isWhitelisted);

  // Sync with actual whitelist from the user settings exposed in the DOM.
  const whitelist = getCategoryWhitelist();
  const isWhitelistedUserSetting = isPageWhitelisted(whitelist, currentPageClass);
  app.state.page.layout = isWhitelistedUserSetting ? 'video' : 'article';

  // If the actual whitelist status differs from localStorage, update class and localStorage.
  if (isWhitelistedUserSetting !== isWhitelisted) {
    document.body.classList.toggle('youlag-active', isWhitelistedUserSetting);
    document.body.classList.toggle('youlag-inactive', !isWhitelistedUserSetting);
    try {
      localStorage.setItem('youlagCategoryWhitelist', JSON.stringify(whitelist));
    } catch (e) { }
    return isWhitelistedUserSetting;
  }
  return isWhitelisted;
}

function setVideoLabelsClass() {
  /* Adds css class 'youlag-video-labels' to body if video labels setting is enabled.
   * The setting is stored in localStorage for faster access.
   * When active, labels like "My Labels" changes to "Playlists", and "Favorites" to "Watch Later".
   */
  const localStorageSetting = localStorage.getItem('youlagVideoLabels') === 'true';
  const userSettingElement = document.querySelector('#yl_video_labels');
  let userSetting;

  if (userSettingElement) {
    userSetting = userSettingElement.getAttribute('data-yl-video-labels') === 'true';
  }

  if (userSetting) {
    document.body.classList.add('youlag-video-labels');
    localStorage.setItem('youlagVideoLabels', 'true');
    return true;
  }
  else if (userSetting === false) {
    document.body.classList.remove('youlag-video-labels');
    localStorage.setItem('youlagVideoLabels', 'false');
    return false;
  }
  else if (localStorageSetting) {
    document.body.classList.add('youlag-video-labels');
    return true;
  }
  else {
    document.body.classList.remove('youlag-video-labels');
    return false;
  }
}

function setUnreadBadgeClass() {
  // Adds css class 'youlag-video-unread-badge' to body if video unread badge setting is enabled.
  // If enabled, videos will show badge "New" for unwatched videos.
  const userSettingElement = document.querySelector('#yl_video_unread_badge');
  let userSetting;
  if (userSettingElement) {
    userSetting = userSettingElement.getAttribute('data-yl-video-unread-badge') === 'true';
  }
  if (userSetting) {
    document.body.classList.add('youlag-video-unread-badge');
    return true;
  }
  else {
    document.body.classList.remove('youlag-video-unread-badge');
    return false;
  }
}

function setPageSortingClass() {
  // Adds css class e.g. `youlag-sort-watch_later--user-modified`.
  // Used as a reference for determining the user settings, and run functions based on that.
  if (getAttrValue('data-yl-video-sort-modified') === 'true') {
    document.body.classList.add('youlag-sort-watch_later--user-modified');
  }
}

function setMobileLayoutGrid() {
  // Determine if mobile layout should use grid view based on user setting.
  const userSettingElement = document.querySelector('#yl_feed_view_mobile_grid_enabled');
  const userSetting = userSettingElement?.getAttribute('data-yl-feed-view-mobile-grid-enabled') === 'true';
  if (userSetting) {
    document.body.classList.add('youlag-mobile-layout--grid');
  }
  else {
    document.body.classList.remove('youlag-mobile-layout--grid');
  }
  return userSetting;
}

function setVideoLabelsTitle(pageName, newTitle) {
  const page = getCurrentPage();

  if (page.name !== pageName || !isVideoLabelsEnabled()) return;

  // Replace the middle text of the tab title, e.g. "(3) Some Text · FreshRSS" to "(3) ${newTitle} · FreshRSS"
  // Primarily for 'Playlists' and 'Watch Later' pages.
  const titleMatch = document.title.match(/^\s*(\((\d+)\)\s*)?(.+?)\s*·\s*(.+?)\s*$/);
  if (titleMatch) {
    const countPart = titleMatch[1] ? titleMatch[1] : '';
    const customSuffix = titleMatch[4] ? titleMatch[4] : ''; // In case the user has rename their FreshRSS instance.
    document.title = `${countPart}${newTitle} · ${customSuffix}`;
  }
}

function setSidenavState() {
  // Update body classes based on sidenav state (expanded/collapsed)
  const sidenav = document.getElementById('aside_feed');
  if (!sidenav) return;
  const expanded = sidenav.classList.contains('visible');
  document.body.classList.toggle('youlag-sidenav--expanded', expanded);
  document.body.classList.toggle('youlag-sidenav--collapsed', !expanded);
}

async function handleFeedDearrowFeatures() {
  // Video, article: Replace the thumbnails in stream and related videos (but not the video modal).

  markVideoFeedItems(); // Adds `data-yl-is-video="true"` for video feed entries.

  const feedRootSelector = app.frss.el.feedRoot;
  // Only target entries that are videos, and haven't been processed for thumbnail or duration badge yet.
  const entrySelector = `${app.frss.el.entry}[data-yl-is-video="true"]:not([data-yl-video-screencap="true"]):not([data-yl-video-duration])`;
  const thumbnailSelector = ".item.thumbnail img";
  const feedEntriesSelector = `${feedRootSelector} ${entrySelector} ${thumbnailSelector}`;
  const feedEntriesThumbnail = document.querySelectorAll(feedEntriesSelector);
  const feedEntriesTitle = document.querySelectorAll(`${feedRootSelector} ${entrySelector} .flux_header .titleAuthorSummaryDate a.title`);
  const pageLayoutVideo = isLayoutVideo();
  const useCustomThumbTitle = shouldCustomThumbnailTitle();

  function getEntryRootElement(entryImg) {
    // The root element of a feed entry, which contains the data-yl-is-video attribute. Used for setting attributes like data-yl-video-duration.
    return entryImg.closest(`${app.frss.el.entry}[data-entry]`);
  }

  // Store dearrow for batch processing.
  const videoIdEntryMap = [];
  const videoIdTitleMap = [];
  const videoIdSet = new Set();

  // Build videoIdEntryMap for thumbnails, needed for custom thumbnail and video length badge.
  for (const entryImg of feedEntriesThumbnail) {
    const videoId = getVideoIdFromUrl(entryImg.src);
    if (videoId) {
      videoIdEntryMap.push({ entryImg, videoId });
      videoIdSet.add(videoId);
    }
  }

  // Also build videoIdTitleMap to address custom title updates,
  // if setting is enabled for `useCustomThumbTitle`. 
  if (useCustomThumbTitle) {
    for (const entryTitle of feedEntriesTitle) {
      const videoId = getVideoIdFromUrl(entryTitle.href);
      if (videoId) {
        videoIdTitleMap.push({ entryTitle, videoId });
        videoIdSet.add(videoId);
      }
    }
  }

  // Batch fetch DeArrow data for all unique videoIds
  const videoIdList = Array.from(videoIdSet);
  const dearrowResults = await Promise.all(videoIdList.map(videoId => getDearrowData(videoId)));
  const dearrowDataMap = {};
  for (let i = 0; i < videoIdList.length; i++) {
    dearrowDataMap[videoIdList[i]] = dearrowResults[i];
  }

  if (useCustomThumbTitle) {
    // Update video titles
    for (const { entryTitle, videoId } of videoIdTitleMap) {
      const dearrowData = dearrowDataMap[videoId];
      if (dearrowData && typeof dearrowData === 'object' && Array.isArray(dearrowData.titles) && dearrowData.titles.length > 0) {
        // Use the first title as default
        entryTitle.textContent = dearrowData.titles[0].title;
      }
    }
  }

  // Set duration badges, and update thumbnails only if `useCustomThumbTitle`.
  for (const { entryImg, videoId } of videoIdEntryMap) {
    const dearrowData = dearrowDataMap[videoId];
    let thumbnail = entryImg.src;
    if (dearrowData && typeof dearrowData === 'object') {

      // Thumbnail priority: DeArrow thumbnail -> YouTube screencap -> original thumbnail.
      if (useCustomThumbTitle && dearrowData.thumbnails && dearrowData.thumbnails.length > 0) {
        thumbnail = dearrowData.thumbnails[0].url;
        entryImg.setAttribute('data-yl-video-screencap', 'true');
        entryImg.setAttribute('data-yl-original-src', entryImg.src);
        entryImg.src = thumbnail; // Ensure DOM image is actually updated
      }

      // Video duration on top of thumbnail
      if (pageLayoutVideo && dearrowData.videoDuration) {
        const videoDurationText = formatTime(dearrowData.videoDuration);
        let durationEl = entryImg.parentElement.querySelector('.yl-video-duration');
        if (!durationEl) {
          durationEl = document.createElement('div');
          durationEl.className = 'yl-video-duration';
          entryImg.parentElement.appendChild(durationEl);
        }
        durationEl.textContent = videoDurationText;
        getEntryRootElement(entryImg)?.setAttribute('data-yl-video-duration', videoDurationText);
      }
    }
  }
}

function setupSwipeSidebar() {
  // Mobile: Swipe left to right to open sidebar, and opposite to close. 
  
  const feedRoot = getFeedRoot();
  const sidebar = getSidebar();
  if (!feedRoot || !sidebar) return;

  if (feedRoot._swipeSidebarListeners) {
    for (const { el, type, handler } of feedRoot._swipeSidebarListeners) {
      el.removeEventListener(type, handler);
    }
  }
  feedRoot._swipeSidebarListeners = [];

  // Swipe start threshold and cap.
  const swipeStartThreshold = Math.min(window.innerWidth * 0.25, 100); // 25vw, capped at 100px
  const swipeMinDistance = swipeStartThreshold * 0.5;

  let touchStartX = null;
  let touchStartY = null;

  function touchStartHandler(e) {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function touchEndHandler(e) {
    if (e.changedTouches.length !== 1 || touchStartX === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    // Calculate swipe distance
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      // Ignore vertical swipes
      touchStartX = null;
      touchStartY = null;
      return;
    }

    const isSidebarVisible = sidebar.classList.contains('visible');

    // Open sidebar
    if (!isSidebarVisible && touchStartX < swipeStartThreshold && deltaX > swipeMinDistance) {
      sidebar.classList.add('visible');
      sidebar.style.display = '';
      setSidenavState();
    }
    
    // Close sidebar
    else if (isSidebarVisible && deltaX < -swipeMinDistance) {
      sidebar.classList.remove('visible');
      sidebar.style.display = 'none';
      setSidenavState();
    }

    touchStartX = null;
    touchStartY = null;
  }

  function addTracked(el, type, handler) {
    el.addEventListener(type, handler, { passive: true });
    feedRoot._swipeSidebarListeners.push({ el, type, handler });
  }

  addTracked(feedRoot, 'touchstart', touchStartHandler);
  addTracked(feedRoot, 'touchend', touchEndHandler);
  addTracked(sidebar, 'touchstart', touchStartHandler);
  addTracked(sidebar, 'touchend', touchEndHandler);
}

/*****************************************
 * END "UI CLASS HANDLERS"
 ****************************************/



/*****************************************
 * BEGIN "UI COMPONENTS"
 * Handling of UI components like toolbars.
 ****************************************/

function renderToolbar() {
  // Creates a sticky toolbar to contains the category title and 'configure view' button. 
  if (app.state.youlag.toolbarInit) return;
  app.state.youlag.toolbarInit = true;

  const toolbar = document.getElementById('yl_category_toolbar');
  const menuContainer = document.getElementById('yl_nav_menu_container');
  const menuContent = menuContainer?.querySelector('#yl_nav_menu_container_content');
  const menuToggle = toolbar?.querySelector('#yl_nav_menu_container_toggle');

  const frssToggleSearch = document?.querySelector('#dropdown-search-wrapper');
  const frssMenu = document.querySelector('#global nav.nav_menu:not(#yl_nav_menu_container)');

  // Fail gracefully 
  if (!menuContainer || !menuContent || !menuToggle || !frssMenu || !toolbar) {
    const missing = [];
    if (!menuContainer) missing.push('menuContainer');
    if (!menuContent) missing.push('menuContent');
    if (!menuToggle) missing.push('menuToggle');
    if (!frssMenu) missing.push('frssMenu');
    if (!toolbar) missing.push('toolbar');
    console.warn('Failed to setup sticky nav menu, missing elements:', missing);
    return;
  }

  menuContent.hidden = true; // `#yl_nav_menu_container_content` is hidden by default.
  menuContent.classList.add('nav_menu');

  toolbar.classList.add('yl-category-toolbar--sticky');

  // Place `#yl_category_toolbar` after `#new-article` notification.
  const domLocation = document.querySelector('#stream #new-article');
  if (domLocation && toolbar) {
    if (domLocation.nextSibling) {
      domLocation.parentNode.insertBefore(toolbar, domLocation.nextSibling);
    }
    else {
      domLocation.parentNode.appendChild(toolbar);
    }
  }

  if (frssToggleSearch) {
    // Break out search from the FreshRSS `.nav_menu` container, to keep it independent for styling.
    if (toolbar.nextSibling) {
      toolbar.parentNode.insertBefore(frssToggleSearch, toolbar.nextSibling);
    }
  }

  if (frssMenu && menuContent) {
    // Move FreshRSS `.nav_menu` items inside Youlag's own `.nav_menu` content, `menuContent` (child of `menuContainer`).
    const navMenuChildren = Array.from(frssMenu.children);
    navMenuChildren.forEach(child => {
      if (child.id !== 'nav_menu_toggle_aside') {
        // Exclude the sidebar toggle button, as that its position placement is handled via css already.
        menuContent.appendChild(child);
      }
    });

    // Create shortcut button to Youlag settings page.
    const settingsShortcut = document.createElement('div');
    settingsShortcut.id = 'yl_nav_menu_settings_shortcut';
    settingsShortcut.innerHTML = `<a href="${app.frss.urlPrefix}/i/?c=extension&a=configure&e=Youlag" class="btn" target="_blank" rel="noopener noreferrer">
                                    More settings
                                  </a>`;
    menuContent.appendChild(settingsShortcut);

    // Create shortcut to the current feed's manage page, if it's a sub-page (e.g "get=f_9")
    function setupManageFeedButton() {
      const page = getCurrentPage();
      const feedId = page.id;
      const feedIdNumberMatch = page.id ? page.id.match(/^f_(\d+)$/) : null;
      const feedIdNumber = feedIdNumberMatch ? feedIdNumberMatch[1] : null;
      let manageFeed = null;
      if (page.id && /^f_\d+$/.test(page.id)) {
        manageFeed = Object.assign(document.createElement('a'), {
          id: 'yl_nav_menu_manage_current_feed',
          href: `${app.frss.urlPrefix}/i/?c=subscription&a=feed&id=${feedIdNumber}`,
          target: '_blank',
          rel: 'noopener noreferrer',
          textContent: isVideoLabelsEnabled() && isLayoutVideo() ? 'Manage channel' : 'Manage feed'
        });
        menuToggle.parentNode.insertBefore(manageFeed, menuToggle);
      }
      if (feedId && feedIdNumber && manageFeed) {
        manageFeed.addEventListener('click', function (e) {
          e.preventDefault();
  
          // HACK: Trigger the manage feed slider by simulating clicks to the sidebar.
          // This naive implementation replaces commit #0133a24 for easier maintenance, as some form submit actions (like "remove (feed)") required reimplementing the click events.
          document.querySelector(`#${feedId} a[href="#dropdown-${feedIdNumber}"]`).click();
  
          let attempts = 0;
          function pollDropdown() {
            // Poll the dropdown for the feed, for simulating a click on "Manage".
            const dropdown = document.querySelector(`#${feedId} ul.dropdown-menu`);
            const dropdownItem = document.querySelector(`#${feedId} ul.dropdown-menu a.configure.open-slider`);
            dropdown.classList.add('display-none');
            if (dropdownItem) {
              setTimeout(() => {
                dropdownItem.click();
              }, 200); // Delay to allow FreshRSS click events to attach.
            }
            else if (attempts < 10) {
              attempts++;
              setTimeout(pollDropdown, 50);
            }
          }
          pollDropdown();
        });
      }
    } 
    setupManageFeedButton();

    // Watch later: Setup category filter.
    if (isWatchLaterPage()) {
      const categoryFilterButton = document.getElementById('yl_stream_category_filter_toggle');
      const categoryFilterMenu = document.getElementById('yl_stream_category_filter');
      if (!categoryFilterButton || !categoryFilterMenu) return;
      toolbar.appendChild(categoryFilterMenu);
    }
  }

  // Make the toolbar sticky on scroll.
  setToolbarSticky(toolbar);

  document.addEventListener('click', function (e) {
    // Allow toggling the view options via 'Configure view' button in the toolbar.
    const viewOptionsToggle = e.target.closest('#yl_nav_menu_container_toggle');
    const categoryFilterToggle = e.target.closest('#yl_stream_category_filter_toggle');
    if (!toolbar) return;

    if (viewOptionsToggle) {
      const viewOptionsMenu = document.getElementById('yl_nav_menu_container');
      if (!viewOptionsMenu) return;

      if (app.state.youlag.toolbarActiveMenu === 'categoryFilter') {
        toolbar.classList.remove('yl-toolbar-open--categoryFilter');
      }

      const isOpen = !toolbar.classList.contains('yl-toolbar-open--viewOptions');
      toolbar.classList.toggle('yl-toolbar-open--viewOptions', isOpen);
      menuContent.hidden = !isOpen;
      app.state.youlag.toolbarActiveMenu = isOpen ? 'viewOptions' : null;
      setToolbarStickyState(true);
      setTimeout(() => {
        setToolbarStickyState(false);
      }, 100);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (categoryFilterToggle) {
      const categoryFilter = document.getElementById('yl_stream_category_filter');
      if (!categoryFilter) return;

      if (app.state.youlag.toolbarActiveMenu === 'viewOptions') {
        toolbar.classList.remove('yl-toolbar-open--viewOptions');
        menuContent.hidden = true;
      }

      const isOpen = !toolbar.classList.contains('yl-toolbar-open--categoryFilter');
      toolbar.classList.toggle('yl-toolbar-open--categoryFilter', isOpen);
      app.state.youlag.toolbarActiveMenu = isOpen ? 'categoryFilter' : null;
      setToolbarStickyState(true);
      setTimeout(() => {
        setToolbarStickyState(false);
      }, 100);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (toolbar) {
      // Allow mobile dropdown to expand without causing scroll events to hide the toolbar. 
      setToolbarStickyState(true);
      setTimeout(() => {
        setToolbarStickyState(false);
      }, 100);
      return;
    }
  });
}

function setToolbarSticky(toolbarElement) {
  // Setup scroll listener to show/hide the Youlag `.nav_menu`. Visible while scrolling up, hidden while scrolling down.
  const toolbar = toolbarElement;
  let lastScrollY = window.scrollY;
  let ticking = false;
  let ignoreNextScroll = false; // 'Configure view' toggling expands `toolbarElement`, causing unwanted scroll events. Prevent those.  

  function setStickyVisibility(show) {
    if (getToolbarStickyState() === true) {
      // Allow temporarily forcing the toolbar to be visible, e.g. while toggling 'configure view'.
      toolbar.classList.add('sticky-visible');
      toolbar.classList.remove('sticky-hidden');
      return;
    }

    // Default behavior: Toggle based on scroll direction.
    toolbar.classList.toggle('sticky-visible', show);
    toolbar.classList.toggle('sticky-hidden', !show);
  }

  function setStickyVisibilitySidenavToggle(show) {
    const sidenavToggle = document.getElementById('nav_menu_toggle_aside');
    if (sidenavToggle) {
      // Desktop: Hide show the sidenav toggle button based on scroll direction.
      sidenavToggle.classList.toggle('sticky-visible--sidenav-toggle', show);
      sidenavToggle.classList.toggle('sticky-hidden--sidenav-toggle', !show);
    }
  }

  function onScroll() {
    if (ignoreNextScroll) {
      ignoreNextScroll = false;
      lastScrollY = window.scrollY;
      return;
    }
    if (getToolbarStickyState() === true) {
      return;
    }
    const currentScrollY = window.scrollY;
    if (currentScrollY <= 0) {
      setStickyVisibility(true);
      setStickyVisibilitySidenavToggle(true);
    }
    else if (currentScrollY > lastScrollY + 2) {
      setStickyVisibility(false);
      setStickyVisibilitySidenavToggle(false);
    }
    else if (currentScrollY < lastScrollY - 2) {
      setStickyVisibility(true);
      setStickyVisibilitySidenavToggle(true);
    }
    lastScrollY = currentScrollY;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  });
}

function storeCurrentCategoryId() {
  // Store the current category ID in app.state.
  // If current page is not a category page, the ID is cleared.
  const page = getCurrentPage();
  let categoryId = null;
  if (page.name === 'category' && page.id && page.id.startsWith('c_')) {
    categoryId = page.id.match(/^c_(\d+)$/);
  }

  localStorage.setItem('youlagCategoryIdRecent', categoryId ? categoryId[1] : null);
}

function setMissingLogo() {
  // For search results with no result, the FreshRSS logo is not rendered 
  // due to relying on the `registerHook('nav_entries'...)` in `extensions.php`, which only renders if there's a feed.
  // This function adds the logo back in such cases.

  if (document.getElementById(app.frss.id.logo) || !isFeedPage()) return;

  let pageContainer;
  let frssGlobal = document.querySelector(app.frss.el.global);
  pageContainer = frssGlobal ? frssGlobal : document.body;

  const logo = document.createElement('div');
  logo.id = app.frss.id.logo;
  logo.innerHTML = `
    <a href="${app.frss.urlPrefix}/i/">
      <img id="${app.frss.id.logoImg}" src="../themes/icons/FreshRSS-logo.svg" alt="FreshRSS" loading="lazy">
    </a>
  `;
  pageContainer.appendChild(logo);
}

function showUpdateAvailableInSettings() {
  // Adds a simple to that a new Youlag version is available by the extension area.

  const page = getCurrentPage();
  if (page.name !== 'extension' && page.name !== 'extensions') return;

  const tableWrapper = document.querySelector('.table-wrapper');
  if (!tableWrapper) return;

  const rows = tableWrapper.querySelectorAll('tr');
  rows.forEach(row => {
    const firstTd = row.querySelector('td:first-child');
    if (firstTd && firstTd.textContent.trim() === 'Youlag') {
      const fourthTd = row.querySelector('td:nth-child(4)');
      if (fourthTd && fourthTd.querySelector('.alert.alert-warn')) {
        // A warning in the table indicates a new version available.
        const manageList = document.querySelector('.manage-list');
        if (manageList) {
          const items = manageList.querySelectorAll('li');
          items.forEach(item => {
            const extNameSpan = item.querySelector('span.ext_name');
            if (extNameSpan && extNameSpan.textContent.trim() === 'Youlag') {
              // Add a notice next to the extension name.
              if (!item.querySelector('.youlag-update-notice')) {

                // "New Youlag update available" link
                const updateNotice = document.createElement('a');
                Object.assign(updateNotice, {
                  href: 'https://github.com/civilblur/youlag/releases',
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  id: 'yl-update-notice',
                  textContent: '🔄 New update available'
                });
                item.appendChild(updateNotice);

                // "How to update" link
                const howToUpdate = Object.assign(document.createElement('a'), {
                  href: 'https://github.com/civilblur/youlag?tab=readme-ov-file#update',
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  id: 'yl-update-howto',
                  textContent: '(How to update)'
                });
                item.appendChild(howToUpdate);
              }
            }
          });
        }
      }
    }
  });

}

function showNotification({title, message, action, link, dismissRef}) {
  // Show a simple notification in the feed when a new Youlag version is available.

  if (document.getElementById('yl_notification')) return;
  const notification = document.createElement('div');
  notification.id = 'yl_notification';
  notification.innerHTML = `
    <div class="flex flex-col flex-1">
      <div class="yl-notification-title">${title}</div>
      <div class="yl-notification-message">${message}</div>
    </div>

    ${link ? `<a href="${link}" class="yl-notification-action" target="_blank" rel="noopener noreferrer">${action || 'View'}</a>` : ''}

    <div class="yl-notification-close" id="yl_update_notification_close">×</div>
  `

  // Remove notification
  function removeNotification(e) {
    notification.remove();
    if (dismissRef) {
      const now = Date.now();
      try {
        localStorage.setItem(`${dismissRef}`, now.toString());
      } catch (e) { }
    }
  }

  notification.addEventListener('click', function(e) {
    if (e.target.id === 'yl_update_notification_close') {
      removeNotification(e);
    }
    if (e.target.classList.contains('yl-notification-action')) {
      removeNotification(e);
    }
  });

  document.body.appendChild(notification);
}

function setWatchLaterCategoryFilter() {
  // NOTE 2026-02-03: Experimental feature to filter videos in "Watch Later" by category.
  // It utilizes CSS hacks to hide/show videos based on selected categories.

  const categoryFilterMenu = document.getElementById('yl_stream_category_filter');
  if (!categoryFilterMenu) return;

  const checkboxes = categoryFilterMenu.querySelectorAll('.yl-stream-category-filter__checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateCategoryVisibility);
  });

  function clearAllCategoryFilters() {
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
  }

  clearAllCategoryFilters();

  function updateCategoryVisibility() {
    // Handle the visiblity of feed entries based on filtered categories.
    const checked = Array.from(categoryFilterMenu.querySelectorAll('.yl-stream-category-filter__checkbox:checked'))
      .map(cb => cb.closest('.yl-stream-category-filter-options__item')?.getAttribute('data-category'))
      .filter(Boolean);

    // Update filter count in the toolbar button
    const countSpan = document.getElementById('yl_stream_category_filter_count');
    if (countSpan) {
      countSpan.textContent = checked.length > 0 ? `\u00A0(${checked.length})` : '';
    }

    // Remove all previous filter classes
    document.body.className = document.body.className
      .split(' ')
      .filter(cls => !/^yl-stream-category-filter(--|$)/.test(cls))
      .join(' ');

    if (checked.length > 0) {
      document.body.classList.add('yl-stream-category-filter--active'); // Hide all feed entries by default
      checked.forEach(catId => {
        document.body.classList.add(`yl-stream-category-filter--${catId}`); // Only show feed entries matching category id
      });
    }
  }

  const clearAllButton = categoryFilterMenu.querySelector('#yl_stream_category_filter_clear');
  clearAllButton.addEventListener('click', (e) => {
    e.preventDefault();
    clearAllCategoryFilters();
    updateCategoryVisibility();
  });
  
  updateCategoryEntryCounts(); // Run once, let `onNewFeedItems()` handle subsequent updates.
  updateCategoryVisibility();
}

function updateCategoryEntryCounts() {
  // Update the counts shown in the category filter menu.
  const categoryFilterMenu = document.getElementById('yl_stream_category_filter');
  if (!categoryFilterMenu) return;

  countObj = app.state.youlag.categoryFilterEntryCount || {};

  const categoryFilter = categoryFilterMenu.querySelectorAll('.yl-stream-category-filter-options__item');

  categoryFilter.forEach(filter => {
    let categoryId = filter?.getAttribute('data-category');
    const countSpan = filter?.querySelector('.yl-stream-category-filter__count');

    if (categoryId && countSpan) {
      const key = `c_${categoryId}`;
      // TODO: Currently using naive implementation of count during experimental phase.
      // Optimize later when the proper implementation `setWatchLaterCategoryFilter()` is defined. 
      count = document.querySelectorAll(`${app.frss.el.entry}[data-category="${categoryId}"]`).length;

      countObj[key] = { count };
      app.state.youlag.categoryFilterEntryCount = countObj;

      countSpan.textContent = `(${count})`;
      filter.setAttribute('data-yl-entry-count', count);
    }
  });
}

/*****************************************
 * END "UI COMPONENTS"
 ****************************************/



/*****************************************
 * BEGIN "UI UTILITIES"
 * General utility functions for UI handling.
 ****************************************/

function setPageTitle(title) {
  if (typeof title === 'string' && title.length > 0) {
    if (app.state.page.titlePrev === null) {
      app.state.page.titlePrev = document.title;
    }
    // Set new title
    document.title = title;
  }
  else if (app.state.page.titlePrev !== null) {
    // Restore previous title
    document.title = app.state.page.titlePrev;
    app.state.page.titlePrev = null;
  }
}

function toggleFavorite(url, container, feedItemEl = null) {
  const hasFeedStream = isFeedPage();
  const favoriteButton = container.querySelector(`#${app.modal.id.favorite}`);
  const favoriteButtonIcon = favoriteButton ? favoriteButton.querySelector(`.${app.modal.class.favoriteIcon}`) : null;
  if (!favoriteButton) return;

  // Show loading spinner while processing
  favoriteButtonIcon.style.backgroundImage = `url("${app.frss.img.spinner}")`;
  favoriteButtonIcon.style.filter = 'invert(1)';
  favoriteButtonIcon.style.backgroundSize = '1.2rem';

  // Determine to favorite or unfavorite a feed entry based on the favorite button's current state.
  const isFavorited = favoriteButton.classList.contains(`${app.modal.class.favorite}--true`);
  const toggleUrl = new URL(url);
  toggleUrl.searchParams.delete('is_favorite');
  if (isFavorited) toggleUrl.searchParams.set('is_favorite', '0');

  const csrfToken = document.querySelector('#stream-footer input[name="_csrf"]')?.getAttribute('value') || '';
  fetch(toggleUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ ajax: true, _csrf: csrfToken })
  })
    .then(response => {

      // Remove loading spinner
      favoriteButtonIcon.removeAttribute('style');

      if (response.ok) {
        // Toggle favorite classes and icons.
        const currentlyTrue = favoriteButton.classList.contains(`${app.modal.class.favorite}--true`);
        favoriteButton.classList.remove(`${app.modal.class.favorite}--${currentlyTrue}`);
        favoriteButton.classList.add(`${app.modal.class.favorite}--${!currentlyTrue}`);

        if (!feedItemEl && hasFeedStream || feedItemEl && !(feedItemEl instanceof Element) && hasFeedStream) {
          // Try to find the feed entry in the feed stream if not provided.
          // This may be needed when restoring modal event listeners after `visibilitychange`: `setupVisibilityEventListeners()`.
          const entryId = getModalVideo()?.getAttribute('data-entry');
          if (entryId) {
            feedItemEl = document.querySelector(`${app.frss.el.feedRoot} div.flux${app.frss.el.entry}[data-entry="${entryId}"]`);
          }
        }

        // Keep the feed entry in the feed stream in sync, if the current page is a feed page and the entry exists in the feed stream.
        // The miniplayer video modal could be restored to a different page/state, meaning that the feed entry might not exist in the view. 
        if (feedItemEl && feedItemEl instanceof Element && hasFeedStream) {
          const bookmarkIcon = feedItemEl.querySelector('.item-element.bookmark img.icon');
          if (currentlyTrue) {
            feedItemEl.classList.remove(app.modal.class.favorite);
            if (bookmarkIcon) {
              bookmarkIcon.src = app.frss.img.favoriteInactive;
            }
          }
          else {
            feedItemEl.classList.add(app.modal.class.favorite);
            if (bookmarkIcon) {
              bookmarkIcon.src = app.frss.img.favoriteActive;
            }
          }
        }
      }
      else {
        console.error('Youlag: Failed to toggle favorite status');
      }
    })
    .catch(error => {
      console.error('Youlag: Error toggling favorite status:', error);
    });
}

function clearPathHash() {
  // Clear the URL hash to prevent dropdown menus from opening on page load.
  // Related to the css hacks used in: "Dropdown custom mobile behavior hacks".
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

function updateVideoAuthor() {
  // youlag-active: On video cards, use move out the `.author` element outside of the video title.
  // This prevents the author from being truncated in the title line, and is always displayed regardless of title length.

  // TODO: refactor hardcoded querySelectorAll to use global `app` references.
  const feedCards = document.querySelectorAll('#stream div[data-feed]:not(.yl-modified--author)');
  feedCards.forEach(card => {
    const author = card.querySelector('.flux_header .item.titleAuthorSummaryDate .title .author');
    const title = card.querySelector('.flux_header .item.titleAuthorSummaryDate .title');
    const websiteName = card.querySelector('.flux_header .item.website .websiteName');
    if (author && title && title.parentNode) {
      if (websiteName) {
        // Use website name instead of author name.
        author.textContent = `${websiteName.textContent.trim()}`;
      }
      // Move author (website name) element after title element.
      title.parentNode.insertBefore(author, title.nextSibling);
      card.classList.add('yl-modified--author');
    }
  });
}

function updateVideoDateFormat() {
  // youlag-active: On video cards, update to use relative date.

  // TODO: refactor hardcoded querySelectorAll to use global `app` references.
  const feedCards = document.querySelectorAll('#stream div[data-feed]:not(.yl-modified--date)');
  feedCards.forEach(card => {
    const date = card.querySelector('.flux_header .item.titleAuthorSummaryDate .date time');
    if (date) {
      const datetime = date.getAttribute('datetime');
      if (datetime) {
        const relativeDate = typeof getRelativeDate === 'function' ? getRelativeDate(datetime) : (typeof getRelativeTime === 'function' ? getRelativeTime(datetime) : null);
        if (relativeDate) {
          date.textContent = relativeDate;
          card.classList.add('yl-modified--date');
        }
      }
    }
  });
}

function setVideoCardLink() {
  // Allow ability to right click and open a video card in new tab by adding a link with ylvideo param.
  const feedCards = document.querySelectorAll(`${app.frss.el.feedRoot} ${app.frss.el.entry}:not(.yl-modified--link)`);
  feedCards.forEach(card => {
    const entryId = card.getAttribute('data-entry');
    if (!entryId) return;
    const anchor = document.createElement('a');
    const directLink = getVideoParamUrl(entryId);
    anchor.href = directLink;
    anchor.className = 'yl-video-card__link';
    const cardContainer = card.querySelector('ul.flux_header');
    if (cardContainer) {
      cardContainer.insertBefore(anchor, cardContainer.firstChild);
    }
    card.classList.add('yl-modified--link');
  });
}

function onNewFeedItems() {
  // Run actions based on if there's new items added to the feed stream.
  document.addEventListener('freshrss:load-more', function () {
    if (isLayoutVideo()) {
      updateVideoAuthor();
      updateVideoDateFormat();
      setVideoCardLink();

      if (isWatchLaterPage() && app.state.youlag.experimentalFeatureEnabled === true) {
        updateCategoryEntryCounts();
      }
    }

    handleFeedDearrowFeatures();
  }, false);
}

/*****************************************
 * END "UI UTILITIES"
 ****************************************/
