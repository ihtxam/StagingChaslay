import { Navigate, useSearchParams } from 'react-router-dom';

const TAB_MAP: Record<string, string> = {
  items: 'items',
  cookbook: 'cookbook',
  stockin: 'inbound',
  waste: 'outbound',
  suppliers: 'suppliers',
  alerts: 'list',
  usage: 'consumption',
};

/** Legacy /merchant/inventory?tab=… → OrderPin-style routes. */
export default function Inventory() {
  const [params] = useSearchParams();
  const dest = TAB_MAP[params.get('tab') || ''] || 'list';
  return <Navigate to={`/merchant/inventory/${dest}`} replace />;
}
