/**
 * Watch history
 *
 * Records opened entries and adds the watch history page controls.
 * The page itself is a normal stream, served by the Youlag endpoint as a FreshRSS search for the viewed entry IDs (`e:<ids>`).
 */

function recordWatchHistory(feedItem) {
  // Anonymous reading has no history to save to.
  if (!syncEnabled() || getSetting("yl_watch_history_enabled") !== true) return;
  const entryId = feedItem?.getAttribute("data-entry")?.match(/([0-9]+)$/)?.[1];
  if (!entryId) return;
  dbSet("watchHistory", entryId, { viewedAt: syncNow() }, 0).catch(() => {});
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
  // Only entries viewed before the clear, so a new device keeps what it just pulled or recorded.
  await dbDeleteOlderThan("watchHistory", clearedAt).catch(() => {});
  await dbDropQueuedMissing(["watchHistory"]);
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
    // Includes the entries opened in the last few seconds.
    await syncWithin(syncFlush(), "Youlag couldn't sync your latest views. The history may miss them for now.");
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
  // Empties the header and mobile searches, which would otherwise show the page's entry ID list and add it to new searches.
  document.querySelectorAll("input[name='search']").forEach((search) => (search.value = ""));
  // FreshRSS marks the search button active, since this page is queried as a search.
  document.getElementById("toggle-search")?.classList.remove("active");
  document.title = document.title.replace(/“e:[0-9,]*”/, "Watch history");
  sortWatchHistoryEntries();
  renderWatchHistoryControls();
  setupWatchHistoryLoadMore();
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

function setupWatchHistoryLoadMore() {
  // Each page FreshRSS loads is sorted by date, and may repeat an entry already shown.
  const stream = getFeedRoot();
  if (!stream) return;
  const shownIds = new Set([...stream.querySelectorAll(app.frss.el.entry)].map((entry) => entry.dataset.entry));
  // On body, so duplicates are removed before the document listeners prepare the new entries.
  document.body.addEventListener("freshrss:load-more", () => {
    const loaded = [];
    const pageIds = new Set();
    for (const entry of stream.querySelectorAll(app.frss.el.entry)) {
      const entryId = entry.dataset.entry;
      if (pageIds.has(entryId)) {
        entry.remove();
        continue;
      }
      pageIds.add(entryId);
      if (!shownIds.has(entryId)) loaded.push(entry);
    }
    loaded.forEach((entry) => shownIds.add(entry.dataset.entry));
    renderWatchHistoryControls();
    if (loaded.length > 1) sortLoadedWatchHistoryEntries(stream, loaded);
  });
}

async function sortLoadedWatchHistoryEntries(stream, entries) {
  // Orders a loaded page by the server's view times, the same order the server pages by. This browser only has its
  // own views. If the request fails, the page keeps FreshRSS's order.
  const { rows } = await syncPost("fetch", {
    stores: ["watchHistory"],
    keys: entries.map((entry) => entry.dataset.entry),
  }).catch(() => ({ rows: [] }));
  const viewedAt = new Map(rows.map((row) => [row.key, row.updatedAt]));
  const footer = stream.querySelector("#stream-footer, .stream-footer");
  [...entries]
    .sort((a, b) => (viewedAt.get(b.dataset.entry) || 0) - (viewedAt.get(a.dataset.entry) || 0))
    .forEach((entry) => entry.isConnected && stream.insertBefore(entry, footer));
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

  const menuContent = document.getElementById("yl_nav_menu_container_content");
  if (!menuContent || document.getElementById(app.watchHistory.clearId)) return;
  const clearButton = document.createElement("button");
  clearButton.id = app.watchHistory.clearId;
  clearButton.type = "button";
  clearButton.className = "btn";
  clearButton.textContent = "Clear watch history";
  clearButton.addEventListener("click", () => {
    if (!confirm("Clear the whole watch history?")) return;
    removeWatchHistory(null)
      .then(() => stream.querySelectorAll(app.frss.el.entry).forEach((entry) => entry.remove()))
      .catch((e) => console.error("Youlag: Could not clear watch history:", e));
  });
  // Before "More settings", which stays last in the view menu.
  menuContent.insertBefore(clearButton, document.getElementById("yl_nav_menu_settings_shortcut"));
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
