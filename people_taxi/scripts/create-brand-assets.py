"""
Generate high-fidelity vector SVGs and raster PNGs for People Taxi branding:
- Logo (SVG + PNG)
- White Logo for dark/blue backgrounds (SVG)
- App Icon & Favicon (SVG + PNG)
"""

import os
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
BRAND_DIR = os.path.join(PUBLIC_DIR, 'brand')
os.makedirs(BRAND_DIR, exist_ok=True)

# 1. Horizontal Logo SVG (Light Background)
LOGO_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 90" width="420" height="90" fill="none">
  <defs>
    <linearGradient id="pt_blue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="100%" stop-color="#1D4ED8" />
    </linearGradient>
    <linearGradient id="pt_cyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#0284C7" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#1E3A8A" flood-opacity="0.15" />
    </filter>
  </defs>

  <!-- Emblem / Badge -->
  <g transform="translate(10, 10)" filter="url(#shadow)">
    <!-- Rounded Shield / Base -->
    <rect x="0" y="0" width="70" height="70" rx="18" fill="url(#pt_blue)" />
    
    <!-- Stylized Taxi Roof & Twin People Transit Wave -->
    <!-- Car Top Silhouette -->
    <path d="M18 42 L24 28 C26 24 30 22 35 22 C40 22 44 24 46 28 L52 42 Z" fill="white" opacity="0.95" />
    
    <!-- Car Body / Bottom Bar -->
    <rect x="14" y="42" width="42" height="12" rx="4" fill="white" />
    
    <!-- Taxi Light on Top -->
    <rect x="30" y="16" width="10" height="5" rx="2" fill="url(#pt_cyan)" />
    
    <!-- Wheels / People Dots -->
    <circle cx="23" cy="54" r="5" fill="#1D4ED8" />
    <circle cx="23" cy="54" r="2.5" fill="white" />
    <circle cx="47" cy="54" r="5" fill="#1D4ED8" />
    <circle cx="47" cy="54" r="2.5" fill="white" />

    <!-- People Symbol inside Car Window -->
    <circle cx="30" cy="31" r="3.5" fill="url(#pt_blue)" />
    <circle cx="40" cy="31" r="3.5" fill="url(#pt_cyan)" />
    <path d="M25 39 C25 35 35 35 35 39 Z" fill="url(#pt_blue)" />
    <path d="M35 39 C35 35 45 35 45 39 Z" fill="url(#pt_cyan)" />
  </g>

  <!-- Typography -->
  <!-- "PEOPLE" -->
  <text x="96" y="50" font-family="'Poppins', 'Segoe UI', system-ui, sans-serif" font-size="34" font-weight="900" fill="#0F172A" letter-spacing="-0.5">PEOPLE</text>
  
  <!-- "TAXI" with accent color -->
  <text x="238" y="50" font-family="'Poppins', 'Segoe UI', system-ui, sans-serif" font-size="34" font-weight="900" fill="#2563EB" letter-spacing="-0.5">TAXI</text>
  
  <!-- Tagline / Subtitle -->
  <text x="98" y="70" font-family="'Poppins', 'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748B" letter-spacing="1.8">INTERCITY &amp; DROP CABS</text>
  
  <!-- Verified Badge Dot -->
  <circle cx="332" cy="40" r="4.5" fill="#38BDF8" />
</svg>
"""

# 2. Horizontal Logo SVG (White for Dark/Blue Backgrounds)
LOGO_WHITE_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 90" width="420" height="90" fill="none">
  <defs>
    <linearGradient id="pt_blue_w" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#2563EB" />
    </linearGradient>
  </defs>

  <g transform="translate(10, 10)">
    <rect x="0" y="0" width="70" height="70" rx="18" fill="white" />
    <path d="M18 42 L24 28 C26 24 30 22 35 22 C40 22 44 24 46 28 L52 42 Z" fill="#1D4ED8" />
    <rect x="14" y="42" width="42" height="12" rx="4" fill="#1D4ED8" />
    <rect x="30" y="16" width="10" height="5" rx="2" fill="#38BDF8" />
    <circle cx="23" cy="54" r="5" fill="#0F172A" />
    <circle cx="23" cy="54" r="2.5" fill="white" />
    <circle cx="47" cy="54" r="5" fill="#0F172A" />
    <circle cx="47" cy="54" r="2.5" fill="white" />
    <circle cx="30" cy="31" r="3.5" fill="white" />
    <circle cx="40" cy="31" r="3.5" fill="#38BDF8" />
  </g>

  <text x="96" y="50" font-family="'Poppins', 'Segoe UI', system-ui, sans-serif" font-size="34" font-weight="900" fill="#FFFFFF" letter-spacing="-0.5">PEOPLE</text>
  <text x="238" y="50" font-family="'Poppins', 'Segoe UI', system-ui, sans-serif" font-size="34" font-weight="900" fill="#38BDF8" letter-spacing="-0.5">TAXI</text>
  <text x="98" y="70" font-family="'Poppins', 'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="700" fill="#94A3B8" letter-spacing="1.8">INTERCITY &amp; DROP CABS</text>
  <circle cx="332" cy="40" r="4.5" fill="#38BDF8" />
</svg>
"""

