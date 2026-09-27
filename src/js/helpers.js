/**
 * Helpers
 *
 * Functions for handling, extracting, and mutating individual feed entries and their tags in Youlag.
 *
 * - Focused on per-feed-item logic, and DOM parsing.
 * - Used when you need to extract, mutate, or manage data for a feed entry, which is distinct from general utilities.
 * - Examples: extracting entry data, getting/setting tags, category whitelist checks, etc.
 */

async function getItemTags(itemId) {
  // Fetch tags for a given feed item ID.

  if (!itemId) return [];
  const url = `./?c=tag&a=getTagsForEntry&id_entry=${encodeURIComponent(itemId)}`;
  try {
    const response = await fetch(url, { method: "GET" });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (error) {
    console.error("Youlag: Error fetching tags:", error);
  }
  return [];
}

async function setItemTag(entryId, tag) {
  // Add or remove a feed item from a tag (playlists).

  const csrfToken =
    document.querySelector('input[name="_csrf"]')?.getAttribute("value") || "";
  const payload = {
    _csrf: csrfToken,
    id_tag: tag.id,
    name_tag: "",
    id_entry: entryId,
    checked: !!tag.checked,
    ajax: 1,
  };
  try {
    const response = await fetch("./?c=tag&a=tagEntry&ajax=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const text = await response.text();
      if (text && text.trim().length > 0) {
        try {
          const result = JSON.parse(text);
        } catch (jsonError) {
          console.error(
            "Youlag: Error parsing tag update response:",
            jsonError,
          );
        }
      }
    } else {
      console.error("Youlag: Failed to update tag:", response.status);
    }
  } catch (error) {
    console.error("Youlag: Error updating tag:", error);
  }
}

function getItemShareToggle(entryId, feedItemEl = null) {
  // Find FreshRSS' native share dropdown toggle of a feed item, in the feed stream.
  //
  // Sharing is delegated to FreshRSS' own share elements, which only exist within the feed item.
  // The feed item may be absent from the current view, e.g. when the miniplayer is restored on a page without a feed stream.

  let feedItem =
    feedItemEl instanceof Element && feedItemEl.isConnected ? feedItemEl : null;
  if (!feedItem && entryId) {
    // The feed item element may be missing or stale, e.g. after the feed stream was re-rendered.
    feedItem = document.querySelector(
      `${app.frss.el.feedRoot} ${app.frss.el.entry}[data-entry="${entryId}"]`,
    );
  }
  if (!feedItem) return null;

  return feedItem.querySelector(
    ".item.share a.dropdown-toggle, li.share a.dropdown-toggle",
  );
}

function getItemShareMenu(shareToggle) {
  // Read the sharing options of a feed item, from FreshRSS' native share dropdown menu.
  //
  // FreshRSS only builds the share dropdown menu on demand, from the `share_article_template` template,
  // hence its native `show_share_menu()` is called when the menu is missing.
  // The share elements are kept in place, so that sharing can be delegated to FreshRSS' own click handling.

  const shareMenu = { title: "", configureUrl: "", options: [] };
  const dropdown = shareToggle ? shareToggle.parentElement : null;
  if (!dropdown) return shareMenu;

  let menu = dropdown.querySelector(":scope > .dropdown-menu");
  if (!menu) {
    if (typeof show_share_menu !== "function") return shareMenu; // Native FreshRSS function.
    try {
      show_share_menu(shareToggle);
    } catch (error) {
      console.error("Youlag: Error building share menu:", error);
      return shareMenu;
    }
    menu = dropdown.querySelector(":scope > .dropdown-menu");
  }
  if (!menu) return shareMenu;

  const header = menu.querySelector(".dropdown-header");
  shareMenu.title = header?.firstChild?.textContent.trim() || "Share";
  shareMenu.configureUrl = header?.querySelector("a")?.href || "";

  menu.querySelectorAll(":scope > li.item").forEach((item) => {
    const shareElement = item.querySelector(
      `a[data-type], button[data-type], a[href="POST"]`,
    );
    if (!shareElement) return;
    const type = shareElement.getAttribute("data-type") || "post"; // Sharing services without a type are shared by POST form submit.
    if (type === "web-sharing-api" && !navigator.share) return; // Also hidden by FreshRSS when the browser lacks support.
    shareMenu.options.push({
      el: shareElement,
      label: shareElement.textContent.trim(),
      type: type,
      deprecated: item.classList.contains("error"), // Deprecated sharing service, flagged by FreshRSS.
    });
  });

  return shareMenu;
}

function extractFeedItemData(feedItem) {
  // Extract data from the provided target element.

  const entryId = feedItem.getAttribute("data-entry")?.match(/([0-9]+)$/);
  const authorId = feedItem
    .querySelector('.item.website a.item-element[href*="get=f_"]')
    ?.getAttribute("href")
    ?.match(/get=f_([0-9]+)/);
  let extractedVideoUrl =
    feedItem.querySelector(
      '.item.titleAuthorSummaryDate a[href*="youtube"], .item.titleAuthorSummaryDate a[href*="/watch?v="]',
    )?.href || "";
  if (!extractedVideoUrl) {
    // Fallback to see if user has installed the YouTube video feed/Invidious video feed extension, as they create a different DOM structure.
    extractedVideoUrl = feedItem.querySelector(
      '.enclosure-content a[href*="youtube"], .enclosure-content a[href*="/watch?v="]',
    );
    extractedVideoUrl = sanitizeExtractedVideoUrl(extractedVideoUrl);
  }

  const videoId = getVideoIdFromUrl(extractedVideoUrl);
  const isVideoFeedItem = videoId ? true : false;
  app.state.modal.youtubeId = videoId;
  const videoDescriptionExists =
    feedItem.querySelector(".enclosure-description") !== null;
  const videoDescription = videoDescriptionExists
    ? feedItem.querySelector(".enclosure-description")?.innerHTML.trim()
    : "";
  const videoBaseUrl = isVideoFeedItem ? getBaseUrl(extractedVideoUrl) : "";
  const youtubeUrl = app.state.modal.youtubeId
    ? `https://www.youtube.com/watch?v=${app.state.modal.youtubeId}`
    : "";
  const youtubeEmbedUrl = app.state.modal.youtubeId
    ? `https://www.youtube.com/embed/${app.state.modal.youtubeId}?enablejsapi=1`
    : "";
  const videoEmbedUrl = app.state.modal.youtubeId
    ? `${videoBaseUrl}/embed/${app.state.modal.youtubeId}?enablejsapi=1`
    : "";
  const authorElement = feedItem.querySelector(".flux_header");
  const authorFilterElement = authorElement?.querySelector(
    '.website a.item-element[href*="get=f_"]',
  );
  const invidiousInstance1 = getSetting("yl_invidious_instance");
  const videoSourceDefault =
    getSetting("yl_invidious_enabled") && getSetting("yl_invidious_instance")
      ? "invidious_1"
      : "youtube";

  const invidiousRedirectPrefixUrl = "https://redirect.invidious.io/watch?v=";

  // Get video chapters
  let videoChapters = extractVideoDescriptionChapters(videoDescription);

  // If video description is found, use it, otherwise fallback to generic description element.
  let video_description =
    isVideoFeedItem && videoDescriptionExists
      ? appendUrl(videoDescription)
      : feedItem.querySelector("article div.text")?.innerHTML.trim() || "";
  video_description = appendOriginalSrc(video_description);

  // Wrap video description intro in divs to setup for the setting "Hide description intro containing links".
  if (isVideoFeedItem && videoDescriptionExists) {
    video_description = wrapVideoDescription(video_description);

    if (isHideDescriptionIntroEnabled()) {
      video_description = hideVideoDescriptionIntro(video_description);
    }
  }

  // Video thumbnail, and fallback for article thumbnail
  let thumbnail = feedItem.querySelector(".thumbnail img")?.src || ""; // Default thumbnail rendered in DOM
  let thumbnail_video = "";
  let thumbnail_video_screencap = "";
  if (isVideoFeedItem) {
    thumbnail_video = `https://img.youtube.com/vi/${app.state.modal.youtubeId}/sddefault.jpg`;
    thumbnail_video_screencap = getDearrowScreencap(app.state.modal.youtubeId);
  }

  // Article in video mode: Hide first image if it's the same as the thumbnail/top image.
  if (!isVideoFeedItem && thumbnail && video_description) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = video_description;
    const firstImageContainer =
      tempDiv.querySelector("figure") || tempDiv.querySelector("img");
    if (firstImageContainer) {
      const img =
        firstImageContainer.querySelector("img") || firstImageContainer;
      if (img.src === thumbnail) {
        firstImageContainer.classList.add("display-none");
        video_description = tempDiv.innerHTML;
      }
    }
  }

  const videoObject = {
    entryId: entryId ? entryId[1] : null,
    authorId: authorId ? authorId[1] : null,
    author: authorElement?.getAttribute("data-article-authors") || "",
    author_filter_url: authorFilterElement?.href || "",
    favicon: feedItem.querySelector("img.favicon")?.src || "",
    website_name:
      feedItem.querySelector(".website .websiteName")?.textContent.trim() || "",
    favorite_toggle_url:
      feedItem.querySelector(app.frss.el.bookmark)?.href || "",
    favorited: !feedItem.querySelector('.bookmark img[src*="non-starred"]'),
    thumbnail,
    thumbnail_video: thumbnail_video || "",
    thumbnail_video_screencap: thumbnail_video_screencap || "",
    title:
      feedItem
        .querySelector(".item-element.title")
        ?.childNodes[0].textContent.trim() || "",
    external_link: feedItem.querySelector(".item-element.title")?.href || "",
    date:
      feedItem.querySelector(".flux_content .date")?.textContent.trim() || "",
    date_iso:
      feedItem.querySelector("time[datetime]")?.getAttribute("datetime") || "",
    isVideoFeedItem: isVideoFeedItem,
    youtubeId: app.state.modal.youtubeId,
    youtube_embed_url: youtubeEmbedUrl,
    video_embed_url: videoEmbedUrl,
    video_invidious_instance_1: invidiousInstance1 || "",
    video_source_default: videoSourceDefault || "youtube",
    video_description: `<div class="yl-video-description-content">
        ${video_description}
      </div>`,
    video_chapters: videoChapters || null,
    video_youtube_url: youtubeUrl,
    video_invidious_redirect_url: `${app.state.modal.youtubeId ? invidiousRedirectPrefixUrl + app.state.modal.youtubeId : ""}`,
  };

  return videoObject;
}

