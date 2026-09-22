import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

type DnsRecord = {
  id: string;
  purpose: string;
  type: string;
  host: string;
  value: string;
  required: boolean;
  notes?: string;
};

type DnsGuide = {
  fromEmail: string;
  sendingDomain: string;
  apexDomain: string;
  postalSubdomain: string | null;
  isPostalFromAddress: boolean;
  postalIp: string;
  postalSpfInclude: string;
  records: DnsRecord[];
  recommendations: string[];
};

type Props = {
  fromEmail: string;
};

function recordZone(record: DnsRecord, guide: DnsGuide): string {
  if (record.id === 'postal-spf' || record.id === 'postal-ns') {
    return guide.postalSubdomain || `psrp.${guide.apexDomain}`;
  }
  return guide.apexDomain;
}

export default function MailcoDnsChecklist({ fromEmail }: Props) {
  const [guide, setGuide] = useState<DnsGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const email = fromEmail.trim();
    if (!email) {
      setGuide(null);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/superadmin/platform-settings/mailco/dns-guide', {
        params: { fromEmail: email },
      });
      setGuide(data.guide as DnsGuide);
    } catch (err: unknown) {
      setGuide(null);
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error || '')
          : '';
      setError(msg || (err instanceof Error ? err.message : 'Failed to load DNS guide'));
    } finally {
      setLoading(false);
    }
  }, [fromEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyValue = async (id: string, text: string) => {
    if (!text || text.startsWith('(')) {
      toast.error('Copy the exact value from ees.mailco.ch first');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success('Copied');
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  if (!fromEmail.trim()) {
    return (
      <p className="text-sm text-gray-600 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        Enter a <strong>From email</strong> below to see the DNS checklist for that sending domain.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-4 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Mailco DNS checklist</h3>
          <p className="text-sm text-gray-600 mt-1">
            Add these records at your domain registrar or in Mailco Postal when NS is delegated. DNS
            is not changed by this app — copy each value and publish it where your DNS is hosted.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <a
            className="btn btn-secondary text-sm inline-flex items-center gap-1"
            href="https://ees.mailco.ch"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            ees.mailco.ch
          </a>
          <button
            type="button"
            className="btn btn-secondary text-sm inline-flex items-center gap-1"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {loading && !guide ? <p className="text-sm text-gray-500">Loading DNS guide…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {guide ? (
        <>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-gray-500">From address:</span>{' '}
              <code className="text-xs bg-white px-1 rounded border">{guide.fromEmail}</code>
            </p>
            <p>
              <span className="text-gray-500">Brand / apex domain:</span>{' '}
              <code className="text-xs bg-white px-1 rounded border">{guide.apexDomain}</code>
            </p>
            {guide.postalSubdomain ? (
              <p>
                <span className="text-gray-500">Postal return-path subdomain:</span>{' '}
                <code className="text-xs bg-white px-1 rounded border">{guide.postalSubdomain}</code>
                {' '}
                <span className="text-gray-500">· relay IP {guide.postalIp}</span>
              </p>
            ) : null}
          </div>

          {guide.isPostalFromAddress ? (
            <p className="text-sm rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
              <strong>Deliverability tip:</strong> mail-tester flagged SPF because the From domain is
              the Postal subdomain. Use <code>noreply@{guide.apexDomain}</code> (or another address on{' '}
              {guide.apexDomain}) as the platform From email once DNS below is verified.
            </p>
          ) : null}

          {guide.recommendations.length > 0 ? (
            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
              {guide.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-4">
            {guide.records.map((record) => {
              const zone = recordZone(record, guide);
              const copyKey = `${record.id}-${zone}`;
              const canCopy = record.value && !record.value.startsWith('(');
              return (
                <div
                  key={copyKey}
                  className="rounded-md border border-gray-200 bg-white p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {record.purpose}
                      {record.required ? (
                        <span className="ml-2 text-xs font-normal text-red-700">Required</span>
                      ) : (
                        <span className="ml-2 text-xs font-normal text-gray-500">Optional</span>
                      )}
                    </p>
                    <span className="text-xs text-gray-500 font-mono">{zone}</span>
                  </div>
                  <table className="w-full text-xs border border-gray-200">
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <th className="bg-gray-50 px-2 py-1.5 text-left font-medium w-20">Type</th>
                        <td className="px-2 py-1.5 font-mono">{record.type}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <th className="bg-gray-50 px-2 py-1.5 text-left font-medium">Host</th>
                        <td className="px-2 py-1.5 font-mono">{record.host}</td>
                      </tr>
                      <tr>
                        <th className="bg-gray-50 px-2 py-1.5 text-left font-medium align-top">
                          Value
                        </th>
                        <td className="px-2 py-1.5">
                          <div className="flex flex-wrap items-start gap-2">
                            <code className="break-all flex-1 min-w-0">{record.value}</code>
                            {canCopy ? (
                              <button
                                type="button"
                                className="btn btn-secondary text-xs inline-flex items-center gap-1 shrink-0"
                                onClick={() => void copyValue(copyKey, record.value)}
                              >
                                {copiedId === copyKey ? (
                                  <Check className="h-3.5 w-3.5" aria-hidden />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" aria-hidden />
                                )}
                                Copy
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {record.notes ? <p className="text-xs text-gray-500">{record.notes}</p> : null}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-500">
            Root domain <strong>{guide.apexDomain}</strong> should include Mailco in SPF (
            <code>include:{guide.postalSpfInclude}</code>) when sending from{' '}
            <code>*@{guide.apexDomain}</code>. The Postal subdomain{' '}
            <code>{guide.postalSubdomain}</code> needs its own SPF with the relay IP — this fixes{' '}
            <code>SPF_NONE</code> when the envelope/return-path uses that host.
          </p>
        </>
      ) : null}
    </div>
  );
}
