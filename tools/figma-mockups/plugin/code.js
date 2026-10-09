// Pusang Gala Mockup Builder — main thread.
// The UI iframe fetches the spec and PNG bytes from serve.mjs and posts them
// here; this file does all Figma API work. Two commands:
//   inventory — resolve design-system objects, report only
//   build     — create the "Walkthrough additions" page and render 8 screens

figma.showUI(__html__, { width: 360, height: 480 });

const PAGE_NAME = 'Pusang Gala / Walkthrough additions';
const POSES = ['compass', 'wave', 'think', 'pointing', 'map', 'walk', 'cheer', 'binoculars', 'idle'];
const FONTS = [
  { family: 'Nunito', style: 'ExtraBold' },
  { family: 'Nunito', style: 'Bold' },
  { family: 'DM Sans', style: 'Regular' },
  { family: 'DM Sans', style: 'Bold' },
];

const errors = [];
const warnings = [];
const say = (text, isErr) => figma.ui.postMessage({ type: 'log', text, isErr: !!isErr });
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ---------- helpers ----------

function readPngSize(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function paddingOf(p) {
  if (p === undefined) return null;
  if (typeof p === 'number') return { t: p, r: p, b: p, l: p };
  return { t: p[0], r: p[1], b: p[2], l: p[3] };
}

// ---------- resolution caches ----------

let TOK = null;                 // tokens.json
let localVars = null;           // figma variables, by name
let localStyles = null;         // text styles, by name
let localComps = null;          // components, by name
let iconSet = null;             // COMPONENT_SET 'Pusang Gala/Icon' if present
let gaileSet = null;            // COMPONENT_SET 'Pusang Gala/Gaile'
const loadedFonts = new Set();

async function getVar(name) {
  if (!localVars) {
    localVars = new Map();
    for (const v of await figma.variables.getLocalVariablesAsync()) localVars.set(v.name, v);
  }
  return localVars.get(name) || null;
}

async function getStyle(name) {
  if (!localStyles) {
    localStyles = new Map();
    const list = figma.getLocalTextStylesAsync
      ? await figma.getLocalTextStylesAsync()
      : figma.getLocalTextStyles();
    for (const s of list) localStyles.set(s.name, s);
  }
  return localStyles.get(name) || null;
}

async function getComponents() {
  if (!localComps) {
    localComps = new Map();
    const list = figma.getLocalComponentsAsync
      ? await figma.getLocalComponentsAsync()
      : figma.root.findAll((n) => n.type === 'COMPONENT');
    for (const c of list) localComps.set(c.name, c);
    const sets = figma.getLocalComponentSetsAsync
      ? await figma.getLocalComponentSetsAsync()
      : figma.root.findAll((n) => n.type === 'COMPONENT_SET');
    iconSet = sets.find((s) => s.name === 'Pusang Gala/Icon') || null;
  }
  return localComps;
}

async function colorPaint(token) {
  const hex = TOK.colors[token];
  if (!hex) { err(`unknown color token "${token}"`); return { type: 'SOLID', color: { r: 1, g: 0, b: 1 } }; }
  const paint = { type: 'SOLID', color: hexToRgb(hex) };
  const varName = TOK.variableNames[token];
  const v = varName ? await getVar(varName) : null;
  if (v) return figma.variables.setBoundVariableForPaint(paint, 'color', v);
  warn(`color "${token}": variable ${varName || '?'} not found, used literal ${hex}`);
  return paint;
}

async function loadFont(f) {
  const key = f.family + '/' + f.style;
  if (loadedFonts.has(key)) return true;
  try { await figma.loadFontAsync(f); loadedFonts.add(key); return true; }
  catch { return false; }
}

const STYLE_FALLBACK_FONT = {
  Display: { family: 'Nunito', style: 'ExtraBold' },
  Title: { family: 'Nunito', style: 'ExtraBold' },
  Heading: { family: 'Nunito', style: 'Bold' },
  Label: { family: 'DM Sans', style: 'Bold' },
  Body: { family: 'DM Sans', style: 'Regular' },
  Caption: { family: 'DM Sans', style: 'Regular' },
};

async function makeText(spec) {
  const t = figma.createText();
  const font = STYLE_FALLBACK_FONT[spec.style] || STYLE_FALLBACK_FONT.Body;
  if (!(await loadFont(font))) err(`font ${font.family} ${font.style} failed to load (style ${spec.style}, "${spec.chars.slice(0, 24)}…")`);
  try { t.fontName = font; } catch { /* font missing; still set chars so the node exists */ }
  t.characters = spec.chars;
  const figmaName = TOK.figmaTextStyleNames[spec.style];
  const style = figmaName ? await getStyle(figmaName) : null;
  if (style) {
    try { await t.setTextStyleIdAsync(style.id); }
    catch { warn(`text style "${figmaName}" could not be applied`); }
  } else {
    const fb = TOK.textStyles[spec.style];
    warn(`text style "${figmaName || spec.style}" not found, used literals`);
    if (fb) {
      t.fontSize = fb.size;
      t.lineHeight = { value: fb.lineHeight, unit: 'PIXELS' };
    }
  }
  t.fills = [await colorPaint(spec.color || 'ink')];
  if (spec.align) t.textAlignHorizontal = spec.align.toUpperCase();
  if (spec.align === 'center' || spec.align === 'right') {
    t.textAutoResize = 'NONE';
    t.layoutAlign = 'STRETCH';
  } else if (spec.w) {
    t.textAutoResize = 'NONE';
    t.resize(spec.w, t.height);
  } else {
    t.textAutoResize = 'HEIGHT';
    t.layoutAlign = 'STRETCH';
  }
  if (spec.grow) t.layoutGrow = 1;
  if (spec.chars) t.name = spec.chars.slice(0, 40);
  return t;
}

async function findComponent(name) {
  const comps = await getComponents();
  if (comps.has(name)) return comps.get(name);
  err(`component "${name}" not found`);
  return null;
}

async function makeInstance(spec) {
  const comp = await findComponent(spec.component);
  if (!comp) return placeholder(`${spec.component} (missing)`, spec.w, spec.h);
  const inst = comp.createInstance();
  if (spec.props) {
    for (const [prop, val] of Object.entries(spec.props)) {
      const key = Object.keys(inst.componentProperties).find((k) => k.split('#')[0] === prop);
      if (key) {
        try { inst.setProperties({ [key]: val }); }
        catch (e) { err(`setProperties ${prop} on "${spec.component}": ${e.message}`); }
      } else warn(`"${spec.component}" has no "${prop}" property; left default`);
    }
  }
  if (spec.w !== undefined || spec.h !== undefined) {
    try { inst.resize(spec.w ?? inst.width, spec.h ?? inst.height); }
    catch (e) { warn(`resize instance "${spec.component}": ${e.message}`); }
  }
  inst.name = spec.component.split('/').pop();
  return inst;
}

async function makeIcon(spec) {
  const target = `Pusang Gala/Icon/${spec.name}`;
  const comps = await getComponents();
  let comp = comps.get(target) || null;
  if (!comp && iconSet) {
    comp = iconSet.children.find(
      (c) => c.type === 'COMPONENT' && c.name.split('=').pop() === spec.name
    ) || null;
  }
  if (!comp) {
    err(`icon "${target}" not found`);
    return placeholder(`icon:${spec.name}`, spec.size, spec.size);
  }
  const inst = comp.createInstance();
  try { inst.resize(spec.size, spec.size); } catch { /* variant may not resize cleanly */ }
  inst.name = `icon/${spec.name}`;
  return inst;
}

async function makeGaile(spec) {
  if (!gaileSet) { err('Gaile component set not built'); return placeholder('gaile', 64, 64); }
  const variant = gaileSet.children.find(
    (c) => c.type === 'COMPONENT' && c.name.split('=').pop() === spec.pose
  );
  if (!variant) { err(`Gaile variant pose=${spec.pose} not found`); return placeholder(`gaile:${spec.pose}`, 64, 64); }
  const inst = variant.createInstance();
  const side = Math.max(spec.w, spec.h); // variants are square; keep the shared scale
  inst.resize(side, side);
  inst.name = `Gaile/${spec.pose}`;
  return inst;
}

function placeholder(label, w, h) {
  const f = figma.createFrame();
  f.name = `MISSING ${label}`;
  f.resize(w || 40, h || 40);
  f.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 1 }, opacity: 0.2 }];
  f.strokes = [{ type: 'SOLID', color: { r: 1, g: 0, b: 1 } }];
  f.strokeWeight = 1;
  f.dashPattern = [4, 4];
  return f;
}

