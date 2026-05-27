import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Search, Menu, LogOut, LogIn, Terminal } from 'lucide-react';
import { Inspector } from 'react-dev-inspector';
import { Button } from '@/components/ui/button';
import { useWikiStore } from '@/stores/wiki';
import { api } from '@/lib/api';
import { useState } from 'react';
import SearchDialog from '@/components/SearchDialog';

export default function Layout() {
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);
  const checkAuth = useWikiStore((s) => s.checkAuth);
  const toggleSidebar = useWikiStore((s) => s.toggleSidebar);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await api.logout();
    await checkAuth();
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background animate-fade-in">
      <header className="h-12 bg-dark-surface border-b border-charcoal flex items-center px-4 gap-2 shrink-0 z-[100]">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-foreground hover:text-primary">
          <Menu className="h-4 w-4" />
        </Button>
        <Link to="/" className="font-bold text-lg mr-auto text-primary tracking-tight flex items-center gap-1.5">
          <Terminal className="h-4 w-4" />
          iWiki
        </Link>
        <Button variant="ghost" size="sm" onClick={() => setSearchOpen(true)} className="text-muted-foreground hover:text-primary">
          <Search className="h-4 w-4 mr-1" /> 搜索
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
      <Inspector />
    </div>
  );
}
