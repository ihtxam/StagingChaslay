import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Users, Lock, TrendingUp, DollarSign, UserCircle2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Stats {
  totalMerchants: number;
  activeLicenses: number;
  totalRevenue: number;
  platformGrowth: number;
  merchantUserCount?: number;
}

function normalizeOverview(raw: Record<string, unknown> | null | undefined): Stats {
  if (!raw) {
    return { totalMerchants: 0, activeLicenses: 0, totalRevenue: 0, platformGrowth: 0, merchantUserCount: 0 };
  }
  const merchants = raw.merchants as { total?: number } | undefined;
  const licenses = raw.licenses as { active?: number } | undefined;
  const orders = raw.orders as { totalRevenue?: number } | undefined;
  return {
    totalMerchants: Number(raw.totalMerchants ?? merchants?.total ?? 0),
    activeLicenses: Number(raw.activeLicenses ?? licenses?.active ?? 0),
    totalRevenue: Number(raw.totalRevenue ?? orders?.totalRevenue ?? 0),
    platformGrowth: Number(raw.platformGrowth ?? 0),
    merchantUserCount: Number(raw.merchantUserCount ?? 0),
  };
}

export default function Overview() {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/superadmin/analytics/overview');
        setStats(normalizeOverview(response.data.overview));
      } catch {
        toast.error(t('saDashLoadFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [t]);

  if (loading) {
    return <div className="text-center py-12">{t('loading')}</div>;
  }

  const statCards = [
    {
      label: t('saDashTotalMerchants'),
      value: stats?.totalMerchants || 0,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      label: t('saDashActiveLicenses'),
      value: stats?.activeLicenses || 0,
      icon: Lock,
      color: 'bg-green-500',
    },
    {
      label: t('saDashTotalRevenue'),
      value: `$${(stats?.totalRevenue || 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-purple-500',
    },
    {
      label: t('saDashMerchantUsers'),
      value: stats?.merchantUserCount || 0,
      icon: UserCircle2,
      color: 'bg-indigo-500',
    },
    {
      label: t('saDashGrowthRate'),
      value: `${stats?.platformGrowth || 0}%`,
      icon: TrendingUp,
      color: 'bg-orange-500',
    },
  ];

  const revenueData = [
    { month: 'Jan', revenue: 4000 },
    { month: 'Feb', revenue: 5200 },
    { month: 'Mar', revenue: 6100 },
    { month: 'Apr', revenue: 7500 },
    { month: 'May', revenue: 8200 },
    { month: 'Jun', revenue: 9100 },
  ];

  const distributionData = [
    { status: t('saDashActive'), count: 45 },
    { status: t('saDashTrial'), count: 12 },
    { status: t('saDashSuspended'), count: 3 },
    { status: t('saDashExpired'), count: 5 },
  ];

  const activity = [
    { action: t('saDashActNewMerchant'), time: t('saDashHoursAgo').replace('{n}', '2'), merchant: 'Acme Corp' },
    { action: t('saDashActLicenseExpired'), time: t('saDashHoursAgo').replace('{n}', '5'), merchant: 'Tech Store' },
    { action: t('saDashActPayment'), time: t('saDashDaysAgo').replace('{n}', '1'), merchant: 'Fashion Plus' },
    { action: t('saDashActLicenseRenewed'), time: t('saDashDaysAgo').replace('{n}', '2'), merchant: 'Coffee Shop' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">{card.label}</p>
                  <p className="text-2xl font-bold mt-2">{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">{t('saDashRevenueTrend')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" name={t('saDashRevenue')} stroke="#3b82f6" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">{t('saDashMerchantDistribution')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name={t('saDashCount')} fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">{t('saDashRecentActivity')}</h3>
        <div className="space-y-3">
          {activity.map((item, index) => (
            <div key={index} className="flex items-center justify-between py-3 border-b last:border-b-0">
              <div>
                <p className="font-medium">{item.action}</p>
                <p className="text-sm text-gray-600">{item.merchant}</p>
              </div>
              <p className="text-sm text-gray-500">{item.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
