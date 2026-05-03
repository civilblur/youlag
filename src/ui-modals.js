/**
 * UI: Modals
 *
 * Handles disclosures for both videos and articles,
 * such as modals and accordion/expansion panels.
 *
 * NOTE: For simplicity, both the video modal and article expansion panels are referred to as "modal" in this context.
 */

function handleActiveVideo(eventOrVideoObject, isVideoObject = false) {
  // Handles activation of a feed item (video or article) and opens the video modal.

  app.state.modal.miniplayerScrollTop = 0;
  let videoObject;

  if (isVideoObject) {
    let queueObj = eventOrVideoObject;
    const activeVideo = queueObj.queue[queueObj.queue_active_index];
    if (!activeVideo) return;
    videoObject = { ...activeVideo };
    setVideoQueue(videoObject);
  } else {
    // Extract the feed item from the DOM event/element
    const feedItem =
      eventOrVideoObject instanceof Event
        ? eventOrVideoObject.target.closest(app.frss.el.entry)
        : eventOrVideoObject.closest(app.frss.el.entry);
    if (!feedItem) return;

    videoObject = extractFeedItemData(feedItem);
    videoObject.feedItemEl = feedItem;
    videoObject.playbackTime = getStoredPlaybackTime(videoObject.entryId);
    videoObject.autoplay = 1;
    setVideoQueue(videoObject);
  }

  if (!isModeMiniplayer()) setModeFullscreen(true);
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
  } else {
    // Remove all previous listeners before updating content
    for (const { el, type, handler } of modal._videoModalListeners) {
      el.removeEventListener(type, handler);
    }
    modal._videoModalListeners.length = 0;
  }

  // If modal already exists, just update the container with new content.
  modal.setAttribute("data-entry", videoObject.entryId);
  modal.querySelector(`.${app.modal.class.container}`).innerHTML =
    templateModalVideo(videoObject, "container");

  setPageTitle(videoObject.title);

  setModalType(videoObject);

  renderModalVideoChapters(videoObject.video_chapters);
  setupModalVideoControlEventListeners();

  setupModalVideoEventListeners(videoObject); // Handles: Close, Minimize, Favorite, Tags, Escape key.

  renderRelatedVideos(videoObject);

  pushHistoryState("modalOpen", true); // Allow modal close when navigating back by adding a new history state.

  if (isModeFullscreen()) {
    addVideoParamUrl(videoObject.entryId); // For direct linking to the video modal
  }
}

