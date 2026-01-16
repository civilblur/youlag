function createModalVideo(videoObject) {
  // Create custom modal
  let modal = getModalVideo();

  if (!modal) {
    modal = document.createElement('div');
    modal.id = app.modal.id.root;
    modal.innerHTML = `<div class="${app.modal.class.container}"></div>`;
    document.body.appendChild(modal);

    if (app.state.modal.mode === 'fullscreen') {
      app.state.modal.active = true;
    }
  }
  
  if (!modal._videoModalListeners) {
    // Track modal event listeners for later removal
    modal._videoModalListeners = [];
  }
  else {
    modal._videoModalListeners.length = 0;
  }

  // Add content to modal
  const container = modal.querySelector(`.${app.modal.class.container}`);
  const videoSourceDefault = videoObject.video_source_default;
  const youtubeSelected = videoSourceDefault === 'youtube' ? 'selected' : '';
  const invidiousSelected = videoSourceDefault === 'invidious_1' ? 'selected' : '';
  const invidiousBaseUrl = videoObject.video_invidious_instance_1;
  modal.classList.remove('youlag-modal-feed-item--has-thumbnail', 'youlag-modal-feed-item--no-thumbnail');
  videoObject.thumbnail
    ? modal.classList.add('youlag-modal-feed-item--has-thumbnail')
    : modal.classList.add('youlag-modal-feed-item--no-thumbnail');

  // Check if user settings allow swipe-to-miniplayer mode, setup if enabled.
  const miniplayerSwipeEnabledElement = document.querySelector('#yl_miniplayer_swipe_enabled');
  const miniplayerSwipeEnabled = miniplayerSwipeEnabledElement?.getAttribute('data-yl-mini-player-swipe-enabled') === 'true';
  if (miniplayerSwipeEnabled) {
    setupSwipeToMiniplayer(modal);
  }

  function getEmbedUrl(source) {
    // Helper to get the correct embed URL for a given source
    if (source === 'invidious_1' && videoObject.video_invidious_instance_1 && videoObject.youtubeId) {
      return `${videoObject.video_invidious_instance_1.replace(/\/$/, '')}/embed/${videoObject.youtubeId}`;
    }
    else if (source === 'youtube') {
      return videoObject.youtube_embed_url;
    }
    return '';
  }

  // Determine the initial video source (default)
  const videoSourceDefaultNormalized = videoSourceDefault === 'invidious_1' ? 'invidious_1' : 'youtube';
  const defaultEmbedUrl = getEmbedUrl(videoSourceDefaultNormalized);

  // Determine device (viewport size), to collapse video description on mobile.
  const isMobile = window.innerWidth <= app.breakpoints.desktop_md_max; 
  const isArticle = !videoObject.youtubeId;
  const shouldCollapseDescription = isMobile && !isArticle && getRelatedVideoSetting() !== 'none';

  setPageTitle(videoObject.title);

  container.innerHTML = `
    <div class="${app.modal.class.content}">

      <div class="youlag-video-header">
        <select id="${app.modal.id.source}" class="${invidiousBaseUrl && videoObject.isVideoFeedItem ? '' : 'display-none'}">
          <option value="youtube" ${youtubeSelected}>YouTube</option>
          <option value="invidious_1" ${invidiousSelected}>Invidious</option>
        </select>

        <button id="${app.modal.id.minimize}" title="Minimize or expand">⧉</button>
        <button id="${app.modal.id.close}" title="Close">×</button>
      </div>

      <div class="youlag-video-container">
        <div class="youlag-thumbnail-container">
          <img src="${videoObject.thumbnail}" class="youlag-video-thumbnail" loading="lazy" />
        </div>
        <div class="youlag-iframe-container">
          <iframe class="youlag-iframe"
                  src="${defaultEmbedUrl}" frameborder="0" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        </div>
      </div>


      <div class="youlag-video-details">

        <div class="youlag-video-metadata-container">
          <h2 class="youlag-video-metadata-title">${videoObject.title}</h2>
          <div class="youlag-video-metadata-panel">

            <section class="youlag-video-author-section">
              <a class="youlag-video-metadata-favicon-link" href="${videoObject.author_filter_url}">
                <img src="${videoObject.favicon}" class="youlag-video-metadata-favicon" />
              </a>

              <div class="yl-flex yl-flex-col">
                <div class="youlag-video-metadata-author">
                  <a href="${videoObject.author_filter_url}">${videoObject.website_name}</a>
                </div>
                <div class="youlag-video-metadata-date">${videoObject.date}</div>
              </div>
            </section>

            <section class="youlag-video-actions-container">
              <a href="#" 
                class="yl-video-action-button ${app.modal.class.favorite} ${app.modal.class.favorite}--${videoObject.favorited}"
                id="${app.modal.id.favorite}">
                <div class="youlag-favorited-icon"></div>
              </a>

              <a href="#" 
                class="yl-video-action-button"
                id="${app.modal.id.tags}">
                <img class="icon" src="../themes/icons/label.svg" loading="lazy" alt="🏷️">
              </a>

              <a class="yl-video-action-button" href="${videoObject.external_link}" target="_blank">
                <span class="yl-video-action-button__icon">🌐</span><span>Source</span>
              </a>

              <a class="yl-video-action-button" href="${videoObject.video_youtube_url}" target="_blank">
                <span class="yl-video-action-button__icon">▶️</span><span>YouTube</span>
              </a>
              <a class="yl-video-action-button" href="${videoObject.video_invidious_redirect_url}" target="_blank">
                <span class="yl-video-action-button__icon">📺</span><span>Invidious</span>
              </a>

            </section>

          </div>

        </div>


        <div id="${app.modal.id.moreContainer}">
          <div
            class="${app.modal.class.descContainer} ${shouldCollapseDescription ? app.modal.class.descContainerCollapsed : ''}">
            ${videoObject.video_description}
          </div>
          <div id="${app.modal.id.relatedContainer}" class="youlag-video-related-container display-none">
            <h3 class="youlag-video-related-title">
              <span class="yl-form-category__original-label">More from favorites</span>
              <span class="yl-form-category__video-label">Watch more</span>
            </h3>
          </div>
        </div>
        
      </div>

    </div>
  `;

  const videoDescContainer = modal.querySelector(`.${app.modal.class.descContainer}`);
  if (
      videoDescContainer && 
      videoDescContainer.offsetHeight <= 90 &&
      app.state.modal.mode !== 'miniplayer'
    ) {
    // Once the video description has been populated, check if the height is small enough to not need collapsing.
    // Height is 0 when video is restored into miniplayer mode, thus, ignore that state and keep as is.
    videoDescContainer.classList.remove(app.modal.class.descContainerCollapsed);
  }

  function getRelatedVideoSetting() {
    // Return e.g. 'none', 'watch_later' (favorites), 'subscriptions', 'author'.
    // This defined the category that related videos will fetch entries from.
    const relatedVideosSource = document.querySelector('#yl_related_videos_source')?.getAttribute('data-yl-related-videos-source') || 'none';
    return relatedVideosSource;
  }

  function templateRelatedVideos(relatedVideoObj) {
    // The HTML template for a related video item.

    const relativeDate = getRelativeDate(relatedVideoObj.date);

    return `
      <div class="youlag-related-video-item" data-yl-feed="${relatedVideoObj.entryId}">
        <div class="youlag-related-video-item__feed-item-container display-none">
          ${relatedVideoObj.feedItem.outerHTML}
        </div>
        <div class="youlag-related-video-item__thumbnail"><img src="${relatedVideoObj.thumbnail}" loading="lazy" ></div>
        <div class="youlag-related-video-item__metadata">
          <div class="youlag-related-video-item__title">${relatedVideoObj.title}</div>
          <div class="youlag-related-video-item__author">${relatedVideoObj.website_name}</div>
          <div class="youlag-related-video-item__date">${relativeDate}</div>
        </div>
      </div>
    `
  };

  function appendRelatedVideos(currentEntryId, currentAuthorId) {
    // Append related videos to the video modal.
    const relatedVideosSource = getRelatedVideoSetting();
    if (relatedVideosSource === 'none' || relatedVideosSource === '') return;

    const currentlyViewing = currentEntryId;
    const relatedVideosContainer = container.querySelector(`#${app.modal.id.relatedContainer}`);
    if (!relatedVideosContainer) return;

    let relatedVideosPromise;

    switch (relatedVideosSource) {
      case 'watch_later':
        relatedVideosPromise = fetchRelatedItems(relatedVideosSource, 'rand', 10);
        break;
      case 'subscriptions':
        relatedVideosPromise = fetchRelatedItems(relatedVideosSource, '', 10);
        break;
      case 'author':
        relatedVideosPromise = fetchRelatedItems(`f_${currentAuthorId}`, '', 10);
        break;
      default:
        relatedVideosPromise = Promise.resolve([]);
    }

    relatedVideosPromise.then(videos => {
      if (!Array.isArray(videos) || videos.length === 0) return;
      videos.forEach(video => {
        const videoHtml = templateRelatedVideos(video);
        if (video.entryId === currentlyViewing) return; // Skip currently viewing video.
        relatedVideosContainer.insertAdjacentHTML('beforeend', videoHtml);
      });
      // Display the related videos container once appended.
      relatedVideosContainer.classList.remove('display-none');
    });

    relatedVideosContainer.addEventListener('click', function (e) {
      const relatedItem = e.target.closest('.youlag-related-video-item');
      if (!relatedItem) return;
      const feedItem = relatedItem.querySelector('.youlag-related-video-item__feed-item-container > div[data-feed]');
      if (feedItem) {
        const modal = getModalVideo();
        if (modal) {
          modal.scrollTo({ top: 0 });
        }
        handleActiveItemVideoMode(feedItem);
      }
    });

  }

  // Only update iframe src if the user interacts with the select (not on initial render).
  const videoSourceSelect = container.querySelector(`#${app.modal.id.source}`);
  const iframe = container.querySelector('.youlag-iframe');
  if (videoSourceSelect && iframe) {
    videoSourceSelect.addEventListener('change', function () {
      iframe.src = getEmbedUrl(videoSourceSelect.value);
    });
  }

  if (isArticle) {
    // Handle non-video feed items, such as text-based articles.
    modal.classList.add('youlag-modal-feed-item--text');
    let iframeContainer = document.querySelector('.youlag-iframe-container');
    if (iframeContainer) {
      document.querySelector('.youlag-iframe-container').remove();
    }
  }
  else {
    // When article is in miniplayer mode, and the next triggered item is a video, ensure the text class is removed.
    modal.classList.remove('youlag-modal-feed-item--text');
  }

  appendRelatedVideos(videoObject.entryId, videoObject.authorId);

  container.querySelector(`#${app.modal.id.close}`)?.addEventListener('click', closeModalVideo);
  container.querySelector(`#${app.modal.id.minimize}`)?.addEventListener('click', toggleModeMiniplayer);
  container.querySelector(`#${app.modal.id.favorite}`)?.addEventListener('click', (e) => {
    // Toggle favorites state in background.
    e.preventDefault();
    toggleFavorite(videoObject.favorite_toggle_url, container, videoObject.feedItemEl);
  });
  container.querySelector(`#${app.modal.id.tags}`)?.addEventListener('click', async (e) => {
    // Open tags (playlists) modal.
    e.preventDefault();
    createTagsModal(videoObject.entryId, await getItemTags(videoObject.entryId));
  });

  if (
    shouldCollapseDescription && videoDescContainer.offsetHeight > 90 || 
    shouldCollapseDescription && app.state.modal.mode === 'miniplayer') {
    // Setup the click listener to expand description only once.

    if (videoDescContainer) {
      const descExpand = function () {
        videoDescContainer.classList.remove(app.modal.class.descContainerCollapsed);
        videoDescContainer.removeEventListener('click', descExpand);
      };
      videoDescContainer.addEventListener('click', descExpand);
      modal._videoModalListeners.push({
        el: videoDescContainer,
        type: 'click',
        handler: descExpand
      });
    }
  }

  const escHandler = (event) => {
    if (event.key === 'Escape' && app.state.modal.mode === 'fullscreen') {
      closeModalVideo();
    }
  };
  document.addEventListener('keydown', escHandler);
  modal._videoModalListeners.push({
    el: document,
    type: 'keydown',
    handler: escHandler
  });

  // Push a new state to the history, to allow modal close when routing back.
  if (app.state.modal.mode === 'fullscreen' && !app.state.popstate.added) {
    history.pushState({ modalOpen: true }, '', '');
    app.state.popstate.added = true;
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && app.state.modal.mode === 'fullscreen') {
      closeModalVideo();
    }
  });
}

