# Catering / prepackaged menus

Combo products can carry a JSON **catering config** on the product plus optional **modifier price scope** on add-on groups. Together they support:

| Mode | Base price |
|------|------------|
| `package` | Flat package amount (list price or `packagePrice`) |
| `per_person` | `perPersonPrice × guest count` |
| `mixed` | `packagePrice + perPersonPrice × guest count` |

## Merchant setup

1. Create a **combo** product with steps (slots). Set **min/max picks** per step when customers may choose more than one item in a category.
2. In the product editor, enable **Catering / prepackaged menu** and pick pricing mode and guest limits.
3. Attach modifier groups for custom options (cutlery, staff, etc.).
4. On each modifier group, set **Catering price scope**:
   - **Fixed** — one-time surcharge on the line (e.g. flat staff fee).
   - **Per guest** — option price × guest count (e.g. cutlery per person).

## Shop flow

When catering is enabled, the combo wizard shows a **guest count** control. Line total = catering base + slot surcharges + scaled add-ons. Checkout sends `cateringGuestCount` per line; the server reprices for consistency.

## Extending

New rules should extend `backend/src/lib/catering-config.ts` and `catering-pricing.ts` (single pricing pipeline for shop checkout and future POS). Keep merchant UI and shop wizard in sync via the same field names.

## Salsarita-style tier bars (per person × headcount)

Reference: [Salsarita’s catering bars](https://cater.salsaritas.com/) — e.g. Taco Bar with **15 person minimum**, protein tiers at **$12 / $14 / $17 per person**, beans/salsas included at **$0** on other steps.

| Merchant setting | Value |
|------------------|--------|
| Catering enabled | On |
| Pricing mode | **Per person** |
| Min / default guests | **15** |
| Per-person price on product | **0** (or fallback if no tier picked yet) |
| **Per-person tier step** | Combo step *“Select protein combination”* |
| Tier options | Chicken & beef **12**, chicken & steak **14**, all steak **17** (option **extra price** = full rate per guest) |
| Other steps | Beans min 1 max 1, salsas min 2 max 2 — options at **0** extra |

Shop total for 15 guests @ $12 tier: **180** (= 12 × 15). Set **`tierSlotId`** to the protein step id in the product editor.

Copy for description: *Prices are per person ({n} minimum). Use guest count as number of people.*
