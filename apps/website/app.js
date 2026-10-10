import { siteConfig } from './site-config.js';

const byId = (id) => document.getElementById(id);
const setText = (id, text) => {
  const element = byId(id);
  if (element) element.textContent = text;
};
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

// A little personality, with the same interaction available to keyboard users.
const hellos = [
  { pose: 'cheer', text: 'Hello, gala buddy! Ready for a little adventure?' },
  { pose: 'think', text: 'New route? One question at a time. Kaya natin ’to.' },
  { pose: 'map', text: 'A little less “saan na?” A little more “tara na.”' },
  { pose: 'wave', text: 'Tara, gala! Explore a commuter story below.' },
];
let helloIndex = 0;
byId('say-hi')?.addEventListener('click', () => {
  const hello = hellos[helloIndex++ % hellos.length];
  const mascot = document.querySelector('.meet-mascot');
  if (mascot) mascot.src = `./assets/mascot/gaile-${hello.pose}.png`;
  setText('gaile-greeting', hello.text);
});

const heroArt = document.querySelector('.hero-art');
if (heroArt && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
  const resetArt = () => {
    heroArt.style.setProperty('--gaile-x', '0px');
    heroArt.style.setProperty('--gaile-y', '0px');
  };
  heroArt.addEventListener('pointermove', (event) => {
    if (reducedMotion?.matches) return;
    const bounds = heroArt.getBoundingClientRect();
    heroArt.style.setProperty('--gaile-x', `${((event.clientX-bounds.left)/bounds.width-.5)*12}px`);
    heroArt.style.setProperty('--gaile-y', `${((event.clientY-bounds.top)/bounds.height-.5)*10}px`);
  });
  heroArt.addEventListener('pointerleave', resetArt);
  reducedMotion?.addEventListener?.('change', resetArt);
}

// The nav remains ordinary visible navigation until this enhancement runs.
const menuToggle = byId('menu-toggle');
const siteNav = byId('site-nav');
if (menuToggle && siteNav) {
  const mobile = window.matchMedia?.('(max-width: 767px)');
  let menuOpen = false;
  const updateMenu = (open, restoreFocus = false) => {
    menuOpen = Boolean(open && mobile?.matches);
    menuToggle.setAttribute('aria-expanded', String(menuOpen));
    menuToggle.setAttribute('aria-label', menuOpen ? 'Close navigation' : 'Open navigation');
    siteNav.classList.toggle('is-open', menuOpen);
    document.documentElement.classList.toggle('menu-open', menuOpen);
    siteNav.hidden = Boolean(mobile?.matches && !menuOpen);
    if (restoreFocus) menuToggle.focus();
  };
  menuToggle.addEventListener('click', () => updateMenu(!menuOpen));
  siteNav.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a[href]')) updateMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuOpen) {
      event.preventDefault();
      updateMenu(false, true);
    }
  });
  document.addEventListener('click', (event) => {
    if (menuOpen && !siteNav.contains(event.target) && !menuToggle.contains(event.target)) {
      updateMenu(false);
    }
  });
  const onViewportChange = () => {
    const focusInNav = siteNav.contains(document.activeElement);
    updateMenu(false, Boolean(mobile?.matches && focusInNav));
  };
  mobile?.addEventListener?.('change', onViewportChange);
  updateMenu(false);
}

const moments = [
  {
    kicker: 'Moment 01',
    title: 'Choosing a ride',
    question: 'Which vehicle actually goes there?',
    description: 'At a busy stop, a commuter sees several possible rides and has to decide which one reaches the destination.',
    insight: 'Before boarding, the commuter needs a clear way to connect a destination with the right ride.',
  },
  {
    kicker: 'Moment 02',
    title: 'Making a transfer',
    question: 'Where do I change rides?',
    description: 'The first ride ends before the destination, and the commuter needs to find where the next part of the journey begins.',
    insight: 'A transfer is easier to understand when the change point and next boarding place are clear.',
  },
  {
    kicker: 'Moment 03',
    title: 'Losing connection',
    question: 'What if my signal disappears?',
    description: 'Partway through the journey, the commuter loses mobile signal while away from familiar streets.',
    insight: 'The commuter needs key journey details to remain available when mobile data is unreliable.',
  },
];

const journey = byId('try-it');
const momentButtons = [...(journey?.querySelectorAll('.journey-moment[data-moment]') ?? [])];
const momentReveal = byId('moment-reveal');
const momentInsight = byId('moment-insight');
let currentMoment = 0;