function templateModalVideo(videoObject, elementToReturn = "modal") {
  // Prepare and return the video modal element.

  // TODO: Refactor to abstract smaller components.

  // Setup DOM structure for video modal.
  let modal = document.createElement("div");
  let container = document.createElement("div");
  container.classList.add(app.modal.class.container);
  modal.id = app.modal.id.root;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("data-entry", videoObject.entryId);
  modal.appendChild(container);

  // Video: playback source state handling
  const videoSourceDefault = videoObject.video_source_default;
  const youtubeSelected = videoSourceDefault === "youtube" ? "selected" : "";
  const invidiousSelected =
    videoSourceDefault === "invidious_1" ? "selected" : "";
  const invidiousBaseUrl = videoObject.video_invidious_instance_1;

  // Video: Embed URL handling
  function getEmbedUrl(source) {
    // Get the correct embed URL for a given source

    const playbackTime =
      videoObject.playbackTime > 0
        ? Math.floor(videoObject.playbackTime)
        : null;
    const videoDuration =
      videoObject.videoDuration > 0 ? videoObject.videoDuration : null;
    const nearEnd =
      videoDuration &&
      playbackTime &&
      videoDuration - playbackTime <= app.state.modal.nearEndThreshold;
    const startTime = nearEnd ? 0 : playbackTime; // If nearEnd, restart from 0, otherwise use playbackTime.
    const autoplay = videoObject.autoplay ? 1 : 0;
    if (
      source === "invidious_1" &&
      videoObject.video_invidious_instance_1 &&
      videoObject.youtubeId
    ) {
      const base = `${videoObject.video_invidious_instance_1.replace(/\/$/, "")}/embed/${videoObject.youtubeId}`;
      const params = new URLSearchParams();
      if (startTime) params.set("start", startTime);
      if (autoplay) params.set("autoplay", "1");
      const query = params.toString();
      return query ? `${base}?${query}` : base;
    } else if (source === "youtube") {
      const params = new URLSearchParams();
      if (startTime) params.set("start", startTime);
      if (autoplay) {
        params.set("autoplay", "1");
        params.set("playsinline", "1");
      }
      const query = params.toString();
      return query
        ? `${videoObject.youtube_embed_url}&${query}`
        : videoObject.youtube_embed_url;
    }
    return "";
  }

  const videoSourceDefaultNormalized =
    videoSourceDefault === "invidious_1" ? "invidious_1" : "youtube";
  const defaultEmbedUrl = getEmbedUrl(videoSourceDefaultNormalized);

  // Article: Thumbnail presence state handling
  modal.classList.remove(
    "youlag-modal-feed-item--has-thumbnail",
    "youlag-modal-feed-item--no-thumbnail",
  );
  videoObject.thumbnail
    ? modal.classList.add("youlag-modal-feed-item--has-thumbnail")
    : modal.classList.add("youlag-modal-feed-item--no-thumbnail");

  // Video: Description box state handling
  const isMobile = window.innerWidth <= app.breakpoints.desktop_md_max;
  const isArticle = !videoObject.youtubeId;
  const relatedVideosSource = getRelatedVideosSetting();
  const shouldCollapseDescription =
    isMobile && !isArticle && relatedVideosSource !== "none";

  // Thumbnail priority
  let thumbnail =
    videoObject.thumbnail_video ||
    videoObject.thumbnail ||
    videoObject.thumbnail_video_screencap ||
    "";

  // Modal content
  container.innerHTML = `
    <div class="${app.modal.class.content}">

      <div class="youlag-video-header">
        <select id="${app.modal.id.source}" class="${invidiousBaseUrl && videoObject.isVideoFeedItem ? "" : "display-none"}">
          <option value="youtube" ${youtubeSelected}>YouTube</option>
          <option value="invidious_1" ${invidiousSelected}>Invidious</option>
        </select>

        <button id="${app.modal.id.minimize}" title="Minimize or expand">⧉</button>
        <button id="${app.modal.id.close}" title="Close">×</button>
      </div>

      <div class="youlag-video-container">
        <div class="youlag-thumbnail-container">
          <img src="${thumbnail}" class="youlag-video-thumbnail" loading="lazy" />
        </div>
        <div class="youlag-iframe-container">
          <iframe id="${app.modal.id.videoIframe}"
                  class="youlag-iframe"
                  data-yl-is-video="${videoSourceDefaultNormalized}"
                  src="${defaultEmbedUrl}" frameborder="0" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; fullscreen" allowfullscreen>
          </iframe>
        </div>
      </div>

      <div class="yl-video-blur-backdrop-effect">
        <img src="${thumbnail}" class="yl-video-blur-backdrop-effect__image" loading="lazy" />
      </div>

      <div id="${app.modal.id.chapterContainer}" class="${Array.isArray(videoObject?.video_chapters) && videoObject?.video_chapters.length > 0 ? "" : "display-none"}">
        <div id="${app.modal.id.chapterCurrent}" class="yl-video-chapter-current">
          <div id="${app.modal.id.chapterCurrentProgress}"></div>

          <div id="${app.modal.id.chapterPanel}">
            <div id="ylVideoChapterToggle">
              <img src="${app.frss.img.chevronDown}" class="yl-video-chapter-toggle-icon" loading="lazy" />
            </div>
            <span class="yl-video-chapter-current__order yl-badge"></span>
            <span class="yl-video-chapter-current__label"></span>
          </div>

          <div id="${app.modal.id.chapterActionContainer}" class="yl-video-chapter-action-container">
            <div id="${app.modal.id.chapterActionPrevious}"
                    class="yl-video-chapter-action is-disabled"
                    role="button">
              <span class="yl-video-chapter-action__icon yl-video-chapter-action__icon--previous"></span>
            </div>
            <div id="${app.modal.id.chapterActionNext}"
                    class="yl-video-chapter-action"
                    role="button">
              <span class="yl-video-chapter-action__icon yl-video-chapter-action__icon--next"></span>
            </div>
          </div>
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
            class="${app.modal.class.descContainer} ${shouldCollapseDescription ? app.modal.class.descContainerCollapsed : ""}">
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

  if (elementToReturn === "container") {
    return container.innerHTML;
  }

  return modal;
}

function handleModalDescription(videoObject) {
  // Video: Description box collapse state handling
  const modal = getModalVideo();
  if (!modal || !videoObject) return;

  const shouldCollapseDescription =
    isMobile() && videoObject.youtubeId && getRelatedVideosSetting() !== "none";

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
    (shouldCollapseDescription &&
      videoDescContainer &&
      videoDescContainer.offsetHeight > 90) ||
    (shouldCollapseDescription && isModeMiniplayer())
  ) {
    setupModalDescriptionEventListeners();
  }
}

function setupModalDescriptionEventListeners() {
  // Setup the click listener to expand description only once.
  const modal = getModalVideo();
  if (!modal) return;
  const videoDescContainer = modal.querySelector(
    `.${app.modal.class.descContainer}`,
  );

  const descExpand = function () {
    videoDescContainer.classList.remove(app.modal.class.descContainerCollapsed);
    videoDescContainer.removeEventListener("click", descExpand);
  };
  videoDescContainer.addEventListener("click", descExpand);
  if (modal._videoModalListeners) {
    modal._videoModalListeners.push({
      el: videoDescContainer,
      type: "click",
      handler: descExpand,
    });
  }
}

function setModalType(videoObject) {
  const modal = getModalVideo();
  if (!modal || !videoObject) return;

  // Currently, anything that doesn't have a YouTube ID is considered an article.
  const isArticle = !videoObject.youtubeId;

  if (isArticle) {
    app.state.modal.activeType = "article";
    modal.classList.add(app.modal.class.typeArticle);
    let iframeContainer = document.querySelector(
      `.${app.modal.class.iframeContainer}`,
    );
    if (iframeContainer)
      document.querySelector(`.${app.modal.class.iframeContainer}`).remove();
  } else {
    // When article is miniplayer and next triggered is a video, ensure article class is removed.
    app.state.modal.activeType = "video";
    modal.classList.remove(app.modal.class.typeArticle);
  }
}

function setupModalVideoEventListeners(videoObject) {
  // Modal action buttons: Close, Minimize, Favorite, Tags, Escape key.

  const modal = getModalVideo();
  if (!modal || !videoObject) return;

  // Setup modal event listener tracking
  if (!modal._videoModalListeners) modal._videoModalListeners = [];

  // Close modal button
  const closeBtn = modal.querySelector(`#${app.modal.id.close}`);
  if (closeBtn) {
    closeBtn.addEventListener("click", closeModalVideo);
    modal._videoModalListeners.push({
      el: closeBtn,
      type: "click",
      handler: closeModalVideo,
    });
  }

  // Toggle modal to fullscreen/miniplayer button
  const minimizeBtn = modal.querySelector(`#${app.modal.id.minimize}`);
  if (minimizeBtn) {
    minimizeBtn.addEventListener("click", toggleModalMode);
    modal._videoModalListeners.push({
      el: minimizeBtn,
      type: "click",
      handler: toggleModalMode,
    });
  }

  // Mode miniplayer: Settings state handling, if swipe-to-miniplayer is enabled.
  const miniplayerSwipeEnabledElement = document.querySelector(
    "#yl_miniplayer_swipe_enabled",
  );
  const miniplayerSwipeEnabled =
    miniplayerSwipeEnabledElement?.getAttribute(
      "data-yl-miniplayer-swipe-enabled",
    ) === "true";
  if (miniplayerSwipeEnabled) {
    setupSwipeToMiniplayer(modal);
  }

  // Toggle favorite video button
  const favoriteBtn = modal.querySelector(`#${app.modal.id.favorite}`);
  if (favoriteBtn) {
    const favoriteHandler = (e) => {
      e.preventDefault();
      toggleFavorite(
        videoObject.favorite_toggle_url,
        modal,
        videoObject.feedItemEl,
      );
    };
    favoriteBtn.addEventListener("click", favoriteHandler);
    modal._videoModalListeners.push({
      el: favoriteBtn,
      type: "click",
      handler: favoriteHandler,
    });
  }

  // Assign labels/tags (playlists) button
  const tagsBtn = modal.querySelector(`#${app.modal.id.tags}`);
  if (tagsBtn) {
    const tagsHandler = async (e) => {
      e.preventDefault();
      const tagsButtonIcon = modal.querySelector(
        `#${app.modal.id.tags} img.icon`,
      );
      if (tagsButtonIcon) tagsButtonIcon.classList.add("loading");
      const tags = await getItemTags(videoObject.entryId);
      if (tagsButtonIcon) tagsButtonIcon.classList.remove("loading");
      renderTagsModal(videoObject.entryId, tags);
    };
    tagsBtn.addEventListener("click", tagsHandler);
    modal._videoModalListeners.push({
      el: tagsBtn,
      type: "click",
      handler: tagsHandler,
    });
  }

  // Expand description box on click
  handleModalDescription(videoObject);

  // Escape key closes fullscreen modal
  const escHandler = (event) => {
    if (event.key === "Escape" && isModeFullscreen()) {
      closeModalVideo();
    }
  };
  document.addEventListener("keydown", escHandler);
  modal._videoModalListeners.push({
    el: document,
    type: "keydown",
    handler: escHandler,
  });

  // Select video source change handling: YouTube, Invidious
  const videoSourceSelect = modal.querySelector(`#${app.modal.id.source}`);
  const iframe = modal.querySelector(`.${app.modal.class.iframe}`);
  if (videoSourceSelect && iframe) {
    const sourceHandler = function () {
      iframe.src = getEmbedUrl(videoSourceSelect.value);
      iframe.setAttribute("data-yl-is-video", videoSourceSelect.value);
      const chapterContainer = modal.querySelector(
        `#${app.modal.id.chapterContainer}`,
      );
      if (chapterContainer) {
        // Chapter only supported for YouTube as playback source.
        if (videoSourceSelect.value !== "youtube") {
          chapterContainer.classList.add("display-none");
        } else {
          chapterContainer.classList.remove("display-none");
        }
      }
    };
    videoSourceSelect.addEventListener("change", sourceHandler);
    modal._videoModalListeners.push({
      el: videoSourceSelect,
      type: "change",
      handler: sourceHandler,
    });
  }

  function getEmbedUrl(source) {
    // Helper to get the correct embed URL for a given source
    if (
      source === "invidious_1" &&
      videoObject.video_invidious_instance_1 &&
      videoObject.youtubeId
    ) {
      return `${videoObject.video_invidious_instance_1.replace(/\/$/, "")}/embed/${videoObject.youtubeId}`;
    } else if (source === "youtube") {
      return videoObject.youtube_embed_url;
    }
    return "";
  }
}

