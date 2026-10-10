# Website visual system

The scene: a commuter checks the site on a phone in daylight before an unfamiliar
journey; the page should feel like meeting the app's friendly commute companion.

Use the existing mobile identity, with a committed sunset orange/gold palette on
warm cream. Tokens from apps/mobile/src/ui/travel.tsx: ink #2E1C14, secondary #756052,
accent #BA3B16, orange #F34B16, gold #FFB729, paper #FFF9EF, background #FFF0DD,
goldSoft #FFF0C6, accentSoft #FFE9D8, rail #345D73, line #E8D3BE.
Use CSS variables; colors may be expressed as equivalent OKLCH values.

Typography: local Nunito ExtraBold/Bold for large playful headings and local DM Sans
Regular/Bold for body and controls. These are established brand choices. Use clamp()
for display sizing, generous line height and body lines no longer than 65–75ch.

Art direction: oversized Gaile illustration and an interactive rounded phone on the
hero; a route-line visual motif; generous asymmetric whitespace; gold sections;
warm dark footer. The reference is app onboarding/home, not a generic card-grid site.
Use supplied PNG mascots and app line-icon paths, with decorative icons hidden from
screen readers. No remote assets, gradient text, glass panels or new stock artwork.

Controls: rounded gold primary buttons with a firm bottom shadow, warm outlined
secondary buttons, tactile hover/active effects, tab and chip selection, native details
FAQ. Animate opacity/transform only. Respect prefers-reduced-motion. Keep motion
restrained enough to read; all interactions must also work by keyboard.

Responsive layout: desktop split hero, mobile single column with an accessible nav
toggle; site-wide horizontal overflow is forbidden, including at 320px and 200% text.
