let youlagScriptLoaded = false;
let youlagNavMenuInitialized = false;
let youlagRestoreVideoQueueRan = false;
let youlagActive = true; // Whether Youlag is active on this page based on user category whitelist setting.
let youtubeExtensionInstalled = false; // Parse content differently in case user has the FreshRSS "YouTube Video Feed" extension enabled.
let youtubeId;
let previousPageTitle = null;
let modePip = false;
let modeFullscreen = true;
const modalVideoContainerClassName = `youlag-theater-modal-container`;
const modalVideoContentClassName = `youlag-theater-modal-content`;
const modalCloseIdName = `youlagCloseModal`;
const modalMinimizeIdName = `youlagMinimizeModal`;
const modalVideoSourceIdName = `youlagVideoSource`;
const modalVideoSourceDefaultIdName = `youlagVideoSourceDefault`;
const modalToggleFavoriteIdName = `youlagToggleFavorite`;
const modalFavoriteClassName = `youlag-favorited`;
const modalTagsManageIdName = `youlagTagsManage`;
const modalTagsContainerIdName = `youlagTagsModal`;


/*****************************************
 * BEGIN: "YOULAG EXTENSION SETTINGS PAGE"
 * Functions used in the settings page.
 ****************************************/

function youlagSettingsPageEventListeners() {

  // Set "required" to Invidious URL input field if it's selected.
  const invidiousRadio = document.getElementById('yl_playback_invidious');
  const youtubeRadio = document.getElementById('yl_playback_youtube');
  const invidiousInput = document.getElementById('yl_invidious_url_1');
  if (invidiousRadio && youtubeRadio && invidiousInput) {
    function updateRequired() {
      if (invidiousRadio.checked) {
        invidiousInput.setAttribute('required', 'required');
      } else {
        invidiousInput.removeAttribute('required');
      }
    }
    invidiousRadio.addEventListener('change', updateRequired);
    youtubeRadio.addEventListener('change', updateRequired);
    updateRequired();
  }
}

/*****************************************
 * END "YOULAG EXTENSION SETTINGS PAGE"
 ****************************************/


function handleActiveRssItem(targetOrEventOrVideo, isVideoObject = false) {
  // Handles both DOM event/element and direct video object
  let data;

  if (isVideoObject) {
    // Use only the data from localStorage, do not rely on DOM
    const videoObject = targetOrEventOrVideo;
    const activeVideo = videoObject.queue[videoObject.activeIndex];
    data = {
      ...activeVideo,
      queue: videoObject.queue,
      activeIndex: videoObject.activeIndex
      // No feedItemEl, as DOM may not exist
    };
  } else {
    // Extract the feed item from the DOM event/element
    const feedItem = (targetOrEventOrVideo instanceof Event)
      ? targetOrEventOrVideo.target.closest('div[data-feed]')
      : targetOrEventOrVideo.closest('div[data-feed]');
    if (!feedItem) return;

    data = extractFeedItemData(feedItem);
    data.feedItemEl = feedItem;
  }

  createVideoModal(data);
  if (!modePip) setModeFullscreen(true);
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
  const urlPattern = /https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+[\w\-_/~#@?=&%]/g;
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(urlPattern);
  return matches ? matches : [];
}

function appendUrl(text) {
  console.log('appendUrl input:', text);
  const urls = matchURL(text);
  if (urls) {
    urls.forEach(url => {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.textContent = url;
      anchor.target = '_blank';
      text = text.replace(url, anchor.outerHTML);
    });
  }
  return text;
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


function extractFeedItemData(feedItem) {
  // Extract data from the provided target element.
  const entryId = feedItem.getAttribute('data-entry')?.match(/([0-9]+)$/);
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

  const videoObject = {
    entryId: entryId ? entryId[1] : null,
    author: authorElement?.getAttribute('data-article-authors') || '',
    author_filter_url: authorFilterElement?.href || '',
    favicon: feedItem.querySelector('img.favicon')?.src || '',
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
      // If video description is found, use it, otherwise fallback to generic description element.
      `<div class="youlag-video-description-content">
        ${isVideoFeedItem && videoDescriptionExists ? appendUrl(feedItem.querySelector('.enclosure-description')?.innerHTML.trim()) :
        feedItem.querySelector('article div.text')?.innerHTML.trim() || ''
      }
      </div>`,
    video_youtube_url: youtubeUrl,
    video_invidious_redirect_url: `${youtubeId ? invidiousRedirectPrefixUrl + youtubeId : ''}`
  };

  setVideoQueue(videoObject);

  return videoObject;
}

function setVideoQueue(videoObject) {
  // Store the videoObject in localStorage.youlagVideoQueue.
  // The video object is defined in `extractFeedItemData()`.

  let queue = [];
  let activeIndex = 0;
  try {
    const stored = localStorage.getItem('youlagVideoQueue');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.queue)) queue = parsed.queue;
      if (typeof parsed.activeIndex === 'number') activeIndex = parsed.activeIndex;
    }
  } catch (e) { }

  const videoId = videoObject.video_youtube_url; // video_youtube_url as unique identifier
  const foundIndex = queue.findIndex(v => v.video_youtube_url === videoId);
  const isPipMode = document.body.classList.contains('youlag-mode--pip');
  if (foundIndex === -1) {
    queue.push(videoObject);
    activeIndex = queue.length - 1;
  } else {
    activeIndex = foundIndex;
  }

  localStorage.setItem('youlagVideoQueue', JSON.stringify({ queue, activeIndex, isPipMode }));
}

