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
    youtubeExtensionInstalled = extractedVideoUrl ? true : false;
  }
  const isVideoFeedItem = extractedVideoUrl !== '';
  const videoDescriptionExists = feedItem.querySelector('.enclosure-description') !== null;
  const videoBaseUrl = isVideoFeedItem ? getBaseUrl(extractedVideoUrl) : '';
  youtubeId = extractedVideoUrl ? getVideoIdFromUrl(extractedVideoUrl) : '';
  const youtubeUrl = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : '';
  const youtubeEmbedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : '';
  const videoEmbedUrl = youtubeId ? `${videoBaseUrl}/embed/${youtubeId}` : '';
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
    youtubeId: youtubeId,
    youtube_embed_url: youtubeEmbedUrl,
    video_embed_url: videoEmbedUrl,
    video_invidious_instance_1: invidiousInstance1 || '',
    video_source_default: videoSourceDefault || 'youtube',
    video_description:
      `<div class="youlag-video-description-content">
        ${video_description}
      </div>`,
    video_youtube_url: youtubeUrl,
    video_invidious_redirect_url: `${youtubeId ? invidiousRedirectPrefixUrl + youtubeId : ''}`
  };

  return videoObject;
}
