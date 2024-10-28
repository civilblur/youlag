# Youlag Theme for FreshRSS

---

## About
"Youlag Theme for FreshRSS" provides a video-focused browsing experience for your RSS subscriptions.

This is an opinionated theme and is recommended primarily for video feeds but may still work with regular content feeds. Feel free and setup a separate instance of FreshRSS if needed.

## Why

I've lightly utilized FreshRSS to keep up with video creators and wanted to finally commit to it, unfortunately, under the circumstances with third-party services struggling. I needed a browsing experience tailored for video content, and since I couldn't find a RSS client or theme that fit the bill, I created the Youlag theme to bridge the gap.

---

## Install

### Prerequisite

1. Install and enable these official FresshRSS extensions: ["CustomCSS", "YouTube", and "CustomJS" (optional)](https://github.com/FreshRSS/Extensions).

2. Go to "Settings > Configuration: Display" and adjust the following settings:

   - Theme: "Mapco — By: Thomas Guesnon".

   - Thumbnail: "Landscape".

   - Website: "Icon". To display fav-icon as avatar in the feed.

### Installing the theme

1. Go to "Settings > Extensions" and adjust these extensions by clicking the respective gear (⚙️) icon:
   - "Custom CSS": Copy the content from theme.css`, paste it into the text field, and click "Submit".
   - "Custom JS": Copy the content from `script.js` paste it into the text field, and click "Submit". This will allow videos to stop when exiting out from a video page, opposed to playing in the background.

---

## Additional tools

- FreshRSS extension "[Invidious Video Feed](https://github.com/tunbridgep/freshrss-invidious)" by tunbridgep.
  - If you prefer to use Invidious instead.
- FreshRSS official extension "[Image Proxy](https://github.com/FreshRSS/Extensions)" by Frans de Jonge.
  - Proxies images when a feed item is opened. It doesn't however proxy the thumbnails in the feed.
- Firefox extension: "[RSSPreview](https://github.com/aureliendavid/rsspreview)" by Aurelien David.
  - Easily extract the RSS feed of a page.

---

## Contribution

Please make changes to the SASS file at `src/theme.scss` opposed to the compiled `.css` file.

[Learn more about SASS here](https://sass-lang.com/install/).

---

## Attributions

- **Icons used/remixed**: [SVG Repo](https://www.svgrepo.com/collection/design-and-development-elements/), [krystonschwarze](https://www.svgrepo.com/author/krystonschwarze/), [phosphor](https://www.svgrepo.com/author/phosphor/), [Solar Icons](https://www.svgrepo.com/svg/529779/playlist), [Dazzle UI](https://www.svgrepo.com/author/Dazzle%20UI/).
- **Additional resources**: [SVGOptimizer](https://jakearchibald.github.io/svgomg/), [b64.io](https://b64.io/).

---

## License

GNU General Public License v3.0