<?php declare(strict_types=1);

final class YoulagExtension extends Minz_Extension {
    #[\Override]
    public function init(): void {
        Minz_View::appendStyle($this->getFileUrl('static/theme.css'));
        Minz_View::appendScript($this->getFileUrl('static/script.js'));

        FreshRSS_Context::userConf()->theme = 'Mapco';
        FreshRSS_Context::userConf()->topline_website = 'full';
        FreshRSS_Context::userConf()->topline_thumbnail = 'landscape';
        FreshRSS_Context::userConf()->topline_summary = true;
    }
}