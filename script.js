document.addEventListener('DOMContentLoaded', () => {
  const streamContainer = document.querySelector('#stream');
  
  if (streamContainer) {
    streamContainer.addEventListener('click', handleActiveRssItem);
  }

  // Check if the document has been loaded with an active RSS item
  const observer = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        const targetElement = document.querySelector('.flux.current.active .flux_header');
        if (targetElement) {
          handleActiveRssItem(targetElement);
          observer.disconnect(); // Stop observing once the targetElement is found
          break;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  // Initial check to see if an RSS item is opened before the script is loaded
  const initialTargetElement = document.querySelector('.flux.current.active .flux_header');
  if (initialTargetElement) {
    handleActiveRssItem(initialTargetElement);
    observer.disconnect();
  }
});

function handleActiveRssItem(targetElement) {
  if (targetElement instanceof Event) {
    targetElement = targetElement.target.closest('.flux.current.active .flux_header');
  }
  if (targetElement) {
    createCloseButton();
    preventBrowserBackNav();
  }
}

function createCloseButton() {
  // Create a close button for opened RSS item, to add custom logic for closing the item.
  const closeButton = document.createElement('div');
  closeButton.id = "rssItemCloseButton";
  closeButton.textContent = "×";
  closeButton.style.cssText = `
    position: fixed;
    top: 12px;
    right: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 2rem;
    line-height: 1;
    padding: 4px;
    box-sizing: border-box;
    width: 40px;
    height: 40px;
    color: white;
    border-radius: 50%;
    z-index: 999999;
    cursor: pointer;
    transition: background-color 0.3s;
  `;

  closeButton.addEventListener('mouseenter', () => {
    closeButton.style.backgroundColor = '#222222';
  });
  closeButton.addEventListener('mouseleave', () => {
    closeButton.style.backgroundColor = '';
  });

  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    closeRssItem();
    closeButton.remove();
  });

  document.body.appendChild(closeButton);
}

function preventBrowserBackNav() {
  /**
   * Push an "empty" state to history stack with popstate listener, which prevents going back
   * to the previous page when closing the rss item, as it's just a modal opposed to a new page.
   * 
   * Limitation: Back button navigates iframe history first if iframe is in focus.
   **/ 
  history.pushState({ rssModalState: true }, '', location.href);
  window.addEventListener('popstate', handleRssModalPopState);
}

function handleRssModalPopState(e) {
  // Only handle the popstate event if it is our custom state
  if (e.state && e.state.rssModalState) {
    closeRssItem();
    history.pushState({ rssModalState: true }, '', location.href);
  }
}

function closeRssItem() {
  const activeRssItem = document.querySelector('.flux.current.active');
  const mediaElements = document.querySelectorAll('.flux.current.active article audio, .flux.current.active article video, .flux.current.active article iframe');
  const rssItemCloseButton = document.querySelectorAll('#rssItemCloseButton'); // Using querySelectorAll for ensuring the button(s) is removed

  mediaElements.forEach(media => {
    // Pause audio and video elements on close
    if ((media.tagName === 'AUDIO' || media.tagName === 'VIDEO') && !media.paused) {
      media.pause();
    }
    
    // Unload inactive iframes.
    // FreshRSS will by default replace 'data-original' with 'src', when the rss item is active again. 
    if (media.tagName === 'IFRAME' && media.src) {
      media.setAttribute('data-original', media.src);
      media.removeAttribute('src');
    }
  });

  rssItemCloseButton.forEach(button => button.remove());

  if (activeRssItem) {
    activeRssItem.classList.remove('active', 'current');
  }

  window.removeEventListener('popstate', handleRssModalPopState);
}