import { useState, type ReactNode } from "react"

type IconName = "chat" | "map" | "pin" | "bus" | "train" | "arrow" | "back" | "save" | "settings" | "check" | "send" | "download" | "walk" | "layers"
function Icon({ name, size = 20 }: { name: IconName size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    chat: <path d="M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0Z" />,
    map: (
      <>
        <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z" />
        <path d="M9 3v16M15 5v16" />
      </>
    ),
    pin: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    train: (
      <>
        <rect x="5" y="3" width="14" height="16" rx="4" />
        <path d="M5 11h14M12 3v8M8 22l2-3m6 3-2-3M8 15h1m6 0h1" />
      </>
    ),
    bus: (
      <>
        <rect x="4" y="3" width="16" height="17" rx="3" />
        <path d="M4 12h16M8 7h8M7 16h1m8 0h1M7 20v2m10-2v2" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    back: <path d="M20 12H4m6-6-6 6 6 6" />,
    save: <path d="M6 3h12v18l-6-4-6 4Z" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    send: (
      <>
        <path d="m3 3 19 9-19 9 4-9Z" />
        <path d="M7 12h15" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    walk: (
      <>
        <circle cx="14" cy="4" r="2" />
        <path d="m8 11 4-4 4 5 4 1M12 7l-2 8-4 6m4-6 5 2 1 5" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 17l10 5 10-5" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
function Gaile({
  pose = "idle",
  className = "",
}: {
  pose?: string
  className?: string
}) {
  return (
    <img
      className={`gaile ${className}`}
      src={`/mascots/${pose}.png`}
      alt={`Gaile, your travel buddy${pose === "map" ? ", holding a map" : ""}`}
    />
  )
}
function Action({
  children,
  outline = false,
}: {
  children: ReactNode
  outline?: boolean
}) {
  return <div className={`action ${outline ? "outline" : ""}`}>{children}</div>
}
function Chips({ items, selected = -1 }: { items: string[] selected?: number }) {
  return (
    <div className="chips">
      {items.map((item, i) => (
        <div key={item} className={`chip ${i === selected ? "selected" : ""}`}>
          {item}
        </div>
      ))}
    </div>
  )
}
function Message({
  children,
  pose = "idle",
  user = false,
}: {
  children: ReactNode
  pose?: string
  user?: boolean
}) {
  return (
    <div className={`message ${user ? "user" : ""}`}>
      {!user && (
        <div className="avatar">
          <Gaile pose={pose} />
        </div>
      )}
      <div className="bubble">
        {children}
      </div>
    </div>
  )
}
function Composer() {
  return (
    <div className="composer">
      <Icon name="chat" size={17} />
      <span>Message Gaile…</span>
      <span className="send">
        <Icon name="arrow" size={16} />
      </span>
    </div>
  )
}
function Tabs({ active = "Plan" }: { active?: string }) {
  return (
    <div className="tabs">
      {(["Plan", "Map", "Trips"] as const).map((x) => (
        <div className={active === x ? "active" : ""} key={x}>
          <Icon
            name={x === "Plan" ? "chat" : x === "Map" ? "map" : "save"}
            size={19}
          />
          <span>{x}</span>
        </div>
      ))}
    </div>
  )
}
function Phone({
  children,
  title = "Gaile",
  subtitle = "Your Metro Manila travel buddy",
  tab = "Plan",
  chat = true,
  welcome = false,
}: {
  children: ReactNode
  title?: string
  subtitle?: string
  tab?: string
  chat?: boolean
  welcome?: boolean
}) {
  return (
    <div className="phone">
      <div className="status">
        <span>9:41</span>
        <span className="status-icons">
          ▮▮▮{" "}
          <svg width="14" height="12" viewBox="0 0 20 16">
            <path
              d="M2 5q8-7 16 0M5 8q5-4 10 0M8 11q2-2 4 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <span className="battery" />
        </span>
      </div>
      {!welcome && (
        <div className="phone-header">
          {title === "Gaile" ? (
            <div className="header-avatar">
              <Gaile pose="wave" />
            </div>
          ) : (
            <Icon name="back" />
          )}
          <div>
            <strong>{title}</strong>
          </div>
          {title === "Gaile" && (
            <span className="header-more">
              <Icon name="settings" size={18} />
            </span>
          )}
        </div>
      )}
      <div className={`phone-content ${welcome ? "welcome-content" : ""}`}>
        {children}
      </div>
      {!welcome && (
        <div className="phone-footer">
          {chat && <Composer />}
          <Tabs active={tab} />
        </div>
      )}
      <div className="home-indicator" />
    </div>
  )
}
function JourneyBar({ step }: { step: number }) {
  return (
    <div className="journey-bar">
      <div>
        <Icon name={step === 1 ? "bus" : step === 4 ? "walk" : "train"} size={14} /> Biyahe natin
        <span className="step-count">{step} of 4</span>
      </div>
      <strong>
        Monumento <Icon name="arrow" size={12} /> One Ayala
      </strong>
      <div className="progress">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={n <= step ? "filled" : ""} />
        ))}
      </div>
    </div>
  )
}
function RouteCard({
  kind = "train",
  title,
  note,
  price,
  selected = false,
  tag,
}: {
  kind?: "train" | "walk" | "bus"
  title: string
  note: string
  price: string
  selected?: boolean
  tag: string
}) {
  return (
    <div className={`route-card ${selected ? "chosen" : ""}`}>
      <div className="route-top">
        <div className={`transport ${kind}`}>
          <Icon name={kind} size={21} />
        </div>
        <div>
          <strong>{title}</strong>
          <span>{note}</span>
        </div>
        <div className={`radio ${selected ? "checked" : ""}`} />
      </div>
      <div className="route-bottom">
        <span>
          {price} <b>·</b> estimated fare
        </span>
        <small>{tag}</small>
      </div>
    </div>
  )
}
function StopDiagram({
  current = 1,
  large = false,
}: {
  current?: number
  large?: boolean
}) {
  const stops = ["Monumento", "North Avenue", "Ayala", "One Ayala"]
  return (
    <div className={`stop-diagram ${large ? "large" : ""}`}>
      <div className="diagram-label">
        <span>Not to scale</span>
      </div>
      {stops.map((s, i) => (
        <div className={`stop ${i <= current ? "passed" : ""}`} key={s}>
          <span className="stop-dot">{i === current && <span />}</span>
          <div>
            <strong>{s}</strong>
            <small>
              {
                [
                  "EDSA Carousel · board here",
                  "Transfer to MRT-3",
                  "MRT-3 · get off here",
                  "Short walk · destination",
                ][i]
              }
            </small>
          </div>
          {i === current && <span className="here-badge">Last check-in</span>}
        </div>
      ))}
    </div>
  )
}
function Visual({
  type = "station",
  caption = "Look for the MRT-3 entrance",
}: {
  type?: "station" | "sign"
  caption?: string
}) {
  return (
    <div className={`visual ${type}`}>
      <div className="visual-sky" />
      <div className="building">
        <span className="station-sign">
          {type === "sign"
            ? "EXIT → ONE AYALA"
            : "MRT-3 · NORTH AVENUE"}
        </span>
        <div className="station-windows">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="station-door" />
        <div className="station-stairs" />
      </div>
      <span className="visual-caption">
        <Icon name="pin" size={12} />
        {caption}
      </span>
    </div>
  )
}
function Welcome() {
  return (
    <Phone welcome>
      <div className="welcome-brand">
        <img className="app-logo" src="/mascots/logo.png" alt="Pusang Gala app logo" />
        <div>
          Pusang
          <br />
          Gala
        </div>
      </div>
      <div className="welcome-art">
        <div className="sun" />
        <div className="skyline">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <Gaile pose="wave" />
      </div>
      <div className="welcome-copy">
        <h2>Tara, gala tayo!</h2>
        <p>
          Ako si Gaile, ang kasama mo sa biyahe. Let’s explore Metro Manila, one step at a time.
        </p>
      </div>
      <Action>
        Tara, usap tayo <Icon name="arrow" size={17} />
      </Action>
    </Phone>
  )
}
function Destination() {
  return (
    <Phone>
      <div className="gaile-greeting">
        <div className="greeting-copy">
          <strong>Kumusta, gala?</strong>
          <p>Ako si Gaile. Samahan kita, one step at a time.</p>
        </div>
        <Gaile pose="map" />
      </div>
      <Message pose="think">
        Saan tayo punta? Check muna ang landmarks.
      </Message>
      <div className="trip-planner">
        <div className="trip-field">
          <span className="trip-marker origin-marker"><Icon name="pin" size={18} /></span>
          <div className="trip-field-copy">
            <span>From · starting landmark</span>
            <strong>Monumento</strong>
            <small>Caloocan City</small>
          </div>
        </div>
        <div className="trip-location">
          <Action outline>
            <Icon name="pin" size={15} /> Use my location
          </Action>
          <small>Only with your permission</small>
        </div>
        <div className="trip-field destination-field">
          <span className="trip-marker"><Icon name="pin" size={18} /></span>
          <div className="trip-field-copy">
            <span>To · destination</span>
            <strong>One Ayala</strong>
            <small>Makati City</small>
          </div>
          <div className="trip-place-art"><PlaceSketch scene="ayala" /></div>
        </div>
      </div>
      <Action>
        Find routes <Icon name="arrow" size={17} />
      </Action>
    </Phone>
  )
}
function PlaceSketch({ scene }: { scene: string }) {
  return (
    <svg className="place-sketch" viewBox="0 0 140 62" fill="none" aria-hidden="true">
      <circle className="sketch-sun" cx="113" cy="16" r="11" />
      <path className="sketch-ground" d="M8 55h124" />
      <g className="sketch-building" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        {scene === "heritage" ? (
          <>
            <path d="M20 54V30h14v-9h14v9h42v-9h14v9h15v24Z" />
            <path d="M60 54V42a10 10 0 0 1 20 0v12M26 38h8m64 0h8M43 38h8m38 0h-8" />
          </>
        ) : scene === "cubao" ? (
          <>
            <path d="M18 54V32l18-13h69l17 13v22M18 32h104M34 54V39h73v15" />
            <rect x="46" y="38" width="50" height="13" rx="4" />
            <path d="M52 43h13m5 0h13M51 54h41M33 25h72" />
          </>
        ) : scene === "north" ? (
          <>
            <path d="M17 54V29h108v25M29 29V18h47v11M87 29V22h28v7" />
            <path d="M25 38h92M25 45h27m10 0h25m10 0h20M65 54v-9h14v9" />
          </>
        ) : (
          <>
            <path d="M25 54V21h34v33M59 54V12h26v42M85 54V30h32v24M17 54h109" />
            <path d="M32 29h20m-20 8h20m-20 8h20M66 20h12m-12 8h12m-12 8h12M92 38h18m-18 8h18" />
          </>
        )}
      </g>
    </svg>
  )
}
function Origin() {
  return (
    <Phone>
      <Message user>Monumento to One Ayala.</Message>
      <Message pose="map">
        Ito ang biyahe natin. One Ayala is beside Ayala MRT station.
      </Message>
      <div className="place-card">
        <div className="place-icon">
          <Icon name="bus" />
        </div>
        <div>
          <strong>From · Monumento</strong>
          <small>Caloocan City</small>
        </div>
      </div>
      <div className="place-card">
        <div className="place-icon">
          <Icon name="pin" />
        </div>
        <div>
          <strong>To · One Ayala</strong>
          <small>Ayala Center, Makati City</small>
        </div>
        <span className="tiny-check">
          <Icon name="check" size={14} />
        </span>
      </div>
      <Message pose="think">Tama ba ang landmarks natin?</Message>
      <Action>Yes, show routes <Icon name="arrow" size={16} /></Action>
      <Action outline>Edit landmarks</Action>
    </Phone>
  )
}
function Options() {
  return (
    <Phone>
      <Message user>Tama, show routes.</Message>
      <Message pose="map">
        Carousel + MRT-3 ang pick ko: balanse sa pamasahe at lipat.
      </Message>
      <Chips items={["Recommended", "Cheapest", "Fewer transfers"]} selected={0} />
      <RouteCard
        title="Carousel + MRT-3"
        note="Bus → train · 1 transfer"
        price="₱31–44"
        selected
        tag="Gaile’s pick"
      />
      <RouteCard
        kind="bus"
        title="EDSA Carousel"
        note="Direct bus · no transfers"
        price="About ₱59"
        tag="Less switching"
      />
      <RouteCard
        title="LRT-1 + MRT-3"
        note="Train → train · 1 transfer"
        price="₱43–53"
        tag="Another option"
      />
      <div className="estimate-note">
        Estimated fares · actual fares may vary.
      </div>
      <Action>
        Choose Carousel + MRT-3 <Icon name="arrow" size={16} />
      </Action>
    </Phone>
  )
}
function Overview() {
  return (
    <Phone>
      <Message user>Sige, Carousel + MRT-3!</Message>
      <Message pose="compass">
        Carousel to North Avenue, then MRT-3 to Ayala. Gabayan kita sa bawat lipat.
      </Message>
      <div className="summary-card">
        <div>
          <span>
            <strong>₱31–44</strong>
            <small>Estimated fare</small>
          </span>
          <span>
            <strong>1 transfer</strong>
            <small>Bus + train</small>
          </span>
        </div>
      </div>
      <StopDiagram current={-1} />
      <Action>
        Start journey <Icon name="arrow" size={16} />
      </Action>
      <div className="inline-links">
        <span>
          <Icon name="save" size={13} /> Save route
        </span>
        <span>
          <Icon name="map" size={13} /> View diagram
        </span>
      </div>
    </Phone>
  )
}
function Walk() {
  return (
    <Phone>
      <JourneyBar step={1} />
      <Message pose="pointing">
        Sa Carousel boarding area ng Monumento muna tayo. Hanapin ang pedestrian access papunta sa bus platform.
      </Message>
      <div className="instruction-card">
        <strong>EDSA Carousel · Monumento</strong>
        <p>Use the designated pedestrian crossing. Don’t cross the bus lane.</p>
      </div>
      <Message>
        Hanapin ang southbound bus pa-PITX. Kung hindi sigurado sa platform, ask the staff muna.
      </Message>
      <div className="signboard">
        <strong>
          PITX / SOUTHBOUND <Icon name="arrow" size={18} />
        </strong>
      </div>
      <Message pose="binoculars">Kita mo na ang boarding area?</Message>
      <Chips items={["Nandito na", "Hindi pa", "Need help"]} selected={-1} />
    </Phone>
  )
}
function Bus() {
  return (
    <Phone>
      <JourneyBar step={1} />
      <Message user>Nasa platform na ako.</Message>
      <Message>
        Ayos! Sakay sa southbound Carousel. Bago sumakay, confirm sa crew kung titigil sa North Avenue.
      </Message>
      <div className="instruction-card">
        <strong>Carousel → North Avenue</strong>
        <p>
          Keep your belongings close and prepare your fare. We’ll transfer to
          the MRT-3 next.
        </p>
      </div>
      <Message pose="map">
        Sabihin mo kapag nakasakay na. Walang live stop alerts, kaya tingnan ang signs o magtanong sa crew.
      </Message>
      <Chips items={["Nakasakay na", "Waiting pa"]} selected={-1} />
      <div className="offline-note">
        <Icon name="pin" size={15} />
        <span>
          Your check-ins guide our progress.
          <br />
          No live arrival or vehicle tracking.
        </span>
      </div>
    </Phone>
  )
}
function Transfer() {
  return (
    <Phone>
      <JourneyBar step={2} />
      <Message user>Nasa North Avenue na.</Message>
      <Message pose="cheer">
        Dito tayo lilipat! Follow the pedestrian signs to MRT-3 North Avenue.
      </Message>
      <Visual />
      <Message pose="compass">
        Southbound tayo, pa-Taft Avenue. Doon ang train to Ayala.
      </Message>
      <div className="signboard">
        <strong>
          TAFT AVENUE <Icon name="arrow" size={18} />
        </strong>
      </div>
      <Message>Nahanap mo na ang station entrance?</Message>
      <Chips items={["Nandito na", "Need help"]} selected={-1} />
    </Phone>
  )
}
function Ride() {
  return (
    <Phone>
      <JourneyBar step={3} />
      <Message user>Nakasakay na sa MRT!</Message>
      <Message>
        Ayos! Sa Ayala tayo bababa. Makinig sa station announcements.
      </Message>
      <div className="ride-card">
        <div className="transport train">
          <Icon name="train" />
        </div>
        <div>
          <strong>Ayala station</strong>
          <span>MRT-3 · toward Taft Avenue</span>
        </div>
      </div>
      <div className="mini-stops">
        <span>Buendia</span>
        <i />
        <span className="orange">Ayala · baba rito</span>
        <i />
        <span>Magallanes</span>
      </div>
      <Message pose="binoculars">
        Pag narinig ang “Buendia,” get ready. Ayala ang next stop. Walang live alerts, kaya makinig sa announcements.
      </Message>
      <Chips
        items={["I’m at Ayala", "Still on the train", "I missed my stop"]}
        selected={-1}
      />
    </Phone>
  )
}
function Help() {
  return (
    <Phone>
      <JourneyBar step={3} />
      <Message user>Lumampas ako.</Message>
      <Message pose="think">
        Okay lang. Alamin muna natin kung nasaan ka.
      </Message>
      <Message>
        Anong station ka ngayon? Check the name on the platform.
      </Message>
      <Message user>Magallanes.</Message>
      <Message pose="map">
        One station past Ayala ka na. Ask station staff how to reach the northbound platform safely, then ride back to Ayala.
      </Message>
      <div className="tip">
        <Icon name="chat" size={16} /> Never cross the tracks. Follow staff instructions.
      </div>
      <Chips items={["Back at Ayala", "Ask another question"]} selected={-1} />
    </Phone>
  )
}
function LastWalk() {
  return (
    <Phone>
      <JourneyBar step={4} />
      <Message user>Bumaba na ako sa Ayala.</Message>
      <Message pose="walk">
        Konti na lang! Follow the exit signs to One Ayala. Sa designated walkway lang tayo.
      </Message>
      <Visual type="sign" caption="Follow the One Ayala exit signs" />
      <Message pose="pointing">
        Mall entrance ang destination natin. Kung unclear ang exit, ask a station attendant muna.
      </Message>
      <Message>Nasa One Ayala ka na?</Message>
      <Chips items={["Nakarating na!", "Hindi pa", "Need help"]} selected={-1} />
    </Phone>
  )
}
function Arrival() {
  return (
    <Phone chat={false}>
      <div className="arrival-art">
        <div className="celebrate c1">✦</div>
        <div className="celebrate c2">✧</div>
        <div className="celebrate c3">✦</div>
        <Gaile pose="cheer" />
      </div>
      <div className="arrival-copy">
        <h2>Nakarating ka!</h2>
        <p>
          Welcome to One Ayala.
        </p>
      </div>
      <Message pose="cheer">
        Ang galing! Save natin ang route for next time? O planuhin na natin ang pauwi?
      </Message>
      <Action>
        <Icon name="save" size={17} /> Save this route
      </Action>
      <Action outline>
        <Icon name="arrow" size={17} /> Plan a return journey
      </Action>
      <div className="done">
        <Icon name="check" size={15} /> Salamat, Gaile!
      </div>
      <div className="estimate-note">
        Return journeys need a new route check.
      </div>
    </Phone>
  )
}
function MapScreen() {
  return (
    <Phone
      title="Your route"
      subtitle="Monumento → One Ayala"
      tab="Map"
      chat={false}
    >
      <div className="map-notice">
        <Icon name="map" size={16} />
        <span>
          A simple view of your journey.
          <br />
          Stop order only—not a street map.
        </span>
      </div>
      <StopDiagram current={1} large />
      <div className="map-legend">
        <span>
          <i /> Bus · EDSA Carousel
        </span>
        <span>
          <i /> Train · MRT-3
        </span>
      </div>
      <Message pose="map">
        Sa North Avenue tayo lilipat sa MRT-3. Nalilito sa transfer? Tanong mo lang sa akin.
      </Message>
      <Action>
        <Icon name="chat" size={17} /> Back to our conversation
      </Action>
    </Phone>
  )
}
function Trips() {
  return (
    <Phone
      title="Your trips"
      subtitle="A little collection of your galas"
      tab="Trips"
      chat={false}
    >
      <Chips items={["Saved routes", "History"]} selected={0} />
      <Message pose="map">
        Here are your saved routes. Pick one to see the directions again.
      </Message>
      <div className="saved-card">
        <span className="saved-icon">
          <Icon name="train" />
        </span>
        <div>
          <strong>Monumento → One Ayala</strong>
          <small>Carousel + MRT-3 · 1 transfer</small>
          <span>
            Saved just now
          </span>
        </div>
        <Icon name="arrow" size={16} />
      </div>
      <div className="saved-card">
        <span className="saved-icon teal">
          <Icon name="train" />
        </span>
        <div>
          <strong>Cubao → Trinoma</strong>
          <small>MRT-3 · direct</small>
          <span>
            Saved Oct 4
          </span>
        </div>
        <Icon name="arrow" size={16} />
      </div>
      <div className="saved-illustration">
        <Icon name="save" size={24} />
        <div>
          <strong>
            Balikan ang paborito mong biyahe.
          </strong>
          <p>Saved routes stay on your device.</p>
        </div>
      </div>
      <Action>
        <Icon name="chat" size={16} /> Plan another journey
      </Action>
      <div className="tip">
        Route information can change. Check details before traveling again.
      </div>
    </Phone>
  )
}
function Offline() {
  return (
    <Phone
      title="Offline resources"
      subtitle="Prepare before you head out"
      tab="Trips"
      chat={false}
    >
      <Message pose="map">
        Handa bago bumiyahe! Download route data and a map pack habang may internet pa.
      </Message>
      <div className="resource">
        <div className="resource-title">
          <span className="saved-icon">
            <Icon name="chat" />
          </span>
          <div>
            <strong>Local assistant</strong>
            <small>Gaile’s offline conversation pack</small>
          </div>
        </div>
        <div className="download-line">
          <span>Downloading · 72%</span>
          <span>Keep app open</span>
        </div>
        <div className="download-progress">
          <i />
        </div>
        <small className="resource-note">
          Helps explain routes conversationally.
        </small>
      </div>
      {[
        ["Route data", "Routes, stops and fare references", "train"],
        ["NCR map pack", "A street map for offline viewing", "map"],
      ].map(([title, desc, icon]) => (
        <div className="resource" key={title}>
          <div className="resource-title">
            <span className="saved-icon teal">
              <Icon name={icon as IconName} />
            </span>
            <div>
              <strong>{title}</strong>
              <small>{desc}</small>
            </div>
          </div>
          <div className="resource-bottom">
            <span className="missing">Not installed</span>
            <div>
              <Icon name="download" size={13} /> Download
            </div>
          </div>
        </div>
      ))}
      <div className="offline-note">
        <Icon name="pin" size={17} />
        <span>
          Offline doesn’t mean live.
          <br />
          Service changes and arrival times aren’t tracked.
        </span>
      </div>
    </Phone>
  )
}
function About() {
  return (
    <Phone
      title="About Pusang Gala"
      subtitle="A buddy for the journey"
      tab="Trips"
      chat={false}
    >
      <div className="about-hero">
        <img className="app-logo about-logo" src="/mascots/logo.png" alt="Pusang Gala app logo" />
        <h2>
          Small paws.
          <br />
          Big adventures.
        </h2>
      </div>
      <Message>
        Kasama mo sa Metro Manila. Pusang Gala helps you travel with a little more confidence, isang step at a time.
      </Message>
      <div className="about-block">
        <strong>
          <Icon name="map" size={17} /> Read route information carefully
        </strong>
        <p>
          Routes and fares are references, not guarantees. Check signs, official
          updates, and station staff when traveling.
        </p>
      </div>
      <div className="about-block">
        <strong>
          <Icon name="save" size={17} /> Your journey, your privacy
        </strong>
        <p>
          Saved routes and preferences stay on your device. Location is optional
          and always needs your permission.
        </p>
      </div>
      <div className="about-block">
        <strong>
          <Icon name="layers" size={17} /> Made with a little help
        </strong>
        <p>
          Gaile mascot · DM Sans & Nunito
          <br />
          Community route references · Qwen
        </p>
      </div>
      <div className="about-version">
        PUSANG GALA
        <br />
        <span>Made for the everyday Filipino commuter.</span>
      </div>
    </Phone>
  )
}

const sections = [
  {
    id: "plan",
    title: "01",
    name: "Start with a conversation",
    desc: "A warm hello, two simple questions, and a route that makes sense.",
    frames: [
      ["01", "Welcome", "Meet your everyday gala buddy", Welcome],
      [
        "02",
        "Choose a destination",
        "Gaile starts the conversation",
        Destination,
      ],
      [
        "03",
        "Confirm your landmarks",
        "Check both ends before choosing a route",
        Origin,
      ],
      [
        "04",
        "Compare your routes",
        "Helpful choices, not a wall of data",
        Options,
      ],
      [
        "05",
        "The journey at a glance",
        "Set expectations before heading out",
        Overview,
      ],
    ],
  },
  {
    id: "travel",
    title: "02",
    name: "One step. One check-in.",
    desc: "Gaile explains, shows a visual, then waits for you. No live-tracking assumptions.",
    frames: [
      [
        "06",
        "Find your boarding area",
        "Landmark-led guidance + a check-in",
        Walk,
      ],
      [
        "07",
        "Board the Carousel",
        "Confirm the direction before boarding",
        Bus,
      ],
      [
        "08",
        "Make the transfer",
        "A visual cue at the decision point",
        Transfer,
      ],
      ["09", "Ride to Ayala", "Know your stop, without a live alert", Ride],
      [
        "10",
        "A little help getting back",
        "A reassuring branch for a missed stop",
        Help,
      ],
      [
        "11",
        "The final little walk",
        "Exit guidance + arrival confirmation",
        LastWalk,
      ],
      [
        "12",
        "Nakarating ka!",
        "Celebrate, save, or plan the way home",
        Arrival,
      ],
    ],
  },
  {
    id: "extras",
    title: "03",
    name: "Everything else, close at hand",
    desc: "Supporting screens that keep the conversation—not the dashboard—at the center.",
    frames: [
      [
        "13",
        "Your route, visualized",
        "An honest schematic, not a live map",
        MapScreen,
      ],
      ["14", "Saved routes", "Keep your familiar journeys nearby", Trips],
      [
        "15",
        "Ready for offline",
        "Clear resource and download states",
        Offline,
      ],
      [
        "16",
        "About & privacy",
        "A friendly companion with clear limits",
        About,
      ],
    ],
  },
]

export default function App() {
  const [zoom, setZoom] = useState(75)
  const [active, setActive] = useState("all")
  return (
    <div className="studio">
      <header className="studio-header">
        <div className="studio-logo">
          <span className="studio-logo-icon">
            <Icon name="layers" size={20} />
          </span>
          <strong>Pusang Gala</strong>
          <span className="header-divider" />
          <span className="file-title">Mobile experience / Product design</span>
        </div>
        <div className="header-right">
          <span className="design-status">
            <i /> UI handoff
          </span>
          <span className="version">v.01</span>
        </div>
      </header>
      <div className="board-toolbar">
        <nav className="board-nav" aria-label="Board sections">
          {[
            ["all", "All screens", "16"],
            ["plan", "Plan a journey", "05"],
            ["travel", "Guided travel", "07"],
            ["extras", "Supporting screens", "04"],
          ].map(([id, label, count]) => (
            <button
              key={id}
              className={active === id ? "active" : ""}
              onClick={() => setActive(id)}
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </nav>
        <div className="board-tools">
          <span>
            <i className="orange-dot" /> Mobile screens
          </span>
          <div className="zoom-control">
            <button
              aria-label="Zoom out"
              onClick={() => setZoom(Math.max(40, zoom - 10))}
            >
              −
            </button>
            <button aria-label="Reset zoom" onClick={() => setZoom(75)}>
              {zoom}%
            </button>
            <button
              aria-label="Zoom in"
              onClick={() => setZoom(Math.min(120, zoom + 10))}
            >
              +
            </button>
          </div>
        </div>
      </div>
      <main className="canvas">
        <div className="board-intro">
          <div>
            <div className="board-eyebrow">
              <span /> THE CONVERSATIONAL COMMUTE
            </div>
            <h1>
              A travel buddy.
              <br />
              <span>Not another directions app.</span>
            </h1>
            <p>
              Meet Gaile. A chat-first journey through Metro Manila,
              <br />
              with a little reassurance at every turn.
            </p>
          </div>
          <div className="design-note">
            <div className="note-title">
              <Icon name="chat" size={16} /> THE IDEA
            </div>
            <p>
              Gaile explains.
              <br />A visual helps.
              <br />
              <strong>You tell him when you’re ready.</strong>
            </p>
            <span>16 mobile frames · 3 chapters · 1 friendly guide</span>
          </div>
        </div>
        <div className="board-scale" style={{ zoom: zoom / 100 }}>
          {sections
            .filter((s) => active === "all" || s.id === active)
            .map((section) => (
              <section className="flow-section" key={section.id}>
                <div className="section-header">
                  <span className="section-number">{section.title}</span>
                  <div>
                    <h2>{section.name}</h2>
                    <p>{section.desc}</p>
                  </div>
                  <span className="section-pill">
                    {section.frames.length} FRAMES
                  </span>
                </div>
                <div className="frames">
                  {section.frames.map(([number, title, desc, Component]) => {
                    const Screen = Component as () => ReactNode
                    return (
                      <article className="frame" key={number as string}>
                        <div className="frame-label">
                          <span>{number as string}</span>
                          <strong>{title as string}</strong>
                        </div>
                        <Screen />
                        <div className="frame-caption">
                          <span className="caption-line" />
                          {desc as string}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
        </div>
        <footer className="board-footer">
          <span>PUSANG GALA / MOBILE EXPERIENCE</span>
          <span>
            Conversational guidance · Traveler check-ins · Offline preparation
          </span>
          <span>DM Sans + Nunito / 2026</span>
        </footer>
      </main>
    </div>
  )
}
