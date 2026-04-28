# Customize Your Kit v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing "Customize Your Kit" feature on bundle product pages with a 10% kit discount (configurable), per-component variant controls, and a clean bundle-only product page layout (no top price, no default ATC, kit section moved under product title).

**Architecture:** The bundle page becomes a fully kit-driven UI when the product carries `custom.bundle_default_items`. The same `product-template.liquid` powers both regular and bundle products — a single `is_bundle` Liquid flag toggles which blocks render and inserts the kit section directly under the product title. The discount is calculated in JS for display and enforced in cart by redirecting to `/discount/<CODE>?redirect=/cart` after the multi-item add succeeds. Per-component variant behavior (hide dropdown / filter to one option) is driven by metafields on the component products themselves, so the bundle product owner can compose any kit without re-configuring the same component twice.

**Tech Stack:** Shopify Liquid, vanilla JS (no jQuery for our code), Shopify Discount Codes (manual admin setup), product metafields. No build step.

---

## Current State (already shipped)

The following are already in place from v1 and remain in this plan unless explicitly modified:

- **`snippets/bundle-customize-section.liquid`** — kit section markup + scoped CSS, gated on `product.metafields.custom.bundle_default_items.value.size > 0`
- **`snippets/bundle-component-card.liquid`** — single component row with checkbox + variant select
- **`assets/bundle-builder.js`** — vanilla JS that totals checked items, POSTs `/cart/add.js` with `items: [...]`, dispatches `ajaxProduct:added` so the cart drawer opens
- **`snippets/product-form.liquid`** lines 98–101 — current render call: `{% render 'bundle-customize-section', product: product %}` placed after the wishlist button. **This call gets moved in Task 1.**
- **`snippets/bundle-grid-item.liquid`** line 326 — `CUSTOMIZE` is a plain link `<a href="{{ product.url }}">` to the bundle's product page. **No change in this plan.**

The metafield `custom.bundle_default_items` (List of products) is already configured by the client in admin.

## Client Requirements Mapping

| # | Requirement | Tasks |
|---|---|---|
| 1 | 10% discount applied to kit total (configurable) | Task 4, Task 5, Task 6 |
| 2 | Per-component option to hide variant selector (Wave Cobra) | Task 2 |
| 3 | Single yellow Add Kit to Cart on bundle pages, no default ATC | Task 1, Task 3 |
| 4 | Kit section only on bundle products, never regular products | Task 1 (already metafield-gated, verified) |
| 5 | Per-component option to filter variants to one option (Color only on chain) | Task 2 |
| 6 | Hide top price; show full + discounted total only at bottom | Task 1, Task 4 |
| 7 | Move kit section to top, directly under kit name | Task 1 |

## New Metafield Schema

The client must create these metafields in **Settings → Custom data**:

### On the Product resource (apply to BUNDLE products)

| Namespace.key | Type | Required | Default | Purpose |
|---|---|---|---|---|
| `custom.bundle_discount_percent` | Integer | Optional | 10 | Percent off when items are bought as a kit. Used for both display math and the Shopify discount code. |
| `custom.bundle_discount_code` | Single line text | Optional | (none) | Shopify Discount Code name (e.g. `BUNDLE10`). When set, JS redirects to `/discount/<code>?redirect=/cart` after add to apply the discount in cart. |

### On the Product resource (apply to COMPONENT products — the items inside `bundle_default_items`)

| Namespace.key | Type | Required | Default | Purpose |
|---|---|---|---|---|
| `custom.bundle_show_variants` | Boolean | Optional | true | When false, the kit row uses the default variant only (no dropdown). Set false on the Wave Cobra anchor so customers don't pick a bungee color from the anchor row. |
| `custom.bundle_variant_option` | Single line text | Optional | (none) | Name of a single product option (e.g. `Color`). When set, the dropdown shows one entry per unique value of that option (one available variant per value), ignoring all other options. Set to `Color` on the 5 ft chain to show only color choices. |

If neither component metafield is set, behavior matches v1: dropdown shows all variants when a product has more than one.

## Discount Mechanism — Decision

**Chosen approach: Shopify Discount Code redirect.**

After the multi-item add to `/cart/add.js` succeeds, the JS navigates to `/discount/<CODE>?redirect=/cart`. Shopify applies the code to the cart and shows the cart page with the discount line item visible.

**Why this and not the alternatives:**

- **Shopify Functions (per-item discount API):** most precise but requires a Function deployment pipeline. WavesRx isn't on Plus and doesn't currently use Functions; deferring keeps scope tight.
- **Display-only discount (no cart enforcement):** customer sees a discounted price on the kit page but pays full price at checkout. Misleading; rejected.
- **Automatic Discount targeting a collection:** would apply 10% any time any of those products are in cart, even if bought individually outside the kit. The client wants the discount tied to the kit purchase, so we use a code redirect on Add Kit to Cart.

**Client setup (one-time, in Shopify admin → Discounts):**

