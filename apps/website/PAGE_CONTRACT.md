# Historical parallel worker contract

This document records the initial landing-page build. Its route/chat/offline demo
specification has been superseded by [STORY_CONTRACT.md](STORY_CONTRACT.md) and
must not be used as the current page design.

Build deadline: deliver your assigned implementation in 5–7 minutes, then send
Orca worker_done. You are not alone in the codebase: do not revert others' changes.
Read PRODUCT.md, DESIGN.md and the current mobile README. No commits, main pushes,
network publishing, npm installs or edits outside your owned files. Root coordinator
owns integration, local assets, server, config, docs and browser QA.

Static website, vanilla HTML/CSS/JS. Files: index.html, styles.css, app.js (ES module),
site-config.js (coordinator owns), assets/fonts and assets/mascot (coordinator copies).
index.html loads styles.css and type=module app.js. Use no CDN or third-party runtime.

Visual: confident, delightful, mobile-system-matching. Hero headline 'Less guessing.
More gala.' and oversized Gaile; usable phone interaction; generous split layouts.
Navigation, motion, sample chat, selectable route stops, offline preview and FAQ are
real interactions. The preview is explicitly an example, never travel guidance.

Sections/classes and IDs:
- .site-header .container .nav: brand link, links #meet-gaile #try-it #faq, #get-app CTA.
  #menu-toggle button aria-controls=site-nav aria-expanded=false; #site-nav nav.
- .hero .container .hero-grid .hero-copy .hero-art. Mascot assets/mascot/gaile-map.png.
  Headline, short copy, primary href=#get-app, secondary href=#try-it. .hero-note.
  .phone-shell .phone-top .phone-screen with hello and static labeled example UI.
  All meaningful demo controls live in the #try-it section; hero can link to it.
- #meet-gaile .section .container .meet-grid: Gaile wave/think, flowing numbered
  benefits: supported route facts; ask in English/Taglish; guidance after offline setup.
  No claim that GPS/maps or every NCR destination work. No performance promises.
- #try-it .section .demo-section .container .demo-grid: copy left, .demo-panel right.
  #demo-tabs role=tablist: buttons .demo-tab data-view=route|chat|offline; IDs tab-route,
  tab-chat, tab-offline; aria-controls corresponding panel IDs. Initial route selected.
  #panel-route #panel-chat #panel-offline role=tabpanel, only route initially visible.
  Stable .route-stops buttons data-stop=0|1|2|3 with aria-pressed, IDs stop-0..stop-3.
  #stop-title and #stop-description aria-live=polite for selected stop text.
  #demo-step-next and #demo-step-prev buttons, #demo-step-counter.
  Four steps copy exactly from mobile preview: walk to Carousel Monumento; ride
  Carousel to North Avenue; walk to MRT-3 North Avenue; ride MRT-3 to Ayala.
  Display 'Illustrative journey · not travel guidance' and no invented fares/times.
  #chat-log role=log aria-live=polite initially one greeting, #demo-chat-form,
  #demo-query input label/maxlength=240, #demo-send button. .query-chip buttons with
  data-query values 'Saan ako bababa?' / 'May transfer ba?' / 'Paano kung walang data?'.
  #chat-reset button resets only demo. Replies are fixed sample responses, not AI.
  #offline-toggle button role=switch aria-checked=false; #offline-status and
  #offline-description live text. Say 'Offline preview' to make simulation clear.
- #faq .section .container .faq-grid with native details summaries (no duplicate JS
  accordion). Topics NCR coverage, offline setup, local privacy, APK installation and
  scope limitations. FAQ must distinguish bundled routes from model setup (491MB
  model, allow at least 560MB free) and map/GPS/persistence not connected yet.
- #get-app .section .download-section .container .download-grid: Gaile cheer,
  'Ready for your next gala?' title; #download-link initially hidden, #download-unavailable
  visible. Config apkUrl is null until verified APK published, so no fake downloads.
  #download-status role=status and #download-meta. Button get-app nav scrolls here.
  External project link https://github.com/The-Avenir/pussanggala target=_blank rel=noopener.
- .site-footer .container: brand, copyright, back to top link; #back-to-top button optional.
- All .reveal content visible by default; JS adds enhancement class before observer.

CSS worker: own styles.css only. Use the classes and IDs above. HTML worker: own
index.html only, generous additional child classes okay. JS worker: own app.js only,
import {siteConfig} from './site-config.js'; properties apkUrl, version, apkSizeLabel,
releaseNotesUrl. Validate apkUrl same-origin relative or HTTPS. Only reveal link when
valid. Never insert user input with innerHTML. Coordinate using Orca messages if needed.

Root QA: desktop 1440/1024, mobile 390/320; no overflow or missing assets; all tabs,
chips, chat submit/reset, steps, offline switch, menu, FAQ, download status keyboard
functional; zero console/page errors, reduced-motion usable and no third-party requests.
