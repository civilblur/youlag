<?php

class YoulagExtension extends Minz_Extension
{
  /**
   * Stores the user's selected category whitelist for UI use.
   * @var array
   */
  protected $yl_category_whitelist = ['all'];
  /**
   * Set related videos suggestion source
   * @var string
   */
  public $yl_related_videos = 'watch_later';
  /**
   * Set two-column grid layout on viewport width ≤ 600px.
   * @var bool
   */
  public $yl_feed_view_mobile_grid_enabled = false;
  /**
   * Set feed thumbnails to be screencaps of the video instead of the default thumbnail provided by the rss feed.
   * @var bool
   */
  public $yl_custom_thumbnail_title_enabled = false;
  /**
   * Experimental feature: Enable filtering entries by category on Watch later page.
   * @var bool
   */
  public $yl_watch_later_category_filter_enabled = false;
  /**
   * Enable swipe-to-miniplayer by default
   * @var bool
   */
  public $yl_miniplayer_swipe_enabled = true;
  /**
   * Enable chapter progress indicator in video player
   * @var bool
   */
  public $yl_chapter_progress_enabled = true;
  /**
   * Hide first intro of video descriptions if links are present
   * @var bool
   */
  public $yl_description_hide_intro_enabled = false;
  /**
   * Use video platform labels (Favorite → Watch later, Tags → Playlists)
   * @var bool
   */
  public $yl_video_labels_enabled = true;
  /**
   * Whether to use Invidious for playback
   * @var bool
   */
  private $yl_invidious_enabled = false;
  /**
   * Invidious instance to use
   * @var string
   */
  protected $instance = '';
  /**
   * Show "New" badge for unwatched videos
   * @var bool
   */
  public $yl_video_unread_badge_enabled = false;
  /**
   * Enable sorting by modified date for Watch later/Playlists
   * @var bool
   */
  public $yl_video_sort_modified_enabled = false;

  /**
   * Enable Youlag update check
   * @var bool
   */
  public $yl_update_check_enabled = true;

  /**
   * Enable auto-detection of video feeds
   * @var bool
   */
  public $yl_auto_detect_video_feeds = true;

  protected array $csp_policies = [
    'connect-src' => "'self' https://sponsor.ajay.app/ https://api.github.com/",
  ];

  /**
   * Initialize this extension
   */
  public function init(): void
  {
    // TODO: Refactor to pass data with `Minz_HookType::JsVars` instead.
    $this->registerHook('entry_before_display', array($this, 'setInvidiousURL'));
    $this->registerHook('nav_entries', array($this, 'createFreshRssLogo'), 6);
    $this->registerHook('nav_entries', array($this, 'createCategoryTitle'), 7);
    $this->registerHook('nav_entries', array($this, 'setCategoryWhitelist'), 10);
    $this->registerHook('nav_entries', array($this, 'setVideoLabels'), 11);
    $this->registerHook('nav_entries', array($this, 'setVideoUnreadBadge'), 12);
    $this->registerHook('nav_entries', array($this, 'setMiniplayerSwipeEnabled'), 13);
    $this->registerHook('nav_entries', array($this, 'setChapterProgressEnabled'), 15);
    $this->registerHook('nav_entries', array($this, 'setDescriptionHideIntroEnabled'), 16);
    $this->registerHook('nav_entries', array($this, 'setVideoSortModifiedEnabled'), 17);
    $this->registerHook('nav_entries', array($this, 'setRelatedVideosSource'), 18);
    $this->registerHook('nav_entries', array($this, 'setFeedViewLayoutMobileGrid'), 19);
    $this->registerHook('nav_entries', array($this, 'setFeedThumbnailScreencapEnabled'), 20);
    $this->registerHook('nav_entries', array($this, 'setWatchLaterCategoryFilterEnabled'), 21);
    $this->registerHook('nav_entries', array($this, 'setUpdateCheckEnabled'), 22);
    $this->registerHook('nav_entries', array($this, 'setBaseUrl'), 23);
    if (Minz_Request::paramString('get', '') === 's') {
      // Watch later page: add category filter
      $this->registerHook('nav_entries', array($this, 'createWatchLaterCategoryFilter'), 23);
    }

    // Add Youlag theme and script to all extension pages
    Minz_View::appendStyle($this->getFileUrl('theme.min.css'));
    Minz_View::appendScript($this->getFileUrl('script.min.js'));

    // Required user settings to properly render Youlag styling
    // See FreshRSS `config-user.php` and the html form fields with `for="{setting_name}"` in settings for reference. This is not in the official documentation.
    // FreshRSS_Context::userConf()->theme = 'Mapco'; // Removed: allow user to choose their own FreshRSS theme
    FreshRSS_Context::userConf()->topline_website = 'full';
    FreshRSS_Context::userConf()->topline_thumbnail = 'landscape';
    FreshRSS_Context::userConf()->topline_summary = true;
    FreshRSS_Context::userConf()->topline_date = true;
    FreshRSS_Context::userConf()->sticky_post = false; // Option to auto-scroll to article top. Youlag handles this itself for articles. Videos should not auto scroll.
    FreshRSS_Context::userConf()->show_feed_name = 'a';
    FreshRSS_Context::userConf()->show_author_date = 'h';
    FreshRSS_Context::userConf()->show_tags = 'f';

    // Register hook to block incoming YouTube shorts
    $this->registerHook('entry_before_insert', [$this, 'blockYoutubeShorts']);
  }

