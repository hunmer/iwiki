import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || streaming) return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    try {
      const res = await api.chatStream(userMsg.content, messages);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      setMessages([...newMessages, { role: 'assistant', content: '' }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantContent += parsed.content;
                setMessages([...newMessages, { role: 'assistant', content: assistantContent }]);
              }
            } catch {}
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      setMessages([...newMessages, { role: 'assistant', content: `错误: ${message}` }]);
    }
    setStreaming(false);
  };

  if (!open) {
    return (
      <button
        className="fixed bottom-6 right-6 bg-primary text-primary-foreground rounded-full p-3 shadow-[0_2px_10px_rgba(0,188,212,0.3)] hover:bg-[#00A5BA] hover:shadow-[0_4px_16px_rgba(0,188,212,0.4)] transition-all duration-200 active:scale-95 z-[200]"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-background border border-charcoal rounded-lg shadow-[0_2px_10px_rgba(0,0,0,0.3)] flex flex-col z-[200] animate-slide-up">
      <div className="flex items-center justify-between p-3 border-b border-charcoal">
        <span className="font-medium text-sm text-foreground">AI 助手</span>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-8">问我任何关于文档的问题</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <div className={`inline-block max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-charcoal flex gap-2">
        <Input
          placeholder="输入问题..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={streaming}
          className="bg-input border-charcoal"
        />
        <Button size="icon" onClick={handleSend} disabled={streaming || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