// ---------- frame + node renderer ----------

async function renderNode(spec) {
  switch (spec.type) {
    case 'frame': return renderFrame(spec);
    case 'text': return makeText(spec);
    case 'instance': return makeInstance(spec);
    case 'icon': return makeIcon(spec);
    case 'gaile': return makeGaile(spec);
    case 'pill': return renderPillLike(spec, [4, 10]);
    case 'chip': return renderPillLike(spec, [8, 14]);
    case 'spacer': {
      const f = figma.createFrame();
      f.name = 'spacer';
      f.fills = [];
      f.resize(1, spec.h);
      return f;
    }
    default:
      err(`unknown node type "${spec.type}"`);
      return placeholder(spec.type, 40, 40);
  }
}

async function renderPillLike(spec, pad) {
  const f = figma.createFrame();
  f.name = spec.type;
  f.layoutMode = 'HORIZONTAL';
  f.counterAxisAlignItems = 'CENTER';
  const p = paddingOf(pad);
  f.paddingTop = p.t; f.paddingRight = p.r; f.paddingBottom = p.b; f.paddingLeft = p.l;
  f.cornerRadius = 999;
  f.fills = [await colorPaint(spec.fill || 'surface')];
  if (spec.stroke && spec.stroke !== 'none') {
    f.strokes = [await colorPaint(spec.stroke)];
    f.strokeWeight = 1;
  }
  f.appendChild(await makeText({ type: 'text', style: 'Caption', color: spec.color || 'ink', chars: spec.chars }));
  return f;
}

