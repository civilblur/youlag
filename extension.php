<?php

class YoulagExtension extends Minz_Extension {
    /**
     * Whether to use Invidious for playback
     * @var bool
     */
    private $yl_indivious_enabled = false;
    /**
     * Invidious instance to use
     * @var string
     */
    protected $instance = 'invidio.us';

    /**
     * Initialize this extension
     */
    public function init()
    {
        $this->registerHook('entry_before_display', array($this, 'setInvidiousURL'));

        // Add Youlag theme and script to all extension pages
        Minz_View::appendStyle($this->getFileUrl('theme.css'));
        Minz_View::appendScript($this->getFileUrl('script.js'));

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
    public function loadConfigValues()
    {
        if (!class_exists('FreshRSS_Context', false) || null === FreshRSS_Context::$user_conf) {
            return;
        }

        $yl_indivious_enabled = FreshRSS_Context::userConf()->attributeBool('yl_indivious_enabled');
		if ($yl_indivious_enabled !== null) {
			$this->yl_indivious_enabled = $yl_indivious_enabled;
		}

        if (FreshRSS_Context::$user_conf->yl_invidious_url_1 != '') {
            $this->instance = FreshRSS_Context::$user_conf->yl_invidious_url_1;
        }
    }

    /**
     * Returns whether Invidious is enabled or not.
     * @return bool
     */
    public function isInvidiousEnabled()
    {
        return $this->yl_indivious_enabled;
    }


    /**
     * Replaces all youtube.com domains in entry links/content with the user Invidious instance.
     * @param FreshRSS_Entry $entry
     * @return FreshRSS_Entry
     */
    public function setInvidiousURL($entry)
    {
        $this->loadConfigValues();
        if (!$this->yl_indivious_enabled) {
            return $entry;
        }
        $invidious = $this->instance;
        if (!$invidious) {
            return $entry;
        }

        $invidious = trim($invidious);
        if (!preg_match('#^https?://#i', $invidious)) {
            $invidious = 'https://' . $invidious;
        }
        $invidious = rtrim($invidious, '/');

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
    public function handleConfigureAction()
    {
        $this->loadConfigValues();

        if (Minz_Request::isPost()) {

            FreshRSS_Context::userConf()->_attribute('yl_indivious_enabled', Minz_Request::paramBoolean('yl_indivious_enabled'));
            FreshRSS_Context::$user_conf->yl_invidious_url_1 = (string)Minz_Request::param('yl_invidious_url_1', '');
            FreshRSS_Context::$user_conf->save();
        }
    }
}