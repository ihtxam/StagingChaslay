"use strict";
/** Transactional email copy keyed by customer/shop locale. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTxLocale = resolveTxLocale;
exports.reservationEmailCopy = reservationEmailCopy;
exports.shopOrderEmailCopy = shopOrderEmailCopy;
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
        cancelled: (s, n) => `Order ${n} cancelled — ${s}`,
    },
    fr: {
        received: (s, n) => `Commande ${n} reçue — ${s}`,
        confirmed: (s, n) => `Commande ${n} confirmée — ${s}`,
        ready: (s, n) => `Commande ${n} prête — ${s}`,
        cancelled: (s, n) => `Commande ${n} annulée — ${s}`,
    },
    de: {
        received: (s, n) => `Bestellung ${n} erhalten — ${s}`,
        confirmed: (s, n) => `Bestellung ${n} bestätigt — ${s}`,
        ready: (s, n) => `Bestellung ${n} ist bereit — ${s}`,
        cancelled: (s, n) => `Bestellung ${n} storniert — ${s}`,
    },
};
const SHOP_ORDER_BODIES = {
    en: {
        received: 'Thank you for your order. We will confirm it shortly.',
        confirmed: 'Your order has been confirmed and is being prepared.',
        ready: 'Your order is ready for pickup.',
        cancelled: 'Your order has been cancelled.',
    },
    fr: {
        received: 'Merci pour votre commande. Nous la confirmerons sous peu.',
        confirmed: 'Votre commande est confirmée et en préparation.',
        ready: 'Votre commande est prête à être récupérée.',
        cancelled: 'Votre commande a été annulée.',
    },
    de: {
        received: 'Vielen Dank für Ihre Bestellung. Wir bestätigen sie in Kürze.',
        confirmed: 'Ihre Bestellung ist bestätigt und wird zubereitet.',
        ready: 'Ihre Bestellung ist zur Abholung bereit.',
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
//# sourceMappingURL=transactional-email-labels.js.map