  /**
   * Initializes the extension configuration, if the user context is available.
   * Do not call that in your extensions init() method, it can't be used there.
   */
  public function loadConfigValues(): void
  {
    if (!class_exists(class: 'FreshRSS_Context', autoload: false) || null === FreshRSS_Context::$user_conf) {
      return;
    }

    $yl_related_videos = FreshRSS_Context::userConf()->attributeString('yl_related_videos');
    if ($yl_related_videos !== null) {
      $this->yl_related_videos = $yl_related_videos;
    }

    $yl_invidious_enabled = FreshRSS_Context::userConf()->attributeBool('yl_invidious_enabled');
    if ($yl_invidious_enabled !== null) {
      $this->yl_invidious_enabled = $yl_invidious_enabled;
    }

    if (FreshRSS_Context::$user_conf->yl_invidious_url_1 != '') {
      $this->instance = FreshRSS_Context::$user_conf->yl_invidious_url_1;
    }

    $val = FreshRSS_Context::userConf()->attributeArray('yl_category_whitelist');
    $attributes = is_array(value: FreshRSS_Context::$user_conf->_attributes) ? FreshRSS_Context::$user_conf->_attributes : [];
    // Default video mode to ['all'] when Youlag is activated for the first time.
    if (!is_array(value: $val) || (is_array(value: $val) && count(value: $val) === 0 && !array_key_exists(key: 'yl_category_whitelist', array: $attributes))) {
      $this->yl_category_whitelist = ['all'];
    }
    else {
      $this->yl_category_whitelist = $val;
    }

    $miniplayerSwipeEnabled = FreshRSS_Context::userConf()->attributeBool('yl_miniplayer_swipe_enabled');
    $this->yl_miniplayer_swipe_enabled = ($miniplayerSwipeEnabled === null) ? true : $miniplayerSwipeEnabled;

    $chapterProgressEnabled = FreshRSS_Context::userConf()->attributeBool('yl_chapter_progress_enabled');
    $this->yl_chapter_progress_enabled = ($chapterProgressEnabled === null) ? true : $chapterProgressEnabled;

    $descriptionHideIntroEnabled = FreshRSS_Context::userConf()->attributeBool('yl_description_hide_intro_enabled');
    $this->yl_description_hide_intro_enabled = ($descriptionHideIntroEnabled === null) ? false : $descriptionHideIntroEnabled;

    $feedViewMobileGridEnabled = FreshRSS_Context::userConf()->attributeBool('yl_feed_view_mobile_grid_enabled');
    $this->yl_feed_view_mobile_grid_enabled = ($feedViewMobileGridEnabled === null) ? false : $feedViewMobileGridEnabled;

    $feedThumbnailScreencapEnabled = FreshRSS_Context::userConf()->attributeBool('yl_custom_thumbnail_title_enabled');
    $this->yl_custom_thumbnail_title_enabled = ($feedThumbnailScreencapEnabled === null) ? false : $feedThumbnailScreencapEnabled;

    $watchLaterCategoryFilterEnabled = FreshRSS_Context::userConf()->attributeBool('yl_watch_later_category_filter_enabled');
    $this->yl_watch_later_category_filter_enabled = ($watchLaterCategoryFilterEnabled === null) ? false : $watchLaterCategoryFilterEnabled;

    $labelsEnabled = FreshRSS_Context::userConf()->attributeBool('yl_video_labels_enabled');
    $this->yl_video_labels_enabled = ($labelsEnabled === null) ? true : $labelsEnabled;

    $unreadBadgeEnabled = FreshRSS_Context::userConf()->attributeBool('yl_video_unread_badge_enabled');
    $this->yl_video_unread_badge_enabled = ($unreadBadgeEnabled === null) ? false : $unreadBadgeEnabled;

    $sortModifiedEnabled = FreshRSS_Context::userConf()->attributeBool('yl_video_sort_modified_enabled');
    $this->yl_video_sort_modified_enabled = ($sortModifiedEnabled === null) ? false : $sortModifiedEnabled;

    $updateCheckEnabled = FreshRSS_Context::userConf()->attributeBool('yl_update_check_enabled');
    $this->yl_update_check_enabled = ($updateCheckEnabled === null) ? true : $updateCheckEnabled;

    $autoDetectVideoFeeds = FreshRSS_Context::userConf()->attributeBool('yl_auto_detect_video_feeds');
    $this->yl_auto_detect_video_feeds = ($autoDetectVideoFeeds === null) ? true : $autoDetectVideoFeeds;
  }