# 3. Square Icon SVG
ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="100%" stop-color="#1D4ED8" />
    </linearGradient>
    <linearGradient id="cyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#0284C7" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="120" height="120" rx="30" fill="url(#bg)" />
  
  <!-- Car Roof -->
  <path d="M30 70 L40 45 C43 38 50 35 60 35 C70 35 77 38 80 45 L90 70 Z" fill="white" opacity="0.95" />
  <!-- Car Body -->
  <rect x="22" y="70" width="76" height="22" rx="7" fill="white" />
  <!-- Roof Light -->
  <rect x="52" y="24" width="16" height="9" rx="3" fill="url(#cyan)" />
  <!-- Wheels -->
  <circle cx="38" cy="92" r="9" fill="#0F172A" />
  <circle cx="38" cy="92" r="4.5" fill="white" />
  <circle cx="82" cy="92" r="9" fill="#0F172A" />
  <circle cx="82" cy="92" r="4.5" fill="white" />
  <!-- Passengers -->
  <circle cx="51" cy="51" r="6" fill="#1D4ED8" />
  <circle cx="69" cy="51" r="6" fill="url(#cyan)" />
</svg>
"""

# Write SVGs
with open(os.path.join(BRAND_DIR, 'logo.svg'), 'w', encoding='utf-8') as f:
    f.write(LOGO_SVG)

with open(os.path.join(BRAND_DIR, 'logo-white.svg'), 'w', encoding='utf-8') as f:
    f.write(LOGO_WHITE_SVG)

with open(os.path.join(BRAND_DIR, 'icon.svg'), 'w', encoding='utf-8') as f:
    f.write(ICON_SVG)

with open(os.path.join(PUBLIC_DIR, 'favicon.svg'), 'w', encoding='utf-8') as f:
    f.write(ICON_SVG)

print("Saved SVG brand files successfully.")

# Generate Raster PNGs using PIL
def draw_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Outer rounded rect (Electric Blue)
    r = int(size * 0.25)
    draw.rounded_rectangle([(0, 0), (size, size)], radius=r, fill="#1D4ED8")
    
    scale = size / 120.0
    
    # Taxi Roof
    roof_coords = [
        (int(30 * scale), int(70 * scale)),
        (int(40 * scale), int(45 * scale)),
        (int(80 * scale), int(45 * scale)),
        (int(90 * scale), int(70 * scale))
    ]
    draw.polygon(roof_coords, fill="#FFFFFF")
    
    # Taxi Body
    draw.rounded_rectangle(
        [(int(22 * scale), int(70 * scale)), (int(98 * scale), int(92 * scale))],
        radius=int(7 * scale),
        fill="#FFFFFF"
    )
    
    # Taxi Top Sign
    draw.rounded_rectangle(
        [(int(52 * scale), int(24 * scale)), (int(68 * scale), int(33 * scale))],
        radius=int(3 * scale),
        fill="#38BDF8"
    )
    
    # Wheels
    w_r = int(9 * scale)
    for cx in [int(38 * scale), int(82 * scale)]:
        cy = int(92 * scale)
        draw.ellipse([(cx - w_r, cy - w_r), (cx + w_r, cy + w_r)], fill="#0F172A")
        iw_r = int(4.5 * scale)
        draw.ellipse([(cx - iw_r, cy - iw_r), (cx + iw_r, cy + iw_r)], fill="#FFFFFF")
        
    # Passengers
    p_r = int(6 * scale)
    draw.ellipse([(int(51 * scale) - p_r, int(51 * scale) - p_r), (int(51 * scale) + p_r, int(51 * scale) + p_r)], fill="#1D4ED8")
    draw.ellipse([(int(69 * scale) - p_r, int(51 * scale) - p_r), (int(69 * scale) + p_r, int(51 * scale) + p_r)], fill="#38BDF8")
    
    return img

# Create PNG icons
icon_192 = draw_icon(192)
icon_192.save(os.path.join(BRAND_DIR, 'icon-192.png'))
print("Saved icon-192.png")

icon_512 = draw_icon(512)
icon_512.save(os.path.join(BRAND_DIR, 'icon-512.png'))
print("Saved icon-512.png")

favicon_png = draw_icon(64)
favicon_png.save(os.path.join(PUBLIC_DIR, 'favicon.png'))
print("Saved favicon.png")

# Horizontal Logo PNG
def draw_horizontal_logo(width=840, height=180):
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    # Place scaled icon
    icon = draw_icon(140)
    img.paste(icon, (20, 20), icon)
    
    draw = ImageDraw.Draw(img)
    # Typography
    try:
        font_large = ImageFont.truetype("arialbd.ttf", 64)
        font_small = ImageFont.truetype("arial.ttf", 22)
    except Exception:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()
        
    draw.text((180, 40), "PEOPLE ", font=font_large, fill="#0F172A")
    # Draw TAXI in blue
    draw.text((450, 40), "TAXI", font=font_large, fill="#2563EB")
    draw.text((182, 115), "INTERCITY OUTSTATION & DROP CABS", font=font_small, fill="#64748B")
    return img

logo_png = draw_horizontal_logo()
logo_png.save(os.path.join(BRAND_DIR, 'logo.png'))
print("Saved logo.png")
