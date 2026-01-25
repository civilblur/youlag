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
  // youlag-active: Video mode
  if (app.state.youlag.clickListenerInit) return;
  const streamContainer = document.querySelector(app.frss.el.feedRoot);

  if (isLayoutVideo()) {
    if (streamContainer) {
      streamContainer.addEventListener('click', (event) => {

        const target = event.target.closest(app.frss.el.entry);
        if (!target) return;
        
        // Do not expand video modal if clicking on the card action buttons.
        const actionButtons = [
          'li.manage',
          'li.labels',
          'li.share',
          'li.link',
          '.website a[href^="./?get=f_"]'
        ].join(', ');
        if (event.target.closest(actionButtons)) return;
  
        handleActiveVideo(event);
        // Ensure the native freshrss view does not expand the feed item when clicked.
        if (target.classList.contains('active')) {
          forceFrssEntryToCollapse(target);
        }
        else {
          // Otherwise, observe until it's active, then collapse it.
          const observer = new MutationObserver((mutationsList, observer) => {
            if (target.classList.contains('active')) {
              forceFrssEntryToCollapse(target);
              observer.disconnect();
            }
          });
          observer.observe(target, { attributes: true, attributeFilter: ['class'] });
        }
      });
      
      window.addEventListener('popstate', function popstateHandler(e) {
        // youlag-active: Only handle video modal if in fullscreen mode, otherwise allow normal browser navigation.

        if (isHashUrl(app.state.popstate.pathPrev)) {
          // Ignore popstate if only the hash changed
          return;
        }

        if (isModeFullscreen() && getModalVideo()) {
          // Video in fullscreen mode should be closed on popstate and not navigate back a page.
          app.state.popstate.allowBack = false;
          closeModalVideo();
          return;
        }

        if (app.state.popstate.ignoreNext) {
          app.state.popstate.ignoreNext = false;
          app.state.popstate.allowBack = false;
          return;
        }

        if (isModeMiniplayer()) {
          // Allow normal browser navigation when in miniplayer mode.
          app.state.popstate.ignoreNext = true;
          history.back();
          return;
        }
      });
    }
  }
  else if (isLayoutArticle()) {
    // youlag-inactive: Article context.
    if (streamContainer) {
      streamContainer.addEventListener('click', function (event) {
        const target = event.target.closest(app.frss.el.entry);
        if (!target) return;

        // Do not expand article and perform e.g. auto-scroll if clicking on the card action buttons.
        const actionButtons = [
          '.flux_header li.manage',
          '.flux_header li.labels',
          '.flux_header li.share',
          '.flux_header li.link',
          '.flux_header li.website',
          '.flux_content',
        ].join(', ');
        if (event.target.closest(actionButtons)) return;

        if (!app.state.modal.active) {
          handleActiveArticle(event);
          app.state.modal.active = true;
        }

        // Scroll to top of the article when opened.
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

        // Prevent sticky category title from showing when auto-scrolling.
        const toolbar = document.getElementById(app.modal.id.toolbar);
        setToolbarStickyState(true);
        toolbar.classList.remove('sticky-visible');
        toolbar.classList.add('sticky-hidden');

        // Scroll to article, retry to ensure correct position due to the element expanding.
        let attempts = 0;
        const maxAttempts = 4;
        const scroll = () => {
          const targetScroll = scrollToTarget();
          window.scrollTo({
            top: targetScroll,
          });
          const assessScrollPosition = () => {
            attempts++;
            const newTargetScroll = scrollToTarget();
            if (Math.abs(window.pageYOffset - newTargetScroll) > 2 && attempts < maxAttempts) {
              window.requestAnimationFrame(scroll);
            }
            else {
              setTimeout(() => {
                setToolbarStickyState(false);
              }, 50);
            }
          };
          window.setTimeout(assessScrollPosition, 180);
        };
        scroll();
      });
    }

    window.addEventListener('popstate', function (event) {
      function getOpenArticle() {
        return document.querySelector(app.frss.el.current);
      }

      if (isHashUrl()) {
        // Ignore hash-only routes, e.g. when clicking dropdown menus that routes to e.g. `#dropdown-configure`.
        return;
      }
      if (isModeMiniplayer() && getOpenArticle()) {
        closeArticle(event);
        return;
      }
      if (isModeMiniplayer() && !getOpenArticle()) {
        history.back();
      }
      else {
        if (getOpenArticle()) {
          // Close the open article if one is open when navigating back.
          closeArticle(event);
        }
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        if (isLayoutVideo()) {
          // youlag-active: Video modal context.
          const modal = getModalVideo();
          if (modal) {
            closeModalVideo();
          }
        }
        else if (isLayoutArticle()) {
          // youlag-inactive: Article context.

          // TODO: FreshRSS apparently has a native Escape key handler that closes the article, and ends up closing 
          // the article before `openedArticle` can be queried, thus never calling for `closeArticle()`.
          // This behavior is hard to replicate in local, but is apparent in production. 
          const openedArticle = document.querySelector(app.frss.el.current);
          if (openedArticle) {
            closeArticle(event);
          }
        }
      }
    });
  }
  app.state.youlag.clickListenerInit = true;
}

