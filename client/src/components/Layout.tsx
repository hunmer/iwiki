import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Search, Menu, LogOut, LogIn } from 'lucide-react';
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
  const sidebarCollapsed = useWikiStore((s) => s.sidebarCollapsed);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await api.logout();
    await checkAuth();
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 border-b flex items-center px-4 gap-2 shrink-0">
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          <Menu className="h-4 w-4" />
        </Button>
        <Link to="/" className="font-bold text-lg mr-auto">iWiki</Link>
        <Button variant="ghost" size="sm" onClick={() => setSearchOpen(true)}>
          <Search className="h-4 w-4 mr-1" /> 搜索
        </Button>
        {isAuthenticated ? (
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> 退出
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
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
