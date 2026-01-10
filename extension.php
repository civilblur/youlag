<?php

class YoulagExtension extends Minz_Extension {
    /**
     * Stores the user's selected category whitelist for UI use.
     * @var array
     */
    protected $yl_category_whitelist = ['all'];
    /**
     * Enable swipe-to-mini-player by default
     * @var bool
     */
    protected $yl_mini_player_swipe_enabled = true;
    /**
     * Use video platform labels (Favorite → Watch later, Tags → Playlists)
     * @var bool
     */
    protected $yl_video_labels_enabled = true;
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
    protected $yl_video_unread_badge_enabled = false;

    /**
     * Initialize this extension
     */
    public function init() {
        $this->registerHook('entry_before_display', array($this, 'setInvidiousURL'));
        $this->registerHook('nav_entries', array($this, 'createFreshRssLogo'), 6);
        $this->registerHook('nav_entries', array($this, 'createCategoryTitle'), 7);
        $this->registerHook('nav_entries', array($this, 'setCategoryWhitelist'), 10);
        $this->registerHook('nav_entries', array($this, 'setVideoLabels'), 11);
        $this->registerHook('nav_entries', array($this, 'setVideoUnreadBadge'), 12);
        $this->registerHook('nav_entries', array($this, 'setMiniPlayerSwipeEnabled'), 13);

        // Add Youlag theme and script to all extension pages
        Minz_View::appendStyle($this->getFileUrl('theme.min.css'));
        Minz_View::appendScript($this->getFileUrl('script.min.js'));

        // Required user settings to properly render Youlag styling
        // See FreshRSS `config-user.php` and the html form fields with `for="{setting_name}"` in settings for reference. This is not in the official documentation.
        FreshRSS_Context::userConf()->theme = 'Mapco';
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
    public function loadConfigValues() {
        if (!class_exists('FreshRSS_Context', false) || null === FreshRSS_Context::$user_conf) {
            return;
        }

        $yl_invidious_enabled = FreshRSS_Context::userConf()->attributeBool('yl_invidious_enabled');
		if ($yl_invidious_enabled !== null) {
			$this->yl_invidious_enabled = $yl_invidious_enabled;
		}

        if (FreshRSS_Context::$user_conf->yl_invidious_url_1 != '') {
            $this->instance = FreshRSS_Context::$user_conf->yl_invidious_url_1;
        }

        $val = FreshRSS_Context::userConf()->attributeArray('yl_category_whitelist');
        $this->yl_category_whitelist = is_array($val) ? $val : ['all'];

        $miniPlayerSwipeEnabled = FreshRSS_Context::userConf()->attributeBool('yl_mini_player_swipe_enabled');
        $this->yl_mini_player_swipe_enabled = ($miniPlayerSwipeEnabled === null) ? true : $miniPlayerSwipeEnabled;

        $labelsEnabled = FreshRSS_Context::userConf()->attributeBool('yl_video_labels_enabled');
        $this->yl_video_labels_enabled = ($labelsEnabled === null) ? true : $labelsEnabled;

        $unreadBadgeEnabled = FreshRSS_Context::userConf()->attributeBool('yl_video_unread_badge_enabled');
        $this->yl_video_unread_badge_enabled = ($unreadBadgeEnabled === null) ? true : $unreadBadgeEnabled;
    }



    /**
     * Returns the stored category whitelist for UI (after loadConfigValues()).
     * @return array
     */
    public function getCategoryWhitelist() {
        return (empty($this->yl_category_whitelist) ? ['all'] : $this->yl_category_whitelist);
    }

    /**
     * Pass the category whitelist data to be read in the DOM via nav_entries hook.
     * The `script.js` handles the behavior based on this the value in `data-yl-category-whitelist`.
     * @return string
     */
    public function setCategoryWhitelist() {
        $whitelist = FreshRSS_Context::userConf()->attributeArray('yl_category_whitelist');
        $dataAttr = '';
        if (!empty($whitelist)) {
            $dataAttr = ' data-yl-category-whitelist="' . htmlspecialchars(implode(', ', $whitelist)) . '"';
        }
        return '<div id="yl_category_whitelist"' . $dataAttr . '></div>';
    }

    /**
     * Returns whether swipe-to-mini-player is enabled or not.
     * @return bool
     */
    public function isMiniPlayerSwipeEnabled() {
        return $this->yl_mini_player_swipe_enabled;
    }


    /**
     * Pass the mini player swipe setting to be read in the DOM via nav_entries hook.
     * The `script.js` handles the behavior based on this the value in `data-yl-mini-player-swipe-enabled`.
     */
    public function setMiniPlayerSwipeEnabled() {
        $enabled = $this->yl_mini_player_swipe_enabled ? 'true' : 'false';
        return '<div id="yl_mini_player_swipe_enabled" data-yl-mini-player-swipe-enabled="' . $enabled . '"></div>';
    }

    /**
     * Returns whether video platform labels is enabled or not.
     * @return bool
     */
    public function isVideoLabelsEnabled() {
        return $this->yl_video_labels_enabled;
    }

    /**
     * Pass the video platform labels state to be read in the DOM via nav_entries hook.
     * The `script.js` handles the behavior based on this the value in `data-yl-video-labels`.
     * @param bool $enabled
     */
    public function setVideoLabels() {
        $enabled = $this->yl_video_labels_enabled ? 'true' : 'false';
        return '<div id="yl_video_labels" data-yl-video-labels="' . $enabled . '"></div>';
    }

    /**
     * Returns whether "New" badge for unwatched videos is enabled or not.
     * @return bool
     */
    public function isVideoUnreadBadgeEnabled() {
        return $this->yl_video_unread_badge_enabled;
    }

    /**
     * Pass the "New" badge setting for unwatched videos state to be read in the DOM via nav_entries hook.
     * The `script.js` handles the behavior based on this the value in `data-yl-video-unread-badge`.
     * @param bool $enabled
     */
    public function setVideoUnreadBadge() {
        $enabled = $this->yl_video_unread_badge_enabled ? 'true' : 'false';
        return '<div id="yl_video_unread_badge" data-yl-video-unread-badge="' . $enabled . '"></div>';
    }

    /**
     * Returns whether Invidious is enabled or not.
     * Load $this->loadConfigValues(); before calling this method.
     * @return bool
     */
    public function isInvidiousEnabled() {
        return $this->yl_invidious_enabled;
    }

    /**
     * Returns whether Invidious is enabled or not.
     * Load $this->loadConfigValues(); before calling this method.
     * @return bool
     */
    public function isInvidiousSet() {
        return $this->instance != '';
    }


    public function embedVideoIframe($entry) {
        $this->loadConfigValues();

        // Youlag-inactive: Embed YouTube video for regular articles.
        $content = $entry->content();
        $link = $entry->link();
        if (preg_match('#https?://(?:www\.)?youtube\.com/watch\?v=([\w-]+)#i', $link, $m) ||
            preg_match('#https?://youtu\.be/([\w-]+)#i', $link, $m)) {
            $videoId = $m[1];
            /* 
             * HACK: Use 'data-original' instead of 'src' to prevent FreshRSS from lazy-loading through its injected 'grey.gif',
             * which creates an http call for every iframe. 'data-original' is not a standard attribute, but handled through Youlag's script.js.
             * 
             * NOTE: The attribute naming scheme follows what is used in FreshRSS for lazyload:
             * https://github.com/FreshRSS/FreshRSS/blob/131f4f8e636fd2d0b7652c3afeb54eaaa48b283a/lib/lib_rss.php#L279
             */
            $iframe = '<iframe'
                . ' class="aspect-ratio-16-9 rounded-md"'
                . ' width="100%"'
                . ' height="auto"'
                . ' data-original="' . htmlspecialchars('https://www.youtube.com/embed/' . $videoId, ENT_QUOTES) . '"'
                . ' frameborder="0"'
                . ' allowfullscreen'
                . ' referrerpolicy="strict-origin-when-cross-origin"></iframe>';
            $content = $iframe . "\n" . $content;
        }
        return $content;
    }

    /**
     * Replaces all youtube.com domains in entry links/content with the user Invidious instance.
     * @param FreshRSS_Entry $entry
     * @return FreshRSS_Entry
     */
    public function setInvidiousURL($entry) {
        $this->loadConfigValues();
        $invidious = $this->instance;

        if (!$this->isInvidiousSet()) {
            return $entry;
        }
        if (!$invidious) {
            return $entry;
        }

        $invidious = trim($invidious);
        if (!preg_match('#^https?://#i', $invidious)) {
            $invidious = 'https://' . $invidious;
        }
        $invidious = rtrim($invidious, '/');


        /** 
         * Create elements containing the Invidious instance URL and user-selected default video source option. 
         * These elements are rendered in the article content to expose the Youlag extension settings,
         * to allow `script.js` to access them.
         */
        $content = $entry->content();
        $spanInvidiousUrl = '<span data-yl-invidious-instance="' . htmlspecialchars($invidious, ENT_QUOTES) . '"></span>';
        $videoSource = $this->yl_invidious_enabled ? 'invidious_1' : 'youtube';
        $spanVideoSource = '<span data-yl-video-source-default="' . htmlspecialchars($videoSource, ENT_QUOTES) . '"></span>';
        if (strpos($content, 'yl-invidious-instance') === false && strpos($content, 'yl-video-source-default') === false) {
            $entry->_content($spanInvidiousUrl . $spanVideoSource . $content);
        }

        // Embed video iframe
        $content =  $this->embedVideoIframe($entry);

        if ($this->isInvidiousSet() && $this->isInvidiousEnabled()) {
            // Replace in entry link
            $link = $entry->link();
            $newLink = preg_replace('#https?://(www\.)?youtube\.com/#', $invidious . '/', $link);
            if ($newLink !== $link) {
                $entry->_link($newLink);
            }

            // Replace in entry content
            $newContent = preg_replace('#https?://(www\.)?youtube\.com/#', $invidious . '/', $content);
            if ($newContent !== $content) {
                $entry->_content($newContent);
            } else {
                $entry->_content($content);
            }
        } else {
            $entry->_content($content);
        }

        return $entry;
    }

    /**
     * Get the current user's categories.
     * @return array
     */
    protected function getUserCategories() {
        if (class_exists('FreshRSS_Factory')) {
            $dao = FreshRSS_Factory::createCategoryDao();
            if (method_exists($dao, 'listCategories')) {
                return $dao->listCategories();
            }
        }
        return array();
    }

    /**
     * Get the name of a feed/filter by its ID.
     * Undocumented reference: See FreshRSS core, the `transition()` function in `app/Controllers/indexController.php`:
     *   'f.name' => $entry->feed()?->name() ?? ''
     * @param int|string $feedId
     * @return string
     */
    protected function getFeedNameById($feedId) {
        if (class_exists('FreshRSS_Factory')) {
            $feedDao = FreshRSS_Factory::createFeedDao();
            if (method_exists($feedDao, 'listFeeds')) {
                $feeds = $feedDao->listFeeds();
                foreach ($feeds as $feed) {
                    $name = $feed?->name();
                    if (is_object($feed) && method_exists($feed, 'id') && $feed->id() == $feedId) {
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
    protected function getCategoryNameById($catId) {
        $categories = $this->getUserCategories();
        foreach ($categories as $cat) {
            $name = $cat?->name();
            if (is_object($cat) && method_exists($cat, 'id') && $cat->id() == $catId) {
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
    protected function getTagNameById($tagId) {
        $tags = FreshRSS_Context::labels();
        foreach ($tags as $id => $tag) {
            if ((string)$id === (string)$tagId || (is_object($tag) && method_exists($tag, 'id') && $tag->id() == $tagId)) {
                return is_object($tag) && method_exists($tag, 'name') ? $tag->name() : ('Tag ' . $tagId);
            }
        }
        return 'Tag ' . $tagId;
    }

    /**
     * Block incoming YouTube shorts from being saved to the database.
     * @param FreshRSS_Entry $entry
     * @return FreshRSS_Entry|null
     */
    public function blockYoutubeShorts($entry) {
        if (is_object($entry) === true) {
            // Only block if user setting is enabled
            $blockShorts = FreshRSS_Context::$user_conf->yl_block_youtube_shorts ?? false;
            if ($blockShorts) {
                $link = $entry->link();
                // Match links that start with e.g. https://www.youtube.com/shorts/
                if (preg_match('#^https?://(www\.)?youtube\.com/shorts/#i', $link)) {
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
    public function createCategoryTitle() {
        $categoryTitle = '';
        $getParam = Minz_Request::paramString('get', '');
        $categories = $this->getUserCategories();

        // Category page `c_{n}`
        // Prefer FreshRSS_Context::$category?->name() for accuracy, fallback to getCategoryNameById() if unavailable.
        if (preg_match('/^c_(\d+)$/', $getParam, $m)) {
            $catId = $m[1];
            if (property_exists('FreshRSS_Context', 'category') && isset(FreshRSS_Context::$category)) {
                $categoryTitle = FreshRSS_Context::$category?->name() ?? $this->getCategoryNameById($catId);
            } else {
                $categoryTitle = $this->getCategoryNameById($catId);
            }
        }
        // Tag page `t_{n}`
        elseif (preg_match('/^t_(\d+)$/', $getParam, $m)) {
            $tagId = $m[1];
            $categoryTitle = $this->getTagNameById($tagId);
        }
        // Filter/feed page `f_{n}`
        elseif (preg_match('/^f_(\d+)$/', $getParam, $m)) {
            $filterId = $m[1];
            // Prefer FreshRSS_Context::$feed?->name() for accuary, fallback to getFeedNameById() if unavailable.
            if (property_exists('FreshRSS_Context', 'feed') && isset(FreshRSS_Context::$feed)) {
                $categoryTitle = FreshRSS_Context::$feed?->name() ?? $this->getFeedNameById($filterId);
            } else {
                $categoryTitle = $this->getFeedNameById($filterId);
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
            if (property_exists('FreshRSS_Context', 'category') && isset(FreshRSS_Context::$category)) {
                $categoryTitle = FreshRSS_Context::$category?->name() ?? '';
            } else {
                $categoryTitle = '';
            }
        }

        $categoryTitle = htmlspecialchars($categoryTitle);

        $html = '<div id="yl_category_toolbar">'
              .     '<div id="yl_category_title_container">'
              .         '<div id="yl_category_title" data-yl-category-title="' . $categoryTitle . '">' . $categoryTitle . '</div>'
              .         '<button id="yl_nav_menu_container_toggle">Configure view</button>'
              .     '</div>'
              .     '<div id="yl_nav_menu_container">'
              .         '<nav id="yl_nav_menu_container_content"></nav>'
              .     '</div>'
              . '</div>';
        return $html;
    }

    public function createFreshRssLogo() {
        $html = '<div id="yl_freshrss_logo_container">'
              .     '<a href="/i/">'
              .         '<img id="yl_freshrss_logo" src="' . '../themes/icons/FreshRSS-logo.svg' . '" alt="FreshRSS" loading="lazy" />'
              .     '</a>'
              . '</div>';
        return $html;
    }

    /**
     * Saves the user settings for this extension.
     */
    public function handleConfigureAction() {
        $this->loadConfigValues();

        $_SESSION['ext_categories'] = $this->getUserCategories();

        if (Minz_Request::isPost()) {
            // Invidious settings
            FreshRSS_Context::userConf()->_attribute('yl_invidious_enabled', Minz_Request::paramBoolean('yl_invidious_enabled'));
            FreshRSS_Context::$user_conf->yl_invidious_url_1 = (string)Minz_Request::paramString('yl_invidious_url_1', '');

            // Category whitelist
            $catWhitelist = Minz_Request::paramArray('yl_category_whitelist', true);
            if (!is_array($catWhitelist)) {
                $catWhitelist = [];
            }
            FreshRSS_Context::userConf()->_attribute('yl_category_whitelist', $catWhitelist);

            // Mini player swipe
            $miniPlayerSwipeEnabled = Minz_Request::paramBoolean('yl_mini_player_swipe_enabled', true);
            FreshRSS_Context::userConf()->_attribute('yl_mini_player_swipe_enabled', $miniPlayerSwipeEnabled);

            // Video platform labels
            $labelsEnabled = Minz_Request::paramBoolean('yl_video_labels_enabled', true);
            FreshRSS_Context::userConf()->_attribute('yl_video_labels_enabled', $labelsEnabled);

            // "New" badge for unwatched videos
            $unreadBadgeEnabled = Minz_Request::paramBoolean('yl_video_unread_badge_enabled', true);
            FreshRSS_Context::userConf()->_attribute('yl_video_unread_badge_enabled', $unreadBadgeEnabled);

            // YouTube shorts blocking
            FreshRSS_Context::userConf()->_attribute('yl_block_youtube_shorts', Minz_Request::paramBoolean('yl_block_youtube_shorts', true));

            FreshRSS_Context::$user_conf->save();
        }
    }


}