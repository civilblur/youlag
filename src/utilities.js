/**
 * Utilities
 *
 * General-purpose, cross-cutting utility functions.
 *
 * - Used for app-wide operations, data fetching, DOM and state utilities, and helpers that are not specific to a single feed entry or tag.
 * - Functions here are not tightly coupled to the UI handling.
 * - Examples: modal state, link parsing, global data fetchers, date formatting, etc.
 */

/*****************************************
 *
 * INDEX
 * - General utilities
 * - Modal utilities
 * - Link utilities
 * - State & settings utilities
 * - Data utilities
 *
 ****************************************/



/*****************************************
 * BEGIN "GENERAL UTILITIES"
 * General utility functions.
 ****************************************/

function isTextAllCaps(text) {
  // Check if a given text is all uppercase, ignoring non-letter characters.
  return /^[^a-z]*[A-Z][^a-z]*$/.test(text);
}

function formatTextToSentenceCase(text) {
  if (!text || typeof text !== 'string') return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function isYoutubePlaceholderImg(imgElement) {
  // Check if image is YouTube's placeholder by color at corners and (60,60)
  const canvas = document.createElement('canvas');
  canvas.width = imgElement.naturalWidth;
  canvas.height = imgElement.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgElement, 0, 0);
  const w = canvas.width, h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  function colorAt(x, y) {
    const idx = (y * w + x) * 4;
    return [data[idx], data[idx+1], data[idx+2]]; // [R,G,B]
  }

  function isColorClose(actual, expected, threshold) {
    const result = actual.every((v, i) => Math.abs(v - expected[i]) <= threshold);
    return result;
  }

  const threshold = 15; // tolerance for color difference
  const expectedCorner = [204, 204, 204]; // #CCCCCC
  const expectedPoint = [134, 134, 134]; // #868686

  // Check corners
  const corners = [
    colorAt(0, 0),
    colorAt(w - 1, 0),
    colorAt(0, h - 1),
    colorAt(w - 1, h - 1)
  ];
  if (!corners.every(c => isColorClose(c, expectedCorner, threshold, 'corner'))) {
    return false;
  }

  // Check point (60,60),the dark area in the middle of the placeholder.
  const pointColor = colorAt(60, 60);
  if (!isColorClose(pointColor, expectedPoint, threshold)) {
    return false;
  }

  return true;
}

/*****************************************
 * END "GENERAL UTILITIES"
 ****************************************/


/*****************************************
 * BEGIN "MODAL UTILITIES"
 * For handling video modal state and modes.
 ****************************************/

function getModalVideo() {
  return document.getElementById(app.modal.id.root);
}

function getModalMode() {
  return app.state.modal.mode; // 'miniplayer', 'fullscreen', or null
}

function isModeFullscreen() {
  return getModalMode() === 'fullscreen';
}

function isModeMiniplayer() {
  return getModalMode() === 'miniplayer';
}

function setModeState(mode) {
  if (mode !== 'miniplayer' && mode !== 'fullscreen' && mode !== null) return;
  return app.state.modal.mode = mode;
}

function getModalState() {
  return app.state.modal.active; // true = modal is active. Miniplayer does not count as active.
}

function setModalState(boolean) {
  return app.state.modal.active = boolean; // true = modal is active
}

/*****************************************
 * END "MODAL UTILITIES"
 ****************************************/



/*****************************************
 * BEGIN "LINK UTILITIES"
 * For handling link updates.
 ****************************************/

function updateAnchorLink(newUrl, anchorElement) {
  // Update anchor link href to a custom URL.
  if (anchorElement && anchorElement.tagName === 'A') {
    anchorElement.setAttribute('href', newUrl);
  }
}

function updateSidenavLinks() {
  // Update sidenav links for custom links.

  // Sort 'Watch later' by 'User modified 9→1': most recently added/modified feed items first.
  // TODO: refactor hardcoded classList.contains to use global `app` references.
  isWatchLaterSortModified = document.body.classList.contains('youlag-sort-watch_later--user-modified');

  if (!isWatchLaterSortModified) return;

  if (isWatchLaterSortModified) {
    updateAnchorLink(
      `${app.frss.urlPrefix}/i/?a=normal&get=s&sort=lastUserModified&order=DESC`,
      document.querySelector('#aside_feed #sidebar .category.favorites > a')
    );
  }
}