async function renderFrame(spec) {
  const f = figma.createFrame();
  f.name = spec.name || spec.type;
  if (spec.dir) {
    f.layoutMode = spec.dir === 'row' ? 'HORIZONTAL' : 'VERTICAL';
    f.primaryAxisSizingMode = 'AUTO';
    f.counterAxisSizingMode = 'AUTO';
    if (spec.gap !== undefined) f.itemSpacing = spec.gap;
  }
  const p = paddingOf(spec.padding);
  if (p) { f.paddingTop = p.t; f.paddingRight = p.r; f.paddingBottom = p.b; f.paddingLeft = p.l; }

  if (spec.fill) f.fills = [await colorPaint(spec.fill)];
  else f.fills = [];
  if (spec.stroke) {
    f.strokes = [await colorPaint(spec.stroke.color)];
    f.strokeWeight = spec.stroke.weight ?? 1;
  }
  if (spec.radius !== undefined) f.cornerRadius = spec.radius;
  if (spec.clip) f.clipsContent = true;
  if (spec.opacity !== undefined) f.opacity = spec.opacity;

  if (spec.align && f.layoutMode) {
    const col = f.layoutMode === 'VERTICAL';
    const fixedPrimary = spec.h !== undefined && col ? 'h' : (spec.w !== undefined && !col ? 'w' : null);
    if (spec.align === 'between') f.primaryAxisAlignItems = 'SPACE_BETWEEN';
    else if (spec.align === 'center') {
      f.counterAxisAlignItems = 'CENTER';
      if (fixedPrimary) f.primaryAxisAlignItems = 'CENTER'; // fixed-size frames centre children on both axes
    }
    else if (spec.align === 'start') f.counterAxisAlignItems = 'MIN';
    else if (spec.align === 'end') f.counterAxisAlignItems = 'MAX';
  }

  for (const child of spec.children || []) f.appendChild(await renderNode(child));
  applySize(f, spec);
  if (spec.grow) f.layoutGrow = 1;
  return f;
}

