<?php

class YoulagExtension extends Minz_Extension {
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

        // Add Youlag theme and script to all extension pages
        Minz_View::appendStyle($this->getFileUrl('theme.min.css'));
        Minz_View::appendScript($this->getFileUrl('script.min.js'));

        // Required user settings to properly render Youlag styling
        FreshRSS_Context::userConf()->theme = 'Mapco';
        FreshRSS_Context::userConf()->topline_website = 'full';
        FreshRSS_Context::userConf()->topline_thumbnail = 'landscape';
        FreshRSS_Context::userConf()->topline_summary = true;
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


        // Replace in entry link
        $link = $entry->link();
        $newLink = preg_replace('#https?://(www\.)?youtube\.com/#', $invidious . '/', $link);
        if ($newLink !== $link) {
            $entry->_link($newLink);
        }

        // Replace in entry content
        $content = $entry->content();
        $newContent = preg_replace('#https?://(www\.)?youtube\.com/#', $invidious . '/', $content);
        if ($newContent !== $content) {
            $entry->_content($newContent);
        }

        return $entry;
    }


    /**
     * Saves the user settings for this extension.
     */
    public function handleConfigureAction() {
        $this->loadConfigValues();

        // User categories
        $_SESSION['ext_categories'] = $this->getUserCategories();

        if (Minz_Request::isPost()) {
            FreshRSS_Context::userConf()->_attribute('yl_invidious_enabled', Minz_Request::paramBoolean('yl_invidious_enabled'));
            FreshRSS_Context::$user_conf->yl_invidious_url_1 = (string)Minz_Request::param('yl_invidious_url_1', '');
            FreshRSS_Context::$user_conf->save();
        }
    }
}