function updateAddFeedLink() {
  // Add a custom query param to the 'Add new feed' with the current category id, 
  // allowing auto-selection of the category in the 'add new feed' dropdown.

  const page = getCurrentPage();
  if (page.name === 'category') {
    // Use parentId if present, otherwise use id
    const categoryIdSource = page.parentId || page.id;
    const categoryId = categoryIdSource && categoryIdSource.startsWith('c_') ? categoryIdSource.match(/^c_(\d+)$/) : null;
    updateAnchorLink(
      `${app.frss.urlPrefix}/i/?c=subscription&a=add&yl_category_id=${categoryId ? categoryId[1] : ''}`,
      document.querySelector('#btn-add')
    );
    return;
  }
}

function getVideoIdFromUrl(url) {
  /**
   * Match video ID without relying of base domain, to support YouTube, Invidious, Piped, etc.
   * 
   * Patterns:
   * ?v=ID or ?id=ID (/watch?v=ID)
   * /shorts/ID, /embed/ID
   * /e/ID, /v/ID, /vi/ID (ytimg.com/vi/VIDEO_ID/[quality].jpg)
   * /ID (youtu.be/ID)
   */
  let videoId = '';
  const videoIdRegex = /^[a-zA-Z0-9_-]{11}$/;

  try {
    const { pathname, searchParams } = new URL(url);

    // Query param ?v= or ?id=
    const v = searchParams.get('v') || searchParams.get('id');
    if (v && videoIdRegex.test(v)) videoId = v;

    // Named path prefix: /shorts/ID, /embed/ID, /e/ID, /v/ID, /vi/ID
    const pathRegex = pathname.match(/\/(?:shorts|embed|e|v|vi)\/([a-zA-Z0-9_-]{11})(?:\/|$)/);
    if (pathRegex) videoId = pathRegex[1];

    // Sole path segment: /ID
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 1 && videoIdRegex.test(segments[0])) videoId = segments[0];
  } catch (_) {}

  return videoId || '';
}

function getBaseUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.protocol}//${parsedUrl.host}`;
  } catch (error) {
    console.error('Youlag: Invalid URL:', error);
    return '';
  }
}