  /**
   * Returns the stored category whitelist for UI (after loadConfigValues()).
   * @return array
   */
  public function getCategoryWhitelist(): array
  {
    return $this->yl_category_whitelist;
  }

  /**
   * Pass the category whitelist data to be read in the DOM via nav_entries hook.
   * The frontend js handles the behavior based on this the value in `data-yl-category-whitelist`.
   * @return string
   */
  public function setCategoryWhitelist(): string
  {
    $whitelist = FreshRSS_Context::userConf()->attributeArray('yl_category_whitelist');
    $dataAttr = '';
    if (!empty($whitelist)) {
      $dataAttr = ' data-yl-category-whitelist="' . htmlspecialchars(string: implode(separator: ', ', array: $whitelist)) . '"';
    }

    // Auto-detect if current feed is a YouTube/video feed
    $isVideoFeed = 'false';
    if ($this->yl_auto_detect_video_feeds && class_exists(class: 'FreshRSS_Context', autoload: false) && isset(FreshRSS_Context::$feed)) {
      $feedUrl = FreshRSS_Context::$feed->url();
      if (preg_match('#youtube\.com|youtu\.be|invidious|piped#i', $feedUrl)) {
        $isVideoFeed = 'true';
      }
    }
    $dataAttr .= ' data-yl-is-video-feed="' . $isVideoFeed . '"';

    return '<div id="yl_category_whitelist"' . $dataAttr . '></div>';
  }

  /**
   * Pass the related videos source to be read in the DOM via nav_entries hook.
   * The frontend js handles the behavior based on this the value in `data-yl-related-videos-source`.
   * @return string
   */
  public function setRelatedVideosSource(): string
  {
    $source = htmlspecialchars(string: $this->yl_related_videos, flags: ENT_QUOTES);
    return '<div id="yl_related_videos_source" data-yl-related-videos-source="' . $source . '"></div>';
  }

  /**
   * Pass the mobile grid layout setting to be read in the DOM via nav_entries hook.
   * The frontend js handles the behavior based on this the value in `data-yl-feed-view-mobile-grid-enabled`.
   * @return string
   */
  public function setFeedViewLayoutMobileGrid(): string
  {
    $enabled = $this->yl_feed_view_mobile_grid_enabled ? 'true' : 'false';
    return '<div id="yl_feed_view_mobile_grid_enabled" data-yl-feed-view-mobile-grid-enabled="' . $enabled . '"></div>';
  }

  /**
   * Pass the feed thumbnail screencap setting to be read in the DOM via nav_entries hook.
   * The frontend js handles the behavior based on this the value in `data-yl-custom-thumbnail-title-enabled`.
   * @return string
   */
  public function setFeedThumbnailScreencapEnabled(): string
  {
    $enabled = $this->yl_custom_thumbnail_title_enabled ? 'true' : 'false';
    return '<div id="yl_custom_thumbnail_title_enabled" data-yl-custom-thumbnail-title-enabled="' . $enabled . '"></div>';
  }

  /**
   * Pass the Watch later category filter setting to be read in the DOM via nav_entries hook.
   * The frontend js handles the behavior based on this the value in `data-yl-watch-later-category-filter-enabled`.
   * @return string
   */
  public function setWatchLaterCategoryFilterEnabled(): string
  {
    $enabled = $this->yl_watch_later_category_filter_enabled ? 'true' : 'false';
    return '<div id="yl_watch_later_category_filter_enabled" data-yl-watch-later-category-filter-enabled="' . $enabled . '"></div>';
  }

