<h1 align="center">
   Youlag Theme for FreshRSS

   <img src="https://github.com/civilblur/youlag/blob/main/src/capture.png" alt="youlag screencapture" width="1000"></a>
</h1>

## About
"Youlag Theme for [FreshRSS](https://freshrss.org/)" provides a video-focused browsing experience for your RSS subscriptions.

This is an opinionated theme and is recommended primarily for video feeds but may still work with regular content feeds. Feel free and setup a separate instance of FreshRSS if needed.

## Why

The YouLag theme allows you to recreate a familiar video browsing and viewing experience. By using YouTube's official RSS feeds with FreshRSS, you can subscribe to creators without needing to sign up for the platform.

## Install

### Prerequisite

1. Install and enable [these official FresshRSS extensions](https://github.com/FreshRSS/Extensions): "CustomCSS", "YouTube", and "CustomJS" (optional).

2. Go to "Settings > Configuration: Display" and use these settings:
   - **Theme**: "Mapco — By: Thomas Guesnon".
   - **Thumbnail**: "Landscape".
   - **Website**: "Icon". To display fav-icon as avatar in the feed.

### Installing the theme

1. Go to "Settings > Extensions" and adjust these extensions by clicking the respective gear (⚙️) icon:

   - **Custom CSS**: Copy the content from `theme.css`, paste it into the text field, and click "Submit".
   - **Custom JS**: Copy the content from `script.js` paste it into the text field, and click "Submit". This will allow videos to stop when exiting out from a video page, opposed to playing in the background.

## Additional tools

- FreshRSS extension "[Invidious Video Feed](https://github.com/tunbridgep/freshrss-invidious)" by tunbridgep.
  - If you prefer to use Invidious instead.
- FreshRSS official extension "[Image Proxy](https://github.com/FreshRSS/Extensions)" by Frans de Jonge.
  - Proxies images when a feed item is opened. It doesn't however proxy the thumbnails in the feed.
- Firefox extension: "[RSSPreview](https://github.com/aureliendavid/rsspreview)" by Aurelien David.
  - Easily extract the RSS feed of a page.

## Contribution

1. Fork and make changes to the `dev` branch.
1. Install dependencies: `npm i`.
1. Make changes to the SASS file at `src/theme.scss` opposed to the compiled `theme.css` file.
1. Run `watch-css` to compile `src/theme.scss` to `theme.css`.

[Learn more about SASS here](https://sass-lang.com/install/).

## Attributions

- **Icons used/remixed**: [SVG Repo](https://www.svgrepo.com/collection/design-and-development-elements/), [krystonschwarze](https://www.svgrepo.com/author/krystonschwarze/), [phosphor](https://www.svgrepo.com/author/phosphor/), [Solar Icons](https://www.svgrepo.com/svg/529779/playlist), [Dazzle UI](https://www.svgrepo.com/author/Dazzle%20UI/).
- **Additional resources**: [SVGOptimizer](https://jakearchibald.github.io/svgomg/), [b64.io](https://b64.io/).

## License

GNU General Public License v3.0