function clearVideoQueue() {
  localStorage.removeItem('youlagVideoQueue');
}

function restoreVideoQueue() {
  // Restore video queue from localStorage on page load, only if pip mode was active.
  if (youlagRestoreVideoQueueRan) return;
  youlagRestoreVideoQueueRan = true;

  const stored = localStorage.getItem('youlagVideoQueue');
  let queueObj = null;
  if (stored) {
    try {
      queueObj = JSON.parse(stored);
    }
    catch (e) {
      console.error('Error parsing youlagVideoQueue from localStorage:', e);
    }
  }
  if (!queueObj || queueObj.isPipMode !== true) return;

  // Only restore video queue on pages that don't get blocked by Content-Security-Policy. 
  const bodyClasses = document.body.classList;
  const isVideoPage = [
    'yl-page-home',
    'yl-page-important',
    'yl-page-watch_later',
    'yl-page-playlists',
    'yl-page-category'
  ].some(cls => bodyClasses.contains(cls));
  if (!isVideoPage) return;

  if (queueObj && Array.isArray(queueObj.queue) && typeof queueObj.activeIndex === 'number' && queueObj.queue.length > 0) {
    setModePip(true); // Restored video queue always opens in PiP mode.
    handleActiveRssItem(queueObj, true);
  }
}

function setPageTitle(title) {
  if (typeof title === 'string' && title.length > 0) {
    if (previousPageTitle === null) {
      previousPageTitle = document.title;
    }
    // Set new title
    document.title = title;
  }
  else if (previousPageTitle !== null) {
    // Restore previous title
    document.title = previousPageTitle;
    previousPageTitle = null;
  }
}