function extractVideoDescriptionChapters(videoDescription) {
  // Parse video description timestamps based on YouTube's rules.

  if (!videoDescription || typeof videoDescription !== "string") return [];

  // Sanitize and split on <br>, <br/>, <br />, and newlines.
  let lines = videoDescription
    .replace(/<br\s*\/?>(?:\s*)?/gi, "\n")
    .split(/\n/)
    .map((line) => line.replace(/<[^>]+>/g, "").trim());

  let order = 1;
  let lastSeconds = -1;
  let foundTimestamps = [];

  for (let cleanLine of lines) {
    if (!cleanLine) continue;
    // Match HH:MM:SS or MM:SS at the start of the line.
    let match = cleanLine.match(
      /^\[?(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})\]?\s*(.+)?$/,
    );
    if (match) {
      let ts = match[1];
      let label = (match[2] || "").trim();
      // Remove leading ' - ' if present, as many creators tend to format it this way.
      if (label.startsWith("- ")) {
        label = label.slice(2).trim();
      }
      // If chapter label is all caps, convert to sentence case to remove alarmist behavior.
      if (
        typeof isTextAllCaps === "function" &&
        typeof formatTextToSentenceCase === "function"
      ) {
        if (isTextAllCaps(label)) {
          label = formatTextToSentenceCase(label);
        }
      }
      // Pad timestamp to always have two digits for hours, minutes, and seconds.
      let parts = ts.split(":").map(Number);
      let paddedTs = "";
      if (parts.length === 3) {
        paddedTs = `${parts[0].toString().padStart(2, "0")}:${parts[1].toString().padStart(2, "0")}:${parts[2].toString().padStart(2, "0")}`;
      } else if (parts.length === 2) {
        paddedTs = `${parts[0].toString().padStart(2, "0")}:${parts[1].toString().padStart(2, "0")}`;
      } else {
        // Invalid format
        continue;
      }
      // Convert timestamp to seconds
      let seconds = 0;
      if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
      }
      // Ensures chronological order of chapters.
      if (seconds <= lastSeconds) continue;
      lastSeconds = seconds;
      foundTimestamps.push({
        timestamp: paddedTs,
        seconds: seconds,
        label: label,
        order: order++,
      });
    }
  }

  // Accept 0:00, 00:00, 0:00:00, or 00:00:00 as valid first chapters.
  if (
    foundTimestamps.length >= 3 &&
    /^0{1,2}:0{2}(?::0{2})?$/.test(foundTimestamps[0].timestamp)
  ) {
    return foundTimestamps;
  }
  return [];
}

