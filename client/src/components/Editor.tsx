import { useEffect, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

interface Props {
  value: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/uploads', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '上传失败' }));
    throw new Error(err.error || '上传失败');
  }

  const { url } = await res.json();
  return url;
}

export default function Editor({ value, readOnly, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current) return;

    const crepe = new Crepe({
      root: editorRef.current,
      defaultValue: value,
      features: {
        [Crepe.Feature.Toolbar]: true,
        [Crepe.Feature.BlockEdit]: true,
        [Crepe.Feature.ImageBlock]: true,
      },
      featureConfigs: {
        [Crepe.Feature.ImageBlock]: {
          onUpload: uploadFile,
        },
        [Crepe.Feature.BlockEdit]: {
          textGroup: {
            label: '文本',
            text: { label: '正文' },
            h1: { label: '标题 1' },
            h2: { label: '标题 2' },
            h3: { label: '标题 3' },
            h4: { label: '标题 4' },
            h5: { label: '标题 5' },
            h6: { label: '标题 6' },
            quote: { label: '引用' },
            divider: { label: '分割线' },
          },
          listGroup: {
            label: '列表',
            bulletList: { label: '无序列表' },
            orderedList: { label: '有序列表' },
            taskList: { label: '任务列表' },
          },
          advancedGroup: {
            label: '高级',
            image: { label: '图片' },
            codeBlock: { label: '代码块' },
            table: { label: '表格' },
            math: { label: '数学公式' },
          },
        },
      },
    });

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
    // 仅挂载时创建，文档切换由父组件通过 key 重建编辑器。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    crepeRef.current?.setReadonly(!!readOnly);
  }, [readOnly]);

  return <div ref={editorRef} className="flex-1" />;
}
