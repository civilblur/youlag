console.log('Global: 1');

window.app = window.app || {};

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