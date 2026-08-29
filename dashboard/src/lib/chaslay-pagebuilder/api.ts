import api from '@/lib/api';
import { DEFAULT_EMPTY_CANVAS_STATE } from '@/chaslay-pagebuilder/constants';

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export interface HomepageBuilderListItem {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HomepageBuilderData {
  id: number;
  name: string;
  editor_state: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HomepageBuilderPageData {
  id?: number;
  homepage_builder_id: number;
  title: string;
  slug: string;
  editor_state: string | null;
  is_homepage: boolean;
  sort_order: number;
}

async function unwrap<T>(promise: Promise<{ data: unknown }>): Promise<ApiResponse<T>> {
  try {
    const res = await promise;
    const body = res.data as { success?: boolean; data?: T; error?: string; message?: string };
    if (body && typeof body === 'object' && 'success' in body) {
      return {
        success: !!body.success,
        data: body.data as T,
        message: body.message || body.error,
      };
    }
    return { success: true, data: body as T };
  } catch (err: unknown) {
    const message =
      err && typeof err === 'object' && 'response' in err
        ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Request failed')
        : 'Request failed';
    return { success: false, message };
  }
}

export async function getHomepageBuilders(): Promise<ApiResponse<HomepageBuilderListItem[]>> {
  return unwrap(api.get('/merchant/chaslay-pagebuilder'));
}

export async function getHomepageBuilder(id: number): Promise<ApiResponse<HomepageBuilderData>> {
  return unwrap(api.get(`/merchant/chaslay-pagebuilder/${id}`));
}

export async function getActiveHomepageBuilder(): Promise<ApiResponse<HomepageBuilderData | null>> {
  return unwrap(api.get('/merchant/chaslay-pagebuilder/active'));
}

export async function createHomepageBuilder(
  name: string,
  editorState?: string
): Promise<ApiResponse<HomepageBuilderData>> {
  const trimmed = editorState?.trim();
  const state = trimmed && trimmed !== '{}' ? trimmed : DEFAULT_EMPTY_CANVAS_STATE;
  return unwrap(api.post('/merchant/chaslay-pagebuilder', { name, editor_state: state }));
}

export async function updateHomepageBuilder(
  id: number,
  data: { name?: string; editor_state?: string }
): Promise<ApiResponse<HomepageBuilderData>> {
  const payload = { ...data };
  if (payload.editor_state !== undefined) {
    const trimmed = payload.editor_state.trim();
    payload.editor_state = trimmed && trimmed !== '{}' ? trimmed : DEFAULT_EMPTY_CANVAS_STATE;
  }
  return unwrap(api.put(`/merchant/chaslay-pagebuilder/${id}`, payload));
}

export async function deleteHomepageBuilder(id: number): Promise<ApiResponse<void>> {
  return unwrap(api.delete(`/merchant/chaslay-pagebuilder/${id}`));
}

export async function activateHomepageBuilder(
  id: number
): Promise<ApiResponse<{ id: number; name: string; is_active: boolean }>> {
  return unwrap(api.post(`/merchant/chaslay-pagebuilder/${id}/activate`));
}

export async function deactivateHomepageBuilder(
  id: number
): Promise<ApiResponse<{ id: number; name: string; is_active: boolean }>> {
  return unwrap(api.post(`/merchant/chaslay-pagebuilder/${id}/deactivate`));
}

export async function getHomepageBuilderPages(
  builderId: number
): Promise<ApiResponse<HomepageBuilderPageData[]>> {
  return unwrap(api.get(`/merchant/chaslay-pagebuilder/${builderId}/pages`));
}

export async function createHomepageBuilderPage(
  builderId: number,
  data: {
    title: string;
    slug: string;
    editor_state: string | null;
    sort_order: number;
    is_homepage: boolean;
  }
): Promise<ApiResponse<HomepageBuilderPageData>> {
  return unwrap(api.post(`/merchant/chaslay-pagebuilder/${builderId}/pages`, data));
}

export async function updateHomepageBuilderPage(
  builderId: number,
  pageId: number,
  data: Partial<{
    title: string;
    slug: string;
    editor_state: string;
    sort_order: number;
    is_homepage: boolean;
  }>
): Promise<ApiResponse<HomepageBuilderPageData>> {
  const payload = { ...data };
  if (payload.editor_state !== undefined) {
    const trimmed = payload.editor_state.trim();
    payload.editor_state = trimmed && trimmed !== '{}' ? trimmed : DEFAULT_EMPTY_CANVAS_STATE;
  }
  return unwrap(api.put(`/merchant/chaslay-pagebuilder/${builderId}/pages/${pageId}`, payload));
}

export async function deleteHomepageBuilderPage(
  builderId: number,
  pageId: number
): Promise<ApiResponse<void>> {
  return unwrap(api.delete(`/merchant/chaslay-pagebuilder/${builderId}/pages/${pageId}`));
}

/** Menu/catalog data for builder blocks */
export interface ChaslayCategory {
  id: string;
  name: string;
}

export interface ChaslayProduct {
  id: string;
  name: string;
  price?: number;
  imageUrl?: string | null;
  categoryId?: string | null;
}

export async function getCategories(): Promise<ApiResponse<ChaslayCategory[]>> {
  const res = await unwrap<{ categories: ChaslayCategory[]; products?: ChaslayProduct[] }>(
    api.get('/merchant/cms/catalog')
  );
  if (!res.success) return { success: false, message: res.message };
  return { success: true, data: res.data?.categories ?? [] };
}

export async function getProducts(_opts?: {
  per_page?: number;
  status?: number;
}): Promise<ApiResponse<{ products: ChaslayProduct[] }>> {
  const res = await unwrap<{
    categories: ChaslayCategory[];
    products: Array<{
      id: string;
      name: string;
      categoryId?: string | null;
      price?: number;
      image?: string | null;
    }>;
  }>(api.get('/merchant/cms/catalog'));
  if (!res.success) return { success: false, message: res.message };
  const products = (res.data?.products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    imageUrl: p.image ?? null,
    categoryId: p.categoryId ?? null,
  }));
  return { success: true, data: { products } };
}

export async function getBusinessInfo(): Promise<ApiResponse<{ selected_language?: { code: string; is_default: number }[] }>> {
  return unwrap(api.get('/merchant/settings'));
}
