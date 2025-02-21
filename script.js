const modalContainerClassName = `youlag-theater-modal-container`;
const modalContentClassName = `youlag-theater-modal-container`;
const modalCloseIdName = `youlagCloseModal`;
const modalToggleFavoriteIdName = `youlagToggleFavorite`;

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
  createModalWithData(data);
}

function extractFeedItemData(feedItem) {
  // Extract data from the provided target element.
  return {
    author: feedItem.querySelector('.flux_header')?.getAttribute('data-article-authors') || '',
    favorite_toggle_url: feedItem.querySelector('a.item-element.bookmark')?.href || '',
    favorited: !feedItem.querySelector('.bookmark img[src*="non-starred"]'),
    thumbnail: feedItem.querySelector('.thumbnail img')?.src || '',
    title: feedItem.querySelector('.item-element.title')?.textContent.trim() || '',
    external_link: feedItem.querySelector('.item-element.title')?.href || '',
    date: feedItem.querySelector('.flux_content .date')?.textContent.trim() || '',
    video_embed_url: feedItem.querySelector('article.flux_content .text > iframe')?.getAttribute('data-original') || feedItem.querySelector('article iframe')?.getAttribute('src'),
    video_description:
      '<div>' +
        (feedItem.querySelector('.enclosure-description')?.innerHTML.trim() || '') +
      '</div>'
  };
}

function createModalWithData(data) {
  // Create custom modal
  let modal = document.getElementById('youlagTheaterModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'youlagTheaterModal';
    modal.style.cssText = `
      z-index: 99999;
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      width: 100vw;
      background: black;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: auto;
    `;
    modal.innerHTML = `<div class="${modalContainerClassName}" style="background: #fff; padding: 20px; max-width: 90%; box-sizing: border-box;"></div>`;
    document.body.appendChild(modal);
  }

  // Add content to modal
  const container = modal.querySelector(modalContainerClassName);
  container.innerHTML = `
    <div class="${modalContentClassName}">
      <h2>${data.title}</h2>
      <div>Author: ${data.author}</div>
      <div>Date: ${data.date}</div>
      <div>
        <a href="#" id="${modalToggleFavoriteIdName}">Toggle Favorite (Currently: ${data.favorited})</a>
      </div>
      <img src="${data.thumbnail}" style="max-width: 100%" />
      <div>
        <iframe style="height: 337px; width: 600px;" width="600" height="337" 
                src="${data.video_embed_url}" frameborder="0" allowfullscreen></iframe>
      </div>

      <a href="${data.external_link}" target="_blank">View on original site</a>
      <a href="${data.video_embed_url}" target="_blank">Embed URL</a>

      
      ${data.video_description}
      <button id="${modalCloseIdName}">Close</button>
    </div>
  `;
  container.querySelector(modalCloseIdName)?.addEventListener('click', closeModal);
  container.querySelector(modalToggleFavoriteIdName)?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleFavorite(data.favorite_toggle_url, container);
  });
}

function toggleFavorite(url, container) {
  fetch(url, { method: 'GET' })
    .then(response => {
      if (response.ok) {
        const favorited = container.querySelector(modalToggleFavoriteIdName).textContent.includes('true');
        container.querySelector(modalToggleFavoriteIdName).textContent = `Toggle Favorite (Currently: ${!favorited})`;
      } else {
        console.error('Failed to toggle favorite status');
      }
    })
    .catch(error => console.error('Error:', error));
}

function closeModal() {
  const modal = document.getElementById('youlagTheaterModal');
  if (modal) modal.remove();
}

function setupClickListener() {
  const streamContainer = document.querySelector('#stream');
  
  if (streamContainer) {
    streamContainer.addEventListener('click', (event) => {
      const target = event.target.closest('div[data-feed]');
      if (target) {
        handleActiveRssItem(event);
      }
    });
  }
}

function init() {
  setupClickListener();
  console.log('Custom Feed Script Loaded');
}


document.addEventListener('DOMContentLoaded', init);