function restoreModalEventListeners() {
  // Restore modal event listeners after tab suspension.
  // Primarily to address how moobile devices handles tab suspension,

  const modal = getModalVideo();
  if (!modal) return;

  // Remove all existing modal event listeners before reattaching new ones, to prevent stacking.
  if (modal._videoModalListeners && Array.isArray(modal._videoModalListeners)) {
    for (const { el, type, handler } of modal._videoModalListeners) {
      if (el && type && handler) {
        el.removeEventListener(type, handler);
      }
    }
    modal._videoModalListeners.length = 0;
  }

  let videoQueue; // Localstorage: youlagVideoQueue
  try {
    videoQueue = JSON.parse(
      localStorage.getItem(app.modal.queue.localStorageKey),
    );
  } catch (e) {
    videoQueue = null;
  }
  if (!videoQueue || !Array.isArray(videoQueue.queue)) return;

  const entryId =
    modal.getAttribute("data-entry") ||
    videoQueue.queue[videoQueue.queue_active_index]?.entryId;
  if (!entryId) return;

  const videoObject = videoQueue.queue.find((v) => v.entryId === entryId);
  if (!videoObject) return;

  setupModalVideoEventListeners(videoObject);
  setupModalVideoControlEventListeners();

  // Related videos render fallback
  // TODO: In some cases when opening up a direct link in a new tab, the related video may not render.
  const relatedContainer = modal.querySelector(
    `#${app.modal.id.relatedContainer}`,
  );
  if (
    getRelatedVideosSetting() !== "none" &&
    relatedContainer?.classList.contains("display-none")
  ) {
    renderRelatedVideos(videoObject);
  }
}