async function fetchDearrowData(youtubeId) {
  // Returns null when DeArrow can't be reached. A 404 is a valid answer: the video has no DeArrow data.
  const apiUrl = `https://sponsor.ajay.app/api/branding?videoID=${encodeURIComponent(youtubeId)}`;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok && response.status !== 404) return null;
    return await response.json().catch(() => ({}));
  } catch (e) {
    return null;
  }
}

async function buildDearrowData(youtubeId, data) {
  // Ignore Dearrow thumbnail data and rely on `getVideoScreencapWithFallback()`.
  const thumbnailWithFallback = await getVideoScreencapWithFallback(youtubeId);
  return {
    thumbnails: [
      {
        timestamp: null,
        original: true,
        votes: 0,
        locked: false,
        UUID: "",
        userID: "",
        url: thumbnailWithFallback,
      },
    ],
    titles: Array.isArray(data.titles) ? data.titles : [],
    randomTime: data.randomTime ?? null,
    videoDuration: data.videoDuration ?? null,
  };
}

async function withStoredDuration(youtubeId, dearrowData) {
  // DeArrow often has no duration. The permanent duration store has it once the video played.
  if (dearrowData.videoDuration) return dearrowData;
  const stored = await dbGetRecord("duration", youtubeId).catch(() => undefined);
  return { ...dearrowData, videoDuration: stored?.value || null };
}

