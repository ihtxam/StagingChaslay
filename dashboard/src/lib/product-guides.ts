export type GuideAudience = 'merchant' | 'reseller';

export type GuideStep = {
  title: string;
  detail: string;
};

export type GuideChapter = {
  id: string;
  audience: GuideAudience | 'both';
  title: string;
  summary: string;
  outcome: string;
  steps: GuideStep[];
};

export const PRODUCT_GUIDE_CHAPTERS: GuideChapter[] = [
  {
    id: 'reseller-overview',
    audience: 'reseller',
    title: 'Agency panel in 10 minutes',
    summary: 'How the dealer dashboard maps to stores, POS versions, add-ons, and support.',
    outcome: 'You can explain POS vs shop vs reservations to a merchant without mixing them up.',
    steps: [
      {
        title: 'Open Overview',
        detail:
          'Sign in at the agency URL. Overview shows store count, active licenses, suggested monthly revenue, open tickets, and new stores this month. This is the same dealer cockpit SpotOn and Eats365 use: one place for the book of business.',
      },
      {
        title: 'Stores vs POS versions vs packages',
        detail:
          'A store is the merchant. A POS version (Restaurant Pro, Retail Basic, or your clone) is the feature tier on the till. A product package (POS only, shop, website, full) is which guest channels they get. Add-ons (reservations, KDS, ODS, loyalty, gift cards, delivery platforms, photo menu) are priced extras on top.',
      },
      {
        title: 'Use the module price book',
        detail:
          'When you create a store, the module price book lists suggested CHF/month: POS seats, Online shop (Order), Website, Reservations + waitlist, Photo menu, KDS, ODS, Loyalty, Gift cards, Just Eat / Uber Eats. Quote POS first, then guest channels. Do not invent per-cover reservation fees — reservations are a flat monthly module.',
      },
      {
        title: 'Support split inbox',
        detail:
          'Agency → Support is your merchant tickets. Answer from here; merchants never see Superadmin. Link them to Merchant guides (/merchant/guides) for self-serve setup.',
      },
    ],
  },
  {
    id: 'reseller-create-store',
    audience: 'reseller',
    title: 'Create a merchant store (step by step)',
    summary: 'From Add store to first PIN login.',
    outcome: 'A live store with the right POS version, seats, and guest modules.',
    steps: [
      {
        title: 'Add store',
        detail:
          'Stores → Add store. Enter trading name and owner email. Optional password: if empty, the welcome mail can set one. Category Restaurant vs Retail filters which POS versions appear.',
      },
      {
        title: 'Pick the POS version',
        detail:
          'Restaurant Pro for tables, reservations, KDS, dine-in. Retail Basic for barcode / grocery / storekeeper. You can clone a POS version under POS management if this dealer needs a custom feature set.',
      },
      {
        title: 'Seats and license',
        detail:
          'Device license seats = how many tills / handhelds can be online. Trial vs yearly vs custom days. POS posts (main + waiter) cap concurrent Web POS sessions. Photo menu and QR table order do not consume a POS seat.',
      },
      {
        title: 'Turn on guest modules',
        detail:
          'Enable Online shop if they take orders on the website or Google Order. Enable Website / CMS if they need a homepage. Enable Reservations if they take bookings. Enable KDS if kitchen tickets should land on a screen. Use the price book so billing matches what you enabled.',
      },
      {
        title: 'Open the merchant panel',
        detail:
          'After create, use Open panel (impersonate). Walk the merchant through Settings groups: Team, Tables, Service, Guest, Money. Leave them on Merchant guides for the rest.',
      },
    ],
  },
  {
    id: 'reseller-sell-modules',
    audience: 'reseller',
    title: 'How to sell shop, reservations, and photo menu',
    summary: 'Talk tracks that match SpotOn Order / Reserve and Eats365 PhotoMenu.',
    outcome: 'Merchants buy channels, not a pile of leftover tabs.',
    steps: [
      {
        title: 'One catalog, many channels',
        detail:
          'Products live once. POS, shop, website, table QR (photo menu), and delivery platforms all sell the same items. Do not create a second menu for the website.',
      },
      {
        title: 'Shop = first-party Order',
        detail:
          'Shop is not a brochure. Guests order pickup, delivery, or dine-in. Google Order URL (Settings → Tables → Reservations) can point at the Google Food / Order link that lands on this same shop.',
      },
      {
        title: 'Reservations = billed module, no cover fee',
        detail:
          'Enable Reservations on the store. Waitlist is included. Live table link is on by default: seating a booking occupies the floor table and opens a held dine-in ticket on POS. If they want bookings without locking tables, turn Live table link off — the book still runs until they close or complete it.',
      },
      {
        title: 'Photo menu = table QR with photos',
        detail:
          'Print table QR codes (Settings → Tables). Guests scan, see a photo grid, send to kitchen. Staff approve on POS; KDS prints like any other dine-in ticket. Suggested as its own module on the price book.',
      },
    ],
  },
  {
    id: 'merchant-start',
    audience: 'merchant',
    title: 'First day: sign in and Settings groups',
    summary: 'Where everything lives after the leftover-tabs cleanup.',
    outcome: 'You can find Team, Tables, Service, Guest, and Money without hunting.',
    steps: [
      {
        title: 'Sign in',
        detail:
          'Open the merchant panel with the email from your agency. Overview shows today\'s sales, open orders, and shortcuts to Web POS and the shop.',
      },
      {
        title: 'Settings are grouped like the floor',
        detail:
          'Open Settings. The left nav is no longer 30 flat tabs. Groups: Business (identity), Team (users + language), Tables (floor + reservations), Service (hours, POS, KDS, ODS, customer display, receipt, kiosk, signage, delivery), Guest (shop, email, delivery map), Money (taxes, payments, fiscal, accounting).',
      },
      {
        title: 'Fill Business first',
        detail:
          'Settings → Business: trading name, address, phone, VAT, logo. These print on receipts and the shop footer. Save before you open Web POS.',
      },
    ],
  },
  {
    id: 'merchant-team',
    audience: 'merchant',
    title: 'Team: users, roles, and PIN login',
    summary: 'Everyone on the floor signs in with a PIN — not the owner email.',
    outcome: 'Waiters and managers can switch on the till without sharing a password.',
    steps: [
      {
        title: 'Add staff',
        detail:
          'Settings → Team → Users (or Staff). Create each person with a role: waiter, cashier, manager, kitchen. Set a 4-digit PIN.',
      },
      {
        title: 'Web POS PIN',
        detail:
          'On Web POS, tap the user icon and enter the PIN. Managers can cancel, discount, and run end of day. Switch user before handing the till to the next person.',
      },
      {
        title: 'Language',
        detail:
          'Settings → Team → Language sets the panel language (EN / FR / DE). Shop language for guests is under Guest → Shop and can differ.',
      },
    ],
  },
  {
    id: 'merchant-tables',
    audience: 'merchant',
    title: 'Tables: floor plan and QR codes',
    summary: 'Build the room once; POS and reservations share it.',
    outcome: 'Every physical table has a label, capacity, and optional QR.',
    steps: [
      {
        title: 'Draw the floor',
        detail:
          'Settings → Tables. Add rooms, then tables with label and covers. This floor is what Web POS Tables and the reservation book use.',
      },
      {
        title: 'Print table QR (photo menu)',
        detail:
          'Generate a QR per table. Guests scan to open the photo menu for that seat. Orders come in as dine-in / QR table and wait for POS approval when auto-approve is off.',
      },
      {
        title: 'Live link is optional',
        detail:
          'With Live table link ON (default), a seated reservation marks that table occupied and opens a held POS ticket. With it OFF, reservations stay a book only — tables on POS stay free until you sit a walk-in yourself. Either way you close the booking when the party leaves (Complete) or cancels.',
      },
    ],
  },
  {
    id: 'merchant-reservations',
    audience: 'merchant',
    title: 'Reservations: waitlist, seat, and close',
    summary: 'The book, the waitlist, and how it talks to POS tables.',
    outcome: 'You can take a full-slot booking onto the waitlist, promote it, seat it, and finish it.',
    steps: [
      {
        title: 'Turn the module on',
        detail:
          'Settings → Tables → Reservations. Enable online reservations. Set slot interval, seating duration, buffer, party size, and how far ahead guests can book. Auto-accept if you want confirmed without staff review; otherwise bookings stay Pending.',
      },
      {
        title: 'Waitlist when the slot is full',
        detail:
          'Keep Waitlist enabled (default). When max covers for a slot are reached, the shop still takes the request as Waitlist instead of rejecting it. Waitlist covers do not count toward the slot until you promote or seat them.',
      },
      {
        title: 'Promote or seat from waitlist',
        detail:
          'Sales → Reservations (or Web POS → Bookings). Filter Waitlist. Promote moves them to Confirmed when a table or covers free up. Seat (from Pending, Confirmed, or Waitlist) sits the party now.',
      },
      {
        title: 'Seat opens a POS ticket when live-linked',
        detail:
          'If Live table link is on and a table is assigned, Seat marks the floor table occupied and holds an empty dine-in order with the guest name. Add food on POS as usual. If live link is off, Seat only updates the booking — you pick a table on POS yourself.',
      },
      {
        title: 'Keep the booking open until you close it',
        detail:
          'Statuses: Pending → Confirmed or Waitlist → Seated → Completed. Or Cancelled / Rejected / No-show. Complete is only available from Seated. The reservation stays open until you close it — it does not auto-vanish when the shop slot ends.',
      },
      {
        title: 'Google Reserve / Order links',
        detail:
          'Paste your Google Reserve URL and Google Order URL in the same settings card. They appear on the public shop footer so guests coming from Google land on your book or your menu.',
      },
    ],
  },
  {
    id: 'merchant-photo-menu',
    audience: 'merchant',
    title: 'Photo menu (table QR)',
    summary: 'Guests browse photos at the table and send to the kitchen.',
    outcome: 'A scanned table shows a photo grid and tickets reach KDS after POS approval.',
    steps: [
      {
        title: 'Photos on products',
        detail:
          'Products → each item. Upload a photo. The table QR page uses a 2-column photo grid when Photo menu is enabled (Settings → Tables → Reservations). Without a photo, the tile shows the first letter.',
      },
      {
        title: 'Enable photo menu + print QR',
        detail:
          'Settings → Tables → Reservations → Photo menu. Then Settings → Tables → print or download QR codes. Stick one per table. The signed link is unique to that table.',
      },
      {
        title: 'Service flow',
        detail:
          'Guest scans → adds dishes → Send to kitchen. If QR auto-approve is off, the order waits on POS / Orders. Approve it; KDS and kitchen printers fire like a waiter ticket. Pay at table is a separate toggle on table QR settings.',
      },
    ],
  },
  {
    id: 'merchant-service',
    audience: 'merchant',
    title: 'Service: hours, POS, KDS, ODS',
    summary: 'The kitchen and floor screens that every channel hits.',
    outcome: 'One kitchen pipeline for POS, shop, QR, and delivery platforms.',
    steps: [
      {
        title: 'Hours',
        detail:
          'Settings → Service → Hours. Set pickup / dine-in / delivery. Reservations can reuse takeaway hours or use custom dine-in hours.',
      },
      {
        title: 'Web POS',
        detail:
          'Settings → Service → POS for register layout, and the ⋯ menu in Web POS for printers and shift. Scan barcodes from the search box — the cart row flashes when a scan adds or stacks a line.',
      },
      {
        title: 'KDS and ODS',
        detail:
          'KDS is the kitchen display. ODS is expo / pickup. Enable both as add-ons with your agency. Online shop, photo menu, and POS tickets all land here — do not run a second kitchen list.',
      },
      {
        title: 'Delivery platforms',
        detail:
          'Just Eat / Uber Eats (Money / Service delivery platforms) inject orders onto the same POS and KDS. Ask your agency to enable the add-on first.',
      },
    ],
  },
  {
    id: 'merchant-guest',
    audience: 'merchant',
    title: 'Guest: shop, website, and Google links',
    summary: 'The public channels that sell the same catalog.',
    outcome: 'Homepage Order / Reserve buttons and the shop footer match what you sell.',
    steps: [
      {
        title: 'Online shop',
        detail:
          'Settings → Guest → Shop. Accept orders, delivery zones, vacation message, product photos on the menu. Share the shop URL. This is the Order channel.',
      },
      {
        title: 'Website / CMS',
        detail:
          'Website builder (sidebar → CMS) publishes the homepage. Put Order (menu) and Reserve (reservations) buttons on the hero. Do not duplicate the catalog in the CMS.',
      },
      {
        title: 'Google Order and Reserve',
        detail:
          'After Google verifies your listing, paste the Order and Reserve URLs under Settings → Tables → Reservations. The shop footer shows them next to Order online and Reservations.',
      },
    ],
  },
  {
    id: 'merchant-money',
    audience: 'merchant',
    title: 'Money: taxes, payments, fiscal',
    summary: 'What prints on the receipt and what Adyen charges.',
    outcome: 'Correct VAT and a working card terminal / online card.',
    steps: [
      {
        title: 'Taxes',
        detail:
          'Settings → Money → Taxes. Takeaway, dine-in, and delivery rates. Prices include tax unless you turn that off.',
      },
      {
        title: 'Payments',
        detail:
          'Adyen for online cards and terminals. Cash is always available on POS. Gift cards and vouchers apply on shop and POS when those modules are on.',
      },
      {
        title: 'Fiscal / accounting',
        detail:
          'Fiskaly (DE/FR) and Bexio / Odoo live under Money. Turn them on only after your agency confirmed the legal entity.',
      },
    ],
  },
  {
    id: 'merchant-floor-day',
    audience: 'merchant',
    title: 'A service: book → waitlist → seat → ticket → close',
    summary: 'The live dinner rush using the optional table link.',
    outcome: 'You know when the floor is linked and when the book runs on its own.',
    steps: [
      {
        title: 'Before service',
        detail:
          'Check Sales → Reservations for tonight. Confirm pending, assign tables, print the book if you like. Waitlist stays visible as its own filter.',
      },
      {
        title: 'Walk-ins vs bookings',
        detail:
          'Walk-in: sit them on Web POS Tables — that occupies the floor without a reservation. Booking: Seat from the book. If live link is on, the table turns occupied and a held ticket appears. If live link is off, sit them on POS after you greet them; the booking stays Seated until you Complete it.',
      },
      {
        title: 'Full slot',
        detail:
          'Shop guests still join the waitlist. When a table frees (Complete the seated booking, or clear the POS table), Promote the next waitlist party and Seat them.',
      },
      {
        title: 'Close the party',
        detail:
          'Pay the POS ticket. Then Complete the reservation. That is the official close — not the kitchen finishing, not the slot clock. Cancel / no-show if they never arrived.',
      },
    ],
  },
];

export function guidesForAudience(audience: GuideAudience): GuideChapter[] {
  return PRODUCT_GUIDE_CHAPTERS.filter((c) => c.audience === audience || c.audience === 'both');
}
