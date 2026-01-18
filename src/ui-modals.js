/**
 * UI: Modals
 * 
 * Handles disclosures for both videos and articles,
 * such as modals and accordion/expansion panels.
 */

// TODO: Pop state handling don't properly work after the refactoring. Abstract all modal functions and reimplement popstates.

function handleActiveVideo(eventOrVideoObject, isVideoObject = false) {
  // Handles activation of a feed item (video or article) and opens the video modal.
  
  app.state.modal.miniplayerScrollTop = 0;
  let videoObject;

  if (isVideoObject) {
    let queueObj = eventOrVideoObject;
    const activeVideo = queueObj.queue[queueObj.queue_active_index];
    if (!activeVideo) return;
    videoObject = { ...activeVideo };
  }
  else {
    // Extract the feed item from the DOM event/element
    const feedItem = (eventOrVideoObject instanceof Event)
      ? eventOrVideoObject.target.closest(app.frss.el.entry)
      : eventOrVideoObject.closest(app.frss.el.entry);
    if (!feedItem) return;

    videoObject = extractFeedItemData(feedItem);
    videoObject.feedItemEl = feedItem;
    setVideoQueue(videoObject);
  }

  if (app.state.modal.mode !== 'miniplayer') setModeFullscreen(true);
  renderModalVideo(videoObject);
}

function renderModalVideo(videoObject) {
  // Create custom modal
  let modal = getModalVideo();

  if (!modal) {
    modal = templateModalVideo(videoObject);
    document.body.appendChild(modal);
    if (isModeFullscreen()) setModalState(true);
  }
  
  if (!modal._videoModalListeners) {
    // Track modal event listeners for later removal
    modal._videoModalListeners = [];
  }
  else {
    modal._videoModalListeners.length = 0;
  }

  // If modal already exists, just update the container with new content.
  modal.querySelector(`.${app.modal.class.container}`).innerHTML = templateModalVideo(videoObject, 'container');
  
  setPageTitle(videoObject.title);

  setModalType(videoObject);
  
  handleModalDescription(videoObject);

  setupModalVideoEventListeners(videoObject); // Handles: Close, Minimize, Favorite, Tags, Escape key.

  renderRelatedVideos(videoObject);

  pushHistoryState('modalOpen', true); // Allow modal close when navigating back by adding a new history state.
}

function templateModalVideo(videoObject, elementToReturn = 'modal') {
  // Setup DOM structure for video modal.
  let modal = document.createElement('div');
  let container = document.createElement('div');
  container.classList.add(app.modal.class.container);
  modal.id = app.modal.id.root;
  modal.appendChild(container);

  // Video: playback source state handling
  const videoSourceDefault = videoObject.video_source_default;
  const youtubeSelected = videoSourceDefault === 'youtube' ? 'selected' : '';
  const invidiousSelected = videoSourceDefault === 'invidious_1' ? 'selected' : '';
  const invidiousBaseUrl = videoObject.video_invidious_instance_1;

  // Video: Embed URL handling
  function getEmbedUrl(source) {
    // Get the correct embed URL for a given source
    if (source === 'invidious_1' && videoObject.video_invidious_instance_1 && videoObject.youtubeId) {
      return `${videoObject.video_invidious_instance_1.replace(/\/$/, '')}/embed/${videoObject.youtubeId}`;
    }
    else if (source === 'youtube') {
      return videoObject.youtube_embed_url;
    }
    return '';
  }
  const videoSourceDefaultNormalized = videoSourceDefault === 'invidious_1' ? 'invidious_1' : 'youtube';
  const defaultEmbedUrl = getEmbedUrl(videoSourceDefaultNormalized);

  // Article: Thumbnail presence state handling
  modal.classList.remove('youlag-modal-feed-item--has-thumbnail', 'youlag-modal-feed-item--no-thumbnail');
  videoObject.thumbnail
    ? modal.classList.add('youlag-modal-feed-item--has-thumbnail')
    : modal.classList.add('youlag-modal-feed-item--no-thumbnail');
  
  // Mode miniplayer: Settings state handling, if swipe-to-miniplayer is enabled.
  const miniplayerSwipeEnabledElement = document.querySelector('#yl_miniplayer_swipe_enabled');
  const miniplayerSwipeEnabled = miniplayerSwipeEnabledElement?.getAttribute('data-yl-mini-player-swipe-enabled') === 'true';
  if (miniplayerSwipeEnabled) {
    setupSwipeToMiniplayer(modal);
  }

  // Video: Description box state handling
  const isMobile = window.innerWidth <= app.breakpoints.desktop_md_max; 
  const isArticle = !videoObject.youtubeId;
  const relatedVideosSource = document.querySelector('#yl_related_videos_source')?.getAttribute('data-yl-related-videos-source') || 'none';
  const shouldCollapseDescription = isMobile && !isArticle && relatedVideosSource !== 'none';

  // Modal content
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

  if (elementToReturn === 'container') {
    return container.innerHTML;
  }

  return modal;
}

