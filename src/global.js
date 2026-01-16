window.app = window.app || {};

app.metadata = {
  version: 'X.Y.Z' // Assigned during build.
}

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
    modeMiniplayer: 'youlag-mode--miniplayer',
    modeFullscreen: 'youlag-mode--fullscreen',
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

app.state = {
  youlag: {
    init: false, // Whether the Youlag script has finished loading.
    navMenuInit: false, // The nav_menu displaying the feed view options.
    clickListenerInit: false,
    restoreVideoInit: false, // If mini player was restored after page refresh.
  },
  modal: {
    active: false, // Whether an article/video is currently active. Mini player does not count as active.
    mode: null, // 'fullscreen' || 'miniplayer' || null
    miniplayerScrollTop: 0, // Keep scroll position of miniplayer feed item when collapsing.
    youtubeId: null
  },
  page: {
    layout: null, // {'video' || 'article'}. Previously boolean "youlagActive" and "!youlagActive" (youlag inactive = article layout).
    titlePrev: null,
    navMenuSticky: true, // Use for temporarily disable the sticky transition title, e.g. when using programmatic scrolling.
  },
  popstate: {
    allowBack: true, // Prevent multiple history.back() triggers
    ignoreNext: false, // Prevent infinite popstate loop for modal
    added: false, // The popstate for video modal is only required to be added once to allow closing the modal via the back button.
    pathPrev: window.location.pathname + window.location.search // Track last non-hash URL to ignore popstate events that are only hash changes, e.g. `#dropdown-configure`, `#close`, etc.
  }
};