1. Create a Discount → Amount off products → Code = `BUNDLE10` (or any name).
2. Discount value: 10% off.
3. Applies to: Specific collections → pick the collection that contains all bundle component products. (Or "All products" if simpler — client can scope as they wish.)
4. Combinations: their choice (typically combine with shipping discounts only).
5. Active dates: ongoing.
6. Save the code. Put the **same** code into the bundle product's `custom.bundle_discount_code` metafield.

If `bundle_discount_code` is left blank, the JS shows the discounted total visually but redirects only to `/cart` (no discount applied). Document this as the client's responsibility — we'll log a single console warning in dev so they notice.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `snippets/product-template.liquid` | Modify | Add `is_bundle` flag at top; render kit section right after `<h1 class="product-single__title">`; skip the `'price'` and `'buy_buttons'` cases when `is_bundle` is true. |
| `snippets/product-form.liquid` | Modify | Remove the v1 kit render after the wishlist button (it moves up to product-template). |
| `snippets/bundle-customize-section.liquid` | Modify | Read `bundle_discount_percent` and `bundle_discount_code` from product metafields; pass both to inline JS via `data-` attributes; render two-line total (full + discounted); change ATC to yellow style matching `.btn-yellow` from `bundle-grid-item.liquid`. |
| `snippets/bundle-component-card.liquid` | Modify | Read component-level `bundle_show_variants` and `bundle_variant_option`; honor them when emitting the variant dropdown. |
| `assets/bundle-builder.js` | Modify | Calculate discounted total live; on add success, redirect to `/discount/<code>?redirect=/cart` if a code is set, otherwise navigate to `/cart`. |

No new files are created.

---

## Task 1: Bundle-only product page layout

**Why:** Requirements 3, 4, 6, 7 — when a product is a bundle, the page should hide the regular price block and the regular buy-buttons block, and the kit section should sit directly under the product title (not under the wishlist).

