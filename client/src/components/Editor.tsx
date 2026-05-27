import { useEditor, Milkdown, MilkdownProvider } from '@milkdown/react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { nord } from '@milkdown/theme-nord';
import '@milkdown/theme-nord/style.css';

interface Props {
  value: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

function MilkdownEditorInner({ value, readOnly }: Props) {
  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        if (value) {
          ctx.set(defaultValueCtx, value);
        }
      })
      .use(nord)
      .use(commonmark)
  );

  return (
    <div className={readOnly ? 'pointer-events-none' : ''}>
      <Milkdown />
    </div>
  );
}

export default function EditorWrapper(props: Props) {
  return (
    <MilkdownProvider>
      <MilkdownEditorInner {...props} />
    </MilkdownProvider>
  );
}