  /**
   * Pass the mini player swipe setting to be read in the DOM via nav_entries hook.
   * The frontend js handles the behavior based on this the value in `data-yl-miniplayer-swipe-enabled`.
   * @return string
   */
  public function setMiniplayerSwipeEnabled(): string
  {
    $enabled = $this->yl_miniplayer_swipe_enabled ? 'true' : 'false';
    return '<div id="yl_miniplayer_swipe_enabled" data-yl-miniplayer-swipe-enabled="' . $enabled . '"></div>';
  }

  public function setChapterProgressEnabled(): string
  {
    $enabled = $this->yl_chapter_progress_enabled ? 'true' : 'false';
    return '<div id="yl_chapter_progress_enabled" data-yl-chapter-progress-enabled="' . $enabled . '"></div>';
  }

  public function setDescriptionHideIntroEnabled(): string
  {
    $enabled = $this->yl_description_hide_intro_enabled ? 'true' : 'false';
    return '<div id="yl_description_hide_intro_enabled" data-yl-description-hide-intro-enabled="' . $enabled . '"></div>';
  }

  /**
   * Returns whether video platform labels is enabled or not.
   * @return bool
   */
  public function isVideoLabelsEnabled(): bool
  {
    return $this->yl_video_labels_enabled;
  }

  /**
   * Pass the video platform labels state to be read in the DOM via nav_entries hook.
   * The frontend js handles the behavior based on this the value in `data-yl-video-labels`.
   * @param bool $enabled
   */
  public function setVideoLabels(): string
  {
    $enabled = $this->yl_video_labels_enabled ? 'true' : 'false';
    return '<div id="yl_video_labels" data-yl-video-labels="' . $enabled . '"></div>';
  }

  /**
   * Pass the "New" badge setting for unwatched videos state to be read in the DOM via nav_entries hook.
   * The frontend js handles the behavior based on this the value in `data-yl-video-unread-badge`.
   * @param bool $enabled
   */
  public function setVideoUnreadBadge(): string
  {
    $enabled = $this->yl_video_unread_badge_enabled ? 'true' : 'false';
    return '<div id="yl_video_unread_badge" data-yl-video-unread-badge="' . $enabled . '"></div>';
  }

  /**
   * Pass the sort modified setting to be read in the DOM via nav_entries hook.
   * The frontend js handles the behavior based on this the value in `data-yl-video-sort-modified`.
   */
  public function setVideoSortModifiedEnabled(): string
  {
    $enabled = $this->yl_video_sort_modified_enabled ? 'true' : 'false';
    return '<div id="yl_video_sort_modified" data-yl-video-sort-modified="' . $enabled . '"></div>';
  }

  /**
   * Pass the Youlag update check setting to be read in the DOM via nav_entries hook.
   * The frontend js handles the behavior based on this the value in `data-yl-update-check-enabled`.
   * @return string
   */
  public function setUpdateCheckEnabled(): string
  {
    $enabled = $this->yl_update_check_enabled ? 'true' : 'false';
    return '<div id="yl_update_check_enabled" data-yl-update-check-enabled="' . $enabled . '"></div>';
  }

  /**
    * Pass the FreshRSS installation base URL
    * The frontend js handles the behavior based on this the value in `data-yl-base-url`.
    * @return string
    */
  public function setBaseUrl(): string
  {
    $baseUrl = FreshRSS_Context::systemConf()->base_url;
    return '<div id="yl_base_url" data-yl-base-url="' . $baseUrl . '"></div>';
  }

  /**
   * Returns whether Invidious is enabled or not.
   * Load $this->loadConfigValues(); before calling this method.
   * @return bool
   */
  public function isInvidiousEnabled(): bool
  {
    return $this->yl_invidious_enabled;
  }

  /**
   * Returns whether Invidious is enabled or not.
   * Load $this->loadConfigValues(); before calling this method.
   * @return bool
   */
  public function isInvidiousSet(): bool
  {
    return $this->instance != '';
  }

