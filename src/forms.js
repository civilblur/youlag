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

  const videoLabelCheckbox = document.getElementById('yl_video_labels_enabled');
  if (videoLabelCheckbox) {
    // Do an initial check whether video label setting is enabled or not, as the 
    // DOM injected `data-yl-video-labels` is not available on the settings page.
    const videoLabelIsChecked = videoLabelCheckbox ? videoLabelCheckbox.checked : false;
    if (videoLabelIsChecked) {
      document.body.classList.add('youlag-video-labels');
      localStorage.setItem('youlagVideoLabels', 'true');
    }
    else {
      document.body.classList.remove('youlag-video-labels');
      localStorage.setItem('youlagVideoLabels', 'false');
    }
  }

}
