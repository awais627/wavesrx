# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WavesRx (wavesrx.com) is a Shopify store running the **Impulse 7.4.0** theme by Archetype Themes. This repo contains the full theme source — no build system, no preprocessors. Edit files directly and deploy via Shopify CLI.

## Development Commands

```bash
# Local development (live preview with hot reload)
shopify theme dev

# Push to staging theme
shopify theme push --theme 153297617074

# Pull latest from live theme
shopify theme pull
```

There is no build step. Liquid templates are compiled server-side by Shopify. CSS and JS assets are committed directly.

## Architecture

### Layout
- **`layout/theme.liquid`** — Main page wrapper. Contains deferred GTM/Hotjar loading (interaction-triggered + fallback timer), hero image preload, and third-party script deferral logic. This is the most performance-sensitive file.
- **`layout/theme.pagefly.liquid`** — PageFly page builder variant.

### CSS
- **`assets/theme.css.liquid`** — Monolithic stylesheet (~776KB). This IS the main CSS — Shopify compiles `.css.liquid` to `.css`. Uses Liquid filters (`color_darken`, `color_lighten`) and CSS custom properties set from theme settings.
- Bootstrap is loaded globally (deferred via `media="print"` trick). It's used in 167/272 files — do not remove it.
- Swiper CSS is loaded only in the tiktok-slider section, not globally.

### JavaScript
- **`assets/theme.js`** — Impulse core (~261KB, minified). Uses event-driven architecture with `document.addEventListener('page:loaded', ...)`. Depends on jQuery.
- **`assets/vendor-scripts-v11.js`** — Third-party vendor bundle (deferred).
- jQuery is deferred but NOT removed — `theme.js` depends on it.
- Third-party app scripts: USF (search/filter), EComposer, Tapita (reviews), PageFly, Boost SD, SPT (wishlist).

### Sections & Snippets
- **90 sections** in `sections/` — includes custom landing pages, product pages, tiktok-slider, age-verification-popup, countdown timer, etc.
- **136+ snippets** in `snippets/` — reusable Liquid partials. EComposer integration uses `ecom_*` prefix (11 snippets).
- **70+ templates** in `templates/` — mostly JSON templates with custom landing page variants.

### Config
- **`config/settings_schema.json`** — Theme customization options for Shopify admin.
- **`config/settings_data.json`** — Excluded from git (store-specific settings).

## Key Technical Patterns

### CSS Selectors for Sections
Use `[id*="__SECTION_ID"]` pattern instead of hardcoded template IDs. Template/section IDs differ between live, staging, and dev environments.

### Font Awesome Replaced
Font Awesome was removed and replaced with inline SVGs for three icons: phone, heart, trash. Do not re-add Font Awesome.

### Script Deferral Strategy
GTM, Hotjar, Clarity, Facebook pixel, and Google Ads load on first user interaction (scroll/click/touch/keydown) or after a fallback timer (12s homepage, 8s other pages). This is intentional for performance — do not move these to eager loading.

### Third-Party App Script Interception
`theme.liquid` intercepts `appendChild` calls on the homepage to defer third-party app scripts. Be aware of this when debugging script loading issues.

## Known Issues (AUDIT.md)

The `AUDIT.md` file documents ~8,876 JS errors from Semrush audit. Key theme bugs:
- `this.cache.savePrice.classList` null reference in `theme.js:6964/7198` — missing null check on `[data-save-price]`
- `this.closeBtn.addEventListener` null reference in `theme.js:3932` (NewsletterReminder)
- Flickity slider initialization failure in `theme.js:3259`
- Maximum call stack overflow from infinite recursion

## Git Workflow

- **Branches:** `main` (production), `dev` (development), `performace` (performance work — intentional typo)
- **Remote:** `origin` at `github_work.com:awais627/wavesrx.git`
- **Never push or deploy** — the user handles all deployments.

## Analytics & Tracking

GTM container: `GTM-WW44S75X`, Hotjar ID: `3833078`. Both are deferred. Do not add synchronous analytics scripts.
