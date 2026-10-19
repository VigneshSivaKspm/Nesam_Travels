"""
Process and generate all People Taxi brand assets from the user-provided official assets:
- Source: people_taxi/public/icons/logo.jpeg and banner.jpeg + favicon/icon suite
- Outputs:
  * people_taxi/public/brand/icon.png (high-res circular emblem, transparent)
  * people_taxi/public/brand/icon-512.png (512x512)
  * people_taxi/public/brand/icon-192.png (192x192)
  * people_taxi/public/brand/logo.png (cropped horizontal lockup, transparent)
  * people_taxi/public/brand/logo-white.png (horizontal lockup with white text for dark mode, transparent)
  * people_taxi/public/brand/banner.png (high-res marketing & social sharing banner)
  * people_taxi/public/brand/icon.svg, logo.svg, logo-white.svg
  * people_taxi/public/favicon.png, favicon.ico, favicon.svg
  * people_taxi/public/browserconfig.xml & manifest.webmanifest
"""

import os
import shutil
import base64
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
ICONS_DIR = os.path.join(PUBLIC_DIR, 'icons')
BRAND_DIR = os.path.join(PUBLIC_DIR, 'brand')

os.makedirs(BRAND_DIR, exist_ok=True)

LOGO_JPEG = os.path.join(ICONS_DIR, 'logo.jpeg')
BANNER_JPEG = os.path.join(ICONS_DIR, 'banner.jpeg')

print(f"Reading brand sources from: {ICONS_DIR}")

