import type { Locale } from '@/lib/i18n';

export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
};

export type HelpCategory = {
  id: string;
  title: string;
  summary: string;
  articles: HelpArticle[];
};

type LocalizedHelp = Record<Locale, HelpCategory[]>;

const en: HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    summary: 'Sign in, business setup, staff PINs, and your first sale.',
    articles: [
      {
        id: 'first-login',
        title: 'First login & dashboard',
        summary: 'Access your merchant panel and overview.',
        body: 'Open app.rebornsense.com and sign in with the email and password from your welcome message. The Overview shows today\'s sales, open orders, and quick links to Web POS and your online shop.',
      },
      {
        id: 'business-info',
        title: 'Set up business information',
        summary: 'Name, address, VAT, hours, and receipt details.',
        body: 'Go to Settings → Business. Enter your trading name, address, phone, VAT number, and opening hours. These details appear on receipts, kitchen tickets, and your online shop. Save changes before opening Web POS or printing your first sale.',
      },
      {
        id: 'settings-groups',
        title: 'Settings groups (Team / Tables / Service / Guest / Money)',
        summary: 'Find settings by floor job, not leftover tabs.',
        body: 'Settings are grouped: Business (identity), Team (users + language), Tables (floor + reservations), Service (hours, POS, KDS, ODS, customer display, receipt, kiosk, signage, delivery), Guest (shop, email, delivery map), Money (taxes, payments, fiscal, accounting). Open Guides in the sidebar for the full step-by-step.',
      },
      {
        id: 'language',
        title: 'Change panel language',
        summary: 'Switch between English, French, and German.',
        body: 'Use the language selector in the sidebar footer or Settings → Business. Panel language affects menus and reports; shop language is configured separately for customers.',
      },
      {
        id: 'staff-pins',
        title: 'Staff accounts & PIN login',
        summary: 'Create waiters and managers for Web POS.',
        body: 'Open Staff and add each team member with a role (waiter, manager, etc.). Set a 4-digit PIN per person. In Web POS, staff sign in with their PIN using the user icon in the top bar. Managers can cancel orders and run end-of-day reports.',
      },
    ],
  },
  {
    id: 'products',
    title: 'Products & catalog',
    summary: 'Categories, products, modifiers, barcodes, and photos.',
    articles: [
      {
        id: 'add-categories',
        title: 'Add categories',
        summary: 'Organize your menu or retail catalog.',
        body: 'Go to Categories and create groups such as Starters, Mains, or Drinks. Assign a color and sort order so they appear correctly in Web POS and your online shop. Categories can be hidden from the shop while staying available on the till.',
      },
      {
        id: 'add-product',
        title: 'Add products',
        summary: 'Build your sellable items with prices and tax.',
        body: 'Go to Products → Add product. Each item needs a name, price, and category. Set tax rate, kitchen print target, and barcode/SKU if needed. Use modifiers for extras (size, toppings). Import missing photos from the Products page or upload your own images.',
      },
      {
        id: 'barcodes',
        title: 'Barcodes & labels',
        summary: 'Generate Code128 barcodes and print labels.',
        body: 'Open Products, generate missing barcodes, then click price or barcode to preview labels. Connect a LuckyDoor (EML-400L / TSPL) or Niimbot via Settings → Receipts & printers, enable the Labels role, and print from Products or Storekeeper.',
      },
    ],
  },
  {
    id: 'pos',
    title: 'Web POS & orders',
    summary: 'Take orders, payments, kitchen tickets, and shifts.',
    articles: [
      {
        id: 'print-agent',
        title: 'Install printer software',
        summary: 'Reborn Print Agent for receipts and kitchen tickets.',
        body: 'On the PC connected to your receipt or kitchen printer, download and install the Reborn Print Agent from Settings → Terminals. Keep the agent running while Web POS is open. In Web POS, open the menu (⋯) → Printing, pick your thermal printer, and click Refresh printers. The status should show Print agent online.',
      },
      {
        id: 'webpos-basics',
        title: 'Web POS quick start',
        summary: 'Register, cart, kitchen, and checkout.',
        body: 'Open Web POS from the sidebar. Tap products on the Register tab to fill the cart. Send items to the kitchen when ready (restaurant mode). Use the bell icon for online orders. Switch staff with the user icon before the bell. Open checkout for cash, card, or terminal payment. Printer, shift, sync, and your personal terminal are in the ⋯ menu.',
      },
      {
        id: 'webpos',
        title: 'Using Web POS',
        summary: 'Ring up sales from browser or tablet.',
        body: 'Add items to cart, apply discounts if permitted, choose payment method, and complete checkout. Kitchen orders appear on KDS when enabled. Use Tables for dine-in and Orders for history and online pickups.',
      },
      {
        id: 'orders',
        title: 'Order history & refunds',
        summary: 'Find past sales and issue refunds.',
        body: 'Orders lists all completed and online orders. Open an order for details, reprint receipts, or process refunds when your role allows.',
      },
    ],
  },
  {
    id: 'shop',
    title: 'Online shop',
    summary: 'Customer-facing shop, hours, delivery, and checkout.',
    articles: [
      {
        id: 'online-shop',
        title: 'Configure your shop',
        summary: 'Enable ordering, delivery zones, and payments.',
        body: 'Online Shop settings control accepting orders, delivery fees, Adyen card payments, and vacation mode. Share your shop URL from Settings or Website CMS.',
      },
    ],
  },
  {
    id: 'website',
    title: 'Website & CMS',
    summary: 'Homepage builder, SEO, and published pages.',
    articles: [
      {
        id: 'cms',
        title: 'Page builder & SEO',
        summary: 'Design your homepage and meta tags.',
        body: 'Website CMS lets you edit OpenPage blocks, set SEO title and description, and publish to your shop homepage. Default theme is white background with blue buttons.',
      },
    ],
  },
  {
    id: 'reservations',
    title: 'Reservations & tables',
    summary: 'Bookings, floor plan, and table QR codes.',
    articles: [
      {
        id: 'reservations',
        title: 'Manage reservations',
        summary: 'Confirm, reject, and email guests.',
        body: 'Sales → Reservations shows incoming bookings. Guests receive confirmation emails in the shop language (EN/FR/DE). Configure slots and party sizes in Settings → Tables → Reservations. Open Merchant guides for the full book → waitlist → seat → close flow.',
      },
      {
        id: 'waitlist',
        title: 'Waitlist when a slot is full',
        summary: 'Keep taking requests instead of rejecting the guest.',
        body: 'Settings → Tables → Reservations → Waitlist (on by default). When max covers for a slot are reached, the shop still accepts the request as Waitlist. Those covers do not count until you Promote or Seat. Filter Waitlist on Sales → Reservations or Web POS → Bookings.',
      },
      {
        id: 'live-table-link',
        title: 'Live-link POS tables (or keep the book open)',
        summary: 'Optional: seating occupies the floor and opens a held ticket.',
        body: 'Live table link ON (default): Seat marks the table occupied and holds an empty dine-in POS ticket with the guest name. OFF: reservations stay a book until you Complete / Cancel them — sit walk-ins on POS yourself. Either way the booking stays open until you close it.',
      },
      {
        id: 'photo-menu',
        title: 'Photo menu (table QR)',
        summary: 'Guests scan the table, browse photos, and send to kitchen.',
        body: 'Upload product photos, enable Photo menu under Settings → Tables → Reservations, then print table QR codes. Guests see a 2-column photo grid. Send to kitchen → approve on POS → KDS. Pay at table is a separate table-QR toggle.',
      },
    ],
  },
  {
    id: 'guides',
    title: 'Product guides',
    summary: 'Full step-by-step for merchants (and agencies).',
    articles: [
      {
        id: 'open-guides',
        title: 'Open the full guides',
        summary: 'Sidebar → Guides, or profile menu → Guides.',
        body: 'Merchant guides cover first day, Team, Tables, reservations + waitlist, photo menu, Service, Guest, Money, and a dinner-rush walkthrough. Agencies have a matching Guides page under Support: create store, price book, and how to sell shop / reserve / photo menu.',
      },
    ],
  },
  {
    id: 'customers',
    title: 'Customers & loyalty',
    summary: 'CRM, members, vouchers, and loyalty points.',
    articles: [
      {
        id: 'loyalty',
        title: 'Loyalty & vouchers',
        summary: 'Reward repeat customers.',
        body: 'Set up loyalty rules and voucher codes under Customers. Vouchers can be applied at online shop checkout.',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing & subscription',
    summary: 'Plans, device limits, and platform shop.',
    articles: [
      {
        id: 'subscription',
        title: 'Subscription & billing',
        summary: 'Upgrade plan and pay online.',
        body: 'Account → Billing shows your plan, device limits, and product caps. Pay securely via Adyen. Order supplies from the Reborn shop in the same account menu.',
      },
    ],
  },
  {
    id: 'support',
    title: 'Support & status',
    summary: 'Tickets, announcements, and system status.',
    articles: [
      {
        id: 'tickets',
        title: 'Support tickets',
        summary: 'Contact your agency or Reborn support.',
        body: 'Open Support from the sidebar profile menu. Browse help articles first, then create a ticket if needed. Tickets auto-close after 3 days — open a new ticket for ongoing issues. Check the bell icon for platform announcements.',
      },
    ],
  },
];

// French & German: mirror structure with translated titles/summaries (condensed)
const fr: HelpCategory[] = en.map((c) => ({
  ...c,
  title:
    {
      'getting-started': 'Premiers pas',
      products: 'Produits & catalogue',
      pos: 'Web POS & commandes',
      shop: 'Boutique en ligne',
      website: 'Site web & CMS',
      reservations: 'Réservations & tables',
      guides: 'Guides produit',
      customers: 'Clients & fidélité',
      billing: 'Facturation & abonnement',
      support: 'Support & statut',
    }[c.id] || c.title,
  summary: c.summary,
  articles: c.articles.map((a) => ({ ...a, title: a.title, summary: a.summary, body: a.body })),
}));

const de: HelpCategory[] = en.map((c) => ({
  ...c,
  title:
    {
      'getting-started': 'Erste Schritte',
      products: 'Produkte & Katalog',
      pos: 'Web POS & Bestellungen',
      shop: 'Online-Shop',
      website: 'Website & CMS',
      reservations: 'Reservierungen & Tische',
      guides: 'Produktanleitungen',
      customers: 'Kunden & Treue',
      billing: 'Abrechnung & Abo',
      support: 'Support & Status',
    }[c.id] || c.title,
}));

const DATA: LocalizedHelp = { en, fr, de };

export function getHelpCategories(locale: Locale): HelpCategory[] {
  return DATA[locale] || DATA.en;
}

export function searchHelpArticles(locale: Locale, query: string): Array<HelpArticle & { categoryId: string; categoryTitle: string }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: Array<HelpArticle & { categoryId: string; categoryTitle: string }> = [];
  for (const cat of getHelpCategories(locale)) {
    for (const art of cat.articles) {
      const hay = `${art.title} ${art.summary} ${art.body} ${cat.title}`.toLowerCase();
      if (hay.includes(q)) {
        out.push({ ...art, categoryId: cat.id, categoryTitle: cat.title });
      }
    }
  }
  return out;
}