  public function embedVideoIframe($entry): mixed
  {
    $this->loadConfigValues();

    // Youlag-inactive: Embed YouTube video for regular articles.
    $content = $entry->content();
    $link = $entry->link();
    if (
      preg_match(pattern: '#https?://(?:www\.)?youtube\.com/watch\?v=([\w-]+)#i', subject: $link, matches: $m) ||
      preg_match(pattern: '#https?://youtu\.be/([\w-]+)#i', subject: $link, matches: $m)
    ) {
      $videoId = $m[1];
      /* 
       * HACK: Use 'data-original' instead of 'src' to prevent FreshRSS from lazy-loading through its injected 'grey.gif',
       * which creates an http call for every iframe. 'data-original' is not a standard attribute, but handled through Youlag's script.js.
       * 
       * NOTE: The attribute naming scheme follows what is used in FreshRSS for lazyload:
       * https://github.com/FreshRSS/FreshRSS/blob/131f4f8e636fd2d0b7652c3afeb54eaaa48b283a/lib/lib_rss.php#L279
       */
      $iframeSrc = htmlspecialchars(string: "https://www.youtube.com/embed/{$videoId}?enablejsapi=1", flags: ENT_QUOTES);
      $iframe = <<<HTML
        <iframe
          class="aspect-ratio-16-9 rounded-md"
          width="100%"
          height="auto"
          data-original="{$iframeSrc}"
          frameborder="0"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin">
        </iframe>
      HTML;
      $content = "$iframe\n$content";
    }
    return $content;
  }

  /**
   * Replaces all youtube.com domains in entry links/content with the user Invidious instance.
   * @param FreshRSS_Entry $entry
   * @return FreshRSS_Entry
   */
  public function setInvidiousURL($entry): FreshRSS_Entry
  {
    $this->loadConfigValues();
    $invidious = $this->instance;

    if (!$this->isInvidiousSet()) {
      return $entry;
    }
    if (!$invidious) {
      return $entry;
    }

    $invidious = trim(string: $invidious);
    if (!preg_match(pattern: '#^https?://#i', subject: $invidious)) {
      $invidious = "https://{$invidious}";
    }
    $invidious = rtrim(string: $invidious, characters: '/');


    /** 
     * Create elements containing the Invidious instance URL and user-selected default video source option. 
     * These elements are rendered in the article content to expose the Youlag extension settings,
     * to allow frontend js to access them.
     */
    $content = $entry->content();
    $spanInvidiousUrl = '<span data-yl-invidious-instance="' . htmlspecialchars(string: $invidious, flags: ENT_QUOTES) . '"></span>';
    $videoSource = $this->yl_invidious_enabled ? 'invidious_1' : 'youtube';
    $spanVideoSource = '<span data-yl-is-video-default="' . htmlspecialchars(string: $videoSource, flags: ENT_QUOTES) . '"></span>';
    if (strpos(haystack: $content, needle: 'yl-invidious-instance') === false && strpos(haystack: $content, needle: 'yl-video-source-default') === false) {
      $entry->_content($spanInvidiousUrl . $spanVideoSource . $content);
    }

    // Embed video iframe
    $content = $this->embedVideoIframe(entry: $entry);

    if ($this->isInvidiousSet() && $this->isInvidiousEnabled()) {
      // Replace in entry link
      $link = $entry->link();
      $newLink = preg_replace(pattern: '#https?://(www\.)?youtube\.com/#', replacement: $invidious . '/', subject: $link);
      if ($newLink !== $link) {
        $entry->_link($newLink);
      }

      // Replace in entry content
      $newContent = preg_replace(pattern: '#https?://(www\.)?youtube\.com/#', replacement: $invidious . '/', subject: $content);
      if ($newContent !== $content) {
        $entry->_content($newContent);
      }
      else {
        $entry->_content($content);
      }
    }
    else {
      $entry->_content($content);
    }

    return $entry;
  }

  /**
   * Get the current user's categories.
   * @return array
   */
  protected function getUserCategories(): array
  {
    if (class_exists(class: 'FreshRSS_Factory')) {
      $dao = FreshRSS_Factory::createCategoryDao();
      if (method_exists(object_or_class: $dao, method: 'listCategories')) {
        $categories = $dao->listCategories();
        // Sort categories by 'Display position' attribute
        usort(array: $categories, callback: function ($a, $b): int {
          $pa = method_exists(object_or_class: $a, method: 'attributes') && isset($a->attributes()['position']) ? $a->attributes()['position'] : 0;
          $pb = method_exists(object_or_class: $b, method: 'attributes') && isset($b->attributes()['position']) ? $b->attributes()['position'] : 0;
          return $pa <=> $pb;
        });
        return $categories;
      }
    }
    return [];
  }

