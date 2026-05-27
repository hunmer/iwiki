import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Terminal } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const checkAuth = useWikiStore((s) => s.checkAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.login(username, password);
      await checkAuth();
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-dark-surface">
      <form onSubmit={handleSubmit} className="bg-background border border-charcoal p-8 rounded-lg shadow-[0_2px_10px_rgba(0,0,0,0.3)] w-80 space-y-5 animate-fade-in">
        <div className="flex items-center justify-center gap-2 text-primary">
          <Terminal className="h-5 w-5" />
          <h1 className="text-lg font-bold">iWiki</h1>
        </div>
        <p className="text-xs text-muted-foreground text-center -mt-2">管理员登录</p>
        {error && <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded">{error}</p>}
        <div className="space-y-3">
          <Input
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-input border-charcoal"
          />
          <Input
            placeholder="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-input border-charcoal"
          />
        </div>
        <Button type="submit" className="w-full">登录</Button>
      </form>
    </div>
  );
}
