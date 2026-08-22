import { paymentMethodLabelEn, normalizePaymentMethod } from "./payment-breakdown";

export type ReportExportLang = "en" | "fr" | "de";

export function normalizeReportExportLang(raw?: string | null): ReportExportLang {
  const l = String(raw || "en").slice(0, 2).toLowerCase();
  if (l === "fr" || l === "de") return l;
  return "en";
}

export type ReportExportLabels = {
  reportInfo: string;
  storeName: string;
  generationTime: string;
  timePeriod: string;
  storeOrdersOverview: string;
  salesSummary: string;
  amount: string;
  qty: string;
  paidOrdersQty: string;
  totalPaid: string;
  tax: string;
  totalRefund: string;
  actualSales: string;
  refundedOrdersQty: string;
  tips: string;
  feeSummary: string;
  product: string;
  dishesDiscount: string;
  netSales: string;
  orderTypeReport: string;
  orderTypes: string;
  total: string;
  paymentMethodReport: string;
  paymentMethod: string;
  notes: string;
  totalTax: string;
  orderPlacedByReport: string;
  waiter: string;
  cashDrawerFunding: string;
  fundingAmountSalesTips: string;
  shiftOpeningFloat: (n: number) => string;
  shiftCashSales: (n: number) => string;
  shiftCashIn: (n: number) => string;
  shiftCashOut: (n: number) => string;
  shiftCashRefunds: (n: number) => string;
  shiftExpectedCash: (n: number) => string;
  cashInMovement: string;
  cashOutMovement: string;
  dailyReport: string;
  businessDate: string;
  refundedOrdersQtyShort: string;
  cash: string;
  cardTerminal: string;
  totalAmountOfReport: string;
  productReport: string;
  specification: string;
  grossSales: string;
  discCompsRewards: string;
  netSale: string;
  taxAmount: string;
  totalSales: string;
  refund: string;
  performanceReport: string;
  staff: string;
  productAmount: string;
  amountRatio: string;
  orders: string;
  orderRatio: string;
  section: string;
  label: string;
  summary: string;
  store: string;
  period: string;
  customers: string;
  payment: string;
  orderType: string;
  cashDrawer: string;
  paymentMethodLabel: (method: string) => string;
  channelLabel: (channel: string) => string;
};

