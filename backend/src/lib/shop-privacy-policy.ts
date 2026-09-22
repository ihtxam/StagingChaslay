type PrivacyLocale = "en" | "fr" | "de" | "it";

export type ShopPrivacyMerchant = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  shopLanguage?: string | null;
  panelLanguage?: string | null;
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePrivacyLocale(raw: string | null | undefined): PrivacyLocale {
  const code = String(raw || "en").toLowerCase().slice(0, 2);
  if (code === "fr" || code === "de" || code === "it") return code;
  return "en";
}

function formatAddress(merchant: ShopPrivacyMerchant): string | null {
  const parts = [merchant.address, merchant.city, merchant.country]
    .map((p) => String(p || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function contactBlock(
  locale: PrivacyLocale,
  businessName: string,
  contactName: string,
  email: string | null,
  phone: string | null,
  address: string | null
): string {
  const labels = {
    en: { heading: "Contact", person: "Contact person", email: "Email", phone: "Phone", address: "Address" },
    fr: {
      heading: "Contact",
      person: "Personne de contact",
      email: "E-mail",
      phone: "Téléphone",
      address: "Adresse",
    },
    de: {
      heading: "Kontakt",
      person: "Ansprechperson",
      email: "E-Mail",
      phone: "Telefon",
      address: "Adresse",
    },
    it: {
      heading: "Contatto",
      person: "Persona di contatto",
      email: "E-mail",
      phone: "Telefono",
      address: "Indirizzo",
    },
  }[locale];

  const rows: string[] = [
    `<p><strong>${escapeHtml(businessName)}</strong></p>`,
    `<p>${labels.person}: ${escapeHtml(contactName)}</p>`,
  ];
  if (email) rows.push(`<p>${labels.email}: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`);
  if (phone) rows.push(`<p>${labels.phone}: ${escapeHtml(phone)}</p>`);
  if (address) rows.push(`<p>${labels.address}: ${escapeHtml(address)}</p>`);
  return `<section><h2>${labels.heading}</h2>${rows.join("")}</section>`;
}

function platformCredits(locale: PrivacyLocale): string {
  const copy = {
    en: {
      heading: "Platform providers",
      website:
        'Website &amp; ordering system developed by <a href="https://webprintmedia.swiss" rel="noopener noreferrer" target="_blank">webprintmedia.swiss</a>',
      pos: 'POS &amp; hosting provided by <a href="https://www.rebornsense.com" rel="noopener noreferrer" target="_blank">www.rebornsense.com</a>',
    },
    fr: {
      heading: "Fournisseurs de la plateforme",
      website:
        'Site web &amp; système de commande développés par <a href="https://webprintmedia.swiss" rel="noopener noreferrer" target="_blank">webprintmedia.swiss</a>',
      pos: 'Caisse &amp; hébergement fournis par <a href="https://www.rebornsense.com" rel="noopener noreferrer" target="_blank">www.rebornsense.com</a>',
    },
    de: {
      heading: "Plattform-Anbieter",
      website:
        'Website &amp; Bestellsystem entwickelt von <a href="https://webprintmedia.swiss" rel="noopener noreferrer" target="_blank">webprintmedia.swiss</a>',
      pos: 'Kasse &amp; Hosting bereitgestellt von <a href="https://www.rebornsense.com" rel="noopener noreferrer" target="_blank">www.rebornsense.com</a>',
    },
    it: {
      heading: "Fornitori della piattaforma",
      website:
        'Sito web &amp; sistema di ordinazione sviluppati da <a href="https://webprintmedia.swiss" rel="noopener noreferrer" target="_blank">webprintmedia.swiss</a>',
      pos: 'POS &amp; hosting forniti da <a href="https://www.rebornsense.com" rel="noopener noreferrer" target="_blank">www.rebornsense.com</a>',
    },
  }[locale];

  return `<section class="shop-privacy-credits"><h2>${copy.heading}</h2><p>${copy.website}</p><p>${copy.pos}</p></section>`;
}

const CONTENT: Record<
  PrivacyLocale,
  {
    title: string;
    intro: (business: string, contact: string) => string;
    sections: Array<{ heading: string; body: string }>;
  }
> = {
  en: {
    title: "Privacy Policy",
    intro: (business, contact) =>
      `<p>This privacy policy explains how <strong>${escapeHtml(business)}</strong> (${escapeHtml(
        contact
      )}) collects and uses personal data when you use our online ordering website.</p>`,
    sections: [
      {
        heading: "Data we collect",
        body: `<ul>
<li>Contact details you provide when ordering or creating an account (name, email, phone, delivery address).</li>
<li>Order details (items, notes, delivery or pickup preferences, scheduled time).</li>
<li>Payment status and transaction references processed by our payment provider (we do not store full card numbers).</li>
<li>Technical data such as IP address, browser type, and cookies needed for the shop to function.</li>
</ul>`,
      },
      {
        heading: "How we use your data",
        body: `<ul>
<li>To process and fulfil your orders and reservations.</li>
<li>To communicate about your order (confirmation, status, delivery).</li>
<li>To operate customer accounts, loyalty programmes, and gift cards where enabled.</li>
<li>To improve our service and comply with legal obligations.</li>
</ul>`,
      },
      {
        heading: "Cookies & analytics",
        body: `<p>We use essential cookies so the shop, checkout, and login work correctly. If Google Analytics is enabled for this site, anonymised usage statistics may be collected via cookies. You can disable non-essential cookies in your browser settings.</p>`,
      },
      {
        heading: "Payment processing",
        body: `<p>Online card and wallet payments are processed by Adyen, a certified payment service provider. Payment data is transmitted securely and handled according to PCI-DSS standards. We receive only the information needed to confirm your payment.</p>`,
      },
      {
        heading: "Data retention",
        body: `<p>Order and account data is kept for as long as needed to fulfil orders, handle support requests, and meet tax and accounting requirements. You may request deletion where no legal retention obligation applies.</p>`,
      },
      {
        heading: "Your rights",
        body: `<p>Under applicable data protection law (including the GDPR where it applies), you may have the right to access, rectify, erase, restrict, or port your personal data, and to object to certain processing. You may also lodge a complaint with your local data protection authority.</p>`,
      },
    ],
  },
  fr: {
    title: "Politique de confidentialité",
    intro: (business, contact) =>
      `<p>Cette politique de confidentialité explique comment <strong>${escapeHtml(
        business
      )}</strong> (${escapeHtml(
        contact
      )}) collecte et utilise les données personnelles lorsque vous utilisez notre site de commande en ligne.</p>`,
    sections: [
      {
        heading: "Données collectées",
        body: `<ul>
<li>Coordonnées fournies lors d'une commande ou création de compte (nom, e-mail, téléphone, adresse de livraison).</li>
<li>Détails de commande (articles, remarques, mode de retrait ou livraison, horaire).</li>
<li>Statut de paiement et références de transaction traitées par notre prestataire (nous ne stockons pas les numéros de carte complets).</li>
<li>Données techniques (adresse IP, navigateur, cookies nécessaires au fonctionnement du site).</li>
</ul>`,
      },
      {
        heading: "Utilisation des données",
        body: `<ul>
<li>Traiter et exécuter vos commandes et réservations.</li>
<li>Communiquer au sujet de votre commande (confirmation, statut, livraison).</li>
<li>Gérer les comptes clients, programmes de fidélité et cartes cadeaux le cas échéant.</li>
<li>Améliorer notre service et respecter nos obligations légales.</li>
</ul>`,
      },
      {
        heading: "Cookies & analytique",
        body: `<p>Nous utilisons des cookies essentiels pour le bon fonctionnement de la boutique, du paiement et de la connexion. Si Google Analytics est activé, des statistiques anonymisées peuvent être collectées. Vous pouvez désactiver les cookies non essentiels dans votre navigateur.</p>`,
      },
      {
        heading: "Paiement en ligne",
        body: `<p>Les paiements par carte et portefeuille sont traités par Adyen, un prestataire certifié. Les données de paiement sont transmises de manière sécurisée selon les normes PCI-DSS. Nous recevons uniquement les informations nécessaires pour confirmer le paiement.</p>`,
      },
      {
        heading: "Conservation",
        body: `<p>Les données de commande et de compte sont conservées le temps nécessaire pour exécuter les commandes, le support et les obligations fiscales. Vous pouvez demander la suppression lorsqu'aucune obligation légale ne s'applique.</p>`,
      },
      {
        heading: "Vos droits",
        body: `<p>Conformément au RGPD et à la loi applicable, vous pouvez demander l'accès, la rectification, l'effacement, la limitation ou la portabilité de vos données, et vous opposer à certains traitements. Vous pouvez aussi contacter votre autorité de protection des données.</p>`,
      },
    ],
  },
  de: {
    title: "Datenschutzerklärung",
    intro: (business, contact) =>
      `<p>Diese Datenschutzerklärung erläutert, wie <strong>${escapeHtml(
        business
      )}</strong> (${escapeHtml(
        contact
      )}) personenbezogene Daten erhebt und verwendet, wenn Sie unsere Online-Bestellwebsite nutzen.</p>`,
    sections: [
      {
        heading: "Welche Daten wir erheben",
        body: `<ul>
<li>Kontaktdaten bei Bestellung oder Kontoerstellung (Name, E-Mail, Telefon, Lieferadresse).</li>
<li>Bestelldetails (Artikel, Notizen, Abholung/Lieferung, Wunschzeit).</li>
<li>Zahlungsstatus und Transaktionsreferenzen über unseren Zahlungsanbieter (keine vollständigen Kartennummern).</li>
<li>Technische Daten (IP-Adresse, Browser, für den Shop erforderliche Cookies).</li>
</ul>`,
      },
      {
        heading: "Verwendung der Daten",
        body: `<ul>
<li>Bearbeitung und Erfüllung Ihrer Bestellungen und Reservierungen.</li>
<li>Kommunikation zu Ihrer Bestellung (Bestätigung, Status, Lieferung).</li>
<li>Betrieb von Kundenkonten, Treueprogrammen und Geschenkkarten sofern aktiv.</li>
<li>Verbesserung unseres Angebots und Erfüllung gesetzlicher Pflichten.</li>
</ul>`,
      },
      {
        heading: "Cookies & Analyse",
        body: `<p>Wir verwenden notwendige Cookies, damit Shop, Checkout und Login funktionieren. Ist Google Analytics aktiv, können anonymisierte Nutzungsstatistiken erhoben werden. Nicht notwendige Cookies können Sie im Browser deaktivieren.</p>`,
      },
      {
        heading: "Zahlungsabwicklung",
        body: `<p>Online-Kartenzahlungen werden über Adyen abgewickelt. Zahlungsdaten werden sicher nach PCI-DSS übermittelt. Wir erhalten nur die zur Bestätigung erforderlichen Informationen.</p>`,
      },
      {
        heading: "Aufbewahrung",
        body: `<p>Bestell- und Kontodaten werden so lange gespeichert, wie für Auftragsabwicklung, Support und gesetzliche Aufbewahrungspflichten erforderlich. Eine Löschung ist möglich, sofern keine gesetzliche Pflicht entgegensteht.</p>`,
      },
      {
        heading: "Ihre Rechte",
        body: `<p>Nach anwendbarem Datenschutzrecht (einschliesslich DSGVO) haben Sie u. a. Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch. Sie können sich bei Ihrer Datenschutzbehörde beschweren.</p>`,
      },
    ],
  },
  it: {
    title: "Informativa sulla privacy",
    intro: (business, contact) =>
      `<p>Questa informativa spiega come <strong>${escapeHtml(business)}</strong> (${escapeHtml(
        contact
      )}) raccoglie e utilizza i dati personali quando usi il nostro sito di ordinazione online.</p>`,
    sections: [
      {
        heading: "Dati raccolti",
        body: `<ul>
<li>Dati di contatto forniti in ordine o registrazione (nome, e-mail, telefono, indirizzo di consegna).</li>
<li>Dettagli dell'ordine (articoli, note, ritiro/consegna, orario).</li>
<li>Stato pagamento e riferimenti transazione tramite il provider (non memorizziamo numeri di carta completi).</li>
<li>Dati tecnici (IP, browser, cookie necessari al funzionamento del negozio).</li>
</ul>`,
      },
      {
        heading: "Uso dei dati",
        body: `<ul>
<li>Elaborare ed evadere ordini e prenotazioni.</li>
<li>Comunicare in merito all'ordine (conferma, stato, consegna).</li>
<li>Gestire account clienti, programmi fedeltà e gift card se attivi.</li>
<li>Migliorare il servizio e adempiere obblighi legali.</li>
</ul>`,
      },
      {
        heading: "Cookie & analytics",
        body: `<p>Usiamo cookie essenziali per negozio, checkout e accesso. Se Google Analytics è attivo, possono essere raccolte statistiche anonime. Puoi disattivare i cookie non essenziali nel browser.</p>`,
      },
      {
        heading: "Pagamenti",
        body: `<p>I pagamenti online sono elaborati da Adyen. I dati di pagamento sono trasmessi in modo sicuro secondo PCI-DSS. Riceviamo solo le informazioni necessarie a confermare il pagamento.</p>`,
      },
      {
        heading: "Conservazione",
        body: `<p>I dati ordine e account sono conservati per il tempo necessario a evadere ordini, assistenza e obblighi fiscali. Puoi richiedere la cancellazione ove non sussistano obblighi legali.</p>`,
      },
      {
        heading: "I tuoi diritti",
        body: `<p>Ai sensi del GDPR e della legge applicabile puoi richiedere accesso, rettifica, cancellazione, limitazione, portabilità e opporti a determinati trattamenti. Puoi rivolgerti all'autorità garante.</p>`,
      },
    ],
  },
};

export const SHOP_PRIVACY_POLICY_SLUG = "privacy-policy";

export function resolvePrivacyContactName(
  merchant: ShopPrivacyMerchant,
  managerStaffName?: string | null
): string {
  const fromStaff = String(managerStaffName || "").trim();
  if (fromStaff && fromStaff.toLowerCase() !== "manager") return fromStaff;
  return String(merchant.name || "").trim() || "Business owner";
}

export function buildDefaultPrivacyPolicyHtml(
  merchant: ShopPrivacyMerchant,
  contactName?: string | null
): { title: string; htmlContent: string; locale: PrivacyLocale } {
  const locale = normalizePrivacyLocale(merchant.shopLanguage || merchant.panelLanguage);
  const businessName = String(merchant.name || "").trim() || "Our business";
  const contact = resolvePrivacyContactName(merchant, contactName);
  const email = String(merchant.email || "").trim() || null;
  const phone = String(merchant.phone || "").trim() || null;
  const address = formatAddress(merchant);
  const copy = CONTENT[locale];

  const sectionsHtml = copy.sections
    .map((s) => `<section><h2>${s.heading}</h2>${s.body}</section>`)
    .join("");

  const htmlContent = `<article class="shop-privacy-policy prose prose-stone max-w-none">
<h1>${copy.title}</h1>
${copy.intro(businessName, contact)}
${sectionsHtml}
${contactBlock(locale, businessName, contact, email, phone, address)}
${platformCredits(locale)}
<p class="shop-privacy-updated"><em>${locale === "de" ? "Stand" : locale === "fr" ? "Mise à jour" : locale === "it" ? "Aggiornamento" : "Last updated"}: ${new Date().toISOString().slice(0, 10)}</em></p>
</article>`;

  return { title: copy.title, htmlContent, locale };
}