function handleModalDescription(videoObject) {
  // Video: Description box collapse state handling
  const modal = getModalVideo();
  if (!modal || !videoObject) return;

  const shouldCollapseDescription = isMobile() && !videoObject.youtubeId && getRelatedVideosSetting() !== 'none';

  videoDescContainer = modal.querySelector(`.${app.modal.class.descContainer}`);
  if (
      videoDescContainer && 
      videoDescContainer.offsetHeight <= 90 &&
      !isModeMiniplayer()
    ) {
    // The description box is collapsed by default on mobile(`shouldCollapseDescription`),
    // but check if it is short enough to not need collapsing.
    videoDescContainer.classList.remove(app.modal.class.descContainerCollapsed);
  }
  if (
    shouldCollapseDescription && videoDescContainer && videoDescContainer.offsetHeight > 90 || 
    shouldCollapseDescription && isModeMiniplayer()) {
    // Setup the click listener to expand description only once.
    const descExpand = function () {
      videoDescContainer.classList.remove(app.modal.class.descContainerCollapsed);
      videoDescContainer.removeEventListener('click', descExpand);
    };
    videoDescContainer.addEventListener('click', descExpand);
    if (modal._videoModalListeners) {
      modal._videoModalListeners.push({
        el: videoDescContainer,
        type: 'click',
        handler: descExpand
      });
    }
  }
}

function setModalType(videoObject) {
  const modal = getModalVideo();
  if (!modal || !videoObject) return;

  // Currently, anything that doesn't have a YouTube ID is considered an article.
  const isArticle = !videoObject.youtubeId;

  if (isArticle) {
    app.state.modal.activeType = 'article';
    modal.classList.add(app.modal.class.typeArticle);
    let iframeContainer = document.querySelector(`.${app.modal.class.iframeContainer}`);
    if (iframeContainer) document.querySelector(`.${app.modal.class.iframeContainer}`).remove();
  }
  else {
    // When article is miniplayer and next triggered is a video, ensure article class is removed.
    app.state.modal.activeType = 'video';
    modal.classList.remove(app.modal.class.typeArticle);
  }
}

function setupModalVideoEventListeners(videoObject) {
  // Modal action buttons: Close, Minimize, Favorite, Tags, Escape key.
  
  const modal = getModalVideo();
  if (!modal || !videoObject) return;

  // Close modal button
  modal.querySelector(`#${app.modal.id.close}`)?.addEventListener('click', closeModalVideo);
  
  // Toggle modal to fullscreen/miniplayer button
  modal.querySelector(`#${app.modal.id.minimize}`)?.addEventListener('click', toggleModalMode);
  
  // Toggle favorite video button
  modal.querySelector(`#${app.modal.id.favorite}`)?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleFavorite(videoObject.favorite_toggle_url, modal, videoObject.feedItemEl);
  });
  modal.querySelector(`#${app.modal.id.tags}`)?.addEventListener('click', async (e) => {
    e.preventDefault();
    const tagsButtonIcon = modal.querySelector(`#${app.modal.id.tags} img.icon`);
    if (tagsButtonIcon) tagsButtonIcon.classList.add('loading');
    const tags = await getItemTags(videoObject.entryId);
    if (tagsButtonIcon) tagsButtonIcon.classList.remove('loading');
    renderTagsModal(videoObject.entryId, tags);
  });

  // Escape key closes fullscreen modal
  const escHandler = (event) => {
    if (event.key === 'Escape' && isModeFullscreen()) {
      closeModalVideo();
    }
  };
  document.addEventListener('keydown', escHandler);
  modal._videoModalListeners.push({
    el: document,
    type: 'keydown',
    handler: escHandler
  });

  // Select video source change handling: YouTube, Invidious
  const videoSourceSelect = modal.querySelector(`#${app.modal.id.source}`);
  const iframe = modal.querySelector(`.${app.modal.class.iframe}`);
  if (videoSourceSelect && iframe) {
    console.log('changing video source selection listener added');
    videoSourceSelect.addEventListener('change', function () {
      console.log('Video source changed to:', videoSourceSelect.value);
      iframe.src = getEmbedUrl(videoSourceSelect.value);
    });
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
    isModeFullscreen()
  ) {
    // Only trigger history.back() once, and set the ignore flags.
    app.state.popstate.allowBack = false;
    app.state.popstate.ignoreNext = true;
    history.back();
  }
  else {
    resetHistoryState();
  }
  app.state.modal.active = false;
  setModeMiniplayer(false);
  setModeFullscreen(false);
  setPageTitle();
  clearVideoQueue();
}

