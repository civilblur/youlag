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
    console.error('Error fetching tags:', error);
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
          console.error('Error parsing tag update response:', jsonError);
        }
      }
    }
    else {
      console.error('Failed to update tag:', response.status);
    }
  }
  catch (error) {
    console.error('Error updating tag:', error);
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
  const isVideoFeedItem = extractedVideoUrl !== '';
  const videoDescriptionExists = feedItem.querySelector('.enclosure-description') !== null;
  const videoBaseUrl = isVideoFeedItem ? getBaseUrl(extractedVideoUrl) : '';
  app.state.modal.youtubeId = extractedVideoUrl ? getVideoIdFromUrl(extractedVideoUrl) : '';
  const youtubeUrl = app.state.modal.youtubeId ? `https://www.youtube.com/watch?v=${app.state.modal.youtubeId}` : '';
  const youtubeEmbedUrl = app.state.modal.youtubeId ? `https://www.youtube.com/embed/${app.state.modal.youtubeId}` : '';
  const videoEmbedUrl = app.state.modal.youtubeId ? `${videoBaseUrl}/embed/${app.state.modal.youtubeId}` : '';
  const authorElement = feedItem.querySelector('.flux_header');
  const authorFilterElement = authorElement?.querySelector('.website a.item-element[href*="get=f_"]');
  const invidiousInstanceElemenet = feedItem.querySelector('.content div.text span[data-yl-invidious-instance]');
  const invidiousInstance1 = invidiousInstanceElemenet ? invidiousInstanceElemenet.getAttribute('data-yl-invidious-instance') : '';
  const videoSourceDefaultElement = feedItem.querySelector('.content div.text span[data-yl-video-source-default]');
  const videoSourceDefault = videoSourceDefaultElement ? videoSourceDefaultElement.getAttribute('data-yl-video-source-default') : '';

  const invidiousRedirectPrefixUrl = 'https://redirect.invidious.io/watch?v=';

  // If video description is found, use it, otherwise fallback to generic description element.
  let video_description = isVideoFeedItem && videoDescriptionExists ?
    appendUrl(feedItem.querySelector('.enclosure-description')?.innerHTML.trim()) :
    feedItem.querySelector('article div.text')?.innerHTML.trim() ||
    '';
  video_description = appendOriginalSrc(video_description);
  

  const videoObject = {
    entryId: entryId ? entryId[1] : null,
    authorId: authorId ? authorId[1] : null,
    author: authorElement?.getAttribute('data-article-authors') || '',
    author_filter_url: authorFilterElement?.href || '',
    favicon: feedItem.querySelector('img.favicon')?.src || '',
    website_name: feedItem.querySelector('.website .websiteName')?.textContent.trim() || '',
    favorite_toggle_url: feedItem.querySelector('a.item-element.bookmark')?.href || '',
    favorited: !feedItem.querySelector('.bookmark img[src*="non-starred"]'),
    thumbnail: feedItem.querySelector('.thumbnail img')?.src || '',
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
    video_youtube_url: youtubeUrl,
    video_invidious_redirect_url: `${app.state.modal.youtubeId ? invidiousRedirectPrefixUrl + app.state.modal.youtubeId : ''}`
  };

  return videoObject;
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

  // If 'all' is included, it means every page and category will use the video mode.
  if (whitelist.includes('all')) return true;

  // Check if parent pages are whitelisted.
  const pageTypes = ['home', 'important', 'watch_later', 'playlists', 'search_results'];
  for (const pt of pageTypes) {
    if (currentPageClass === `yl-page-${pt}` && whitelist.includes(pt)) {
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
