import { useEffect, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import { commandsCtx } from '@milkdown/kit/core';
import { clearTextInCurrentBlockCommand, htmlSchema } from '@milkdown/kit/preset/commonmark';
import { insert, $remark } from '@milkdown/kit/utils';
import { emoji } from '@milkdown/plugin-emoji';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import { markSchema } from './editor-plugins/highlight-mark-schema';
import { remarkMarkColor } from './editor-plugins/remark-mark-color';
import { markInputRule } from './editor-plugins/highlight-input-rule';
import { colorPickerTooltip, colorPickerTooltipConfig } from './editor-plugins/highlight-color-picker';

interface Props {
  value: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  try {
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '上传失败';
    alert(message);
    throw err;
  }
}

const videoIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M4 6.5C4 5.67 4.67 5 5.5 5H14.5C15.33 5 16 5.67 16 6.5V17.5C16 18.33 15.33 19 14.5 19H5.5C4.67 19 4 18.33 4 17.5V6.5Z" stroke="currentColor" stroke-width="1.8" />
    <path d="M16 9.25L20 7V17L16 14.75" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
  </svg>
`;

function escapeHtmlAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// 创建 remark 插件包装
const highlightRemarkPlugin = $remark('markColor', () => remarkMarkColor);

const renderableHtmlSchema = htmlSchema.extendSchema((prev) => (ctx) => {
  const base = prev(ctx);

  return {
    ...base,
    toDOM: (node) => {
      const value = String(node.attrs.value ?? '');
      const wrapper = document.createElement('span');
      wrapper.setAttribute('data-type', 'html');
      wrapper.setAttribute('data-value', value);

      const videoMatch = value.match(
        /^<video\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>(?:<\/video>)?$/i,
      );

      if (videoMatch) {
        const video = document.createElement('video');
        video.controls = true;
        video.src = videoMatch[2];
        video.preload = 'metadata';
        video.style.maxWidth = '100%';
        wrapper.appendChild(video);
      } else {
        wrapper.textContent = value;
      }

      return wrapper;
    },
  };
});

function selectVideoFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
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
        [Crepe.Feature.LinkTooltip]: true,
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
          buildMenu: (builder) => {
            builder.getGroup('advanced').addItem('video', {
              label: '上传视频',
              icon: videoIcon,
              onRun: async (ctx) => {
                const file = await selectVideoFile();
                if (!file) return;

                const url = await uploadFile(file);
                const commands = ctx.get(commandsCtx);
                commands.call(clearTextInCurrentBlockCommand.key);
                insert(`<video controls src="${escapeHtmlAttr(url)}">`)(ctx);
              },
            });
          },
        },
      },
    });

    // 使用自定义的 HTML schema 来支持视频渲染
    crepe.editor.use(renderableHtmlSchema);

    // 启用 emoji 插件，支持 :smile: 快捷方式和 twemoji 渲染
    emoji.forEach((plugin) => crepe.editor.use(plugin));

    // 颜色高亮插件
    crepe.editor.use(highlightRemarkPlugin); // $remark returns a plugin array with optionsCtx built-in
    crepe.editor.use(markSchema);
    crepe.editor.use(markInputRule);
    crepe.editor.use(colorPickerTooltip);

    // 设置 tooltip 配置
    crepe.editor.config(colorPickerTooltipConfig);

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

  return <div ref={editorRef} className="flex-1 min-h-0" />;
}