const setInsightOpen = (open) => {
  const expanded = Boolean(open && momentInsight);
  momentReveal?.setAttribute('aria-expanded', String(expanded));
  if (momentInsight) momentInsight.hidden = !expanded;
};

const selectMoment = (index) => {
  if (!Number.isInteger(index) || index < 0 || index >= moments.length) return;
  if (index !== currentMoment) setInsightOpen(false);
  currentMoment = index;
  const moment = moments[index];
  journey.dataset.activeMoment = String(index);
  momentButtons.forEach((button) => {
    const active = Number(button.dataset.moment) === index;
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('is-active', active);
  });
  setText('moment-kicker', moment.kicker);
  setText('moment-title', moment.title);
  setText('moment-question', moment.question);
  setText('moment-description', moment.description);
  setText('moment-count', `${index + 1} of ${moments.length}`);
  if (momentInsight) {
    const copy = momentInsight.querySelector('p:last-of-type') ?? momentInsight;
    copy.textContent = moment.insight;
  }
};
let navigateMoment = (index) => selectMoment(index);

if (journey && momentButtons.length) {
  const initial = momentButtons.find((button) => button.getAttribute('aria-pressed') === 'true');
  const initialIndex = Number(initial?.dataset.moment ?? 0);
  momentReveal?.setAttribute('aria-controls', 'moment-insight');
  setInsightOpen(false);
  selectMoment(Number.isInteger(initialIndex) && initialIndex >= 0 && initialIndex < moments.length ? initialIndex : 0);

  momentButtons.forEach((button) => {
    button.addEventListener('click', () => navigateMoment(Number(button.dataset.moment)));
  });
  byId('journey-prev')?.addEventListener('click', () => navigateMoment((currentMoment - 1 + moments.length) % moments.length));
  byId('journey-next')?.addEventListener('click', () => navigateMoment((currentMoment + 1) % moments.length));
  momentReveal?.addEventListener('click', () => setInsightOpen(momentReveal.getAttribute('aria-expanded') !== 'true'));

  journey.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const focusedMoment = event.target instanceof Element ? event.target.closest('.journey-moment') : null;
    const focusedIndex = Number(focusedMoment?.dataset.moment);
    const baseIndex = focusedMoment && Number.isInteger(focusedIndex) ? focusedIndex : currentMoment;
    navigateMoment((baseIndex + direction + moments.length) % moments.length);
    if (focusedMoment) {
      momentButtons.find((button) => Number(button.dataset.moment) === currentMoment)?.focus();
    }
  });
}

// The page keeps its native scrolling; the sticky panel simply follows progress.
const journeyTrack = journey?.querySelector('.journey-track');
const journeyPanel = journey?.querySelector('.journey-panel');
const journeyStory = journey?.querySelector('.journey-story');
if (journeyTrack && journeyPanel && journeyStory) {
  let scrollEnabled = false;
  let scrollDistance = 0;
  let pinTop = 0;
  let scrollFrame = 0;
  let layoutFrame = 0;
  let measuredPanelHeight = 0;

  const trackStart = () => journeyTrack.getBoundingClientRect().top + window.scrollY - pinTop;
  const updateScroll = () => {
    scrollFrame = 0;
    if (!scrollEnabled) return;
    const progress = Math.max(0, Math.min(1, (window.scrollY - trackStart()) / scrollDistance));
    journey.style.setProperty('--journey-progress', String(progress));
    const index = Math.min(moments.length - 1, Math.floor(progress * moments.length));
    if (index !== currentMoment) selectMoment(index);
    const hint = journey.querySelector('.journey-scroll-hint');
    const copy = index === 2 ? '↓ Keep scrolling to the next section' : '↓ Keep scrolling to follow the journey';
    if (hint && hint.textContent !== copy) hint.textContent = copy;
  };
  const queueScroll = () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  };
  const measureJourney = () => {
    layoutFrame = 0;
    journey.classList.add('journey-measuring');
    const previousMoment = currentMoment;
    const expanded = momentReveal?.getAttribute('aria-expanded') === 'true';
    journey.style.removeProperty('--journey-story-height');
    scrollEnabled = !reducedMotion?.matches;
    journey.classList.toggle('journey-scroll-enabled', scrollEnabled);
    if (scrollEnabled) {
      pinTop = (document.querySelector('.site-header')?.getBoundingClientRect().height ?? 72) + 16;
      journey.style.setProperty('--journey-pin-top', `${pinTop}px`);
      let storyHeight = 0;
      moments.forEach((_, index) => {
        selectMoment(index);
        storyHeight = Math.max(storyHeight, journeyStory.getBoundingClientRect().height);
      });
      journey.style.setProperty('--journey-story-height', `${Math.ceil(storyHeight)}px`);
      selectMoment(previousMoment);
      setInsightOpen(expanded);
      measuredPanelHeight = Math.ceil(journeyPanel.getBoundingClientRect().height);
      // Short viewports and enlarged text retain the ordinary manual controls.
      scrollEnabled = measuredPanelHeight + pinTop + 16 <= window.innerHeight;
      journey.classList.toggle('journey-scroll-enabled', scrollEnabled);
      if (scrollEnabled) {
        scrollDistance = Math.max(900, Math.round(window.innerHeight * 2.4));
        journey.style.setProperty('--journey-panel-height', `${measuredPanelHeight}px`);
        journey.style.setProperty('--journey-scroll-distance', `${scrollDistance}px`);
        measuredPanelHeight = Math.ceil(journeyPanel.getBoundingClientRect().height);
      }
    }
    journey.classList.remove('journey-measuring');
    queueScroll();
  };
  const queueLayout = () => {
    if (!layoutFrame) layoutFrame = requestAnimationFrame(measureJourney);
  };
  navigateMoment = (index) => {
    selectMoment(index);
    if (!scrollEnabled && !reducedMotion?.matches) measureJourney();
    if (scrollEnabled) {
      window.scrollTo({ top: trackStart() + scrollDistance * (index + .3) / moments.length, behavior: 'instant' });
      queueScroll();
    }
  };
  window.addEventListener('scroll', queueScroll, { passive: true });
  window.addEventListener('resize', queueLayout, { passive: true });
  window.addEventListener('pageshow', queueLayout);
  reducedMotion?.addEventListener?.('change', queueLayout);
  momentReveal?.addEventListener('click', queueLayout);
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (scrollEnabled && Math.abs(journeyPanel.getBoundingClientRect().height - measuredPanelHeight) > 1) queueLayout();
    }).observe(journeyPanel);
  }
  (document.fonts?.ready ?? Promise.resolve()).then(queueLayout);
}