function matchURL(text) {
  // Find URLs in e.g. video description.
  if (!text || typeof text !== 'string') return [];
  let textWithoutAnchors = text.replace(/<a [^>]*href=["'][^"']+["'][^>]*>.*?<\/a>/gi, '');
  let urlPattern = /https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+[\w\-_/~#@?=&%]/g;
  let matches = textWithoutAnchors.match(urlPattern);
  return matches ? matches : [];
}

function appendUrl(text) {
  // Append URLs anchor tags for URLs found in the video description, ignore existing potential anchor tags.
  if (!text || typeof text !== 'string') return text;
  let urlPattern = /https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+[\w\-_/~#@?=&%]/g;
  let parts = text.split(/(<a [^>]*>.*?<\/a>)/gi);
  for (let i = 0; i < parts.length; i++) {
    // Only replace in non-anchor segments
    if (!/^<a [^>]*>.*<\/a>$/i.test(parts[i])) {
      parts[i] = parts[i].replace(urlPattern, function (url) {
        return '<a href="' + url + '" target="_blank">' + url + '</a>';
      });
    }
  }
  return parts.join('');
}

function sanitizeExtractedVideoUrl(content) {
  // Sanitize the extracted video URL, which sometimes might end up being an actual HTML tag.
  // Ensure that the content return is a valid URL string.

  const str = String(content);
  if (/^https?:\/\//.test(str.trim())) {
    // If it's a valid URL string, return as is
    return str.trim();
  }

  // Try to extract href attribute from HTML tag
  const hrefMatch = str.match(/href=["']([^"'>]+)["']/);
  if (hrefMatch && hrefMatch[1]) {
    return hrefMatch[1];
  }

  return '';
}

function appendOriginalSrc(element) {
  // Update lazyloaded content, where `data-original` stores the original src.
  // This is required as the content may not have been fully loaded during extraction for modal usage. 

  if (!element) return element;

  let root;
  if (typeof element === 'string') {
    const temp = document.createElement('div');
    temp.innerHTML = element;
    root = temp;
  }
  else if (element instanceof Element) {
    root = element.cloneNode(true);
  }
  else {
    return element;
  }

  const elementsLazyloaded = root.querySelectorAll('[data-original]');
  elementsLazyloaded.forEach(el => {
    const srcOriginal = el.getAttribute('data-original');
    if (srcOriginal) {
      el.setAttribute('src', srcOriginal);
    }
  });

  if (typeof element === 'string') {
    return root.innerHTML;
  }
  return root;
}

function wrapVideoDescription(description) {
  // Wrap first and second paragraph of a YouTube video description in a div.
  // YouTube video descriptions uses <br><br> to separate paragraphs.

  const regex = /^([\s\S]*?<br\s*\/?>\s*<br\s*\/?>)([\s\S]*)$/i; // brbr pattern

  const match1 = description.match(regex);
  if (!match1) return description;

  const match2 = match1[2].match(regex);
  if (!match2) {
    return `<div class="${app.modal.class.descParagraph1}">${match1[1]}</div>` +
           match1[2]; // Remainder
  }
  return `<div class="${app.modal.class.descParagraph1}">${match1[1]}</div>` +
         `<div class="${app.modal.class.descParagraph2}">${match2[1]}</div>` +
         match2[2];
}

function hideVideoDescriptionIntro(description) {
  /** 
   * Hides the intro of YouTube video descriptions, which often contains sponsored content above the fold.
   * Assumes the intro is wrapped in divs by `wrapVideoDescription()`.
   */
  const temp = document.createElement('div');
  temp.innerHTML = description;
  const firstParagraph = temp.querySelector(`.${app.modal.class.descParagraph1}`);
  const secondParagraph = temp.querySelector(`.${app.modal.class.descParagraph2}`);

  if (firstParagraph && firstParagraph.querySelector('a')) {
    firstParagraph.classList.add('display-none');
  }

  const combinedLength = (firstParagraph?.textContent.length ?? 0) + (secondParagraph?.textContent.length ?? 0);
  if (secondParagraph && combinedLength <= 200 && secondParagraph.querySelector('a')) {
    firstParagraph?.classList.add('display-none');
    secondParagraph.classList.add('display-none');
  }

  return temp.innerHTML;
}

function getDearrowScreencap(youtubeId) {
  // Returns the Dearrow thumbnail URL synchronously (no fallback check).
  if (!youtubeId) return '';
  return `https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=${youtubeId}`;
}

async function getVideoScreencapWithFallback(youtubeId) {
  // Resolves to the best available thumbnail URL.
  // Priority: DeArrow screencap -> YouTube screencap -> YouTube thumbnail

  if (!youtubeId) return '';
  const dearrowUrl = getDearrowScreencap(youtubeId);
  const youtubeScreencapUrl = `https://img.youtube.com/vi/${youtubeId}/1.jpg`;
  const youtubeThumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

  // Try DeArrow first
  try {
    await new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dearrowUrl;
    });
    return dearrowUrl;
  } catch (e) {
    // DeArrow failed, try YouTube screencap
    try {
      const url = youtubeScreencapUrl;
      const img = await new Promise((resolve, reject) => {
        const i = new window.Image();
        i.crossOrigin = 'Anonymous';
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      // Determine if result is YouTube placeholder by checking the colors of specific points in the returned image.
      const isPlaceholder = isYoutubePlaceholderImg(img);
      if (!isPlaceholder) {
        return youtubeScreencapUrl;
      }
      else {
        return youtubeThumbnailUrl;
      }
    } catch (e2) {
      // Fallback to hqdefault in final return
    }
    return youtubeThumbnailUrl;
  }
}

function markVideoFeedItems() {
  // Determine if it's a video source and then mark it as such.
  // Checks if the feed entry consist of links: YouTube, custom Invidious instance.
  const feedEntries = document.querySelectorAll(`${app.frss.el.feedRoot} ${app.frss.el.entry}`);
  if (!feedEntries || feedEntries.length === 0) return false;
  const invidiousSetting = document.querySelector(`${app.frss.el.feedRoot} ${app.frss.el.entry}[data-yl-invidious-instance]`);
  const invidiousInstanceUrl = invidiousSetting ? invidiousSetting.getAttribute('data-yl-invidious-instance') : null;
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//;

  // For every feed entry that has attr [data-link="videoUrl"] matching either YouTube or the custom Invidious instance, mark as video source.
  let isVideo = false;
  for (const entry of feedEntries) {
    const videoUrl = entry.getAttribute('data-link');
    if (videoUrl && (youtubeRegex.test(videoUrl) || (invidiousInstanceUrl && videoUrl.startsWith(invidiousInstanceUrl)))) {
      entry.setAttribute('data-yl-is-video', 'true');
      isVideo = true;
    }
  }
  return isVideo;
}

function hasQueryParam(param) {
  // Check if the current URL has a specific query parameter.
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has(param);
}

function getVideoParamUrl(entryId) {
  const url = new URL(window.location.href);
  url.searchParams.set('ylvideo', entryId);
  const newUrl = url.toString();
  return newUrl;
}

function addVideoParamUrl(entryId) {
  // Adds or updates `ylvideo="{entryId}"` in the current URL, returns the new URL, and optionally sets it to an element's href.
  const url = new URL(window.location.href);
  url.searchParams.set('ylvideo', entryId);
  const newUrl = url.toString();
  window.history.replaceState(history.state, '', newUrl);
  return newUrl;
}

function removeVideoParamUrl(element = null) {
  // Removes the `ylvideo` query parameter from the URL.
  const url = new URL(window.location.href);
  url.searchParams.delete('ylvideo');
  const newUrl = url.toString();

  if (element && element.tagName === 'A') {
    element.setAttribute('href', newUrl);
  }
  else {
    window.history.replaceState(history.state, '', newUrl);
  }
}

/*****************************************
 * END "LINK UTILITIES"
 ****************************************/



/*****************************************
 * BEGIN "STATE & SETTINGS UTILITIES"
 * To get and set various states.
 ****************************************/

function getAttrValue(attr, element) {
  // Helper to get any value of a data attribute. Where element is optional, defaults to using it as querySelector on document.
  const el = element || document;
  const value = el.querySelector(`[${attr}]`)?.getAttribute(attr);
  return value;
}

function isMobile() {
  return window.innerWidth <= app.breakpoints.desktop_md_max;
}

function isIOS() {
  // iPadOS 13+ reports as MacIntel to request desktop sites, so the second condition catches modern iPads.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function getRelatedVideosSetting() {
  return document.querySelector('#yl_related_videos_source')?.getAttribute('data-yl-related-videos-source') || 'none';
}

function getHistoryPopstate() {
  return app.state.popstate.added; // true = history state for modal/article has been added
}

function setHistoryPopstate(state) {
  state = !!state;
  return app.state.popstate.added = state; // true = history state for modal/article has been added
}

function pushHistoryState(key, value = true) {
  // Pushes a new state to the history for modal close/back navigation.
  if (getModalState() && !getHistoryPopstate()) {
    const state = {};
    state[key] = value;
    history.pushState(state, '', '');
    setHistoryPopstate(true);
  }
}

function resetHistoryState() {
  // Fully resets the browser history state to null for the current URL.
  history.replaceState(null, '', location.href);
}

function getCurrentPage() {
  // Returns an object with details about the current page.
  const path = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const classPrefix = 'yl-page-';
  const fullUrl = window.location.href;
  const urlPath = window.location.origin + window.location.pathname;

  function prefixClasses(classString) {
    return classString.split(' ').map(cls => classPrefix + cls).join(' ');
  }

  let pageObject = {
    ...app.types.pageObject,
    url: fullUrl,
    urlPath: urlPath,
  }

  const routes = [
    {
      path: app.frss.urlPrefix + '/i/',
      match: () => urlParams.get('a') === 'normal' && urlParams.has('search'),
      className: 'search_results',
      name: 'search_results',
      id: null,
    },
    {
      path: app.frss.urlPrefix + '/i/',
      // Home page: no 'get' or 'c' param
      match: () => !urlParams.has('get') && !urlParams.has('c'),
      className: 'home',
      name: 'home',
      id: null,
    },
    {
      path: app.frss.urlPrefix + '/i/',
      match: () => urlParams.get('c') === 'extension',
      className: 'extension',
      name: 'extension',
      id: null,
    },
    {
      path: app.frss.urlPrefix + '/i/',
      match: () => urlParams.get('get') === 'i',
      className: 'important',
      name: 'important',
      id: () => urlParams.get('get'),
    },
    {
      path: app.frss.urlPrefix + '/i/',
      match: () => urlParams.get('get') === 's',
      className: 'watch_later',
      name: 'watch_later',
      id: () => urlParams.get('get'),
    },
    {
      path: app.frss.urlPrefix + '/i/',
      match: () => urlParams.get('get') === 'T',
      className: 'playlists',
      name: 'playlists',
      id: () => urlParams.get('get'),
    },
    {
      path: app.frss.urlPrefix + '/i/',
      match: () => /^t_\d+$/.test(urlParams.get('get') || ''),
      className: () => {
        const n = (urlParams.get('get') || '').substring(2);
        return `playlists t_${n}`;
      },
      name: 'playlists',
      id: () => urlParams.get('get'),
    },
    {
      path: app.frss.urlPrefix + '/i/',
      // Category page: get param starts with c_
      match: () => urlParams.get('get') && urlParams.get('get').startsWith('c_'),
      className: () => {
        const n = urlParams.get('get').substring(2);
        return `category c_${n}`;
      },
      name: 'category',
      id: () => urlParams.get('get'),
    },
    {
      path: app.frss.urlPrefix + '/i/',
      match: () => (urlParams.get('get') && urlParams.get('get').startsWith('f_')),
      className: () => {
        const n = urlParams.get('get').substring(2);
        return `category`;
      },
      name: 'category',
      id: () => urlParams.get('get'),
    },
  ];

  for (const route of routes) {
    if (path === route.path && route.match()) {
      const classString = typeof route.className === 'function' ? route.className() : route.className;
      const nameString = route.name || (typeof route.className === 'string' ? route.className : '');
      const idValue = typeof route.id === 'function' ? route.id() : route.id;
      pageObject.name = nameString;
      pageObject.class = prefixClasses(classString);
      pageObject.id = idValue;
      if (
        idValue &&
        typeof getSubpageParentId === 'function' &&
        (idValue.startsWith('f_') || idValue.startsWith('t_'))
      ) {
        const parent = getSubpageParentId(idValue);
        pageObject.parentId = parent || '';
      }
      return pageObject;
    }
  }

  return pageObject;
}

function isFeedPage() {
  // Determine if the current page is a feed page.
  const feedPageNames = new Set([
    'home',
    'important',
    'watch_later',
    'playlists',
    'category',
    'search_results',
  ]);
  const page = getCurrentPage();
  return feedPageNames.has(page.name);
}

function isWatchLaterPage() {
  const page = getCurrentPage();
  return page.name === 'watch_later';
}

function getFeedRoot() {
  return document.querySelector(app.frss.el.feedRoot);
}

function getSidebar() {
  return document.querySelector(app.frss.el.sidebar);
}

function getLayout() {
  return app.state.page.layout; // 'video' or 'article'
}

function setLayout(layout) {
  if (layout !== 'video' && layout !== 'article') return;
  app.state.page.layout = layout; // 'video' or 'article'
}

function isLayoutVideo() {
  return getLayout() === 'video';
}

function isLayoutArticle() {
  return getLayout() === 'article';
}

function isVideoLabelsEnabled() {
  // If user has enabled video labels setting, where "Favorites" becomes "Watch Later", and "My Labels" becomes "Playlists".
  return document.getElementById('yl_video_labels')?.getAttribute('data-yl-video-labels') === 'true';
}

function isMiniplayerAutoplayEnabled() {
  // Whether restoring miniplayer should auto-play.
  return document.getElementById('yl_miniplayer_autoplay_enabled')?.getAttribute('data-yl-miniplayer-autoplay-enabled') === 'true';
}

function isArticleSplitViewEnabled() {
  // Whether article uses split pane view.
  return (getAttrValue('data-yl-article-split-view-enabled') === 'true');
}

function isArticleSplitViewActive() {
  // When split view is enabled and the current view is eligible to display split view (i.e. desktop viewport size).
  // Check if `#ylArticleSplitPane` is currently display: none
  const paneElement = document.getElementById(app.modal?.id?.splitPaneContent);
  return paneElement && window.getComputedStyle(paneElement).display === 'block';
}

function isMarkReadOnScrollEnabled() {
  // Native FreshRSS setting: "Mark an article as read… while scrolling (except for important feeds)"
  return context.auto_mark_scroll;
}

function isArticleNavEnabled() {
  // Native FreshRSS setting: "Show the navigation buttons"
  return document.querySelector(app.frss.el.articleNav);
}

function isHideDescriptionIntroEnabled() {
  // Hides first intro of YouTube video descriptions, which often contains sponsored content above the fold.
  return document.getElementById('yl_description_hide_intro_enabled')?.getAttribute('data-yl-description-hide-intro-enabled') === 'true';
}

function isUpdateCheckEnabled() {
  return document.getElementById('yl_update_check_enabled')?.getAttribute('data-yl-update-check-enabled') === 'true';
}

function getToolbarStickyState() {
  return app.state.page.toolbarSticky;
}

function setToolbarStickyState(state) {
  app.state.page.toolbarSticky = state;
}

function getRelativeDate(date) {
  // Convert e.g. `2025-12-26T20:31:19+01:00` to a relative date string like "2 days ago".
  // NOTE: FreshRSS provides attr `datetime` in the DOM.

  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 }
  ];
  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
    }
  }
  return 'Just now';
}