const LABELS: Record<ReportExportLang, Omit<ReportExportLabels, "paymentMethodLabel" | "channelLabel">> = {
  en: {
    reportInfo: "Report Info",
    storeName: "Store Name",
    generationTime: "Generation Time",
    timePeriod: "Time Period",
    storeOrdersOverview: "Store orders overview",
    salesSummary: "Sales summary",
    amount: "Amount",
    qty: "Qty",
    paidOrdersQty: "Paid orders Qty",
    totalPaid: "Total paid",
    tax: "Tax",
    totalRefund: "Total refund",
    actualSales: "Actual sales",
    refundedOrdersQty: "Refunded orders Qty",
    tips: "Tips",
    feeSummary: "Fee summary",
    product: "Product",
    dishesDiscount: "Dishes discount",
    netSales: "Net sales",
    orderTypeReport: "Order type report",
    orderTypes: "Order types",
    total: "Total",
    paymentMethodReport: "Payment Method Report",
    paymentMethod: "Payment method",
    notes: "Notes",
    totalTax: "Total tax",
    orderPlacedByReport: "Order Placed By Report",
    waiter: "Waiter",
    cashDrawerFunding: "Cash drawer / Funding",
    fundingAmountSalesTips: "Funding amount (sales + tips)",
    shiftOpeningFloat: (n) => `Shift ${n} opening float`,
    shiftCashSales: (n) => `Shift ${n} cash sales`,
    shiftCashIn: (n) => `Shift ${n} cash in`,
    shiftCashOut: (n) => `Shift ${n} cash out`,
    shiftCashRefunds: (n) => `Shift ${n} cash refunds`,
    shiftExpectedCash: (n) => `Shift ${n} expected cash`,
    cashInMovement: "Cash in",
    cashOutMovement: "Cash out",
    dailyReport: "Daily Report",
    businessDate: "Business Date",
    refundedOrdersQtyShort: "Refunded orders Qty",
    cash: "Cash",
    cardTerminal: "Card/Terminal",
    totalAmountOfReport: "Total amount of the report",
    productReport: "Product report",
    specification: "Specification",
    grossSales: "Gross Sales",
    discCompsRewards: "Disc/Comps/Rewards",
    netSale: "Net sale",
    taxAmount: "Tax amount",
    totalSales: "Total sales",
    refund: "Refund",
    performanceReport: "Performance report",
    staff: "Staff",
    productAmount: "Product amount",
    amountRatio: "Amount Ratio",
    orders: "Orders",
    orderRatio: "Order ratio",
    section: "Section",
    label: "Label",
    summary: "Summary",
    store: "Store",
    period: "Period",
    customers: "Customers",
    payment: "Payment",
    orderType: "Order type",
    cashDrawer: "Cash drawer",
  },
  fr: {
    reportInfo: "Infos rapport",
    storeName: "Nom du commerce",
    generationTime: "Date de génération",
    timePeriod: "Période",
    storeOrdersOverview: "Vue d'ensemble des commandes",
    salesSummary: "Résumé des ventes",
    amount: "Montant",
    qty: "Qté",
    paidOrdersQty: "Commandes payées (qté)",
    totalPaid: "Total payé",
    tax: "TVA",
    totalRefund: "Total remboursé",
    actualSales: "Ventes réelles",
    refundedOrdersQty: "Commandes remboursées (qté)",
    tips: "Pourboires",
    feeSummary: "Résumé des frais",
    product: "Produit",
    dishesDiscount: "Remises plats",
    netSales: "Ventes nettes",
    orderTypeReport: "Rapport par type de commande",
    orderTypes: "Types de commande",
    total: "Total",
    paymentMethodReport: "Rapport moyens de paiement",
    paymentMethod: "Moyen de paiement",
    notes: "Notes",
    totalTax: "TVA totale",
    orderPlacedByReport: "Rapport par serveur",
    waiter: "Serveur",
    cashDrawerFunding: "Caisse / Fond de caisse",
    fundingAmountSalesTips: "Encaissements (ventes + pourboires)",
    shiftOpeningFloat: (n) => `Service ${n} — fond de caisse`,
    shiftCashSales: (n) => `Service ${n} — ventes espèces`,
    shiftCashIn: (n) => `Service ${n} — entrées caisse`,
    shiftCashOut: (n) => `Service ${n} — sorties caisse`,
    shiftCashRefunds: (n) => `Service ${n} — remboursements espèces`,
    shiftExpectedCash: (n) => `Service ${n} — espèces attendues`,
    cashInMovement: "Entrée caisse",
    cashOutMovement: "Sortie caisse",
    dailyReport: "Rapport journalier",
    businessDate: "Date",
    refundedOrdersQtyShort: "Remboursements (qté)",
    cash: "Espèces",
    cardTerminal: "Carte/Terminal",
    totalAmountOfReport: "Montant total du rapport",
    productReport: "Rapport produits",
    specification: "Spécification",
    grossSales: "Ventes brutes",
    discCompsRewards: "Remises/Offerts",
    netSale: "Vente nette",
    taxAmount: "Montant TVA",
    totalSales: "Ventes totales",
    refund: "Remboursement",
    performanceReport: "Performance personnel",
    staff: "Personnel",
    productAmount: "Montant produits",
    amountRatio: "Part montant",
    orders: "Commandes",
    orderRatio: "Part commandes",
    section: "Section",
    label: "Libellé",
    summary: "Résumé",
    store: "Commerce",
    period: "Période",
    customers: "Clients",
    payment: "Paiement",
    orderType: "Type de commande",
    cashDrawer: "Caisse",
  },
  de: {
    reportInfo: "Berichtsinfos",
    storeName: "Geschäftsname",
    generationTime: "Erstellungszeit",
    timePeriod: "Zeitraum",
    storeOrdersOverview: "Bestellübersicht",
    salesSummary: "Verkaufszusammenfassung",
    amount: "Betrag",
    qty: "Menge",
    paidOrdersQty: "Bezahlte Bestellungen (Anz.)",
    totalPaid: "Gesamt bezahlt",
    tax: "MwSt.",
    totalRefund: "Gesamterstattung",
    actualSales: "Tatsächliche Verkäufe",
    refundedOrdersQty: "Erstattete Bestellungen (Anz.)",
    tips: "Trinkgeld",
    feeSummary: "Gebührenübersicht",
    product: "Produkt",
    dishesDiscount: "Geräterabatt",
    netSales: "Nettoumsatz",
    orderTypeReport: "Bericht Bestellart",
    orderTypes: "Bestellarten",
    total: "Gesamt",
    paymentMethodReport: "Zahlungsartenbericht",
    paymentMethod: "Zahlungsart",
    notes: "Notizen",
    totalTax: "MwSt. gesamt",
    orderPlacedByReport: "Bericht nach Bedienung",
    waiter: "Bedienung",
    cashDrawerFunding: "Kasse / Wechselgeld",
    fundingAmountSalesTips: "Einzahlungen (Verkäufe + Trinkgeld)",
    shiftOpeningFloat: (n) => `Schicht ${n} — Kassenanfangsbestand`,
    shiftCashSales: (n) => `Schicht ${n} — Barverkäufe`,
    shiftCashIn: (n) => `Schicht ${n} — Kasseneingänge`,
    shiftCashOut: (n) => `Schicht ${n} — Kassenausgänge`,
    shiftCashRefunds: (n) => `Schicht ${n} — Barerstattungen`,
    shiftExpectedCash: (n) => `Schicht ${n} — erwartete Barmittel`,
    cashInMovement: "Kasseneingang",
    cashOutMovement: "Kassenausgang",
    dailyReport: "Tagesbericht",
    businessDate: "Datum",
    refundedOrdersQtyShort: "Erstattungen (Anz.)",
    cash: "Bar",
    cardTerminal: "Karte/Terminal",
    totalAmountOfReport: "Gesamtbetrag des Berichts",
    productReport: "Produktbericht",
    specification: "Spezifikation",
    grossSales: "Bruttoumsatz",
    discCompsRewards: "Rabatte/Gratis",
    netSale: "Nettoverkauf",
    taxAmount: "MwSt.-Betrag",
    totalSales: "Gesamtverkäufe",
    refund: "Erstattung",
    performanceReport: "Mitarbeiterleistung",
    staff: "Personal",
    productAmount: "Produktbetrag",
    amountRatio: "Anteil Betrag",
    orders: "Bestellungen",
    orderRatio: "Anteil Bestellungen",
    section: "Abschnitt",
    label: "Bezeichnung",
    summary: "Zusammenfassung",
    store: "Geschäft",
    period: "Zeitraum",
    customers: "Kunden",
    payment: "Zahlung",
    orderType: "Bestellart",
    cashDrawer: "Kasse",
  },
};

