# PWA Icons

The service worker and manifest reference icons at these exact paths.
All eight sizes must exist before deploying.

## Required files

| File             | Size    | Used for                       |
| ---------------- | ------- | ------------------------------ |
| icon-72x72.png   | 72×72   | Android legacy                 |
| icon-96x96.png   | 96×96   | Push notification badge        |
| icon-128x128.png | 128×128 | Chrome Web Store               |
| icon-144x144.png | 144×144 | Windows tile                   |
| icon-152x152.png | 152×152 | iPad home screen               |
| icon-192x192.png | 192×192 | Android home screen, push icon |
| icon-384x384.png | 384×384 | High-DPI Android               |
| icon-512x512.png | 512×512 | Splash screen, app stores      |

## Generating from a source image

Start with a single square PNG at 1024×1024 or larger.

**Option A — sharp CLI**
```bash
npm install -g sharp-cli
for size in 72 96 128 144 152 192 384 512; do
  sharp -i source-icon.png -o "icon-${size}x${size}.png" resize $size $size
done
```

**Option B — pwa-asset-generator**
```bash
npx pwa-asset-generator source-icon.png ./public/icons \
  --background "#0F0C09" \
  --maskable true
```

**Option C — online**
- https://realfavicongenerator.net
- https://maskable.app (preview maskable safe zone)

## Design notes

- Background: `#0F0C09` — matches `theme_color` in manifest.json
- Foreground/logo: `#D4A96A` (warm gold accent)
- All icons use `"purpose": "maskable any"` — keep the logo within
  the central 80% safe zone so it isn't cropped on Android.
