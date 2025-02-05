<h1 align="center">
   Youlag Theme for FreshRSS

   <img src="https://github.com/civilblur/youlag/blob/main/src/capture.png" alt="youlag screencapture" width="1000"></a>
</h1>

## About
"Youlag Theme for [FreshRSS](https://freshrss.org/)" provides a video-focused browsing experience for your RSS subscriptions.

This opinionated theme is best for video feeds but may still work with regular content. Set up a separate FreshRSS instance if needed.

## Features

- ⭐ **Video Browsing & Viewing**
  - Familiar video platform layout.
  - View feed items in fullscreen "theater view".
  - Auto-stops video when closing (prevents background play in FreshRSS).
  - Dark mode.
- 🖥️ **Optimized for Desktop & Mobile**
  - Redesigned menus for better mobile usability.
  - Improved legibility.
- 📺 **FreshRSS features:**
  - Subscribe to YouTube creators without an account.

### Planned
- Minimize video, to allow background playback while browsing feed.
- Local video queue (without autoplay, due to CORS limitation).
- Major refactoring to improve stability and browser compatability.

## Install

### Prerequisites

1. Install and enable [these official FresshRSS extensions](https://github.com/FreshRSS/Extensions): "CustomCSS", "CustomJS", "YouTube", and "YouTubeChannel2RssFeed" (optional).

2. Go to "Settings > Configuration: Display" and use these settings:
   - **Theme**: "Mapco — By: Thomas Guesnon".
   - **Thumbnail**: "Landscape".
   - **Website**: "Icon". To display fav-icon as avatar in the feed.

### Installing the theme

1. Go to "Settings > Extensions" and click the gear (⚙️) icon for each extension:

   - **Custom CSS**: Copy the content from `theme.css`, paste it into the text field, and click "Submit".
   - **Custom JS**: Copy the content from `script.js` paste it into the text field, and click "Submit".

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
1. Run `npm run watch-css` to compile `src/theme.scss` to `theme.css`.

[Learn more about SASS here](https://sass-lang.com/install/).

## Attributions

- **Icons used/remixed**: [SVG Repo](https://www.svgrepo.com/collection/design-and-development-elements/), [krystonschwarze](https://www.svgrepo.com/author/krystonschwarze/), [phosphor](https://www.svgrepo.com/author/phosphor/), [Solar Icons](https://www.svgrepo.com/svg/529779/playlist), [Dazzle UI](https://www.svgrepo.com/author/Dazzle%20UI/).
- **Additional resources**: [SVGOptimizer](https://jakearchibald.github.io/svgomg/), [b64.io](https://b64.io/).
- **Featured channels on top image:** [Novaspirit Tech](https://www.youtube.com/channel/UCrjKdwxaQMSV_NDywgKXVmw), [Hardware Haven](https://www.youtube.com/channel/UCgdTVe88YVSrOZ9qKumhULQ).
   - Edit 2025-02-05: Rest in peace Don (Novaspirit Tech), thank you for your contribution to the community.

## License

GNU General Public License v3.0