function forceFrssEntryToCollapse(target) {
  // HACK: Collapse the expanded entry triggered by FreshRSS click event, as Youlag presents the content in a modal.

  const feedItem = target;
  let isActive = feedItem.classList.contains("active");
  const iframes = feedItem.querySelectorAll("iframe");

  if (iframes) {
    iframes.forEach((iframe) => {
      // Disable iframes to prevent autoplay.
      const src = iframe.getAttribute("src");
      if (src) {
        iframe.setAttribute("data-original", src);
        iframe.setAttribute("src", "");
      }
    });
  }

  if (isActive) {
    // Collapse the feed item
    feedItem.classList.remove("active");
    feedItem.classList.remove("current");
  }
}

function closeModalVideo() {
  const modal = getModalVideo();

  // Remove all modal-specific listeners or states before removing the modal element
  if (
    modal &&
    modal._videoModalListeners &&
    Array.isArray(modal._videoModalListeners)
  ) {
    for (const { el, type, handler } of modal._videoModalListeners) {
      el.removeEventListener(type, handler);
    }
    modal._videoModalListeners.length = 0;
  }
  if (app.state && app.state.modal) app.state.modal.chapterLastActiveIndex = -1;
  if (modal) modal.remove();

  setHistoryPopstate(false); // Signal that a new pop state can be pushed for the next video.
  resetModalHistoryState(); // Clean up history state added by video modal to allow proper back navigation.
  setModalState(false);
  setModeMiniplayer(false);
  setModeFullscreen(false);
  setPageTitle();
  clearVideoQueue();
}

