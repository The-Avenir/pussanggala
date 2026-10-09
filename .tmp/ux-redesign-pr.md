The existing UI distributes the commute across slides, a decorative map, repeated cards and an accountless Profile tab. This change organizes it into Plan, Map and Trips, adds a contextual multi-turn conversation, turns directions into a continuous timeline, and prioritizes the current action and alighting landmark during a trip.

The final visual system preserves Pusang Gala's Sunset Playful identity: golden onboarding, cream surfaces, warm orange actions and the supplied Gaile artwork in welcome, home, chat, empty trips and completion. Onboarding opens each fresh preview session and can be replayed from Plan. Native integration must persist its completion flag so returning users open planning directly.

Scope remains NCR-only with bundled resources, foreground GPS and manual progress. The app is still a UI preview: fixture journeys require explicit example mode; real searches and unavailable native capabilities are disclosed. No routing/core/AI contract or native adapter is changed.

Includes the original-interface audit, navigation/task journeys, low-fidelity wireframes, high-fidelity review with before/after and width controls, a shared visual system, native state contracts and actual screenshot evidence.

Validation: mobile/root TypeScript; 424 core tests; 37 existing UI asset hashes; source-content scan and 12 regression tests; browser flows at 320/390/430 px with networking disabled after loading; onboarding start/replay and mascot presence; keyboard sheets; 200% text for onboarding/Plan/chat/directions/active/settings; >=44px targets and AA text contrast; Android/iOS Hermes and web compilation. Native device, outdoor accessibility, cold-offline and release acceptance remain pending.

Tasks: T46 design preview; T45 and native release gates remain open. Based on the original walkthrough UI branch (draft PR #18); coordinate its merge/base before opening the redesign PR. Another member must review before merge. Existing local manifest/theme/mascot/config edits are excluded from this change.
