import { Trash2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

const DELETE_WIDTH = 76;
const SWIPE_START_PX = 10;
const DELETE_THRESHOLD = DELETE_WIDTH * 0.45;

type Props = {
  lineId: string;
  disabled?: boolean;
  onRemove: () => void;
  onSelect: (e: React.MouseEvent | React.PointerEvent) => void;
  selected: boolean;
  sentToKitchen?: boolean;
  children: React.ReactNode;
};

export default function WebPosSwipeableCartLine({
  lineId,
  disabled = false,
  onRemove,
  onSelect,
  selected,
  sentToKitchen = false,
  children,
}: Props) {
  const { t } = useI18n();
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const swipedRef = useRef(false);
  const activePointerRef = useRef<number | null>(null);

  const resetSwipe = useCallback(() => {
    setOffsetX(0);
    setDragging(false);
    swipedRef.current = false;
    activePointerRef.current = null;
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.pointerType === 'mouse') return;
    if (activePointerRef.current != null) return;
    activePointerRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startOffsetRef.current = offsetX;
    swipedRef.current = false;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || activePointerRef.current !== e.pointerId) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > SWIPE_START_PX) {
      swipedRef.current = true;
      if (Math.abs(dx) > Math.abs(e.movementY) * 1.2) {
        e.preventDefault();
      }
    }
    const next = Math.min(0, Math.max(-DELETE_WIDTH, startOffsetRef.current + dx));
    setOffsetX(next);
  };

  const finishSwipe = (clientX: number) => {
    const dx = clientX - startXRef.current;
    const finalOffset = Math.min(0, Math.max(-DELETE_WIDTH, startOffsetRef.current + dx));
    if (finalOffset <= -DELETE_THRESHOLD) {
      onRemove();
      resetSwipe();
      return;
    }
    resetSwipe();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    finishSwipe(e.clientX);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    resetSwipe();
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (swipedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      swipedRef.current = false;
      return;
    }
    onSelect(e);
  };

  return (
    <div
      key={lineId}
      className="relative overflow-hidden rounded-lg"
      style={{ touchAction: 'pan-y' }}
    >
      <div
        aria-hidden
        className={`absolute inset-y-0 right-0 flex items-center justify-center bg-red-600 text-white transition-opacity ${
          offsetX < 0 ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ width: DELETE_WIDTH }}
      >
        <span className="flex flex-col items-center gap-0.5 px-2 text-[10px] font-bold uppercase tracking-wide">
          <Trash2 size={18} strokeWidth={2.25} />
          {t('webPosRemoveItem')}
        </span>
      </div>

      <div
        className={`relative bg-white ${dragging ? '' : 'transition-transform duration-200 ease-out'}`}
        style={{ transform: `translateX(${offsetX}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <button
          type="button"
          onClick={handleClick}
          className={`w-full rounded-lg px-2 py-2 text-left transition ${
            selected
              ? 'bg-[var(--webpos-accent-softer)] ring-2 ring-[var(--webpos-accent-ring)]'
              : 'hover:bg-stone-50'
          } ${sentToKitchen ? 'opacity-80' : ''}`}
        >
          {children}
        </button>
      </div>
    </div>
  );
}
