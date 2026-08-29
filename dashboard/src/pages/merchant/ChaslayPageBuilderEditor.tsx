import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HomepageEditor } from '@/chaslay-pagebuilder';
import { getHomepageBuilder, updateHomepageBuilder, updateHomepageBuilderPage } from '@/lib/chaslay-pagebuilder/api';
import '@/chaslay-pagebuilder/chaslay-pagebuilder.css';

export default function ChaslayPageBuilderEditor() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = searchParams.get('id');

  const [initialState, setInitialState] = useState<string | null>(null);
  const [homepageName, setHomepageName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const currentPageIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!id) {
      navigate('/merchant/chaslay-page-builder', { replace: true });
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!id) return;
    const loadHomepage = async () => {
      setIsLoading(true);
      try {
        const response = await getHomepageBuilder(parseInt(id, 10));
        if (response.success && response.data) {
          setInitialState(response.data.editor_state);
          setHomepageName(response.data.name);
        } else {
          toast.error('Homepage not found');
          navigate('/merchant/chaslay-page-builder', { replace: true });
        }
      } catch {
        toast.error('Failed to load homepage');
        navigate('/merchant/chaslay-page-builder', { replace: true });
      } finally {
        setIsLoading(false);
      }
    };
    void loadHomepage();
  }, [id, navigate]);

  const handlePageChange = useCallback((pageId: number | null) => {
    currentPageIdRef.current = pageId;
  }, []);

  const handleSave = useCallback(
    async (state: string) => {
      if (!id || isSaving) return;
      setIsSaving(true);
      try {
        const builderId = parseInt(id, 10);
        const pageId = currentPageIdRef.current;
        if (pageId) {
          const response = await updateHomepageBuilderPage(builderId, pageId, { editor_state: state });
          if (response.success) toast.success('Page saved');
          else throw new Error(response.message || 'Failed to save');
        } else {
          const response = await updateHomepageBuilder(builderId, { editor_state: state });
          if (response.success) toast.success('Homepage saved');
          else throw new Error(response.message || 'Failed to save');
        }
      } catch {
        toast.error('Failed to save');
      } finally {
        setIsSaving(false);
      }
    },
    [id, isSaving]
  );

  if (!id || isLoading) {
    return createPortal(
      <div className="chaslay-pagebuilder-root fixed inset-0 z-[200] flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="chaslay-pagebuilder-root fixed inset-0 z-[200] bg-background">
      <HomepageEditor
        initialState={initialState}
        onSave={handleSave}
        homepageName={homepageName}
        builderId={parseInt(id, 10)}
        onPageChange={handlePageChange}
      />
    </div>,
    document.body
  );
}