# ─────────────────────────────────────────────────────────────────────────────
# 1. PROCESS EMBLEM ICON (from logo.jpeg)
# ─────────────────────────────────────────────────────────────────────────────
if os.path.exists(LOGO_JPEG):
    print("Processing logo.jpeg into transparent emblem...")
    logo_img = Image.open(LOGO_JPEG)
    logo_arr = np.array(logo_img)
    
    # Precise center and radius of circular emblem
    cx, cy = 635.5, 603.0
    r = 525.0
    
    # 4x supersampled circular mask for ultra-smooth antialiasing
    scale = 4
    mask = Image.new('L', (logo_img.width * scale, logo_img.height * scale), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse([
        (cx - r) * scale,
        (cy - r) * scale,
        (cx + r) * scale,
        (cy + r) * scale
    ], fill=255)
    mask = mask.resize(logo_img.size, Image.Resampling.LANCZOS)
    
    # Combine RGBA
    logo_rgba = logo_img.convert('RGBA')
    logo_rgba.putalpha(mask)
    
    # Crop to tight square bounding box centered on emblem
    side = int(r * 2 + 10)
    crop_box = (
        max(0, int(cx - side/2)),
        max(0, int(cy - side/2)),
        min(logo_img.width, int(cx + side/2)),
        min(logo_img.height, int(cy + side/2))
    )
    emblem_square = logo_rgba.crop(crop_box)
    
    # Save master icon.png
    icon_path = os.path.join(BRAND_DIR, 'icon.png')
    emblem_square.save(icon_path, 'PNG', optimize=True)
    print(f"Saved: {icon_path} ({emblem_square.size})")
    
    # Save icon-512.png
    icon_512 = emblem_square.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save(os.path.join(BRAND_DIR, 'icon-512.png'), 'PNG', optimize=True)
    print("Saved: brand/icon-512.png")
    
    # Save icon-192.png
    icon_192 = emblem_square.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save(os.path.join(BRAND_DIR, 'icon-192.png'), 'PNG', optimize=True)
    print("Saved: brand/icon-192.png")
    
    # Save public/favicon.png
    favicon_png = emblem_square.resize((96, 96), Image.Resampling.LANCZOS)
    favicon_png.save(os.path.join(PUBLIC_DIR, 'favicon.png'), 'PNG', optimize=True)
    print("Saved: public/favicon.png")

# Copy favicon.ico to public root if present
if os.path.exists(os.path.join(ICONS_DIR, 'favicon.ico')):
    shutil.copy2(os.path.join(ICONS_DIR, 'favicon.ico'), os.path.join(PUBLIC_DIR, 'favicon.ico'))
    print("Copied: public/favicon.ico")

# ─────────────────────────────────────────────────────────────────────────────
# 2. PROCESS HORIZONTAL LOCKUP & BANNER (from banner.jpeg)
# ─────────────────────────────────────────────────────────────────────────────
if os.path.exists(BANNER_JPEG):
    print("Processing banner.jpeg into transparent logo & banner...")
    banner_img = Image.open(BANNER_JPEG)
    banner_arr = np.array(banner_img).astype(np.float32)
    
    # Tight content crop
    is_content = (banner_arr[:,:,0] < 240) | (banner_arr[:,:,1] < 240) | (banner_arr[:,:,2] < 240)
    cols = np.where(is_content.any(axis=0))[0]
    rows = np.where(is_content.any(axis=1))[0]
    pad = 16
    ymin = max(0, rows[0] - pad)
    ymax = min(banner_arr.shape[0], rows[-1] + pad + 1)
    xmin = max(0, cols[0] - pad)
    xmax = min(banner_arr.shape[1], cols[-1] + pad + 1)
    crop = banner_arr[ymin:ymax, xmin:xmax]
    
    # Detect asphalt road inside emblem (left 38%)
    emblem_w = int(crop.shape[1] * 0.38)
    asphalt_mask = (crop[:, :emblem_w, 0] < 80) & (crop[:, :emblem_w, 1] < 80) & (crop[:, :emblem_w, 2] < 80)
    asphalt_img = Image.fromarray(asphalt_mask.astype(np.uint8) * 255)
    dilated_asphalt = np.array(asphalt_img.filter(ImageFilter.MaxFilter(25))) > 0
    
    # White road stripe identification
    is_white = (crop[:,:,0] >= 238) & (crop[:,:,1] >= 238) & (crop[:,:,2] >= 238)
    is_road_stripe = np.zeros((crop.shape[0], crop.shape[1]), dtype=bool)
    is_road_stripe[:, :emblem_w] = is_white[:, :emblem_w] & dilated_asphalt
    
    # Soft alpha calculation for smooth edge blending
    lum = 0.299 * crop[:,:,0] + 0.587 * crop[:,:,1] + 0.114 * crop[:,:,2]
    alpha = np.ones((crop.shape[0], crop.shape[1]), dtype=np.float32) * 255.0
    
    non_stripe = ~is_road_stripe
    # Smooth fade from 232 (alpha 255) to 250 (alpha 0)
    alpha[non_stripe] = np.clip((250.0 - lum[non_stripe]) / 22.0 * 255.0, 0, 255.0)
    
    # Unmix background color from semi-transparent edge pixels for zero halo
    a_norm = (alpha / 255.0)[:, :, None]
    unmixed = crop.copy()
    mask_unmix = (a_norm[:,:,0] > 0.05) & (a_norm[:,:,0] < 0.98) & non_stripe
    bg_color = np.array([253.0, 253.0, 253.0])
    for c in range(3):
        unmixed[mask_unmix, c] = np.clip(
            (crop[mask_unmix, c] - (1.0 - a_norm[mask_unmix, 0]) * bg_color[c]) / a_norm[mask_unmix, 0],
            0, 255
        )
    
    # Build standard logo.png
    rgba = np.zeros((crop.shape[0], crop.shape[1], 4), dtype=np.uint8)
    rgba[:,:,:3] = np.clip(unmixed, 0, 255).astype(np.uint8)
    rgba[:,:,3] = alpha.astype(np.uint8)
    
    logo_img = Image.fromarray(rgba, 'RGBA')
    logo_path = os.path.join(BRAND_DIR, 'logo.png')
    logo_img.save(logo_path, 'PNG', optimize=True)
    print(f"Saved: {logo_path} ({logo_img.size})")
    
    # Build high-resolution social banner (padded cleanly)
    banner_out = Image.fromarray(crop.astype(np.uint8))
    banner_path = os.path.join(BRAND_DIR, 'banner.png')
    # Save as high-res banner for OG cards
    banner_out.save(banner_path, 'PNG', optimize=True)
    print(f"Saved: {banner_path} ({banner_out.size})")
    
    # Build logo-white.png for dark backgrounds / footer
    # In text region, convert dark TAXI text to pure crisp white #FFFFFF
    white_unmixed = unmixed.copy()
    is_dark_text = (crop[:,:,0] < 85) & (crop[:,:,1] < 85) & (crop[:,:,2] < 85) & (np.arange(crop.shape[1])[None, :] >= emblem_w)
    white_unmixed[is_dark_text, 0] = 255
    white_unmixed[is_dark_text, 1] = 255
    white_unmixed[is_dark_text, 2] = 255
    
    rgba_white = np.zeros((crop.shape[0], crop.shape[1], 4), dtype=np.uint8)
    rgba_white[:,:,:3] = np.clip(white_unmixed, 0, 255).astype(np.uint8)
    rgba_white[:,:,3] = alpha.astype(np.uint8)
    
    logo_white_img = Image.fromarray(rgba_white, 'RGBA')
    logo_white_path = os.path.join(BRAND_DIR, 'logo-white.png')
    logo_white_img.save(logo_white_path, 'PNG', optimize=True)
    print(f"Saved: {logo_white_path} ({logo_white_img.size})")

# ─────────────────────────────────────────────────────────────────────────────
# 3. VECTOR SVG WRAPPERS (FOR HIGH-DPI & VECTOR REFERENCES)
# ─────────────────────────────────────────────────────────────────────────────
def create_svg_wrapper(png_path, svg_path, view_w, view_h):
    with open(png_path, 'rb') as f:
        b64_data = base64.b64encode(f.read()).decode('utf-8')
    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {view_w} {view_h}" width="{view_w}" height="{view_h}">
  <image width="{view_w}" height="{view_h}" href="data:image/png;base64,{b64_data}" preserveAspectRatio="xMidYMid meet" />
</svg>'''
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print(f"Generated SVG wrapper: {svg_path}")

create_svg_wrapper(
    os.path.join(BRAND_DIR, 'icon.png'),
    os.path.join(BRAND_DIR, 'icon.svg'),
    512, 512
)
create_svg_wrapper(
    os.path.join(BRAND_DIR, 'icon.png'),
    os.path.join(PUBLIC_DIR, 'favicon.svg'),
    512, 512
)
create_svg_wrapper(
    os.path.join(BRAND_DIR, 'logo.png'),
    os.path.join(BRAND_DIR, 'logo.svg'),
    840, 268
)
create_svg_wrapper(
    os.path.join(BRAND_DIR, 'logo-white.png'),
    os.path.join(BRAND_DIR, 'logo-white.svg'),
    840, 268
)

# ─────────────────────────────────────────────────────────────────────────────
# 4. FIX & SYNC BROWSERCONFIG.XML AND MANIFEST FILES
# ─────────────────────────────────────────────────────────────────────────────
# Update browserconfig.xml
BROWSERCONFIG_XML = """<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square70x70logo src="/icons/ms-icon-70x70.png"/>
      <square150x150logo src="/icons/ms-icon-150x150.png"/>
      <square310x310logo src="/icons/ms-icon-310x310.png"/>
      <TileColor>#1E6CE3</TileColor>
    </tile>
  </msapplication>
</browserconfig>
"""

with open(os.path.join(PUBLIC_DIR, 'browserconfig.xml'), 'w', encoding='utf-8') as f:
    f.write(BROWSERCONFIG_XML)
with open(os.path.join(ICONS_DIR, 'browserconfig.xml'), 'w', encoding='utf-8') as f:
    f.write(BROWSERCONFIG_XML)
print("Updated browserconfig.xml in public/ and public/icons/")

# Update icons/manifest.json
ICONS_MANIFEST_JSON = """{
  "name": "People Taxi — Outstation Cabs & Drop Taxi",
  "short_name": "People Taxi",
  "icons": [
    { "src": "/icons/android-icon-36x36.png", "sizes": "36x36", "type": "image/png", "density": "0.75" },
    { "src": "/icons/android-icon-48x48.png", "sizes": "48x48", "type": "image/png", "density": "1.0" },
    { "src": "/icons/android-icon-72x72.png", "sizes": "72x72", "type": "image/png", "density": "1.5" },
    { "src": "/icons/android-icon-96x96.png", "sizes": "96x96", "type": "image/png", "density": "2.0" },
    { "src": "/icons/android-icon-144x144.png", "sizes": "144x144", "type": "image/png", "density": "3.0" },
    { "src": "/icons/android-icon-192x192.png", "sizes": "192x192", "type": "image/png", "density": "4.0" }
  ]
}
"""

with open(os.path.join(ICONS_DIR, 'manifest.json'), 'w', encoding='utf-8') as f:
    f.write(ICONS_MANIFEST_JSON)
print("Updated icons/manifest.json")

print("\nAll brand assets processed successfully!")
