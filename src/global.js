window.app = window.app || {};

app.metadata = {
  version: 'X.Y.Z' // Assigned during build.
}

app.state = {
  youlag: {
    init: false,                // Whether the Youlag script has initialized.
    toolbarInit: false,         // The toolbar (nav_menu) displaying the feed category title and view options.
    clickListenerInit: false,
    restoreVideoInit: false,    // If miniplayer was restored after page refresh.
  },
  modal: {
    active: false,              // Whether an article/video is currently active. Miniplayer does not count as active.
    activeType: null,           // {'video' || 'article' || null}
    mode: null,                 // {'fullscreen' || 'miniplayer' || null}
    miniplayerScrollTop: 0,     // Store scroll position of miniplayer before collapsing.
    youtubeId: null
  },
  page: {
    layout: null,               // {'video' || 'article'}. Previously boolean "youlagActive" and "!youlagActive" (youlag inactive = article layout).
    titlePrev: null,
    toolbarSticky: true,        // Use for temporarily disabling the sticky toolbar (nav_menu), e.g. when using programmatic scrolling.
  },
  popstate: {
    allowBack: true,            // Prevent multiple history.back() triggers.
    ignoreNext: false,          // Prevent infinite popstate loop for modal.
    added: false,               // The popstate for video modal is only required to be added once, to allow closing the modal via the back button.
    pathPrev: window.location.pathname + window.location.search // Track last non-hash URL to ignore popstate events that are only hash changes, e.g. `#dropdown-configure`, `#close`, etc.
  }
};

app.breakpoints = {
  mobile_sm_max: 600,
  mobile_max: 840,
  desktop_min: 841,
  desktop_md_max: 960,
}

app.modal = {
  id: {
    // TODO: Unify formatting for id and class names
    root: 'youlagTheaterModal',
    close: 'youlagCloseModal',
    minimize: 'youlagMinimizeModal',
    source: 'youlagVideoSource',
    sourceDefault: 'youlagVideoSourceDefault',
    favorite: 'youlagToggleFavorite',
    tags: 'youlagTagsManage',
    tagsContainer: 'youlagTagsModal',
    tagsClose: 'yl-tags-modal-close',
    moreContainer: 'youlagVideoMoreContentContainer',
    relatedContainer: 'youlagRelatedVideosContainer',
    toolbar: 'yl_category_toolbar', // TODO: Not in modal, create new object for generic 'page'
  },
  class: {
    typeArticle: 'youlag-modal-feed-item--text',
    modeMiniplayer: 'youlag-mode--miniplayer',
    modeFullscreen: 'youlag-mode--fullscreen',
    container: 'youlag-theater-modal-container',
    content: 'youlag-theater-modal-content',
    descContainer: 'youlag-video-description-container',
    descContainerCollapsed: 'youlag-video-description-container--collapsed',
    tagsModalRoot: 'youlag-tags-modal',
    tagsModalItem: 'yl-tags-list-item',
    tagsModalOpen: 'youlag-tags-modal-open',
    tagsModalContent: 'yl-tags-content',
    iframe: 'youlag-iframe',
    iframeContainer: 'youlag-iframe-container',
    favorite: 'youlag-favorited',
  },
  queue: {
    queue: null,
    activeIndex: -1,
    localStorageKey: 'youlagVideoQueue'
  }
};

app.frss = {
  // FreshRSS selectors
  el: {
    feedRoot: '#stream',
    current: '#stream div[data-entry].active.current', // Currently opened feed entry in the stream.
    entry: 'div[data-entry]', // Feed entries general selector.
  }
}

app.types = {
  // Workaround for lack of typescript in vanilla js.

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
    video_invidious_redirect_url: '',
    // Video queue
    queue: null,
    queue_active_index: -1
  }
};