  /**
   * Get the name of a feed/filter by its ID.
   * Undocumented reference: See FreshRSS core, the `transition()` function in `app/Controllers/indexController.php`:
   *   'f.name' => $entry->feed()?->name() ?? ''
   * @param int|string $feedId
   * @return string
   */
  protected function getFeedNameById($feedId): mixed
  {
    if (class_exists(class: 'FreshRSS_Factory')) {
      $feedDao = FreshRSS_Factory::createFeedDao();
      if (method_exists(object_or_class: $feedDao, method: 'listFeeds')) {
        $feeds = $feedDao->listFeeds();
        foreach ($feeds as $feed) {
          $name = $feed?->name();
          if (is_object(value: $feed) && method_exists(object_or_class: $feed, method: 'id') && $feed->id() == $feedId) {
            return $name ?? 'Filtered';
          }
        }
      }
    }
    return 'Filtered'; // Fallback if not found
  }

  /**
   * Get the name of a category by its ID.
   * Undocumented reference: See FreshRSS core, the `transition()` function in `app/Controllers/indexController.php`:
   *   'c.name' => $entry->feed()?->category()?->name() ?? ''
   * @param int|string $catId
   * @return string
   */
  protected function getCategoryNameById($catId): mixed
  {
    $categories = $this->getUserCategories();
    foreach ($categories as $cat) {
      $name = $cat?->name();
      if (is_object(value: $cat) && method_exists(object_or_class: $cat, method: 'id') && $cat->id() == $catId) {
        return $name ?? '';
      }
    }
    return '';
  }

  /**
   * Get the name of a tag (label/playlist) by its ID.
   * Undocumented reference: See FreshRSS core, the `labels()` function in `app/Models/Context.php`.
   * @param int|string $tagId Tag (label) ID to resolve
   * @return string Tag name, or fallback to 'Tag {ID}' if not found
   */
  protected function getTagNameById($tagId): mixed
  {
    $tags = FreshRSS_Context::labels();
    foreach ($tags as $id => $tag) {
      if ((string) $id === (string) $tagId || (is_object(value: $tag) && method_exists(object_or_class: $tag, method: 'id') && $tag->id() == $tagId)) {
        return is_object(value: $tag) && method_exists(object_or_class: $tag, method: 'name') ? $tag->name() : ('Tag ' . $tagId);
      }
    }
    return "Tag {$tagId}";
  }

  /**
   * Block incoming YouTube shorts from being saved to the database.
   * @param FreshRSS_Entry $entry
   * @return FreshRSS_Entry|null
   */
  public function blockYoutubeShorts($entry): FreshRSS_Entry|null
  {
    if (is_object(value: $entry) === true) {
      // Only block if user setting is enabled
      $blockShorts = FreshRSS_Context::$user_conf->yl_block_youtube_shorts ?? false;
      if ($blockShorts) {
        $link = $entry->link();
        // Match links that start with e.g. https://www.youtube.com/shorts/
        if (preg_match(pattern: '#^https?://(www\.)?youtube\.com/shorts/#i', subject: $link)) {
          // Block YouTube shorts from being saved to the database
          Minz_Log::warning('Youlag: ' . $entry->link());
          return null;
        }
      }
    }
    return $entry;
  }

