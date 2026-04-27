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
    const response = await fetch(url, { method: 'GET' });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  }
  catch (error) {
    console.error('Youlag: Error fetching tags:', error);
  }
  return [];
}

async function setItemTag(entryId, tag) {
  // Add or remove a feed item from a tag (playlists).

  const csrfToken = document.querySelector('input[name="_csrf"]')?.getAttribute('value') || '';
  const payload = {
    _csrf: csrfToken,
    id_tag: tag.id,
    name_tag: '',
    id_entry: entryId,
    checked: !!tag.checked,
    ajax: 1
  };
  try {
    const response = await fetch('./?c=tag&a=tagEntry&ajax=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      const text = await response.text();
      if (text && text.trim().length > 0) {
        try {
          const result = JSON.parse(text);
        }
        catch (jsonError) {
          console.error('Youlag: Error parsing tag update response:', jsonError);
        }
      }
    }
    else {
      console.error('Youlag: Failed to update tag:', response.status);
    }
  }
  catch (error) {
    console.error('Youlag: Error updating tag:', error);
  }
}

function extractFeedItemData(feedItem) {
  // Extract data from the provided target element.

  const entryId = feedItem.getAttribute('data-entry')?.match(/([0-9]+)$/);
  const authorId = feedItem.querySelector('.item.website a.item-element[href*="get=f_"]')?.getAttribute('href')?.match(/get=f_([0-9]+)/);
  let extractedVideoUrl = feedItem.querySelector('.item.titleAuthorSummaryDate a[href*="youtube"], .item.titleAuthorSummaryDate a[href*="/watch?v="]')?.href || '';
  if (!extractedVideoUrl) {
    // Fallback to see if user has installed the YouTube video feed/Invidious video feed extension, as they create a different DOM structure.
    extractedVideoUrl = feedItem.querySelector('.enclosure-content a[href*="youtube"], .enclosure-content a[href*="/watch?v="]');
    extractedVideoUrl = sanitizeExtractedVideoUrl(extractedVideoUrl);
  }

  const videoId = getVideoIdFromUrl(extractedVideoUrl);
  const isVideoFeedItem = videoId ? true : false;
  app.state.modal.youtubeId = videoId;
  const videoDescriptionExists = feedItem.querySelector('.enclosure-description') !== null;
  const videoDescription = videoDescriptionExists ? feedItem.querySelector('.enclosure-description')?.innerHTML.trim() : '';
  const videoBaseUrl = isVideoFeedItem ? getBaseUrl(extractedVideoUrl) : '';
  const youtubeUrl = app.state.modal.youtubeId ? `https://www.youtube.com/watch?v=${app.state.modal.youtubeId}` : '';
  const youtubeEmbedUrl = app.state.modal.youtubeId ? `https://www.youtube.com/embed/${app.state.modal.youtubeId}?enablejsapi=1` : '';
  const videoEmbedUrl = app.state.modal.youtubeId ? `${videoBaseUrl}/embed/${app.state.modal.youtubeId}` : '';
  const authorElement = feedItem.querySelector('.flux_header');
  const authorFilterElement = authorElement?.querySelector('.website a.item-element[href*="get=f_"]');
  const invidiousInstanceElemenet = feedItem.querySelector('.content div.text span[data-yl-invidious-instance]');
  const invidiousInstance1 = invidiousInstanceElemenet ? invidiousInstanceElemenet.getAttribute('data-yl-invidious-instance') : '';
  const videoSourceDefaultElement = feedItem.querySelector('.content div.text span[data-yl-is-video-default]');
  const videoSourceDefault = videoSourceDefaultElement ? videoSourceDefaultElement.getAttribute('data-yl-is-video-default') : '';

  const invidiousRedirectPrefixUrl = 'https://redirect.invidious.io/watch?v=';

  // Get video chapters
  let videoChapters = extractVideoDescriptionChapters(videoDescription);

  // If video description is found, use it, otherwise fallback to generic description element.
  let video_description = isVideoFeedItem && videoDescriptionExists ?
    appendUrl(videoDescription) : 
    feedItem.querySelector('article div.text')?.innerHTML.trim() || '';
  video_description = appendOriginalSrc(video_description);

  // Wrap video description intro in divs to setup for the setting "Hide description intro containing links". 
  if (isVideoFeedItem && videoDescriptionExists) {
    video_description = wrapVideoDescription(video_description);

    if (isHideDescriptionIntroEnabled()) {
      video_description = hideVideoDescriptionIntro(video_description);
    }
  }

  // Video thumbnail, and fallback for article thumbnail
  let thumbnail = feedItem.querySelector('.thumbnail img')?.src || ''; // Default thumbnail rendered in DOM
  let thumbnail_video = '';
  let thumbnail_video_screencap = '';
  if (isVideoFeedItem) {
    thumbnail_video = `https://img.youtube.com/vi/${app.state.modal.youtubeId}/sddefault.jpg`;
    thumbnail_video_screencap = getDearrowScreencap(app.state.modal.youtubeId);
  }

  // Article in video mode: Hide first image if it's the same as the thumbnail/top image.
  if (!isVideoFeedItem && thumbnail && video_description) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = video_description;
    const firstImageContainer = tempDiv.querySelector('figure') || tempDiv.querySelector('img');
    if (firstImageContainer) {
      const img = firstImageContainer.querySelector('img') || firstImageContainer;
      if (img.src === thumbnail) {
        firstImageContainer.classList.add('display-none');
        video_description = tempDiv.innerHTML;
      }
    }
  }

  const videoObject = {
    entryId: entryId ? entryId[1] : null,
    authorId: authorId ? authorId[1] : null,
    author: authorElement?.getAttribute('data-article-authors') || '',
    author_filter_url: authorFilterElement?.href || '',
    favicon: feedItem.querySelector('img.favicon')?.src || '',
    website_name: feedItem.querySelector('.website .websiteName')?.textContent.trim() || '',
    favorite_toggle_url: feedItem.querySelector('a.item-element.bookmark')?.href || '',
    favorited: !feedItem.querySelector('.bookmark img[src*="non-starred"]'),
    thumbnail,
    thumbnail_video: thumbnail_video || '',
    thumbnail_video_screencap: thumbnail_video_screencap || '',
    title: feedItem.querySelector('.item-element.title')?.childNodes[0].textContent.trim() || '',
    external_link: feedItem.querySelector('.item-element.title')?.href || '',
    date: feedItem.querySelector('.flux_content .date')?.textContent.trim() || '',
    isVideoFeedItem: isVideoFeedItem,
    youtubeId: app.state.modal.youtubeId,
    youtube_embed_url: youtubeEmbedUrl,
    video_embed_url: videoEmbedUrl,
    video_invidious_instance_1: invidiousInstance1 || '',
    video_source_default: videoSourceDefault || 'youtube',
    video_description:
      `<div class="youlag-video-description-content">
        ${video_description}
      </div>`,
    video_chapters: videoChapters || null,
    video_youtube_url: youtubeUrl,
    video_invidious_redirect_url: `${app.state.modal.youtubeId ? invidiousRedirectPrefixUrl + app.state.modal.youtubeId : ''}`
  };

  return videoObject;
}

