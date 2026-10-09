# Task: independent UX review and browser acceptance

Target: Pusang Gala's mobile preview and its supplied visual direction. User requests a playful iOS / Duolingo-like interface using existing sunset colors and supplied Gaile artwork, removing the SVG cat logo, and centering home on "Where to go?" with ChatGPT-like conversation. Reference image `.tmp/playful-chat-reference.png`. Current branch is `feat/t46-travel-ux-redesign`, latest commit `58427dd`.

Ownership: edit only `apps/mobile/scripts/check-ui.mjs` and add `docs/playful-chat-review.md`. Another Claude Kiro worker owns all app source. Coordinator owns existing design docs, screenshots and git. Do not edit app source, manifests, lockfiles, theme.ts, mascot.tsx, tsconfig.json or native/core code. Do not commit, install, push or merge. Do not delegate further. Credentials and raw travel dataset are outside task; never read or send them.

Read `docs/ux-redesign.md`, the current browser checks, `apps/mobile/assets/mascot/README.md` and the reference. Begin an independent short task/visual audit in the new review note, naming the desired hierarchy, purposeful mascot use, conversational entry, accessibility and current-release boundaries. Review the implementation when it becomes available; annotate actual findings, not merely aspirations.

Implementation contract shared with worker:
- Golden mascot hero, cream/orange/brown, rounded bold headings/controls, no SVG cat brand logo. Functional SVG icons remain permitted.
- Launch onboarding retained; one "Plan a journey" action enters home.
- Home has "Where to go?", existing Gaile, and sticky composer with textbox accessibility label "Ask Pusang Gala" and button "Send question". Sending transitions to conversation and preserves exact message once.
- Manual form initially collapsed; "Enter landmarks" opens existing endpoint controls, swap, Find routes, location. Preserve toggle state on return from resource screens.
- Home retains Try an example journey, Offline resources, How Pusang Gala works. Conversation keeps other options, directions, map and contextual follow-ups.
- Native features remain explicitly unavailable; examples require explicit selection. All original manual trip/saved/privacy journeys remain.

Update existing browser flows for this hierarchy. Add a meaningful home-to-chat query check (exact message, scope failure / no silent synthetic route), then return to home and unfold Enter landmarks before existing manual form tests. Assert supplied mascot usage and that a custom SVG cat brand mark is absent without banning functional icons. Capture home, onboarding, empty chat, conversation and all current route/trip/resource/settings states at 320/390/430px, including 200% home/keyboard text stress tests. If text tokens change, use actual token contrast pairs. Reuse current tests rather than duplicating implementation. Wait until implementation is stable before running browser tests; coordinator exports and runs the final suite.

Acceptance: coherent review note, runnable updated tests with original meaningful acceptance preserved, additional home-to-chat and manual disclosure assertions. Report findings/file list via live Orca preamble; read follow-ups at checkpoints and before worker_done.