function closeModalVideo() {
  const modal = getModalVideo();

  // Remove all modal-specific listeners before removing the modal element
  if (modal && modal._videoModalListeners && Array.isArray(modal._videoModalListeners)) {
    for (const {el, type, handler} of modal._videoModalListeners) {
      el.removeEventListener(type, handler);
    }
    modal._videoModalListeners.length = 0;
  }
  
  if (modal) modal.remove();

  app.state.popstate.added = false;
  if (
    !app.state.popstate.allowBack && 
    history.state && 
    history.state.modalOpen && 
    (app.state.modal.mode === 'fullscreen')
  ) {
    // Only trigger history.back() once, and set the ignore flags.
    app.state.popstate.allowBack = false;
    app.state.popstate.ignoreNext = true;
    history.back();
  }
  else {
    history.replaceState(null, '', location.href);
  }
  app.state.modal.active = false;
  setModeMiniplayer(false);
  setModeFullscreen(false);
  setPageTitle();
  clearVideoQueue();
}

function closeArticle(event) {
  const openedArticle = document.querySelector('#stream div[data-feed].active.current');

  if (openedArticle) {
    // Focus closed article, to easier visually navigate where one last left off. 
    openedArticle.setAttribute('tabindex', '-1');
    openedArticle.focus({ preventScroll: true });

    // Close the article
    openedArticle.classList.remove('active', 'current');
    const rect = openedArticle.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    let offset = 0;

    if (window.getComputedStyle) {
      const root = document.documentElement;
      const val = getComputedStyle(root).getPropertyValue('--yl-topnav-height');
      if (val) {
        offset = parseInt(val.trim(), 10) || 0;
      }
    }

    // Prevent sticky transition title from showing when auto-scrolling.
    const ylCategoryToolbar = document.getElementById('yl_category_toolbar');
    app.state.page.navMenuSticky = true;
    ylCategoryToolbar.classList.remove('sticky-visible');
    ylCategoryToolbar.classList.add('sticky-hidden');

    // Scroll to the top of the closed article, offset by `var(--yl-topnav-height)`.
    const targetScroll = rect.top + scrollTop - offset;
    window.scrollTo({
      top: Math.max(0, targetScroll)
    });
    event?.stopPropagation?.();

    setTimeout(() => {
      app.state.page.navMenuSticky = false;
    }, 50);

    app.state.modal.active = false;
  }
}