function extractVideoDescriptionChapters(videoDescription) {
  // Parse video description timestamps based on YouTube's rules.
  
  if (!videoDescription || typeof videoDescription !== 'string') return [];

  // Sanitize and split on <br>, <br/>, <br />, and newlines.
  let lines = videoDescription
    .replace(/<br\s*\/?>(?:\s*)?/gi, '\n')
    .split(/\n/)
    .map(line => line.replace(/<[^>]+>/g, '').trim());

  let order = 1;
  let lastSeconds = -1;
  let foundTimestamps = [];

  for (let cleanLine of lines) {
    if (!cleanLine) continue;
    // Match HH:MM:SS or MM:SS at the start of the line.
    let match = cleanLine.match(/^\[?(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})\]?\s*(.+)?$/);
    if (match) {
      let ts = match[1];
      let label = (match[2] || '').trim();
      // Remove leading ' - ' if present, as many creators tend to format it this way.
      if (label.startsWith('- ')) {
        label = label.slice(2).trim();
      }
      // If chapter label is all caps, convert to sentence case to remove alarmist behavior.
      if (typeof isTextAllCaps === 'function' && typeof formatTextToSentenceCase === 'function') {
        if (isTextAllCaps(label)) {
          label = formatTextToSentenceCase(label);
        }
      }
      // Pad timestamp to always have two digits for hours, minutes, and seconds.
      let parts = ts.split(':').map(Number);
      let paddedTs = '';
      if (parts.length === 3) {
        paddedTs = `${parts[0].toString().padStart(2, '0')}:${parts[1].toString().padStart(2, '0')}:${parts[2].toString().padStart(2, '0')}`;
      }
      else if (parts.length === 2) {
        paddedTs = `${parts[0].toString().padStart(2, '0')}:${parts[1].toString().padStart(2, '0')}`;
      }
      else {
        // Invalid format
        continue;
      }
      // Convert timestamp to seconds
      let seconds = 0;
      if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
      }
      // Ensures chronological order of chapters.
      if (seconds <= lastSeconds) continue;
      lastSeconds = seconds;
      foundTimestamps.push({
        timestamp: paddedTs,
        seconds: seconds,
        label: label,
        order: order++
      });
    }
  }

  // Accept 0:00, 00:00, 0:00:00, or 00:00:00 as valid first chapters.
  if (
    foundTimestamps.length >= 3 &&
    (/^0{1,2}:0{2}(?::0{2})?$/.test(foundTimestamps[0].timestamp))
  ) {
    return foundTimestamps;
  }
  return [];
}

