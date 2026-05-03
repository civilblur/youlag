/**
 * UI: Video control
 *
 * Handles interaction with the video's playback state, e.g. seeking to a chapter/timestamp.
 */

function renderModalVideoChapters(videoChapters) {
  // Appends video chapters to the video modal.
  const modal = getModalVideo();
  const chapterContainer = modal.querySelector(
    `#${app.modal.id.chapterContainer}`,
  );
  const iframe = modal.querySelector(`#${app.modal.id.videoIframe}`);
  const videoSource = iframe?.getAttribute("data-yl-is-video");

  if (!modal || !videoChapters || videoChapters.length === 0) {
    if (chapterContainer) chapterContainer.remove();
    return;
  }
  if (!chapterContainer) return;

  // Chapter only supported for YouTube as playback source.
  if (videoSource !== "youtube") chapterContainer.classList.add("display-none");

  // List all chapters
  const chapterList = document.createElement("div");
  chapterList.id = app.modal.id.chapterList;
  chapterList.classList.add(app.modal.class.chapterList);

  videoChapters.forEach((chapter) => {
    const item = document.createElement("div");
    item.classList.add("yl-video-chapter-list-item");
    item.setAttribute("data-seconds", chapter.seconds);
    item.setAttribute("data-order", chapter.order);
    item.innerHTML = `
      <span class="yl-video-chapter-list-item__time yl-badge">${chapter.timestamp}</span>
      <span class="yl-video-chapter-list-item__label">${chapter.label}</span>
    `;
    chapterList.appendChild(item);
  });

  chapterContainer.appendChild(chapterList);
}

