import type { Locale } from '@/lib/i18n';

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

type LString = Record<Locale, string>;

type SourceStep = {
  title: LString;
  detail: LString;
};

type SourceChapter = {
  id: string;
  audience: GuideAudience | 'both';
  title: LString;
  summary: LString;
  outcome: LString;
  steps: SourceStep[];
};

const L = (en: string, fr: string, de: string): LString => ({ en, fr, de });

const SOURCE_CHAPTERS: SourceChapter[] = [
  {
    id: 'reseller-overview',
    audience: 'reseller',
    title: L(
      'Agency panel in 10 minutes',
      'Le panneau agence en 10 minutes',
      'Agenturpanel in 10 Minuten'
    ),
    summary: L(
      'How the dealer dashboard maps to stores, POS versions, add-ons, and support.',
      'Comment le tableau de bord revendeur relie magasins, versions POS, modules et support.',
      'Wie das Händler-Dashboard Läden, POS-Versionen, Add-ons und Support abbildet.'
    ),
    outcome: L(
      'You can explain POS vs shop vs reservations to a merchant without mixing them up.',
      'Vous pouvez expliquer POS, boutique et réservations à un commerçant sans les confondre.',
      'Sie können POS, Shop und Reservierungen einem Händler klar unterscheiden.'
    ),
    steps: [
      {
        title: L('Open Overview', 'Ouvrir l’aperçu', 'Übersicht öffnen'),
        detail: L(
          'Sign in at the agency URL. Overview shows store count, active licenses, suggested monthly revenue, open tickets, and new stores this month. This is the same dealer cockpit SpotOn and Eats365 use: one place for the book of business.',
          'Connectez-vous à l’URL agence. L’aperçu affiche le nombre de magasins, les licences actives, le revenu mensuel suggéré, les tickets ouverts et les nouveaux magasins du mois. C’est le même cockpit revendeur que SpotOn et Eats365 : tout le portefeuille au même endroit.',
          'Melden Sie sich über die Agentur-URL an. Die Übersicht zeigt Ladenanzahl, aktive Lizenzen, vorgeschlagenen Monatsumsatz, offene Tickets und neue Läden dieses Monats. Dasselbe Händler-Cockpit wie bei SpotOn und Eats365: das gesamte Portfolio an einem Ort.'
        ),
      },
      {
        title: L(
          'Stores vs POS versions vs packages',
          'Magasins, versions POS et forfaits',
          'Läden vs. POS-Versionen vs. Pakete'
        ),
        detail: L(
          'A store is the merchant. A POS version (Restaurant Pro, Retail Basic, or your clone) is the feature tier on the till. A product package (POS only, shop, website, full) is which guest channels they get. Add-ons (reservations, KDS, ODS, loyalty, gift cards, delivery platforms, photo menu) are priced extras on top.',
          'Un magasin est le commerçant. Une version POS (Restaurant Pro, Retail Basic ou votre clone) est le niveau de fonctions à la caisse. Un forfait produit (POS seul, boutique, site, complet) définit les canaux clients. Les modules (réservations, KDS, ODS, fidélité, cartes cadeaux, plateformes de livraison, menu photo) sont des extras facturés.',
          'Ein Laden ist der Händler. Eine POS-Version (Restaurant Pro, Retail Basic oder Ihr Klon) ist die Funktionsstufe an der Kasse. Ein Produktpaket (nur POS, Shop, Website, komplett) bestimmt die Gastkanäle. Add-ons (Reservierungen, KDS, ODS, Treue, Geschenkkarten, Lieferplattformen, Fotomente) sind zusätzliche Module.'
        ),
      },
      {
        title: L('Use the module price book', 'Utiliser le tarif des modules', 'Das Modul-Preisbuch nutzen'),
        detail: L(
          'When you create a store, the module price book lists suggested CHF/month: POS seats, Online shop (Order), Website, Reservations + waitlist, Photo menu, KDS, ODS, Loyalty, Gift cards, Just Eat / Uber Eats. Quote POS first, then guest channels. Do not invent per-cover reservation fees — reservations are a flat monthly module.',
          'À la création d’un magasin, le tarif liste les CHF/mois suggérés : postes POS, boutique (Commande), site, réservations + liste d’attente, menu photo, KDS, ODS, fidélité, cartes cadeaux, Just Eat / Uber Eats. Proposez d’abord le POS, puis les canaux clients. N’inventez pas de frais par couvert — les réservations sont un module mensuel forfaitaire.',
          'Beim Anlegen eines Ladens listet das Preisbuch vorgeschlagene CHF/Monat: POS-Plätze, Online-Shop (Bestellung), Website, Reservierungen + Warteliste, Fotomente, KDS, ODS, Treue, Geschenkkarten, Just Eat / Uber Eats. Zuerst POS anbieten, dann Gastkanäle. Keine Gebühr pro Gedeck erfinden — Reservierungen sind ein pauschales Monatsmodul.'
        ),
      },
      {
        title: L('Support split inbox', 'Boîte support séparée', 'Getrennte Support-Inbox'),
        detail: L(
          'Agency → Support is your merchant tickets. Answer from here; merchants never see Superadmin. Point them to Support → Help center for self-serve setup guides.',
          'Agence → Support contient les tickets de vos commerçants. Répondez ici ; ils ne voient jamais le Superadmin. Orientez-les vers Support → Centre d’aide pour les guides en autonomie.',
          'Agentur → Support sind Ihre Händler-Tickets. Antworten Sie hier; Händler sehen Superadmin nie. Verweisen Sie sie auf Support → Hilfe-Center für die Selbsthilfe-Guides.'
        ),
      },
    ],
  },
  {
    id: 'reseller-create-store',
    audience: 'reseller',
    title: L(
      'Create a merchant store (step by step)',
      'Créer un magasin (étape par étape)',
      'Einen Händlerladen anlegen (Schritt für Schritt)'
    ),
    summary: L(
      'From Add store to first PIN login.',
      'De « Ajouter un magasin » à la première connexion PIN.',
      'Von „Laden hinzufügen“ bis zum ersten PIN-Login.'
    ),
    outcome: L(
      'A live store with the right POS version, seats, and guest modules.',
      'Un magasin actif avec la bonne version POS, les postes et les modules clients.',
      'Ein live Laden mit der richtigen POS-Version, Plätzen und Gastmodulen.'
    ),
    steps: [
      {
        title: L('Add store', 'Ajouter un magasin', 'Laden hinzufügen'),
        detail: L(
          'Stores → Add store. Enter trading name and owner email. Optional password: if empty, the welcome mail can set one. Category Restaurant vs Retail filters which POS versions appear.',
          'Magasins → Ajouter un magasin. Saisissez le nom commercial et l’e-mail du propriétaire. Mot de passe optionnel : s’il est vide, l’e-mail de bienvenue peut en créer un. La catégorie Restaurant vs Retail filtre les versions POS.',
          'Läden → Laden hinzufügen. Handelsname und Inhaber-E-Mail eingeben. Optionales Passwort: leer lassen, dann setzt die Willkommensmail eines. Kategorie Restaurant vs. Retail filtert die POS-Versionen.'
        ),
      },
      {
        title: L('Pick the POS version', 'Choisir la version POS', 'POS-Version wählen'),
        detail: L(
          'Restaurant Pro for tables, reservations, KDS, dine-in. Retail Basic for barcode / grocery / storekeeper. You can clone a POS version under POS management if this dealer needs a custom feature set.',
          'Restaurant Pro pour tables, réservations, KDS, sur place. Retail Basic pour codes-barres / épicerie / magasinier. Vous pouvez cloner une version POS dans la gestion POS si ce revendeur a besoin d’un jeu de fonctions spécifique.',
          'Restaurant Pro für Tische, Reservierungen, KDS, Dine-in. Retail Basic für Barcode / Lebensmittel / Storekeeper. Unter POS-Verwaltung können Sie eine Version klonen, wenn dieser Händler ein eigenes Feature-Set braucht.'
        ),
      },
      {
        title: L('Seats and license', 'Postes et licence', 'Plätze und Lizenz'),
        detail: L(
          'Device license seats = how many tills / handhelds can be online. Trial vs yearly vs custom days. POS posts (main + waiter) cap concurrent Web POS sessions. Photo menu and QR table order do not consume a POS seat.',
          'Les sièges de licence = combien de caisses / terminaux peuvent être en ligne. Essai, annuel ou jours personnalisés. Les postes POS (principal + serveur) limitent les sessions Web POS simultanées. Le menu photo et la commande QR table ne consomment pas de siège POS.',
          'Geräte-Lizenzplätze = wie viele Kassen / Handhelds online sein können. Test, jährlich oder individuelle Tage. POS-Posten (Haupt + Kellner) begrenzen gleichzeitige Web-POS-Sitzungen. Fotomente und QR-Tischbestellung verbrauchen keinen POS-Platz.'
        ),
      },
      {
        title: L('Turn on guest modules', 'Activer les modules clients', 'Gastmodule einschalten'),
        detail: L(
          'Enable Online shop if they take orders on the website or Google Order. Enable Website / CMS if they need a homepage. Enable Reservations if they take bookings. Enable KDS if kitchen tickets should land on a screen. Use the price book so billing matches what you enabled.',
          'Activez la boutique s’ils prennent des commandes sur le site ou Google Order. Activez Site / CMS s’ils ont besoin d’une page d’accueil. Activez Réservations s’ils prennent des bookings. Activez le KDS si les tickets cuisine doivent s’afficher. Utilisez le tarif pour que la facturation corresponde.',
          'Online-Shop aktivieren, wenn sie auf der Website oder über Google Order bestellen. Website / CMS für eine Homepage. Reservierungen für Bookings. KDS, wenn Küchentickets auf einem Bildschirm landen sollen. Preisbuch nutzen, damit die Abrechnung zu den aktivierten Modulen passt.'
        ),
      },
      {
        title: L('Open the merchant panel', 'Ouvrir le panneau marchand', 'Händlerpanel öffnen'),
        detail: L(
          'After create, use Open panel (impersonate). Walk the merchant through Settings groups: Team, Tables, Service, Guest, Money. Leave them on Merchant guides for the rest.',
          'Après création, utilisez Ouvrir le panneau (usurpation). Parcourez avec le commerçant les groupes Réglages : Équipe, Tables, Service, Client, Argent. Laissez-le sur les guides marchand pour la suite.',
          'Nach dem Anlegen: Panel öffnen (impersonieren). Gehen Sie mit dem Händler die Einstellungsgruppen durch: Team, Tische, Service, Gast, Geld. Für den Rest auf die Händler-Guides verweisen.'
        ),
      },
    ],
  },
  {
    id: 'reseller-sell-modules',
    audience: 'reseller',
    title: L(
      'How to sell shop, reservations, and photo menu',
      'Vendre boutique, réservations et menu photo',
      'Shop, Reservierungen und Fotomente verkaufen'
    ),
    summary: L(
      'Talk tracks that match SpotOn Order / Reserve and Eats365 PhotoMenu.',
      'Arguments alignés sur SpotOn Order / Reserve et Eats365 PhotoMenu.',
      'Gesprächsleitfäden analog SpotOn Order / Reserve und Eats365 PhotoMenu.'
    ),
    outcome: L(
      'Merchants buy channels, not a pile of leftover tabs.',
      'Les commerçants achètent des canaux, pas une pile d’onglets restants.',
      'Händler kaufen Kanäle, nicht einen Haufen Rest-Tabs.'
    ),
    steps: [
      {
        title: L('One catalog, many channels', 'Un catalogue, plusieurs canaux', 'Ein Katalog, viele Kanäle'),
        detail: L(
          'Products live once. POS, shop, website, table QR (photo menu), and delivery platforms all sell the same items. Do not create a second menu for the website.',
          'Les produits n’existent qu’une fois. POS, boutique, site, QR table (menu photo) et plateformes de livraison vendent les mêmes articles. Ne créez pas un second menu pour le site.',
          'Produkte leben einmal. POS, Shop, Website, Tisch-QR (Fotomente) und Lieferplattformen verkaufen dieselben Artikel. Legen Sie kein zweites Menü für die Website an.'
        ),
      },
      {
        title: L('Shop = first-party Order', 'Boutique = commande en propre', 'Shop = eigene Bestellung'),
        detail: L(
          'Shop is not a brochure. Guests order pickup, delivery, or dine-in. Google Order URL (Settings → Tables → Reservations) can point at the Google Food / Order link that lands on this same shop.',
          'La boutique n’est pas une brochure. Les clients commandent à emporter, en livraison ou sur place. L’URL Google Order (Réglages → Tables → Réservations) peut pointer vers le lien Google Food / Order qui aboutit à cette même boutique.',
          'Der Shop ist keine Broschüre. Gäste bestellen Abholung, Lieferung oder Dine-in. Die Google-Order-URL (Einstellungen → Tische → Reservierungen) kann auf den Google-Food-/Order-Link zeigen, der in denselben Shop führt.'
        ),
      },
      {
        title: L(
          'Reservations = billed module, no cover fee',
          'Réservations = module facturé, sans frais par couvert',
          'Reservierungen = verrechnetes Modul, keine Gedeckgebühr'
        ),
        detail: L(
          'Enable Reservations on the store. Waitlist is included. Live table link is on by default: seating a booking occupies the floor table and opens a held dine-in ticket on POS. If they want bookings without locking tables, turn Live table link off — the book still runs until they close or complete it.',
          'Activez Réservations sur le magasin. La liste d’attente est incluse. Le lien table live est activé par défaut : asseoir une réservation occupe la table et ouvre un ticket sur place en attente au POS. S’ils veulent des bookings sans bloquer les tables, désactivez le lien live — le carnet reste ouvert jusqu’à clôture ou complétion.',
          'Reservierungen am Laden aktivieren. Warteliste ist enthalten. Live-Tischverknüpfung ist standardmäßig an: Platzieren einer Buchung belegt den Tisch und öffnet ein gehaltenes Dine-in-Ticket am POS. Ohne Tische zu sperren: Live-Link aus — das Buch bleibt offen, bis sie es schließen oder abschließen.'
        ),
      },
      {
        title: L('Photo menu = table QR with photos', 'Menu photo = QR table avec photos', 'Fotomente = Tisch-QR mit Fotos'),
        detail: L(
          'Print table QR codes (Settings → Tables). Guests scan, see a photo grid, send to kitchen. Staff approve on POS; KDS prints like any other dine-in ticket. Suggested as its own module on the price book.',
          'Imprimez les QR de table (Réglages → Tables). Les clients scannent, voient une grille photo, envoient en cuisine. Le personnel approuve au POS ; le KDS imprime comme tout ticket sur place. Proposé comme module à part dans le tarif.',
          'Tisch-QR-Codes drucken (Einstellungen → Tische). Gäste scannen, sehen ein Fotogitter, senden in die Küche. Personal genehmigt am POS; KDS druckt wie jedes Dine-in-Ticket. Im Preisbuch als eigenes Modul vorgeschlagen.'
        ),
      },
    ],
  },
  {
    id: 'merchant-start',
    audience: 'merchant',
    title: L(
      'First day: sign in and Settings groups',
      'Premier jour : connexion et groupes de réglages',
      'Erster Tag: Anmelden und Einstellungsgruppen'
    ),
    summary: L(
      'Where everything lives after the leftover-tabs cleanup.',
      'Où tout se trouve après le nettoyage des onglets.',
      'Wo alles liegt nach dem Aufräumen der Rest-Tabs.'
    ),
    outcome: L(
      'You can find Team, Tables, Service, Guest, and Money without hunting.',
      'Vous trouvez Équipe, Tables, Service, Client et Argent sans chercher.',
      'Sie finden Team, Tische, Service, Gast und Geld ohne Suchen.'
    ),
    steps: [
      {
        title: L('Sign in', 'Se connecter', 'Anmelden'),
        detail: L(
          "Open the merchant panel with the email from your agency. Overview shows today's sales, open orders, and shortcuts to Web POS and the shop.",
          'Ouvrez le panneau marchand avec l’e-mail de votre agence. L’aperçu montre les ventes du jour, les commandes ouvertes et les raccourcis vers Web POS et la boutique.',
          'Öffnen Sie das Händlerpanel mit der E-Mail Ihrer Agentur. Die Übersicht zeigt den Tagesumsatz, offene Bestellungen und Shortcuts zu Web POS und Shop.'
        ),
      },
      {
        title: L(
          'Settings are grouped like the floor',
          'Les réglages suivent le service',
          'Einstellungen sind wie der Saal gruppiert'
        ),
        detail: L(
          'Open Settings. The left nav is no longer 30 flat tabs. Groups: Business (identity), Team (users + language), Tables (floor + reservations), Service (hours, POS, KDS, ODS, customer display, receipt, kiosk, signage, delivery), Guest (shop, email, delivery map), Money (taxes, payments, fiscal, accounting).',
          'Ouvrez Réglages. Le menu n’est plus 30 onglets plats. Groupes : Entreprise (identité), Équipe (utilisateurs + langue), Tables (salle + réservations), Service (horaires, POS, KDS, ODS, afficheur client, ticket, kiosque, signalétique, livraison), Client (boutique, e-mail, carte de livraison), Argent (taxes, paiements, fiscal, comptabilité).',
          'Einstellungen öffnen. Die linke Navigation sind keine 30 flachen Tabs mehr. Gruppen: Betrieb (Identität), Team (Benutzer + Sprache), Tische (Saal + Reservierungen), Service (Zeiten, POS, KDS, ODS, Kundendisplay, Beleg, Kiosk, Beschilderung, Lieferung), Gast (Shop, E-Mail, Lieferkarte), Geld (Steuern, Zahlungen, Fiskal, Buchhaltung).'
        ),
      },
      {
        title: L('Fill Business first', 'Remplir Entreprise d’abord', 'Zuerst Betrieb ausfüllen'),
        detail: L(
          'Settings → Business: trading name, address, phone, VAT, logo. These print on receipts and the shop footer. Save before you open Web POS.',
          'Réglages → Entreprise : nom commercial, adresse, téléphone, TVA, logo. Ils s’impriment sur les tickets et le pied de boutique. Enregistrez avant d’ouvrir Web POS.',
          'Einstellungen → Betrieb: Handelsname, Adresse, Telefon, MwSt, Logo. Das erscheint auf Belegen und im Shop-Footer. Speichern, bevor Sie Web POS öffnen.'
        ),
      },
    ],
  },
  {
    id: 'merchant-team',
    audience: 'merchant',
    title: L(
      'Team: users, roles, and PIN login',
      'Équipe : utilisateurs, rôles et connexion PIN',
      'Team: Benutzer, Rollen und PIN-Login'
    ),
    summary: L(
      'Everyone on the floor signs in with a PIN — not the owner email.',
      'Tout le monde en salle se connecte avec un PIN — pas l’e-mail du propriétaire.',
      'Alle im Saal melden sich mit PIN an — nicht mit der Inhaber-E-Mail.'
    ),
    outcome: L(
      'Waiters and managers can switch on the till without sharing a password.',
      'Serveurs et managers peuvent changer d’utilisateur à la caisse sans partager un mot de passe.',
      'Kellner und Manager können an der Kasse wechseln, ohne ein Passwort zu teilen.'
    ),
    steps: [
      {
        title: L('Add staff', 'Ajouter le personnel', 'Personal hinzufügen'),
        detail: L(
          'Settings → Team → Users (or Staff). Create each person with a role: waiter, cashier, manager, kitchen. Set a 4-digit PIN.',
          'Réglages → Équipe → Utilisateurs (ou Personnel). Créez chaque personne avec un rôle : serveur, caissier, manager, cuisine. Définissez un PIN à 4 chiffres.',
          'Einstellungen → Team → Benutzer (oder Personal). Jede Person mit Rolle anlegen: Kellner, Kassierer, Manager, Küche. 4-stellige PIN setzen.'
        ),
      },
      {
        title: L('Web POS PIN', 'PIN Web POS', 'Web-POS-PIN'),
        detail: L(
          'On Web POS, tap the user icon and enter the PIN. Managers can cancel, discount, and run end of day. Switch user before handing the till to the next person.',
          'Sur Web POS, touchez l’icône utilisateur et saisissez le PIN. Les managers peuvent annuler, remettre et faire la clôture. Changez d’utilisateur avant de passer la caisse.',
          'Im Web POS auf das Benutzersymbol tippen und die PIN eingeben. Manager können stornieren, rabattieren und den Tagesabschluss machen. Benutzer wechseln, bevor die Kasse weitergegeben wird.'
        ),
      },
      {
        title: L('Language', 'Langue', 'Sprache'),
        detail: L(
          'Settings → Team → Language sets the panel language (EN / FR / DE). Shop language for guests is under Guest → Shop and can differ.',
          'Réglages → Équipe → Langue définit la langue du panneau (EN / FR / DE). La langue boutique pour les clients est sous Client → Boutique et peut différer.',
          'Einstellungen → Team → Sprache setzt die Panel-Sprache (EN / FR / DE). Die Shop-Sprache für Gäste liegt unter Gast → Shop und kann abweichen.'
        ),
      },
    ],
  },
  {
    id: 'merchant-tables',
    audience: 'merchant',
    title: L(
      'Tables: floor plan and QR codes',
      'Tables : plan de salle et codes QR',
      'Tische: Saalplan und QR-Codes'
    ),
    summary: L(
      'Build the room once; POS and reservations share it.',
      'Dessinez la salle une fois ; POS et réservations la partagent.',
      'Den Raum einmal anlegen; POS und Reservierungen teilen ihn.'
    ),
    outcome: L(
      'Every physical table has a label, capacity, and optional QR.',
      'Chaque table physique a un libellé, une capacité et un QR optionnel.',
      'Jeder physische Tisch hat Label, Kapazität und optionalen QR.'
    ),
    steps: [
      {
        title: L('Draw the floor', 'Dessiner la salle', 'Den Saal zeichnen'),
        detail: L(
          'Settings → Tables. Add rooms, then tables with label and covers. This floor is what Web POS Tables and the reservation book use.',
          'Réglages → Tables. Ajoutez des salles, puis des tables avec libellé et couverts. Ce plan est celui de Web POS Tables et du carnet de réservations.',
          'Einstellungen → Tische. Räume hinzufügen, dann Tische mit Label und Gedecken. Diesen Plan nutzen Web POS Tische und das Reservierungsbuch.'
        ),
      },
      {
        title: L('Print table QR (photo menu)', 'Imprimer le QR table (menu photo)', 'Tisch-QR drucken (Fotomente)'),
        detail: L(
          'Generate a QR per table. Guests scan to open the photo menu for that seat. Orders come in as dine-in / QR table and wait for POS approval when auto-approve is off.',
          'Générez un QR par table. Les clients scannent pour ouvrir le menu photo de cette place. Les commandes arrivent en sur place / QR table et attendent l’approbation POS si l’auto-approbation est désactivée.',
          'Einen QR pro Tisch erzeugen. Gäste scannen, um das Fotomente dieses Platzes zu öffnen. Bestellungen kommen als Dine-in / QR-Tisch und warten auf POS-Freigabe, wenn Auto-Approve aus ist.'
        ),
      },
      {
        title: L('Live link is optional', 'Le lien live est optionnel', 'Live-Link ist optional'),
        detail: L(
          'With Live table link ON (default), a seated reservation marks that table occupied and opens a held POS ticket. With it OFF, reservations stay a book only — tables on POS stay free until you sit a walk-in yourself. Either way you close the booking when the party leaves (Complete) or cancels.',
          'Avec le lien table live ON (défaut), une réservation assise marque la table occupée et ouvre un ticket POS en attente. OFF : les réservations restent un carnet — les tables POS restent libres jusqu’à ce que vous asseyiez un walk-in. Dans les deux cas, clôturez la réservation quand le groupe part (Terminer) ou annule.',
          'Mit Live-Tischlink AN (Standard) markiert eine gesetzte Reservierung den Tisch belegt und öffnet ein gehaltenes POS-Ticket. AUS: Reservierungen bleiben nur ein Buch — POS-Tische bleiben frei, bis Sie selbst einen Walk-in setzen. In beiden Fällen schließen Sie die Buchung, wenn die Gruppe geht (Abschließen) oder storniert.'
        ),
      },
    ],
  },
  {
    id: 'merchant-reservations',
    audience: 'merchant',
    title: L(
      'Reservations: waitlist, seat, and close',
      'Réservations : liste d’attente, asseoir et clôturer',
      'Reservierungen: Warteliste, setzen und schließen'
    ),
    summary: L(
      'The book, the waitlist, and how it talks to POS tables.',
      'Le carnet, la liste d’attente, et le lien avec les tables POS.',
      'Das Buch, die Warteliste und die Verbindung zu POS-Tischen.'
    ),
    outcome: L(
      'You can take a full-slot booking onto the waitlist, promote it, seat it, and finish it.',
      'Vous pouvez prendre une réservation sur créneau plein en liste d’attente, la promouvoir, l’asseoir et la terminer.',
      'Sie können eine volle Slot-Buchung auf die Warteliste nehmen, fördern, setzen und abschließen.'
    ),
    steps: [
      {
        title: L('Turn the module on', 'Activer le module', 'Modul einschalten'),
        detail: L(
          'Settings → Tables → Reservations. Enable online reservations. Set slot interval, seating duration, buffer, party size, and how far ahead guests can book. Auto-accept if you want confirmed without staff review; otherwise bookings stay Pending.',
          'Réglages → Tables → Réservations. Activez les réservations en ligne. Définissez l’intervalle, la durée, le buffer, la taille de groupe et l’horizon de réservation. Auto-accepter pour confirmer sans revue ; sinon les bookings restent En attente.',
          'Einstellungen → Tische → Reservierungen. Online-Reservierungen aktivieren. Slot-Intervall, Sitzdauer, Puffer, Gruppengröße und Vorlauf festlegen. Auto-Accept, wenn ohne Prüfung bestätigt werden soll; sonst bleiben Buchungen Ausstehend.'
        ),
      },
      {
        title: L(
          'Waitlist when the slot is full',
          'Liste d’attente quand le créneau est plein',
          'Warteliste bei vollem Slot'
        ),
        detail: L(
          'Keep Waitlist enabled (default). When max covers for a slot are reached, the shop still takes the request as Waitlist instead of rejecting it. Waitlist covers do not count toward the slot until you promote or seat them.',
          'Gardez la liste d’attente activée (défaut). Quand le max de couverts d’un créneau est atteint, la boutique accepte encore la demande en liste d’attente au lieu de la refuser. Ces couverts ne comptent pas tant que vous ne les promouvez ou n’asseyez pas.',
          'Warteliste aktiv lassen (Standard). Ist das maximale Gedeck eines Slots erreicht, nimmt der Shop die Anfrage trotzdem als Warteliste statt sie abzulehnen. Wartelisten-Gedecke zählen erst nach Fördern oder Setzen.'
        ),
      },
      {
        title: L(
          'Promote or seat from waitlist',
          'Promouvoir ou asseoir depuis la liste',
          'Von der Warteliste fördern oder setzen'
        ),
        detail: L(
          'Sales → Reservations (or Web POS → Bookings). Filter Waitlist. Promote moves them to Confirmed when a table or covers free up. Seat (from Pending, Confirmed, or Waitlist) sits the party now.',
          'Ventes → Réservations (ou Web POS → Réservations). Filtrez Liste d’attente. Promouvoir les passe en Confirmé quand une table ou des couverts se libèrent. Asseoir (depuis En attente, Confirmé ou Liste) installe le groupe maintenant.',
          'Verkauf → Reservierungen (oder Web POS → Buchungen). Filter Warteliste. Fördern setzt sie auf Bestätigt, wenn Tisch oder Gedecke frei werden. Setzen (aus Ausstehend, Bestätigt oder Warteliste) platziert die Gruppe jetzt.'
        ),
      },
      {
        title: L(
          'Seat opens a POS ticket when live-linked',
          'Asseoir ouvre un ticket POS si le lien live est actif',
          'Setzen öffnet ein POS-Ticket bei Live-Link'
        ),
        detail: L(
          'If Live table link is on and a table is assigned, Seat marks the floor table occupied and holds an empty dine-in order with the guest name. Add food on POS as usual. If live link is off, Seat only updates the booking — you pick a table on POS yourself. Assigning a table for a future night keeps it green until that day — orange reserved only on the reservation date.',
          'Si le lien live est actif et qu’une table est assignée, Asseoir marque la table occupée et tient une commande sur place vide au nom du client. Ajoutez les plats au POS. Si le lien est off, Asseoir met seulement à jour la réservation — vous choisissez la table au POS. Assigner une table pour une soirée future la laisse verte jusqu’à ce jour — orange réservé seulement le jour J.',
          'Ist der Live-Link an und ein Tisch zugewiesen, markiert Setzen den Tisch belegt und hält eine leere Dine-in-Bestellung mit Gastname. Speisen wie üblich am POS hinzufügen. Ist der Link aus, aktualisiert Setzen nur die Buchung — den Tisch wählen Sie selbst am POS. Ein Tisch für eine zukünftige Nacht bleibt grün bis zu diesem Tag — orange reserviert nur am Reservierungsdatum.'
        ),
      },
      {
        title: L(
          'Keep the booking open until you close it',
          'Garder la réservation ouverte jusqu’à clôture',
          'Buchung offen lassen, bis Sie sie schließen'
        ),
        detail: L(
          'Statuses: Pending → Confirmed or Waitlist → Seated → Completed. Or Cancelled / Rejected / No-show. Complete is only available from Seated. The reservation stays open until you close it — it does not auto-vanish when the shop slot ends.',
          'Statuts : En attente → Confirmé ou Liste d’attente → Assis → Terminé. Ou Annulé / Refusé / No-show. Terminer n’est disponible que depuis Assis. La réservation reste ouverte jusqu’à clôture — elle ne disparaît pas à la fin du créneau boutique.',
          'Status: Ausstehend → Bestätigt oder Warteliste → Gesetzt → Abgeschlossen. Oder Storniert / Abgelehnt / No-show. Abschließen nur von Gesetzt. Die Reservierung bleibt offen, bis Sie sie schließen — sie verschwindet nicht automatisch am Slot-Ende.'
        ),
      },
      {
        title: L('Google Reserve / Order links', 'Liens Google Reserve / Order', 'Google-Reserve- / Order-Links'),
        detail: L(
          'Paste your Google Reserve URL and Google Order URL in the same settings card. They appear on the public shop footer so guests coming from Google land on your book or your menu.',
          'Collez vos URL Google Reserve et Google Order dans la même carte de réglages. Elles apparaissent au pied de la boutique publique pour que les clients Google arrivent sur votre carnet ou votre menu.',
          'Google-Reserve- und Google-Order-URL in dieselbe Einstellkarte einfügen. Sie erscheinen im öffentlichen Shop-Footer, damit Gäste von Google in Ihr Buch oder Menü landen.'
        ),
      },
    ],
  },
  {
    id: 'merchant-photo-menu',
    audience: 'merchant',
    title: L('Photo menu (table QR)', 'Menu photo (QR table)', 'Fotomente (Tisch-QR)'),
    summary: L(
      'Guests browse photos at the table and send to the kitchen.',
      'Les clients parcourent les photos à table et envoient en cuisine.',
      'Gäste durchsuchen Fotos am Tisch und senden in die Küche.'
    ),
    outcome: L(
      'A scanned table shows a photo grid and tickets reach KDS after POS approval.',
      'Une table scannée affiche une grille photo et les tickets arrivent au KDS après approbation POS.',
      'Ein gescannter Tisch zeigt ein Fotogitter; Tickets erreichen das KDS nach POS-Freigabe.'
    ),
    steps: [
      {
        title: L('Photos on products', 'Photos sur les produits', 'Fotos auf Produkten'),
        detail: L(
          'Products → each item. Upload a photo. The table QR page uses a 2-column photo grid when Photo menu is enabled (Settings → Tables → Reservations). Without a photo, the tile shows the first letter.',
          'Produits → chaque article. Téléversez une photo. La page QR table utilise une grille 2 colonnes quand le menu photo est activé (Réglages → Tables → Réservations). Sans photo, la tuile affiche la première lettre.',
          'Produkte → jeder Artikel. Foto hochladen. Die Tisch-QR-Seite nutzt ein 2-Spalten-Fotogitter, wenn Fotomente aktiv ist (Einstellungen → Tische → Reservierungen). Ohne Foto zeigt die Kachel den ersten Buchstaben.'
        ),
      },
      {
        title: L(
          'Enable photo menu + print QR',
          'Activer le menu photo + imprimer les QR',
          'Fotomente aktivieren + QR drucken'
        ),
        detail: L(
          'Settings → Tables → Reservations → Photo menu. Then Settings → Tables → print or download QR codes. Stick one per table. The signed link is unique to that table.',
          'Réglages → Tables → Réservations → Menu photo. Puis Réglages → Tables → imprimer ou télécharger les QR. Un par table. Le lien signé est unique à cette table.',
          'Einstellungen → Tische → Reservierungen → Fotomente. Dann Einstellungen → Tische → QR-Codes drucken oder laden. Einen pro Tisch. Der signierte Link ist einzigartig für diesen Tisch.'
        ),
      },
      {
        title: L('Service flow', 'Flux de service', 'Serviceablauf'),
        detail: L(
          'Guest scans → adds dishes → Send to kitchen. If QR auto-approve is off, the order waits on POS / Orders. Approve it; KDS and kitchen printers fire like a waiter ticket. Pay at table is a separate toggle on table QR settings.',
          'Le client scanne → ajoute des plats → Envoyer en cuisine. Si l’auto-approbation QR est off, la commande attend au POS / Commandes. Approuvez ; KDS et imprimantes cuisine partent comme un ticket serveur. Payer à table est un interrupteur séparé dans les réglages QR table.',
          'Gast scannt → fügt Gerichte hinzu → An Küche senden. Ist QR-Auto-Approve aus, wartet die Bestellung am POS / Bestellungen. Freigeben; KDS und Küchendrucker laufen wie ein Kellner-Ticket. Zahlen am Tisch ist ein eigener Schalter in den Tisch-QR-Einstellungen.'
        ),
      },
    ],
  },
  {
    id: 'merchant-service',
    audience: 'merchant',
    title: L(
      'Service: hours, POS, KDS, ODS',
      'Service : horaires, POS, KDS, ODS',
      'Service: Zeiten, POS, KDS, ODS'
    ),
    summary: L(
      'The kitchen and floor screens that every channel hits.',
      'Les écrans cuisine et salle que tous les canaux utilisent.',
      'Küchen- und Saalbildschirme, die jeder Kanal trifft.'
    ),
    outcome: L(
      'One kitchen pipeline for POS, shop, QR, and delivery platforms.',
      'Un seul pipeline cuisine pour POS, boutique, QR et plateformes de livraison.',
      'Eine Küchenpipeline für POS, Shop, QR und Lieferplattformen.'
    ),
    steps: [
      {
        title: L('Hours', 'Horaires', 'Öffnungszeiten'),
        detail: L(
          'Settings → Service → Hours. Set pickup / dine-in / delivery. Reservations can reuse takeaway hours or use custom dine-in hours.',
          'Réglages → Service → Horaires. Définissez à emporter / sur place / livraison. Les réservations peuvent réutiliser les horaires à emporter ou des horaires sur place dédiés.',
          'Einstellungen → Service → Zeiten. Abholung / Dine-in / Lieferung setzen. Reservierungen können Takeaway-Zeiten wiederverwenden oder eigene Dine-in-Zeiten nutzen.'
        ),
      },
      {
        title: L('Web POS', 'Web POS', 'Web POS'),
        detail: L(
          'Settings → Service → POS for register layout, and the ⋯ menu in Web POS for printers and shift. Scan barcodes from the search box — the cart row flashes when a scan adds or stacks a line.',
          'Réglages → Service → POS pour la caisse, et le menu ⋯ dans Web POS pour imprimantes et shift. Scannez les codes-barres depuis la recherche — la ligne du panier clignote quand un scan ajoute ou empile.',
          'Einstellungen → Service → POS für das Kassenlayout, das ⋯-Menü im Web POS für Drucker und Schicht. Barcodes im Suchfeld scannen — die Warenkorbzeile blinkt, wenn ein Scan eine Zeile hinzufügt oder stapelt.'
        ),
      },
      {
        title: L('KDS and ODS', 'KDS et ODS', 'KDS und ODS'),
        detail: L(
          'KDS is the kitchen display. ODS is expo / pickup. Enable both as add-ons with your agency. Online shop, photo menu, and POS tickets all land here — do not run a second kitchen list.',
          'Le KDS est l’écran cuisine. L’ODS est l’expo / retrait. Activez-les comme modules avec votre agence. Boutique, menu photo et tickets POS arrivent ici — n’utilisez pas une seconde liste cuisine.',
          'KDS ist das Küchendisplay. ODS ist Expo / Abholung. Beide als Add-ons mit Ihrer Agentur aktivieren. Online-Shop, Fotomente und POS-Tickets landen hier — keine zweite Küchenliste führen.'
        ),
      },
      {
        title: L('Delivery platforms', 'Plateformes de livraison', 'Lieferplattformen'),
        detail: L(
          'Just Eat / Uber Eats (Money / Service delivery platforms) inject orders onto the same POS and KDS. Ask your agency to enable the add-on first.',
          'Just Eat / Uber Eats (Argent / Service plateformes) injectent les commandes sur le même POS et KDS. Demandez d’abord à votre agence d’activer le module.',
          'Just Eat / Uber Eats (Geld / Service Lieferplattformen) speisen Bestellungen in dasselbe POS und KDS. Zuerst das Add-on bei der Agentur aktivieren lassen.'
        ),
      },
    ],
  },
  {
    id: 'merchant-guest',
    audience: 'merchant',
    title: L(
      'Guest: shop, website, and Google links',
      'Client : boutique, site et liens Google',
      'Gast: Shop, Website und Google-Links'
    ),
    summary: L(
      'The public channels that sell the same catalog.',
      'Les canaux publics qui vendent le même catalogue.',
      'Die öffentlichen Kanäle, die denselben Katalog verkaufen.'
    ),
    outcome: L(
      'Homepage Order / Reserve buttons and the shop footer match what you sell.',
      'Les boutons Commander / Réserver de la page d’accueil et le pied de boutique correspondent à ce que vous vendez.',
      'Homepage-Buttons Bestellen / Reservieren und der Shop-Footer passen zu dem, was Sie verkaufen.'
    ),
    steps: [
      {
        title: L('Online shop', 'Boutique en ligne', 'Online-Shop'),
        detail: L(
          'Settings → Guest → Shop. Accept orders, delivery zones, vacation message, product photos on the menu. Share the shop URL. This is the Order channel.',
          'Réglages → Client → Boutique. Accepter les commandes, zones de livraison, message vacances, photos produits au menu. Partagez l’URL boutique. C’est le canal Commande.',
          'Einstellungen → Gast → Shop. Bestellungen annehmen, Lieferzonen, Ferienmeldung, Produktfotos im Menü. Shop-URL teilen. Das ist der Bestellkanal.'
        ),
      },
      {
        title: L('Website / CMS', 'Site / CMS', 'Website / CMS'),
        detail: L(
          'Website builder (sidebar → CMS) publishes the homepage. Put Order (menu) and Reserve (reservations) buttons on the hero. Do not duplicate the catalog in the CMS.',
          'Le constructeur de site (menu → CMS) publie la page d’accueil. Placez les boutons Commander (menu) et Réserver (réservations) sur le hero. Ne dupliquez pas le catalogue dans le CMS.',
          'Der Website-Builder (Seitenleiste → CMS) veröffentlicht die Homepage. Bestellen- (Menü) und Reservieren-Buttons auf den Hero. Den Katalog nicht im CMS duplizieren.'
        ),
      },
      {
        title: L('Google Order and Reserve', 'Google Order et Reserve', 'Google Order und Reserve'),
        detail: L(
          'After Google verifies your listing, paste the Order and Reserve URLs under Settings → Tables → Reservations. The shop footer shows them next to Order online and Reservations.',
          'Après vérification Google, collez les URL Order et Reserve sous Réglages → Tables → Réservations. Le pied de boutique les affiche à côté de Commander en ligne et Réservations.',
          'Nach der Google-Verifizierung die Order- und Reserve-URLs unter Einstellungen → Tische → Reservierungen einfügen. Der Shop-Footer zeigt sie neben Online bestellen und Reservierungen.'
        ),
      },
    ],
  },
  {
    id: 'merchant-money',
    audience: 'merchant',
    title: L(
      'Money: taxes, payments, fiscal',
      'Argent : taxes, paiements, fiscal',
      'Geld: Steuern, Zahlungen, Fiskal'
    ),
    summary: L(
      'What prints on the receipt and what Adyen charges.',
      'Ce qui s’imprime sur le ticket et ce qu’Adyen encaisse.',
      'Was auf dem Beleg steht und was Adyen abbucht.'
    ),
    outcome: L(
      'Correct VAT and a working card terminal / online card.',
      'TVA correcte et un terminal / carte en ligne qui fonctionne.',
      'Korrekte MwSt und funktionierendes Kartenterminal / Online-Karte.'
    ),
    steps: [
      {
        title: L('Taxes', 'Taxes', 'Steuern'),
        detail: L(
          'Settings → Money → Taxes. Takeaway, dine-in, and delivery rates. Prices include tax unless you turn that off.',
          'Réglages → Argent → Taxes. Taux à emporter, sur place et livraison. Les prix incluent la taxe sauf si vous le désactivez.',
          'Einstellungen → Geld → Steuern. Takeaway-, Dine-in- und Liefertarife. Preise inkl. Steuer, außer Sie schalten das aus.'
        ),
      },
      {
        title: L('Payments', 'Paiements', 'Zahlungen'),
        detail: L(
          'Adyen for online cards and terminals. Cash is always available on POS. Gift cards and vouchers apply on shop and POS when those modules are on.',
          'Adyen pour les cartes en ligne et les terminaux. Les espèces sont toujours disponibles au POS. Cartes cadeaux et bons s’appliquent en boutique et au POS si ces modules sont actifs.',
          'Adyen für Online-Karten und Terminals. Bargeld ist am POS immer verfügbar. Geschenkkarten und Gutscheine gelten in Shop und POS, wenn die Module an sind.'
        ),
      },
      {
        title: L('Fiscal / accounting', 'Fiscal / comptabilité', 'Fiskal / Buchhaltung'),
        detail: L(
          'Fiskaly (DE/FR) and Bexio / Odoo live under Money. Turn them on only after your agency confirmed the legal entity.',
          'Fiskaly (DE/FR) et Bexio / Odoo sont sous Argent. Activez-les seulement après confirmation de l’entité légale par votre agence.',
          'Fiskaly (DE/FR) und Bexio / Odoo liegen unter Geld. Erst einschalten, nachdem die Agentur die Rechtseinheit bestätigt hat.'
        ),
      },
    ],
  },
  {
    id: 'merchant-floor-day',
    audience: 'merchant',
    title: L(
      'A service: book → waitlist → seat → ticket → close',
      'Un service : carnet → liste → asseoir → ticket → clôturer',
      'Ein Service: Buch → Warteliste → setzen → Ticket → schließen'
    ),
    summary: L(
      'The live dinner rush using the optional table link.',
      'Le rush du soir avec le lien table optionnel.',
      'Der Abendrush mit optionalem Tischlink.'
    ),
    outcome: L(
      'You know when the floor is linked and when the book runs on its own.',
      'Vous savez quand la salle est liée et quand le carnet tourne seul.',
      'Sie wissen, wann der Saal verknüpft ist und wann das Buch allein läuft.'
    ),
    steps: [
      {
        title: L('Before service', 'Avant le service', 'Vor dem Service'),
        detail: L(
          'Check Sales → Reservations for tonight. Confirm pending, assign tables, print the book if you like. Waitlist stays visible as its own filter.',
          'Vérifiez Ventes → Réservations pour ce soir. Confirmez les en attente, assignez les tables, imprimez le carnet si besoin. La liste d’attente reste un filtre à part.',
          'Verkauf → Reservierungen für heute Abend prüfen. Ausstehende bestätigen, Tische zuweisen, Buch bei Bedarf drucken. Die Warteliste bleibt ein eigener Filter.'
        ),
      },
      {
        title: L('Walk-ins vs bookings', 'Walk-in vs réservations', 'Walk-ins vs. Buchungen'),
        detail: L(
          'Walk-in: sit them on Web POS Tables — that occupies the floor without a reservation. Booking: Seat from the book. If live link is on, the table turns occupied and a held ticket appears. If live link is off, sit them on POS after you greet them; the booking stays Seated until you Complete it.',
          'Walk-in : asseyez-les dans Web POS Tables — cela occupe la salle sans réservation. Réservation : Asseoir depuis le carnet. Si le lien live est on, la table passe occupée et un ticket en attente apparaît. Si off, asseyez-les au POS après l’accueil ; la réservation reste Assis jusqu’à Terminer.',
          'Walk-in: im Web POS Tische setzen — das belegt den Saal ohne Reservierung. Buchung: aus dem Buch setzen. Ist der Live-Link an, wird der Tisch belegt und ein gehaltenes Ticket erscheint. Ist er aus, setzen Sie sie nach der Begrüßung am POS; die Buchung bleibt Gesetzt, bis Sie Abschließen.'
        ),
      },
      {
        title: L('Full slot', 'Créneau plein', 'Voller Slot'),
        detail: L(
          'Shop guests still join the waitlist. When a table frees (Complete the seated booking, or clear the POS table), Promote the next waitlist party and Seat them.',
          'Les clients boutique rejoignent encore la liste d’attente. Quand une table se libère (Terminer la réservation assise, ou libérer la table POS), Promouvoir le groupe suivant et l’Asseoir.',
          'Shop-Gäste kommen weiter auf die Warteliste. Wird ein Tisch frei (gesetzte Buchung abschließen oder POS-Tisch räumen), den nächsten Wartelisten-Tisch fördern und setzen.'
        ),
      },
      {
        title: L('Close the party', 'Clôturer la table', 'Die Gruppe schließen'),
        detail: L(
          'Pay the POS ticket. Then Complete the reservation. That is the official close — not the kitchen finishing, not the slot clock. Cancel / no-show if they never arrived.',
          'Encaisser le ticket POS. Puis Terminer la réservation. C’est la clôture officielle — pas la fin cuisine, pas l’horloge du créneau. Annuler / no-show s’ils ne sont pas venus.',
          'POS-Ticket kassieren. Dann die Reservierung abschließen. Das ist der offizielle Schluss — nicht die Küche, nicht die Slot-Uhr. Stornieren / No-show, wenn sie nie kamen.'
        ),
      },
    ],
  },
];

function pick(value: LString, locale: Locale): string {
  return value[locale] || value.en;
}

export const PRODUCT_GUIDE_CHAPTERS: GuideChapter[] = SOURCE_CHAPTERS.map((chapter) => ({
  id: chapter.id,
  audience: chapter.audience,
  title: chapter.title.en,
  summary: chapter.summary.en,
  outcome: chapter.outcome.en,
  steps: chapter.steps.map((step) => ({ title: step.title.en, detail: step.detail.en })),
}));

export function guidesForAudience(audience: GuideAudience, locale: Locale = 'en'): GuideChapter[] {
  return SOURCE_CHAPTERS.filter((c) => c.audience === audience || c.audience === 'both').map((chapter) => ({
    id: chapter.id,
    audience: chapter.audience,
    title: pick(chapter.title, locale),
    summary: pick(chapter.summary, locale),
    outcome: pick(chapter.outcome, locale),
    steps: chapter.steps.map((step) => ({
      title: pick(step.title, locale),
      detail: pick(step.detail, locale),
    })),
  }));
}