function renderRelatedVideos(videoObject) {
  // Renders related videos in the video modal.
  const modal = getModalVideo();
  if (!videoObject || !modal) return;

  let template = (videoObject) =>  `
    <div class="youlag-related-video-item" data-yl-feed="${videoObject.entryId}">
      <div class="youlag-related-video-item__feed-item-container display-none">
        ${videoObject.feedItem.outerHTML}
      </div>
      <div class="youlag-related-video-item__thumbnail"><img src="${videoObject.thumbnail}" loading="lazy" ></div>
      <div class="youlag-related-video-item__metadata">
        <div class="youlag-related-video-item__title">${videoObject.title}</div>
        <div class="youlag-related-video-item__author">${videoObject.website_name}</div>
        <div class="youlag-related-video-item__date">
          ${getRelativeDate(videoObject.date)}
        </div>
      </div>
    </div>
  `

  function appendRelatedVideos(currentEntryId, currentAuthorId) {
    // Append related videos to the video modal.
    const relatedVideosSource = document.querySelector('#yl_related_videos_source')?.getAttribute('data-yl-related-videos-source') || 'none';
    if (relatedVideosSource === 'none' || relatedVideosSource === '') return;

    const currentlyViewing = currentEntryId;
    const relatedVideosContainer = modal.querySelector(`#${app.modal.id.relatedContainer}`);
    if (!relatedVideosContainer) return;

    let relatedVideos;

    switch (relatedVideosSource) {
      case 'watch_later':
        relatedVideos = fetchRelatedItems(relatedVideosSource, 'rand', 10);
        break;
      case 'subscriptions':
        relatedVideos = fetchRelatedItems(relatedVideosSource, '', 10);
        break;
      case 'author':
        relatedVideos = fetchRelatedItems(`f_${currentAuthorId}`, '', 10);
        break;
      default:
        relatedVideos = Promise.resolve([]);
    }

    relatedVideos.then(videos => {
      if (!Array.isArray(videos) || videos.length === 0) return;
      videos.forEach(videoObject => {
        const videoHtml = template(videoObject);
        if (videoObject.entryId === currentlyViewing) return; // Skip currently viewing video.
        relatedVideosContainer.insertAdjacentHTML('beforeend', videoHtml);
      });
      // Display the related videos container once appended.
      relatedVideosContainer.classList.remove('display-none');
    });

    relatedVideosContainer.addEventListener('click', function (e) {
      console.log('Related video clicked');
      const relatedItem = e.target.closest('.youlag-related-video-item');
      if (!relatedItem) return;
      const feedItem = relatedItem.querySelector('.youlag-related-video-item__feed-item-container > div[data-feed]');
      if (feedItem) {
        const modal = getModalVideo();
        if (modal) {
          modal.scrollTo({ top: 0 });
        }
        handleActiveVideo(feedItem);
      }
    });

  }

  appendRelatedVideos(videoObject.entryId, videoObject.authorId);
}

