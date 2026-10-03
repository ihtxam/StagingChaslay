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