async function saveVideoDuration(youtubeId, seconds) {
  // Duration is permanent, and saved only when it changes.
  const duration = Math.floor(seconds);
  if (!youtubeId || !duration) return;
  const previous = await dbGetRecord("duration", youtubeId).catch(() => undefined);
  if (previous?.value === duration && !previous.ttlMs) return;
  return dbSet("duration", youtubeId, duration, 0);
}

async function getDearrowData(youtubeId, syncPulled = null) {
  if (!youtubeId) return null;
  // Check if data is cached in indexdb before making API call.
  let cached = await dbGetRecord("dearrow", youtubeId).catch(() => undefined);
  if (!dbIsFresh(cached) && syncPulled) {
    // Another device may have fetched it already.
    await syncPulled;
    cached = await dbGetRecord("dearrow", youtubeId).catch(() => undefined);
  }
  if (dbIsFresh(cached)) return withStoredDuration(youtubeId, cached.value);

  const data = await fetchDearrowData(youtubeId);
  if (!data && cached) {
    // DeArrow is down: keep the last good data.
    return withStoredDuration(youtubeId, cached.value);
  }
  const resultObj = await buildDearrowData(youtubeId, data || {});
  if (data) {
    await dbSetIfChanged("dearrow", youtubeId, resultObj, cached, 4).catch(() => {});
    if (resultObj.videoDuration) {
      await saveVideoDuration(youtubeId, resultObj.videoDuration).catch(() => {});
    }
  }
  return withStoredDuration(youtubeId, resultObj);
}

async function getSponsorSegments(youtubeId, dateIso) {
  if (!youtubeId) return [];
  const cached = await dbGetRecord("sponsorblock", youtubeId).catch(() => undefined);
  const lastGood = Array.isArray(cached?.value) ? cached.value : null;
  if (lastGood && dbIsFresh(cached)) return lastGood;

  const categories = [
    "sponsor",
    "selfpromo",
    "interaction",
    "intro",
    "outro",
    "preview",
    "hook",
    "filler",
    "music_offtopic",
  ];
  const apiUrl =
    `https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(youtubeId)}` +
    `&categories=${encodeURIComponent(JSON.stringify(categories))}` +
    `&actionTypes=${encodeURIComponent('["skip"]')}`;
  let segments;
  try {
    const response = await fetch(apiUrl);
    // 404 means the video has no segments.
    if (response.status === 404) {
      segments = [];
    } else if (response.ok) {
      const data = await response.json();
      segments = (Array.isArray(data) ? data : [])
        .map((s) => ({
          category: s.category,
          start: s.segment[0],
          end: s.segment[1],
        }))
        .sort((a, b) => a.start - b.start);
    } else {
      return lastGood || []; // SponsorBlock is down: keep the last good segments.
    }
  } catch (e) {
    return lastGood || []; // SponsorBlock is down: keep the last good segments.
  }
  // SponsorBlock segments may not immediately be available for new videos, thus
  // cache them shorter: 30min under a day old, 12h under a week old, otherwise 1 week.
  const ageHours = (Date.now() - new Date(dateIso)) / (60 * 60 * 1000);
  const ttlHours = ageHours < 24 ? 0.5 : ageHours < 24 * 7 ? 12 : 24 * 7;
  const ttlWeeks = ttlHours / (24 * 7);
  if (segments.length === 0 && !lastGood?.length) {
    // "No segments" is kept locally, and only synced when it replaces segments the video had before.
    dbPutRecord("sponsorblock", youtubeId, {
      value: [],
      timestamp: cached?.timestamp || Date.now(),
      ttlMs: ttlWeeks * DB_WEEK_MS,
      checkedAt: Date.now(),
    }).catch(() => {});
  } else {
    dbSetIfChanged("sponsorblock", youtubeId, segments, cached, ttlWeeks).catch(() => {});
  }
  return segments;
}

