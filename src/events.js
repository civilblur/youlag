function getCurrentPage() {
  // Notate the current page through css class on the body element.
  // E.g. yl-page-home, yl-page-important, yl-page-category, etc.
  const path = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const classPrefix = 'yl-page-';

  function prefixClasses(classString) {
    return classString.split(' ').map(cls => classPrefix + cls).join(' ');
  }

  const routes = [
    {
      path: '/i/',
      match: () => urlParams.get('a') === 'normal' && urlParams.has('search'),
      className: 'search_results',
    },
    {
      path: '/i/',
      // Home page: no get or c param
      match: () => !urlParams.has('get') && !urlParams.has('c'),
      className: 'home',
    },
    {
      path: '/i/',
      match: () => urlParams.get('c') === 'extension',
      className: 'extension',
    },
    {
      path: '/i/',
      match: () => urlParams.get('get') === 'i',
      className: 'important',
    },
    {
      path: '/i/',
      match: () => urlParams.get('get') === 's',
      className: 'watch_later',
    },
    {
      path: '/i/',
      match: () => urlParams.get('get') === 'T',
      className: 'playlists',
    },
    {
      path: '/i/',
      match: () => /^t_\d+$/.test(urlParams.get('get') || ''),
      className: () => {
        const n = (urlParams.get('get') || '').substring(2);
        return `playlists t_${n}`;
      },
    },
    {
      path: '/i/',
      // Category page: get param starts with c_
      match: () => urlParams.get('get') && urlParams.get('get').startsWith('c_'),
      className: () => {
        const n = urlParams.get('get').substring(2);
        return `category c_${n}`;
      },
    },
    {
      path: '/i/',
      match: () => (urlParams.get('get') && urlParams.get('get').startsWith('f_')),
      className: () => {
        const n = urlParams.get('get').substring(2);
        return `category`;
      },
    },
  ];

  for (const route of routes) {
    if (path === route.path && route.match()) {
      const classString = typeof route.className === 'function' ? route.className() : route.className;
      return prefixClasses(classString);
    }
  }

  return '';
}

function getSubpageParentId(getParam) {
  /**
   * Check parent of current subpage.
   * Returns the parent category id for a given getParam (e.g. 't_8' or 'f_8').
   * For 't_{n}' returns 'tags'.
   * For 'f_{n}' returns the DOM id of the active category (e.g. 'c_2'), or null if not found.
   */
  if (/^t_\d+$/.test(getParam)) {
    // Tag (playlists) page
    return 'playlists';
  }
  if (/^f_\d+$/.test(getParam)) {
    // Filter page, a subpage of a category.
    const activeElem = document.querySelector('#sidebar .tree-folder.category.active');
    if (activeElem && activeElem.id) {
      return activeElem.id; // e.g. 'c_{n}'
    }
    return null;
  }
  return null;
}

function getCategoryWhitelist() {
  // Retrieve the category whitelist.
  // `setCategoryWhitelist()` in `extension.php` outputs the user data to the DOM.
  const el = document.querySelector('#yl_category_whitelist');
  if (!el) return [];

  const data = el.getAttribute('data-yl-category-whitelist');
  if (!data) return ['all'];
  const whitelist = data.split(',').map(s => s.trim()).filter(Boolean);

  try {
    localStorage.setItem('youlagCategoryWhitelist', JSON.stringify(whitelist));
  } catch (e) { }

  return whitelist;
}

function isPageWhitelisted(whitelist, currentPageClass) {
  if (!Array.isArray(whitelist) || !currentPageClass) return false;

  // If 'all' is included, it means every page and category will use the Youlag interface.
  if (whitelist.includes('all')) return true;

  // Check if parent pages are whitelisted.
  const pageTypes = ['home', 'important', 'watch_later', 'playlists', 'search_results'];
  for (const pt of pageTypes) {
    if (currentPageClass === `yl-page-${pt}` && whitelist.includes(pt)) {
      return true;
    }
  }

  // Check if category pages are whitelisted.
  if (currentPageClass.startsWith('yl-page-category')) {
    const match = currentPageClass.match(/c_(\d+)/);
    if (match && whitelist.includes('c_' + match[1])) {
      return true;
    }
  }

  // Check if subpage parent category is whitelisted.
  const urlParams = new URLSearchParams(window.location.search);
  const getParam = urlParams.get('get');
  if (getParam) {
    const parentId = getSubpageParentId(getParam);
    if (parentId && whitelist.includes(parentId)) {
      return true;
    }
  }

  return false;
}

