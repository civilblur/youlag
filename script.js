document.addEventListener('click', (event) => {
  // Check if the clicked element or any of its parents is `.flux_header` within `#stream .flux`
  if (event.target.closest('#stream .flux .flux_header')) {
    // Select all audio, video, and iframe elements on the page
    const mediaElements = document.querySelectorAll('audio, video, iframe');
    
    mediaElements.forEach(media => {
      // Pause audio and video if they are playing
      if ((media.tagName === 'AUDIO' || media.tagName === 'VIDEO') && !media.paused) {
        media.pause();
      }
      
      // Stop iframe videos
      if (media.tagName === 'IFRAME') {
        const src = media.src;
        media.src = '';
        media.src = src;
      }
    });
  }
});