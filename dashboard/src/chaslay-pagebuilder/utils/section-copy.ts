/** Built-in FR/DE/IT fallbacks for default English builder copy. */

/** Default template / seed copy is authored in English in the page builder. */
export const BUILDER_COPY_SOURCE_LOCALE = 'en';

type LocaleMap = { fr: string; de: string; it: string };

const PHRASES: Record<string, LocaleMap> = {
  Home: { fr: 'Accueil', de: 'Start', it: 'Home' },
  Menu: { fr: 'Menu', de: 'Menü', it: 'Menu' },
  'About Us': { fr: 'À propos', de: 'Über uns', it: 'Chi siamo' },
  About: { fr: 'À propos', de: 'Über uns', it: 'Chi siamo' },
  Gallery: { fr: 'Galerie', de: 'Galerie', it: 'Galleria' },
  'Our Gallery': { fr: 'Notre Galerie', de: 'Unsere Galerie', it: 'La nostra galleria' },
  'Photo Gallery': { fr: 'Galerie photos', de: 'Fotogalerie', it: 'Galleria fotografica' },
  Testimonials: { fr: 'Avis', de: 'Bewertungen', it: 'Recensioni' },
  'Customer Reviews': { fr: 'Avis clients', de: 'Kundenbewertungen', it: 'Recensioni clienti' },
  'What Our Guests Say': { fr: 'Ce que disent nos clients', de: 'Was unsere Gäste sagen', it: 'Cosa dicono i nostri ospiti' },
  'Featured Review': { fr: 'Avis en vedette', de: 'Ausgewählte Bewertung', it: 'Recensione in evidenza' },
  'Food Critic': { fr: 'Critique gastronomique', de: 'Restaurantkritiker', it: 'Critico gastronomico' },
  'Regular Customer': { fr: 'Client régulier', de: 'Stammkunde', it: 'Cliente abituale' },
  'Local Foodie': { fr: 'Gourmet local', de: 'Lokal Gourmet', it: 'Foodie locale' },
  'Loyal Patrons since 2019': {
    fr: 'Clients fidèles depuis 2019',
    de: 'Stammgäste seit 2019',
    it: 'Clienti fedeli dal 2019',
  },
  'Opening Hours': { fr: "Heures d'ouverture", de: 'Öffnungszeiten', it: 'Orari di apertura' },
  Hours: { fr: 'Horaires', de: 'Öffnungszeiten', it: 'Orari' },
  HOURS: { fr: 'HORAIRES', de: 'ÖFFNUNGSZEITEN', it: 'ORARI' },
  Contact: { fr: 'Contact', de: 'Kontakt', it: 'Contatti' },
  'Contact Us': { fr: 'Contactez-nous', de: 'Kontakt', it: 'Contattaci' },
  Featured: { fr: 'À la une', de: 'Empfohlen', it: 'In evidenza' },
  Promotions: { fr: 'Promotions', de: 'Aktionen', it: 'Promozioni' },
  Team: { fr: 'Équipe', de: 'Team', it: 'Team' },
  Blog: { fr: 'Blog', de: 'Blog', it: 'Blog' },
  Reservations: { fr: 'Réservations', de: 'Reservierungen', it: 'Prenotazioni' },
  Map: { fr: 'Plan', de: 'Karte', it: 'Mappa' },
  Footer: { fr: 'Pied de page', de: 'Fußzeile', it: 'Piè di pagina' },
  'Quick Links': { fr: 'Liens rapides', de: 'Schnellzugriff', it: 'Link rapidi' },
  'Order Now': { fr: 'Commander', de: 'Jetzt bestellen', it: 'Ordina ora' },
  'Book Now': { fr: 'Réserver', de: 'Jetzt buchen', it: 'Prenota ora' },
  'View Menu': { fr: 'Voir le menu', de: 'Menü ansehen', it: 'Vedi il menu' },
  'View Full Menu': { fr: 'Voir tout le menu', de: 'Ganzes Menü', it: 'Menu completo' },
  'Reserve Table': { fr: 'Réserver une table', de: 'Tisch reservieren', it: 'Prenota un tavolo' },
  'Reserve a Table': { fr: 'Réservez une table', de: 'Tisch reservieren', it: 'Prenota un tavolo' },
  'Our Menu': { fr: 'Notre menu', de: 'Unsere Speisekarte', it: 'Il nostro menu' },
  'Discover our delicious offerings': {
    fr: 'Découvrez nos délicieuses spécialités',
    de: 'Entdecken Sie unsere Köstlichkeiten',
    it: 'Scopri le nostre specialità',
  },
  'Our Story': { fr: 'Notre histoire', de: 'Unsere Geschichte', it: 'La nostra storia' },
  'Customer Reviews': { fr: 'Avis clients', de: 'Kundenbewertungen', it: 'Recensioni dei clienti' },
  'What Our Guests Say': { fr: 'Ce que disent nos clients', de: 'Was unsere Gäste sagen', it: 'Cosa dicono i nostri ospiti' },
  'Featured Review': { fr: 'Avis en vedette', de: 'Ausgewählte Bewertung', it: 'Recensione in evidenza' },
  Phone: { fr: 'Téléphone', de: 'Telefon', it: 'Telefono' },
  Email: { fr: 'E-mail', de: 'E-Mail', it: 'E-mail' },
  Address: { fr: 'Adresse', de: 'Adresse', it: 'Indirizzo' },
  All: { fr: 'Tout', de: 'Alle', it: 'Tutto' },
  'Passion on every plate': {
    fr: 'La passion dans chaque assiette',
    de: 'Leidenschaft auf jedem Teller',
    it: 'Passione in ogni piatto',
  },
  'Fresh ingredients, unforgettable flavours': {
    fr: 'Ingrédients frais, saveurs inoubliables',
    de: 'Frische Zutaten, unvergessliche Aromen',
    it: 'Ingredienti freschi, sapori indimenticabili',
  },
  'Chef specials and guest favourites': {
    fr: 'Spécialités du chef et coups de cœur',
    de: 'Chef-Spezialitäten und Gästefavoriten',
    it: 'Specialità dello chef e preferiti degli ospiti',
  },
  'Welcome to Our Restaurant': {
    fr: 'Bienvenue dans notre restaurant',
    de: 'Willkommen in unserem Restaurant',
    it: 'Benvenuti nel nostro ristorante',
  },
  'Experience the finest cuisine in town': {
    fr: 'Découvrez la meilleure cuisine de la ville',
    de: 'Erleben Sie die feinste Küche der Stadt',
    it: 'Scoprite la migliore cucina della città',
  },
  'Delicious Food Delivered': {
    fr: 'Cuisine délicieuse livrée',
    de: 'Köstliches Essen geliefert',
    it: 'Cibo delizioso a domicilio',
  },
  'Fresh & Fast': { fr: 'Frais et rapide', de: 'Frisch & schnell', it: 'Fresco e veloce' },
  'Taste the Difference': { fr: 'Goûtez la différence', de: 'Schmecken Sie den Unterschied', it: 'Assapora la differenza' },
  'Book your dining experience with us': {
    fr: 'Réservez votre expérience culinaire',
    de: 'Reservieren Sie Ihr Essenserlebnis',
    it: 'Prenota la tua esperienza culinaria',
  },
  'Visit Us': { fr: 'Venez nous voir', de: 'Besuchen Sie uns', it: 'Venite a trovarci' },
  'Find Us': { fr: 'Nous trouver', de: 'So finden Sie uns', it: 'Dove siamo' },
  'Serving delicious food since 2020. Visit us for an unforgettable dining experience.': {
    fr: 'Cuisine délicieuse depuis 2020. Venez vivre une expérience inoubliable.',
    de: 'Seit 2020 servieren wir köstliches Essen. Besuchen Sie uns für ein unvergessliches Erlebnis.',
    it: 'Serviamo piatti deliziosi dal 2020. Venite per un\'esperienza indimenticabile.',
  },
  'Mon-Fri: 11am-10pm': { fr: 'Lun-ven : 11h-22h', de: 'Mo-Fr: 11-22 Uhr', it: 'Lun-ven: 11-22' },
  'Sat-Sun: 10am-11pm': { fr: 'Sam-dim : 10h-23h', de: 'Sa-So: 10-23 Uhr', it: 'Sab-dom: 10-23' },
  'Follow Us': { fr: 'Suivez-nous', de: 'Folgen Sie uns', it: 'Seguici' },
  'Get in Touch': { fr: 'Contactez-nous', de: 'Kontakt aufnehmen', it: 'Contattaci' },
  'Subscribe': { fr: "S'abonner", de: 'Abonnieren', it: 'Iscriviti' },
  'Subscribe to our newsletter': {
    fr: 'Abonnez-vous à notre newsletter',
    de: 'Abonnieren Sie unseren Newsletter',
    it: 'Iscriviti alla nostra newsletter',
  },
  'Enter your email': {
    fr: 'Entrez votre e-mail',
    de: 'E-Mail eingeben',
    it: 'Inserisci la tua email',
  },
  'We look forward to serving you': {
    fr: 'Nous avons hâte de vous servir',
    de: 'Wir freuen uns auf Ihren Besuch',
    it: "Non vediamo l'ora di servirvi",
  },
  'When to Visit': { fr: 'Quand venir', de: 'Wann Sie uns besuchen', it: 'Quando venirci' },
  'Find the perfect time for your dining experience': {
    fr: 'Trouvez le moment idéal pour votre repas',
    de: 'Finden Sie den perfekten Zeitpunkt',
    it: 'Trova il momento ideale per cenare',
  },
  'Open Now': { fr: 'Ouvert', de: 'Jetzt geöffnet', it: 'Aperto ora' },
  Closed: { fr: 'Fermé', de: 'Geschlossen', it: 'Chiuso' },
  Today: { fr: "Aujourd'hui", de: 'Heute', it: 'Oggi' },
  Monday: { fr: 'Lundi', de: 'Montag', it: 'Lunedì' },
  Tuesday: { fr: 'Mardi', de: 'Dienstag', it: 'Martedì' },
  Wednesday: { fr: 'Mercredi', de: 'Mittwoch', it: 'Mercoledì' },
  Thursday: { fr: 'Jeudi', de: 'Donnerstag', it: 'Giovedì' },
  Friday: { fr: 'Vendredi', de: 'Freitag', it: 'Venerdì' },
  Saturday: { fr: 'Samedi', de: 'Samstag', it: 'Sabato' },
  Sunday: { fr: 'Dimanche', de: 'Sonntag', it: 'Domenica' },
  'Monday - Thursday': { fr: 'Lundi - jeudi', de: 'Montag - Donnerstag', it: 'Lunedì - giovedì' },
  'Friday - Saturday': { fr: 'Vendredi - samedi', de: 'Freitag - Samstag', it: 'Venerdì - sabato' },
  'Mon - Thu': { fr: 'Lun - jeu', de: 'Mo - Do', it: 'Lun - gio' },
  'Fri - Sat': { fr: 'Ven - sam', de: 'Fr - Sa', it: 'Ven - sab' },
  'Mon - Sun': { fr: 'Lun - dim', de: 'Mo - So', it: 'Lun - dom' },
  'Sat - Sun': { fr: 'Sam - dim', de: 'Sa - So', it: 'Sab - dom' },
  'Mon – Fri': { fr: 'Lun – ven', de: 'Mo – Fr', it: 'Lun – ven' },
  Lunch: { fr: 'Déjeuner', de: 'Mittagessen', it: 'Pranzo' },
  Dinner: { fr: 'Dîner', de: 'Abendessen', it: 'Cena' },
  'Late Night': { fr: 'Soirée', de: 'Spätabend', it: 'Notte' },
  Brunch: { fr: 'Brunch', de: 'Brunch', it: 'Brunch' },
  'All rights reserved.': { fr: 'Tous droits réservés.', de: 'Alle Rechte vorbehalten.', it: 'Tutti i diritti riservati.' },
  'All rights reserved': { fr: 'Tous droits réservés', de: 'Alle Rechte vorbehalten', it: 'Tutti i diritti riservati' },
  'Crafted with love.': { fr: 'Fait avec amour.', de: 'Mit Liebe gemacht.', it: 'Fatto con amore.' },
  'The food was absolutely amazing! Best dining experience we have had in years.': {
    fr: 'La nourriture était absolument extraordinaire ! La meilleure expérience culinaire que nous ayons eue depuis des années.',
    de: 'Das Essen war absolut fantastisch! Das beste Restauranterlebnis seit Jahren.',
    it: 'Il cibo era assolutamente straordinario! La migliore esperienza culinaria che abbiamo avuto da anni.',
  },
  'Wonderful atmosphere and excellent service. The pasta dishes are to die for!': {
    fr: 'Atmosphère merveilleuse et service excellent. Les plats de pâtes sont à tomber !',
    de: 'Wunderbare Atmosphäre und ausgezeichneter Service. Die Pasta-Gerichte sind zum Sterben schön!',
    it: 'Atmosfera meravigliosa e servizio eccellente. I piatti di pasta sono da morire!',
  },
  'A hidden gem! Every dish is crafted with care and the flavors are incredible.': {
    fr: 'Un trésor caché ! Chaque plat est préparé avec soin et les saveurs sont incroyables.',
    de: 'Ein Geheimtipp! Jedes Gericht wird mit Sorgfalt zubereitet und die Aromen sind unglaublich.',
    it: 'Una perla nascosta! Ogni piatto è preparato con cura e i sapori sono incredibili.',
  },
  'We celebrated our anniversary here and it was perfect. Highly recommended!': {
    fr: "Nous avons célébré notre anniversaire ici et c'était parfait. Fortement recommandé !",
    de: 'Wir haben hier unseren Jahrestag gefeiert – es war perfekt. Sehr empfehlenswert!',
    it: 'Abbiamo festeggiato il nostro anniversario qui ed è stato perfetto. Consigliatissimo!',
  },
  'An extraordinary culinary journey. Every visit reveals new flavors and the attention to detail is simply unmatched. This restaurant has become our family tradition for special occasions.': {
    fr: "Un voyage culinaire extraordinaire. Chaque visite révèle de nouvelles saveurs et l'attention aux détails est incomparable. Ce restaurant est devenu notre tradition familiale pour les grandes occasions.",
    de: 'Eine außergewöhnliche kulinarische Reise. Jeder Besuch enthüllt neue Aromen und die Liebe zum Detail ist schlicht unerreicht. Dieses Restaurant ist unsere Familientradition für besondere Anlässe geworden.',
    it: "Un viaggio culinario straordinario. Ogni visita rivela nuovi sapori e l'attenzione ai dettagli è semplicemente ineguagliabile. Questo ristorante è diventato la nostra tradizione di famiglia per le occasioni speciali.",
  },
};

