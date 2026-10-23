import { Percent, Users, Wine } from 'lucide-react';

type IconKind = 'percent' | 'wine' | 'dine' | string | null | undefined;

export default function ReservationPromoIcon({
  kind,
  className = 'h-3.5 w-3.5',
}: {
  kind: IconKind;
  className?: string;
}) {
  if (kind === 'wine') {
    return <Wine className={className} aria-hidden />;
  }
  if (kind === 'dine') {
    return <Users className={className} aria-hidden />;
  }
  return <Percent className={className} aria-hidden />;
}
