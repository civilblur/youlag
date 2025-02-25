let youlagScriptLoaded = false;
let youtubeExtensionInstalled = false; // Parse content differently in case user has the FreshRSS "YouTube Video Feed" extension enabled.
let youtubeId;
const modalContainerClassName = `youlag-theater-modal-container`;
const modalContentClassName = `youlag-theater-modal-content`;
const modalCloseIdName = `youlagCloseModal`;
const modalToggleFavoriteIdName = `youlagToggleFavorite`;
const modalFavoriteClassName = `youlag-favorited`;


function handleActiveRssItem(targetOrEvent) {
  // Coordinates the event for extracting the data triggering.
  let feedItem;
  if (targetOrEvent instanceof Event) {
    feedItem = targetOrEvent.target.closest('div[data-feed]');
  } else {
    feedItem = targetOrEvent.closest('div[data-feed]');
  }
  if (!feedItem) return;
  disableBodyScroll(true);
  const data = extractFeedItemData(feedItem);
  data.feedItemEl = feedItem;
  createModalWithData(data);
}

function getVideoIdFromUrl(url) {
  // Match video ID without relying on base domain being "youtube"-specific, in order to support invidious and piped links.
  const regex = /(?:\/|^)(?:v\/|e(?:mbed)?\/|\S*?[?&]v=|\S*?[?&]id=|v=)([a-zA-Z0-9_-]{11})(?:[\/\?]|$)/;
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


function extractFeedItemData(feedItem) {
  // Extract data from the provided target element.
  let extractedVideoUrl = feedItem.querySelector('.item.titleAuthorSummaryDate a[href*="youtube"], .item.titleAuthorSummaryDate a[href*="/watch?v="]')?.href || '';
  if (!extractedVideoUrl) {
    // Fallback to see if user has installed the YouTube video feed/Invidious video feed extension, as they create a different DOM structure.
    extractedVideoUrl = feedItem.querySelector('.enclosure-content a[href*="youtube"], .enclosure-content a[href*="/watch?v="]');
    youtubeExtensionInstalled = extractedVideoUrl ? true : false;
  }
  const videoBaseUrl = getBaseUrl(extractedVideoUrl);
  youtubeId = extractedVideoUrl ? getVideoIdFromUrl(extractedVideoUrl) : '';
  const videoUrl = youtubeId ? `${videoBaseUrl}/watch?v=${youtubeId}` : '';
  const youtubeEmbedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : '';  
  const videoEmbedUrl = youtubeId ? `${videoBaseUrl}/embed/${youtubeId}` : '';  
  const authorElement = feedItem.querySelector('.flux_header');
  const authorFilterElement = authorElement?.querySelector('.website a.item-element[href*="get=f_"]');
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
    youtube_embed_url: youtubeEmbedUrl,
    video_embed_url: videoEmbedUrl,
    video_description:
      '<div class="youlag-video-description-content">' +
        // If video description is found, use it, otherwise fallback to generic description element.
        (feedItem.querySelector('.enclosure-description')?.innerHTML.trim() || 
        feedItem.querySelector('article div.text')?.innerHTML.trim() || '') +
      '</div>',
    video_youtube_url: videoUrl,
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
  container.innerHTML = `
    <div class="${modalContentClassName}">

      <div class="youlag-video-header">
        <button id="${modalCloseIdName}">×</button>
      </div>

      <div class="youlag-video-container">
        <div class="youlag-thumbnail-container">
          <img src="${data.thumbnail}" class="youlag-video-thumbnail" />
        </div>
        <div class="youlag-iframe-container">
          <iframe class="youlag-iframe"
                  src="${data.video_embed_url ? data.video_embed_url : ''}" frameborder="0" allowfullscreen></iframe>
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

              <a class="yl-video-action-button" href="${data.video_invidious_redirect_url}" target="_blank">
                <span class="yl-video-action-button__icon">📺</span><span>Invidious</span>
              </a>

              <div class="yl-video-action-button-group">
                <a class="yl-video-action-button" href="${data.video_youtube_url}" target="_blank">
                  <span class="yl-video-action-button__icon">▶️</span><span>YouTube</span>
                </a>
                <a class="yl-video-action-button" href="${data.youtube_embed_url}" target="_blank">
                  <span>View embed</span>
                </a>
              </div>

            </section>

          </div>

        </div>



        <div class="youlag-video-description-container">
          ${data.video_description}
        </div>
        
      </div>

    </div>
  `;


  if (!youtubeId) {
    // Not a video feed item
    modal.classList.add('youlag-modal-feed-item--text');
    let iframeContainer = document.querySelector('.youlag-iframe-container');
    if (iframeContainer) {
      document.querySelector('.youlag-iframe-container').remove();
    }
  }


  container.querySelector(`#${modalCloseIdName}`)?.addEventListener('click', closeModal);
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
  disableBodyScroll(false);
  const modal = document.getElementById('youlagTheaterModal');
  if (modal) modal.remove();
  if (history.state && history.state.modalOpen) {
    history.back();
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

function disableBodyScroll(scroll) {
  document.body.style.overflow = scroll ? 'hidden' : 'auto';
}

function init() {
  setupClickListener();
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