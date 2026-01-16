window.app = window.app || {};

app.state = {
  // TODO
};

app.breakpoints = {
  mobile_sm_max: 600,
  mobile_max: 840,
  desktop_min: 841,
  desktop_md_max: 960,
}

app.modal = {
  id: {
    root: 'youlagTheaterModal',
    close: 'youlagCloseModal',
    minimize: 'youlagMinimizeModal',
    source: 'youlagVideoSource',
    sourceDefault: 'youlagVideoSourceDefault',
    favorite: 'youlagToggleFavorite',
    tags: 'youlagTagsManage',
    tagsContainer: 'youlagTagsModal',
    moreContainer: 'youlagVideoMoreContentContainer',
    relatedContainer: 'youlagRelatedVideosContainer'
  },
  class: {
    container: 'youlag-theater-modal-container',
    content: 'youlag-theater-modal-content',
    favorite: 'youlag-favorited'
  }
};

app.types = {
  videoObject: {
    entryId: null,
    author: '',
    author_filter_url: '',
    website_name: '',
    favicon: '',
    favorite_toggle_url: '',
    favorited: false,
    thumbnail: '',
    title: '',
    external_link: '',
    date: '',
    isVideoFeedItem: false,
    youtubeId: '',
    youtube_embed_url: '',
    video_embed_url: '',
    video_invidious_instance_1: '',
    video_source_default: 'youtube',
    video_description: '<div class="youlag-video-description-content"></div>',
    video_youtube_url: '',
    video_invidious_redirect_url: ''
  }
};

app.metadata = {
  version: 'X.Y.Z' // Assigned during build.
}

let youlagModalNavigatingBack = false; // Prevent multiple history.back() triggers
let youlagModalPopstateIgnoreNext = false; // Prevent infinite popstate loop for modal
let youladModalPopstateAdded = false; // The popstate for video modal is only required to be added once to allow closing the modal via the back button. 
let youlagScriptLoaded = false;
let youlagNavMenuInitialized = false;
let youlagClickListenersInitialized = false;
let youlagRestoreVideoQueueRan = false;
let youlagActive = true; // Whether Youlag is active on this page based on user category whitelist setting.
let youtubeExtensionInstalled = false; // Parse content differently in case user has the FreshRSS "YouTube Video Feed" extension enabled.
let disableStickyTransitionTitle = false; // Use for temporarily disable the sticky transition title, e.g. when using programmatic scrolling.
let lastPathnameSearch = window.location.pathname + window.location.search; // Track last non-hash URL to ignore popstate events that are only hash changes, e.g. `#dropdown-configure`, `#close`, etc.
let youtubeId;
let previousPageTitle = null;
let previousFeedItemScrollTop = 0; // Keep scroll position of pip-mode feed item when collapsing.
let modePip = false;
let modeFullscreen = true;
let feedItemActive = false; // Whether an article/video is currently active. Pip mode does not count as active.
