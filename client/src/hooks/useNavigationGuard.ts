import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useWikiStore } from '@/stores/wiki';

/**
 * Navigation guard hook that blocks navigation when there are unsaved changes.
 *
 * This hook uses React Router's `useBlocker` which requires a data router (createBrowserRouter).
 * It intercepts navigation attempts and shows a confirmation dialog when the user tries to leave
 * with unsaved changes.
 *
 * Also handles browser refresh/close via the beforeunload event.
 */
export function useNavigationGuard() {
  const [showDialog, setShowDialog] = useState(false);
  const isDirty = useWikiStore((s) => s.isDirty);

  // React Router navigation blocker
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

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

  // Show dialog when navigation is blocked
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowDialog(true);
    } else if (blocker.state === 'proceeding') {
      setShowDialog(false);
    }
  }, [blocker.state]);

  const handleProceed = () => {
    // Clear dirty state before proceeding
    useWikiStore.getState().setDirty(false);
    blocker.proceed?.();
  };

  const handleReset = () => {
    blocker.reset?.();
    setShowDialog(false);
  };

  return {
    showDialog,
    blockerState: blocker.state,
    onProceed: handleProceed,
    onReset: handleReset,
  };
}
