import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useWikiStore } from '@/stores/wiki';

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

  return { blocker, showDialog };
}
