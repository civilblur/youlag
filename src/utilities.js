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
 * - Modal utilities
 * - Link utilities
 * - State utilities
 * - Data utilities
 *
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
  if (mode === 'miniplayer') {
    const mode = app.state.modal.mode = 'miniplayer';
    return mode;
  }
  else if (mode === 'fullscreen') {
    const mode = app.state.modal.mode = 'fullscreen';
    return mode;
  }
}

function getModalState() {
  return app.state.modal.active; // true = modal is active
}

function setModalState(boolean) {
  app.state.modal.active = boolean; // true = modal is active
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
  // TODO: refactor hardcoded classList.contains
  isWatchLaterSortModified = document.body.classList.contains('youlag-sort-watch_later--user-modified');

  if (!isWatchLaterSortModified) return;

  if (isWatchLaterSortModified) {
    updateAnchorLink(
      '/i/?a=normal&get=s&sort=lastUserModified&order=DESC', 
      document.querySelector('#aside_feed #sidebar .category.favorites > a')
    );
  }
}

function getVideoIdFromUrl(url) {
  // Match video ID without relying on base domain being "youtube"-specific, in order to support invidious and piped links.
  const regex = /(?:\/|^)(?:shorts\/|v\/|e(?:mbed)?\/|\S*?[?&]v=|\S*?[?&]id=|v=)([a-zA-Z0-9_-]{11})(?:[\/\?]|$)/;
  const match = url.match(regex);
  return match ? match[1] : '';
}

function getBaseUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.protocol}//${parsedUrl.host}`;
  } catch (error) {
    console.error('Invalid URL:', error);
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

/*****************************************
 * END "LINK UTILITIES"
 ****************************************/



/*****************************************
 * BEGIN "STATE UTILITIES"
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

function getRelatedVideosSetting() {
  return document.querySelector('#yl_related_videos_source')?.getAttribute('data-yl-related-videos-source') || 'none';
}

function pushHistoryState(key, value = true) {
  // Pushes a new state to the history for modal close/back navigation.
  if (isModeFullscreen() && !app.state.popstate.added) {
    const state = {};
    state[key] = value;
    history.pushState(state, '', '');
    app.state.popstate.added = true;
  }
}

function resetHistoryState() {
  // Fully resets the browser history state to null for the current URL.
  history.replaceState(null, '', location.href);
}

function getCurrentPage(withPrefix = true) {
  // Returns the current page name, optionally with the 'yl-page-' prefix.    
  // E.g. 'yl-page-home', 'yl-page-important', 'yl-page-category', etc. or just 'home', 'important', ...  
  const path = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const classPrefix = 'yl-page-';
  let pageName = '';

  function prefixClasses(classString) {
    return classString.split(' ').map(cls => classPrefix + cls).join(' ');
  }

  const routes = [
    {
      path: '/i/',
      match: () => urlParams.get('a') === 'normal' && urlParams.has('search'),
      className: 'search_results',
    },
    {
      path: '/i/',
      // Home page: no get or c param
      match: () => !urlParams.has('get') && !urlParams.has('c'),
      className: 'home',
    },
    {
      path: '/i/',
      match: () => urlParams.get('c') === 'extension',
      className: 'extension',
    },
    {
      path: '/i/',
      match: () => urlParams.get('get') === 'i',
      className: 'important',
    },
    {
      path: '/i/',
      match: () => urlParams.get('get') === 's',
      className: 'watch_later',
    },
    {
      path: '/i/',
      match: () => urlParams.get('get') === 'T',
      className: 'playlists',
    },
    {
      path: '/i/',
      match: () => /^t_\d+$/.test(urlParams.get('get') || ''),
      className: () => {
        const n = (urlParams.get('get') || '').substring(2);
        return `playlists t_${n}`;
      },
    },
    {
      path: '/i/',
      // Category page: get param starts with c_
      match: () => urlParams.get('get') && urlParams.get('get').startsWith('c_'),
      className: () => {
        const n = urlParams.get('get').substring(2);
        return `category c_${n}`;
      },
    },
    {
      path: '/i/',
      match: () => (urlParams.get('get') && urlParams.get('get').startsWith('f_')),
      className: () => {
        const n = urlParams.get('get').substring(2);
        return `category`;
      },
    },
  ];

  for (const route of routes) {
    if (path === route.path && route.match()) {
      const classString = typeof route.className === 'function' ? route.className() : route.className;
      return withPrefix ? prefixClasses(classString) : classString;
    }
  }

  return pageName;
}

function isFeedPage() {
  // Determine if the current page is a feed page, and not e.g. settings or extensions page.
  const feedPageClasses = [
    'yl-page-home',
    'yl-page-important',
    'yl-page-watch_later',
    'yl-page-playlists',
    'yl-page-category',
    'yl-page-search_results',
  ];
  // Check body if classes exist
  const isFeedPage = feedPageClasses.some(feedPage => document.body.classList.contains(feedPage));
  return isFeedPage;
}

function isVideoLabelsEnabled() {
  // If user has enabled video labels setting, where "Favorites" becomes "Watch Later", and "My Labels" becomes "Playlists".
  return document.body.classList.contains('youlag-video-labels');
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
    const response = await fetch(`/i/?a=normal&${getParam}&sort=${order}`);
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
    console.error('Fetching related entries error:', e);
  }
}

/*****************************************
 * END "DATA UTILITIES"
 ****************************************/
