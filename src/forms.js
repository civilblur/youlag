/**
 * Forms
 * 
 * Handles form-related functionalities. Primarily used for the Youlag settings page.
 */


function settingsPageEventListeners() {

  function formValidation() {
    const settingsRoot = document.getElementById('yl-settings-root');
    if (!settingsRoot || settingsRoot.__ylSettingsInit) return;
    settingsRoot.__ylSettingsInit = true; // Track initialization to avoid multiple bindings.

    // Set "required" to Invidious URL input field if it's selected.
    const invidiousRadio = document.getElementById('yl_playback_invidious');
    const youtubeRadio = document.getElementById('yl_playback_youtube');
    const invidiousInput = document.getElementById('yl_invidious_url_1');
    if (invidiousRadio && youtubeRadio && invidiousInput) {
      function updateRequired() {
        if (invidiousRadio.checked) {
          invidiousInput.setAttribute('required', 'required');
        }
        else {
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
      // TODO: Refactor this once `Minz_HookType::JsVars` is implemented.
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

  formValidation(); // Run immediately, needed for direct link to the Youlag settings page.

  // Handle form validation where the Youlag settings is shown through the slider.
  const settingsSlider = document.getElementById('slider-content');
  if (getCurrentPage().name === 'extension' && settingsSlider) {
    let lastSettingsRoot = null;
    const observer = new MutationObserver(() => {
      if (!document.body.contains(settingsSlider)) {
        observer.disconnect();
        return;
      }
      const postDiv = settingsSlider.querySelector('div.post');
      if (postDiv) {
        const youlagSettingsRoot = postDiv.querySelector('#yl-settings-root');
        if (youlagSettingsRoot && youlagSettingsRoot !== lastSettingsRoot) {
          lastSettingsRoot = youlagSettingsRoot;
          formValidation();
        }
      }
    });
    observer.observe(settingsSlider, { childList: true, subtree: true });

    // Initial check
    const postDiv = settingsSlider.querySelector('div.post');
    if (postDiv) {
      const youlagSettingsRoot = postDiv.querySelector('#yl-settings-root');
      if (youlagSettingsRoot) {
        lastSettingsRoot = youlagSettingsRoot;
        formValidation();
      }
    }
  }

}

function setAddFeedCategoryValue() {
  // Auto-select category when adding a new feed, based on the last selected category.
  // Dependent on `updateAddFeedLink()` to add a custom param to the '+'-button ('Add new feed'-button).

  const page = getCurrentPage();
  const pathname = window.location.pathname;
  if (page && pathname === '/i/' && page.url.includes('c=subscription') && page.url.includes('a=add')) {

    const urlParams = new URLSearchParams(window.location.search);
    const categoryId = urlParams.get('yl_category_id');

    if (categoryId) {
      const categorySelect = document.querySelector('select#category');
      if (categorySelect) {
        categorySelect.value = categoryId;
        categorySelect.removeAttribute('data-leave-validation'); // Prevent confirmation prompt on exit.
      }
    }
  }

}