function toggleModeMiniplayer() {
  if (app.state.modal.mode === 'miniplayer') {
    setModeMiniplayer(false, 'fullscreen');
    setModeFullscreen(true);

    if (!app.state.popstate.added) {
      /**
       * When `restoreVideoQueue()` opens in miniplayer mode, the popstate is not yet added.
       * Thus, if expanding back to fullscreen mode, we need to add it here to avoid routing back a page,
       * and instead just close the modal.
       */
      history.pushState({ modalOpen: true }, '', '');
      app.state.popstate.added = true;
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
    modal ? (app.state.modal.miniplayerScrollTop = modal.scrollTop) : null;
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
        // Scroll back to previous position when exiting pip mode.
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
    const stored = localStorage.getItem('youlagVideoQueue');
    if (stored) {
      const obj = JSON.parse(stored);
      obj.isPipMode = !!state;
      localStorage.setItem('youlagVideoQueue', JSON.stringify(obj));
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

function createTagsModal(entryId, tags) {
  // Opens modal to manage tags (playlists) for feed item (entryId).
  /**
   * Example tags object:
  [{
    "id": 2,
    "name": "Some playlist name",
    "checked": true
  },]
  */

  if (document.getElementById(modalTagsContainerIdName)) {
    // Remove existing modal if present
    document.getElementById(modalTagsContainerIdName).remove();
  }

  let container = document.createElement('div');
  const useVideoLabels = document.querySelector('body.youlag-video-labels') ? true : false;
  const modalTitle = useVideoLabels ? 'Save to...' : 'Tags';
  container.id = modalTagsContainerIdName;
  container.classList.add('youlag-tags-modal');
  container.innerHTML = `
    <forms class="yl-tags-content">
      <h3 class="yl-tags-modal-title">
        ${modalTitle}

        <a href="./?c=tag" target="_blank"><img class="icon" src="../themes/Mapco/icons/configure.svg" loading="lazy" alt="⚙️"></a>
      </h3>
      <div class="yl-tags-list">
        ${tags.map(tag => `
            <div class="yl-tags-list-item">
              <input type="checkbox" id="yl-tag-${tag.id}" data-tag-id="${tag.id}" data-entry-id="${entryId}" ${tag.checked ? 'checked' : ''} />
              <label for="yl-tag-${tag.id}">${tag.name}</label>
            </div>
          `).join('')
    }
      </div>
      <div class="yl-tags-modal-actions">
        <button id="yl-tags-modal-close" class="btn">Done</button>
      </div>
    </forms>
  `

  document.body.appendChild(container);
  document.body.classList.add('youlag-tags-modal-open');


  // Event listener for tags (playlists) items.
  const checkboxes = container.querySelectorAll('.yl-tags-list-item input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function () {
      const tagId = this.getAttribute('data-tag-id');
      const entryId = this.getAttribute('data-entry-id');
      const checked = this.checked;
      setItemTag(entryId, { id: tagId, checked: checked });
    });
  });

  function closeTagsModal() {
    const modal = document.getElementById(modalTagsContainerIdName);
    if (modal) modal.remove();
    document.body.classList.remove('youlag-tags-modal-open');
    document.removeEventListener('keydown', tagsModalEscHandler, true);
  }

  // Close button
  const closeButton = container.querySelector('#yl-tags-modal-close');
  closeButton.addEventListener('click', closeTagsModal);

  // Close on Esc key
  function tagsModalEscHandler(event) {
    if (event.key === 'Escape') {
      closeTagsModal();
      event.stopPropagation(); // Prevent bubbling to other modals
    }
  }
  document.addEventListener('keydown', tagsModalEscHandler, true);

  // Close onblur
  container.addEventListener('mousedown', function (event) {
    const content = container.querySelector('.yl-tags-content');
    if (content && !content.contains(event.target)) {
      closeTagsModal();
    }
  });

}

function setupSwipeToMiniplayer(modal) {
  // Allow video modal overscroll to enter pip mode on touch devices.
  if (modal._swipeToPipInitialized) return;

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
        // Overscroll (pull-down) detected at top, toggle pip mode.
        toggleModeMiniplayer(true);
      }
    }
    touchStartY = null;
    overscrollActive = false;
  }, { passive: false });

  modal._swipeToPipInitialized = true;
}

