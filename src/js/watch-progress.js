/**
 * Watch progress
 *
 * Shows how much of each video was watched, as a bar on its thumbnail, filters the history page
 * to videos in progress, and clears the saved video data.
 */

function getWatchProgress(youtubeId) {
  const saved = youtubeId ? getSavedPlayback(youtubeId) : null;
  if (!saved?.duration) return null;
  return saved.finished ? 1 : Math.min(saved.seconds / saved.duration, 1);
}

function getEntryVideoId(entry) {
  return getVideoIdFromUrl(
    entry.querySelector(".flux_header .titleAuthorSummaryDate a.title")?.href,
  );
}

function updateEntryWatchProgress(entry, youtubeId) {
  const container = entry.querySelector(".item.thumbnail img")?.parentElement;
  if (!container) return;
  const progress = getWatchProgress(youtubeId);
  let bar = container.querySelector(`.${app.watchProgress.className}`);
  if (progress === null) {
    bar?.remove();
    return;
  }
  if (!bar) {
    // A progress element takes its fill from attributes, since inline styles are blocked.
    bar = document.createElement("progress");
    bar.className = app.watchProgress.className;
    bar.max = 100;
    container.appendChild(bar);
  }
  bar.value = Math.round(progress * 100);
}

function renderWatchProgress(root = getFeedRoot()) {
  if (!root || getSetting("yl_watch_progress_enabled") !== true) return;
  root
    .querySelectorAll(`${app.frss.el.entry}[data-yl-is-video="true"]`)
    .forEach((entry) => updateEntryWatchProgress(entry, getEntryVideoId(entry)));
}

function updateFeedWatchProgress(youtubeId) {
  // Updates the cards of a video while it plays.
  if (!youtubeId || getSetting("yl_watch_progress_enabled") !== true) return;
  document
    .querySelectorAll(
      `${app.frss.el.feedRoot} .flux_header .titleAuthorSummaryDate a.title[href*="${youtubeId}"]`,
    )
    .forEach((title) => {
      const entry = getEntryRootElement(title);
      if (entry) updateEntryWatchProgress(entry, youtubeId);
    });
}

function isContinueWatching(youtubeId) {
  const progress = getWatchProgress(youtubeId);
  return (
    progress !== null &&
    progress >= app.watchProgress.continueMin &&
    progress <= app.watchProgress.continueMax
  );
}

function renderContinueWatchingToggle() {
  // Filters the history page to videos started but not finished.
  if (getCurrentPage().name !== "watch_history") return;
  const titleContainer = document.getElementById("yl_category_title_container");
  const stream = getFeedRoot();
  if (!titleContainer || !stream || document.getElementById(app.watchProgress.continueToggleId)) return;
  const toggle = document.createElement("button");
  toggle.id = app.watchProgress.continueToggleId;
  toggle.type = "button";
  toggle.textContent = "Continue watching";
  toggle.setAttribute("aria-pressed", "false");
  toggle.addEventListener("click", () => {
    const filtered = toggle.getAttribute("aria-pressed") !== "true";
    toggle.setAttribute("aria-pressed", String(filtered));
    stream.querySelectorAll(app.frss.el.entry).forEach((entry) => {
      entry.classList.toggle(
        app.watchProgress.hiddenClass,
        filtered && !isContinueWatching(getEntryVideoId(entry)),
      );
    });
  });
  const anchor =
    document.getElementById(app.watchHistory.clearId) ||
    titleContainer.querySelector("#yl_nav_menu_container_toggle");
  anchor?.before(toggle);
}

async function clearLocalVideoData(clearedAt = Infinity) {
  // Removes the video data saved before the clear. Data pulled or saved after it stays.
  for (const storeName of app.sync.videoStores) {
    await dbDeleteOlderThan(storeName, clearedAt).catch(() => {});
  }
  await dbDropQueuedMissing(app.sync.videoStores);
  for (const videoId of [...app.state.sync.playbackPositions.keys()]) {
    if (!(await dbGetRecord("playback", videoId).catch(() => undefined))) {
      app.state.sync.playbackPositions.delete(videoId);
    }
  }
  if (clearedAt === Infinity) app.state.sync.pulled.clear();
  renderWatchProgress();
}

async function clearSavedVideoData() {
  // Clears the server first, so a failed request leaves everything as it was.
  const { clearedAt } = await syncPost("clearVideoData", {});
  await clearLocalVideoData();
  localStorage.setItem(`ylVideoDataClearedAt:${getSetting("yl_user")}`, String(clearedAt));
}

async function applyVideoDataClear() {
  // Clears this browser's video data when it was cleared on another device since the last visit.
  const clearedAt = Number(getSetting("yl_video_data_cleared_at")) || 0;
  const flag = `ylVideoDataClearedAt:${getSetting("yl_user")}`;
  if (clearedAt <= (Number(localStorage.getItem(flag)) || 0)) return;
  await clearLocalVideoData(clearedAt);
  localStorage.setItem(flag, String(clearedAt));
}

function setupVideoDataSettings() {
  // Delegated, since the settings form loads into the slider after init.
  document.addEventListener("click", (event) => {
    const button = event.target.closest(`#${app.watchProgress.clearDataId}`);
    if (!button || !confirm("Clear saved video data on all your devices?")) return;
    button.disabled = true;
    clearSavedVideoData()
      .then(() => (button.textContent = "Saved video data cleared"))
      .catch(() => (button.disabled = false));
  });
}
