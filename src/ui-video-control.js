/**
 * UI: Video control
 *
 * Handles interaction with the video's playback state, e.g. seeking to a chapter/timestamp.
 */

async function renderModalVideoChapters(videoChapters, youtubeId) {
  // Appends video chapters to the video modal.
  const modal = getModalVideo();
  const chapterContainer = modal?.querySelector(
    `#${app.modal.id.chapterContainer}`,
  );

  if (!modal || !chapterContainer) return;
  if (!videoChapters || videoChapters.length === 0) {
    chapterContainer.classList.add("is-chapterless");
    updateChapterContainerVisibility();
    return;
  }
  chapterContainer.classList.remove("is-chapterless");

  const chapterListHeader = document.createElement("div");
  chapterListHeader.classList.add("yl-video-chapter-list-header");
  chapterListHeader.innerHTML = `
    <div>
      <span>Chapters</span>
      <div class="yl-video-chapter-list-header__hint">Uncheck chapters to skip when playback reaches them. Scrubbing into one still plays it.</div>
    </div>
    <button type="button" id="${app.modal.id.chapterEdit}" class="yl-button-menu">Edit</button>
  `;

  // List all chapters
  const chapterList = document.createElement("div");
  chapterList.id = app.modal.id.chapterList;
  chapterList.classList.add(app.modal.class.chapterList);

  videoChapters.forEach((chapter) => {
    const item = document.createElement("div");
    item.classList.add("yl-video-chapter-list-item");
    item.setAttribute("data-seconds", chapter.seconds);
    item.setAttribute("data-order", chapter.order);
    // Checkbox marks whether the chapter is watched or skipped, shown in edit mode.
    item.innerHTML = `
      <input type="checkbox" class="yl-video-chapter-list-item__checkbox" tabindex="-1" checked />
      <span class="yl-video-chapter-list-item__time yl-badge">${chapter.timestamp}</span>
      <span class="yl-video-chapter-list-item__label">${chapter.label}</span>
    `;
    chapterList.appendChild(item);
  });

  chapterContainer.appendChild(chapterListHeader);
  chapterContainer.appendChild(chapterList);
  updateChapterContainerVisibility();

  // Restore the chapters the user chose to skip for this video.
  if (!youtubeId) return;
  const skippedSeconds = await dbGet("chapterSkip", youtubeId).catch(
    () => null,
  );
  if (!Array.isArray(skippedSeconds)) return;
  chapterList
    .querySelectorAll(".yl-video-chapter-list-item")
    .forEach((item) => {
      if (!skippedSeconds.includes(Number(item.getAttribute("data-seconds"))))
        return;
      item.classList.add("is-skipped");
      item.querySelector(".yl-video-chapter-list-item__checkbox").checked =
        false;
    });
  updateChapterActionButtons();
  updateChapterCounter();
}

function updateChapterContainerVisibility() {
  // Bar shows for chapters or sponsor segments, YouTube source only.
  const modal = getModalVideo();
  const chapterContainer = modal?.querySelector(
    `#${app.modal.id.chapterContainer}`,
  );
  if (!chapterContainer) return;
  const iframe = modal.querySelector(`#${app.modal.id.videoIframe}`);
  const hasContent =
    modal.querySelectorAll(".yl-video-chapter-list-item").length > 0 ||
    modal._sponsorSegments?.length > 0;
  chapterContainer.classList.toggle(
    "display-none",
    iframe?.getAttribute("data-yl-is-video") !== "youtube" || !hasContent,
  );
}

async function setSponsorSegments(videoObject) {
  const modal = getModalVideo();
  if (!modal) return;
  modal._sponsorSegments = [];
  const categories = getSetting("yl_sponsorblock_categories") || [];
  if (
    getSetting("yl_sponsorblock_enabled") !== true ||
    categories.length === 0 ||
    !videoObject.youtubeId
  )
    return;
  const segments = await getSponsorSegments(
    videoObject.youtubeId,
    videoObject.date_iso,
  );
  // Fetches overlap when switching videos quickly, only the open video's result is kept.
  if (modal.getAttribute("data-entry") !== videoObject.entryId) return;
  modal._sponsorSegments = segments
    .filter((s) => categories.includes(s.category))
    .map((s) => ({ ...s, cancelled: false }));
  updateChapterContainerVisibility();
}