**Files:**
- Modify: `snippets/product-template.liquid` (add `is_bundle` flag near top of file; insert kit render after title; gate `'price'` and `'buy_buttons'` cases on `is_bundle`)
- Modify: `snippets/product-form.liquid` lines 98–101 (delete the v1 kit render since it's moving)

**Bundle detection:** A product is a bundle iff `product.metafields.custom.bundle_default_items.value.size > 0`. Empty list → not a bundle.

- [ ] **Step 1.1: Add `is_bundle` flag to product-template.liquid**

Open `snippets/product-template.liquid`. Find the existing top `{%- liquid ... -%}` block (around lines 1–60 — there is a top-level liquid assign block that defines `connect_to_sizechart` and similar). Inside that block, add:

```liquid
assign is_bundle = false
assign bundle_defaults = product.metafields.custom.bundle_default_items.value
if bundle_defaults != blank and bundle_defaults.size > 0
  assign is_bundle = true
endif
```

Verify by `grep -n "assign is_bundle" snippets/product-template.liquid` — expect exactly one match.

- [ ] **Step 1.2: Render the kit section after the product title**

In `snippets/product-template.liquid`, find the title block. From the file we have:

```liquid
              {%- if isModal -%}
                <p class="h2 product-single__title">
                  {{ product.title }}
                </p>
              {%- else -%}
                <h1 class="h2 product-single__title">
                  {%- unless product.empty? -%}
                    {{ product.title }}
                  {%- else -%}
                    {{ 'home_page.onboarding.product_title' | t }}
                  {%- endunless -%}
                </h1>
              {%- endif -%}
```

Immediately after the closing `{%- endif -%}` (i.e. before the `<div class="custom-subtitle-products">` line), insert:

```liquid
              {%- if is_bundle -%}
                {% render 'bundle-customize-section', product: product %}
              {%- endif -%}
```

- [ ] **Step 1.3: Skip the `'price'` block on bundles**

In the same file, find `{%- when 'price' -%}` (around line 191). Wrap the entire `<div class="product-block product-block--price">` content with a guard. Concretely, change:

```liquid
                  {%- when 'price' -%}
                    <div class="product-block product-block--price" {{ block.shopify_attributes }}>
```

to:

```liquid
                  {%- when 'price' -%}
                    {%- unless is_bundle -%}
                    <div class="product-block product-block--price" {{ block.shopify_attributes }}>
```

Then find the matching closing `</div>` for `product-block--price` (which is the line right before `{%- when 'quantity_selector' -%}` at line 317). Change:

```liquid
                    </div>
                  {%- when 'quantity_selector' -%}
```

to:

```liquid
                    </div>
                    {%- endunless -%}
                  {%- when 'quantity_selector' -%}
```

- [ ] **Step 1.4: Skip the `'buy_buttons'` block on bundles**

Find `{%- when 'buy_buttons' -%}` (around line 393). Change:

```liquid
                  {%- when 'buy_buttons' -%}
                    <div class="product-block" {{ block.shopify_attributes }}>
                      {%- unless product.empty? -%}
                        <div class="product-block">
                          {%- render 'product-form',
                            form_id: form_id,
                            product: product,
                            show_dynamic_checkout: block.settings.show_dynamic_checkout,
                            current_variant: current_variant,
                            block: block,
                          -%}
                        </div>
                      {%- endunless -%}

                      {%- if block.settings.surface_pickup_enable -%}
                        <div data-store-availability-holder
                          data-product-name="{{ product.title | escape }}"
                          data-base-url="{{ shop.url }}{{ routes.root_url }}"
                          ></div>
                      {%- endif -%}
                    </div>
```

to:

```liquid
                  {%- when 'buy_buttons' -%}
                    <div class="product-block" {{ block.shopify_attributes }}>
                      {%- unless is_bundle -%}
                        {%- unless product.empty? -%}
                          <div class="product-block">
                            {%- render 'product-form',
                              form_id: form_id,
                              product: product,
                              show_dynamic_checkout: block.settings.show_dynamic_checkout,
                              current_variant: current_variant,
                              block: block,
                            -%}
                          </div>
                        {%- endunless -%}

                        {%- if block.settings.surface_pickup_enable -%}
                          <div data-store-availability-holder
                            data-product-name="{{ product.title | escape }}"
                            data-base-url="{{ shop.url }}{{ routes.root_url }}"
                            ></div>
                        {%- endif -%}
                      {%- endunless -%}
                    </div>
```

The wrapping `<div class="product-block">` stays so the block layout doesn't collapse and `{{ block.shopify_attributes }}` keeps the section editor happy. The internals are simply skipped on bundles.

- [ ] **Step 1.5: Remove the v1 kit render from product-form.liquid**

Open `snippets/product-form.liquid`. Find lines 98–101:

```liquid
{%- if product.metafields.custom.bundle_default_items.value.size > 0 -%}
  {% render 'bundle-customize-section', product: product %}
{%- endif -%}
```

Delete those four lines (including the blank line before them). The kit section now renders only via the title placement in step 1.2, so we don't get a duplicate.

- [ ] **Step 1.6: Verify on a bundle product page**

Run `shopify theme dev`. Open the bundle product (e.g. `/products/boat-anchoring-bundle`). Verify all of the following:

- The Customize Your Kit section appears directly below the product title.
- No price is shown above the kit section.
- No default Add to Cart / Buy Now / variant picker / quantity selector is shown above or below the kit section.
- The Add to Wishlist button still appears (we did not touch the wishlist).
- A non-bundle product (any product that does NOT have `bundle_default_items` set, e.g. a regular accessory) renders unchanged: top price visible, default ATC visible, no kit section.

If a non-bundle product still renders incorrectly, run `grep -n "is_bundle\|bundle_default_items" snippets/product-template.liquid` and confirm there's only one assign, and that the `unless is_bundle` guards close correctly.

- [ ] **Step 1.7: Commit**

```bash
git add snippets/product-template.liquid snippets/product-form.liquid
git commit -m "Move Customize Your Kit under product title; hide price and ATC on bundle pages"
```

---

## Task 2: Per-component variant controls

**Why:** Requirements 2 and 5. Some components must hide the dropdown entirely (Wave Cobra), and some must filter to a single option's values (5 ft chain → only Color shown).

**Files:**
- Modify: `snippets/bundle-component-card.liquid` (entire variant-select region)

The card already rendered all variants when `component.variants.size > 1`. We now read two component metafields and adapt:

1. `custom.bundle_show_variants` (boolean) — false ⇒ no dropdown, use default variant.
2. `custom.bundle_variant_option` (text) — name of an option to filter by (e.g. `Color`).

Precedence: `bundle_show_variants == false` overrides everything — no dropdown.

Otherwise, if `bundle_variant_option` is set and matches one of the product's option names, dedupe variants by that option's values: emit one `<option>` per unique value (using the first available variant for that value). Ignore any value whose only variants are unavailable.

Otherwise (default), emit all variants, same as v1.

- [ ] **Step 2.1: Replace the variant block in bundle-component-card.liquid**

Open `snippets/bundle-component-card.liquid`. Replace the existing block that begins with `{% if has_multiple_variants %}` and ends with `{% endif %}` (the entire if/else that decides between the select and the hidden input) with this:

```liquid
    {%- liquid
      assign show_variants = true
      if component.metafields.custom.bundle_show_variants == false
        assign show_variants = false
      endif

      assign filter_option = component.metafields.custom.bundle_variant_option | strip
      assign filter_index = -1
      if filter_option != blank
        for opt_name in component.options
          if opt_name == filter_option
            assign filter_index = forloop.index0
            break
          endif
        endfor
      endif

      assign use_dropdown = false
      if show_variants and component.variants.size > 1
        assign use_dropdown = true
      endif
    -%}

    {%- if use_dropdown -%}
      <div class="bundle-kit__variant">
        <label class="bundle-kit__variant-label">{% if filter_index >= 0 %}{{ filter_option }}{% else %}Variant{% endif %}</label>
        <div class="bundle-kit__select-wrap">
          <select class="bundle-kit__variant-select" data-bundle-variant-select aria-label="Choose option for {{ component.title | escape }}">
            {%- if filter_index >= 0 -%}
              {%- assign seen_values = '|' -%}
              {%- for variant in component.variants -%}
                {%- assign vval = variant.option1 -%}
                {%- if filter_index == 1 -%}{%- assign vval = variant.option2 -%}{%- endif -%}
                {%- if filter_index == 2 -%}{%- assign vval = variant.option3 -%}{%- endif -%}
                {%- assign marker = '|' | append: vval | append: '|' -%}
                {%- unless seen_values contains marker -%}
                  {%- if variant.available -%}
                    {%- assign seen_values = seen_values | append: vval | append: '|' -%}
                    <option value="{{ variant.id }}"
                            data-price="{{ variant.price }}"
                            {% if variant == default_variant %}selected{% endif %}>
                      {{ vval }}
                    </option>
                  {%- endif -%}
                {%- endunless -%}
              {%- endfor -%}
            {%- else -%}
              {%- for variant in component.variants -%}
                <option value="{{ variant.id }}"
                        data-price="{{ variant.price }}"
                        {% unless variant.available %}disabled{% endunless %}
                        {% if variant == default_variant %}selected{% endif %}>
                  {{ variant.title }}
                </option>
              {%- endfor -%}
            {%- endif -%}
          </select>
          <svg class="bundle-kit__select-caret" viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
            <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    {%- else -%}
      <input type="hidden"
             data-bundle-variant-input
             value="{{ default_variant.id }}"
             data-price="{{ default_variant.price }}">
    {%- endif -%}
```

Notes:
- `for ... break` works in Liquid as of recent Shopify versions; if the host environment errors on `break`, replace with a guarded loop using `unless`.
- `seen_values` uses pipe-separated tokens to avoid substring collisions (so `|Black|` doesn't match `|Black Pearl|`).

- [ ] **Step 2.2: Verify Wave Cobra (no dropdown)**

In Shopify admin, on the Wave Cobra anchor product:
1. Add metafield `custom.bundle_show_variants` (boolean) → set to `false`.
2. Save.

Reload the bundle product page. The Wave Cobra row should show no dropdown and no variant label, just thumb + title + price + checkbox. Behavior identical to a single-variant product.

- [ ] **Step 2.3: Verify chain (Color-only filter)**

In Shopify admin, on the 5 ft chain product:
1. Confirm the product has options like `[Color, Size]` or `[Color, ...]` with two available colors.
2. Add metafield `custom.bundle_variant_option` (single line text) → set to `Color` (exact case from the option name).
3. Save.

Reload the bundle product page. The chain row should show a `Color` dropdown with one entry per color (the first available variant for each color). Sold-out colors do not appear. Other options (Size, etc.) are not shown anywhere.

Edge case: if the chain has only one available color, the dropdown shows just that one option. If you want the dropdown to disappear in that case, leave it for the JS pass — the row still works.

- [ ] **Step 2.4: Verify default behavior (no metafields set)**

On any other component product with multiple variants, leave both new metafields blank. The dropdown should still render with all variants exactly like v1.

- [ ] **Step 2.5: Commit**

```bash
git add snippets/bundle-component-card.liquid
git commit -m "Add per-component variant visibility and option filter for bundle kit"
```

---

## Task 3: Yellow Add Kit to Cart button + total layout

**Why:** Requirement 3 (single yellow ATC matching the bundle-grid yellow), requirement 6 (full + discounted price below the kit).

**Files:**
- Modify: `snippets/bundle-customize-section.liquid` — markup for the footer + button + scoped CSS overrides

The existing footer renders one total line + a button using the theme's `.btn` class. We change it to:
- Two-line total: full price (struck through if a discount applies) + discounted price (highlighted)
- Yellow ATC button matching `bundle-grid-item.liquid`'s `.btn-yellow` (background `#FFD200`, black text, rounded 26px+)
- Discount metafields exposed to JS via `data-` attributes on the kit root

The current footer in `bundle-customize-section.liquid` looks like:

```liquid
    <footer class="bundle-kit__footer">
      <div class="bundle-kit__total-row">
        <div class="bundle-kit__total-meta">
          <span class="bundle-kit__total-label">Kit total</span>
          <span class="bundle-kit__total-sub" data-bundle-count-sub>{{ default_items.size }} items selected</span>
        </div>
        <span class="bundle-kit__total-value" data-bundle-total>{{ 0 | money }}</span>
      </div>
      <button type="button" class="btn bundle-kit__add-btn" data-bundle-add>
        <span data-bundle-add-text>Add Kit to Cart</span>
      </button>
      <div class="bundle-kit__error" data-bundle-error hidden role="alert"></div>
    </footer>
```

- [ ] **Step 3.1: Add discount data-attributes to the kit root and replace the footer**

In `snippets/bundle-customize-section.liquid`, find the opening `<section class="bundle-kit" ...>` tag. Replace it with this version that exposes the two metafields to the JS:

```liquid
    {%- assign discount_percent_raw = product.metafields.custom.bundle_discount_percent -%}
    {%- if discount_percent_raw == blank -%}
      {%- assign discount_percent = 10 -%}
    {%- else -%}
      {%- assign discount_percent = discount_percent_raw | plus: 0 -%}
    {%- endif -%}
    {%- assign discount_code = product.metafields.custom.bundle_discount_code | strip -%}

    <section class="bundle-kit"
             data-bundle-kit
             data-bundle-id="{{ product.id }}"
             data-bundle-discount-percent="{{ discount_percent }}"
             data-bundle-discount-code="{{ discount_code | escape }}"
             aria-labelledby="bundle-kit-heading-{{ product.id }}">
```

Then replace the existing `<footer class="bundle-kit__footer">…</footer>` block with:

```liquid
    <footer class="bundle-kit__footer">
      <div class="bundle-kit__totals">
        <div class="bundle-kit__total-row bundle-kit__total-row--full" data-bundle-full-row>
          <span class="bundle-kit__total-label">Kit total</span>
          <span class="bundle-kit__total-value bundle-kit__total-value--full" data-bundle-total>{{ 0 | money }}</span>
        </div>
        <div class="bundle-kit__total-row bundle-kit__total-row--discount" data-bundle-discount-row hidden>
          <span class="bundle-kit__total-label">
            You pay
            <span class="bundle-kit__discount-pill" data-bundle-discount-pill>{{ discount_percent }}% off</span>
          </span>
          <span class="bundle-kit__total-value bundle-kit__total-value--discount" data-bundle-discounted-total>{{ 0 | money }}</span>
        </div>
        <div class="bundle-kit__total-sub" data-bundle-count-sub>{{ default_items.size }} items selected</div>
      </div>
      <button type="button" class="bundle-kit__add-btn" data-bundle-add>
        <span data-bundle-add-text>Add Kit to Cart</span>
      </button>
      <div class="bundle-kit__error" data-bundle-error hidden role="alert"></div>
    </footer>
```

- [ ] **Step 3.2: Update the section's CSS for the new footer and yellow button**

Inside the `<style>` block in `bundle-customize-section.liquid`, replace the existing rules for `.bundle-kit__footer`, `.bundle-kit__total-row`, `.bundle-kit__total-meta`, `.bundle-kit__total-label`, `.bundle-kit__total-sub`, `.bundle-kit__total-value`, and `.bundle-kit__add-btn` with the following block. Keep all other rules unchanged.

```css
    .bundle-kit__footer {
      border-top: 1px solid var(--colorBorder, #e6e6e6);
      padding-top: 18px;
    }
    .bundle-kit__totals {
      margin-bottom: 16px;
    }
    .bundle-kit__total-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 16px;
      padding: 4px 0;
    }
    .bundle-kit__total-row--full .bundle-kit__total-value {
      font-size: 16px;
      font-weight: 600;
    }
    .bundle-kit__total-row--full.is-strike .bundle-kit__total-value {
      text-decoration: line-through;
      opacity: 0.6;
    }
    .bundle-kit__total-row--discount {
      align-items: center;
      padding-top: 6px;
    }
    .bundle-kit__total-label {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.75;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .bundle-kit__discount-pill {
      background: #FFD200;
      color: #000;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 3px 8px;
      border-radius: 999px;
      text-transform: uppercase;
    }
    .bundle-kit__total-value {
      font-family: var(--typeHeaderPrimary), var(--typeHeaderFallback, sans-serif);
      letter-spacing: 0.01em;
      line-height: 1;
      transition: transform 0.18s ease;
    }
    .bundle-kit__total-value.is-pulse { transform: scale(1.06); }
    .bundle-kit__total-value--discount {
      font-size: 26px;
      font-weight: 800;
      color: var(--colorTextBody, #1c1d1d);
    }
    .bundle-kit__total-sub {
      margin-top: 6px;
      font-size: 12px;
      opacity: 0.6;
    }
    .bundle-kit__add-btn {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 22px;
      background: #FFD200;
      color: #000;
      border: 0;
      border-radius: 30px;
      font-family: var(--typeBasePrimary), var(--typeBaseFallback, sans-serif);
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      transition: filter 0.15s ease, transform 0.05s ease;
    }
    .bundle-kit__add-btn:hover:not(:disabled) { filter: brightness(0.95); }
    .bundle-kit__add-btn:active:not(:disabled) { transform: translateY(1px); }
    .bundle-kit__add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .bundle-kit__add-btn.is-loading { pointer-events: none; }
    .bundle-kit__add-btn.is-loading::after {
      content: "";
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: bundleSpin 0.7s linear infinite;
    }
    @keyframes bundleSpin { to { transform: rotate(360deg); } }
```

- [ ] **Step 3.3: Verify visually**

Reload the bundle product page on `shopify theme dev`. Without setting any new metafields yet, you should now see:
- The full-price line (sum of all checked items at full price), labeled `Kit total`.
- The discounted line below it, labeled `You pay [10% off]`, currently zero until JS runs.
- A yellow `Add Kit to Cart` button matching the yellow on the bundle grid.

The discounted total updates wire up in Task 4.

- [ ] **Step 3.4: Commit**

```bash
git add snippets/bundle-customize-section.liquid
git commit -m "Show full + discounted total and yellow Add Kit to Cart on bundle pages"
```

---

## Task 4: Live discount math in JS

**Why:** Requirement 1, requirement 6 — keep the discounted total in sync with the full total live as the customer toggles items / changes variants.

**Files:**
- Modify: `assets/bundle-builder.js` — read discount-percent / discount-code from `data-` attributes, update both totals in `updateTotal`, hide the discount row when 0% or no items.

- [ ] **Step 4.1: Read discount config from the kit root**

In `assets/bundle-builder.js`, find the `initKit(kitEl)` function. At the top of the function (before the existing `if (kitEl.dataset.bundleInit === '1') return;`), add:

```javascript
    var rawPercent = parseFloat(kitEl.getAttribute('data-bundle-discount-percent'));
    if (!isFinite(rawPercent) || rawPercent < 0) rawPercent = 0;
    if (rawPercent > 100) rawPercent = 100;
    kitEl.bundleDiscountPercent = rawPercent;
    kitEl.bundleDiscountCode = (kitEl.getAttribute('data-bundle-discount-code') || '').trim();
```

(We attach to the DOM element rather than module-scope so multiple kits on a page each carry their own config.)

- [ ] **Step 4.2: Update `updateTotal` to write both totals**

Replace the existing `updateTotal(kitEl)` function with:

```javascript
  function updateTotal(kitEl) {
    var items = kitEl.querySelectorAll('[data-bundle-item]');
    var total = 0;
    var checkedCount = 0;
    items.forEach(function (item) {
      var checkbox = item.querySelector('[data-bundle-checkbox]');
      if (!checkbox || !checkbox.checked || checkbox.disabled) return;
      var v = getSelectedVariant(item);
      if (v) {
        total += v.price;
        checkedCount += 1;
      }
    });

    var percent = kitEl.bundleDiscountPercent || 0;
    var discounted = Math.round(total * (100 - percent) / 100);

    var totalEl = kitEl.querySelector('[data-bundle-total]');
    if (totalEl) {
      totalEl.innerHTML = formatMoney(total);
      pulseTotal(totalEl);
    }

    var discountedEl = kitEl.querySelector('[data-bundle-discounted-total]');
    if (discountedEl) {
      discountedEl.innerHTML = formatMoney(discounted);
      pulseTotal(discountedEl);
    }

    var fullRow = kitEl.querySelector('[data-bundle-full-row]');
    var discountRow = kitEl.querySelector('[data-bundle-discount-row]');
    var showDiscount = percent > 0 && checkedCount > 0;
    if (discountRow) discountRow.hidden = !showDiscount;
    if (fullRow) fullRow.classList.toggle('is-strike', showDiscount);

    var countSub = kitEl.querySelector('[data-bundle-count-sub]');
    if (countSub) {
      countSub.textContent = checkedCount + (checkedCount === 1 ? ' item selected' : ' items selected');
    }
    var addBtn = kitEl.querySelector('[data-bundle-add]');
    if (addBtn) addBtn.disabled = checkedCount === 0;
  }
```

Notes:
- `Math.round(total * (100 - percent) / 100)` keeps the math in cents and avoids floating-point cents.
- When the discount is 0% or no items are selected, the discount row hides and the full-price row stops being struck through.

- [ ] **Step 4.3: Verify live updates**

Reload the bundle product page. With `bundle_discount_percent = 10` (default), check:
- All items checked → full total `= sum`, discounted total `= sum * 0.9`, full total struck through, "10% off" pill visible.
- Uncheck one item → both totals decrease in step.
- All unchecked → discount row hides, full total `= $0.00`, ATC button disabled.
- Change a variant on a multi-variant component → both totals reflect new variant price.

Set the metafield `bundle_discount_percent` to 0 on a test bundle. Reload. The discount row should not show; only the full total renders. The full total is not struck through.

Set the metafield `bundle_discount_percent` to 25. Reload. The discount pill says `25% off`, math reflects 25%.

- [ ] **Step 4.4: Commit**

```bash
git add assets/bundle-builder.js
git commit -m "Calculate live discounted kit total based on bundle_discount_percent"
```

---

## Task 5: Apply the discount on Add Kit to Cart

**Why:** Requirement 1 — the discount must reach the cart, not just the page.

**Files:**
- Modify: `assets/bundle-builder.js` — change the success handler to navigate via `/discount/<code>?redirect=/cart` if a code is set, otherwise navigate to `/cart`.

The existing `submitKit` calls `dispatchAjaxAdded()` after a successful POST so the cart drawer opens. With a discount in play we want the customer to land on `/cart` so the discount line is visible.

- [ ] **Step 5.1: Replace the success branch in submitKit**

In `assets/bundle-builder.js`, find the `submitKit` function and locate the success branch:

```javascript
        if (!result.ok) {
          var msg = (result.body && (result.body.description || result.body.message)) ||
                    "Sorry, we couldn't add this kit to your cart.";
          showError(kitEl, msg);
          return;
        }
        dispatchAjaxAdded();
```

Replace `dispatchAjaxAdded();` with:

```javascript
        var code = kitEl.bundleDiscountCode;
        var redirectTarget = code
          ? '/discount/' + encodeURIComponent(code) + '?redirect=/cart'
          : '/cart';
        window.location.href = redirectTarget;
        return;
```

- [ ] **Step 5.2: Remove the now-unused dispatchAjaxAdded helper**

Since we no longer trigger the cart drawer, delete the `dispatchAjaxAdded` function and any references to it. Run `grep -n "dispatchAjaxAdded" assets/bundle-builder.js`. The expected output is no matches after deletion.

- [ ] **Step 5.3: Verify with discount code set**

In Shopify admin (or via Shopify CLI):
1. Discounts → Create code `BUNDLE10TEST` → 10% off → applies to the bundle component products' collection (or all products).
2. On the bundle product, set `custom.bundle_discount_code = BUNDLE10TEST` and `custom.bundle_discount_percent = 10`.

Reload the bundle product page. Click `Add Kit to Cart`. Expected:
- Browser navigates to `/discount/BUNDLE10TEST?redirect=/cart`.
- Final URL lands on `/cart`.
- Cart shows a discount line item: `BUNDLE10TEST -10%` applied to the eligible items.
- Cart total reflects the discount.

- [ ] **Step 5.4: Verify with no discount code (graceful fallback)**

Clear `bundle_discount_code` on the bundle (set to blank). Reload, click Add Kit to Cart. Expected:
- Browser navigates to `/cart` directly (no `/discount/...` segment).
- Cart shows the items without any discount line.
- Page-side display still shows the discounted total (UI only) — this is the documented limitation; client must set the code to enforce.

In dev tools console add a `console.warn` at this point only when running on `localhost` or `*.myshopify.com` so the dev sees the issue. (Optional polish — skip if it adds risk.)

- [ ] **Step 5.5: Commit**

```bash
git add assets/bundle-builder.js
git commit -m "Apply Shopify discount code on Add Kit to Cart when configured"
```

---

## Task 6: Sanity sweep + client metafield documentation

**Why:** Catch silent breakage on regular product pages and produce the client setup doc.

**Files:**
- No code changes unless verification fails.
- Create or update: `docs/superpowers/plans/2026-04-28-customize-your-kit-v2-client-setup.md` (separate doc the user can forward).

- [ ] **Step 6.1: Verify regular product pages are unchanged**

Pick three regular (non-bundle) products at random. None should have `custom.bundle_default_items`. For each:
- Top of page: regular price visible (no kit section).
- Default Add to Cart button visible.
- Variant picker / quantity selector / dynamic checkout button render as before.
- No JS errors in the console.

- [ ] **Step 6.2: Verify a bundle with no discount code shows correctly**

On the bundle product, leave `bundle_discount_code` blank. Open the page:
- Discount row still shows (since `bundle_discount_percent = 10`).
- Add to Cart navigates to `/cart` cleanly.

- [ ] **Step 6.3: Verify a bundle with `bundle_discount_percent = 0`**

On the bundle product, set `bundle_discount_percent = 0`. Open the page:
- Only the full-total row shows; no `You pay … off` row.
- Full total is NOT struck through.
- Add Kit to Cart navigates to `/discount/<code>?redirect=/cart` if a code is set, or `/cart` otherwise. (At 0% off the discount code may produce a no-op in cart — that's fine.)

- [ ] **Step 6.4: Verify combined Wave Cobra + chain config**

On the bundle product:
- Wave Cobra component → `bundle_show_variants = false`.
- 5 ft chain component → `bundle_variant_option = Color`.

Open the bundle product page:
- Wave Cobra row: thumb + title + price + checkbox only.
- Chain row: thumb + title + `Color` dropdown with each available color exactly once.
- Other components: behave as default.

Toggle the Wave Cobra off → kit total drops by Wave Cobra price.
Switch chain color → kit total updates by the variant price difference.
Click Add Kit to Cart → cart contains the right variants with the right discount.

- [ ] **Step 6.5: Write the client setup doc**

Create `docs/superpowers/plans/2026-04-28-customize-your-kit-v2-client-setup.md` with this content:

```markdown
# Customize Your Kit — Client Setup Guide

## One-time admin setup

### 1. Create the discount code (Discounts → Create discount)
- Type: Amount off products
- Method: Discount code
- Code: e.g. `BUNDLE10` (any name)
- Value: 10% off
- Applies to: the collection that contains all bundle component products (or all products)
- Combinations: combine with shipping discounts only (recommended)
- Save

### 2. Add the bundle metafield definitions (Settings → Custom data → Products → Add definition)
- `custom.bundle_default_items` (Product list) — already done
- `custom.bundle_discount_percent` (Integer) — recommended default 10
- `custom.bundle_discount_code` (Single line text)
- `custom.bundle_show_variants` (Boolean) — apply per component product
- `custom.bundle_variant_option` (Single line text) — apply per component product

### 3. Configure each bundle product
On every bundle product (e.g. Boat Anchoring Bundle):
- Set `bundle_default_items` to the list of components (already done).
- Set `bundle_discount_percent` to 10 (or whatever).
- Set `bundle_discount_code` to the code created in step 1.

### 4. Configure component products as needed
- For Wave Cobra anchor: set `bundle_show_variants = false`.
- For 5 ft chain: set `bundle_variant_option = Color`.
- For everything else: leave both blank — defaults work.

## How it behaves
- Bundle product pages now show the kit directly under the title. The default price and Add to Cart are hidden.
- Full kit price and discounted "You pay" price update live as the customer toggles items or changes variants.
- Add Kit to Cart applies the discount code automatically and lands the customer on the cart with the discount visible.
- Regular (non-bundle) product pages are unaffected.

## Limits / notes
- The discount code must exist in Shopify Admin and be active — if it's missing or expired, the customer will land on the cart without the discount applied.
- A customer who manually adds the same components individually will not receive the kit discount through this flow (it's tied to the kit Add button).
```

- [ ] **Step 6.6: Commit**

```bash
git add docs/superpowers/plans/2026-04-28-customize-your-kit-v2-client-setup.md
git commit -m "Add client setup guide for Customize Your Kit v2"
```

---

## Edge Cases Checklist

- **Bundle with `bundle_default_items` empty** → not detected as bundle; renders as a regular product. Verified in Task 1.6.
- **Bundle product where the metafield exists but the products inside are deleted** → `bundle_defaults.size` is the count of valid product references; deleted products may surface as `nil`. Liquid `{% for item in default_items %}` skips `nil`. The kit will appear empty if all are deleted; the heading + the count of `0 items` shows. Acceptable — client should remove the metafield value if they delete all components.
- **Component product is deleted while still in the metafield list** → row renders nothing; no breakage.
- **Component sold out** (no available variants) → checkbox disabled, row dimmed (already handled in v1).
- **Component with a single variant + `bundle_show_variants = false`** → behaves identically to v1 single-variant case. No issue.
- **Component with `bundle_variant_option` set but the option name doesn't match any of the product's options** → `filter_index` stays `-1`, falls through to "show all variants". Predictable fallback.
- **Customer toggles items rapidly** → JS uses single change handler; no debouncing needed since formatting is cheap.
- **Discount percent metafield set to negative or > 100** → JS clamps to `[0, 100]` (Step 4.1). Liquid passes the raw integer; JS guards.
- **Customer is on `/cart` when they click and we navigate to `/cart`** — same URL refresh is fine.
- **JS disabled** → kit section shows the markup but doesn't function. The default ATC is hidden, so this customer cannot purchase from the bundle page. Document as known limitation; this is acceptable for this kind of theme work and matches v1 behavior.
- **Two bundle products on a single page** (currently impossible — a product page renders one product) → not a concern.
- **Re-renders from the Shopify section editor** → `kitEl.dataset.bundleInit` guards against double-init.

## Risks

| Risk | Mitigation |
|---|---|
| Client forgets to set `bundle_discount_code` → customer sees discount on page but pays full price at cart | Documented in client setup; consider showing a yellow toast on add when code is missing (out of scope for this plan). |
| Wrong option name in `bundle_variant_option` (case-sensitive) | Falls back to all-variants behavior; not silent failure. Document case-sensitivity in client guide. |
| Removing the default ATC on bundle pages breaks SEO / structured data | The product is still in `product.json` with prices; only the visible UI changes. Acceptable. |
| Users editing the JSON template and removing the `price` or `buy_buttons` blocks | Liquid `case` simply doesn't match any branch; nothing breaks. |
| `/discount/<code>?redirect=/cart` URL pattern is undocumented and could change | This is a long-stable Shopify URL; if it stops working we fall back to applying the code via `cart.update.js` `discount_code` parameter. Keep an eye on it. |

## Self-Review

**Spec coverage** — every numbered client requirement is mapped to at least one task in the table at the top.
**Placeholder scan** — no `TODO`/`TBD`/`fill in details` strings remain.
**Type consistency** — Liquid metafield names (`bundle_discount_percent`, `bundle_discount_code`, `bundle_show_variants`, `bundle_variant_option`) are spelled identically in every task. JS hooks (`data-bundle-discount-percent`, `data-bundle-discount-code`, `data-bundle-full-row`, `data-bundle-discount-row`, `data-bundle-discounted-total`) match between the Liquid markup (Task 3) and the JS reads (Task 4 / 5).