const PAYMENT_FR: Record<string, string> = {
  cash: "Espèces",
  card: "Carte",
  terminal: "Terminal",
  mixed: "Mixte",
  gift_card: "Carte cadeau",
  invoice: "Facture",
  pay_later: "Payer plus tard",
  bank_transfer: "Virement",
  other: "Autre",
};

const PAYMENT_DE: Record<string, string> = {
  cash: "Bar",
  card: "Karte",
  terminal: "Terminal",
  mixed: "Gemischt",
  gift_card: "Geschenkkarte",
  invoice: "Rechnung",
  pay_later: "Später bezahlen",
  bank_transfer: "Überweisung",
  other: "Sonstige",
};

const CHANNEL_FR: Record<string, string> = {
  dine_in: "Sur place",
  delivery: "Livraison",
  takeaway: "À emporter",
};

const CHANNEL_DE: Record<string, string> = {
  dine_in: "Vor Ort",
  delivery: "Lieferung",
  takeaway: "Takeaway",
};

export function reportExportLabels(lang: ReportExportLang): ReportExportLabels {
  const base = LABELS[lang];
  return {
    ...base,
    paymentMethodLabel: (method: string) => {
      const key = normalizePaymentMethod(method);
      if (lang === "fr") return PAYMENT_FR[key] || paymentMethodLabelEn(method);
      if (lang === "de") return PAYMENT_DE[key] || paymentMethodLabelEn(method);
      return paymentMethodLabelEn(method);
    },
    channelLabel: (channel: string) => {
      const key = String(channel || "takeaway").toLowerCase();
      if (lang === "fr") return CHANNEL_FR[key] || key;
      if (lang === "de") return CHANNEL_DE[key] || key;
      if (key === "dine_in") return "Dine-in";
      if (key === "delivery") return "Delivery";
      return "Takeaway";
    },
  };
}