function applySize(f, spec) {
  const hasW = spec.w !== undefined, hasH = spec.h !== undefined;
  if (!hasW && !hasH) return;
  if ('layoutSizingHorizontal' in f) {
    if (hasW) f.layoutSizingHorizontal = 'FIXED';
    if (hasH) f.layoutSizingVertical = 'FIXED';
    f.resize(hasW ? spec.w : f.width, hasH ? spec.h : f.height);
  } else {
    f.resize(hasW ? spec.w : f.width, hasH ? spec.h : f.height);
    if (hasW && !hasH && f.layoutMode === 'VERTICAL') f.primaryAxisSizingMode = 'AUTO';
    if (hasH && !hasW && f.layoutMode === 'HORIZONTAL') f.primaryAxisSizingMode = 'AUTO';
  }
}

// ---------- bands ----------

async function statusBarBand() {
  const spec = TOK.bands.statusBar;
  const f = figma.createFrame();
  f.name = 'Status bar';
  f.layoutMode = 'HORIZONTAL';
  f.primaryAxisAlignItems = 'SPACE_BETWEEN';
  f.counterAxisAlignItems = 'CENTER';
  f.paddingLeft = f.paddingRight = spec.paddingX;
  f.fills = [];
  f.appendChild(await makeText({ type: 'text', style: spec.textStyle, color: spec.color, chars: spec.left }));
  f.appendChild(await makeText({ type: 'text', style: spec.textStyle, color: spec.color, chars: spec.right }));
  applySize(f, { w: TOK.phone.width, h: spec.height });
  return f;
}

async function appBarBand(spec) {
  const band = TOK.bands.appBar;
  const f = figma.createFrame();
  f.name = 'App bar';
  f.layoutMode = 'HORIZONTAL';
  f.counterAxisAlignItems = 'CENTER';
  f.itemSpacing = 12;
  f.paddingLeft = f.paddingRight = band.paddingX;
  f.fills = [];
  if (spec.leadingIcon) f.appendChild(await makeIcon({ type: 'icon', name: spec.leadingIcon, size: 24 }));
  if (spec.mascotPose) f.appendChild(await makeGaile({ type: 'gaile', pose: spec.mascotPose, w: 32, h: 32 }));
  f.appendChild(await makeText({ type: 'text', style: 'Heading', color: 'ink', grow: true, chars: spec.title || '' }));
  if (spec.trailingIcon) f.appendChild(await makeIcon({ type: 'icon', name: spec.trailingIcon, size: 24 }));
  applySize(f, { w: TOK.phone.width, h: band.height });
  return f;
}

async function bottomActionBand(nodeSpec) {
  const band = TOK.bands.bottomAction;
  const f = figma.createFrame();
  f.name = 'Bottom action';
  f.layoutMode = 'HORIZONTAL';
  f.primaryAxisAlignItems = 'CENTER';
  f.counterAxisAlignItems = 'CENTER';
  f.paddingTop = band.paddingTop;
  f.paddingBottom = band.paddingBottom;
  f.paddingLeft = f.paddingRight = band.paddingX;
  f.fills = [await colorPaint(band.fill)];
  if (nodeSpec) f.appendChild(await renderNode(nodeSpec));
  applySize(f, { w: TOK.phone.width, h: band.height });
  return f;
}

async function contentBand(screen) {
  const band = TOK.bands.screenContent;
  const f = figma.createFrame();
  f.name = 'Screen content';
  f.layoutMode = 'VERTICAL';
  f.itemSpacing = band.gap;
  const p = paddingOf(band.padding);
  f.paddingTop = p.t; f.paddingRight = p.r; f.paddingBottom = p.b; f.paddingLeft = p.l;
  f.fills = [];
  f.clipsContent = true;
  f.layoutGrow = 1;
  for (const child of screen.content) f.appendChild(await renderNode(child));
  applySize(f, { w: TOK.phone.width });
  return f;
}

