console.log('UI: 4');

function createModalVideo(data) {
  // Create custom modal
  let modal = getModalVideo();

  if (!modal) {
    modal = document.createElement('div');
    modal.id = app.modal.id.root;
    modal.innerHTML = `<div class="${app.modal.class.container}"></div>`;
    document.body.appendChild(modal);

    if (!modePip && modeFullscreen) {
      feedItemActive = true;
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
  const videoSourceDefault = data.video_source_default;
  const youtubeSelected = videoSourceDefault === 'youtube' ? 'selected' : '';
  const invidiousSelected = videoSourceDefault === 'invidious_1' ? 'selected' : '';
  const invidiousBaseUrl = data.video_invidious_instance_1;
  modal.classList.remove('youlag-modal-feed-item--has-thumbnail', 'youlag-modal-feed-item--no-thumbnail');
  data.thumbnail
    ? modal.classList.add('youlag-modal-feed-item--has-thumbnail')
    : modal.classList.add('youlag-modal-feed-item--no-thumbnail');

  // Check if user settings allow swipe-to-pip mode, setup if enabled.
  const miniPlayerSwipeEnabledElement = document.querySelector('#yl_mini_player_swipe_enabled');
  const miniPlayerSwipeEnabled = miniPlayerSwipeEnabledElement?.getAttribute('data-yl-mini-player-swipe-enabled') === 'true';
  if (miniPlayerSwipeEnabled) {
    setupSwipeToPipMode(modal);
  }

  function getEmbedUrl(source) {
    // Helper to get the correct embed URL for a given source
    if (source === 'invidious_1' && data.video_invidious_instance_1 && data.youtubeId) {
      return `${data.video_invidious_instance_1.replace(/\/$/, '')}/embed/${data.youtubeId}`;
    }
    else if (source === 'youtube') {
      return data.youtube_embed_url;
    }
    return '';
  }

  // Determine the initial video source (default)
  const videoSourceDefaultNormalized = videoSourceDefault === 'invidious_1' ? 'invidious_1' : 'youtube';
  const defaultEmbedUrl = getEmbedUrl(videoSourceDefaultNormalized);

  // Determine device (viewport size), to collapse video description on mobile.
  const isMobile = window.innerWidth <= app.breakpoints.desktop_md_max; 
  const isArticle = !data.youtubeId;
  const shouldCollapseDescription = isMobile && !isArticle && getRelatedVideoSetting() !== 'none';

  setPageTitle(data.title);

  container.innerHTML = `
    <div class="${app.modal.class.content}">

      <div class="youlag-video-header">
        <select id="${app.modal.id.source}" class="${invidiousBaseUrl && data.isVideoFeedItem ? '' : 'display-none'}">
          <option value="youtube" ${youtubeSelected}>YouTube</option>
          <option value="invidious_1" ${invidiousSelected}>Invidious</option>
        </select>

        <button id="${app.modal.id.minimize}" title="Minimize or expand">⧉</button>
        <button id="${app.modal.id.close}" title="Close">×</button>
      </div>

      <div class="youlag-video-container">
        <div class="youlag-thumbnail-container">
          <img src="${data.thumbnail}" class="youlag-video-thumbnail" loading="lazy" />
        </div>
        <div class="youlag-iframe-container">
          <iframe class="youlag-iframe"
                  src="${defaultEmbedUrl}" frameborder="0" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        </div>
      </div>


      <div class="youlag-video-details">

        <div class="youlag-video-metadata-container">
          <h2 class="youlag-video-metadata-title">${data.title}</h2>
          <div class="youlag-video-metadata-panel">

            <section class="youlag-video-author-section">
              <a class="youlag-video-metadata-favicon-link" href="${data.author_filter_url}">
                <img src="${data.favicon}" class="youlag-video-metadata-favicon" />
              </a>

              <div class="yl-flex yl-flex-col">
                <div class="youlag-video-metadata-author">
                  <a href="${data.author_filter_url}">${data.website_name}</a>
                </div>
                <div class="youlag-video-metadata-date">${data.date}</div>
              </div>
            </section>

            <section class="youlag-video-actions-container">
              <a href="#" 
                class="yl-video-action-button ${app.modal.class.favorite} ${app.modal.class.favorite}--${data.favorited}"
                id="${app.modal.id.favorite}">
                <div class="youlag-favorited-icon"></div>
              </a>

              <a href="#" 
                class="yl-video-action-button"
                id="${app.modal.id.tags}">
                <img class="icon" src="../themes/icons/label.svg" loading="lazy" alt="🏷️">
              </a>

              <a class="yl-video-action-button" href="${data.external_link}" target="_blank">
                <span class="yl-video-action-button__icon">🌐</span><span>Source</span>
              </a>

              <a class="yl-video-action-button" href="${data.video_youtube_url}" target="_blank">
                <span class="yl-video-action-button__icon">▶️</span><span>YouTube</span>
              </a>
              <a class="yl-video-action-button" href="${data.video_invidious_redirect_url}" target="_blank">
                <span class="yl-video-action-button__icon">📺</span><span>Invidious</span>
              </a>

            </section>

          </div>

        </div>


        <div id="${app.modal.id.moreContainer}">
          <div
            class="youlag-video-description-container ${shouldCollapseDescription ? 'youlag-video-description-container--collapsed' : ''}">
            ${data.video_description}
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

  const videoDescContainer = modal.querySelector('.youlag-video-description-container');
  if (videoDescContainer && videoDescContainer.offsetHeight <= 90 && !modePip) {
    // Once the video description has been populated, check if the height is small enough to not need collapsing.
    // Height is 0 when video is restored into pip mode, thus, ignore that state and keep as is.
    videoDescContainer.classList.remove('youlag-video-description-container--collapsed');
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
    // When article is in pip mode, and the next triggered item is a video, ensure the text class is removed.
    modal.classList.remove('youlag-modal-feed-item--text');
  }

  appendRelatedVideos(data.entryId, data.authorId);

  container.querySelector(`#${app.modal.id.close}`)?.addEventListener('click', closeModalVideo);
  container.querySelector(`#${app.modal.id.minimize}`)?.addEventListener('click', togglePipMode);
  container.querySelector(`#${app.modal.id.favorite}`)?.addEventListener('click', (e) => {
    // Toggle favorites state in background.
    e.preventDefault();
    toggleFavorite(data.favorite_toggle_url, container, data.feedItemEl);
  });
  container.querySelector(`#${app.modal.id.tags}`)?.addEventListener('click', async (e) => {
    // Open tags (playlists) modal.
    e.preventDefault();
    createTagsModal(data.entryId, await getItemTags(data.entryId));
  });

  if (shouldCollapseDescription && videoDescContainer.offsetHeight > 90 || shouldCollapseDescription && modePip) {
    // Setup the click listener to expand description only once.

    if (videoDescContainer) {
      const descExpand = function () {
        videoDescContainer.classList.remove('youlag-video-description-container--collapsed');
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
    if (event.key === 'Escape' && modeFullscreen) {
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
  if (modeFullscreen && !youladModalPopstateAdded) {
    history.pushState({ modalOpen: true }, '', '');
    youladModalPopstateAdded = true;
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modeFullscreen) {
      closeModalVideo();
    }
  });
}