function setupTagsDropdownOverride() {
  // Delegated eventlistener to override tags (labels/playlists) dropdown click
  const streamContainer = document.querySelector(app.frss.el.feedRoot);
  if (!streamContainer) return;

  streamContainer.addEventListener('click', async function (event) {
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
      const tagsModalButton = event.target.closest(`#${app.modal.id.tags}`); // Modal tags button
      const tagsModalButtonIcon = tagsModalButton ? tagsModalButton.querySelector('img.icon') : null;

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
        iconImg.src = '../themes/icons/spinner.svg';
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

function isHashUrl() {
  const currentPathnameSearch = window.location.pathname + window.location.search;
  const isHash = app.state.popstate.pathPrev === currentPathnameSearch && window.location.hash;
  app.state.popstate.pathPrev = currentPathnameSearch;
  return isHash;
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
    settingsShortcut.innerHTML = `<a href="/i/?c=extension&a=configure&e=Youlag" class="btn" target="_blank" rel="noopener noreferrer">
                                    More settings
                                  </a>`;
    menuContent.appendChild(settingsShortcut);
  }
  
  // Make the toolbar sticky on scroll.
  setToolbarSticky(toolbar);

  document.addEventListener('click', function (e) {
    // Allow toggling the view options via 'Configure view' button in the toolbar.
    const toggleBtn = e.target.closest('#yl_nav_menu_container_toggle');
    const menuLink = e.target.closest('#yl_nav_menu_container_content a');
    if (!(toggleBtn && toolbar) && !(menuLink && toolbar)) return;

    if (toggleBtn && toolbar) {
      const isOpen = toolbar.classList.toggle('yl-nav-menu-container--open');
      menuContent.hidden = !isOpen;
      setToolbarStickyState(true);
      setTimeout(() => {
        setToolbarStickyState(false);
      }, 100);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (menuLink && toolbar) {
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

  if (document.getElementById(app.frss.id.logo)) return;

  let pageContainer;
  let frssGlobal = document.querySelector(app.frss.el.global);
  pageContainer = frssGlobal ? frssGlobal : document.body;

  const logo = document.createElement('div');
  logo.id = app.frss.id.logo;
  logo.innerHTML = `
    <a href="/i/">
      <img id="${app.frss.id.logoImg}" src="../themes/icons/FreshRSS-logo.svg" alt="FreshRSS" loading="lazy">
    </a>
  `;
  pageContainer.appendChild(logo);
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

function toggleFavorite(url, container, feedItemEl) {
  const favoriteButton = container.querySelector(`#${app.modal.id.favorite}`);
  const favoriteButtonIcon = favoriteButton ? favoriteButton.querySelector('.youlag-favorited-icon') : null;
  if (!favoriteButton) return;

  // Show loading spinner while processing
  favoriteButtonIcon.style.backgroundImage = 'url("../themes/icons/spinner.svg")';
  favoriteButtonIcon.style.filter = 'invert(1)';
  favoriteButtonIcon.style.backgroundSize = '1.2rem';

  fetch(url, { method: 'GET' })
    .then(response => {

      // Remove loading spinner
      favoriteButtonIcon.style.backgroundImage = '';
      favoriteButtonIcon.style.filter = '';
      favoriteButtonIcon.style.backgroundSize = '';
      
      if (response.ok) {
        // Toggle favorite classes and icons.
        const currentlyTrue = favoriteButton.classList.contains(`${app.modal.class.favorite}--true`);
        favoriteButton.classList.remove(`${app.modal.class.favorite}--${currentlyTrue}`);
        favoriteButton.classList.add(`${app.modal.class.favorite}--${!currentlyTrue}`);

        // Only update DOM if feedItemEl exists (i.e., not restoring from localStorage).
        if (feedItemEl) {
          const bookmarkIcon = feedItemEl.querySelector('.item-element.bookmark img.icon');
          if (currentlyTrue) {
            feedItemEl.classList.remove(app.modal.class.favorite);
            if (bookmarkIcon) {
              bookmarkIcon.src = '../themes/Mapco/icons/non-starred.svg';
            }
          }
          else {
            feedItemEl.classList.add(app.modal.class.favorite);
            if (bookmarkIcon) {
              bookmarkIcon.src = '../themes/Mapco/icons/starred.svg';
            }
          }
        }
      }
      else {
        console.error('Failed to toggle favorite status');
      }
    })
    .catch(error => {
      // Remove loading spinner and filter on error
      favoriteButton.style.backgroundImage = '';
      favoriteButton.style.filter = '';
      favoriteButton.style.backgroundRepeat = '';
      favoriteButton.style.backgroundPosition = '';
      favoriteButton.style.backgroundSize = '';
      console.error('Error:', error);
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
  
  // TODO: refactor hardcoded querySelectorAll 
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

  // TODO: refactor hardcoded querySelectorAll
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

function onNewFeedItems() {
  // Run actions based on if there's new items added to the feed stream.

  document.addEventListener('freshrss:load-more', function () {
    if (isLayoutVideo()) {
      updateVideoAuthor();
      updateVideoDateFormat();
    }
  }, false);
}

/*****************************************
 * END "UI UTILITIES"
 ****************************************/
