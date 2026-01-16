console.log('Global: 1');

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