async function phoneFrame(screen) {
  const ph = TOK.phone;
  const f = figma.createFrame();
  f.name = `Phone ${screen.id}`;
  f.layoutMode = 'VERTICAL';
  f.primaryAxisSizingMode = 'FIXED';
  f.counterAxisSizingMode = 'FIXED';
  f.fills = [await colorPaint(ph.fill)];
  f.strokes = [await colorPaint(ph.strokeColor)];
  f.strokeWeight = ph.strokeWeight;
  f.cornerRadius = ph.cornerRadius;
  f.clipsContent = true;
  f.effects = [{
    type: 'DROP_SHADOW', visible: true, blendMode: 'NORMAL',
    color: { r: 46 / 255, g: 28 / 255, b: 20 / 255, a: 0.12 },
    offset: { x: ph.shadow.x, y: ph.shadow.y },
    radius: ph.shadow.blur, spread: 0,
  }];
  if (screen.bands.statusBar) f.appendChild(await statusBarBand());
  if (screen.bands.appBar && screen.appBar) f.appendChild(await appBarBand(screen.appBar));
  f.appendChild(await contentBand(screen));
  if (screen.bands.bottomAction) f.appendChild(await bottomActionBand(screen.bottomActionNode));
  f.resize(ph.width, ph.height);
  return f;
}

// ---------- inventory ----------