function resetModalHistoryState() {
  /**
   * Handle history pop state cleanup when closing the video modal,
   * either via the modal close button, or browser back button.
   *
   * The video modal adds a new history state on open to allow users to use the back button to close the modal.
   */

  // Reset state for next modal.
  app.state.popstate.allowBack = true;

  // Determines if pushState entry needs to be consumed via history.back().
  const wasAtPushState = !!history.state?.modalOpen;

  if (wasAtPushState) {
    // Modal close button: consume the pushState entry to only require one back press to leave.
    app.state.popstate.ignoreNext = true;
    history.back();
  } else {
    // Back navigation close: already past the pushState entry, clean URL and state.
    app.state.popstate.ignoreNext = false;
    removeVideoParamUrl();
    resetHistoryState();
  }
}

function renderRelatedVideos(videoObject) {
  // Renders related videos in the video modal.
  const modal = getModalVideo();
  if (!videoObject || !modal) return;

  // The `app.modal.class.relatedVideoEntryHTML` contains the original feed entry HTML and is not displayed
  // as its purpose is to be parsed when opening a the related video.
  function template(videoObject, customThumbnail, directLink) {
    let thumbnail = customThumbnail || videoObject.thumbnail || "";

    return `
      <div class="${app.modal.class.relatedVideoEntry}" data-yl-feed="${videoObject.entryId}">
        <div class="${app.modal.class.relatedVideoEntryHTML} display-none">
          ${videoObject.feedItem.outerHTML}
        </div>
        <div class="youlag-related-video-item__thumbnail"><img src="${thumbnail}" loading="lazy" ></div>
        <div class="youlag-related-video-item__metadata">
          <div class="youlag-related-video-item__title">${videoObject.title}</div>
          <div class="youlag-related-video-item__author">${videoObject.website_name}</div>
          <div class="youlag-related-video-item__date">
            ${getRelativeDate(videoObject.date)}
          </div>
        </div>

        <a href="${directLink}" class="youlag-related-video-item__link"></a>
      </div>
    `;
  }

  function appendRelatedVideos(currentEntryId, currentAuthorId) {
    // Append related videos to the video modal.
    const relatedVideosSource = getRelatedVideosSetting();
    if (relatedVideosSource === "none" || relatedVideosSource === "") return;

    const currentlyViewing = currentEntryId;
    const relatedVideosContainer = modal.querySelector(
      `#${app.modal.id.relatedContainer}`,
    );
    if (!relatedVideosContainer) return;

    let relatedVideos;

    switch (relatedVideosSource) {
      case "watch_later":
        relatedVideos = fetchRelatedItems(relatedVideosSource, "rand", 10);
        break;
      case "subscriptions":
        relatedVideos = fetchRelatedItems(relatedVideosSource, "", 10);
        break;
      case "author":
        relatedVideos = fetchRelatedItems(`f_${currentAuthorId}`, "", 10);
        break;
      default:
        relatedVideos = Promise.resolve([]);
    }

    relatedVideos.then((videos) => {
      if (!Array.isArray(videos) || videos.length === 0) return;

      // Do not render "related videos" if the only video is the currently viewing video
      if (videos.length === 0 || videos[0].entryId === currentlyViewing) return;

      // Refetch the modal and related videos container as modal content could have been rerendered since the relatedVideos promise was initiated
      const modal = getModalVideo();
      const container = modal?.querySelector(
        `#${app.modal.id.relatedContainer}`,
      );
      if (!container) return;

      // Clear previously appended related videos
      container
        .querySelectorAll(`.${app.modal.class.relatedVideoEntry}`)
        .forEach((el) => el.remove());

      videos.forEach(async (videoObject) => {
        let thumbnail;
        const isVideoFeedItem = getVideoIdFromUrl(videoObject.external_link)
          ? true
          : false;
        const youtubeId = isVideoFeedItem
          ? getVideoIdFromUrl(videoObject.external_link)
          : "";
        const directLink = getVideoParamUrl(videoObject.entryId);

        if (shouldCustomThumbnailTitle() && youtubeId) {
          // If screencap thumbnail setting is enabled, replace default thumbnail.
          thumbnail = await getVideoScreencapWithFallback(youtubeId);
        }
        if (!thumbnail) {
          thumbnail = videoObject.thumbnail;
        }

        const videoHtml = template(videoObject, thumbnail, directLink);
        if (videoObject.entryId === currentlyViewing) return; // Skip currently viewing video.
        container.insertAdjacentHTML("beforeend", videoHtml);
      });
      // Display the related videos container once appended.
      container.classList.remove("display-none");
    });

    // Remove any previous relatedVideosContainer click listeners and attach new ones.
    if (!modal._videoModalListeners) modal._videoModalListeners = [];
    modal._videoModalListeners = modal._videoModalListeners.filter(
      (listener) => {
        if (
          listener.type === "click" &&
          listener.el === relatedVideosContainer
        ) {
          listener.el.removeEventListener(listener.type, listener.handler);
          return false;
        }
        return true;
      },
    );

    // Attach and track the new click handler
    const relatedClickHandler = function (e) {
      if (e.target.closest(".youlag-related-video-item__link")) {
        // The anchor on the card is primarily to allow right click to open in new tab, so ignore clicks on the anchor itself.
        e.preventDefault();
      }
      const relatedItem = e.target.closest(
        `.${app.modal.class.relatedVideoEntry}`,
      );
      if (!relatedItem) return;
      const feedItem = relatedItem.querySelector(
        `.${app.modal.class.relatedVideoEntryHTML} > ${app.frss.el.entry}`,
      );
      if (feedItem) {
        const modal = getModalVideo();
        if (modal) {
          modal.scrollTo({ top: 0 });
        }
        handleActiveVideo(feedItem);
      }
    };
    relatedVideosContainer.addEventListener("click", relatedClickHandler);
    modal._videoModalListeners.push({
      el: relatedVideosContainer,
      type: "click",
      handler: relatedClickHandler,
    });
  }

  appendRelatedVideos(videoObject.entryId, videoObject.authorId);
}