  /**
   * Extract the current category/tag/filter title from FreshRSS request params
   * This logic replicates some of the FreshRSS core behavior.
   * See the PHPDoc in `getFeedNameById()`, `getCategoryNameById()`, `getTagNameById()`. 
   * @return string HTML content for the category title container
   */
  public function createCategoryTitle(): string
  {
    $categoryTitle = '';
    $getParam = Minz_Request::paramString('get', '');
    //$categories = $this->getUserCategories();

    // Category page `c_{n}`
    // Prefer FreshRSS_Context::$category?->name() for accuracy, fallback to getCategoryNameById() if unavailable.
    if (preg_match(pattern: '/^c_(\d+)$/', subject: $getParam, matches: $m)) {
      $catId = $m[1];
      if (property_exists(object_or_class: 'FreshRSS_Context', property: 'category') && isset(FreshRSS_Context::$category)) {
        $categoryTitle = FreshRSS_Context::$category?->name() ?? $this->getCategoryNameById(catId: $catId);
      }
      else {
        $categoryTitle = $this->getCategoryNameById(catId: $catId);
      }
    }
    // Tag page `t_{n}`
    elseif (preg_match(pattern: '/^t_(\d+)$/', subject: $getParam, matches: $m)) {
      $tagId = $m[1];
      $categoryTitle = $this->getTagNameById(tagId: $tagId);
    }
    // Filter/feed page `f_{n}`
    elseif (preg_match(pattern: '/^f_(\d+)$/', subject: $getParam, matches: $m)) {
      $filterId = $m[1];
      // Prefer FreshRSS_Context::$feed?->name() for accuary, fallback to getFeedNameById() if unavailable.
      if (property_exists(object_or_class: 'FreshRSS_Context', property: 'feed') && isset(FreshRSS_Context::$feed)) {
        $categoryTitle = FreshRSS_Context::$feed?->name() ?? $this->getFeedNameById(feedId: $filterId);
      }
      else {
        $categoryTitle = $this->getFeedNameById(feedId: $filterId);
      }
    }
    // Specific top level category pages.
    elseif ($getParam === 'T') {
      // 'My labels' page. Use 'Playlists' if video labels are enabled.
      $categoryTitle = $this->isVideoLabelsEnabled() ? 'Playlists' : 'My labels';
    }
    elseif ($getParam === 'i') {
      $categoryTitle = 'Important';
    }
    elseif ($getParam === 's') {
      // 'Favorites' page. Use 'Watch later' if video labels are enabled.
      $categoryTitle = $this->isVideoLabelsEnabled() ? 'Watch later' : 'Favorites';
    }
    elseif ($getParam === '') {
      $categoryTitle = 'Subscriptions';
    }
    else {
      if (property_exists(object_or_class: 'FreshRSS_Context', property: 'category') && isset(FreshRSS_Context::$category)) {
        $categoryTitle = FreshRSS_Context::$category?->name() ?: '';
      }
      else {
        $categoryTitle = '';
      }
    }

    $categoryTitle = htmlspecialchars(string: $categoryTitle);

    $filterButton = '';
    if (Minz_Request::paramString('get', '') === 's') {
      // 'Watch later' page: add category filter button
      $filterButton = <<<HTML
        <button id="yl_stream_category_filter_toggle">
          Filter category <span id="yl_stream_category_filter_count"></span>
        </button>
      HTML;
    }
    $html = <<<HTML
      <div id="yl_category_toolbar">
        <div id="yl_category_title_container">
          <div id="yl_category_title" data-yl-category-title="{$categoryTitle}">{$categoryTitle}</div>
          {$filterButton}
          <button id="yl_nav_menu_container_toggle">Configure view</button>
        </div>
        <div id="yl_nav_menu_container">
          <nav id="yl_nav_menu_container_content"></nav>
        </div>
      </div>
    HTML;
    return $html;
  }

  public function createFreshRssLogo(): string
  {
    $logoSrc = '../themes/icons/FreshRSS-logo.svg';
    $linkUrl = Minz_Url::display('/i/');
    $html = <<<HTML
      <div id="yl_freshrss_logo_container">
        <a href="{$linkUrl}">
          <img id="yl_freshrss_logo" src="{$logoSrc}" alt="FreshRSS" loading="lazy" />
        </a>
      </div>
    HTML;
    return $html;
  }

  public function createWatchLaterCategoryFilter()
  {
    // Lists all available categories for filtering the 'Watch later' page. Click events are handled by the frontend js.
    $categories = $this->getUserCategories();
    $html = <<<HTML
      <div id="yl_stream_category_filter" class="yl-stream-category-filter">
        <div id="yl_stream_category_filter_options" class="yl-stream-category-filter-options">
      HTML;
    foreach ($categories as $cat) {
      $catIdRaw = is_object(value: $cat) && method_exists(object_or_class: $cat, method: 'id') ? $cat->id() : '';
      $catNameRaw = is_object(value: $cat) && method_exists(object_or_class: $cat, method: 'name') ? $cat->name() : '';
      $catId = htmlspecialchars(string: $catIdRaw, flags: ENT_QUOTES);
      $catName = htmlspecialchars(string: $catNameRaw, flags: ENT_QUOTES);
      $html .= <<<HTML
          <div class="yl-stream-category-filter-options__item" data-category="$catId">
            <label class="yl-stream-category-filter__label" for="yl-stream-category-filter-$catId">
              <input type="checkbox" class="yl-stream-category-filter__checkbox" id="yl-stream-category-filter-$catId" />
              <span class="yl-stream-category-filter__name">$catName</span>
              <span class="yl-stream-category-filter__count">(0)</span>
            </label>
          </div>
          HTML;
    }
    $html .= <<<HTML
        </div>
        <div class="yl-stream-category-filter__actions">
          <div id="yl_stream_category_filter_clear" class="yl-stream-category-filter__button" role="button">Clear all</div>
        </div>
      </div>
      HTML;
    return $html;
  }

