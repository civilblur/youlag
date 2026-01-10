let youlagModalNavigatingBack = false; // Prevent multiple history.back() triggers
let youlagModalPopstateIgnoreNext = false; // Prevent infinite popstate loop for modal
let youlagScriptLoaded = false;
let youlagNavMenuInitialized = false;
let youlagClickListenersInitialized = false;
let youlagRestoreVideoQueueRan = false;
let youladModalPopstateAdded = false; // The popstate for video modal is only required to be added once to allow closing the modal via the back button. 
let youlagActive = true; // Whether Youlag is active on this page based on user category whitelist setting.
let youtubeExtensionInstalled = false; // Parse content differently in case user has the FreshRSS "YouTube Video Feed" extension enabled.
let disableStickyTransitionTitle = false; // To temporarily disable the sticky transition title, e.g. when using programmatic scrolling.
let youtubeId;
let previousPageTitle = null;
let previousFeedItemScrollTop = 0; // Keep scroll position of pip-mode feed item when collapsing.
let modePip = false;
let modeFullscreen = true;
let feedItemActive = false; // Whether an article/video is currently active.
const youlagModalVideoRootIdName = `youlagTheaterModal`;
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


function handleActiveItemVideoMode(targetOrEventOrVideo, isVideoObject = false) {
  // Handles both DOM event/element and direct video object.
  previousFeedItemScrollTop = 0;
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
  } 
  else {
    // Extract the feed item from the DOM event/element
    const feedItem = (targetOrEventOrVideo instanceof Event)
      ? targetOrEventOrVideo.target.closest('div[data-feed]')
      : targetOrEventOrVideo.closest('div[data-feed]');
    if (!feedItem) return;

    data = extractFeedItemData(feedItem);
    data.feedItemEl = feedItem;
    setVideoQueue(data);
  }

  if (!modePip) setModeFullscreen(true);
  createVideoModal(data);
}

function handleActiveItemArticle(event) {
  history.pushState({ articleOpen: true }, '', '');
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

  const entryId = videoObject.entryId;
  const foundIndex = queue.findIndex(v => v.entryId === entryId);
  const isPipMode = document.body.classList.contains('youlag-mode--pip');
  if (foundIndex === -1) {
    queue.push(videoObject);
    activeIndex = queue.length - 1;
  }
  else {
    queue.splice(foundIndex, 1);
    queue.push(videoObject);
    activeIndex = queue.length - 1;
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
    handleActiveItemVideoMode(queueObj, true);
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
  let modal = document.getElementById(youlagModalVideoRootIdName);

  if (!modal) {
    modal = document.createElement('div');
    modal.id = youlagModalVideoRootIdName;
    modal.innerHTML = `<div class="${modalVideoContainerClassName}"></div>`;
    document.body.appendChild(modal);
  }

  // Add content to modal
  const container = modal.querySelector(`.${modalVideoContainerClassName}`);
  const videoSourceDefault = data.video_source_default;
  const youtubeSelected = videoSourceDefault === 'youtube' ? 'selected' : '';
  const invidiousSelected = videoSourceDefault === 'invidious_1' ? 'selected' : '';
  const invidiousBaseUrl = data.video_invidious_instance_1;
  modal.classList.remove('youlag-modal-feed-item--has-thumbnail', 'youlag-modal-feed-item--no-thumbnail');
  data.thumbnail
    ? modal.classList.add('youlag-modal-feed-item--has-thumbnail')
    : modal.classList.add('youlag-modal-feed-item--no-thumbnail');
  feedItemActive = true;

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

  // Only update iframe src if the user interacts with the select (not on initial render).
  const videoSourceSelect = container.querySelector(`#${modalVideoSourceIdName}`);
  const iframe = container.querySelector('.youlag-iframe');
  if (videoSourceSelect && iframe) {
    videoSourceSelect.addEventListener('change', function () {
      iframe.src = getEmbedUrl(videoSourceSelect.value);
    });
  }

  if (!data.youtubeId) {
    // Handle non-video feed items, such as text-based articles.
    modal.classList.add('youlag-modal-feed-item--text');
    let iframeContainer = document.querySelector('.youlag-iframe-container');
    if (iframeContainer) {
      document.querySelector('.youlag-iframe-container').remove();
    }
  }

  container.querySelector(`#${modalCloseIdName}`)?.addEventListener('click', closeModalVideo);
  container.querySelector(`#${modalMinimizeIdName}`)?.addEventListener('click', togglePipMode);
  container.querySelector(`#${modalToggleFavoriteIdName}`)?.addEventListener('click', (e) => {
    // Toggle favorites state in background.
    e.preventDefault();
    toggleFavorite(data.favorite_toggle_url, container, data.feedItemEl);
  });
  container.querySelector(`#${modalTagsManageIdName}`)?.addEventListener('click', async (e) => {
    // Open tags (playlists) modal.
    e.preventDefault();
    createTagsModal(data.entryId, await getItemTags(data.entryId));
  });

  // Push a new state to the history, to allow modal close when routing back.
  if (modeFullscreen && !youladModalPopstateAdded) {
    history.pushState({ modalOpen: true }, '', '');
    youladModalPopstateAdded = true;
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modeFullscreen) {
      closeModalVideo();
    }
  });

  window.addEventListener('popstate', function popstateHandler(e) {
    // youlag-active: Only handle video modal if in fullscreen mode, otherwise allow normal browser navigation.
    if (youlagModalPopstateIgnoreNext) {
      youlagModalPopstateIgnoreNext = false;
      youlagModalNavigatingBack = false;
      return;
    }
    const modal = document.getElementById(youlagModalVideoRootIdName);
    if (modeFullscreen && modal) {
      youlagModalNavigatingBack = false;
      closeModalVideo();
    }
  });
}

