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
        body: 'Settings are grouped: Business (identity), Team (users + language), Tables (floor + reservations), Service (hours, POS, KDS, ODS, customer display, receipt, kiosk, signage, delivery), Guest (shop, email, delivery map), Money (taxes, payments, fiscal, accounting). Open Support → Help center for the full step-by-step setup guides.',
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
        summary: 'RebornPOS desktop app for the Windows till (Print Agent is bundled).',
        body: 'On the Windows till, open Settings → Receipts & printers and download RebornPOS (the desktop application), not the old Print Agent 1.10.6 sidecar. Install the EXE once; printing is bundled. Android tablets still use Bridge Reborn. In Web POS, open the menu (⋯) → Printing, pick your thermal printer, and click Refresh printers.',
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
        summary: 'Support → Help center, under Setup guides.',
        body: 'Merchant guides live in Support → Help center. They cover first day, Team, Tables, reservations + waitlist, photo menu, Service, Guest, Money, and a dinner-rush walkthrough.',
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
        body: 'Open Support from the sidebar. Browse setup guides and help articles first, then create a ticket if needed. Tickets auto-close after 3 days — open a new ticket for ongoing issues. When your reseller answers, a banner appears on the dashboard and under the bell — tap it to open the ticket.',
      },
    ],
  },
];

