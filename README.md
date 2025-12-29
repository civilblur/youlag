<h1 align="center">
  <img src=".github/icon.png" alt="youlag icon" width="180">

   Youlag
   <br>
   Video extension for FreshRSS
</h1>

<center>
   <img src=".github/capture.png" alt="youlag screencapture" width="1000">
</center>


## About
Browse YouTube RSS feeds in [FreshRSS](https://github.com/FreshRSS/FreshRSS) through a modern video interface that incorporates quality-of-life features.

Youlag supports article and video feeds, allowing you to select categories that will use the video interface.

## Table of Content
- [Features](#features)
- [Install](#install)
- [Additional Resources](#additional-resources)
- [Contribution](#contribution)
- [Attributions](#attributions)

## Features

- ⭐ **Optimized for Video Viewing**
  - Browse YouTube RSS subscriptions through a video-tailored inferface
  - Fullscreen video viewing
  - `Esc` key to exit videos.
  - Switch between YouTube and Invidious playback source
  - Dark mode
- ⚙️ Customization
  - Apply the video interface to only selected categories
  - Option to rename "Favorites → Watch Later", "My Tags → Playlists"
- 🖥️ **Desktop & Mobile**
  - Mobile friendly, better one-handed navigation
  - Improved readability and legibility
- 📺 **Features Offered by FreshRSS:**
  - Subscribe to YouTube creators without an account

### Planned
- [x] Minimize video, for background playback while browsing.
- [x] Clickable links in video descriptions.
- [x] Convert to an actual FreshRSS extension, with options for customizing the view and features.
- [x] Ability to specify which category to apply the video grid on, with the intention to only affect video feeds.
- [ ] Local video queue, but without autoplay due to CORS limitation.
- [ ] Block and hide YouTube shorts.

## Install

1. Download the [latest release here](https://github.com/civilblur/youlag/releases).

1. Unzip the file and you'll find a folder named `xExtension-Youlag`.

1. Move the `xExtension-Youlag` folder into your FreshRSS installation: `freshrss/extensions/`.

1. In FreshRSS, go to `Settings → Extensions` and enable the `Youlag` extension.
    - For [Invidious](https://invidious.io/) users, you can add your instance in the Youlag settings. This will allow you to choose which video source to play from when watching videos.


## Contribution

1. Fork the `dev` branch.
1. Install dependencies: `npm i`.
1. Run `npm run watch` to compile files to `/static`.
1. Run `npm run build` to generate a production build to `/dist`.

## Attributions

- **Integration**: [Korbak/freshrss-invidious](https://github.com/Korbak/freshrss-invidious)
- **Icons used/remixed**: [SVG Repo](https://www.svgrepo.com/collection/design-and-development-elements/), [krystonschwarze](https://www.svgrepo.com/author/krystonschwarze/), [phosphor](https://www.svgrepo.com/author/phosphor/), [Solar Icons](https://www.svgrepo.com/svg/529779/playlist), [Dazzle UI](https://www.svgrepo.com/author/Dazzle%20UI/), [n3r4zzurr0/svg-spinners](https://github.com/n3r4zzurr0/svg-spinners).
- **Tools**: [SVGOptimizer](https://jakearchibald.github.io/svgomg/), [b64.io](https://b64.io/).
- **Featured channels on top image:** [Novaspirit Tech](https://www.youtube.com/channel/UCrjKdwxaQMSV_NDywgKXVmw), [Hardware Haven](https://www.youtube.com/channel/UCgdTVe88YVSrOZ9qKumhULQ).
   - Edit 2025-02-05: Rest in peace Don (Novaspirit Tech), thank you for your contribution to the community.

## License

GNU General Public License v3.0