function getStoredPlaybackTime(entryId) {
  // Provide the stored playback time for a given entryId.
  // The playback time is stored by `setupVideoPlaybackPosition()`.
  if (!entryId) return 0;
  try {
    const stored = JSON.parse(
      localStorage.getItem(app.modal.queue.localStorageKey),
    );
    if (stored && Array.isArray(stored.queue)) {
      const entry = stored.queue.find((v) => v.entryId === entryId);
      if (entry && entry.playbackTime > 0) return entry.playbackTime;
    }
  } catch (e) {}
  return 0;
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
      if (typeof parsed.queue_active_index === "number")
        queue_active_index = parsed.queue_active_index;
    }
  } catch (e) {}

  const entryId = videoObject.entryId;
  const foundIndex = queue.findIndex((v) => v.entryId === entryId);
  const isMiniplayer = isModeMiniplayer();

  if (foundIndex === -1) {
    queue.push(videoObject);
    queue_active_index = queue.length - 1;
  } else {
    queue.splice(foundIndex, 1);
    queue.push(videoObject);
    queue_active_index = queue.length - 1;
  }

  localStorage.setItem(
    app.modal.queue.localStorageKey,
    JSON.stringify({ queue, queue_active_index, isMiniplayer }),
  );
}

function clearVideoQueue() {
  localStorage.removeItem(app.modal.queue.localStorageKey);
}

function restoreVideoQueue() {
  // Restore video queue from localStorage on page load, only if miniplayer mode was active.
  if (app.state.youlag.restoreVideoInit || !isFeedPage()) return;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", restoreVideoQueue, {
      once: true,
    });
    return;
  }

  const stored = localStorage.getItem(app.modal.queue.localStorageKey);
  let queueObj = null;
  if (stored) {
    try {
      queueObj = JSON.parse(stored);
    } catch (e) {
      console.error(
        "Youlag: Error parsing youlagVideoQueue from localStorage:",
        e,
      );
    }
  }
  if (!queueObj || queueObj.isMiniplayer !== true) return;

  if (
    queueObj &&
    Array.isArray(queueObj.queue) &&
    typeof queueObj.queue_active_index === "number" &&
    queueObj.queue.length > 0
  ) {
    setModeMiniplayer(true); // Restored video queue always opens in miniplayer mode.
    const activeEntry = queueObj.queue[queueObj.queue_active_index];
    if (!activeEntry) return;

    const nearEnd =
      activeEntry.videoDuration &&
      activeEntry.videoDuration - activeEntry.playbackTime <=
        app.state.modal.nearEndThreshold;

    // Miniplayer: don't autoplay if paused or nearEnd, otherwise autoplay
    const shouldAutoplay = !(activeEntry.playerState === "paused" || nearEnd);
    activeEntry.autoplay = shouldAutoplay ? 1 : 0;

    handleActiveVideo(queueObj, true);

    if (shouldAutoplay && isIOS()) {
      // IOS HACK: Miniplayer: trigger play on user first interaction.
      setupIOSAutoplayWorkaround();
    }
  }

  app.state.youlag.restoreVideoInit = true;
}