const safeDownloadUrl = (value) => {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value, window.location.href);
    if (url.username || url.password || url.hash) return null;
    if (url.protocol === 'https:' || (url.origin === window.location.origin && url.protocol === 'http:')) return url.href;
  } catch {
    // Invalid configuration keeps the honest unavailable state.
  }
  return null;
};
const downloadLink = byId('download-link');
const unavailable = byId('download-unavailable');
const apkUrl = safeDownloadUrl(siteConfig?.apkUrl);
if (downloadLink) {
  downloadLink.hidden = !apkUrl;
  if (apkUrl) {
    downloadLink.href = apkUrl;
    downloadLink.removeAttribute('aria-disabled');
    downloadLink.rel = 'noopener noreferrer';
    if (new URL(apkUrl).origin !== window.location.origin) downloadLink.removeAttribute('download');
  } else {
    downloadLink.removeAttribute('href');
    downloadLink.setAttribute('aria-disabled', 'true');
    downloadLink.removeAttribute('download');
  }
}
if (unavailable) unavailable.hidden = Boolean(apkUrl && downloadLink);
setText('download-status', apkUrl && downloadLink ? 'Browse the project’s Android releases on GitHub for release notes and any published APK assets.' : 'The Android release link is currently unavailable.');
setText('download-meta', apkUrl && downloadLink
  ? 'Opens the release listing. The local assistant model is installed separately from the app.'
  : 'Check the project for release updates.');

// Content stays visible if motion is reduced, the observer is unavailable or setup fails.
const revealElements = [...document.querySelectorAll('.reveal')];
if (!reducedMotion?.matches && 'IntersectionObserver' in window) {
  try {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible', 'is-revealed');
          entry.target.classList.remove('reveal-pending');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    revealElements.forEach((element) => observer.observe(element));
    document.documentElement.classList.add('has-reveal', 'reveal-enhanced');
    revealElements.forEach((element) => element.classList.add('reveal-ready'));
    reducedMotion?.addEventListener?.('change', (event) => {
      if (event.matches) {
        observer.disconnect();
        document.documentElement.classList.remove('has-reveal');
        revealElements.forEach((element) => element.classList.add('is-visible', 'is-revealed'));
      }
    });
  } catch {
    document.documentElement.classList.remove('has-reveal');
    revealElements.forEach((element) => element.classList.add('is-visible', 'is-revealed'));
  }
}
byId('back-to-top')?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: reducedMotion?.matches ? 'auto' : 'smooth' });
  document.querySelector('.site-header a')?.focus({ preventScroll: true });
});