function createVideoModal(data) {
  // Create custom modal
  let modal = document.getElementById('youlagTheaterModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'youlagTheaterModal';
    modal.innerHTML = `<div class="${modalVideoContainerClassName}"></div>`;
    document.body.appendChild(modal);
  }

  // Add content to modal
  const container = modal.querySelector(`.${modalVideoContainerClassName}`);
  const videoSourceDefault = data.video_source_default;
  const youtubeSelected = videoSourceDefault === 'youtube' ? 'selected' : '';
  const invidiousSelected = videoSourceDefault === 'invidious_1' ? 'selected' : '';
  const invidiousBaseUrl = data.video_invidious_instance_1;

  function getEmbedUrl(source) {
    // Helper to get the correct embed URL for a given source
    if (source === 'invidious_1' && data.video_invidious_instance_1 && data.youtubeId) {
      return `${data.video_invidious_instance_1.replace(/\/$/, '')}/embed/${data.youtubeId}`;
    } else if (source === 'youtube') {
      return data.youtube_embed_url;
    }
    return '';
  }

  // Determine the initial video source (default)
  const videoSourceDefaultNormalized = videoSourceDefault === 'invidious_1' ? 'invidious_1' : 'youtube';
  const defaultEmbedUrl = getEmbedUrl(videoSourceDefaultNormalized);

  setPageTitle(data.title);

  container.innerHTML = `
    <div class="${modalVideoContentClassName}">

      <div class="youlag-video-header">
        <select id="${modalVideoSourceIdName}" class="${invidiousBaseUrl && data.isVideoFeedItem ? '' : 'display-none'}">
          <option value="youtube" ${youtubeSelected}>YouTube</option>
          <option value="invidious_1" ${invidiousSelected}>Invidious</option>
        </select>

        <button id="${modalMinimizeIdName}">⧉</button>
        <button id="${modalCloseIdName}">×</button>
      </div>

      <div class="youlag-video-container">
        <div class="youlag-thumbnail-container">
          <img src="${data.thumbnail}" class="youlag-video-thumbnail" />
        </div>
        <div class="youlag-iframe-container">
          <iframe class="youlag-iframe"
                  src="${defaultEmbedUrl}" frameborder="0" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        </div>
      </div>


      <div class="youlag-video-details">

        <div class="youlag-video-metadata-container">
          <h2 class="youlag-video-metadata-title">${data.title}</h2>
          <div class="youlag-video-metadata-panel">

            <section class="youlag-video-author-section">
              <a class="youlag-video-metadata-favicon-link" href="${data.author_filter_url}">
                <img src="${data.favicon}" class="youlag-video-metadata-favicon" />
              </a>

              <div class="yl-flex yl-flex-col">
                <div class="youlag-video-metadata-author">
                  <a href="${data.author_filter_url}">${data.author}</a>
                </div>
                <div class="youlag-video-metadata-date">${data.date}</div>
              </div>
            </section>

            <section class="youlag-video-actions-container">
              <a href="#" 
                class="yl-video-action-button ${modalFavoriteClassName} ${modalFavoriteClassName}--${data.favorited}"
                id="${modalToggleFavoriteIdName}">
                <div class="youlag-favorited-icon"></div>
              </a>

              <a href="#" 
                class="yl-video-action-button"
                id="${modalTagsManageIdName}">
                <img class="icon" src="../themes/icons/label.svg" loading="lazy" alt="🏷️">
              </a>

              <a class="yl-video-action-button" href="${data.external_link}" target="_blank">
                <span class="yl-video-action-button__icon">🌐</span><span>Source</span>
              </a>

              <a class="yl-video-action-button" href="${data.video_youtube_url}" target="_blank">
                <span class="yl-video-action-button__icon">▶️</span><span>YouTube</span>
              </a>
              <a class="yl-video-action-button" href="${data.video_invidious_redirect_url}" target="_blank">
                <span class="yl-video-action-button__icon">📺</span><span>Invidious</span>
              </a>

            </section>

          </div>

        </div>



        <div class="youlag-video-description-container">
          ${data.video_description}
        </div>
        
      </div>

    </div>
  `;

  // Only update iframe src if the user interacts with the select (not on initial render)
  const videoSourceSelect = container.querySelector(`#${modalVideoSourceIdName}`);
  const iframe = container.querySelector('.youlag-iframe');
  if (videoSourceSelect && iframe) {
    videoSourceSelect.addEventListener('change', function () {
      iframe.src = getEmbedUrl(videoSourceSelect.value);
    });
  }


  if (!data.youtubeId) {
    // Not a video feed item
    modal.classList.add('youlag-modal-feed-item--text');
    let iframeContainer = document.querySelector('.youlag-iframe-container');
    if (iframeContainer) {
      document.querySelector('.youlag-iframe-container').remove();
    }
  }


  container.querySelector(`#${modalCloseIdName}`)?.addEventListener('click', closeModal);
  container.querySelector(`#${modalMinimizeIdName}`)?.addEventListener('click', togglePipMode);
  container.querySelector(`#${modalToggleFavoriteIdName}`)?.addEventListener('click', (e) => {
    // Toggle favorites state in background
    e.preventDefault();
    toggleFavorite(data.favorite_toggle_url, container, data.feedItemEl);
  });
  container.querySelector(`#${modalTagsManageIdName}`)?.addEventListener('click', async (e) => {
    // Open tags (playlists) modal
    e.preventDefault();
    createTagsModal(data.entryId, await getItemTags(data.entryId));
  });

  // Push a new state to the history, to allow modal close when routing back.
  history.pushState({ modalOpen: true }, '', '');

  // Close theater modal on Esc key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
    }
  });

  window.addEventListener('popstate', closeModal);
}

