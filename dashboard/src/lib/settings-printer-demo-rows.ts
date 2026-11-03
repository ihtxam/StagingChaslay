/** Onboarding examples matching Printers_proposal mock (not persisted). */
export type SettingsDemoPrinterRow = {
  id: string;
  name: string;
  connectionKind: 'usb' | 'wifi';
  connectionDetail: string;
  status: 'connected' | 'attention';
  printReceipts: boolean;
  printKitchenTickets: boolean;
  printEndOfDayReports: boolean;
};

export const SETTINGS_DEMO_PRINTER_ROWS: SettingsDemoPrinterRow[] = [
  {
    id: 'demo-usb',
    name: 'USB Printer Port USB Print',
    connectionKind: 'usb',
    connectionDetail: 'USB · USB Printer Port USB Print (1048:20497)',
    status: 'connected',
    printReceipts: true,
    printKitchenTickets: false,
    printEndOfDayReports: false,
  },
  {
    id: 'demo-wifi',
    name: 'Network printer · 192.168.1.100',
    connectionKind: 'wifi',
    connectionDetail: 'WiFi · 192.168.1.100',
    status: 'attention',
    printReceipts: false,
    printKitchenTickets: true,
    printEndOfDayReports: true,
  },
];
