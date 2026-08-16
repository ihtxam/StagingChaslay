import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import type { ShopSelectedExtra } from '@/lib/shop-cart';
import {
  buildExtrasFromSelection,
  effectiveGroups,
  initialSelection,
  selectionFromExtras,
  productHasModifiers,
  productRequiresModifierModal,
  defaultConfiguredAdd,
  validateModifierGroups,
  type ShopModifierGroup,
  type ShopProductForModifiers,
} from '@/components/shop/shop-modifier-utils';
import WebPosModifierTabPanel from '@/components/webpos/WebPosModifierTabPanel';
import { translateModifierGroupTitle } from '@/components/webpos/webpos-modifier-utils';

export type { ShopModifierGroup, ShopProductForModifiers };
export { productHasModifiers, productRequiresModifierModal, defaultConfiguredAdd };

type Props = {
  product: ShopProductForModifiers;
  showProductImages?: boolean;
  initialSelectedExtras?: ShopSelectedExtra[];
  initialQuantity?: number;
  initialLineNote?: string;
  onClose: () => void;
  onConfirm: (payload: {
    selectedExtras: ShopSelectedExtra[];
    unitPrice: number;
    quantity: number;
    lineNote: string;
  }) => void;
};

export default function WebPosProductModifiersModal({
  product,
  showProductImages = false,
  initialSelectedExtras,
  initialQuantity = 1,
  initialLineNote = '',
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const groups = useMemo(() => effectiveGroups(product), [product]);
  const [selection, setSelection] = useState<Record<string, string[]>>(() =>
    initialSelectedExtras?.length
      ? selectionFromExtras(groups, initialSelectedExtras)
      : initialSelection(groups)
  );
  const [quantity, setQuantity] = useState(Math.max(1, initialQuantity));
  const [lineNote, setLineNote] = useState(initialLineNote);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    const err = validateModifierGroups(groups, selection, {
      chooseOne: (name) => t('shopChooseOptionFor').replace('{name}', name),
      chooseAtLeast: (n, name) =>
        t('shopChooseAtLeastOptions').replace('{n}', String(n)).replace('{name}', name),
      tooMany: (name) => t('shopTooManyOptions').replace('{name}', name),
      groupTitle: (title) => translateModifierGroupTitle(title, t),
    });
    if (err) {
      setError(err);
      return;
    }
    const selectedExtras = buildExtrasFromSelection(groups, selection);
    const extrasTotal = roundMoney2(selectedExtras.reduce((s, e) => s + e.price, 0));
    const unitPrice = roundMoney2(Number(product.price) + extrasTotal);
    onConfirm({ selectedExtras, unitPrice, quantity, lineNote: lineNote.trim() });
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40" onClick={onClose}>
      <WebPosModifierTabPanel
        title={product.name}
        showProductImages={showProductImages}
        groups={groups}
        selection={selection}
        onSelectionChange={(next) => {
          setError(null);
          setSelection(next);
        }}
        basePrice={Number(product.price) || 0}
        quantity={quantity}
        onQuantityChange={setQuantity}
        lineNote={lineNote}
        onLineNoteChange={setLineNote}
        onConfirm={handleConfirm}
        onDiscard={onClose}
        error={error}
      />
    </div>
  );
}