function toggleFavorite(url, container, feedItemEl) {
  const favoriteButton = container.querySelector(`#${modalToggleFavoriteIdName}`);
  if (!favoriteButton) return;

  fetch(url, { method: 'GET' })
    .then(response => {
      if (response.ok) {
        // Toggle favorite classes and icons
        const currentlyTrue = favoriteButton.classList.contains(`${modalFavoriteClassName}--true`);
        favoriteButton.classList.remove(`${modalFavoriteClassName}--${currentlyTrue}`);
        favoriteButton.classList.add(`${modalFavoriteClassName}--${!currentlyTrue}`);

        // Only update DOM if feedItemEl exists (i.e., not restoring from localStorage)
        if (feedItemEl) {
          const bookmarkIcon = feedItemEl.querySelector('.item-element.bookmark img.icon');
          if (currentlyTrue) {
            feedItemEl.classList.remove('favorite');
            if (bookmarkIcon) {
              bookmarkIcon.src = '../themes/Mapco/icons/non-starred.svg';
            }
          } else {
            feedItemEl.classList.add('favorite');
            if (bookmarkIcon) {
              bookmarkIcon.src = '../themes/Mapco/icons/starred.svg';
            }
          }
        }
      } else {
        console.error('Failed to toggle favorite status');
      }
    })
    .catch(error => console.error('Error:', error));
}

function closeModal() {
  const modal = document.getElementById('youlagTheaterModal');
  if (modal) modal.remove();
  if (history.state && history.state.modalOpen) {
    history.back();
  }
  setModePip(false);
  setModeFullscreen(false);
  setPageTitle();
  clearVideoQueue();
}

function togglePipMode() {
  if (modePip) {
    setModePip(false);
    setModeFullscreen(true);
  }
  else {
    setModePip(true);
    setModeFullscreen(false);
  }
}

function setModePip(state) {
  if (state === true) {
    document.body.classList.add('youlag-mode--pip');
    modePip = true;
    modeFullscreen = false;
  }
  else if (state === false) {
    document.body.classList.remove('youlag-mode--pip');
    modePip = false;
  }
  try {
    const stored = localStorage.getItem('youlagVideoQueue');
    if (stored) {
      const obj = JSON.parse(stored);
      obj.isPipMode = !!state;
      localStorage.setItem('youlagVideoQueue', JSON.stringify(obj));
    }
  } catch (e) { }
}

function setModeFullscreen(state) {
  if (state === true) {
    document.body.classList.add('youlag-mode--fullscreen');
    document.body.classList.remove('youlag-mode--pip');
    modeFullscreen = true;
    modePip = false;
  }
  else if (state === false) {
    document.body.classList.remove('youlag-mode--fullscreen');
    modeFullscreen = false;
  }
}

