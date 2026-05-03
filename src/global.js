/**
 * Global
 * 
 * Stores global app state, metadata, breakpoints, and type definitions.
 */


window.app = window.app || {};

app.metadata = {
  version: 'X.Y.Z' // Assigned during build.
}

app.db = {
  name: 'youlag-cache'  // IndexedDB database name
}

app.state = {
  youlag: {
    init: false,                // Whether the Youlag script has initialized.
    toolbarInit: false,         // The toolbar (nav_menu) displaying the feed category title and view options.
    toolbarActiveMenu: null,    // Currently active menu in the toolbar: 'viewOptions' || 'categoryFilter' || null
    toolbarIgnoreScroll: false, // Suppress toolbar sticky reaction (show/hide) during programmatic scrolls.
    clickListenerInit: false,
    restoreVideoInit: false,    // If miniplayer was restored after page refresh.
    sliderListeners: null,      // Store slider event listener.
    categoryFilterEntryCount: {},   // Type: `categoryFilterEntryCountType`. Number of entries for each category filter on the Watch later filter menu.
    experimentalFeatureEnabled: false, // Whether experimental features are enabled.
  },
  modal: {
    active: false,              // Whether an article/video is currently active. Miniplayer does not count as active.
    activeType: null,           // {'video' || 'article' || null}
    mode: null,                 // {'fullscreen' || 'miniplayer' || null}
    miniplayerScrollTop: 0,     // Store scroll position of miniplayer before collapsing.
    youtubeId: null,
    chapterLastActiveIndex: -1, // Current modal's video chapter last active index.
    nearEndThreshold: 3,        // Seconds from end of video to considered "nearEnd", for autoplay logic.
  },
  page: {
    layout: null,               // {'video' || 'article'}. Previously boolean "youlagActive" and "!youlagActive" (youlag inactive = article layout).
    titlePrev: null,
    toolbarSticky: false,       // true: forced sticky. false: dynamic, based on scroll. Use for temporarily disabling the sticky toolbar (nav_menu), e.g. when using programmatic scrolling.
    sidebarExpanded: false,     // Sidebar expanded and collapsed state also reflected in `body.youlag-sidenav--{collapsed | expanded}`.
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
    videoIframe: 'ylVideoIframe',
    source: 'youlagVideoSource',
    sourceDefault: 'youlagVideoSourceDefault',
    favorite: 'youlagToggleFavorite',
    tags: 'youlagTagsManage',
    tagsContainer: 'youlagTagsModal',
    tagsClose: 'yl-tags-modal-close',
    chapterContainer: 'ylVideoChaptersContainer',
    chapterPanel: 'ylVideoChaptersPanel',
    chapterActionContainer: 'ylVideoChaptersActionContainer',
    chapterActionPrevious: 'ylVideoChaptersActionPrevious',
    chapterActionNext: 'ylVideoChaptersActionNext',
    chapterList: 'ylVideoChapterList',
    chapterCurrentProgress: 'ylVideoChapterCurrentProgress',
    chapterCurrent: 'ylVideoChapterCurrent',
    moreContainer: 'youlagVideoMoreContentContainer',
    relatedContainer: 'youlagRelatedVideosContainer',
    splitPaneContent: 'ylArticleSplitPane',
  },
  class: {
    typeArticle: 'youlag-modal-feed-item--text',
    modeMiniplayer: 'youlag-mode--miniplayer',
    modeFullscreen: 'youlag-mode--fullscreen',
    container: 'youlag-theater-modal-container',
    content: 'youlag-theater-modal-content',
    descContainer: 'youlag-video-description-container',
    descContainerCollapsed: 'youlag-video-description-container--collapsed',
    descParagraph1: 'youlag-video-description-content__paragraph-1',
    descParagraph2: 'youlag-video-description-content__paragraph-2',
    relatedVideoEntryHTML: 'youlag-related-video-item__feed-item-container', // Contains original feed entry HTML for related video item, used for parsing when opening a related video.
    relatedVideoEntry: 'youlag-related-video-item',
    tagsModalRoot: 'youlag-tags-modal',
    tagsModalItem: 'yl-tags-list-item',
    tagsModalOpen: 'youlag-tags-modal-open',
    tagsModalContent: 'yl-tags-content',
    chapterList: 'yl-video-chapter-list',
    iframe: 'youlag-iframe',
    iframeContainer: 'youlag-iframe-container',
    favorite: 'youlag-favorited',
    favoriteIcon: 'youlag-favorited-icon',
  },
  queue: {
    queue: null,
    activeIndex: -1,
    localStorageKey: 'youlagVideoQueue'
  }
};

app.ui = {
  id: {
    toolbar: 'yl_category_toolbar',
  }
}

app.frss = {
  // FreshRSS selectors
  id: {
    logo: 'yl_freshrss_logo_container',
    logoImg: 'yl_freshrss_logo',   
  },
  el: {
    feedRoot: '#stream',
    current: '#stream div[data-entry].active.current',    // Currently opened feed entry in the stream.
    entry: 'div[data-entry]',                             // Feed entry element in the stream.
    global: '#global',
    sidebar: '#aside_feed',   
    articleNav: '#nav_entries',                                
  },
  img: {
    spinner: '../themes/icons/spinner.svg',
    favoriteInactive: '../themes/Mapco/icons/non-starred.svg',
    favoriteActive: '../themes/Mapco/icons/starred.svg',
    chevronDown: '../themes/Mapco/icons/down.svg',
  },
  urlPrefix: '', // Assigned during init.
}

app.types = {
  // Workaround for lack of typescript in vanilla js.

  // Category filter entry count type for `categoryFilterEntryCount`. c_{n}, where n is category ID.
  categoryFilterEntryCountType: {
    c_1: { count: 0 },
  },

  videoObject: {
    entryId: null,
    author: '',
    authorId: '',
    author_filter_url: '',
    website_name: '',
    favicon: '',
    favorite_toggle_url: '',
    favorited: false,
    thumbnail: '',
    thumbnail_video: '',
    thumbnail_video_screencap: '',
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
    video_chapters: [{}],
    video_youtube_url: '',
    video_invidious_redirect_url: '',
    // Video queue
    queue: null,
    queue_active_index: -1,
    playbackTime: 0, // In seconds
    playerState: 'paused', // 'playing' | 'paused'
    videoDuration: 0, // Total length in seconds
    autoplay: 1, // 1: autoplay, 0: no autoplay
  },

  videoChapter: {
    timestamp: "00:00",
    seconds: 0,
    label: "",
    order: 1,
  },

  pageObject: {
    name: '',
    class: '',
    id: '',
    url: '',
    urlPath: '',
    parentId: '', // Parent id if applicable, e.g. for f_{n} (sub-page of category), t_{n} (playlist sub-page).
  }
};

