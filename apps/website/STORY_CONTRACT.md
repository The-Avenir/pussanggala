# Landing journey replacement

Replace the entire route/chat/offline demo card in `#try-it` with a website-only interactive commuter story. Keep `id="try-it"` for links, but rename all demo copy and calls to action to “Explore the journey”. Do not present app controls or simulated route advice.

Three illustrative moments: 0 Choosing a ride (“Which vehicle actually goes there?”), 1 Making a transfer (“Where do I change rides?”), 2 Losing connection (“What if my signal disappears?”). Each moment has a short situation and a revealed insight about the commuter need. Label it “Illustrative commuter story”. No claims that these are real routes or user interviews.

Shared DOM contract: `.journey-moment` buttons have `data-moment="0|1|2"`, `aria-pressed`; `#moment-kicker`, `#moment-title`, `#moment-question`, `#moment-description`, `#moment-count`; `#journey-prev`, `#journey-next`; `#moment-reveal` with `aria-expanded` controlling `#moment-insight`, which starts hidden. Use buttons for interaction, clear focus styles and reduced-motion support. Decorative route line / marker may animate when moment changes. JS owns active state and content; HTML supplies initial moment. Preserve the existing navigation and APK download logic.

Success: old The Route / Ask Gaile / Offline tab card and all its page controls gone; three distinct story interactions work by click and keyboard; mobile layout fits 320px; no fabricated route results, app capability, usage statistics, or external network assets.

Scroll revision: `.journey-track` provides native scroll distance while its panel
stays sticky. Scroll progress selects moments 1, 2 and 3, then releases the panel
into the FAQ; scrolling up reverses the sequence. Stage buttons remain available
and synchronize scroll position. Reduced motion or insufficient viewport space
uses the ordinary manual controls without a tall sticky track. Content changes
animate only opacity and transforms; no wheel/touch events are intercepted.
