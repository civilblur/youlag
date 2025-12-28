let youlagScriptLoaded = false;
let youtubeExtensionInstalled = false; // Parse content differently in case user has the FreshRSS "YouTube Video Feed" extension enabled.
let youtubeId;
let modePip = false;
let modeFullscreen = true;
const modalContainerClassName = `youlag-theater-modal-container`;
const modalContentClassName = `youlag-theater-modal-content`;
const modalCloseIdName = `youlagCloseModal`;
const modalMinimizeIdName = `youlagMinimizeModal`;
const modalVideoSourceIdName = `youlagVideoSource`;
const modalVideoSourceDefaultIdName = `youlagVideoSourceDefault`;
const modalToggleFavoriteIdName = `youlagToggleFavorite`;
const modalFavoriteClassName = `youlag-favorited`;


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


function handleActiveRssItem(targetOrEvent) {
  // Coordinates the event for extracting the data triggering.
  let feedItem;
  if (targetOrEvent instanceof Event) {
    feedItem = targetOrEvent.target.closest('div[data-feed]');
  } else {
    feedItem = targetOrEvent.closest('div[data-feed]');
  }
  if (!feedItem) return;
  const data = extractFeedItemData(feedItem);
  data.feedItemEl = feedItem;
  createModalWithData(data);
  if (!modePip) {
    setModeFullscreen(true);
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
  const urlPattern = /https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+[\w\-_/~#@?=&%]/g;
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(urlPattern);
  return matches ? matches : [];
}

function appendUrl(text) {
  console.log( 'appendUrl input:', text);
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
  const invidiousInstance1 = feedItem.querySelector('.content div.text span[data-yl-invidious-instance]')?.getAttribute('data-yl-invidious-instance');
  const videoSourceDefault = feedItem.querySelector('.content div.text span[data-yl-video-source-default]')?.getAttribute('data-yl-video-source-default');
  const invidiousRedirectPrefixUrl = 'https://redirect.invidious.io/watch?v=';

  return {
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
    youtube_embed_url: youtubeEmbedUrl,
    video_embed_url: videoEmbedUrl,
    video_invidious_instance_1: invidiousInstance1 || '',
    video_source_default: videoSourceDefault || 'youtube',
    video_description:
      // If video description is found, use it, otherwise fallback to generic description element.
      `<div class="youlag-video-description-content">
        ${
          isVideoFeedItem && videoDescriptionExists ? appendUrl(feedItem.querySelector('.enclosure-description')?.innerHTML.trim()) :
          feedItem.querySelector('article div.text')?.innerHTML.trim() || ''
        }
      </div>`,
    video_youtube_url: youtubeUrl,
    video_invidious_redirect_url: `${youtubeId ? invidiousRedirectPrefixUrl + youtubeId : ''}`
  };
}

function createModalWithData(data) {
  // Create custom modal
  let modal = document.getElementById('youlagTheaterModal');


  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'youlagTheaterModal';
    modal.innerHTML = `<div class="${modalContainerClassName}"></div>`;
    document.body.appendChild(modal);
  }

  // Add content to modal
  const container = modal.querySelector(`.${modalContainerClassName}`);
  const videoSourceDefault = data.video_source_default;
  const youtubeSelected = videoSourceDefault === 'youtube' ? 'selected' : '';
  const invidiousSelected = videoSourceDefault === 'invidious_1' ? 'selected' : '';
  const invidiousBaseUrl = data.video_invidious_instance_1;

  function getEmbedUrl(source) {
    // Helper to get the correct embed URL for a given source
    if (source === 'invidious_1' && data.video_invidious_instance_1) {
      return `${data.video_invidious_instance_1.replace(/\/$/, '')}/embed/${youtubeId}`;
    } else if (source === 'youtube') {
      return data.youtube_embed_url;
    }
    return '';
  }

  // Determine the initial video source (default)
  const videoSourceDefaultNormalized = videoSourceDefault === 'invidious_1' ? 'invidious_1' : 'youtube';
  const defaultEmbedUrl = getEmbedUrl(videoSourceDefaultNormalized);
 
  container.innerHTML = `
    <div class="${modalContentClassName}">

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


  if (!youtubeId) {
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
        const bookmarkIcon = feedItemEl.querySelector('.item-element.bookmark img.icon');
        favoriteButton.classList.remove(`${modalFavoriteClassName}--${currentlyTrue}`);
        favoriteButton.classList.add(`${modalFavoriteClassName}--${!currentlyTrue}`);

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
      match: () => (!urlParams.has('a') || urlParams.get('a') === 'normal') && !urlParams.has('get') && !urlParams.has('c'),
      className: 'home',
    },
    {
      path: '/i/',
      match: () => urlParams.get('c') === 'extension',
      className: 'extension',
    },
    {
      path: '/i/',
      match: () => urlParams.get('a') === 'normal' && urlParams.get('get') === 'i',
      className: 'important',
    },
    {
      path: '/i/',
      match: () => urlParams.get('a') === 'normal' && urlParams.get('get') === 's',
      className: 'watch_later',
    },
    {
      path: '/i/',
      match: () => urlParams.get('a') === 'normal' && /^t_\d+$/.test(urlParams.get('get') || ''),
      className: () => {
        const n = (urlParams.get('get') || '').substring(2);
        return `playlist t_${n}`;
      },
    },
    {
      path: '/i/',
      match: () => urlParams.get('a') === 'normal' && urlParams.get('get') && urlParams.get('get').startsWith('c_'),
      className: () => {
        const n = urlParams.get('get').substring(2);
        return `category c_${n}`;
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

function getCategoryWhitelist() {
  // Retrieve the category whitelist.
  // `setCategoryWhitelist()` in `extension.php` outputs the user data to the DOM.
  const el = document.querySelector('#yl_category_whitelist');
  if (!el) return [];
  const data = el.getAttribute('data-yl-category-whitelist');
  if (!data) return [];
  return data.split(',').map(s => s.trim()).filter(Boolean);
}

function isCategoryWhitelist() {
  // Set body class based on category whitelist.
  const whitelist = getCategoryWhitelist();
  const currentPageClass = getCurrentPage();
  if (whitelist.includes('all')) {
    // All pages allowed
    return true;
  }
  if (currentPageClass.startsWith('yl-page-category')) {
    // Category page
    const categoryIdMatch = currentPageClass.match(/c_(\d+)/);
    if (categoryIdMatch) {
      const categoryId = categoryIdMatch[1];
      if (whitelist.includes('c_' + categoryId)) {
        return true;
      }
    }
  } else {
    // Non-category page
    if (whitelist.includes('home') && currentPageClass === 'yl-page-home') {
      return true;
    }
    if (whitelist.includes('important') && currentPageClass === 'yl-page-important') {
      return true;
    }
    if (whitelist.includes('watch_later') && currentPageClass === 'yl-page-watch_later') {
      return true;
    }
  }
  return false;
}




function setBodyPageClass() {
  const pageClass = getCurrentPage();
  if (pageClass) {
    document.body.className += ' ' + pageClass;
  }

  if (isCategoryWhitelist()) {
    // Testing whitelist
    document.body.classList.add('whitelist-YES');
  } else {
    document.body.classList.add('whitelist-NO');
  }
}


function init() {
  setBodyPageClass();
  setupClickListener();
  setTimeout(() => {
    // HACK: Delay referencing the settings elements.
    youlagSettingsPageEventListeners();
  }, 1500);
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
  } else {
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