import api from '@/lib/api';
import { webPosDeviceId } from '@/lib/webpos-print-relay';

export type DeviceEnrollmentSnapshot = {
  id: string;
  deviceId: string;
  locationId: string;
  stationId: string | null;
  paymentProfileId: string;
  paymentTerminalId: string;
  terminalId: string;
  terminalName: string;
  lockEnrollment: boolean;
};

export type DeviceRuntimeConfig = {
  enrolled: boolean;
  lockEnrollment: boolean;
  enrollment: DeviceEnrollmentSnapshot | null;
  paymentProfileId: string;
  fixedTerminalId: string | null;
  terminals: Array<{
    id: string;
    terminalId: string;
    terminalName: string;
    status: string;
    paymentProfileId?: string;
  }>;
  posPrintSettings?: Record<string, unknown>;
};

export async function fetchDeviceRuntimeConfig(
  deviceId = webPosDeviceId()
): Promise<DeviceRuntimeConfig | null> {
  try {
    const res = await api.get('/merchant/device-enrollments/device-config', {
      params: { deviceId },
    });
    return (res.data?.config as DeviceRuntimeConfig) || null;
  } catch {
    return null;
  }
}

export async function enrollCurrentDevice(input: {
  locationId: string;
  stationId?: string | null;
  paymentProfileId: string;
  paymentTerminalId: string;
  lockEnrollment?: boolean;
  printSnapshot?: Record<string, unknown>;
}) {
  const res = await api.post('/merchant/device-enrollments', {
    deviceId: webPosDeviceId(),
    ...input,
  });
  return res.data?.enrollment as DeviceEnrollmentSnapshot;
}

export async function clearDeviceEnrollment(deviceId = webPosDeviceId()) {
  await api.delete(`/merchant/device-enrollments/${encodeURIComponent(deviceId)}`);
}
