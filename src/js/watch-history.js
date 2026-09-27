/**
 * Watch history
 *
 * Records opened entries and adds the watch history page controls.
 * The page itself is a normal stream of the viewed entries, served by the Youlag endpoint.
 */

function recordWatchHistory(feedItem) {
  // Anonymous reading has no history to save to.
  if (!syncEnabled() || getSetting("yl_watch_history_enabled") !== true) return;
  const entryId = feedItem?.getAttribute("data-entry")?.match(/([0-9]+)$/)?.[1];
  if (!entryId) return;
  dbSet("watchHistory", entryId, { viewedAt: Date.now() }, 0).catch(() => {});
}

async function removeWatchHistory(entryIds) {
  // Removes entries from the watch history, or all of it when no entries are given.
  const { clearedAt } = await syncPost("watchHistoryRemove", entryIds ? { ids: entryIds } : { all: true });
  await dropLocalWatchHistory(entryIds);
  if (clearedAt) {
    localStorage.setItem(`ylWatchHistoryClearedAt:${getSetting("yl_user")}`, String(clearedAt));
  }
}

async function applyWatchHistoryClear() {
  // Clears this browser's watch history when it was cleared on another device since the last visit.
  const clearedAt = Number(getSetting("yl_watch_history_cleared_at")) || 0;
  const flag = `ylWatchHistoryClearedAt:${getSetting("yl_user")}`;
  if (clearedAt <= (Number(localStorage.getItem(flag)) || 0)) return;
  await dropLocalWatchHistory(null);
  localStorage.setItem(flag, String(clearedAt));
}

async function dropLocalWatchHistory(entryIds) {
  // Drops local history records and their unsent changes, all of them when no entries are given.
  for (const queueKey of [...app.state.sync.unsent.keys()]) {
    if (queueKey.startsWith("watchHistory:") && (!entryIds || entryIds.includes(queueKey.slice("watchHistory:".length)))) {
      app.state.sync.unsent.delete(queueKey);
    }
  }
  const queueKeys = await dbGetAllKeys(app.sync.queueStore).catch(() => []);
  const removedKeys = entryIds || (await dbGetAllKeys("watchHistory").catch(() => []));
  for (const key of removedKeys) {
    await dbDelete("watchHistory", key).catch(() => {});
  }
  for (const queueKey of queueKeys) {
    const key = queueKey.slice("watchHistory:".length);
    if (queueKey.startsWith("watchHistory:") && (!entryIds || entryIds.includes(key))) {
      await dbDelete(app.sync.queueStore, queueKey).catch(() => {});
    }
  }
}

function renderWatchHistoryLink() {
  // Adds the watch history link below the favorites in the sidenav, since FreshRSS has no hook there.
  if (!syncEnabled() || getSetting("yl_watch_history_enabled") !== true) return;
  const favorites = document.querySelector("#aside_feed #sidebar .category.favorites");
  if (!favorites || document.getElementById(app.watchHistory.linkId)) return;
  const item = document.createElement("li");
  item.id = app.watchHistory.linkId;
  item.className = "tree-folder category yl-watch-history";
  item.innerHTML = `<a class="tree-folder-title" data-unread="0" href="${app.watchHistory.url}"><span class="title" data-unread="0">Watch history</span></a>`;
  const link = item.querySelector("a");
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    await syncFlush(); // Includes the entries opened in the last few seconds.
    window.location.href = link.href;
  });
  favorites.after(item);
}

function setupWatchHistoryPage() {
  if (getCurrentPage().name !== "watch_history") return;
  document
    .querySelectorAll("#aside_feed #sidebar .tree-folder.active")
    .forEach((el) => el.classList.remove("active"));
  document.getElementById(app.watchHistory.linkId)?.classList.add("active");
  // Empties the header search, which would otherwise show the page's entry ID list and add it to new searches.
  const search = document.querySelector(".header .search input[name='search']");
  if (search) search.value = "";
  document.title = document.title.replace(/“e:[0-9,]*”/, "Watch history");
  sortWatchHistoryEntries();
  renderWatchHistoryControls();
}

function sortWatchHistoryEntries() {
  // Orders entries by last viewed, since FreshRSS sorts the stream by date.
  const order = getSetting("yl_watch_history_order");
  const stream = getFeedRoot();
  if (!Array.isArray(order) || !stream) return;
  const footer = stream.querySelector("#stream-footer, .stream-footer");
  for (const entryId of order) {
    const entry = stream.querySelector(`${app.frss.el.entry}[data-entry="${entryId}"]`);
    if (entry) stream.insertBefore(entry, footer);
  }
}

function renderWatchHistoryControls() {
  const stream = getFeedRoot();
  if (!stream) return;
  stream.querySelectorAll(app.frss.el.entry).forEach((entry) => {
    const header = entry.querySelector(".flux_header");
    if (!header || header.querySelector(`.${app.watchHistory.removeClass}`)) return;
    // Styled as the other entry actions.
    const item = document.createElement("li");
    item.className = `item manage ${app.watchHistory.removeClass}`;
    item.innerHTML = `<a class="item-element" href="#" role="button" title="Remove from watch history" aria-label="Remove from watch history"><img class="icon" src="../themes/icons/close.svg" alt="" /></a>`;
    item.querySelector("a").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation(); // Keeps the click from opening the entry.
      removeWatchHistory([entry.getAttribute("data-entry")])
        .then(() => entry.remove())
        .catch((e) => console.error("Youlag: Could not remove from watch history:", e));
    });
    header.appendChild(item);
  });

  const titleContainer = document.getElementById("yl_category_title_container");
  if (!titleContainer || document.getElementById(app.watchHistory.clearId)) return;
  const clearButton = document.createElement("button");
  clearButton.id = app.watchHistory.clearId;
  clearButton.type = "button";
  clearButton.textContent = "Clear watch history";
  clearButton.addEventListener("click", () => {
    if (!confirm("Clear the whole watch history?")) return;
    removeWatchHistory(null)
      .then(() => stream.querySelectorAll(app.frss.el.entry).forEach((entry) => entry.remove()))
      .catch((e) => console.error("Youlag: Could not clear watch history:", e));
  });
  titleContainer.querySelector("#yl_nav_menu_container_toggle")?.before(clearButton);
}

function setupWatchHistorySettings() {
  // Delegated, since the settings form loads into the slider after init.
  document.addEventListener("click", (event) => {
    const button = event.target.closest(`#${app.watchHistory.settingsClearId}`);
    if (!button || !confirm("Clear the whole watch history?")) return;
    button.disabled = true;
    removeWatchHistory(null)
      .then(() => (button.textContent = "Watch history cleared"))
      .catch(() => (button.disabled = false));
  });
}
