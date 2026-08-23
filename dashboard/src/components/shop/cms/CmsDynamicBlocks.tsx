import axios from 'axios';
import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { parseIdList } from '@/lib/cms/split-openpage-html';

export type CmsMenuCategory = {
  id: string;
  name: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    description?: string;
    image?: string;
    categoryId?: string | null;
  }>;
};

type MenuProps = {
  title?: string;
  mode?: 'featured' | 'categories' | 'full';
  categoryIds?: string[];
  productIds?: string[];
  showPrices?: boolean;
  limit?: number;
  viewAllText?: string;
  viewAllUrl?: string;
};

export function CmsMenuBlock({
  props,
  base,
  menu,
  money,
}: {
  props: MenuProps;
  base: string;
  menu?: { categories: CmsMenuCategory[] } | null;
  money: (n: number) => string;
}) {
  const { t } = useI18n();
  const categories = menu?.categories || [];
  const mode = props.mode || 'featured';
  const limit = Math.min(48, Math.max(1, Number(props.limit) || 8));
  const showPrices = props.showPrices !== false && String(props.showPrices) !== 'false';
  const catFilter = new Set(parseIdList(props.categoryIds));
  const prodFilter = new Set(parseIdList(props.productIds));

  let products: CmsMenuCategory['items'] = [];
  for (const cat of categories) {
    if (mode === 'categories' && catFilter.size && !catFilter.has(cat.id)) continue;
    for (const item of cat.items || []) {
      if (prodFilter.size && !prodFilter.has(item.id)) continue;
      products.push({ ...item, categoryId: cat.id });
    }
  }
  if (mode === 'featured' && !prodFilter.size && !catFilter.size) {
    products = categories.flatMap((c) => c.items || []).slice(0, limit);
  } else if (mode !== 'full') {
    products = products.slice(0, limit);
  }

  const viewAll = props.viewAllUrl || `${base}/menu`;
  const viewAllLabel = props.viewAllText || t('cmsGoToMenu');

  if (!products.length) {
    return (
      <section className="px-6 py-10 md:px-10 md:py-14" style={{ background: 'var(--color-bg-0)' }}>
        <div className="mx-auto max-w-7xl text-center text-sm" style={{ color: 'var(--color-text-2)' }}>
          {t('shopNoItems')}
        </div>
      </section>
    );
  }

  if (mode === 'full') {
    return (
      <section className="px-6 py-10 md:px-10 md:py-14" style={{ background: 'var(--color-bg-0)' }}>
        <div className="mx-auto max-w-7xl space-y-10">
          {categories
            .filter((c) => !catFilter.size || catFilter.has(c.id))
            .map((cat) => {
              const items = (cat.items || []).filter((i) => !prodFilter.size || prodFilter.has(i.id));
              if (!items.length) return null;
              return (
                <div key={cat.id}>
                  <h2
                    className="mb-4 text-xl font-semibold tracking-tight md:text-2xl"
                    style={{ color: 'var(--color-text-0)' }}
                  >
                    {cat.name}
                  </h2>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex gap-3 rounded-xl border p-3"
                        style={{
                          borderColor: 'var(--color-border-default)',
                          background: 'var(--color-bg-1)',
                        }}
                      >
                        {item.image ? (
                          <img
                            src={item.image}
                            alt=""
                            className="h-16 w-16 shrink-0 rounded-lg object-cover"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium" style={{ color: 'var(--color-text-0)' }}>
                            {item.name}
                          </p>
                          {item.description ? (
                            <p
                              className="mt-0.5 line-clamp-2 text-xs"
                              style={{ color: 'var(--color-text-2)' }}
                            >
                              {item.description}
                            </p>
                          ) : null}
                          {showPrices ? (
                            <p
                              className="mt-1 text-sm font-semibold tabular-nums"
                              style={{ color: 'var(--color-green)' }}
                            >
                              {money(item.price)}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          <div className="text-center">
            <Link to={viewAll} className="shop-btn-primary inline-flex px-5 py-2.5 text-sm font-semibold">
              {viewAllLabel}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 py-10 md:px-10 md:py-14" style={{ background: 'var(--color-bg-0)' }}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2
            className="text-xl font-semibold tracking-tight md:text-2xl"
            style={{ color: 'var(--color-text-0)' }}
          >
            {props.title || t('cmsMenuFeatured')}
          </h2>
          <Link to={viewAll} className="text-sm font-medium" style={{ color: 'var(--color-text-2)' }}>
            {viewAllLabel}
          </Link>
        </div>
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          {products.map((item) => (
            <Link key={item.id} to={viewAll} className="w-44 shrink-0 snap-start md:w-52">
              <div
                className="mb-2 aspect-[4/5] overflow-hidden rounded-2xl border"
                style={{ borderColor: 'var(--color-border-default)', background: 'var(--color-bg-2)' }}
              >
                {item.image ? (
                  <img src={item.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-stone-200 to-stone-300" />
                )}
              </div>
              <p className="truncate text-sm font-medium" style={{ color: 'var(--color-text-0)' }}>
                {item.name}
              </p>
              {showPrices ? (
                <p className="mt-0.5 text-xs tabular-nums" style={{ color: 'var(--color-text-2)' }}>
                  {money(item.price)}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

type HoursProps = {
  title?: string;
  channel?: 'takeaway' | 'dine_in' | 'delivery' | 'all';
  showOpenBadge?: boolean;
};

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_I18N: Record<(typeof DAY_KEYS)[number], string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

function slotsLabel(slots: Array<{ open: string; close: string }> | undefined, closed: string) {
  if (!slots?.length) return closed;
  return slots.map((s) => `${s.open}–${s.close}`).join(', ');
}

export function CmsHoursBlock({
  props,
  storeHours,
}: {
  props: HoursProps;
  storeHours?: StoreHours | null;
}) {
  const { t } = useI18n();
  const hours = storeHours || {};
  const channel = props.channel || 'all';
  const channels =
    channel === 'all' ? (['takeaway', 'dine_in', 'delivery'] as const) : ([channel] as const);
  const closedLabel = t('shopClosed');
  const openNow = channels.some((ch) => isChannelOpenAt(hours, ch, new Date()).open);

  return (
    <section className="px-6 py-10 md:px-10 md:py-14" style={{ background: 'var(--color-bg-1)' }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold md:text-2xl" style={{ color: 'var(--color-text-0)' }}>
            {props.title || t('shopOpeningHours')}
          </h2>
          {props.showOpenBadge !== false ? (
            <span
              className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
              style={{
                background: openNow ? 'rgba(var(--color-accent-rgb), 0.15)' : 'var(--color-bg-2)',
                color: openNow ? 'var(--color-green)' : 'var(--color-text-2)',
              }}
            >
              {openNow ? t('shopOpenNow') : t('shopClosedNow')}
            </span>
          ) : null}
        </div>
        <div className="space-y-4">
          {channels.map((ch) => {
            const chHours = hours[ch] || {};
            return (
              <div
                key={ch}
                className="rounded-xl border p-4"
                style={{ borderColor: 'var(--color-border-default)', background: 'var(--color-bg-0)' }}
              >
                <p
                  className="mb-2 text-sm font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--color-text-1)' }}
                >
                  {ch === 'takeaway' ? t('takeaway') : ch === 'dine_in' ? t('dineIn') : t('delivery')}
                </p>
                <ul className="space-y-1 text-sm" style={{ color: 'var(--color-text-0)' }}>
                  {DAY_KEYS.map((day) => {
                    const slots = chHours[day];
                    return (
                      <li key={day} className="flex justify-between gap-3">
                        <span style={{ color: dayKeyOf(new Date()) === day ? 'var(--color-green)' : undefined }}>
                          {DAY_I18N[day]}
                        </span>
                        <span className="tabular-nums">{slotsLabel(slots, closedLabel)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type ReservationProps = {
  title?: string;
};

export function CmsReservationsBlock({
  props,
  base,
  reservationsEnabled,
}: {
  props: ReservationProps;
  base: string;
  reservationsEnabled?: boolean;
}) {
  const { t } = useI18n();
  if (!reservationsEnabled) return null;

  return (
    <section className="px-6 py-10 md:px-10 md:py-14" style={{ background: 'var(--color-bg-0)' }}>
      <div
        className="mx-auto max-w-xl rounded-2xl border p-6 text-center shadow-sm"
        style={{ borderColor: 'var(--color-border-default)', background: 'var(--color-bg-1)' }}
      >
        <h2 className="text-xl font-semibold md:text-2xl" style={{ color: 'var(--color-text-0)' }}>
          {props.title || t('shopReservations')}
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-2)' }}>
          {t('reservationsEmbedHint')}
        </p>
        <Link
          to={`${base}/reservations`}
          className="shop-btn-primary mt-5 inline-flex px-6 py-3 text-sm font-semibold"
        >
          {t('shopBookTable')}
        </Link>
      </div>
    </section>
  );
}

export function CmsFeaturedPosBlock({
  props,
  base,
  menu,
  money,
}: {
  props: { title?: string; productIds?: string[]; showPrices?: boolean; viewAllText?: string; viewAllUrl?: string };
  base: string;
  menu?: { categories: CmsMenuCategory[] } | null;
  money: (n: number) => string;
}) {
  const ids = new Set(parseIdList(props.productIds));
  const products = (menu?.categories || [])
    .flatMap((c) => c.items || [])
    .filter((p) => ids.has(p.id));
  return (
    <CmsMenuBlock
      props={{
        title: props.title,
        mode: 'featured',
        productIds: [...ids],
        showPrices: props.showPrices,
        viewAllText: props.viewAllText,
        viewAllUrl: props.viewAllUrl,
      }}
      base={base}
      menu={{ categories: [{ id: '_', name: '', items: products }] }}
      money={money}
    />
  );
}

export function CmsDynamicBlock({
  blockType,
  props: blockProps,
  base,
  menu,
  storeHours,
  reservationsEnabled,
  money,
}: {
  blockType: string;
  props: Record<string, unknown>;
  base: string;
  menu?: { categories: CmsMenuCategory[] } | null;
  storeHours?: StoreHours | null;
  reservationsEnabled?: boolean;
  money: (n: number) => string;
}) {
  if (blockType === 'menu') {
    return <CmsMenuBlock props={blockProps as MenuProps} base={base} menu={menu} money={money} />;
  }
  if (blockType === 'hours') {
    return <CmsHoursBlock props={blockProps as HoursProps} storeHours={storeHours} />;
  }
  if (blockType === 'reservations') {
    return (
      <CmsReservationsBlock
        props={blockProps as ReservationProps}
        base={base}
        reservationsEnabled={reservationsEnabled}
      />
    );
  }
  if (blockType === 'featured') {
    const fp = {
      ...blockProps,
      productIds: parseIdList(blockProps.productIds),
    };
    return (
      <CmsFeaturedPosBlock
        props={fp as { title?: string; productIds?: string[]; showPrices?: boolean }}
        base={base}
        menu={menu}
        money={money}
      />
    );
  }
  return null;
}

export async function fetchCmsMenuCatalog(
  shopKey: string
): Promise<{ categories: CmsMenuCategory[] } | null> {
  try {
    const res = await axios.get(`/api/shop/${encodeURIComponent(shopKey)}/menu`);
    return { categories: res.data?.data?.categories || res.data?.categories || [] };
  } catch {
    return null;
  }
}
