/**
 * UI - General
 * 
 * Handles general UI interactions, including click listeners, popstate handling, etc.
 */

function setupClickListener() {
  // youlag-active: Video mode
  if (app.state.youlag.clickListenerInit) return;
  const streamContainer = document.querySelector(app.frss.el.feedRoot);

  if (app.state.page.layout === 'video') {
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
          collapseBackgroundFeedItem(target);
        }
        else {
          // Otherwise, observe until it's active, then collapse it.
          const observer = new MutationObserver((mutationsList, observer) => {
            if (target.classList.contains('active')) {
              collapseBackgroundFeedItem(target);
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

        if (app.state.modal.mode === 'fullscreen' && getModalVideo()) {
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

        if (app.state.modal.mode === 'miniplayer') {
          // Allow normal browser navigation when in miniplayer mode.
          app.state.popstate.ignoreNext = true;
          history.back();
          return;
        }
      });
    }
  }
  else if (app.state.page.layout === 'article') {
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
        const ylCategoryToolbar = document.getElementById(app.modal.id.toolbar);
        app.state.page.toolbarSticky = true;
        ylCategoryToolbar.classList.remove('sticky-visible');
        ylCategoryToolbar.classList.add('sticky-hidden');

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
                app.state.page.toolbarSticky = false;
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
      if (app.state.modal.mode === 'miniplayer' && getOpenArticle()) {
        closeArticle(event);
        return;
      }
      if (app.state.modal.mode === 'miniplayer' && !getOpenArticle()) {
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
        if (app.state.page.layout === 'video') {
          // youlag-active: Video modal context.
          const modal = getModalVideo();
          if (modal) {
            closeModalVideo();
          }
        }
        else if (app.state.page.layout === 'article') {
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

function isHashUrl() {
  const currentPathnameSearch = window.location.pathname + window.location.search;
  const isHash = app.state.popstate.pathPrev === currentPathnameSearch && window.location.hash;
  app.state.popstate.pathPrev = currentPathnameSearch;
  return isHash;
}

function toggleFavorite(url, container, feedItemEl) {
  console.log('Toggling favorite status via URL:', url);
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