function setupClickListener() {
  // youlag-active: Video mode
  if (app.state.youlag.clickListenerInit) return;
  const streamContainer = document.querySelector('#stream');

  if (app.state.page.layout === 'video') {
    if (streamContainer) {
      streamContainer.addEventListener('click', (event) => {

        const target = event.target.closest('div[data-feed]');
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
  
        handleActiveItemVideoMode(event);
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
          // Allow normal browser navigation when in pip mode.
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
        const target = event.target.closest('div[data-feed]');
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
          handleActiveItemArticle(event);
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
        const ylCategoryToolbar = document.getElementById('yl_category_toolbar');
        app.state.page.navMenuSticky = true;
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
                app.state.page.navMenuSticky = false;
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
        return document.querySelector('#stream div[data-feed].active.current');
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
          const openedArticle = document.querySelector('#stream div[data-feed].active.current');
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
  // Delegated eventlistener to override tags (playlists) dropdown click
  const streamContainer = document.querySelector('#stream');
  if (!streamContainer) return;

  streamContainer.addEventListener('click', async function (event) {
    const entryItem = event.target.closest('div[data-feed] .flux_header li.labels');
    const entryItemDropdown = entryItem ? entryItem.querySelector('a.dropdown-toggle') : null;
    const entryItemFooterDropdown = event.target.closest('.item.labels a.dropdown-toggle[href^="#dropdown-labels-"]');

    if (entryItemDropdown || entryItemFooterDropdown) {
      // Prevent default tag dropdown behavior
      event.preventDefault();
      event.stopImmediatePropagation();
      let entryId = null;
      let entryIdRegex = '([0-9]+)$';
      let iconImg = null;
      if (entryItemDropdown) {
        entryId = entryItem.querySelector('.dropdown-target')?.id;
        entryId = entryId ? entryId.match(new RegExp(entryIdRegex)) : null;
        entryId = entryId ? entryId[1] : null;
        iconImg = entryItemDropdown.closest('li.labels')?.querySelector('img.icon');
      }
      if (entryItemFooterDropdown) {
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
      createTagsModal(entryId, tags);
    }
  }, true);
}

function handleActiveItemVideoMode(targetOrEventOrVideo, isVideoObject = false) {
  // Handles activation of a feed item (video or article) and opens the video modal.
  
  app.state.modal.miniplayerScrollTop = 0;
  let videoObject;

  if (isVideoObject) {
    // Use only the data from localStorage, do not rely on DOM
    const videoObject = targetOrEventOrVideo;
    const activeVideo = videoObject.queue[videoObject.queueActiveIndex];
    videoObject = {
      ...activeVideo,
      queue: videoObject.queue,
      queueActiveIndex: videoObject.queueActiveIndex
    };
  } 
  else {
    // Extract the feed item from the DOM event/element
    const feedItem = (targetOrEventOrVideo instanceof Event)
      ? targetOrEventOrVideo.target.closest('div[data-feed]')
      : targetOrEventOrVideo.closest('div[data-feed]');
    if (!feedItem) return;

    videoObject = extractFeedItemData(feedItem);
    videoObject.feedItemEl = feedItem;
    setVideoQueue(videoObject);
  }

  if (app.state.modal.mode !== 'miniplayer') setModeFullscreen(true);
  createModalVideo(videoObject);
}

function handleActiveItemArticle(event) {
  history.pushState({ articleOpen: true }, '', '');
}

function setVideoQueue(videoObject) {
  // Store the videoObject in localStorage.youlagVideoQueue.
  // The video object is defined in `extractFeedItemData()`.

  let queue = [];
  let queueActiveIndex = 0;
  try {
    const stored = localStorage.getItem('youlagVideoQueue');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.queue)) queue = parsed.queue;
      if (typeof parsed.queueActiveIndex === 'number') queueActiveIndex = parsed.queueActiveIndex;
    }
  } catch (e) { }

  const entryId = videoObject.entryId;
  const foundIndex = queue.findIndex(v => v.entryId === entryId);
  const isMiniplayer = document.body.classList.contains(app.modal.class.modeMiniplayer);
  if (foundIndex === -1) {
    queue.push(videoObject);
    queueActiveIndex = queue.length - 1;
  }
  else {
    queue.splice(foundIndex, 1);
    queue.push(videoObject);
    queueActiveIndex = queue.length - 1;
  }

  localStorage.setItem('youlagVideoQueue', JSON.stringify({ queue, queueActiveIndex, isMiniplayer }));
}

function clearVideoQueue() {
  localStorage.removeItem('youlagVideoQueue');
}

function restoreVideoQueue() {
  // Restore video queue from localStorage on page load, only if pip mode was active.
  if (app.state.youlag.restoreVideoInit) return;

  const stored = localStorage.getItem('youlagVideoQueue');
  let queueObj = null;
  if (stored) {
    try {
      queueObj = JSON.parse(stored);
    }
    catch (e) {
      console.error('Error parsing youlagVideoQueue from localStorage:', e);
    }
  }
  if (!queueObj || queueObj.isMiniplayer !== true) return;

  // Only restore video queue on pages that don't get blocked by Content-Security-Policy. 
  const bodyClasses = document.body.classList;
  const isVideoPage = [
    'yl-page-home',
    'yl-page-important',
    'yl-page-watch_later',
    'yl-page-playlists',
    'yl-page-category',
    'yl-page-search_results'
  ].some(cls => bodyClasses.contains(cls));
  if (!isVideoPage) return;

  if (queueObj && Array.isArray(queueObj.queue) && typeof queueObj.queueActiveIndex === 'number' && queueObj.queue.length > 0) {
    setModeMiniplayer(true); // Restored video queue always opens in miniplayer mode.
    handleActiveItemVideoMode(queueObj, true);
  }

  app.state.youlag.restoreVideoInit = true;
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
  const favoriteButton = container.querySelector(`#${modalToggleFavoriteIdName}`);
  if (!favoriteButton) return;

  fetch(url, { method: 'GET' })
    .then(response => {
      if (response.ok) {
        // Toggle favorite classes and icons.
        const currentlyTrue = favoriteButton.classList.contains(`${modalFavoriteClassName}--true`);
        favoriteButton.classList.remove(`${modalFavoriteClassName}--${currentlyTrue}`);
        favoriteButton.classList.add(`${modalFavoriteClassName}--${!currentlyTrue}`);

        // Only update DOM if feedItemEl exists (i.e., not restoring from localStorage).
        if (feedItemEl) {
          const bookmarkIcon = feedItemEl.querySelector('.item-element.bookmark img.icon');
          if (currentlyTrue) {
            feedItemEl.classList.remove('favorite');
            if (bookmarkIcon) {
              bookmarkIcon.src = '../themes/Mapco/icons/non-starred.svg';
            }
          } else {
            feedItemEl.classList.add('favorite');
            if (bookmarkIcon) {
              bookmarkIcon.src = '../themes/Mapco/icons/starred.svg';
            }
          }
        }
      } else {
        console.error('Failed to toggle favorite status');
      }
    })
    .catch(error => console.error('Error:', error));
}
