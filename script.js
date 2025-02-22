let youlagScriptLoaded = false;
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

function extractFeedItemData(feedItem) {
  // Extract data from the provided target element.
  const extractedYoutubeUrl = feedItem.querySelector('.enclosure-content a[href*="youtube"]')?.href || '';
  const youtubeUrl = extractedYoutubeUrl.replace('/v/', '/watch?v=').replace('?version=3', '');
  const youtubeEmbedUrl = youtubeUrl.replace('/watch?v=', '/embed/');
  const youtubeId = youtubeUrl ? youtubeUrl.split('watch?v=')[1].split('&')[0] : '';
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
    title: feedItem.querySelector('.item-element.title')?.textContent.trim() || '',
    external_link: feedItem.querySelector('.item-element.title')?.href || '',
    date: feedItem.querySelector('.flux_content .date')?.textContent.trim() || '',
    video_embed_url: feedItem.querySelector('article.flux_content .text > iframe')?.getAttribute('data-original') || feedItem.querySelector('article iframe')?.getAttribute('src'),
    video_description:
      '<div class="youlag-video-description-content">' +
        // If video description is found us it, otherwise fallback to generic description element.
        (feedItem.querySelector('.enclosure-description')?.innerHTML.trim() || 
        feedItem.querySelector('article div.text')?.innerHTML.trim() || '') +
      '</div>',
    video_youtube_url: youtubeUrl,
    video_youtube_url_embed: youtubeEmbedUrl,
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
                <a class="yl-video-action-button" href="${data.video_youtube_url_embed}" target="_blank">
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


  if (!data.video_embed_url) {
    // Not a video feed item
    modal.classList.add('youlag-modal-feed-item--text');
    let iframeContainer = document.querySelector('.youlag-iframe-container');
    if (iframeContainer) {
      document.querySelector('.youlag-iframe-container').remove();
    }
  }


  container.querySelector(`#${modalCloseIdName}`)?.addEventListener('click', closeModal);
  container.querySelector(`#${modalToggleFavoriteIdName}`)?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleFavorite(data.favorite_toggle_url, container, data.feedItemEl);
  });

  // Push a new state to the history.
  // TODO 2025-02-22: Currently requires two back presses to close the modal.
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
      const target = event.target.closest('div[data-feed]');

      if (target) {
        handleActiveRssItem(event);
        collapseBackgroundFeedItem(target);
      }
    });
  }
}

function collapseBackgroundFeedItem(target) {
  // Workaround: Closes down the original feed item that activates by FreshRSS clickevent.
  const feedItem = target;
  let isActive = feedItem.classList.contains('active') && feedItem.classList.contains('current');
  const iframes = feedItem.querySelectorAll('iframe');

  iframes.forEach(iframe => {
    // Disable iframes to prevent autoplay
    const src = iframe.getAttribute('src');
    if (src) {
      console.log('iframe replace:', src);
      iframe.setAttribute('data-original', src);
      iframe.setAttribute('src', '');
    }
  });

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
  // By default, the youlag css is set to a loading state.
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