function setCategoryWhitelistClass() {
  // Quickly apply youlag-category-whitelist class based on localStorage to reduce layout shifts.

  let localStorageWhitelist = [];
  try {
    const stored = localStorage.getItem('youlagCategoryWhitelist');
    if (stored) localStorageWhitelist = JSON.parse(stored);
  } catch (e) { }

  const currentPageClass = getCurrentPage();
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

function setSidenavState() {
  // Update body classes based on sidenav state (expanded/collapsed)
  const sidenav = document.getElementById('aside_feed');
  if (!sidenav) return;
  const expanded = sidenav.classList.contains('visible');
  document.body.classList.toggle('youlag-sidenav--expanded', expanded);
  document.body.classList.toggle('youlag-sidenav--collapsed', !expanded);
}

function setupSidenavStateListener() {
  // Listen for class changes on #aside_feed and update body classes
  const sidenav = document.getElementById('aside_feed');
  if (!sidenav) return;
  setSidenavState();
  const observer = new MutationObserver(setSidenavState);
  observer.observe(sidenav, { attributes: true, attributeFilter: ['class'] });
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

function setBodyPageClass() {
  getCurrentPage() && (document.body.className += ' ' + getCurrentPage());
  currentPageParams = new URLSearchParams(window.location.search).get('get');
  setMobileLayoutGrid();
  setupSidenavStateListener();
  getSubpageParentId(currentPageParams) && (document.body.className += ' yl-page-' + getSubpageParentId(currentPageParams));
  setVideoLabelsClass();
  setCategoryWhitelistClass();
  setUnreadBadgeClass();
  setPageSortingClass();
  document.body.setAttribute('data-youlag-version', app.metadata.version);
}

function isFeedPage() {
  // Determine if the current page is a feed page, and not e.g. settings or extensions page.
  const feedPageClasses = [
    'yl-page-home',
    'yl-page-important',
    'yl-page-watch_later',
    'yl-page-playlists',
    'yl-page-category',
    'yl-page-search_results',
  ];
  // Check body if classes exist
  const isFeedPage = feedPageClasses.some(feedPage => document.body.classList.contains(feedPage));
  return isFeedPage;
}

function isVideoLabelsEnabled() {
  // If user has enabled video labels setting, where "Favorites" becomes "Watch Later", and "My Labels" becomes "Playlists".
  return document.body.classList.contains('youlag-video-labels');
}

function setVideoLabelsTitle(pageClass, newTitle) {
  if (document.body.classList.contains(pageClass) && isVideoLabelsEnabled()) {
    // Replace the middle text of the tab title, e.g. "(3) Some Text · FreshRSS" to "(3) ${newTitle} · FreshRSS"
    // Primarily for 'Playlists' and 'Watch Later' pages.
    const titleMatch = document.title.match(/^\s*(\((\d+)\)\s*)?(.+?)\s*·\s*(.+?)\s*$/);
    if (titleMatch) {
      const countPart = titleMatch[1] ? titleMatch[1] : '';
      const customSuffix = titleMatch[4] ? titleMatch[4] : ''; // In case the user has rename their FreshRSS instance.
      document.title = `${countPart}${newTitle} · ${customSuffix}`;
    }
  }
}

function setupNavMenu() {
  if (app.state.youlag.navMenuInit) return;
  app.state.youlag.navMenuInit = true;

  const ylCategoryToolbar = document.getElementById('yl_category_toolbar');
  const ylNavMenuContainer = document.getElementById('yl_nav_menu_container');
  const ylNavMenu = ylNavMenuContainer?.querySelector('#yl_nav_menu_container_content');
  const ylNavMenuToggle = ylCategoryToolbar?.querySelector('#yl_nav_menu_container_toggle');


  const freshRssToggleSearch = document?.querySelector('#dropdown-search-wrapper');
  const freshRssNavMenu = document.querySelector('#global nav.nav_menu:not(#yl_nav_menu_container)');

  // Fail gracefully 
  if (!ylNavMenuContainer || !ylNavMenu || !ylNavMenuToggle || !freshRssNavMenu || !ylCategoryToolbar) {
    const missing = [];
    if (!ylNavMenuContainer) missing.push('ylNavMenuContainer');
    if (!ylNavMenu) missing.push('ylNavMenu');
    if (!ylNavMenuToggle) missing.push('ylNavMenuToggle');
    if (!freshRssNavMenu) missing.push('freshRssNavMenu');
    if (!ylCategoryToolbar) missing.push('ylCategoryToolbar');
    console.warn('Failed to setup sticky nav menu, missing elements:', missing);
    return;
  }

  ylNavMenu.hidden = true; // `#yl_nav_menu_container_content` is hidden by default.
  ylNavMenu.classList.add('nav_menu'); 

  ylCategoryToolbar.classList.add('yl-category-toolbar--sticky');
  // ylNavMenuContainer.classList.add('yl-nav-menu-container--sticky');

  // Place `#yl_category_toolbar` after `#new-article` notification.
  const domLocation = document.querySelector('#stream #new-article');
  if (domLocation && ylCategoryToolbar) {
    if (domLocation.nextSibling) {
      domLocation.parentNode.insertBefore(ylCategoryToolbar, domLocation.nextSibling);
    } else {
      domLocation.parentNode.appendChild(ylCategoryToolbar);
    }
  }

  if (freshRssToggleSearch) {
    // Break out search from the FreshRSS `.nav_menu` container, to keep it independent for styling.
    if (ylCategoryToolbar.nextSibling) {
      ylCategoryToolbar.parentNode.insertBefore(freshRssToggleSearch, ylCategoryToolbar.nextSibling);
    } 
  }
  if (freshRssNavMenu && ylNavMenu) {
    // Move FreshRSS `.nav_menu` items inside Youlag's own `.nav_menu` content, ylNavMenu (child of ylNavMenuContainer).
    const navMenuChildren = Array.from(freshRssNavMenu.children);
    navMenuChildren.forEach(child => {
      if (child.id !== 'nav_menu_toggle_aside') {
        // Exclude the sidebar toggle button, as that its position placement is handled via css already.
        ylNavMenu.appendChild(child);
      }
    });
    const settingsShortcut = document.createElement('div');
    settingsShortcut.id = 'yl_nav_menu_settings_shortcut';
    settingsShortcut.innerHTML = `<a href="/i/?c=extension&a=configure&e=Youlag" class="btn" target="_blank" rel="noopener noreferrer">
                                    More settings
                                  </a>`;
    ylNavMenu.appendChild(settingsShortcut);
  }
  
  // Setup sticky scroll behavior for FreshRSS `.transition` and Youlag `.nav_menu`, ylNavMenuContainer.
  setupNavMenuStickyScroll(ylCategoryToolbar, ylNavMenuContainer);

  document.addEventListener('click', function (e) {
    // Toggle custom Youlag `ylNavMenu`, on click 'Configure view' button.
    const toggleBtn = e.target.closest('#yl_nav_menu_container_toggle');
    if (toggleBtn && document.body.contains(ylNavMenuContainer)) {
      const isOpen = ylCategoryToolbar.classList.toggle('yl-nav-menu-container--open');
      ylNavMenu.hidden = !isOpen;
      app.state.page.navMenuSticky = true;
      setTimeout(() => {
        app.state.page.navMenuSticky = false;
      }, 100);
      e.preventDefault();
      e.stopPropagation();
    }

    const menuLink = e.target.closest('#yl_nav_menu_container_content a');
    if (menuLink && document.body.contains(ylNavMenuContainer)) {
      // Allow mobile dropdown to expand without causing scroll events to hide the toolbar. 
      app.state.page.navMenuSticky = true;
      setTimeout(() => {
        app.state.page.navMenuSticky = false;
      }, 100);
    }
  });
}

function setupNavMenuStickyScroll(ylCategoryToolbar) {
  // Setup scroll listener to show/hide the Youlag `.nav_menu`. Visible while scrolling up, hidden while scrolling down.
  let lastScrollY = window.scrollY;
  let ticking = false;
  let ignoreNextScroll = false; // 'Configure view' toggling expands ylCategoryToolbar, causing unwanted scroll events. Prevent those.  

  function setStickyVisibility(show) {
    if (app.state.page.navMenuSticky) return;
    ylCategoryToolbar.classList.toggle('sticky-visible', show);
    ylCategoryToolbar.classList.toggle('sticky-hidden', !show);
  }

  function setStickyVisibilitySidenavToggle(show) {
    const sidenavToggle = document.getElementById('nav_menu_toggle_aside');
    if (sidenavToggle) {
      /* Desktop: Hide show the sidenav toggle button based on scroll direction. */
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

function setPageSortingClass() {
  // Adds css class e.g. `youlag-sort-watch_later--user-modified`.
  // Used as a reference for determining the user settings, and run functions based on that.
  if (getAttrValue('data-yl-video-sort-modified') === 'true') {
    document.body.classList.add('youlag-sort-watch_later--user-modified');
  }
}

function clearPathHash() {
  // Clear the URL hash to prevent dropdown menus from opening on page load.
  // Related to the css hacks used in: "Dropdown custom mobile behavior hacks".
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

function init() {
  clearPathHash();
  setBodyPageClass();
  if (isFeedPage()) {
    setupClickListener();
    setupTagsDropdownOverride();
    setupNavMenu();
    if (app.state.page.layout === 'video') {
      updateVideoAuthor();
      updateVideoDateFormat();
    }
    onNewFeedItems()
    restoreVideoQueue();
  }
  updateSidenavLinks();
  setTimeout(() => {
    // HACK: Delay referencing the settings elements.
    youlagSettingsPageEventListeners();
  }, 1500);
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