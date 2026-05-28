import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Smile } from 'lucide-react';

interface EmojiPickerProps {
  value?: string;
  onChange: (emoji: string) => void;
}

const commonEmojis = [
  '📄', '📝', '📚', '📖', '📕', '📗', '📘', '📙',
  '🎯', '💡', '🔥', '⭐', '❤️', '🚀', '🎨', '🎬',
  '💻', '🌟', '✨', '🎉', '🎊', '🎁', '🏆', '🔧',
  '📊', '📈', '📉', '🗂️', '📁', '📂', '🗃️', '💼',
  '🎓', '📅', '📆', '⏰', '🔔', '📍', '🏠', '🌍',
  '🔍', '🔎', '⚙️', '🛠️', '💡', '📋', '📌', '🎵'
];

export default function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [customEmoji, setCustomEmoji] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleEmojiSelect = (emoji: string) => {
    onChange(emoji);
    setIsOpen(false);
  };

  const handleCustomEmojiSubmit = () => {
    if (customEmoji.trim()) {
      onChange(customEmoji.trim());
      setCustomEmoji('');
      setIsOpen(false);
    }
  };

  const handleCustomEmojiKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCustomEmojiSubmit();
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-md hover:bg-muted transition-colors"
          title="选择图标"
        >
          {value ? (
            <span className="text-lg">{value}</span>
          ) : (
            <Smile className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium">选择图标</div>

          <div className="grid grid-cols-8 gap-1">
            {commonEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiSelect(emoji)}
                className="h-8 w-8 flex items-center justify-center text-lg rounded hover:bg-muted transition-colors"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">或输入自定义 emoji：</div>
            <div className="flex gap-2">
              <Input
                value={customEmoji}
                onChange={(e) => setCustomEmoji(e.target.value)}
                onKeyDown={handleCustomEmojiKeyDown}
                placeholder="输入 emoji..."
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleCustomEmojiSubmit}
                disabled={!customEmoji.trim()}
              >
                确定
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}