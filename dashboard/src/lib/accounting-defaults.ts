/** Default Swiss-style account numbers for accounting CSV export (merchant can override in settings). */
export function defaultAccountingAccountMap() {
  return {
    salesRevenue: '3200',
    vatPayable: '2200',
    cash: '1000',
    cardClearing: '1020',
    terminalClearing: '1021',
    tips: '3900',
    discounts: '3800',
    refunds: '3200',
  };
}