export const SUPPORT_SUBCATEGORIES: Record<
  string,
  Record<Locale, Array<{ id: string; label: string }>>
> = {
  technical: {
    en: [
      { id: 'pos', label: 'Web POS / POS issue' },
      { id: 'shop', label: 'Online shop issue' },
      { id: 'printer', label: 'Printer / receipt issue' },
      { id: 'payment', label: 'Payment / Adyen issue' },
      { id: 'reservations', label: 'Reservations issue' },
      { id: 'website', label: 'Website / CMS issue' },
      { id: 'other', label: 'Other technical issue' },
    ],
    fr: [
      { id: 'pos', label: 'Problème Web POS / caisse' },
      { id: 'shop', label: 'Problème boutique en ligne' },
      { id: 'printer', label: 'Problème imprimante' },
      { id: 'payment', label: 'Problème paiement / Adyen' },
      { id: 'reservations', label: 'Problème réservations' },
      { id: 'website', label: 'Problème site / CMS' },
      { id: 'other', label: 'Autre problème technique' },
    ],
    de: [
      { id: 'pos', label: 'Web POS / Kassenproblem' },
      { id: 'shop', label: 'Online-Shop Problem' },
      { id: 'printer', label: 'Druckerproblem' },
      { id: 'payment', label: 'Zahlung / Adyen Problem' },
      { id: 'reservations', label: 'Reservierungsproblem' },
      { id: 'website', label: 'Website / CMS Problem' },
      { id: 'other', label: 'Anderes technisches Problem' },
    ],
  },
  accounting: {
    en: [
      { id: 'invoice', label: 'Invoice / billing question' },
      { id: 'subscription', label: 'Subscription / plan' },
      { id: 'vat', label: 'VAT / tax settings' },
      { id: 'proof', label: 'Proof of payment' },
      { id: 'other', label: 'Other accounting issue' },
    ],
    fr: [
      { id: 'invoice', label: 'Facture / facturation' },
      { id: 'subscription', label: 'Abonnement / forfait' },
      { id: 'vat', label: 'TVA / paramètres fiscaux' },
      { id: 'proof', label: 'Preuve de paiement' },
      { id: 'other', label: 'Autre question comptable' },
    ],
    de: [
      { id: 'invoice', label: 'Rechnung / Abrechnung' },
      { id: 'subscription', label: 'Abo / Plan' },
      { id: 'vat', label: 'MwSt / Steuer' },
      { id: 'proof', label: 'Zahlungsnachweis' },
      { id: 'other', label: 'Anderes Buchhaltungsthema' },
    ],
  },
  miscellaneous: {
    en: [
      { id: 'feature', label: 'Feature request' },
      { id: 'general', label: 'General question' },
      { id: 'other', label: 'Other' },
    ],
    fr: [
      { id: 'feature', label: 'Demande de fonctionnalité' },
      { id: 'general', label: 'Question générale' },
      { id: 'other', label: 'Autre' },
    ],
    de: [
      { id: 'feature', label: 'Funktionswunsch' },
      { id: 'general', label: 'Allgemeine Frage' },
      { id: 'other', label: 'Sonstiges' },
    ],
  },
};

export const LANG_FLAGS: Record<Locale, string> = { en: '🇬🇧', fr: '🇫🇷', de: '🇩🇪' };