function setupModalVideoControlEventListeners() {
  // Attach click event listeners to chapter items for seeking
  const modal = getModalVideo();
  if (!modal) return;

  if (!modal._videoModalListeners) modal._videoModalListeners = [];

  if (app.state && app.state.modal) app.state.modal.chapterLastActiveIndex = -1;

  // Remove existing listeners for chapter list items
  if (modal._videoModalListeners && Array.isArray(modal._videoModalListeners)) {
    modal._videoModalListeners = modal._videoModalListeners.filter(
      (listener) => {
        if (
          listener.type === "click" &&
          listener.el &&
          listener.el.classList &&
          listener.el.classList.contains("yl-video-chapter-list-item")
        ) {
          listener.el.removeEventListener(listener.type, listener.handler);
          return false;
        }
        return true;
      },
    );
  }

  // Remove existing click listener for chapters current panel.
  const chapterCurrent = modal.querySelector(`#${app.modal.id.chapterCurrent}`);
  if (modal._videoModalListeners && Array.isArray(modal._videoModalListeners)) {
    modal._videoModalListeners = modal._videoModalListeners.filter(
      (listener) => {
        if (listener.type === "click" && listener.el === chapterCurrent) {
          listener.el.removeEventListener(listener.type, listener.handler);
          return false;
        }
        return true;
      },
    );
  }

  // Attach new chapter click listeners.
  const chapterItems = modal.querySelectorAll(".yl-video-chapter-list-item");
  chapterItems.forEach((item) => {
    const seconds = parseInt(item.getAttribute("data-seconds"), 10);
    const chapterClickHandler = function (e) {
      e.preventDefault();
      chapterItems.forEach((i) => i.classList.remove("is-active")); // Clear previous active state
      item.classList.add("is-active");
      updateChapterActionButtons();
      videoControlSeekTo(seconds, true);
    };
    item.addEventListener("click", chapterClickHandler);
    modal._videoModalListeners.push({
      el: item,
      type: "click",
      handler: chapterClickHandler,
    });
  });

  const chapterActionPrevious = modal.querySelector(
    `#${app.modal.id.chapterActionPrevious}`,
  );
  const chapterActionNext = modal.querySelector(
    `#${app.modal.id.chapterActionNext}`,
  );
  const chapterItemsArr = Array.from(
    modal.querySelectorAll(".yl-video-chapter-list-item"),
  );

  function updateChapterActionButtons() {
    // Set chapter skip button states
    let activeIndex = chapterItemsArr.findIndex((item) =>
      item.classList.contains("is-active"),
    );
    if (activeIndex === -1) activeIndex = 0;
    if (chapterActionPrevious)
      chapterActionPrevious.classList.toggle("is-disabled", activeIndex === 0);
    if (chapterActionNext)
      chapterActionNext.classList.toggle(
        "is-disabled",
        activeIndex === chapterItemsArr.length - 1,
      );
  }

  // Chapter skip button initial state
  updateChapterActionButtons();

  // Chapter skip handlers for previous/next buttons
  function handleChapterSkip(direction) {
    const activeIndex = chapterItemsArr.findIndex((item) =>
      item.classList.contains("is-active"),
    );
    const targetIndex = activeIndex + direction;
    if (targetIndex < 0 || targetIndex >= chapterItemsArr.length) return;
    const targetItem = chapterItemsArr[targetIndex];
    if (targetItem) {
      const seconds = parseInt(targetItem.getAttribute("data-seconds"), 10);
      videoControlSeekTo(seconds, true);
      chapterItemsArr.forEach((item, idx) =>
        item.classList.toggle("is-active", idx === targetIndex),
      );
      updateChapterActionButtons();
    }
  }

  if (chapterActionPrevious) {
    const prevHandler = (e) => {
      e.preventDefault();
      handleChapterSkip(-1);
    };
    chapterActionPrevious.addEventListener("click", prevHandler);
    modal._videoModalListeners.push({
      el: chapterActionPrevious,
      type: "click",
      handler: prevHandler,
    });
  }
  if (chapterActionNext) {
    const nextHandler = (e) => {
      e.preventDefault();
      handleChapterSkip(1);
    };
    chapterActionNext.addEventListener("click", nextHandler);
    modal._videoModalListeners.push({
      el: chapterActionNext,
      type: "click",
      handler: nextHandler,
    });
  }

  // Toggle chapter list visibility by clicking the current chapter.
  const chapterCurrentPanel = modal.querySelector(
    `#${app.modal.id.chapterPanel}`,
  );
  const chapterList = modal.querySelector(`#${app.modal.id.chapterList}`);
  const chapterCurrentClickHandler = function (e) {
    e.preventDefault();
    if (!chapterCurrent) return;
    const isExpanded = chapterCurrent.classList.contains("is-expanded");
    if (isExpanded) {
      chapterCurrent.classList.remove("is-expanded");
    } else {
      chapterCurrent.classList.add("is-expanded");
      // Scroll to the active chapter.
      if (chapterList) {
        const activeItem = chapterList.querySelector(
          ".yl-video-chapter-list-item.is-active",
        );
        if (activeItem) {
          const listRect = chapterList.getBoundingClientRect();
          const itemRect = activeItem.getBoundingClientRect();
          const scrollTop = chapterList.scrollTop;
          const offset =
            itemRect.top -
            listRect.top -
            listRect.height / 2 +
            itemRect.height / 2;
          chapterList.scrollTo({ top: scrollTop + offset, behavior: "smooth" });
        }
      }
    }
  };
  if (chapterCurrentPanel) {
    chapterCurrentPanel.addEventListener("click", chapterCurrentClickHandler);
    modal._videoModalListeners.push({
      el: chapterCurrentPanel,
      type: "click",
      handler: chapterCurrentClickHandler,
    });
  }

  // Display the current chapter and wire playback tracking.
  const { setActiveChapter } = updateActiveChapterDisplay();
  const youtubeId = app.state.modal.youtubeId || null;
  let cachedVideoDuration = null;

  setupVideoPlaybackPosition(
    modal,
    (currentTime, videoDuration, playerState) => {
      setActiveChapter(currentTime, videoDuration);

      // Persist duration to its own store when first received from the YouTube iframe API.
      // Stored separately from dearrow so it survives dearrow cache expiry (video duration never changes).
      if (youtubeId && videoDuration && videoDuration !== cachedVideoDuration) {
        cachedVideoDuration = videoDuration;
        const durationFloor = Math.floor(videoDuration);
        dbSet("duration", youtubeId, durationFloor, 52).catch(() => {});
        updateFeedEntryDuration(youtubeId, durationFloor);
      }

      // Store current playback time and state to resume miniplayer from the same position.
      const entryId = modal.getAttribute("data-entry");
      if (entryId) {
        try {
          const stored = JSON.parse(
            localStorage.getItem(app.modal.queue.localStorageKey),
          );
          if (stored && Array.isArray(stored.queue)) {
            const entry = stored.queue.find((v) => v.entryId === entryId);
            if (entry) {
              entry.playbackTime = Math.floor(currentTime);
              if (videoDuration)
                entry.videoDuration = Math.floor(videoDuration);
              if (playerState === 1 || playerState === 3) {
                // Treat state 1 (playing) and 3 (buffering) as playing
                entry.playerState = "playing";
              } else if (playerState === 2) {
                // State 2: explicitly paused
                entry.playerState = "paused";
              }
              localStorage.setItem(
                app.modal.queue.localStorageKey,
                JSON.stringify(stored),
              );
            }
          }
        } catch (e) {}
      }
    },
  );
}

