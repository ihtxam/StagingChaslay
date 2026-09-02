import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';

export const MERCHANT_SETUP_STORAGE_KEY = 'reborn_merchant_setup_v1';

export type SetupStepId =
  | 'business_info'
  | 'products'
  | 'payment_settings'
  | 'staff'
  | 'online_shop';

export type SetupStep = {
  id: SetupStepId;
  step: number;
  title: string;
  description: string;
  completedDescription: string;
  path: string;
  completed: boolean;
};

type SetupSnapshot = {
  steps: SetupStep[];
  completedCount: number;
  totalCount: number;
  percent: number;
  allComplete: boolean;
  loading: boolean;
  dismissed: boolean;
  refresh: () => Promise<void>;
  dismiss: () => void;
  markStepDone: (id: SetupStepId) => void;
};

function readDismissed(): boolean {
  try {
    return localStorage.getItem(`${MERCHANT_SETUP_STORAGE_KEY}_dismissed`) === '1';
  } catch {
    return false;
  }
}

function readManualDone(): Partial<Record<SetupStepId, boolean>> {
  try {
    const raw = localStorage.getItem(`${MERCHANT_SETUP_STORAGE_KEY}_manual`);
    return raw ? (JSON.parse(raw) as Partial<Record<SetupStepId, boolean>>) : {};
  } catch {
    return {};
  }
}

function writeManualDone(map: Partial<Record<SetupStepId, boolean>>) {
  try {
    localStorage.setItem(`${MERCHANT_SETUP_STORAGE_KEY}_manual`, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function useMerchantSetupProgress(): SetupSnapshot {
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [manualDone, setManualDone] = useState(readManualDone);
  const [detected, setDetected] = useState<Partial<Record<SetupStepId, boolean>>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, productsRes, staffRes, buildersRes] = await Promise.all([
        api.get('/merchant/settings'),
        api.get('/merchant/products', { params: { limit: 1 } }).catch(() => null),
        api.get('/merchant/staff').catch(() => null),
        api.get('/merchant/chaslay-pagebuilder').catch(() => null),
      ]);
      const s = settingsRes.data?.settings || {};
      const products = productsRes?.data?.products ?? productsRes?.data?.data ?? [];
      const staff = staffRes?.data?.staff ?? [];
      const builders = buildersRes?.data?.data ?? [];
      const hasActiveBuilder = Array.isArray(builders) && builders.some((b: { is_active?: boolean }) => b.is_active);
      const paymentReady =
        !!(s.adyenMerchantAccount || s.stripeAccountId || s.paymentProvider) ||
        s.acceptCardPayments === true ||
        s.cashPaymentsEnabled === true;
      setDetected({
        business_info: Boolean(String(s.name || '').trim() && String(s.address || s.city || '').trim()),
        products: Array.isArray(products) ? products.length > 0 : Number(productsRes?.data?.total || 0) > 0,
        payment_settings: paymentReady,
        staff: Array.isArray(staff) ? staff.length > 0 : false,
        online_shop: Boolean(s.cmsHomepageEnabled || s.shopEnabled || hasActiveBuilder),
      });
    } catch {
      /* keep previous detected state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const steps = useMemo<SetupStep[]>(() => {
    const defs: Array<Omit<SetupStep, 'completed'>> = [
      {
        id: 'business_info',
        step: 1,
        title: 'Business Information',
        description: 'Add your business name, address, and contact details.',
        completedDescription: 'Business info completed',
        path: '/merchant/settings',
      },
      {
        id: 'products',
        step: 2,
        title: 'Products',
        description: 'Add items to your menu or product catalog.',
        completedDescription: 'Products added',
        path: '/merchant/products',
      },
      {
        id: 'payment_settings',
        step: 3,
        title: 'Payment Settings',
        description: 'Configure how you accept payments.',
        completedDescription: 'Payments configured',
        path: '/merchant/settings?tab=payments',
      },
      {
        id: 'staff',
        step: 4,
        title: 'Staff & Users',
        description: 'Invite team members and set up PIN access.',
        completedDescription: 'Staff added',
        path: '/merchant/staff',
      },
      {
        id: 'online_shop',
        step: 5,
        title: 'Online Shop & Website',
        description: 'Publish your page builder layout on the online shop.',
        completedDescription: 'Website published',
        path: '/merchant/chaslay-page-builder',
      },
    ];
    return defs.map((def) => ({
      ...def,
      completed: Boolean(detected[def.id] || manualDone[def.id]),
    }));
  }, [detected, manualDone]);

  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const percent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const allComplete = completedCount >= totalCount;

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(`${MERCHANT_SETUP_STORAGE_KEY}_dismissed`, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const markStepDone = useCallback((id: SetupStepId) => {
    setManualDone((prev) => {
      const next = { ...prev, [id]: true };
      writeManualDone(next);
      return next;
    });
  }, []);

  return {
    steps,
    completedCount,
    totalCount,
    percent,
    allComplete,
    loading,
    dismissed,
    refresh,
    dismiss,
    markStepDone,
  };
}