function setupIOSAutoplayWorkaround() {
  /**
   * IOS HACK: Miniplayer: trigger play on user first interaction.
   *
   * Autoplay on iOS only works if the content is muted. This workaround will try to play the video
   * immediately after the user's first interaction, either a touch scroll, or click/tap.
   * Regular scroll does not count as first interaction.
   */

  const modal = getModalVideo();
  if (!modal) return;

  const iframe = modal.querySelector(`#${app.modal.id.videoIframe}`);
  if (!iframe) return;

  if (!iframe.src.includes("autoplay=1")) return;

  if (iframe.getAttribute("data-yl-is-video") !== "youtube") return;

  // Store iOS workaround state in localStorage for debugging
  const debugKey = "ylIOSDebug";
  const updateIOSDebugState = (updates) => {
    try {
      const current = JSON.parse(localStorage.getItem(debugKey)) || {};
      const updated = {
        ...current,
        ...updates,
        lastUpdate: new Date().toISOString(),
      };
      localStorage.setItem(debugKey, JSON.stringify(updated));
    } catch (e) {}
  };

  updateIOSDebugState({
    setup: true,
    autoplay: true,
    interactionTriggered: false,
    playbackAttempted: false,
  });

  const isInteractiveElement = (el) => {
    const interactiveTags = ["button", "a", "input", "textarea", "select"];
    if (interactiveTags.includes(el.tagName.toLowerCase())) return true;
    if (el.onclick) return true;
    if (el.closest('button, a[href], [role="button"], [role="link"]'))
      return true;
    return false;
  };

  const handleFirstInteraction = (event) => {
    // Handler for first user interaction, either by click/tap or touchstart.

    if (event.type === "click" && isInteractiveElement(event.target)) {
      // Ignore attempt to autoplay via `videoControlPlay()` if the click was on an interactive element (button, link, etc.),
      // to avoid triggering play just before navigating to a new page.

      updateIOSDebugState({
        interactionTriggered: true,
        interactionType: event.type,
        interactionSkipped: true,
        skipReason: "interactive element",
        interactionTime: new Date().toISOString(),
      });
    } else {
      try {
        videoControlPlay();
        updateIOSDebugState({
          interactionTriggered: true,
          interactionType: event.type,
          playbackAttempted: true,
          success: true,
          interactionTime: new Date().toISOString(),
        });
      } catch (e) {
        updateIOSDebugState({
          interactionTriggered: true,
          interactionType: event.type,
          playbackAttempted: true,
          success: false,
          error: e.message,
          interactionTime: new Date().toISOString(),
        });
      }
    }

    // Remove all listeners after first interaction
    document.removeEventListener("click", handleFirstInteraction);
    document.removeEventListener("touchstart", handleFirstInteraction);
  };

  document.addEventListener("click", handleFirstInteraction, { once: true });
  document.addEventListener("touchstart", handleFirstInteraction, {
    once: true,
  });
}

async function handleVideoDirectLink() {
  const urlParams = new URLSearchParams(window.location.search);
  const ylvideoEntryId = urlParams.get("ylvideo");
  if (!ylvideoEntryId) return;

  try {
    const response = await fetch(`/i/?a=normal&search=e%3A${ylvideoEntryId}`);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const entryElement = doc.querySelector(`[data-entry="${ylvideoEntryId}"]`);
    if (entryElement) {
      const videoObject = extractFeedItemData(entryElement);
      videoObject.playbackTime = getStoredPlaybackTime(videoObject.entryId);
      videoObject.autoplay = 1;
      // Set the direct link entry as active in video queue.
      const queueObj = {
        queue: [videoObject],
        queue_active_index: 0,
      };
      handleActiveVideo(queueObj, true);
    } else {
      console.error(
        "Youlag: Could not find entry element for direct link:",
        ylvideoEntryId,
      );
    }
  } catch (e) {
    console.error(
      "Youlag: Error fetching or parsing video data for direct link:",
      e,
    );
  }
}

