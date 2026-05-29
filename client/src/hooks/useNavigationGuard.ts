import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWikiStore } from '@/stores/wiki';

/**
 * Navigation guard hook for traditional React Router (BrowserRouter + Routes).
 *
 * This hook implements navigation blocking without using `useBlocker` (which requires data router).
 * It listens to location changes and temporarily redirects back when navigation is blocked.
 *
 * @returns {Object} { showDialog, onConfirm, onCancel }
 */
export function useNavigationGuard() {
  const [showDialog, setShowDialog] = useState(false);
  const isDirty = useWikiStore((s) => s.isDirty);
  const location = useLocation();
  const navigate = useNavigate();
  const currentPathRef = useRef<string>(location.pathname);
  const targetPathRef = useRef<string | null>(null);

  // beforeunload event listener for browser refresh/close protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useWikiStore.getState().isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Navigation guard for in-app route changes
  useEffect(() => {
    // Skip check if we just confirmed navigation (targetPathRef is set)
    if (targetPathRef.current !== null) {
      return;
    }

    // Check if user is trying to navigate away with unsaved changes
    if (isDirty && location.pathname !== currentPathRef.current) {
      // Navigation attempted - show dialog and remember target
      targetPathRef.current = location.pathname;
      setShowDialog(true);

      // Redirect back to current page to prevent the navigation
      navigate(currentPathRef.current, { replace: true });

      return;
    }

    // No unsaved changes or same route - update current path
    currentPathRef.current = location.pathname;
  }, [location.pathname, isDirty, navigate]);

  const onConfirm = useCallback(() => {
    // User confirmed - proceed with pending navigation
    const targetPath = targetPathRef.current;
    targetPathRef.current = null;

    // Clear dirty state
    useWikiStore.getState().setDirty(false);
    setShowDialog(false);

    // Navigate to target path
    if (targetPath && targetPath !== currentPathRef.current) {
      currentPathRef.current = targetPath;
      navigate(targetPath);
    }
  }, [navigate]);

  const onCancel = useCallback(() => {
    // User cancelled - stay on current page
    targetPathRef.current = null;
    setShowDialog(false);
  }, []);

  return { showDialog, onConfirm, onCancel };
}