function setupModalVideoControlEventListeners(videoObject) {
  // Attach click event listeners to chapter items for seeking
  const modal = getModalVideo();
  if (!modal) return;

  if (!modal._videoModalListeners) modal._videoModalListeners = [];

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

  const chapterList = modal.querySelector(`#${app.modal.id.chapterList}`);

  // Attach new chapter click listeners.
  const chapterItems = modal.querySelectorAll(".yl-video-chapter-list-item");
  chapterItems.forEach((item) => {
    const seconds = parseInt(item.getAttribute("data-seconds"), 10);
    const chapterClickHandler = function (e) {
      e.preventDefault();
      if (chapterList?.classList.contains("is-editing")) {
        const isSkipped = item.classList.toggle("is-skipped");
        item.querySelector(".yl-video-chapter-list-item__checkbox").checked =
          !isSkipped;
        updateChapterActionButtons();
        updateChapterCounter();
        if (videoObject.youtubeId) {
          const skippedSeconds = Array.from(chapterItems)
            .filter((i) => i.classList.contains("is-skipped"))
            .map((i) => parseInt(i.getAttribute("data-seconds"), 10));
          dbSet("chapterSkip", videoObject.youtubeId, skippedSeconds, 52).catch(
            () => {},
          );
        }
        return;
      }
      if (item.classList.contains("is-skipped")) return;
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

  // Chapter skip button initial state
  updateChapterActionButtons();

  // Chapter skip handlers for previous/next buttons
  function handleChapterSkip(direction) {
    const activeIndex = chapterItemsArr.findIndex((item) =>
      item.classList.contains("is-active"),
    );
    const targetIndex = findUnskippedChapterIndex(
      chapterItemsArr,
      activeIndex,
      direction,
    );
    if (targetIndex === -1) return;
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

  const chapterEdit = modal.querySelector(`#${app.modal.id.chapterEdit}`);
  if (chapterEdit && chapterList) {
    const chapterEditClickHandler = (e) => {
      e.preventDefault();
      const isEditing = chapterList.classList.toggle("is-editing");
      chapterEdit.textContent = isEditing ? "Done" : "Edit";
      updateChapterActionButtons();
    };
    chapterEdit.addEventListener("click", chapterEditClickHandler);
    modal._videoModalListeners.push({
      el: chapterEdit,
      type: "click",
      handler: chapterEditClickHandler,
    });
  }

  const sponsorBlockAction = modal.querySelector(
    `#${app.modal.id.sponsorBlockAction}`,
  );
  if (sponsorBlockAction) {
    // Cancels the auto-skip during the countdown, and skips while inside a segment.
    const sponsorBlockActionClickHandler = (e) => {
      e.preventDefault();
      const segment = sponsorBlockAction._sponsorSegment;
      if (!segment) return;
      if (sponsorBlockAction._sponsorMode === "countdown") {
        segment.cancelled = true;
        renderSponsorBlockAction(sponsorBlockAction, null, null);
        return;
      }
      // Jump past this segment, and any skipped content right after it.
      const target = getSkipTargetTime(segment.end, lastVideoDuration);
      if (target) videoControlSeekTo(target, true);
      sponsorBlockAction.classList.add("display-none");
    };
    sponsorBlockAction.addEventListener(
      "click",
      sponsorBlockActionClickHandler,
    );
    modal._videoModalListeners.push({
      el: sponsorBlockAction,
      type: "click",
      handler: sponsorBlockActionClickHandler,
    });
  }

  // Toggle chapter list visibility by clicking the current chapter.
  const chapterCurrentPanel = modal.querySelector(
    `#${app.modal.id.chapterPanel}`,
  );
  const chapterCurrentClickHandler = function (e) {
    e.preventDefault();
    if (!chapterCurrent) return;
    const isExpanded = chapterCurrent.classList.contains("is-expanded");
    if (isExpanded) {
      chapterCurrent.classList.remove("is-expanded");
      chapterList?.classList.remove("is-editing");
      if (chapterEdit) chapterEdit.textContent = "Edit";
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
  // Previous playing position, to tell playback reaching a segment from scrubbing into it.
  let lastPlayingTime = -1; // -1 so a segment at 0s is reached on play start.
  let lastVideoDuration = null;

  setupVideoPlaybackPosition(
    modal,
    (currentTime, videoDuration, playerState) => {
      setActiveChapter(currentTime, videoDuration, playerState);
      lastVideoDuration = videoDuration;
      updateSponsorBlockAction(
        currentTime,
        videoDuration,
        playerState,
        lastPlayingTime,
      );
      if (playerState === 1) lastPlayingTime = currentTime;

      // Persist duration to its own store when first received from the YouTube iframe API.
      // Stored separately from dearrow so it survives dearrow cache expiry (video duration never changes).
      if (youtubeId && videoDuration && videoDuration !== cachedVideoDuration) {
        cachedVideoDuration = videoDuration;
        const durationFloor = Math.floor(videoDuration);
        dbSet("duration", youtubeId, durationFloor, 52).catch(() => {});
        updateFeedEntryDuration(youtubeId, durationFloor);
      }

      const entryId = modal.getAttribute("data-entry");

      // Auto-remove from Watch later (favorites) once reaching user-set percentage.
      const autoRemoveSetting = getSetting("yl_watch_later_auto_remove"); // User setting, "off" or 10-95%.
      if (
        playerState === 1 && // Not while paused, so scrubbing doesn't trigger it.
        autoRemoveSetting !== "off" &&
        modal._autoRemovedEntryId !== entryId &&
        videoDuration > 0 &&
        currentTime / videoDuration >= autoRemoveSetting / 100
      ) {
        modal._autoRemovedEntryId = entryId;
        if (
          isModalVideoFavorited(
            modal.querySelector(`#${app.modal.id.favorite}`),
          )
        ) {
          toggleFavorite(videoObject.favorite_toggle_url, modal);
        }
      }

      // Store current playback time and state to resume miniplayer from the same position.
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
  // Distinguishes playback reaching a chapter from scrubbing into it.
  let lastPlayingChapterIndex = -1;

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
        updateChapterCounter();
        chapterActiveLabel.textContent = chapters[0].label;
      }
      chapterActive.setAttribute("data-yl-dirty", "true");
    }
  }

  function setActiveChapter(currentTime, videoDuration, playerState) {
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
    if (playerState === 1 && activeIndex !== lastPlayingChapterIndex) {
      // Skip an unchecked chapter when playback reaches its start, including the first chapter on play/restart.
      // Scrubbing into one simply plays it and does not skip.
      const isNaturalReach =
        (activeIndex === lastPlayingChapterIndex + 1 || activeIndex === 0) &&
        currentTime - chapters[activeIndex].seconds < 2; // Poll is about 1s, to allow for tick jitter.
      lastPlayingChapterIndex = activeIndex;
      if (
        isNaturalReach &&
        chapterItems[activeIndex].classList.contains("is-skipped")
      ) {
        const targetSeconds = getSkipTargetTime(
          chapters[activeIndex].seconds,
          videoDuration,
        );
        if (targetSeconds) videoControlSeekTo(targetSeconds, true);
      }
    }
    if (activeIndex !== lastChapterIndex) {
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
    updateChapterCounter();

    // Update chapter progress bar
    const isVideoChapterProgressEnabled =
      getSetting("yl_chapter_progress_enabled") === true;
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

function updateChapterActionButtons() {
  const modal = getModalVideo();
  if (!modal) return;
  const chapterActionPrevious = modal.querySelector(
    `#${app.modal.id.chapterActionPrevious}`,
  );
  const chapterActionNext = modal.querySelector(
    `#${app.modal.id.chapterActionNext}`,
  );
  const chapterItems = Array.from(
    modal.querySelectorAll(".yl-video-chapter-list-item"),
  );
  let activeIndex = chapterItems.findIndex((item) =>
    item.classList.contains("is-active"),
  );
  if (activeIndex === -1) activeIndex = 0;
  if (chapterActionPrevious)
    chapterActionPrevious.classList.toggle(
      "is-disabled",
      findUnskippedChapterIndex(chapterItems, activeIndex, -1) === -1,
    );
  if (chapterActionNext)
    chapterActionNext.classList.toggle(
      "is-disabled",
      findUnskippedChapterIndex(chapterItems, activeIndex, 1) === -1,
    );
}

function updateChapterCounter() {
  // Count only chapters that will be watched. Inside a skipped one, keep the previous watched number.
  const modal = getModalVideo();
  const counter = modal?.querySelector(".yl-video-chapter-current__order");
  if (!counter) return;
  const chapterItems = Array.from(
    modal.querySelectorAll(".yl-video-chapter-list-item"),
  );
  let activeIndex = chapterItems.findIndex((item) =>
    item.classList.contains("is-active"),
  );
  if (activeIndex === -1) activeIndex = 0;
  const watched = chapterItems.filter(
    (item) => !item.classList.contains("is-skipped"),
  );
  const watchedSoFar = watched.filter(
    (item) => chapterItems.indexOf(item) <= activeIndex,
  ).length;
  // Leading skipped chapters show 1, the upcoming first watched chapter.
  const position = Math.min(Math.max(watchedSoFar, 1), watched.length);
  counter.textContent = `${position} / ${watched.length}`;
}

function findUnskippedChapterIndex(items, fromIndex, direction) {
  // Nearest non-skipped chapter strictly before (-1) or after (1) `fromIndex`, or -1.
  for (
    let i = fromIndex + direction;
    i >= 0 && i < items.length;
    i += direction
  ) {
    if (!items[i].classList.contains("is-skipped")) return i;
  }
  return -1;
}

function getSkipTargetTime(seconds, videoDuration) {
  // Keep jumping past enabled segments and unchecked chapters, so a skip never lands in skipped content.
  const modal = getModalVideo();
  const segments = (modal?._sponsorSegments || []).filter((s) => !s.cancelled);
  const chapterItems = Array.from(
    modal?.querySelectorAll(".yl-video-chapter-list-item") || [],
  );
  let target = seconds;
  let moved = true;
  while (moved && (!videoDuration || target < videoDuration)) {
    moved = false;
    const segment = segments.find((s) => target >= s.start && target < s.end);
    if (segment) {
      target = segment.end;
      moved = true;
      continue;
    }
    const chapterIndex = chapterItems.findLastIndex(
      (item) => parseInt(item.getAttribute("data-seconds"), 10) <= target,
    );
    if (
      chapterIndex !== -1 &&
      chapterItems[chapterIndex].classList.contains("is-skipped")
    ) {
      const nextIndex = findUnskippedChapterIndex(
        chapterItems,
        chapterIndex,
        1,
      );
      // Nothing watched remains, so skip to the end.
      if (nextIndex === -1) return videoDuration || null;
      target = parseInt(
        chapterItems[nextIndex].getAttribute("data-seconds"),
        10,
      );
      moved = true;
    }
  }
  return target;
}

function updateSponsorBlockAction(
  currentTime,
  videoDuration,
  playerState,
  previousTime,
) {
  // Auto-skips a segment playback runs into, and shows the countdown or skip button around segments.
  const modal = getModalVideo();
  const button = modal?.querySelector(`#${app.modal.id.sponsorBlockAction}`);
  if (!button) return;
  const autoSkip = getSetting("yl_sponsorblock_auto_skip_enabled") === true;
  const segments = modal._sponsorSegments || [];
  // Cancel lasts until the user scrubs.
  if (
    playerState === 1 &&
    (currentTime < previousTime || currentTime - previousTime >= 3)
  ) {
    segments.forEach((s) => (s.cancelled = false));
  }
  const current = segments.find(
    (s) => currentTime >= s.start && currentTime < s.end,
  );
  // 9s keeps the countdown a single digit.
  const upcoming = segments.find(
    (s) => s.start > currentTime && s.start - currentTime <= 9,
  );

  // Auto-skip only when playback runs into the segment, not when seeking into it.
  if (
    current &&
    autoSkip &&
    !current.cancelled &&
    playerState === 1 &&
    previousTime < current.start &&
    currentTime - previousTime < 3 &&
    currentTime - current.start < 2
  ) {
    const target = getSkipTargetTime(current.end, videoDuration);
    if (target) videoControlSeekTo(target, true);
    button.classList.add("display-none");
    return;
  }

  // Countdown first, so a segment right after the current one never auto-skips unannounced.
  if (upcoming && autoSkip && playerState === 1 && !upcoming.cancelled) {
    renderSponsorBlockAction(
      button,
      upcoming,
      "countdown",
      Math.ceil(upcoming.start - currentTime),
    );
  } else if (current && playerState !== 0) {
    // Hide once ended, since the reported time can stop just short of the segment end.
    renderSponsorBlockAction(button, current, "skip");
  } else {
    renderSponsorBlockAction(button, null, null);
  }
}

function renderSponsorBlockAction(button, segment, mode, countdownSeconds) {
  // The click handler reads the shown segment and mode from the button.
  button._sponsorSegment = segment;
  button._sponsorMode = mode;
  button.classList.toggle("display-none", !segment);
  if (!segment) return;
  const isCountdown = mode === "countdown";
  button.querySelector(".yl-video-sponsorblock-action__label").textContent =
    isCountdown ? "Sponsor in" : "Skip sponsor";
  const countdown = button.querySelector(
    ".yl-video-sponsorblock-action__countdown",
  );
  countdown.textContent = isCountdown ? countdownSeconds : "";
  countdown.classList.toggle("display-none", !isCountdown);
  button
    .querySelector(".yl-video-sponsorblock-action__cancel")
    .classList.toggle("display-none", !isCountdown);
  button
    .querySelector(".yl-video-sponsorblock-action__skip")
    .classList.toggle("display-none", isCountdown);
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
