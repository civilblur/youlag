<?php

class YoulagExtension extends Minz_Extension {
    /**
     * Stores the user's selected category whitelist for UI use.
     * @var array
     */
    protected $yl_category_whitelist = ['all'];
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
     * Initialize this extension
     */
    public function init() {
        $this->registerHook('entry_before_display', array($this, 'setInvidiousURL'));
        $this->registerHook('nav_entries', array($this, 'setCategoryWhitelist'), 10);
        $this->registerHook('nav_entries', array($this, 'setVideoLabels'), 11);

        // Add Youlag theme and script to all extension pages
        Minz_View::appendStyle($this->getFileUrl('theme.min.css'));
        Minz_View::appendScript($this->getFileUrl('script.min.js'));

        // Required user settings to properly render Youlag styling
        FreshRSS_Context::userConf()->theme = 'Mapco';
        FreshRSS_Context::userConf()->topline_website = 'full';
        FreshRSS_Context::userConf()->topline_thumbnail = 'landscape';
        FreshRSS_Context::userConf()->topline_summary = true;

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

        $labelsEnabled = FreshRSS_Context::userConf()->attributeBool('yl_video_labels_enabled');
        $this->yl_video_labels_enabled = ($labelsEnabled === null) ? true : $labelsEnabled;
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
            $iframe = '<iframe'
                . ' class="aspect-ratio-16-9 rounded-md"'
                . ' width="100%"'
                . ' height="auto"'
                . ' src="' . htmlspecialchars('https://www.youtube.com/embed/' . $videoId, ENT_QUOTES) . '"'
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
     * Saves the user settings for this extension.
     */
    public function handleConfigureAction() {
        $this->loadConfigValues();

        $_SESSION['ext_categories'] = $this->getUserCategories();

        if (Minz_Request::isPost()) {
            // Invidious settings
            FreshRSS_Context::userConf()->_attribute('yl_invidious_enabled', Minz_Request::paramBoolean('yl_invidious_enabled'));
            FreshRSS_Context::$user_conf->yl_invidious_url_1 = (string)Minz_Request::param('yl_invidious_url_1', '');

            // Category whitelist
            $catWhitelist = Minz_Request::paramArray('yl_category_whitelist', true);
            if (!is_array($catWhitelist)) {
                $catWhitelist = [];
            }
            FreshRSS_Context::userConf()->_attribute('yl_category_whitelist', $catWhitelist);

            // Video platform labels
            $labelsEnabled = Minz_Request::paramBoolean('yl_video_labels_enabled', true);
            FreshRSS_Context::userConf()->_attribute('yl_video_labels_enabled', $labelsEnabled);

            // YouTube shorts blocking
            FreshRSS_Context::userConf()->_attribute('yl_block_youtube_shorts', Minz_Request::paramBoolean('yl_block_youtube_shorts', true));

            FreshRSS_Context::$user_conf->save();
        }
    }


}