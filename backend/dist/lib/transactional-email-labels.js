"use strict";
/** Transactional email copy keyed by customer/shop locale. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTxLocale = resolveTxLocale;
exports.reservationEmailCopy = reservationEmailCopy;
exports.shopOrderEmailCopy = shopOrderEmailCopy;
exports.merchantNewOrderEmailCopy = merchantNewOrderEmailCopy;
exports.shopOrderTrackLabel = shopOrderTrackLabel;
exports.shopOrderReadyLabel = shopOrderReadyLabel;
function loc(raw) {
    const l = String(raw || 'en').toLowerCase().slice(0, 2);
    if (l === 'fr' || l === 'de')
        return l;
    return 'en';
}
function resolveTxLocale(opts) {
    return loc(opts?.guestLocale || opts?.shopLanguage || opts?.panelLanguage || 'en');
}
const RESERVATION_SUBJECTS = {
    en: {
        received: (s) => `Reservation request received — ${s}`,
        confirmed: (s) => `Reservation confirmed — ${s}`,
        rejected: (s) => `Reservation not available — ${s}`,
        cancelled: (s) => `Reservation cancelled — ${s}`,
        seated: (s) => `Welcome — ${s}`,
        reminder: (s) => `Reminder: your reservation at ${s}`,
    },
    fr: {
        received: (s) => `Demande de réservation reçue — ${s}`,
        confirmed: (s) => `Réservation confirmée — ${s}`,
        rejected: (s) => `Réservation non disponible — ${s}`,
        cancelled: (s) => `Réservation annulée — ${s}`,
        seated: (s) => `Bienvenue — ${s}`,
        reminder: (s) => `Rappel : votre réservation chez ${s}`,
    },
    de: {
        received: (s) => `Reservierungsanfrage erhalten — ${s}`,
        confirmed: (s) => `Reservierung bestätigt — ${s}`,
        rejected: (s) => `Reservierung nicht verfügbar — ${s}`,
        cancelled: (s) => `Reservierung storniert — ${s}`,
        seated: (s) => `Willkommen — ${s}`,
        reminder: (s) => `Erinnerung: Ihre Reservierung bei ${s}`,
    },
};
const RESERVATION_BODIES = {
    en: {
        received: 'We received your reservation request and will confirm shortly.',
        confirmed: 'Your table is confirmed. We look forward to seeing you!',
        rejected: 'Unfortunately we cannot accommodate this reservation. Please try another time.',
        cancelled: 'Your reservation has been cancelled.',
        seated: 'Welcome! Your table is ready.',
        reminder: 'This is a friendly reminder about your upcoming reservation.',
    },
    fr: {
        received: 'Nous avons bien reçu votre demande de réservation et la confirmerons sous peu.',
        confirmed: 'Votre table est confirmée. Nous avons hâte de vous accueillir !',
        rejected: 'Malheureusement nous ne pouvons pas honorer cette réservation. Merci de choisir un autre créneau.',
        cancelled: 'Votre réservation a été annulée.',
        seated: 'Bienvenue ! Votre table est prête.',
        reminder: 'Rappel amical concernant votre prochaine réservation.',
    },
    de: {
        received: 'Wir haben Ihre Reservierungsanfrage erhalten und bestätigen sie in Kürze.',
        confirmed: 'Ihr Tisch ist bestätigt. Wir freuen uns auf Ihren Besuch!',
        rejected: 'Leider können wir diese Reservierung nicht annehmen. Bitte wählen Sie eine andere Zeit.',
        cancelled: 'Ihre Reservierung wurde storniert.',
        seated: 'Willkommen! Ihr Tisch ist bereit.',
        reminder: 'Freundliche Erinnerung an Ihre bevorstehende Reservierung.',
    },
};
const RES_LABELS = {
    en: {
        code: 'Code',
        when: 'When',
        guests: 'Guests',
        name: 'Name',
        table: 'Table',
        where: 'Where',
        offer: 'Offer',
        questions: 'Questions? Call',
    },
    fr: {
        code: 'Code',
        when: 'Quand',
        guests: 'Convives',
        name: 'Nom',
        table: 'Table',
        where: 'Adresse',
        offer: 'Offre',
        questions: 'Des questions ? Appelez',
    },
    de: {
        code: 'Code',
        when: 'Wann',
        guests: 'Gäste',
        name: 'Name',
        table: 'Tisch',
        where: 'Adresse',
        offer: 'Angebot',
        questions: 'Fragen? Rufen Sie an',
    },
};
function reservationEmailCopy(kind, shop, locale) {
    const lang = loc(locale);
    return {
        subject: RESERVATION_SUBJECTS[lang][kind](shop),
        body: RESERVATION_BODIES[lang][kind],
        labels: RES_LABELS[lang],
    };
}
const SHOP_ORDER_SUBJECTS = {
    en: {
        received: (s, n) => `Order ${n} received — ${s}`,
        confirmed: (s, n) => `Order ${n} confirmed — ${s}`,
        ready: (s, n) => `Order ${n} is ready — ${s}`,
        out_for_delivery: (s, n) => `Order ${n} is on the way — ${s}`,
        cancelled: (s, n) => `Order ${n} cancelled — ${s}`,
    },
    fr: {
        received: (s, n) => `Commande ${n} reçue — ${s}`,
        confirmed: (s, n) => `Commande ${n} confirmée — ${s}`,
        ready: (s, n) => `Commande ${n} prête — ${s}`,
        out_for_delivery: (s, n) => `Commande ${n} en livraison — ${s}`,
        cancelled: (s, n) => `Commande ${n} annulée — ${s}`,
    },
    de: {
        received: (s, n) => `Bestellung ${n} erhalten — ${s}`,
        confirmed: (s, n) => `Bestellung ${n} bestätigt — ${s}`,
        ready: (s, n) => `Bestellung ${n} ist bereit — ${s}`,
        out_for_delivery: (s, n) => `Bestellung ${n} ist unterwegs — ${s}`,
        cancelled: (s, n) => `Bestellung ${n} storniert — ${s}`,
    },
};
const SHOP_ORDER_BODIES = {
    en: {
        received: 'Thank you for your order. We will confirm it shortly.',
        confirmed: 'The store has accepted your order and is preparing it. Track status with the link below.',
        ready: 'Your order is ready for pickup.',
        out_for_delivery: 'Your driver is on the way. Track live delivery using the link below.',
        cancelled: 'Your order has been cancelled.',
    },
    fr: {
        received: 'Merci pour votre commande. Nous la confirmerons sous peu.',
        confirmed: 'Le magasin a accepté votre commande et la prépare. Suivez son statut via le lien ci-dessous.',
        ready: 'Votre commande est prête à être récupérée.',
        out_for_delivery: 'Votre livreur est en route. Suivez la livraison en direct via le lien ci-dessous.',
        cancelled: 'Votre commande a été annulée.',
    },
    de: {
        received: 'Vielen Dank für Ihre Bestellung. Wir bestätigen sie in Kürze.',
        confirmed: 'Das Geschäft hat Ihre Bestellung angenommen und bereitet sie zu. Verfolgen Sie den Status über den Link unten.',
        ready: 'Ihre Bestellung ist zur Abholung bereit.',
        out_for_delivery: 'Ihr Fahrer ist unterwegs. Verfolgen Sie die Lieferung live über den Link unten.',
        cancelled: 'Ihre Bestellung wurde storniert.',
    },
};
function shopOrderEmailCopy(kind, shop, orderNumber, locale) {
    const lang = loc(locale);
    return {
        subject: SHOP_ORDER_SUBJECTS[lang][kind](shop, orderNumber),
        body: SHOP_ORDER_BODIES[lang][kind],
    };
}
const MERCHANT_NEW_ORDER = {
    en: {
        subject: (s, n) => `New online order ${n} — ${s}`,
        body: 'A new online order was placed. Open the orders screen to accept it.',
    },
    fr: {
        subject: (s, n) => `Nouvelle commande en ligne ${n} — ${s}`,
        body: 'Une nouvelle commande en ligne a été passée. Ouvrez les commandes pour l’accepter.',
    },
    de: {
        subject: (s, n) => `Neue Online-Bestellung ${n} — ${s}`,
        body: 'Eine neue Online-Bestellung ist eingegangen. Öffnen Sie die Bestellungen, um sie anzunehmen.',
    },
};
function merchantNewOrderEmailCopy(shop, orderNumber, locale) {
    const lang = loc(locale);
    return {
        subject: MERCHANT_NEW_ORDER[lang].subject(shop, orderNumber),
        body: MERCHANT_NEW_ORDER[lang].body,
    };
}
function shopOrderTrackLabel(locale) {
    const lang = loc(locale);
    if (lang === 'fr')
        return 'Suivre votre commande';
    if (lang === 'de')
        return 'Bestellung verfolgen';
    return 'Track your order';
}
function shopOrderReadyLabel(locale) {
    const lang = loc(locale);
    if (lang === 'fr')
        return 'Heure estimée';
    if (lang === 'de')
        return 'Geschätzte Zeit';
    return 'Estimated time';
}
//# sourceMappingURL=transactional-email-labels.js.map