const fr: HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Premiers pas',
    summary: 'Connexion, fiche entreprise, PIN du personnel et première vente.',
    articles: [
      {
        id: 'first-login',
        title: 'Première connexion et tableau de bord',
        summary: 'Accéder au panneau marchand et à l’aperçu.',
        body: 'Ouvrez app.rebornsense.com et connectez-vous avec l’e-mail et le mot de passe du message de bienvenue. L’aperçu affiche les ventes du jour, les commandes ouvertes et les raccourcis vers Web POS et la boutique en ligne.',
      },
      {
        id: 'business-info',
        title: 'Renseigner les informations de l’entreprise',
        summary: 'Nom, adresse, TVA, horaires et mentions du ticket.',
        body: 'Allez dans Réglages → Entreprise. Saisissez le nom commercial, l’adresse, le téléphone, le numéro de TVA et les horaires. Ces informations apparaissent sur les tickets, les bons cuisine et la boutique. Enregistrez avant d’ouvrir Web POS ou d’imprimer la première vente.',
      },
      {
        id: 'settings-groups',
        title: 'Groupes de réglages (Équipe / Tables / Service / Client / Argent)',
        summary: 'Trouver les réglages par métier, pas par onglets restants.',
        body: 'Les réglages sont groupés : Entreprise (identité), Équipe (utilisateurs + langue), Tables (salle + réservations), Service (horaires, POS, KDS, ODS, afficheur client, ticket, kiosque, signalétique, livraison), Client (boutique, e-mail, carte de livraison), Argent (taxes, paiements, fiscal, comptabilité). Ouvrez Support → Centre d’aide pour les guides pas à pas.',
      },
      {
        id: 'language',
        title: 'Changer la langue du panneau',
        summary: 'Basculer entre anglais, français et allemand.',
        body: 'Utilisez le sélecteur de langue en bas de la barre latérale ou Réglages → Entreprise. La langue du panneau concerne les menus et rapports ; la langue boutique se configure à part pour les clients.',
      },
      {
        id: 'staff-pins',
        title: 'Comptes du personnel et connexion PIN',
        summary: 'Créer serveurs et managers pour Web POS.',
        body: 'Ouvrez Personnel et ajoutez chaque membre avec un rôle (serveur, manager, etc.). Définissez un PIN à 4 chiffres. Dans Web POS, le personnel se connecte avec son PIN via l’icône utilisateur. Les managers peuvent annuler des commandes et lancer la clôture.',
      },
    ],
  },
  {
    id: 'products',
    title: 'Produits & catalogue',
    summary: 'Catégories, produits, suppléments, codes-barres et photos.',
    articles: [
      {
        id: 'add-categories',
        title: 'Ajouter des catégories',
        summary: 'Organiser le menu ou le catalogue retail.',
        body: 'Allez dans Catégories et créez des groupes comme Entrées, Plats ou Boissons. Attribuez une couleur et un ordre pour Web POS et la boutique. Une catégorie peut être masquée en boutique tout en restant disponible à la caisse.',
      },
      {
        id: 'add-product',
        title: 'Ajouter des produits',
        summary: 'Créer les articles vendables avec prix et taxe.',
        body: 'Produits → Ajouter un produit. Chaque article a besoin d’un nom, d’un prix et d’une catégorie. Définissez le taux de taxe, la cible d’impression cuisine et le code-barres / SKU. Utilisez les suppléments pour les extras (taille, garnitures). Importez les photos manquantes depuis Produits ou téléversez les vôtres.',
      },
      {
        id: 'barcodes',
        title: 'Codes-barres et étiquettes',
        summary: 'Générer des codes Code128 et imprimer des étiquettes.',
        body: 'Ouvrez Produits, générez les codes manquants, puis cliquez prix ou code-barres pour prévisualiser les étiquettes. Connectez un LuckyDoor (EML-400L / TSPL) ou Niimbot via Réglages → Tickets & imprimantes, activez le rôle Étiquettes, et imprimez depuis Produits ou Magasinier.',
      },
    ],
  },
  {
    id: 'pos',
    title: 'Web POS & commandes',
    summary: 'Prendre les commandes, paiements, tickets cuisine et shifts.',
    articles: [
      {
        id: 'print-agent',
        title: 'Installer le logiciel d’impression',
        summary: 'Application bureau RebornPOS pour la caisse Windows (Print Agent inclus).',
        body: 'Sur la caisse Windows, ouvrez Réglages → Tickets & imprimantes et téléchargez RebornPOS (l’application bureau), pas l’ancien sidecar Print Agent 1.10.6. Installez l’EXE une fois ; l’impression est incluse. Les tablettes Android utilisent encore Bridge Reborn. Dans Web POS, ouvrez le menu (⋯) → Impression, choisissez l’imprimante thermique, puis Actualiser les imprimantes.',
      },
      {
        id: 'webpos-basics',
        title: 'Démarrage rapide Web POS',
        summary: 'Caisse, panier, cuisine et encaissement.',
        body: 'Ouvrez Web POS depuis la barre. Touchez les produits de l’onglet Caisse pour remplir le panier. Envoyez en cuisine quand c’est prêt (mode restaurant). L’icône cloche sert aux commandes en ligne. Changez d’utilisateur avant de passer la caisse. Ouvrez l’encaissement pour espèces, carte ou terminal. Imprimante, shift, sync et terminal personnel sont dans le menu ⋯.',
      },
      {
        id: 'webpos',
        title: 'Utiliser Web POS',
        summary: 'Encaisser depuis le navigateur ou une tablette.',
        body: 'Ajoutez des articles au panier, appliquez une remise si autorisé, choisissez le paiement et terminez. Les commandes cuisine apparaissent au KDS s’il est activé. Utilisez Tables pour le sur place et Commandes pour l’historique et les retraits en ligne.',
      },
      {
        id: 'orders',
        title: 'Historique des commandes et remboursements',
        summary: 'Retrouver les ventes et émettre un remboursement.',
        body: 'Commandes liste toutes les ventes terminées et en ligne. Ouvrez une commande pour le détail, réimprimer un ticket ou rembourser si votre rôle le permet.',
      },
    ],
  },
  {
    id: 'shop',
    title: 'Boutique en ligne',
    summary: 'Boutique client, horaires, livraison et paiement.',
    articles: [
      {
        id: 'online-shop',
        title: 'Configurer la boutique',
        summary: 'Activer les commandes, zones de livraison et paiements.',
        body: 'Les réglages Boutique contrôlent l’acceptation des commandes, les frais de livraison, les cartes Adyen et le mode vacances. Partagez l’URL depuis Réglages ou le CMS du site.',
      },
    ],
  },
  {
    id: 'website',
    title: 'Site web & CMS',
    summary: 'Constructeur de page d’accueil, SEO et pages publiées.',
    articles: [
      {
        id: 'cms',
        title: 'Constructeur de pages et SEO',
        summary: 'Concevoir la page d’accueil et les balises meta.',
        body: 'Le CMS site permet d’éditer les blocs OpenPage, de définir titre et description SEO, et de publier sur la page d’accueil boutique. Le thème par défaut est fond blanc et boutons bleus.',
      },
    ],
  },
  {
    id: 'reservations',
    title: 'Réservations & tables',
    summary: 'Bookings, plan de salle et QR de table.',
    articles: [
      {
        id: 'reservations',
        title: 'Gérer les réservations',
        summary: 'Confirmer, refuser et e-mailer les clients.',
        body: 'Ventes → Réservations affiche les bookings. Les clients reçoivent les e-mails de confirmation dans la langue boutique (EN/FR/DE). Configurez créneaux et tailles de groupe dans Réglages → Tables → Réservations. Ouvrez les guides marchand pour le flux carnet → liste d’attente → asseoir → clôturer.',
      },
      {
        id: 'waitlist',
        title: 'Liste d’attente quand un créneau est plein',
        summary: 'Continuer à prendre des demandes au lieu de refuser le client.',
        body: 'Réglages → Tables → Réservations → Liste d’attente (activée par défaut). Quand le max de couverts d’un créneau est atteint, la boutique accepte encore la demande en liste d’attente. Ces couverts ne comptent pas tant que vous ne les promouvez ou n’asseyez pas. Filtrez Liste d’attente dans Ventes → Réservations ou Web POS → Réservations.',
      },
      {
        id: 'live-table-link',
        title: 'Lier les tables POS (ou garder le carnet ouvert)',
        summary: 'Optionnel : asseoir occupe la salle et ouvre un ticket en attente.',
        body: 'Lien table live ON (défaut) : Asseoir marque la table occupée et tient un ticket POS sur place vide au nom du client. OFF : les réservations restent un carnet jusqu’à Terminer / Annuler — asseyez les walk-in vous-même au POS. Dans les deux cas, la réservation reste ouverte jusqu’à clôture.',
      },
      {
        id: 'photo-menu',
        title: 'Menu photo (QR table)',
        summary: 'Les clients scannent la table, voient les photos et envoient en cuisine.',
        body: 'Téléversez des photos produit, activez Menu photo sous Réglages → Tables → Réservations, puis imprimez les QR de table. Les clients voient une grille photo 2 colonnes. Envoyer en cuisine → approuver au POS → KDS. Payer à table est un interrupteur QR table séparé.',
      },
    ],
  },
  {
    id: 'guides',
    title: 'Guides produit',
    summary: 'Pas à pas complets pour commerçants (et agences).',
    articles: [
      {
        id: 'open-guides',
        title: 'Ouvrir les guides complets',
        summary: 'Support → Centre d’aide, sous Guides de mise en route.',
        body: 'Les guides marchand sont dans Support → Centre d’aide. Ils couvrent le premier jour, Équipe, Tables, réservations + liste d’attente, menu photo, Service, Client, Argent, et un parcours de rush du soir.',
      },
    ],
  },
  {
    id: 'customers',
    title: 'Clients & fidélité',
    summary: 'CRM, membres, bons et points de fidélité.',
    articles: [
      {
        id: 'loyalty',
        title: 'Fidélité et bons',
        summary: 'Récompenser les clients réguliers.',
        body: 'Configurez les règles de fidélité et les codes bons sous Clients. Les bons s’appliquent au paiement de la boutique en ligne.',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Facturation & abonnement',
    summary: 'Forfaits, limites d’appareils et boutique plateforme.',
    articles: [
      {
        id: 'subscription',
        title: 'Abonnement et facturation',
        summary: 'Changer de forfait et payer en ligne.',
        body: 'Compte → Facturation affiche le forfait, les limites d’appareils et les plafonds produit. Paiement sécurisé via Adyen. Commandez les fournitures dans la boutique Reborn du même menu compte.',
      },
    ],
  },
  {
    id: 'support',
    title: 'Support & statut',
    summary: 'Tickets, annonces et statut système.',
    articles: [
      {
        id: 'tickets',
        title: 'Tickets de support',
        summary: 'Contacter votre agence ou le support Reborn.',
        body: 'Ouvrez Support depuis le menu compte. Consultez d’abord les guides et articles d’aide, puis créez un ticket si besoin. Les tickets se ferment automatiquement après 3 jours — ouvrez-en un nouveau pour continuer. Consultez l’icône cloche pour les annonces plateforme.',
      },
    ],
  },
];

const de: HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Erste Schritte',
    summary: 'Anmelden, Betrieb einrichten, Personal-PINs und der erste Verkauf.',
    articles: [
      {
        id: 'first-login',
        title: 'Erste Anmeldung und Dashboard',
        summary: 'Händlerpanel und Übersicht öffnen.',
        body: 'Öffnen Sie app.rebornsense.com und melden Sie sich mit E-Mail und Passwort aus der Willkommensnachricht an. Die Übersicht zeigt den Tagesumsatz, offene Bestellungen und Schnellzugriffe auf Web POS und den Online-Shop.',
      },
      {
        id: 'business-info',
        title: 'Betriebsdaten hinterlegen',
        summary: 'Name, Adresse, MwSt, Zeiten und Belegangaben.',
        body: 'Gehen Sie zu Einstellungen → Betrieb. Handelsname, Adresse, Telefon, MwSt-Nummer und Öffnungszeiten eintragen. Diese Angaben erscheinen auf Belegen, Küchentickets und im Shop. Speichern, bevor Sie Web POS öffnen oder den ersten Verkauf drucken.',
      },
      {
        id: 'settings-groups',
        title: 'Einstellungsgruppen (Team / Tische / Service / Gast / Geld)',
        summary: 'Einstellungen nach Saalaufgabe finden, nicht nach Rest-Tabs.',
        body: 'Einstellungen sind gruppiert: Betrieb (Identität), Team (Benutzer + Sprache), Tische (Saal + Reservierungen), Service (Zeiten, POS, KDS, ODS, Kundendisplay, Beleg, Kiosk, Beschilderung, Lieferung), Gast (Shop, E-Mail, Lieferkarte), Geld (Steuern, Zahlungen, Fiskal, Buchhaltung). Öffnen Sie Support → Hilfe-Center für die vollständigen Schritt-für-Schritt-Guides.',
      },
      {
        id: 'language',
        title: 'Panel-Sprache ändern',
        summary: 'Zwischen Englisch, Französisch und Deutsch wechseln.',
        body: 'Nutzen Sie den Sprachwähler im Footer der Seitenleiste oder Einstellungen → Betrieb. Die Panel-Sprache betrifft Menüs und Berichte; die Shop-Sprache wird separat für Kunden konfiguriert.',
      },
      {
        id: 'staff-pins',
        title: 'Personalkonten und PIN-Login',
        summary: 'Kellner und Manager für Web POS anlegen.',
        body: 'Personal öffnen und jedes Teammitglied mit einer Rolle anlegen (Kellner, Manager usw.). Eine 4-stellige PIN setzen. Im Web POS meldet sich das Personal mit der PIN über das Benutzersymbol an. Manager können Bestellungen stornieren und den Tagesabschluss machen.',
      },
    ],
  },
  {
    id: 'products',
    title: 'Produkte & Katalog',
    summary: 'Kategorien, Produkte, Modifier, Barcodes und Fotos.',
    articles: [
      {
        id: 'add-categories',
        title: 'Kategorien hinzufügen',
        summary: 'Menü oder Retail-Katalog gliedern.',
        body: 'Gehen Sie zu Kategorien und legen Sie Gruppen wie Vorspeisen, Hauptgerichte oder Getränke an. Farbe und Sortierung setzen, damit sie in Web POS und Shop richtig erscheinen. Kategorien können im Shop versteckt bleiben und an der Kasse verfügbar sein.',
      },
      {
        id: 'add-product',
        title: 'Produkte hinzufügen',
        summary: 'Verkaufbare Artikel mit Preis und Steuer anlegen.',
        body: 'Produkte → Produkt hinzufügen. Jeder Artikel braucht Name, Preis und Kategorie. Steuersatz, Küchendruckziel und Barcode/SKU setzen. Modifier für Extras (Größe, Beläge) nutzen. Fehlende Fotos von der Produktseite importieren oder eigene Bilder hochladen.',
      },
      {
        id: 'barcodes',
        title: 'Barcodes und Etiketten',
        summary: 'Code128-Barcodes erzeugen und Etiketten drucken.',
        body: 'Produkte öffnen, fehlende Barcodes erzeugen, dann Preis oder Barcode klicken, um Etiketten vorzuschauen. LuckyDoor (EML-400L / TSPL) oder Niimbot unter Einstellungen → Belege & Drucker verbinden, Rolle Etiketten aktivieren und von Produkte oder Storekeeper drucken.',
      },
    ],
  },
  {
    id: 'pos',
    title: 'Web POS & Bestellungen',
    summary: 'Bestellungen, Zahlungen, Küchentickets und Schichten.',
    articles: [
      {
        id: 'print-agent',
        title: 'Drucksoftware installieren',
        summary: 'RebornPOS-Desktop-App für die Windows-Kasse (Print Agent enthalten).',
        body: 'An der Windows-Kasse Einstellungen → Belege & Drucker öffnen und RebornPOS (Desktop-App) herunterladen, nicht den alten Print-Agent-1.10.6-Sidecar. EXE einmal installieren; Drucken ist enthalten. Android-Tablets nutzen weiter Bridge Reborn. Im Web POS Menü (⋯) → Drucken, Thermodrucker wählen und Drucker aktualisieren.',
      },
      {
        id: 'webpos-basics',
        title: 'Web POS Schnellstart',
        summary: 'Kasse, Warenkorb, Küche und Checkout.',
        body: 'Web POS aus der Seitenleiste öffnen. Produkte im Register-Tab antippen, um den Warenkorb zu füllen. Gerichte bei Bedarf an die Küche senden (Restaurantmodus). Das Glockensymbol ist für Online-Bestellungen. Benutzer wechseln, bevor die Kasse weitergegeben wird. Checkout für Bargeld, Karte oder Terminal. Drucker, Schicht, Sync und persönliches Terminal sind im ⋯-Menü.',
      },
      {
        id: 'webpos',
        title: 'Web POS nutzen',
        summary: 'Verkäufe im Browser oder Tablet kassieren.',
        body: 'Artikel in den Warenkorb, Rabatte falls erlaubt, Zahlung wählen und abschließen. Küchenbestellungen erscheinen am KDS, wenn aktiv. Tische für Dine-in, Bestellungen für Historie und Online-Abholung.',
      },
      {
        id: 'orders',
        title: 'Bestellhistorie und Rückerstattungen',
        summary: 'Vergangene Verkäufe finden und erstatten.',
        body: 'Bestellungen listet alle abgeschlossenen und Online-Bestellungen. Eine Bestellung öffnen für Details, Beleg neu drucken oder erstatten, wenn die Rolle es erlaubt.',
      },
    ],
  },
  {
    id: 'shop',
    title: 'Online-Shop',
    summary: 'Kunden-Shop, Zeiten, Lieferung und Checkout.',
    articles: [
      {
        id: 'online-shop',
        title: 'Shop konfigurieren',
        summary: 'Bestellungen, Lieferzonen und Zahlungen aktivieren.',
        body: 'Die Online-Shop-Einstellungen steuern Bestellannahme, Liefergebühren, Adyen-Kartenzahlungen und den Ferienmodus. Die Shop-URL unter Einstellungen oder Website-CMS teilen.',
      },
    ],
  },
  {
    id: 'website',
    title: 'Website und CMS',
    summary: 'Homepage-Builder, SEO und veröffentlichte Seiten.',
    articles: [
      {
        id: 'cms',
        title: 'Page Builder und SEO',
        summary: 'Homepage und Meta-Tags gestalten.',
        body: 'Das Website-CMS erlaubt OpenPage-Blöcke, SEO-Titel und Beschreibung sowie die Veröffentlichung auf der Shop-Homepage. Standardtheme: weißer Hintergrund, blaue Buttons.',
      },
    ],
  },
  {
    id: 'reservations',
    title: 'Reservierungen & Tische',
    summary: 'Buchungen, Saalplan und Tisch-QR-Codes.',
    articles: [
      {
        id: 'reservations',
        title: 'Reservierungen verwalten',
        summary: 'Bestätigen, ablehnen und Gäste per E-Mail informieren.',
        body: 'Verkauf → Reservierungen zeigt eingehende Buchungen. Gäste erhalten Bestätigungsmails in der Shop-Sprache (EN/FR/DE). Slots und Gruppengrößen unter Einstellungen → Tische → Reservierungen. Händler-Guides für den Ablauf Buch → Warteliste → setzen → schließen öffnen.',
      },
      {
        id: 'waitlist',
        title: 'Warteliste bei vollem Slot',
        summary: 'Anfragen weiter annehmen statt den Gast abzulehnen.',
        body: 'Einstellungen → Tische → Reservierungen → Warteliste (standardmäßig an). Ist das maximale Gedeck eines Slots erreicht, nimmt der Shop die Anfrage als Warteliste. Diese Gedecke zählen erst nach Fördern oder Setzen. Filter Warteliste unter Verkauf → Reservierungen oder Web POS → Buchungen.',
      },
      {
        id: 'live-table-link',
        title: 'POS-Tische live verknüpfen (oder das Buch offen halten)',
        summary: 'Optional: Setzen belegt den Saal und öffnet ein gehaltenes Ticket.',
        body: 'Live-Tischlink AN (Standard): Setzen markiert den Tisch belegt und hält ein leeres Dine-in-POS-Ticket mit Gastname. AUS: Reservierungen bleiben ein Buch bis Abschließen / Stornieren — Walk-ins selbst am POS setzen. In beiden Fällen bleibt die Buchung offen, bis Sie sie schließen.',
      },
      {
        id: 'photo-menu',
        title: 'Fotomente (Tisch-QR)',
        summary: 'Gäste scannen den Tisch, sehen Fotos und senden in die Küche.',
        body: 'Produktfotos hochladen, Fotomente unter Einstellungen → Tische → Reservierungen aktivieren, dann Tisch-QR drucken. Gäste sehen ein 2-Spalten-Fotogitter. An Küche senden → am POS freigeben → KDS. Zahlen am Tisch ist ein eigener Tisch-QR-Schalter.',
      },
    ],
  },
  {
    id: 'guides',
    title: 'Produktanleitungen',
    summary: 'Vollständige Schritt-für-Schritt-Guides für Händler (und Agenturen).',
    articles: [
      {
        id: 'open-guides',
        title: 'Die vollständigen Guides öffnen',
        summary: 'Support → Hilfe-Center, unter Einrichtungsanleitungen.',
        body: 'Händler-Guides liegen in Support → Hilfe-Center. Sie decken den ersten Tag, Team, Tische, Reservierungen + Warteliste, Fotomente, Service, Gast, Geld und einen Abendrush-Durchlauf ab.',
      },
    ],
  },
  {
    id: 'customers',
    title: 'Kunden & Treue',
    summary: 'CRM, Mitglieder, Gutscheine und Treuepunkte.',
    articles: [
      {
        id: 'loyalty',
        title: 'Treue und Gutscheine',
        summary: 'Stammkunden belohnen.',
        body: 'Treueregeln und Gutscheincodes unter Kunden einrichten. Gutscheine gelten im Online-Shop-Checkout.',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Abrechnung & Abo',
    summary: 'Pläne, Gerätelimits und Plattform-Shop.',
    articles: [
      {
        id: 'subscription',
        title: 'Abo und Abrechnung',
        summary: 'Plan upgraden und online bezahlen.',
        body: 'Konto → Abrechnung zeigt Plan, Gerätelimits und Produktlimits. Sicher zahlen via Adyen. Verbrauchsmaterial im Reborn-Shop im selben Kontomenü bestellen.',
      },
    ],
  },
  {
    id: 'support',
    title: 'Support & Status',
    summary: 'Tickets, Ankündigungen und Systemstatus.',
    articles: [
      {
        id: 'tickets',
        title: 'Support-Tickets',
        summary: 'Agentur oder Reborn-Support kontaktieren.',
        body: 'Support über das Kontomenü öffnen. Zuerst Guides und Hilfeartikel lesen, dann bei Bedarf ein Ticket erstellen. Tickets schließen nach 3 Tagen automatisch — für laufende Themen ein neues Ticket öffnen. Das Glockensymbol zeigt Plattform-Ankündigungen.',
      },
    ],
  },
];

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