function setVideoQueue(videoObject) {
  // Store the videoObject in localStorage.youlagVideoQueue.
  // The video object is defined in `extractFeedItemData()`.

  let queue = [];
  let queue_active_index = 0;
  try {
    const stored = localStorage.getItem(app.modal.queue.localStorageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.queue)) queue = parsed.queue;
      if (typeof parsed.queue_active_index === 'number') queue_active_index = parsed.queue_active_index;
    }
  } catch (e) { }

  const entryId = videoObject.entryId;
  const foundIndex = queue.findIndex(v => v.entryId === entryId);
  const isMiniplayer = document.body.classList.contains(app.modal.class.modeMiniplayer);
  if (foundIndex === -1) {
    queue.push(videoObject);
    queue_active_index = queue.length - 1;
  }
  else {
    queue.splice(foundIndex, 1);
    queue.push(videoObject);
    queue_active_index = queue.length - 1;
  }

  localStorage.setItem(app.modal.queue.localStorageKey, JSON.stringify({ queue, queue_active_index, isMiniplayer }));
}

function clearVideoQueue() {
  localStorage.removeItem(app.modal.queue.localStorageKey);
}

function restoreVideoQueue() {
  // Restore video queue from localStorage on page load, only if miniplayer mode was active.
  if (app.state.youlag.restoreVideoInit) return;

  const stored = localStorage.getItem(app.modal.queue.localStorageKey);
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

  if (queueObj && Array.isArray(queueObj.queue) && typeof queueObj.queue_active_index === 'number' && queueObj.queue.length > 0) {
    setModeMiniplayer(true); // Restored video queue always opens in miniplayer mode.
    handleActiveVideo(queueObj, true);
  }

  app.state.youlag.restoreVideoInit = true;
}

function handleActiveArticle(event) {
  pushHistoryState('articleOpen', true);
}

function closeArticle(event) {
  const openedArticle = document.querySelector(app.frss.el.current);

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
    app.state.page.toolbarSticky = true;
    ylCategoryToolbar.classList.remove('sticky-visible');
    ylCategoryToolbar.classList.add('sticky-hidden');

    // Scroll to the top of the closed article, offset by `var(--yl-topnav-height)`.
    const targetScroll = rect.top + scrollTop - offset;
    window.scrollTo({
      top: Math.max(0, targetScroll)
    });
    event?.stopPropagation?.();

    setTimeout(() => {
      app.state.page.toolbarSticky = false;
    }, 50);

    app.state.modal.active = false;
  }
}

function renderTagsModal(entryId, tags) {
  // Opens modal to manage tags (playlists) for feed item (entryId).
  /**
   * Example tags object:
  [{
    "id": 2,
    "name": "Some playlist name",
    "checked": true
  },]
  */

  if (document.getElementById(`${app.modal.id.tagsContainer}`)) {
    // Remove existing modal if present
    document.getElementById(`${app.modal.id.tagsContainer}`).remove();
  }

  let container = document.createElement('div');
  const useVideoLabels = document.querySelector('body.youlag-video-labels') ? true : false;
  const modalTitle = useVideoLabels ? 'Save to...' : 'Tags';
  container.id = `${app.modal.id.tagsContainer}`;
  container.classList.add(app.modal.class.tagsModalRoot);
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
  document.body.classList.add(app.modal.class.tagsModalOpen);


  // Event listener for tags (playlists) items.
  const checkboxes = container.querySelectorAll(`.${app.modal.class.tagsModalItem} input[type="checkbox"]`);
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function () {
      const tagId = this.getAttribute('data-tag-id');
      const entryId = this.getAttribute('data-entry-id');
      const checked = this.checked;
      setItemTag(entryId, { id: tagId, checked: checked });
    });
  });

  function closeTagsModal() {
    const modal = document.getElementById(`${app.modal.id.tagsContainer}`);
    if (modal) modal.remove();
    document.body.classList.remove(app.modal.class.tagsModalOpen);
    document.removeEventListener('keydown', tagsModalEscHandler, true);
  }

  // Close button
  const closeButton = container.querySelector(`#${app.modal.id.tagsClose}`);
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
    const content = container.querySelector(`.${app.modal.class.tagsModalContent}`);
    if (content && !content.contains(event.target)) {
      closeTagsModal();
    }
  });

}