function setupVideoPlaybackPosition(modal, onTimeUpdate) {
  // Get YouTube iframe playback state.
  const iframe = modal.querySelector(`#${app.modal.id.videoIframe}`);
  if (!iframe) return;

  let videoDuration = null;
  let currentPlayerState = null;

  const onIframeLoad = function () {
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "listening" }),
        "*",
      );
    } catch (e) {
      console.warn(
        "Youlag: Video chapter failed to send 'listening' event after load",
        e,
      );
    }
    if (modal._chapterUpdateInterval) {
      clearInterval(modal._chapterUpdateInterval);
      modal._chapterUpdateInterval = null;
    }
    modal._chapterUpdateInterval = setInterval(() => {
      if (
        !document.body.contains(modal) ||
        !modal.parentNode ||
        !iframe.contentWindow
      ) {
        clearInterval(modal._chapterUpdateInterval);
        modal._chapterUpdateInterval = null;
        return;
      }
      iframe.contentWindow.postMessage(
        '{"event":"command","func":"getCurrentTime","args":[]}',
        "*",
      );
    }, 1000);
  };
  iframe.addEventListener("load", onIframeLoad);
  if (iframe.readyState === "complete" || iframe.readyState === "interactive") {
    onIframeLoad();
  }
  modal._videoModalListeners.push({
    el: iframe,
    type: "load",
    handler: onIframeLoad,
  });

  const onYouTubeMessage = function (event) {
    if (!event.data) return;
    let data;
    try {
      data =
        typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    } catch (e) {
      return;
    }
    if (data.event === "infoDelivery") {
      if (typeof data.info?.duration === "number") {
        videoDuration = data.info.duration;
      }
      if (typeof data.info?.playerState === "number") {
        currentPlayerState = data.info.playerState;
      }
      if (typeof data.info?.currentTime === "number") {
        onTimeUpdate(data.info.currentTime, videoDuration, currentPlayerState);
      }
    }
  };
  window.addEventListener("message", onYouTubeMessage);
  modal._videoModalListeners.push({
    el: window,
    type: "message",
    handler: onYouTubeMessage,
  });

  const observer = new MutationObserver(() => {
    if (!document.body.contains(modal)) {
      if (modal._chapterUpdateInterval) {
        clearInterval(modal._chapterUpdateInterval);
        modal._chapterUpdateInterval = null;
      }
      window.removeEventListener("message", onYouTubeMessage);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  if (!modal._videoModalObservers) modal._videoModalObservers = [];
  modal._videoModalObservers.push(observer);
}

function updateActiveChapterDisplay() {
  const modal = getModalVideo();
  if (!modal) return;
  const chapterActive = modal.querySelector(`#${app.modal.id.chapterCurrent}`);
  const chapterActiveTime = chapterActive?.querySelector(
    ".yl-video-chapter-current__order",
  );
  const chapterActiveLabel = chapterActive?.querySelector(
    ".yl-video-chapter-current__label",
  );
  const chapterCurrentProgress = chapterActive?.querySelector(
    `#${app.modal.id.chapterCurrentProgress}`,
  );
  const chapterItems = modal.querySelectorAll(".yl-video-chapter-list-item");
  const chapters = Array.from(chapterItems).map((item) => ({
    seconds: parseInt(item.getAttribute("data-seconds"), 10),
    label:
      item.querySelector(".yl-video-chapter-list-item__label")?.textContent ||
      "",
    timestamp:
      item.querySelector(".yl-video-chapter-list-item__time")?.textContent ||
      "",
  }));
  let lastChapterIndex = -1;

  if (chapterItems.length > 0) {
    // Only set initial state if not dirty
    if (chapterActive.getAttribute("data-yl-dirty") !== "true") {
      chapterItems.forEach((item, index) => {
        if (index === 0) {
          item.classList.add("is-active");
        } else {
          item.classList.remove("is-active");
        }
      });
      if (chapters.length > 0 && chapterActiveTime && chapterActiveLabel) {
        chapterActiveTime.textContent = `1 / ${chapters.length}`;
        chapterActiveLabel.textContent = chapters[0].label;
      }
      chapterActive.setAttribute("data-yl-dirty", "true");
    }
  }

  function updateChapterActionButtons() {
    // Update chapter skip button states only if activeIndex changed
    const chapterActionPrevious = modal.querySelector(
      `#${app.modal.id.chapterActionPrevious}`,
    );
    const chapterActionNext = modal.querySelector(
      `#${app.modal.id.chapterActionNext}`,
    );
    let activeIndex = Array.from(chapterItems).findIndex((item) =>
      item.classList.contains("is-active"),
    );
    if (activeIndex === -1) activeIndex = 0;
    if (typeof app.state.modal.chapterLastActiveIndex === "undefined")
      app.state.modal.chapterLastActiveIndex = -1;
    if (activeIndex === app.state.modal.chapterLastActiveIndex) return;
    app.state.modal.chapterLastActiveIndex = activeIndex;
    if (chapterActionPrevious)
      chapterActionPrevious.classList.toggle("is-disabled", activeIndex === 0);
    if (chapterActionNext)
      chapterActionNext.classList.toggle(
        "is-disabled",
        activeIndex === chapterItems.length - 1,
      );
  }

  function setActiveChapter(currentTime, videoDuration) {
    if (!chapterActiveTime || !chapterActiveLabel || chapters.length === 0) {
      return;
    }
    let activeIndex = chapters.length - 1;
    for (let i = 0; i < chapters.length; i++) {
      if (currentTime < chapters[i].seconds) {
        activeIndex = i - 1;
        break;
      }
    }
    if (activeIndex < 0) activeIndex = 0;
    if (activeIndex !== lastChapterIndex) {
      chapterActiveTime.textContent = `${activeIndex + 1} / ${chapters.length}`;
      chapterActiveLabel.textContent = chapters[activeIndex].label;
      lastChapterIndex = activeIndex;
    }
    chapterItems.forEach((item, index) => {
      if (index === activeIndex) {
        item.classList.add("is-active");
      } else {
        item.classList.remove("is-active");
      }
    });

    // Update skip button states as playback progresses
    updateChapterActionButtons();

    // Update chapter progress bar
    const isVideoChapterProgressEnabledElement = document.querySelector(
      "#yl_chapter_progress_enabled",
    );
    const isVideoChapterProgressEnabled =
      isVideoChapterProgressEnabledElement?.getAttribute(
        "data-yl-chapter-progress-enabled",
      ) === "true";
    if (chapterCurrentProgress && isVideoChapterProgressEnabled) {
      let chapterStart = chapters[activeIndex].seconds;
      let chapterEnd =
        activeIndex + 1 < chapters.length
          ? chapters[activeIndex + 1].seconds
          : null;
      let percent = 0;
      if (chapterEnd !== null && chapterEnd > chapterStart) {
        percent =
          ((currentTime - chapterStart) / (chapterEnd - chapterStart)) * 100;
      } else if (
        chapterEnd === null &&
        videoDuration &&
        videoDuration > chapterStart
      ) {
        // Calculate last chapter length based on total video duration.
        percent =
          ((currentTime - chapterStart) / (videoDuration - chapterStart)) * 100;
      }
      percent = Math.max(0, Math.min(100, percent));
      chapterCurrentProgress.style.width = percent + "%";
    }
  }

  return { setActiveChapter };
}

function videoControlSeekTo(seconds, allowSeekAhead = true) {
  // SeekTo a specific time in the YouTube iframe video player.

  const modal = getModalVideo();
  if (!modal) return;

  const iframe = modal.querySelector(`#${app.modal.id.videoIframe}`);
  if (!iframe) return;

  iframe.contentWindow.postMessage(
    '{"event":"command","func":"seekTo","args":["' +
      seconds +
      '", ' +
      allowSeekAhead +
      "]}",
    "*",
  );
}

function videoControlPlay() {
  // Trigger playVideo on the YouTube iframe video player.

  const modal = getModalVideo();
  if (!modal) return;

  const iframe = modal.querySelector(`#${app.modal.id.videoIframe}`);
  if (!iframe || !iframe.contentWindow) return;

  iframe.contentWindow.postMessage(JSON.stringify({ event: "listening" }), "*");

  try {
    iframe.contentWindow.postMessage(
      '{"event":"command","func":"playVideo","args":[]}',
      "*",
    );
  } catch (e) {
    try {
      const debugKey = "ylIOSDebug";
      const current = JSON.parse(localStorage.getItem(debugKey)) || {};
      localStorage.setItem(
        debugKey,
        JSON.stringify({
          ...current,
          videoControlPlayError: e.message,
          lastUpdate: new Date().toISOString(),
        }),
      );
    } catch (storageErr) {}
  }
}

function updateFeedEntryDuration(youtubeId, videoDuration) {
  // Update or create the .yl-video-duration badge on a feed entry thumbnail.
  // Finds the entry by matching youtubeId in the img src or data-yl-original-src (set when dearrow replaces the thumbnail).
  const entryImg = document.querySelector(
    `img[data-yl-original-src*="${youtubeId}"], ${app.frss.el.feedRoot} .item.thumbnail img[src*="${youtubeId}"]`,
  );
  if (!entryImg) return;

  const videoDurationText = formatTime(videoDuration);
  let durationEl = entryImg.parentElement.querySelector(".yl-video-duration");
  if (!durationEl) {
    durationEl = document.createElement("div");
    durationEl.className = "yl-video-duration";
    entryImg.parentElement.appendChild(durationEl);
  }
  durationEl.textContent = videoDurationText;
  getEntryRootElement(entryImg)?.setAttribute(
    "data-yl-video-duration",
    videoDurationText,
  );
}
