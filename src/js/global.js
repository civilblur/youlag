/**
 * Global
 *
 * Stores global app state, metadata, breakpoints, and type definitions.
 */

window.app = window.app || {};

app.metadata = {
  version: "X.Y.Z", // Assigned during build.
};

app.db = {
  prefix: "yl", // Database name prefix, followed by the FreshRSS user.
  version: 1, // Bump when adding a store.
  stores: ["dearrow", "duration", "sponsorblock", "chapterSkip", "playback", "watchHistory", "syncQueue"],
  legacyStores: ["dearrow", "duration", "sponsorblock", "chapterSkip"], // Released as one database per store, 'youlag-cache-<store>'.
  branchStores: ["playback", "chapterSkip", "watchHistory", "syncQueue"], // Unreleased per-user layout, 'youlag-cache-<user>-<store>'.
};

app.sync = {
  stores: ["dearrow", "duration", "sponsorblock", "chapterSkip", "playback", "watchHistory"], // IndexedDB stores synced to the Youlag endpoint.
  videoStores: ["dearrow", "duration", "sponsorblock", "chapterSkip", "playback"], // Stores keyed by video ID, pulled for the videos on the page.
  emptyListStores: ["chapterSkip", "sponsorblock"], // An empty list here is only synced when it replaces a real one.
  queueStore: "syncQueue",
  flushDelayMs: 10000,
  batchSize: 200,
  batchMaxBytes: 512 * 1024, // FreshRSS reads at most 1 MB of a JSON body.
  valueMaxBytes: 16384, // Same limit as the endpoint.
  hideMaxBytes: 60 * 1024, // Keepalive requests share one 64 KB budget.
  playbackSaveIntervalSeconds: 10,
};

app.watchHistory = {
  url: "./?c=youlag&a=watchHistory",
  linkId: "yl_watch_history_link",
  clearId: "yl_watch_history_clear",
  settingsClearId: "yl_watch_history_clear_settings",
  removeClass: "yl-watch-history-remove",
};

app.watchProgress = {
  className: "yl-watch-progress",
  continueMin: 0.05, // "Continue watching" shows videos watched from 5%...
  continueMax: 0.9, // ...up to 90%.
  continueToggleId: "yl_watch_history_continue",
  hiddenClass: "yl-watch-history-hidden",
  clearDataId: "yl_video_data_clear",
};

app.state = {
  youlag: {
    init: false, // Whether the Youlag script has initialized.
    toolbarInit: false, // The toolbar (nav_menu) displaying the feed category title and view options.
    toolbarActiveMenu: null, // Currently active menu in the toolbar: 'viewOptions' || 'categoryFilter' || null
    clickListenerInit: false,
    restoreVideoInit: false, // If miniplayer was restored after page refresh.
    sliderListeners: null, // Store slider event listener.
    categoryFilterEntryCount: {}, // Type: `categoryFilterEntryCountType`. Number of entries for each category filter on the Watch later filter menu.
    experimentalFeatureEnabled: false, // Whether experimental features are enabled.
  },
  sync: {
    flushTimer: null,
    flushing: null, // Promise of the running flush.
    flushAgain: false, // Whether a flush was asked for during the running one.
    hideSent: false, // Whether the page-hide send ran since the page was last visible.
    migrated: null, // Promise of the one-time move of data from the old databases.
    unsent: new Map(), // Changes made on this page and not yet sent, by queue key. Sent on page hide without IndexedDB reads.
    pulled: new Map(), // Pull promises by video ID, for videos already pulled from the server on this page.
    playbackPositions: new Map(), // Type: `{ seconds, duration, finished? }` by video ID.
    positionsLoaded: null, // Promise of the saved positions loaded into memory at init.
    clockOffset: null, // Milliseconds to add to this device's clock to get the server's, see syncNow().
  },
  modal: {
    active: false, // Whether an article/video is currently active. Miniplayer does not count as active.
    activeType: null, // {'video' || 'article' || null}
    mode: null, // {'fullscreen' || 'miniplayer' || null}
    miniplayerScrollTop: 0, // Store scroll position of miniplayer before collapsing.
    youtubeId: null,
    nearEndThreshold: 3, // Seconds from end of video to considered "nearEnd", for autoplay logic.
  },
  page: {
    layout: null, // {'video' || 'article'}, null on non-feed pages. Previously boolean "youlagActive" and "!youlagActive" (youlag inactive = article layout).
    titlePrev: null,
    toolbarSticky: false, // true: forced sticky. false: disable dynamic behavior of show/hide on scroll. Use for temporarily disabling the sticky toolbar (nav_menu), e.g. when using programmatic scrolling.
    sidebarExpanded: false, // Sidebar expanded and collapsed state also reflected in `body.yl-sidenav--{collapsed | expanded}`.
  },
  popstate: {
    allowBack: true, // Prevent multiple history.back() triggers.
    ignoreNext: false, // Prevent infinite popstate loop for modal.
    added: false, // The popstate for video modal is only required to be added once, to allow closing the modal via the back button.
    pathPrev: window.location.pathname + window.location.search, // Track last non-hash URL to ignore popstate events that are only hash changes, e.g. `#dropdown-configure`, `#close`, etc.
  },
};

app.breakpoints = {
  mobile_sm_max: 600,
  mobile_max: 840,
  desktop_min: 841,
  desktop_md_max: 960,
};

