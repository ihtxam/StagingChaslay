import { FormEvent, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { DragHandle, SortableContainer, SortableRow } from '@/components/SortableList';
import {
  CATEGORY_PALETTE,
  categoryColor,
  isValidHexColor,
  normalizeHexColor,
  paletteColorAt,
} from '@/components/webpos/categoryColors';

interface Category {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
}

const MAX_CATEGORY_NAME = 56;
const MAX_CATEGORY_DESC = 256;

export default function Categories() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [color, setColor] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allSelected = categories.length > 0 && categories.every((c) => selectedIds.includes(c.id));
  const someSelected = categories.some((c) => selectedIds.includes(c.id));

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allSelected) return prev.filter((id) => !categories.some((c) => c.id === id));
      return [...new Set([...prev, ...categories.map((c) => c.id)])];
    });
  };

  const load = async () => {
    try {
      const response = await api.get('/merchant/categories');
      setCategories(response.data.categories || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('categoryToastLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    setName('');
    setDescription('');
    setImageUrl('');
    setColor('');
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startEdit = (category: Category) => {
    const index = categories.findIndex((c) => c.id === category.id);
    setEditingId(category.id);
    setName(category.name);
    setDescription(category.description || '');
    setImageUrl(category.imageUrl || '');
    setColor(categoryColor(category.id, index >= 0 ? index : 0, category.color));
  };

  const onUploadImage = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const { compressImageIfNeeded } = await import('@/lib/compress-image');
      const compressed = await compressImageIfNeeded(file, {
        maxBytes: 350 * 1024,
        targetBytes: 350 * 1024,
        maxWidth: 1400,
      });
      const fd = new FormData();
      fd.append('file', compressed);
      const res = await api.post('/merchant/media', fd);
      setImageUrl(res.data.url);
      toast.success(t('imageUploaded'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const validateFields = () => {
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    if (!name.length) {
      toast.error(t('categoryNameRequired'));
      return null;
    }
    if (!trimmedName) {
      toast.error(t('categoryNameWhitespace'));
      return null;
    }
    if (trimmedName.length > MAX_CATEGORY_NAME) {
      toast.error(t('categoryNameTooLong'));
      return null;
    }
    if (description.length > MAX_CATEGORY_DESC || trimmedDesc.length > MAX_CATEGORY_DESC) {
      toast.error(t('categoryDescTooLong'));
      return null;
    }
    const trimmedColor = color.trim();
    if (trimmedColor && !isValidHexColor(trimmedColor)) {
      toast.error(t('categoryColorInvalid'));
      return null;
    }
    return {
      name: trimmedName,
      description: trimmedDesc || undefined,
      color: trimmedColor ? normalizeHexColor(trimmedColor) : undefined,
    };
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = validateFields();
    if (!payload) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/merchant/categories/${editingId}`, {
          name: payload.name,
          description: payload.description ?? '',
          imageUrl: imageUrl || null,
          color: payload.color,
        });
        toast.success(t('categoryToastUpdated'));
      } else {
        const created = await api.post('/merchant/categories', {
          name: payload.name,
          description: payload.description,
          color: payload.color,
        });
        if (imageUrl && created.data?.category?.id) {
          await api.put(`/merchant/categories/${created.data.category.id}`, {
            imageUrl,
          });
        }
        toast.success(t('categoryToastCreated'));
      }
      reset();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('categoryToastSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm(t('categoryDeleteConfirm'))) return;
    try {
      await api.delete(`/merchant/categories/${id}`);
      toast.success(t('categoryToastDeleted'));
      if (editingId === id) reset();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('categoryToastDeleteFailed'));
    }
  };

  const onReorder = async (next: Category[]) => {
    const prev = categories;
    setCategories(next);
    setReordering(true);
    try {
      const res = await api.put('/merchant/categories/reorder', {
        orderedIds: next.map((c) => c.id),
      });
      setCategories(res.data.categories || next);
    } catch (error: any) {
      setCategories(prev);
      toast.error(error.response?.data?.error || t('categoryToastReorderFailed'));
    } finally {
      setReordering(false);
    }
  };

  if (loading) return <div className="text-center py-12">{t('categoryLoading')}</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="card">
        <h1 className="page-title mb-1">{t('categories')}</h1>
        <p className="page-sub mb-3">
          {editingId ? t('editCategory') : t('manageCategories')}
        </p>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <div>
            <input
              className="input w-full"
              placeholder={t('name')}
              value={name}
              maxLength={MAX_CATEGORY_NAME}
              onChange={(e) => setName(e.target.value.slice(0, MAX_CATEGORY_NAME))}
              required
            />
            <p className="text-[11px] muted mt-1">
              {name.trim().length}/{MAX_CATEGORY_NAME}
            </p>
          </div>
          <div className="md:col-span-2">
            <input
              className="input w-full"
              placeholder={t('description')}
              value={description}
              maxLength={MAX_CATEGORY_DESC}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX_CATEGORY_DESC))}
            />
            <p className="text-[11px] muted mt-1">
              {description.trim().length}/{MAX_CATEGORY_DESC}
            </p>
          </div>
          <div className="md:col-span-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide muted">
              {t('categoryColor')}
            </p>
            <p className="mb-2 text-xs muted">{t('categoryColorHint')}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORY_PALETTE.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className={`h-7 w-7 rounded-full border ${
                    color.toLowerCase() === preset.toLowerCase()
                      ? 'border-[var(--text)] ring-1 ring-[var(--text)]'
                      : 'border-[var(--border)]'
                  }`}
                  style={{ backgroundColor: preset }}
                  title={preset}
                />
              ))}
              <input
                className="input w-28"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder={paletteColorAt(categories.length)}
              />
            </div>
          </div>
          <div className="md:col-span-3 flex flex-wrap items-center gap-3">
            <label className="text-sm">
              <span className="font-medium mr-2">{t('categoryPhoto')}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => void onUploadImage(e.target.files?.[0] || null)}
              />
            </label>
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-12 w-20 object-cover rounded border" />
            ) : null}
            {imageUrl ? (
              <button
                type="button"
                className="text-sm text-red-600"
                onClick={() => {
                  setImageUrl('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                {t('categoryRemovePhoto')}
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving || uploading}>
              {saving ? t('saving') : editingId ? t('save') : t('add')}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={reset}>
                {t('cancel')}
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card table-scroll !p-0">
        {categories.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-sm">
            <label className="inline-flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={toggleSelectAll}
              />
              {t('selectAll')}
            </label>
            {selectedIds.length > 0 ? (
              <span className="muted">{t('selectedCount').replace('{n}', String(selectedIds.length))}</span>
            ) : null}
            {selectedIds.length > 0 ? (
              <button type="button" className="text-sm underline muted" onClick={() => setSelectedIds([])}>
                {t('deselectAll')}
              </button>
            ) : null}
          </div>
        ) : null}
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-left border-b border-[var(--border)]">
              <th className="py-2 px-2 w-10" />
              <th className="py-2 px-2 w-10" />
              <th className="py-2 px-2">{t('name')}</th>
              <th className="py-2 px-2">{t('description')}</th>
              <th className="py-2 px-2" />
            </tr>
          </thead>
          <SortableContainer
            as="tbody"
            items={categories}
            onReorder={onReorder}
            disabled={reordering}
          >
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 px-3 muted">
                  {t('noCategoriesYet')}
                </td>
              </tr>
            )}
            {categories.map((category) => (
              <SortableRow
                key={category.id}
                id={category.id}
                as="tr"
                className="border-b border-[var(--border)] last:border-0 bg-[var(--bg-elevated)]"
                disabled={reordering}
              >
                {({ attributes, listeners }) => (
                  <>
                    <td className="py-2.5 px-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(category.id)}
                        onChange={() => toggleSelected(category.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <DragHandle attributes={attributes} listeners={listeners} />
                    </td>
                    <td className="py-2.5 px-2 font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 shrink-0 rounded-full border border-[var(--border)]"
                          style={{
                            backgroundColor: categoryColor(
                              category.id,
                              categories.findIndex((c) => c.id === category.id),
                              category.color
                            ),
                          }}
                        />
                        {category.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 muted">{category.description || '-'}</td>
                    <td className="py-2.5 px-2 text-right space-x-3 whitespace-nowrap">
                      <button
                        type="button"
                        className="text-sm text-sky-700 hover:underline dark:text-sky-300"
                        onClick={() => startEdit(category)}
                      >
                        {t('edit')}
                      </button>
                      <button
                        type="button"
                        className="text-sm text-[var(--danger)] hover:underline"
                        onClick={() => void onDelete(category.id)}
                      >
                        {t('delete')}
                      </button>
                    </td>
                  </>
                )}
              </SortableRow>
            ))}
          </SortableContainer>
        </table>
      </div>
    </div>
  );
}