function setupClickListener() {
  if (!youlagActive) return;
  const streamContainer = document.querySelector('#stream');

  if (streamContainer) {
    streamContainer.addEventListener('click', (event) => {
      // Prevent activation if clicked element is inside .flux_header li.
      // These are the feed item actions buttons.
      if (event.target.closest('div[data-feed] .flux_header li.manage')) return;
      if (event.target.closest('div[data-feed] .flux_header li.labels')) return;
      if (event.target.closest('div[data-feed] .flux_header li.share')) return;
      if (event.target.closest('div[data-feed] .flux_header li.link')) return;
      if (event.target.closest('div[data-feed] .flux_header .website a[href^="./?get=f_"]')) return;
      const target = event.target.closest('div[data-feed]');

      if (target) {
        handleActiveRssItem(event);
        collapseBackgroundFeedItem(target);
      }
    });
  }
}

document.addEventListener('keydown', function (event) {
  // youlag-inactive: Close article on Esc key.
  if (event.key === 'Escape' && document.body.classList.contains('youlag-inactive')) {
    const openedArticle = document.querySelector('#stream div[data-feed].active.current');
    if (openedArticle) {
      openedArticle.classList.remove('active', 'current');
      event.stopPropagation();
    }
  }
});


function setupTagsDropdownOverride() {
  // Delegated event listener to override tags (playlists) dropdown click
  const streamContainer = document.querySelector('#stream');
  if (!streamContainer) return;

  streamContainer.addEventListener('click', async function (event) {
    const entryItem = event.target.closest('div[data-feed] .flux_header li.labels');
    const entryItemDropdown = entryItem ? entryItem.querySelector('a.dropdown-toggle') : null;
    const entryItemFooterDropdown = event.target.closest('.item.labels a.dropdown-toggle[href^="#dropdown-labels-"]');

    if (entryItemDropdown || entryItemFooterDropdown) {
      // Prevent default dropdown behavior
      event.preventDefault();
      event.stopImmediatePropagation();
      let entryId = null;
      let entryIdRegex = '([0-9]+)$';
      if (entryItemDropdown) {
        entryId = entryItem.querySelector('.dropdown-target')?.id;
        entryId = entryId ? entryId.match(new RegExp(entryIdRegex)) : null;
        entryId = entryId ? entryId[1] : null;
      }
      if (entryItemFooterDropdown) {
        entryId = entryItemFooterDropdown.href;
        entryId = entryId ? entryId.match(new RegExp(entryIdRegex)) : null;
        entryId = entryId ? entryId[1] : null;
      }
      let tags = await getItemTags(entryId);

      // Open custom tags modal
      createTagsModal(entryId, tags);
    }
  }, true);
}

