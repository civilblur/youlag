<h1 align="center">
  <img src="https://github.com/civilblur/youlag/blob/main/src/icon.png" alt="youlag icon" width="180">

   Youlag
   <br>
   Video Extension for FreshRSS
</h1>

<center>
   <img src="https://github.com/civilblur/youlag/blob/main/src/capture.png" alt="youlag screencapture" width="1000">
</center>


## About
Youlag delivers a video-focused browsing experience for your YouTube RSS feeds in FreshRSS, with a sleek theme and extra features.

While it also supports regular feeds, this setup is tailored specifically for video content. Feel free and set up a separate instance for your video feeds if needed.

## Table of content
- [Features](#features)
- [Install](#install)
- [Additional resources](#additional-resources)
- [Contribution](#contribution)
- [Attributions](#attributions)

## Features

- ⭐ **Optimized for Video Viewing**
  - Browse your YouTube, Invidious, Piped RSS subscriptions with ease.
  - Clean, familiar video platform layout.
  - Fullscreen viewing for videos and feed items.
  - Quickly exit videos with `Esc` key.
  - Shortcuts for external viewing: "Invidious", "YouTube", or "YouTube embed view" (for less distraction).
  - Dark mode.
- 🖥️ **Desktop & Mobile**
  - Reponsive design.
  - Redesigned menus for better one-handed navigation.
  - Improved readability and legibility across devices.
- 📺 **FreshRSS features:**
  - Subscribe to YouTube creators without an account.

### Planned
- Minimize video, for background playback while browsing.
- Local video queue, but without autoplay due to CORS limitation.
- Clickable links in video descriptions.
- Convert to an actual FreshRSS extension, with options for customizing the view and features.
  - Ability to specify which category to apply the video grid on, with the intention to only affect video feeds.

## Install

1. Go to `Settings > Configuration: Display` and use these settings:
   - **Theme**: "Mapco — By: Thomas Guesnon".

1. Go to `Settings > Extensions` and click the gear (⚙️) icon for each extension:
   - **User JS**: Copy the content from `script.js` paste it into the text field, and click "Submit".
   - **User CSS**: Copy the content from `theme.css`, paste it into the text field, and click "Submit".
   - User JS and User CSS extensions now come with FreshRSS by default. If missing, get them from the [official extensions repository](https://github.com/FreshRSS/Extensions). 

1. Enable the extensions.

## Additional resources

- "[Invidious Video Feed](https://github.com/tunbridgep/freshrss-invidious)" FreshRSS extension by tunbridgep.
  - If you prefer to use Invidious instead.
- "[YouTubeChannel2RssFeed](https://github.com/cn-tools/cntools_FreshRssExtensions)" FreshRSS extension by cn-tools.
  - Converts YouTube channel links to RSS links when adding new feeds.

## Contribution

1. Fork and make changes to the `dev` branch.
1. Install dependencies: `npm i`.
1. Make styling changes to the SASS file at `src/theme.scss` opposed to the compiled `theme.css` file.
   - Run `npm run watch-css` to compile `src/theme.scss` to `theme.css`.
   - [Learn more about SASS here](https://sass-lang.com/install/). 
1. For structural and functional changes to the Youlag video modal, edit `script.js` in plain JavaScript.


## Attributions

- **Icons used/remixed**: [SVG Repo](https://www.svgrepo.com/collection/design-and-development-elements/), [krystonschwarze](https://www.svgrepo.com/author/krystonschwarze/), [phosphor](https://www.svgrepo.com/author/phosphor/), [Solar Icons](https://www.svgrepo.com/svg/529779/playlist), [Dazzle UI](https://www.svgrepo.com/author/Dazzle%20UI/), [n3r4zzurr0/svg-spinners](https://github.com/n3r4zzurr0/svg-spinners).
- **Additional resources**: [SVGOptimizer](https://jakearchibald.github.io/svgomg/), [b64.io](https://b64.io/).
- **Featured channels on top image:** [Novaspirit Tech](https://www.youtube.com/channel/UCrjKdwxaQMSV_NDywgKXVmw), [Hardware Haven](https://www.youtube.com/channel/UCgdTVe88YVSrOZ9qKumhULQ).
   - Edit 2025-02-05: Rest in peace Don (Novaspirit Tech), thank you for your contribution to the community.

## License

GNU General Public License v3.0