function toggleFavorite(url, container, feedItemEl) {
  const favoriteButton = container.querySelector(`#${modalToggleFavoriteIdName}`);
  if (!favoriteButton) return;

  fetch(url, { method: 'GET' })
    .then(response => {
      if (response.ok) {
        // Toggle favorite classes and icons.
        const currentlyTrue = favoriteButton.classList.contains(`${modalFavoriteClassName}--true`);
        favoriteButton.classList.remove(`${modalFavoriteClassName}--${currentlyTrue}`);
        favoriteButton.classList.add(`${modalFavoriteClassName}--${!currentlyTrue}`);

        // Only update DOM if feedItemEl exists (i.e., not restoring from localStorage).
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

function closeModalVideo() {
  const modal = document.getElementById(youlagModalVideoRootIdName);
  if (modal) modal.remove();
  youladModalPopstateAdded = false;
  if (!youlagModalNavigatingBack && history.state && history.state.modalOpen && (modeFullscreen || !modePip)) {
    // Only trigger history.back() once, and set the ignore flags.
    youlagModalNavigatingBack = true;
    youlagModalPopstateIgnoreNext = true;
    history.back();
  }
  else {
    history.replaceState(null, '', location.href);
  }
  feedItemActive = false;
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
  const modal = document.getElementById(youlagModalVideoRootIdName);

  if (state === true) {
    modal ? (previousFeedItemScrollTop = modal.scrollTop) : null;
    document.body.classList.add('youlag-mode--pip');
    modePip = true;
    modeFullscreen = false;
    modal ? modal.scrollTo({ top: 0 }) : null;
  }
  else if (state === false) {
    if (modal) {
      let transitionRan = false;
      const onTransitionEnd = () => {
        transitionRan = true;
        // Scroll back to previous position when exiting pip mode.
        modal.scrollTo({ top: previousFeedItemScrollTop, behavior: 'smooth' });
      };
      modal.addEventListener('transitionend', onTransitionEnd, { once: true });
      setTimeout(() => {
        // Fallback if transition event is not detected.
        if (!transitionRan) {
          modal.scrollTo({ top: previousFeedItemScrollTop, behavior: 'smooth' });
        }
      }, 500);
    }
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
  // youlag-active: Video mode
  if (youlagClickListenersInitialized) return;
  const streamContainer = document.querySelector('#stream');

  if (youlagActive) {
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
          handleActiveItemVideoMode(event);
          setTimeout(() => {
            collapseBackgroundFeedItem(target);
          }, 100);
        }
      });
    }
  }
  else if (!youlagActive) {
    // youlag-inactive: Article context.
    if (streamContainer) {
      streamContainer.addEventListener('click', function (event) {
        const target = event.target.closest('div[data-feed]');

        if (target && !feedItemActive) {
          handleActiveItemArticle(event);
          feedItemActive = true;
        }

        // Scroll to top of the article robustly
        const scrollToTarget = () => {
          const rect = target.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          let offset = 0;
          if (window.getComputedStyle) {
            const root = document.documentElement;
            const val = getComputedStyle(root).getPropertyValue('--yl-topnav-height');
            offset = parseInt(val, 10) || 0;
          }
          return rect.top + scrollTop - offset;
        };

        // Prevent sticky transition title from showing when auto-scrolling.
        const transitionTitle = document.getElementsByClassName('yl-freshrss-transition--sticky')[0];
        disableStickyTransitionTitle = true;
        transitionTitle.classList.remove('sticky-visible');
        transitionTitle.classList.add('sticky-hidden');

        let attempts = 0;
        const maxAttempts = 4;
        const scroll = () => {
          const targetScroll = scrollToTarget();
          window.scrollTo({
            top: targetScroll,
          });
          const assessScrollPosition = () => {
            attempts++;
            const newTargetScroll = scrollToTarget();
            if (Math.abs(window.pageYOffset - newTargetScroll) > 2 && attempts < maxAttempts) {
              window.requestAnimationFrame(scroll);
            } else {
              setTimeout(() => {
                disableStickyTransitionTitle = false;
              }, 50);
            }
          };
          window.setTimeout(assessScrollPosition, 180);
        };
        scroll();
      });
    }

    window.addEventListener('popstate', function (event) {
      if (location.hash && (!location.pathname || location.pathname === '/' || location.pathname === window.location.pathname)) {
        // Ignore hash-only routes, e.g. when clicking dropdown menus that routes to e.g. `#dropdown-configure`.
        return;
      }
      // Close the open article if one is open when navigating back.
      if (modePip) {
        history.back();
      } else {
        const openArticle = document.querySelector('#stream div[data-feed].active.current');
        if (openArticle) {
          closeArticle(event);
        }
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        if (youlagActive) {
          // youlag-active: Video modal context.
          const modal = document.getElementById(youlagModalVideoRootIdName);
          if (modal) {
            closeModalVideo();
          }
        } else if (!youlagActive) {
          // youlag-inactive: Article context.
          const openArticle = document.querySelector('#stream div[data-feed].active.current');
          if (openArticle) {
            closeArticle(event);
          }
        }
      }
    });
  }
  youlagClickListenersInitialized = true;
}

function closeArticle(event) {
  const openedArticle = document.querySelector('#stream div[data-feed].active.current');

  if (openedArticle) {
    openedArticle.classList.remove('active', 'current');
    const rect = openedArticle.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const staticOffset = 80; // Increase offset to prevent e.g. `nav_menu` to overlap.
    let offset = 0;

    if (window.getComputedStyle) {
      const root = document.documentElement;
      const val = getComputedStyle(root).getPropertyValue('--yl-topnav-height');
      if (val) {
        offset = parseInt(val.trim(), 10) || 0;
      }
    }

    // Scroll to the top of the closed article, offset by `var(--yl-topnav-height)`.
    const targetScroll = rect.top + scrollTop - offset - staticOffset;
    window.scrollTo({
      top: Math.max(0, targetScroll)
    });
    event?.stopPropagation?.();
    // Allow navigating back to close an open article, by intercepting the back navigation using popstate event.
    const initialPath = location.pathname + location.search;
    // Ensure article closes if popstate has articleOpen, while keeping on the same page.
    if (history.state && history.state.articleOpen && (location.pathname + location.search === initialPath)) {
      history.back();
    }

    feedItemActive = false;
  }
}

function setupTagsDropdownOverride() {
  // Delegated eventlistener to override tags (playlists) dropdown click
  const streamContainer = document.querySelector('#stream');
  if (!streamContainer) return;

  streamContainer.addEventListener('click', async function (event) {
    const entryItem = event.target.closest('div[data-feed] .flux_header li.labels');
    const entryItemDropdown = entryItem ? entryItem.querySelector('a.dropdown-toggle') : null;
    const entryItemFooterDropdown = event.target.closest('.item.labels a.dropdown-toggle[href^="#dropdown-labels-"]');

    if (entryItemDropdown || entryItemFooterDropdown) {
      // Prevent default tag dropdown behavior
      event.preventDefault();
      event.stopImmediatePropagation();
      let entryId = null;
      let entryIdRegex = '([0-9]+)$';
      let iconImg = null;
      if (entryItemDropdown) {
        entryId = entryItem.querySelector('.dropdown-target')?.id;
        entryId = entryId ? entryId.match(new RegExp(entryIdRegex)) : null;
        entryId = entryId ? entryId[1] : null;
        iconImg = entryItemDropdown.closest('li.labels')?.querySelector('img.icon');
      }
      if (entryItemFooterDropdown) {
        entryId = entryItemFooterDropdown.href;
        entryId = entryId ? entryId.match(new RegExp(entryIdRegex)) : null;
        entryId = entryId ? entryId[1] : null;
        iconImg = entryItemFooterDropdown.closest('li.labels, .item.labels')?.querySelector('img.icon');
      }
      let prevSrc = null;
      if (iconImg) {
        prevSrc = iconImg.src;
        iconImg.classList.add('loading');
        iconImg.src = '../themes/icons/spinner.svg';
      }
      let tags = await getItemTags(entryId);
      if (iconImg) {
        iconImg.classList.remove('loading');
        iconImg.src = prevSrc;
      }
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

function collapseBackgroundFeedItem(target) {
  // Workaround: If user has YouTube Video Feed extension installed, prevent it from showing the default embedded 
  // in favor of Youlag theater view modal. This collapses down the original feed item that activates by FreshRSS clickevent.

  const feedItem = target;
  let isActive = feedItem.classList.contains('active') && feedItem.classList.contains('current');
  const iframes = feedItem.querySelectorAll('iframe');

  if (iframes || youtubeExtensionInstalled) {
    iframes.forEach(iframe => {
      // Disable iframes to prevent autoplay.
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
  if (youlagNavMenuInitialized) return;
  youlagNavMenuInitialized = true;

  const ylNavMenuContainer = document.getElementById('yl_nav_menu_container');
  const ylNavMenu = ylNavMenuContainer?.querySelector('#yl_nav_menu_container_content');
  const ylNavMenuToggle = ylNavMenuContainer?.querySelector('#yl_nav_menu_container_toggle');
  const freshRssToggleSearch = document?.querySelector('#dropdown-search-wrapper');
  const freshRssNavMenu = document.querySelector('#global nav.nav_menu:not(#yl_nav_menu_container)');
  const freshRssTransition = document.querySelector('#new-article + .transition');

  // Gracefully fail
  if (!ylNavMenuContainer || !ylNavMenu || !ylNavMenuToggle || !freshRssNavMenu || !freshRssTransition) return;

  ylNavMenu.hidden = true; // `.nav_menu` is hidden by default.
  ylNavMenu.classList.add('nav_menu'); 

  freshRssTransition.classList.add('yl-freshrss-transition--sticky');
  ylNavMenuContainer.classList.add('yl-nav-menu-container--sticky');

  if (freshRssToggleSearch) {
    // Break out search from the FreshRSS `.nav_menu` container, to keep it independent for styling.
    if (ylNavMenuContainer.nextSibling) {
      ylNavMenuContainer.parentNode.insertBefore(freshRssToggleSearch, ylNavMenuContainer.nextSibling);
    } 
  }
  freshRssTransition.appendChild(ylNavMenuToggle);
  if (freshRssTransition.nextSibling) {
    // Place ylNavMenuContainer after `.transition` (the category title).
    // The ylNavMenuContainer containing the `.nav_menu` will appear below the title when toggled this way.
    freshRssTransition.parentNode.insertBefore(ylNavMenuContainer, freshRssTransition.nextSibling);
  } else {
    freshRssTransition.parentNode.appendChild(ylNavMenuContainer);
  }
  if (freshRssNavMenu && ylNavMenu) {
    // Move FreshRSS `.nav_menu` items inside Youlag's own `.nav_menu` content, ylNavMenu (child of ylNavMenuContainer).
    const navMenuChildren = Array.from(freshRssNavMenu.children);
    navMenuChildren.forEach(child => {
      if (child.id !== 'nav_menu_toggle_aside') {
        // Exclude the sidebar toggle button, as that its position placement is handled via css already.
        ylNavMenu.appendChild(child);
      }
    });
    const settingsShortcut = document.createElement('div');
    settingsShortcut.id = 'yl_nav_menu_settings_shortcut';
    settingsShortcut.innerHTML = `<a href="/i/?c=extension&a=configure&e=Youlag" class="btn" target="_blank" rel="noopener noreferrer">
                                    More settings
                                  </a>`;
    ylNavMenu.appendChild(settingsShortcut);
  }
  
  // Setup sticky scroll behavior for FreshRSS `.transition` and Youlag `.nav_menu`, ylNavMenuContainer.
  setupNavMenuStickyScroll(freshRssTransition, ylNavMenuContainer);

  // Toggle custom Youlag `.nav_menu`, ylNavMenu, on click.
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


function setupNavMenuStickyScroll(freshRssTransition, ylNavMenuContainer) {
  // Setup scroll listener to show/hide the Youlag `.nav_menu`. Visible while scrolling up, hidden while scrolling down.
  let lastScrollY = window.scrollY;
  let ticking = false;
  let ignoreNextScroll = false; // 'Configure view' toggling expands ylNavMenuContainer, casuing unwanted scroll events. Prevent those.  

  function setStickyVisibility(show) {
    const add = (el) => {
      el.classList.toggle('sticky-visible', show);
      el.classList.toggle('sticky-hidden', !show);
    };
    add(freshRssTransition);
    add(ylNavMenuContainer);
  }

  function setStickyVisibilitySidenavToggle(show) {
    const sidenavToggle = document.getElementById('nav_menu_toggle_aside');
    if (sidenavToggle) {
      /* Desktop: The css uses desktop media queries to avoid needing to use js resizeobserver.
         While the classes are applied, the visual changes only applies on desktop, when sidenav is not visible. */
      sidenavToggle.classList.toggle('sticky-visible--sidenav-toggle', show);
      sidenavToggle.classList.toggle('sticky-hidden--sidenav-toggle', !show);
    }
  }

  function onScroll() {
    if (ignoreNextScroll || disableStickyTransitionTitle) {
      ignoreNextScroll = false;
      lastScrollY = window.scrollY;
      return;
    }
    const currentScrollY = window.scrollY;
    if (currentScrollY <= 0) {
      setStickyVisibility(true);
      setStickyVisibilitySidenavToggle(true);
    }
    else if (currentScrollY > lastScrollY + 2) {
      setStickyVisibility(false);
      setStickyVisibilitySidenavToggle(false);
    }
    else if (currentScrollY < lastScrollY - 2) {
      setStickyVisibility(true);
      setStickyVisibilitySidenavToggle(true);
    }
    lastScrollY = currentScrollY;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  });

  const observer = new MutationObserver(() => {
    ignoreNextScroll = true;
  });
  // Observe class changes on ylNavMenuContainer, to see if `.yl-nav-menu-container--open` is added/removed.
  // Set `ignoreNextScroll = true` if so, to prevent unwanted scroll events caused by toggling ylNavMenuToggle ('configure view' button).
  observer.observe(ylNavMenuContainer, { attributes: true, attributeFilter: ['class'] });
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