  /**
   * Saves the user settings for this extension.
   */
  public function handleConfigureAction(): void
  {
    $this->loadConfigValues();

    if (Minz_Request::isPost()) {
      // Invidious settings
      FreshRSS_Context::userConf()->_attribute('yl_invidious_enabled', Minz_Request::paramBoolean('yl_invidious_enabled'));
      FreshRSS_Context::$user_conf->yl_invidious_url_1 = (string) Minz_Request::paramString('yl_invidious_url_1', '');

      // Category whitelist
      $catWhitelist = Minz_Request::paramArray('yl_category_whitelist', true);
      if (!is_array(value: $catWhitelist)) {
        $catWhitelist = [];
      }
      if (count(value: $catWhitelist) === 0) {
        // Allow disabling video mode for all categories and pages, by unchecking all checkboxes.
        $catWhitelist = ['none'];
      }
      FreshRSS_Context::userConf()->_attribute('yl_category_whitelist', $catWhitelist);

      // Related videos source
      $relatedVideosSource = Minz_Request::paramString('yl_related_videos', 'watch_later');
      FreshRSS_Context::userConf()->_attribute('yl_related_videos', $relatedVideosSource);

      // Feed view mobile grid layout
      $feedViewMobileGridEnabled = Minz_Request::paramBoolean('yl_feed_view_mobile_grid_enabled', false);
      FreshRSS_Context::userConf()->_attribute('yl_feed_view_mobile_grid_enabled', $feedViewMobileGridEnabled);

      // Feed thumbnail screencap
      $feedThumbnailScreencapEnabled = Minz_Request::paramBoolean('yl_custom_thumbnail_title_enabled', false);
      FreshRSS_Context::userConf()->_attribute('yl_custom_thumbnail_title_enabled', $feedThumbnailScreencapEnabled);

      // Watch later category filter
      $watchLaterCategoryFilterEnabled = Minz_Request::paramBoolean('yl_watch_later_category_filter_enabled', false);
      FreshRSS_Context::userConf()->_attribute('yl_watch_later_category_filter_enabled', $watchLaterCategoryFilterEnabled);

      // Mini player swipe
      $miniplayerSwipeEnabled = Minz_Request::paramBoolean('yl_miniplayer_swipe_enabled', true);
      FreshRSS_Context::userConf()->_attribute('yl_miniplayer_swipe_enabled', $miniplayerSwipeEnabled);

      // Chapter progress indicator
      $chapterProgressEnabled = Minz_Request::paramBoolean('yl_chapter_progress_enabled', true);
      FreshRSS_Context::userConf()->_attribute('yl_chapter_progress_enabled', $chapterProgressEnabled);

      // Description hide intro
      $descriptionHideIntroEnabled = Minz_Request::paramBoolean('yl_description_hide_intro_enabled', false);
      FreshRSS_Context::userConf()->_attribute('yl_description_hide_intro_enabled', $descriptionHideIntroEnabled);

      // Video platform labels
      $labelsEnabled = Minz_Request::paramBoolean('yl_video_labels_enabled', true);
      FreshRSS_Context::userConf()->_attribute('yl_video_labels_enabled', $labelsEnabled);

      // "New" badge for unwatched videos
      $unreadBadgeEnabled = Minz_Request::paramBoolean('yl_video_unread_badge_enabled', false);
      FreshRSS_Context::userConf()->_attribute('yl_video_unread_badge_enabled', $unreadBadgeEnabled);

      // Sort by modified date for Watch later/Playlists
      $sortModifiedEnabled = Minz_Request::paramBoolean('yl_video_sort_modified_enabled', false);
      FreshRSS_Context::userConf()->_attribute('yl_video_sort_modified_enabled', $sortModifiedEnabled);

      // YouTube shorts blocking
      FreshRSS_Context::userConf()->_attribute('yl_block_youtube_shorts', Minz_Request::paramBoolean('yl_block_youtube_shorts', true));

      // Youlag update check
      $updateCheckEnabled = Minz_Request::paramBoolean('yl_update_check_enabled', true);
      FreshRSS_Context::userConf()->_attribute('yl_update_check_enabled', $updateCheckEnabled);

      // Auto-detect video feeds
      $autoDetectVideoFeeds = Minz_Request::paramBoolean('yl_auto_detect_video_feeds', true);
      FreshRSS_Context::userConf()->_attribute('yl_auto_detect_video_feeds', $autoDetectVideoFeeds);

      FreshRSS_Context::$user_conf->save();

      $this->loadConfigValues();
      $_SESSION['ext_categories'] = $this->getUserCategories();
    }
    else {
      $_SESSION['ext_categories'] = $this->getUserCategories();
    }
  }


}