async function getDearrowData(youtubeId) {
  if (!youtubeId) return null;
  // Check if data is cached in indexdb before making API call.
  let cached = null;
  try {
    cached = await dbGet('dearrow', youtubeId);
    if (cached) {
      // If youlag-cache-dearrow has no duration, check the persistent (1y TTL) youlag-cache-duration store.
      // The youlag-cache-duration picks video duration from the YouTube iframe API when the video plays. 
      if (!cached.videoDuration) {
        cached.videoDuration = await dbGet('duration', youtubeId).catch(() => null) || null;
      }
      return cached;
    }
  } 
  catch (e) {
  }

  const apiUrl = `https://sponsor.ajay.app/api/branding?videoID=${encodeURIComponent(youtubeId)}`;
  let randomTime = null;
  let videoDuration = null;
  let thumbnails = [];
  let titles = [];
  try {
    const response = await fetch(apiUrl);
    if (response.ok) {
      const data = await response.json();
      randomTime = data.randomTime;
      videoDuration = data.videoDuration;
      if (Array.isArray(data.thumbnails)) {
        thumbnails = data.thumbnails;
      }
      if (Array.isArray(data.titles)) {
        titles = data.titles;
      }
    }
  } catch (e) {
  }

  // Dearrow has no duration — check the persistent duration store (may have been set by the YouTube iframe API).
  if (!videoDuration) {
    videoDuration = await dbGet('duration', youtubeId).catch(() => null) || null;
  }

  // Ignore Dearrow thumbnail data and rely on `getVideoScreencapWithFallback()`.
  const thumbnailWithFallback = await getVideoScreencapWithFallback(youtubeId);
  thumbnails = [{
    timestamp: null,
    original: true,
    votes: 0,
    locked: false,
    UUID: '',
    userID: '',
    url: thumbnailWithFallback
  }];
  const resultObj = {
    thumbnails,
    titles,
    randomTime,
    videoDuration
  };
  try {
    await dbSet('dearrow', youtubeId, resultObj);
    // Also persist duration separately so it survives dearrow cache expiry.
    if (videoDuration) await dbSet('duration', youtubeId, videoDuration, 52);
  } catch (e) {
  }

  return resultObj;
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
    return 'T';
  }
  if (/^f_\d+$/.test(getParam)) {
    // Filter page, a subpage of a category.
    const activeElem = document.querySelector('#sidebar .tree-folder.category.active');
    if (activeElem && activeElem.id) {
      return activeElem.id; // e.g. 'c_{n}'
    }
    return null;
  }
  return null;
}

function getCategoryWhitelist() {
  // Retrieve the category whitelist.
  // `setCategoryWhitelist()` in `extension.php` outputs the user data to the DOM.

  const el = document.querySelector('#yl_category_whitelist');
  if (!el) return [];

  const data = el.getAttribute('data-yl-category-whitelist');
  if (!data) return ['all'];
  const whitelist = data.split(',').map(s => s.trim()).filter(Boolean);

  try {
    localStorage.setItem('youlagCategoryWhitelist', JSON.stringify(whitelist));
  } catch (e) { }

  return whitelist;
}

function isPageWhitelisted(whitelist, currentPageClass) {
  // Check if the current page/category is whitelisted.
  // Whitelisted pages/categories will use the video mode.

  if (!Array.isArray(whitelist) || !currentPageClass) return false;

  // Auto-detect: If current page is a video feed, automatically return true.
  const el = document.querySelector('#yl_category_whitelist');
  if (el && el.getAttribute('data-yl-is-video-feed') === 'true') {
    return true;
  }

  // If 'all' is included, it means every page and category will use the video mode.
  if (whitelist.includes('all')) return true;

  // Check if parent pages are whitelisted.
  const pageTypes = ['home', 'important', 'watch_later', 'playlists', 'search_results'];
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
  if (currentPageClass.startsWith('yl-page-category')) {
    const match = currentPageClass.match(/c_(\d+)/);
    if (match && whitelist.includes('c_' + match[1])) {
      return true;
    }
  }


  // Check if subpage parent category is whitelisted.
  const urlParams = new URLSearchParams(window.location.search);
  const getParam = urlParams.get('get');
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

  const el = document.querySelector('#yl_base_url');
  if (!el) return '';

  const data = el.getAttribute('data-yl-base-url');
  if (!data || data === '') return '';

  const pathname = new URL(data).pathname;
  return pathname.replace(/\/+$/, '');
}

function setFreshRssUrlPrefix() {
  let prefix = getFreshRssUrlPrefix();
  prefix ? app.frss.urlPrefix = prefix : app.frss.urlPrefix = '';
}

function isVideoLabelsEnabled() {
  // Check if video platform label setting is enabled.
  // TODO: Refactor this once `Minz_HookType::JsVars` is implemented.
  return document.body.classList.contains('youlag-video-labels');
}