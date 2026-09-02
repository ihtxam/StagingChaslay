import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Layout, Plus, Edit2, Trash2, Loader2, Pencil, Check } from 'lucide-react';
import {
  activateHomepageBuilder,
  createHomepageBuilder,
  deactivateHomepageBuilder,
  deleteHomepageBuilder,
  getHomepageBuilders,
  updateHomepageBuilder,
  type HomepageBuilderListItem,
} from '@/lib/chaslay-pagebuilder/api';
import { TemplateGallery } from '@/chaslay-pagebuilder/TemplateGallery';
import '@/chaslay-pagebuilder/chaslay-pagebuilder.css';
import { useAuthStore } from '@/store/auth';
import { shopBasePath } from '@/lib/shop-cart';

export default function ChaslayPageBuilderList() {
  const navigate = useNavigate();
  const merchantSlug = useAuthStore((s) => s.user?.slug || s.user?.subdomain || '');
  const shopPreviewPath = merchantSlug ? shopBasePath(merchantSlug) || `/shop/${merchantSlug}` : '';
  const [isLoading, setIsLoading] = useState(true);
  const [homepages, setHomepages] = useState<HomepageBuilderListItem[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [renamingHomepage, setRenamingHomepage] = useState<HomepageBuilderListItem | null>(null);
  const [editName, setEditName] = useState('');
  const [activatingHomepage, setActivatingHomepage] = useState<HomepageBuilderListItem | null>(null);
  const [deactivatingHomepage, setDeactivatingHomepage] = useState<HomepageBuilderListItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    void fetchHomepages();
  }, []);

  async function fetchHomepages() {
    setIsLoading(true);
    try {
      const response = await getHomepageBuilders();
      if (response.success && response.data) setHomepages(response.data);
    } catch {
      toast.error('Failed to load homepage builders');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(name: string, editorState?: string) {
    setIsSaving(true);
    try {
      const response = await createHomepageBuilder(name, editorState);
      if (response.success && response.data) {
        toast.success('Homepage created');
        setIsCreateDialogOpen(false);
        navigate(`/merchant/chaslay-page-builder/edit?id=${response.data.id}`);
      } else {
        toast.error(response.message || 'Failed to create homepage');
      }
    } catch {
      toast.error('Failed to create homepage');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRename() {
    if (!renamingHomepage || !editName.trim()) return;
    setIsSaving(true);
    try {
      const response = await updateHomepageBuilder(renamingHomepage.id, { name: editName.trim() });
      if (response.success) {
        setHomepages((prev) =>
          prev.map((h) => (h.id === renamingHomepage.id ? { ...h, name: editName.trim() } : h))
        );
        toast.success('Renamed');
        setRenamingHomepage(null);
        setEditName('');
      } else {
        toast.error(response.message || 'Failed to rename');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: number) {
    const response = await deleteHomepageBuilder(id);
    if (response.success) {
      setHomepages((prev) => prev.filter((h) => h.id !== id));
      toast.success('Deleted');
    } else {
      toast.error(response.message || 'Failed to delete');
    }
    setDeletingId(null);
  }

  return (
    <div className="chaslay-pagebuilder-root p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Website</h1>
          <p className="text-sm text-muted-foreground">
            Design your online shop with drag-and-drop blocks. <strong>Set active</strong> once per layout to publish it — new pages inside that layout go live when you save in the editor (no need to set active again).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {shopPreviewPath ? (
            <a
              href={shopPreviewPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm"
            >
              View shop
            </a>
          ) : null}
          <button
          type="button"
          onClick={() => setIsCreateDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          New homepage
        </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : homepages.length === 0 ? (
        <div className="text-center py-16 border rounded-lg">
          <Layout className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">No homepages yet</p>
          <button
            type="button"
            onClick={() => setIsCreateDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Create homepage
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {homepages.map((homepage) => (
            <div
              key={homepage.id}
              className={`rounded-lg border p-4 flex items-center justify-between gap-4 ${!homepage.is_active ? 'opacity-75' : ''}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Layout className={`h-5 w-5 shrink-0 ${homepage.is_active ? 'text-green-600' : 'text-muted-foreground'}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{homepage.name}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setRenamingHomepage(homepage);
                        setEditName(homepage.name);
                      }}
                      title="Rename"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {homepage.is_active && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Active</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(homepage.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {homepage.is_active ? (
                  <button
                    type="button"
                    className="text-xs border rounded px-2 py-1 inline-flex items-center gap-1"
                    onClick={() => setDeactivatingHomepage(homepage)}
                  >
                    <Check className="h-3.5 w-3.5" /> Live
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-xs border rounded px-2 py-1"
                    onClick={() => setActivatingHomepage(homepage)}
                  >
                    Set active
                  </button>
                )}
                <Link
                  to={`/merchant/chaslay-page-builder/edit?id=${homepage.id}`}
                  className="p-2 rounded hover:bg-muted"
                  title="Edit"
                >
                  <Edit2 className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  className="p-2 rounded text-red-600 hover:bg-red-50"
                  onClick={() => setDeletingId(homepage.id)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateGallery
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreate}
        isSaving={isSaving}
      />

      {renamingHomepage && (
        <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg border p-6 w-full max-w-md space-y-4">
            <h2 className="font-semibold">Rename homepage</h2>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleRename()}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-1.5 text-sm border rounded" onClick={() => setRenamingHomepage(null)}>
                Cancel
              </button>
              <button type="button" className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded" onClick={() => void handleRename()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {activatingHomepage && (
        <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg border p-6 w-full max-w-md space-y-4">
            <p>Activate &ldquo;{activatingHomepage.name}&rdquo;? This publishes the whole layout (all pages in it). Other layouts will be deactivated.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-1.5 text-sm border rounded" onClick={() => setActivatingHomepage(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded"
                onClick={async () => {
                  const res = await activateHomepageBuilder(activatingHomepage.id);
                  if (res.success) {
                    setHomepages((prev) => prev.map((h) => ({ ...h, is_active: h.id === activatingHomepage.id })));
                    toast.success('Homepage published on your shop');
                    if (shopPreviewPath) {
                      window.open(shopPreviewPath, '_blank', 'noopener,noreferrer');
                    }
                  } else {
                    toast.error(res.message || 'Failed to activate');
                  }
                  setActivatingHomepage(null);
                }}
              >
                Activate
              </button>
            </div>
          </div>
        </div>
      )}

      {deactivatingHomepage && (
        <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg border p-6 w-full max-w-md space-y-4">
            <p>Deactivate &ldquo;{deactivatingHomepage.name}&rdquo;?</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-1.5 text-sm border rounded" onClick={() => setDeactivatingHomepage(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded"
                onClick={async () => {
                  const res = await deactivateHomepageBuilder(deactivatingHomepage.id);
                  if (res.success) {
                    setHomepages((prev) =>
                      prev.map((h) => (h.id === deactivatingHomepage.id ? { ...h, is_active: false } : h))
                    );
                    toast.success('Deactivated');
                  }
                  setDeactivatingHomepage(null);
                }}
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingId != null && (
        <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg border p-6 w-full max-w-md space-y-4">
            <p>Delete this homepage permanently?</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-1.5 text-sm border rounded" onClick={() => setDeletingId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded"
                onClick={() => void handleDelete(deletingId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