function formatTime(seconds) {
  // Format seconds into HH:MM:SS or MM:SS.
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  else {
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

function shouldCustomThumbnailTitle() {
  const setting = document.querySelector('#yl_custom_thumbnail_title_enabled');
  if (!setting) return false;
  const shouldUseScreencapThumbnail = setting.getAttribute('data-yl-custom-thumbnail-title-enabled');
  return shouldUseScreencapThumbnail === 'true';
}

/*****************************************
 * END "STATE UTILITIES"
 ****************************************/



/*****************************************
 * BEGIN "DATA UTILITIES"
 * For fetching and parsing remote or dynamic content.
 ****************************************/

async function fetchRelatedItems(category = 'watch_later', order = 'rand', limit = 10) {
  // Fetch related entries to show up e.g. in the Youlag "Related/random videos" section in the video modal.

  /**
   * HACK: This fetches the entire feed page, parses the HTML, and manually structures it into a JSON object.
   * This is a workaround due to having issues setting up a custom extension api endpoint.
   * By default, only 10 items are returned.
   */

  limit = Math.min(Math.max(limit, 1), 10);

  const getParamMap = {
    'subscriptions': '', // Home
    'watch_later': 'get=s',
    'playlists': 'get=T',
  };

  let getParam = getParamMap[category] || '';
  if (typeof category === 'string' && category.startsWith('f_')) {
    getParam = `get=${category}`;
  }

  try {
    const response = await fetch(`${app.frss.urlPrefix}/i/?a=normal&${getParam}&sort=${order}`);
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const stream = doc.querySelector(`${app.frss.el.feedRoot}`);

    if (!stream) {
      console.warn('Fetching related entries: #stream not found');
      return;
    }

    const items = Array.from(stream.querySelectorAll(app.frss.el.entry)).slice(0, limit);
    const mapped = items.map((item) => {
      const entryId = item.getAttribute('data-entry') || '';
      return {
        ...app.types.videoObject, // Sets default values for the other non-assigned properties in videoObject
        feedItem: item, // Original DOM element reference, utilized later by `extractFeedItemData()` when clicked.

        // The minimal data is used for displaying related videos.
        entryId,
        website_name: item.querySelector('.website .websiteName')?.textContent?.trim() || '',
        thumbnail: item.querySelector('.thumbnail img')?.src || '',
        title: item.querySelector('.title')?.textContent?.trim() || '',
        date: item.querySelector('.titleAuthorSummaryDate .date time')?.getAttribute('datetime') || '',
        external_link: item.querySelector('.titleAuthorSummaryDate a')?.href || '',
      };
    });
    const uniqueEntryIds = new Set();
    const videoObjects = mapped.filter(entry => {
      // Remove potential duplicates when using 'rand' order, and the feed has limited amount of entries.
      if (!entry.entryId || uniqueEntryIds.has(entry.entryId)) return false;
      uniqueEntryIds.add(entry.entryId);
      return true;
    });
    return videoObjects;
  } catch (e) {
    console.error('Youlag: Error fetching related entries:', e);
  }
}

async function checkForUpdates() {
  // Check for updates every 2 weeks
  // NOTE: This communicates with Github (Microsoft). You can disable the update check in Youlag's settings page.
  
  const now = Date.now();
  const lastChecked = localStorage.getItem('ylLastUpdateCheck');
  // Only check for updates if 2 weeks have passed
  if (!lastChecked || (now - parseInt(lastChecked, 10)) > 14 * 24 * 60 * 60 * 1000) {
    const apiUrl = 'https://api.github.com/repos/civilblur/youlag/releases/latest';
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      const data = await response.json();
      const latestVersion = data.tag_name.startsWith('v') ? data.tag_name.substring(1) : data.tag_name;
      const currentVersion = app.metadata.version;

      if (latestVersion !== currentVersion) {
        showNotification({
          title: 'New Youlag update available', 
          message: `Version &nbsp;<span class="yl-badge">${latestVersion}</span>&nbsp; has been released. Head to the release page for more details.`, 
          action: 'View update', 
          link: data.html_url,
          dismissRef: 'ylLastUpdateCheck'
        });

        return {
          updateAvailable: true,
          latestVersion,
          releaseUrl: data.html_url,
        };
      }
      return { updateAvailable: false };
    }
    catch (e) {
      return { updateAvailable: false };
    }
  }
  // If not time to check, do nothing
  return { updateAvailable: false };
}

/*****************************************
 * END "DATA UTILITIES"
 ****************************************/
