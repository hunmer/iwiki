import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      <form onSubmit={handleSubmit} className="bg-background p-8 rounded-lg shadow-md w-80 space-y-4">
        <h1 className="text-xl font-bold text-center">iWiki 管理员登录</h1>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Input placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
        <Input placeholder="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full">登录</Button>
      </form>
    </div>
  );
}
