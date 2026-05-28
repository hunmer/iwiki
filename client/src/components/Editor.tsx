import { useEffect, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
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
        [Crepe.Feature.BlockEdit]: !readOnly,
        [Crepe.Feature.Commands]: !readOnly,
      },
      featureConfigs: {
        [Crepe.Feature.BlockEdit]: {
          // 确保 slash 菜单启用
          textGroup: {
            label: '文本',
            text: { label: '正文', icon: undefined },
            h1: { label: '标题 1', icon: undefined },
            h2: { label: '标题 2', icon: undefined },
            h3: { label: '标题 3', icon: undefined },
            h4: { label: '标题 4', icon: undefined },
            h5: { label: '标题 5', icon: undefined },
            h6: { label: '标题 6', icon: undefined },
            quote: { label: '引用', icon: undefined },
            divider: { label: '分割线', icon: undefined },
          },
          listGroup: {
            label: '列表',
            bulletList: { label: '无序列表', icon: undefined },
            orderedList: { label: '有序列表', icon: undefined },
            taskList: { label: '任务列表', icon: undefined },
          },
          advancedGroup: {
            label: '高级',
            image: { label: '图片', icon: undefined },
            codeBlock: { label: '代码块', icon: undefined },
            table: { label: '表格', icon: undefined },
            math: { label: '数学公式', icon: undefined },
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅挂载时创建，通过父组件 key 切换文档

  // readOnly 变化时更新编辑器状态
  useEffect(() => {
    crepeRef.current?.setReadonly(!!readOnly);
  }, [readOnly]);

  return <div ref={editorRef} />;
}
