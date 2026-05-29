import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import EmojiPickerLib from 'emoji-picker-react';

interface EmojiPickerProps {
  value?: string;
  onChange: (emoji: string) => void;
}

export default function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleEmojiClick = (emojiData: any) => {
    onChange(emojiData.emoji);
    setIsOpen(false);
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
      <PopoverContent className="w-auto p-0" align="start">
        <EmojiPickerLib
          onEmojiClick={handleEmojiClick}
          theme="auto"
          emojiStyle="native"
          width={320}
          height={400}
          searchPlaceholder="搜索 emoji..."
        />
      </PopoverContent>
    </Popover>
  );
}