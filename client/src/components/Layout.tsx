import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Search, Menu, LogOut, LogIn, Terminal, Sun, Moon, Tags } from 'lucide-react';
import { Inspector } from 'react-dev-inspector';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useWikiStore } from '@/stores/wiki';
import { api } from '@/lib/api';
import { useState } from 'react';
import SearchDialog from '@/components/SearchDialog';
import TagManageDialog from '@/components/TagManageDialog';
import UnsavedChangesDialog from '@/components/UnsavedChangesDialog';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';

export default function Layout() {
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);
  const checkAuth = useWikiStore((s) => s.checkAuth);
  const toggleSidebar = useWikiStore((s) => s.toggleSidebar);
  const [searchOpen, setSearchOpen] = useState(false);
  const [tagManageOpen, setTagManageOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { showDialog, onConfirm, onCancel } = useNavigationGuard();

  const handleLogout = async () => {
    await api.logout();
    await checkAuth();
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-background animate-fade-in overflow-hidden">
      <header className="h-12 bg-dark-surface border-b border-charcoal flex items-center px-4 gap-2 shrink-0 z-[100]">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-foreground hover:text-primary">
          <Menu className="h-4 w-4" />
        </Button>
        <Link to="/" className="font-bold text-lg mr-auto text-primary tracking-tight flex items-center gap-1.5">
          <Terminal className="h-4 w-4" />
          iWiki
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-muted-foreground hover:text-primary">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setSearchOpen(true)} className="text-muted-foreground hover:text-primary">          <Search className="h-4 w-4 mr-1" /> 搜索
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setTagManageOpen(true)} className="text-muted-foreground hover:text-primary">
          <Tags className="h-4 w-4 mr-1" /> 标签
        </Button>
        {isAuthenticated ? (
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-primary">
            <LogOut className="h-4 w-4 mr-1" /> 退出
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="text-muted-foreground hover:text-primary">
            <LogIn className="h-4 w-4 mr-1" /> 登录
          </Button>
        )}
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Outlet />
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <TagManageDialog open={tagManageOpen} onOpenChange={setTagManageOpen} />
      <UnsavedChangesDialog open={showDialog} onConfirm={onConfirm} onCancel={onCancel} />
      <Inspector />
    </div>
  );
}