function handleActiveArticle() {
  pushHistoryState("articleOpen", true);
}

function closeArticle(event) {
  if (isArticleSplitViewActive()) return; // Closing an article does not apply for split view mode.
  const openedArticle = document.querySelector(app.frss.el.current);

  if (openedArticle) {
    // Focus closed article, to visually make it easier to navigate where one last left off.
    openedArticle.setAttribute("tabindex", "-1");
    openedArticle.focus({ preventScroll: true });

    // Close the article
    openedArticle.classList.remove("active", "current");
    const rect = openedArticle.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    let offset = 0;

    if (window.getComputedStyle) {
      const root = document.documentElement;
      const val = getComputedStyle(root).getPropertyValue("--yl-topnav-height");
      if (val) {
        offset = parseInt(val.trim(), 10) || 0;
      }
    }

    // Prevent sticky transition title from showing when auto-scrolling.
    const ylCategoryToolbar = document.getElementById(app.ui.id.toolbar);
    setToolbarStickyState(true);
    ylCategoryToolbar.classList.remove("sticky-visible");
    ylCategoryToolbar.classList.add("sticky-hidden");

    // Scroll to the top of the closed article, offset by `var(--yl-topnav-height)`.
    const targetScroll = rect.top + scrollTop - offset;
    window.scrollTo({
      top: Math.max(0, targetScroll),
    });
    event?.stopPropagation?.();

    setTimeout(() => {
      setToolbarStickyState(false);
    }, 50);

    setModalState(false);
    setHistoryPopstate(false); // Signal that a new pop state can be pushed for the next article
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

  let container = document.createElement("div");
  const useVideoLabels = document.querySelector("body.youlag-video-labels")
    ? true
    : false;
  const modalTitle = useVideoLabels ? "Save to..." : "Tags";
  container.id = `${app.modal.id.tagsContainer}`;
  container.classList.add(app.modal.class.tagsModalRoot);
  container.innerHTML = `
    <forms class="yl-tags-content">
      <h3 class="yl-tags-modal-title">
        ${modalTitle}

        <a href="./?c=tag" target="_blank"><img class="icon" src="../themes/Mapco/icons/configure.svg" loading="lazy" alt="⚙️"></a>
      </h3>
      <div class="yl-tags-list">
        ${tags
          .map(
            (tag) => `
            <div class="yl-tags-list-item">
              <input type="checkbox" id="yl-tag-${tag.id}" data-tag-id="${tag.id}" data-entry-id="${entryId}" ${tag.checked ? "checked" : ""} />
              <label for="yl-tag-${tag.id}">${tag.name}</label>
            </div>
          `,
          )
          .join("")}
      </div>
      <div class="yl-tags-modal-actions">
        <button id="yl-tags-modal-close" class="btn">Done</button>
      </div>
    </forms>
  `;

  document.body.appendChild(container);
  document.body.classList.add(app.modal.class.tagsModalOpen);

  // Event listener for tags (playlists) items.
  const checkboxes = container.querySelectorAll(
    `.${app.modal.class.tagsModalItem} input[type="checkbox"]`,
  );
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", function () {
      const tagId = this.getAttribute("data-tag-id");
      const entryId = this.getAttribute("data-entry-id");
      const checked = this.checked;
      setItemTag(entryId, { id: tagId, checked: checked });
    });
  });

  function closeTagsModal() {
    const modal = document.getElementById(`${app.modal.id.tagsContainer}`);
    if (modal) modal.remove();
    document.body.classList.remove(app.modal.class.tagsModalOpen);
    document.removeEventListener("keydown", tagsModalEscHandler, true);
  }

  // Close button
  const closeButton = container.querySelector(`#${app.modal.id.tagsClose}`);
  closeButton.addEventListener("click", closeTagsModal);

  // Close on Esc key
  function tagsModalEscHandler(event) {
    if (event.key === "Escape") {
      closeTagsModal();
      event.stopPropagation(); // Prevent bubbling to other modals
    }
  }
  document.addEventListener("keydown", tagsModalEscHandler, true);

  // Close onblur
  container.addEventListener("mousedown", function (event) {
    const content = container.querySelector(
      `.${app.modal.class.tagsModalContent}`,
    );
    if (content && !content.contains(event.target)) {
      closeTagsModal();
    }
  });
}