function createTagsModal(entryId, tags) {
  // Opens modal to manage tags (playlists) for feed item (entryId).
  /**
   * Example tags object:
  [{
    "id": 2,
    "name": "Some playlist name",
    "checked": true
  },]
  */

  if (document.getElementById(modalTagsContainerIdName)) {
    // Remove existing modal if present
    document.getElementById(modalTagsContainerIdName).remove();
  }

  let container = document.createElement('div');
  const useVideoLabels = document.querySelector('body.youlag-video-labels') ? true : false;
  const modalTitle = useVideoLabels ? 'Save to...' : 'Tags';
  container.id = modalTagsContainerIdName;
  container.classList.add('youlag-tags-modal');
  container.innerHTML = `
    <forms class="yl-tags-content">
      <h3 class="yl-tags-modal-title">
        ${modalTitle}

        <a href="./?c=tag" target="_blank"><img class="icon" src="../themes/Mapco/icons/configure.svg" loading="lazy" alt="⚙️"></a>
      </h3>
      <div class="yl-tags-list">
        ${tags.map(tag => `
            <div class="yl-tags-list-item">
              <input type="checkbox" id="yl-tag-${tag.id}" data-tag-id="${tag.id}" data-entry-id="${entryId}" ${tag.checked ? 'checked' : ''} />
              <label for="yl-tag-${tag.id}">${tag.name}</label>
            </div>
          `).join('')
    }
      </div>
      <div class="yl-tags-modal-actions">
        <button id="yl-tags-modal-close" class="btn">Done</button>
      </div>
    </forms>
  `

  document.body.appendChild(container);
  document.body.classList.add('youlag-tags-modal-open');


  // Event listener for tags (playlists) items.
  const checkboxes = container.querySelectorAll('.yl-tags-list-item input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function () {
      const tagId = this.getAttribute('data-tag-id');
      const entryId = this.getAttribute('data-entry-id');
      const checked = this.checked;
      setItemTag(entryId, { id: tagId, checked: checked });
    });
  });

  function closeTagsModal() {
    const modal = document.getElementById(modalTagsContainerIdName);
    if (modal) modal.remove();
    document.body.classList.remove('youlag-tags-modal-open');
    document.removeEventListener('keydown', tagsModalEscHandler, true);
  }

  // Close button
  const closeButton = container.querySelector('#yl-tags-modal-close');
  closeButton.addEventListener('click', closeTagsModal);

  // Close on Esc key
  function tagsModalEscHandler(event) {
    if (event.key === 'Escape') {
      closeTagsModal();
      event.stopPropagation(); // Prevent bubbling to other modals
    }
  }
  document.addEventListener('keydown', tagsModalEscHandler, true);

  // Close onblur
  container.addEventListener('mousedown', function (event) {
    const content = container.querySelector('.yl-tags-content');
    if (content && !content.contains(event.target)) {
      closeTagsModal();
    }
  });

}

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
  // Add or remove a feed item from a tag (playlists)

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

function collapseBackgroundFeedItem(target) {
  // Workaround: If user has YouTube Video Feed extension installed, prevent it from showing the default embedded 
  // in favor of Youlag theater view modal. This collapses down the original feed item that activates by FreshRSS clickevent.

  const feedItem = target;
  let isActive = feedItem.classList.contains('active') && feedItem.classList.contains('current');
  const iframes = feedItem.querySelectorAll('iframe');

  if (iframes || youtubeExtensionInstalled) {
    iframes.forEach(iframe => {
      // Disable iframes to prevent autoplay
      const src = iframe.getAttribute('src');
      if (src) {
        iframe.setAttribute('data-original', src);
        iframe.setAttribute('src', '');
      }
    });
  }

  if (isActive) {
    // Collapse the feed item
    feedItem.classList.remove('active');
    feedItem.classList.remove('current');
  }
}

function getCurrentPage() {
  // Notate the current page through css class on the body element.
  // E.g. yl-page-home, yl-page-important, yl-page-category, etc.
  const path = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const classPrefix = 'yl-page-';

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
      return prefixClasses(classString);
    }
  }

  return '';
}

