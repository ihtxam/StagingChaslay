import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface Customer {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  loyaltyPoints?: number | null;
  totalSpent?: string | null;
}

const MAX_PHONE_DIGITS = 15;

function sanitizePhoneInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, MAX_PHONE_DIGITS);
}

export default function Customers() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const response = await api.get('/merchant/customers');
      setCustomers(response.data.customers || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('customersToastLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const first = firstName.trim();
    const last = lastName.trim();
    const mail = email.trim();
    const tel = sanitizePhoneInput(phone);
    if (!first) {
      toast.error(t('customersNameRequired'));
      return;
    }
    if (!mail && !tel && !last) {
      toast.error(t('customersContactRequired'));
      return;
    }
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      toast.error(t('customersEmailInvalid'));
      return;
    }
    if (phone.trim() && !/^\d{1,15}$/.test(tel)) {
      toast.error(t('customersPhoneInvalid'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/merchant/customers', {
        firstName: first,
        lastName: last || undefined,
        email: mail || undefined,
        phone: tel || undefined,
      });
      toast.success(t('customersToastCreated'));
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('customersToastSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12">{t('customersLoading')}</div>;

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-2">{t('customersPageTitle')}</h1>
        <p className="text-sm muted mb-2">{t('customersPageSubtitle')}</p>
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
          <input
            className="input"
            placeholder={t('customersFirstName')}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder={t('customersLastName')}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <input
            className="input"
            placeholder={t('customersEmail')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div>
            <input
              className="input w-full"
              placeholder={t('customersPhone')}
              inputMode="numeric"
              autoComplete="tel"
              maxLength={MAX_PHONE_DIGITS}
              value={phone}
              onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
              onPaste={(e) => {
                e.preventDefault();
                setPhone(sanitizePhoneInput(e.clipboardData.getData('text')));
              }}
            />
            <p className="text-[11px] muted mt-1">{t('customersPhoneHint')}</p>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? t('saving') : t('customersAdd')}
          </button>
        </form>
      </div>

      <div className="card !p-0 table-scroll">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left border-b">
              <th className="px-3 py-2">{t('name')}</th>
              <th className="px-3 py-2">{t('customersEmail')}</th>
              <th className="px-3 py-2">{t('customersPhone')}</th>
              <th className="px-3 py-2">{t('customersPoints')}</th>
              <th className="px-3 py-2">{t('customersSpent')}</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-gray-500">
                  {t('customersEmpty')}
                </td>
              </tr>
            )}
            {customers.map((customer) => {
              const fullName =
                [customer.firstName, customer.lastName].filter(Boolean).join(' ') || '-';
              return (
                <tr key={customer.id} className="border-b last:border-0">
                  <td className="px-3 py-3 font-medium">
                    <span className="cell-truncate block" title={fullName}>
                      {fullName}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="cell-truncate block" title={customer.email || '-'}>
                      {customer.email || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{customer.phone || '-'}</td>
                  <td className="px-3 py-3">{customer.loyaltyPoints ?? 0}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    CHF {Number(customer.totalSpent || 0).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