async function runInventory() {
  const pages = figma.root.children.map((p) => ({ id: p.id, name: p.name }));
  const comps = await getComponents();
  const sets = figma.getLocalComponentSetsAsync
    ? await figma.getLocalComponentSetsAsync()
    : figma.root.findAll((n) => n.type === 'COMPONENT_SET');
  const pgComponents = [
    ...[...comps.values()].filter((c) => c.name.startsWith('Pusang Gala/')).map((c) => ({ id: c.id, name: c.name, kind: 'COMPONENT' })),
    ...sets.filter((s) => s.name.startsWith('Pusang Gala/')).map((s) => ({ id: s.id, name: s.name, kind: 'COMPONENT_SET' })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const vars = (await figma.variables.getLocalVariablesAsync())
    .filter((v) => v.name.startsWith('pg-'))
    .map((v) => ({ id: v.id, name: v.name, type: v.resolvedType }));
  const styles = (await (figma.getLocalTextStylesAsync ? figma.getLocalTextStylesAsync() : Promise.resolve(figma.getLocalTextStyles())))
    .map((s) => ({ id: s.id, name: s.name, font: `${s.fontName.family} ${s.fontName.style}`, size: s.fontSize }));
  const fonts = {};
  for (const f of FONTS) fonts[`${f.family} ${f.style}`] = await loadFont(f);
  return {
    page: PAGE_NAME,
    pages,
    components: pgComponents,
    variables: vars.sort((a, b) => a.name.localeCompare(b.name)),
    textStyles: styles,
    fonts,
  };
}

// ---------- build ----------

async function buildGaileSet(page, images) {
  const comps = [];
  for (const pose of POSES) {
    const bytes = images[pose];
    if (!bytes) { err(`no image bytes for pose "${pose}"`); continue; }
    const { w, h } = readPngSize(bytes);
    const img = figma.createImage(new Uint8Array(bytes));
    const comp = figma.createComponent();
    comp.name = `pose=${pose}`;
    comp.resize(512, 512);
    comp.fills = [];
    const rect = figma.createRectangle();
    rect.name = 'art';
    rect.resize(w, h);
    rect.x = (512 - w) / 2;
    rect.y = (512 - h) / 2;
    rect.fills = [{ type: 'IMAGE', imageHash: img.hash, scaleMode: 'FILL' }];
    comp.appendChild(rect);
    comps.push(comp);
  }
  if (comps.length !== POSES.length) { err('Gaile component set incomplete'); return null; }
  const set = figma.combineAsVariants(comps, page, 0);
  set.name = 'Pusang Gala/Gaile';
  return set;
}

async function runBuild(spec) {
  TOK = spec.tokens;
  await getComponents(); // prime caches
  for (const f of FONTS) await loadFont(f);

  let page = figma.root.children.find((p) => p.name === PAGE_NAME);
  if (page) {
    for (const c of [...page.children]) c.remove();
    say(`reusing existing page "${PAGE_NAME}" (cleared)`);
  } else {
    page = figma.createPage();
    page.name = PAGE_NAME;
  }
  await figma.setCurrentPageAsync(page);

  // Gaile component set
  gaileSet = await buildGaileSet(page, spec.images);

  // Presentation header
  const GRID_Y = 96;
  const title = await makeText({ type: 'text', style: 'Title', color: 'ink', chars: 'Pusang Gala' });
  title.x = 0; title.y = 0;
  const subtitle = await makeText({
    type: 'text', style: 'Caption', color: 'muted',
    chars: 'Walkthrough screens 0, 4, 5, 10, 11, 12, 13a, 14 · Sunset Playful',
  });
  subtitle.x = 0; subtitle.y = 40;
  page.appendChild(title); page.appendChild(subtitle);

  const rc = TOK.reviewCard;
  const grid = TOK.grid;
  const COLS = 4;

  for (let i = 0; i < spec.screens.screens.length; i++) {
    const screen = spec.screens.screens[i];
    const wrap = figma.createFrame();
    wrap.name = `Review / ${screen.id}`;
    wrap.resize(rc.width, rc.height);
    wrap.fills = [];
    wrap.x = (i % COLS) * grid.columnStride;
    wrap.y = GRID_Y + Math.floor(i / COLS) * grid.rowStride;

    const label = await makeText({ type: 'text', style: rc.titleStyle, color: 'ink', chars: screen.label });
    label.x = 0; label.y = 0;
    const sub = await makeText({ type: 'text', style: rc.subtitleStyle, color: rc.subtitleColor, chars: screen.subtitle });
    sub.x = 0; sub.y = 30;
    const phone = await phoneFrame(screen);
    phone.x = 0; phone.y = rc.phoneOffsetY;
    wrap.appendChild(label); wrap.appendChild(sub); wrap.appendChild(phone);
    page.appendChild(wrap);
    say(`built ${screen.id}`);
  }

  if (gaileSet) {
    gaileSet.x = COLS * grid.columnStride + 60;
    gaileSet.y = GRID_Y;
  }
  figma.viewport.scrollAndZoomIntoView(page.children);
}

// ---------- message handling ----------

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'inventory') {
      const data = await runInventory();
      const lines = [
        `Pages (${data.pages.length}): ${data.pages.map((p) => `${p.name} [${p.id}]`).join(', ')}`,
        `Pusang Gala components (${data.components.length}):`,
        ...data.components.map((c) => `  ${c.kind} ${c.name}`),
        `pg-* variables (${data.variables.length}):`,
        ...data.variables.map((v) => `  ${v.name} (${v.type})`),
        `Text styles (${data.textStyles.length}):`,
        ...data.textStyles.map((s) => `  ${s.name} — ${s.font} ${s.size}`),
        `Fonts:`,
        ...Object.entries(data.fonts).map(([k, ok]) => `  ${k}: ${ok ? 'ok' : 'FAILED TO LOAD'}`),
      ];
      figma.ui.postMessage({ type: 'inventory-result', text: lines.join('\n'), data });
    } else if (msg.type === 'build') {
      errors.length = 0; warnings.length = 0;
      TOK = msg.spec.tokens;
      await runBuild(msg.spec);
      figma.ui.postMessage({
        type: 'done',
        text: `Build finished: ${errors.length} error(s), ${warnings.length} note(s).`,
        errors, warnings,
      });
      if (errors.length === 0) figma.notify('Pusang Gala mock-ups built.');
      else figma.notify(`Build finished with ${errors.length} error(s) — see plugin window.`, { error: true });
    }
  } catch (e) {
    figma.ui.postMessage({ type: 'done', text: 'FATAL: ' + e.message + '\n' + (e.stack || ''), errors: errors.concat([e.message]), warnings });
  }
};