function getSubpageParentId(getParam) {
  /**
   * Check parent of current subpage.
   * Returns the parent category id for a given getParam (e.g. 't_8' or 'f_8').
   * For 't_{n}' returns 'tags'.
   * For 'f_{n}' returns the DOM id of the active category (e.g. 'c_2'), or null if not found.
   */
  if (/^t_\d+$/.test(getParam)) {
    // Tag (playlists) page
    return 'playlists';
  }
  if (/^f_\d+$/.test(getParam)) {
    // Filter page, a subpage of a category.
    const activeElem = document.querySelector('#sidebar .tree-folder.category.active');
    if (activeElem && activeElem.id) {
      console.log('Found active category for filter page:', activeElem.id);
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
  if (!Array.isArray(whitelist) || !currentPageClass) return false;

  // If 'all' is included, it means every page and category will use the Youlag interface.
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

function setCategoryWhitelistClass() {
  // Quickly apply youlag-category-whitelist class based on localStorage to reduce layout shifts.

  let localStorageWhitelist = [];
  try {
    const stored = localStorage.getItem('youlagCategoryWhitelist');
    if (stored) localStorageWhitelist = JSON.parse(stored);
  } catch (e) { }

  const currentPageClass = getCurrentPage();
  const isWhitelisted = isPageWhitelisted(localStorageWhitelist, currentPageClass);
  youlagActive = isWhitelisted;

  // Apply class based on localStorage
  document.body.classList.toggle('youlag-active', isWhitelisted);
  document.body.classList.toggle('youlag-inactive', !isWhitelisted);

  // Sync with actual whitelist from the user settings exposed in the DOM.
  const whitelist = getCategoryWhitelist();
  const isWhitelistedUserSetting = isPageWhitelisted(whitelist, currentPageClass);
  youlagActive = isWhitelistedUserSetting;

  // If the actual whitelist status differs from localStorage, update class and localStorage.
  if (isWhitelistedUserSetting !== isWhitelisted) {
    document.body.classList.toggle('youlag-active', isWhitelistedUserSetting);
    document.body.classList.toggle('youlag-inactive', !isWhitelistedUserSetting);
    try {
      localStorage.setItem('youlagCategoryWhitelist', JSON.stringify(whitelist));
    } catch (e) { }
    return isWhitelistedUserSetting;
  }
  return isWhitelisted;
}

function setVideoLabelsClass() {
  /* Adds css class 'youlag-video-labels' to body if video labels setting is enabled.
   * The setting is stored in localStorage for faster access.
   * When active, labels like "My Labels" changes to "Playlists", and "Favorites" to "Watch Later".
   */
  const localStorageSetting = localStorage.getItem('youlagVideoLabels') || false;
  const userSettingElement = document.querySelector('#yl_video_labels');
  let userSetting = undefined;

  if (userSettingElement) {
    userSetting = userSettingElement.getAttribute('data-yl-video-labels');
  }

  if (userSetting === 'true') {
    document.body.classList.add('youlag-video-labels');
    localStorage.setItem('youlagVideoLabels', 'true');
  }
  else if (userSetting === 'false') {
    document.body.classList.remove('youlag-video-labels');
    localStorage.setItem('youlagVideoLabels', 'false');
  }
  else if (localStorageSetting === 'true') {
    document.body.classList.add('youlag-video-labels');
  }
  else {
    document.body.classList.remove('youlag-video-labels');
  }
}

function setUnreadBadgeClass() {
  // Adds css class 'youlag-video-unread-badge' to body if video unread badge setting is enabled.
  // If enabled, videos will show badge "New" for unwatched videos.
  const userSettingElement = document.querySelector('#yl_video_unread_badge');
  let userSetting = undefined;
  if (userSettingElement) {
    userSetting = userSettingElement.getAttribute('data-yl-video-unread-badge');
  }
  if (userSetting === 'true') {
    document.body.classList.add('youlag-video-unread-badge');
  }
  else {
    document.body.classList.remove('youlag-video-unread-badge');
  }
}

function setBodyPageClass() {
  getCurrentPage() && (document.body.className += ' ' + getCurrentPage());
  currentPageParams = new URLSearchParams(window.location.search).get('get');
  getSubpageParentId(currentPageParams) && (document.body.className += ' yl-page-' + getSubpageParentId(currentPageParams));
  setVideoLabelsClass();
  setUnreadBadgeClass();
  setCategoryWhitelistClass();
}

function setVideoLabelsTitle(pageClass, newTitle) {
  if (document.body.classList.contains(pageClass) &&
    document.body.classList.contains('youlag-video-labels')) {
    // Replace the middle text of the title, e.g. "(3) Some Text · FreshRSS" to "(3) ${newTitle} · FreshRSS"
    // Primarily for Playlists and Watch Later pages.
    const titleMatch = document.title.match(/^\s*(\((\d+)\)\s*)?(.+?)\s*·\s*(.+?)\s*$/);
    if (titleMatch) {
      const countPart = titleMatch[1] ? titleMatch[1] : '';
      const customSuffix = titleMatch[4] ? titleMatch[4] : ''; // In case the user has rename their FreshRSS instance.
      document.title = `${countPart}${newTitle} · ${customSuffix}`;
    }
  }
}


function setupNavMenu() {
  // Wrap FreshRSS nav_menu actions into a toggle button.
  // The container elements comes from `extensions.php` which adds element `#yl_nav_menu_container` via 'nav_entries' hook., 
  if (youlagNavMenuInitialized) return;
  youlagNavMenuInitialized = true;
  const ylNavMenuContainer = document.getElementById('yl_nav_menu_container');
  const ylNavMenu = ylNavMenuContainer ? ylNavMenuContainer.querySelector('#yl_nav_menu_container_content') : null;
  const ylNavMenuToggle = ylNavMenuContainer ? document.getElementById('yl_nav_menu_container_toggle') : null;
  const toggleSearch = ylNavMenuContainer ? document.getElementById('dropdown-search-wrapper') : null;
  const freshRssNavMenu = document.querySelector('#global nav.nav_menu:not(#yl_nav_menu_container)');
  const firstTransitionEElement = document.querySelector('#new-article + .transition');
  ylNavMenu.hidden = true;

  // Place only ylNavMenuToggle inside .transition, rest of ylNavMenuContainer as sibling after .transition.
  if (firstTransitionEElement && ylNavMenuContainer && ylNavMenuToggle) {
    if (toggleSearch) {
      // Break out search from nav_menu parent container, to keep it independent for styling.
      firstTransitionEElement.appendChild(toggleSearch);
    }
    firstTransitionEElement.appendChild(ylNavMenuToggle);
    if (firstTransitionEElement.nextSibling) {
      // Place ylNavMenuContainer after .transition (the category title).
      firstTransitionEElement.parentNode.insertBefore(ylNavMenuContainer, firstTransitionEElement.nextSibling);
    } else {
      firstTransitionEElement.parentNode.appendChild(ylNavMenuContainer);
    }
  }
  if (freshRssNavMenu && ylNavMenu) {
    const navMenuChildren = Array.from(freshRssNavMenu.children);
    navMenuChildren.forEach(child => {
      if (!(child.id === 'nav_menu_toggle_aside')) {
        ylNavMenu.appendChild(child);
      }
    });
  }

  if (ylNavMenuContainer && ylNavMenu && ylNavMenuToggle) {
    // Toggle custom youlag ylNavMenu on click.
    document.addEventListener('click', function (e) {
      const toggleBtn = e.target.closest('#yl_nav_menu_container_toggle');
      if (toggleBtn && document.body.contains(ylNavMenuContainer)) {
        const isOpen = ylNavMenuContainer.classList.toggle('yl-nav-menu-container--open');
        ylNavMenu.hidden = !isOpen;
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }
}

function init() {
  setBodyPageClass();
  setupClickListener();
  setupTagsDropdownOverride();
  setTimeout(() => {
    // HACK: Delay referencing the settings elements.
    youlagSettingsPageEventListeners();
  }, 1500);
  setupNavMenu();
  restoreVideoQueue();
  setVideoLabelsTitle('yl-page-playlists', 'Playlists');
  setVideoLabelsTitle('yl-page-watch_later', 'Watch later');
  removeYoulagLoadingState();
  youlagScriptLoaded = true;
}

function removeYoulagLoadingState() {
  // By default, the youlag CSS is set to a loading state.
  // This will remove the loading state when the script is ready.
  document.body.classList.add('youlag-loaded');
}

function initFallback() {
  if (document.readyState === 'complete' || document.readyState === 'interactive' || youlagScriptLoaded === true) {
    init();
  }
  else {
    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('load', init);
  }
}

// Fallback interval check
const checkInitInterval = setInterval(() => {
  if (document.readyState === 'complete' || youlagScriptLoaded === true) {
    init();
    clearInterval(checkInitInterval);
  }
}, 1000);

// Ensure init runs
initFallback();