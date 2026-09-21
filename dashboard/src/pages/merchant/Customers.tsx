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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const load = async () => {
    try {
      const response = await api.get('/merchant/customers', { params: { limit: 500 } });
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

  const validateContact = (
    first: string,
    last: string,
    mail: string,
    tel: string
  ): boolean => {
    if (!first) {
      toast.error(t('customersNameRequired'));
      return false;
    }
    if (!mail && !tel && !last) {
      toast.error(t('customersContactRequired'));
      return false;
    }
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      toast.error(t('customersEmailInvalid'));
      return false;
    }
    if (tel && !/^\d{1,15}$/.test(tel)) {
      toast.error(t('customersPhoneInvalid'));
      return false;
    }
    return true;
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const first = firstName.trim();
    const last = lastName.trim();
    const mail = email.trim();
    const tel = sanitizePhoneInput(phone);
    if (!validateContact(first, last, mail, tel)) return;
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

  const startEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setEditFirstName(customer.firstName || '');
    setEditLastName(customer.lastName || '');
    setEditEmail(customer.email || '');
    setEditPhone(customer.phone || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFirstName('');
    setEditLastName('');
    setEditEmail('');
    setEditPhone('');
  };

  const onUpdate = async (customerId: string) => {
    const first = editFirstName.trim();
    const last = editLastName.trim();
    const mail = editEmail.trim();
    const tel = sanitizePhoneInput(editPhone);
    if (!validateContact(first, last, mail, tel)) return;
    setSaving(true);
    try {
      await api.patch(`/merchant/customers/${customerId}`, {
        firstName: first,
        lastName: last || undefined,
        email: mail || undefined,
        phone: tel || undefined,
      });
      toast.success(t('customersToastUpdated'));
      cancelEdit();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('customersToastSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (customer: Customer) => {
    const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email || customer.phone;
    if (!window.confirm(`${t('customersDeleteConfirm')}${fullName ? `\n${fullName}` : ''}`)) return;
    setSaving(true);
    try {
      await api.delete(`/merchant/customers/${customer.id}`);
      toast.success(t('customersToastDeleted'));
      if (editingId === customer.id) cancelEdit();
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
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="text-left border-b">
              <th className="px-3 py-2">{t('name')}</th>
              <th className="px-3 py-2">{t('customersEmail')}</th>
              <th className="px-3 py-2">{t('customersPhone')}</th>
              <th className="px-3 py-2">{t('customersPoints')}</th>
              <th className="px-3 py-2">{t('customersSpent')}</th>
              <th className="px-3 py-2 w-40">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-gray-500">
                  {t('customersEmpty')}
                </td>
              </tr>
            )}
            {customers.map((customer) => {
              const isEditing = editingId === customer.id;
              const fullName =
                [customer.firstName, customer.lastName].filter(Boolean).join(' ') || '-';
              return (
                <tr key={customer.id} className="border-b last:border-0 align-top">
                  <td className="px-3 py-3 font-medium">
                    {isEditing ? (
                      <div className="grid gap-2">
                        <input
                          className="input"
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                          placeholder={t('customersFirstName')}
                        />
                        <input
                          className="input"
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                          placeholder={t('customersLastName')}
                        />
                      </div>
                    ) : (
                      <span className="cell-truncate block" title={fullName}>
                        {fullName}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <input
                        className="input w-full"
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder={t('customersEmail')}
                      />
                    ) : (
                      <span className="cell-truncate block" title={customer.email || '-'}>
                        {customer.email || '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        className="input w-full"
                        inputMode="numeric"
                        maxLength={MAX_PHONE_DIGITS}
                        value={editPhone}
                        onChange={(e) => setEditPhone(sanitizePhoneInput(e.target.value))}
                        placeholder={t('customersPhone')}
                      />
                    ) : (
                      customer.phone || '-'
                    )}
                  </td>
                  <td className="px-3 py-3">{customer.loyaltyPoints ?? 0}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    CHF {Number(customer.totalSpent || 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-primary text-xs px-2 py-1"
                          disabled={saving}
                          onClick={() => void onUpdate(customer.id)}
                        >
                          {t('customersSave')}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs px-2 py-1"
                          disabled={saving}
                          onClick={cancelEdit}
                        >
                          {t('customersCancelEdit')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-secondary text-xs px-2 py-1"
                          disabled={saving}
                          onClick={() => startEdit(customer)}
                        >
                          {t('customersEdit')}
                        </button>
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          disabled={saving}
                          onClick={() => void onDelete(customer)}
                        >
                          {t('customersDelete')}
                        </button>
                      </div>
                    )}
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