app.modal = {
  id: {
    // TODO: Unify formatting for id and class names

    root: "ylTheaterModal",
    close: "ylCloseModal",
    minimize: "ylMinimizeModal",
    videoIframe: "ylVideoIframe",
    source: "ylVideoSource",
    sourceDefault: "ylVideoSourceDefault",
    favorite: "ylToggleFavorite",
    tags: "ylTagsManage",
    tagsContainer: "ylTagsModal",
    tagsClose: "yl-tags-modal-close",
    share: "ylShareManage",
    shareContainer: "ylShareModal",
    shareClose: "yl-share-modal-close",
    chapterContainer: "ylVideoChaptersContainer",
    chapterPanel: "ylVideoChaptersPanel",
    chapterActionContainer: "ylVideoChaptersActionContainer",
    chapterActionPrevious: "ylVideoChaptersActionPrevious",
    chapterActionNext: "ylVideoChaptersActionNext",
    chapterList: "ylVideoChapterList",
    chapterEdit: "ylVideoChapterEdit",
    sponsorBlockAction: "ylVideoSponsorBlockAction",
    chapterCurrentProgress: "ylVideoChapterCurrentProgress",
    chapterCurrent: "ylVideoChapterCurrent",
    moreContainer: "ylVideoMoreContentContainer",
    relatedContainer: "ylRelatedVideosContainer",
    splitPaneContent: "ylArticleSplitPane",
  },
  class: {
    typeArticle: "yl-modal-feed-item--text",
    modeMiniplayer: "yl-mode--miniplayer",
    modeFullscreen: "yl-mode--fullscreen",
    container: "yl-theater-modal-container",
    content: "yl-theater-modal-content",
    descContainer: "yl-video-description-container",
    descContainerCollapsed: "yl-video-description-container--collapsed",
    descParagraph1: "yl-video-description-content__paragraph-1",
    descParagraph2: "yl-video-description-content__paragraph-2",
    descParagraph3: "yl-video-description-content__paragraph-3",
    relatedVideoEntryHTML: "yl-related-video-item__feed-item-container", // Contains original feed entry HTML for related video item, used for parsing when opening a related video.
    relatedVideoEntry: "yl-related-video-item",
    tagsModalRoot: "yl-tags-modal",
    tagsModalItem: "yl-tags-list-item",
    tagsModalOpen: "yl-tags-modal-open",
    tagsModalContent: "yl-tags-content",
    shareModalRoot: "yl-share-modal",
    shareModalItem: "yl-share-list-item",
    shareModalOpen: "yl-share-modal-open",
    shareModalContent: "yl-share-content",
    chapterList: "yl-video-chapter-list",
    iframe: "yl-iframe",
    iframeContainer: "yl-iframe-container",
    favorite: "yl-favorited",
    favoriteIcon: "yl-favorited-icon",
  },
  queue: {
    queue: null,
    activeIndex: -1,
    localStorageKey: "youlagVideoQueue",
  },
};

app.ui = {
  id: {
    toolbar: "yl_category_toolbar",
  },
};

app.frss = {
  // FreshRSS selectors
  id: {
    logo: "yl_freshrss_logo_container",
    logoImg: "yl_freshrss_logo",
  },
  el: {
    feedRoot: "#stream",
    current: "#stream div[data-entry].active.current", // Currently opened feed entry in the stream.
    entry: "div[data-entry]", // Feed entry element in the stream.
    global: "#global",
    sidebar: "#aside_feed",
    articleNav: "#nav_entries",
    bookmark: "a.item-element.bookmark", // Feed entry favorite link.
  },
  class: {
    favorite: "favorite", // Favorited feed entry.
  },
  img: {
    spinner: "../themes/icons/spinner.svg",
    favoriteInactive: "../themes/Mapco/icons/non-starred.svg",
    favoriteActive: "../themes/Mapco/icons/starred.svg",
    chevronDown: "../themes/Mapco/icons/down.svg",
  },
  urlPrefix: "", // Assigned during init.
};

app.types = {
  // Workaround for lack of typescript in vanilla js.

  // Category filter entry count type for `categoryFilterEntryCount`. c_{n}, where n is category ID.
  categoryFilterEntryCountType: {
    c_1: { count: 0 },
  },

  videoObject: {
    entryId: null,
    author: "",
    authorId: "",
    author_filter_url: "",
    website_name: "",
    favicon: "",
    favorite_toggle_url: "",
    favorited: false,
    thumbnail: "",
    thumbnail_video: "",
    thumbnail_video_screencap: "",
    title: "",
    external_link: "",
    date: "",
    date_iso: "", // e.g. "2000-01-20T10:00:00+02:00".
    isVideoFeedItem: false,
    youtubeId: "",
    youtube_embed_url: "",
    video_embed_url: "",
    video_invidious_instance_1: "",
    video_source_default: "youtube",
    video_description: '<div class="yl-video-description-content"></div>',
    video_chapters: [{}],
    video_youtube_url: "",
    video_invidious_redirect_url: "",
    // Video queue
    queue: null,
    queue_active_index: -1,
    playbackTime: 0, // In seconds
    playerState: "paused", // 'playing' | 'paused'
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
    name: "",
    class: "",
    id: "",
    url: "",
    urlPath: "",
    parentId: "", // Parent id if applicable, e.g. for f_{n} (sub-page of category), t_{n} (playlist sub-page).
  },
};
