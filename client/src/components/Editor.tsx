import { useEffect, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import { $prose } from '@milkdown/utils';
import { createSlashPlugin } from './slash-menu';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

interface Props {
  value: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

export default function Editor({ value, readOnly, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);

  // 保持 onChange 引用最新，避免闭包过期
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current) return;

    const crepe = new Crepe({
      root: editorRef.current,
      defaultValue: value,
      features: {
        [Crepe.Feature.Toolbar]: !readOnly,
        [Crepe.Feature.BlockEdit]: false, // 禁用内置 block-edit，使用自定义 slash 菜单
      },
    });

    // 在创建编辑器前，添加自定义 slash 菜单插件
    const slashPlugin = $prose((ctx) => createSlashPlugin(ctx));
    crepe.editor.use(slashPlugin);

    crepe.on((api) => {
      api.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current?.(markdown);
      });
    });

    crepe.setReadonly(!!readOnly);
    crepe.create();
    crepeRef.current = crepe;

    return () => {
      crepe.destroy();
      crepeRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅挂载时创建，通过父组件 key 切换文档

  // readOnly 变化时更新编辑器状态
  useEffect(() => {
    crepeRef.current?.setReadonly(!!readOnly);
  }, [readOnly]);

  return <div ref={editorRef} />;
}