const SORTED_PHRASES = Object.keys(PHRASES).sort((a, b) => b.length - a.length);

function localeKey(locale: string): 'fr' | 'de' | 'it' | null {
  const loc = String(locale || '').toLowerCase().slice(0, 2);
  if (loc === 'fr' || loc === 'de' || loc === 'it') return loc;
  return null;
}

/** Convert 12-hour clock fragments (11:00 AM, 11am) to 24-hour `HH:mm`. */
export function to24HourClock(text: string): string {
  if (!text) return text;
  return text.replace(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)\b/g, (_, hourRaw, minutes, meridiem) => {
    let hour = parseInt(hourRaw, 10);
    const min = minutes ?? '00';
    const isPm = String(meridiem).toUpperCase() === 'PM';
    if (!isPm) {
      if (hour === 12) hour = 0;
    } else if (hour !== 12) {
      hour += 12;
    }
    return `${String(hour).padStart(2, '0')}:${min}`;
  });
}

export function translateSectionCopy(text: string, locale: string, _defaultLanguage = 'en'): string {
  if (!text) return text;
  const loc = localeKey(locale);
  const source = BUILDER_COPY_SOURCE_LOCALE;
  if (!loc || loc === source) return text;
  const exact = PHRASES[text]?.[loc];
  if (exact) return to24HourClock(exact);
  let out = text;
  for (const phrase of SORTED_PHRASES) {
    const translated = PHRASES[phrase][loc];
    if (translated && out.includes(phrase)) out = out.split(phrase).join(translated);
  }
  return to24HourClock(out);
}
