"""Regenerate launcher icon assets from assets/mascot/Gaile App Icon.png.

Outputs:
  assets/icon.png           1024x1024 (full-bleed, expo.icon)
  assets/adaptive-icon.png  1024x1024 (artwork inside adaptive safe zone)
  assets/favicon.png        512x512   (web.favicon)
  android mipmap webp files + _preview PNGs (generated dirs, gitignored)
"""
import math
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "mascot", "Gaile App Icon.png")

# Adaptive icon spec: 108dp canvas, inner 72dp circle always visible.
# On a 1024px canvas the safe-circle radius is 1024 * (72/2) / 108 = 341.3px.
SAFE_RADIUS = 1024 * 36 / 108
MARGIN = 6  # keep artwork a few px inside the safe circle


def artwork(im):
    """Source cropped to its opaque bounding box."""
    return im.crop(im.getbbox())


def max_opaque_radius(canvas):
    """Farthest opaque-pixel distance from canvas centre."""
    a = canvas.getchannel("A")
    w, h = canvas.size
    cx = cy = (w - 1) / 2
    bbox = a.getbbox()
    if not bbox:
        return 0
    maxd = 0
    px = a.load()
    for y in range(bbox[1], bbox[3]):
        for x in range(bbox[0], bbox[2]):
            if px[x, y] > 16:
                d = math.hypot(x - cx, y - cy)
                if d > maxd:
                    maxd = d
    return maxd


def compose_adaptive(art, canvas_size=1024):
    """Scale artwork to the largest size that stays inside the safe circle."""
    lo, hi = 64, canvas_size
    best = None
    while hi - lo > 2:
        s = (lo + hi) // 2
        c = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
        r = art.resize((s, s), Image.LANCZOS)
        c.paste(r, ((canvas_size - s) // 2, (canvas_size - s) // 2), r)
        if max_opaque_radius(c) <= SAFE_RADIUS - MARGIN:
            best, lo = c, s
        else:
            hi = s
    return best


def save(im, *parts):
    p = os.path.join(ROOT, *parts)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p)
    print("wrote", os.path.relpath(p, ROOT), im.size)


def main():
    src = Image.open(SRC).convert("RGBA")
    art = artwork(src)

    icon = src.resize((1024, 1024), Image.LANCZOS)
    favicon = src.resize((512, 512), Image.LANCZOS)
    adaptive = compose_adaptive(art)

    save(icon, "assets", "icon.png")
    save(adaptive, "assets", "adaptive-icon.png")
    save(favicon, "assets", "favicon.png")

    # Generated Android resources (gitignored; mirrors expo prebuild output).
    for dpi, size in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96),
                      ("xxhdpi", 144), ("xxxhdpi", 192)]:
        icon.resize((size, size), Image.LANCZOS).save(
            os.path.join(ROOT, "android", "app", "src", "main", "res",
                         f"mipmap-{dpi}", "ic_launcher.webp"), "WEBP", quality=95)
        icon.resize((size, size), Image.LANCZOS).save(
            os.path.join(ROOT, "android", "app", "src", "main", "res",
                         f"mipmap-{dpi}", "ic_launcher_round.webp"), "WEBP", quality=95)
    for dpi, size in [("mdpi", 108), ("hdpi", 162), ("xhdpi", 216),
                      ("xxhdpi", 324), ("xxxhdpi", 432)]:
        adaptive.resize((size, size), Image.LANCZOS).save(
            os.path.join(ROOT, "android", "app", "src", "main", "res",
                         f"mipmap-{dpi}", "ic_launcher_foreground.webp"), "WEBP", quality=95)
    print("wrote android mipmap webp files")

    icon.save(os.path.join(ROOT, "android", "_preview", "ic_launcher.png"))
    icon.save(os.path.join(ROOT, "android", "_preview", "ic_launcher_round.png"))
    adaptive.save(os.path.join(ROOT, "android", "_preview", "ic_launcher_foreground.png"))
    print("wrote android/_preview PNGs")


if __name__ == "__main__":
    main()