function getSubpageParentId(getParam) {
  /**
   * Check parent of current subpage.
   * Returns the parent id for a given getParam (e.g. 'get=t_8' or 'get=f_8').
   * For 't_{n}' returns parent id 'T', which 'playlists'.
   * For 'f_{n}' returns the category id (e.g. 'c_2') of the active category, or null if not found.
   */
  if (/^t_\d+$/.test(getParam)) {
    // Tag (playlists) page
    return "T";
  }
  if (/^f_\d+$/.test(getParam)) {
    // Filter page, a subpage of a category.
    const activeElem = document.querySelector(
      "#sidebar .tree-folder.category.active",
    );
    if (activeElem && activeElem.id) {
      return activeElem.id; // e.g. 'c_{n}'
    }
    return null;
  }
  return null;
}

function getCategoryWhitelist() {
  // Retrieve the category whitelist.
  const whitelist = getSetting("yl_category_whitelist");
  if (!Array.isArray(whitelist) || whitelist.length === 0) return ["all"];

  try {
    localStorage.setItem("youlagCategoryWhitelist", JSON.stringify(whitelist));
  } catch (e) {}

  return whitelist;
}

function isPageWhitelisted(whitelist, currentPageClass) {
  // Check if the current page/category is whitelisted.
  // Whitelisted pages/categories will use the video mode.

  if (!Array.isArray(whitelist) || !currentPageClass) return false;
  if (!isFeedPage()) return false;

  // If 'all' is included, it means every page and category will use the video mode.
  if (whitelist.includes("all")) return true;

  // Check if parent pages are whitelisted.
  const pageTypes = [
    "home",
    "important",
    "watch_later",
    "playlists",
    "search_results",
  ];
  for (const pt of pageTypes) {
    const className = `yl-page-${pt}`;
    if (
      (currentPageClass === className ||
        currentPageClass.split(/\s+/).includes(className)) &&
      whitelist.includes(pt)
    ) {
      return true;
    }
  }

  // Check if category pages are whitelisted.
  if (currentPageClass.startsWith("yl-page-category")) {
    const match = currentPageClass.match(/c_(\d+)/);
    if (match && whitelist.includes("c_" + match[1])) {
      return true;
    }
  }

  // Check if subpage parent category is whitelisted.
  const urlParams = new URLSearchParams(window.location.search);
  const getParam = urlParams.get("get");
  if (getParam) {
    const parentId = getSubpageParentId(getParam);
    if (parentId && whitelist.includes(parentId)) {
      return true;
    }
  }

  return false;
}

function getFreshRssUrlPrefix() {
  /**
   * Provides prefix that is used for appendeding FreshRSS page URLs.
   * For example, if freshrss is installed at http://localhost/freshrss/, return '/freshrss'.
   * If it is installed at http://localhost/, return ''.
   */

  const el = document.querySelector("#yl_base_url");
  if (!el) return "";

  const data = el.getAttribute("data-yl-base-url");
  if (!data || data === "") return "";

  const pathname = new URL(data).pathname;
  return pathname.replace(/\/+$/, "");
}

function setFreshRssUrlPrefix() {
  let prefix = getFreshRssUrlPrefix();
  prefix ? (app.frss.urlPrefix = prefix) : (app.frss.urlPrefix = "");
}

function isVideoLabelsEnabled() {
  // Check if video platform label setting is enabled.
  // TODO: Refactor this once `Minz_HookType::JsVars` is implemented.
  return document.body.classList.contains("yl-video-labels");
}
