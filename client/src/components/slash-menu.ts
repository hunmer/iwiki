import type { Ctx } from '@milkdown/ctx';
import type { EditorView } from '@milkdown/prose/view';
import type { EditorState } from '@milkdown/prose/state';
import { SlashProvider } from '@milkdown/kit/plugin/slash';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import { commandsCtx } from '@milkdown/kit/core';
import {
  paragraphSchema,
  headingSchema,
  blockquoteSchema,
  bulletListSchema,
  orderedListSchema,
  codeBlockSchema,
  hrSchema,
  clearTextInCurrentBlockCommand,
  setBlockTypeCommand,
  wrapInBlockTypeCommand,
  addBlockTypeCommand,
} from '@milkdown/kit/preset/commonmark';

// --- 菜单项定义 ---

interface MenuItem {
  label: string;
  keyword: string;
  onRun: (ctx: Ctx) => void;
}

const MENU_ITEMS: MenuItem[] = [
  {
    label: '正文',
    keyword: 'text',
    onRun(ctx) {
      const commands = ctx.get(commandsCtx);
      commands.call(clearTextInCurrentBlockCommand.key);
      commands.call(setBlockTypeCommand.key, { nodeType: paragraphSchema.type(ctx) });
    },
  },
  {
    label: '标题 1',
    keyword: 'h1 heading',
    onRun(ctx) {
      const commands = ctx.get(commandsCtx);
      commands.call(clearTextInCurrentBlockCommand.key);
      commands.call(setBlockTypeCommand.key, { nodeType: headingSchema.type(ctx), attrs: { level: 1 } });
    },
  },
  {
    label: '标题 2',
    keyword: 'h2 heading',
    onRun(ctx) {
      const commands = ctx.get(commandsCtx);
      commands.call(clearTextInCurrentBlockCommand.key);
      commands.call(setBlockTypeCommand.key, { nodeType: headingSchema.type(ctx), attrs: { level: 2 } });
    },
  },
  {
    label: '标题 3',
    keyword: 'h3 heading',
    onRun(ctx) {
      const commands = ctx.get(commandsCtx);
      commands.call(clearTextInCurrentBlockCommand.key);
      commands.call(setBlockTypeCommand.key, { nodeType: headingSchema.type(ctx), attrs: { level: 3 } });
    },
  },
  {
    label: '无序列表',
    keyword: 'bullet list ul',
    onRun(ctx) {
      const commands = ctx.get(commandsCtx);
      commands.call(clearTextInCurrentBlockCommand.key);
      commands.call(wrapInBlockTypeCommand.key, { nodeType: bulletListSchema.type(ctx) });
    },
  },
  {
    label: '有序列表',
    keyword: 'ordered list ol',
    onRun(ctx) {
      const commands = ctx.get(commandsCtx);
      commands.call(clearTextInCurrentBlockCommand.key);
      commands.call(wrapInBlockTypeCommand.key, { nodeType: orderedListSchema.type(ctx) });
    },
  },
  {
    label: '引用',
    keyword: 'quote blockquote',
    onRun(ctx) {
      const commands = ctx.get(commandsCtx);
      commands.call(clearTextInCurrentBlockCommand.key);
      commands.call(wrapInBlockTypeCommand.key, { nodeType: blockquoteSchema.type(ctx) });
    },
  },
  {
    label: '代码块',
    keyword: 'code codeblock',
    onRun(ctx) {
      const commands = ctx.get(commandsCtx);
      commands.call(clearTextInCurrentBlockCommand.key);
      commands.call(setBlockTypeCommand.key, { nodeType: codeBlockSchema.type(ctx) });
    },
  },
  {
    label: '分割线',
    keyword: 'divider hr',
    onRun(ctx) {
      const commands = ctx.get(commandsCtx);
      commands.call(clearTextInCurrentBlockCommand.key);
      commands.call(addBlockTypeCommand.key, { nodeType: hrSchema.type(ctx) });
    },
  },
];

// --- DOM 渲染 ---

function filterItems(query: string): MenuItem[] {
  if (!query) return MENU_ITEMS;
  const q = query.toLowerCase();
  return MENU_ITEMS.filter(
    (item) => item.label.toLowerCase().includes(q) || item.keyword.includes(q),
  );
}

function renderMenu(items: MenuItem[], activeIndex: number): string {
  return items
    .map(
      (item, i) =>
        `<div class="slash-item${i === activeIndex ? ' active' : ''}" data-index="${i}">${item.label}</div>`,
    )
    .join('');
}

// --- Plugin View ---

class SlashMenuView {
  private provider: SlashProvider;
  private content: HTMLDivElement;
  private ctx: Ctx;
  private filterText = '';
  private activeIndex = 0;
  private visible = false;

  constructor(ctx: Ctx, view: EditorView) {
    this.ctx = ctx;

    const content = document.createElement('div');
    content.className = 'slash-view';
    this.content = content;

    // 点击选择菜单项
    content.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const target = (e.target as HTMLElement).closest('.slash-item') as HTMLElement | null;
      if (target) {
        const idx = Number(target.dataset.index);
        this.selectItem(idx);
      }
    });

    // 核心：配置 floatingUIOptions 强制向下显示
    this.provider = new SlashProvider({
      content,
      debounce: 50,
      floatingUIOptions: {
        placement: 'bottom-start',
      },
      shouldShow(view: EditorView) {
        const selection = view.state.selection;
        if (!(selection instanceof TextSelection)) return false;
        if (!selection.empty) return false;

        const $head = selection.$head;
        const parent = $head.parent;
        const text = parent.textContent.slice(0, $head.parentOffset);

        // 仅在当前行以 "/" 开头且光标在行尾时显示
        if (!text.startsWith('/')) return false;
        return true;
      },
    });

    this.provider.onShow = () => {
      this.visible = true;
    };
    this.provider.onHide = () => {
      this.visible = false;
    };

    this.update(view);
  }

  update(view: EditorView, prevState?: EditorState) {
    this.provider.update(view, prevState);

    if (!this.visible) return;

    // 提取过滤文本
    const selection = view.state.selection;
    if (!(selection instanceof TextSelection) || !selection.empty) return;
    const $head = selection.$head;
    const text = $head.parent.textContent.slice(0, $head.parentOffset);
    const query = text.startsWith('/') ? text.slice(1) : '';
    this.filterText = query;

    const items = filterItems(query);
    if (items.length === 0) {
      this.provider.hide();
      return;
    }

    // 重置选中索引
    if (this.activeIndex >= items.length) {
      this.activeIndex = 0;
    }

    this.content.innerHTML = renderMenu(items, this.activeIndex);
  }

  selectItem(index: number) {
    const items = filterItems(this.filterText);
    if (index < 0 || index >= items.length) return;
    items[index].onRun(this.ctx);
    this.provider.hide();
  }

  destroy() {
    this.provider.destroy();
    this.content.remove();
  }
}

// --- Milkdown 插件 ---

export function createSlashPlugin(ctx: Ctx) {
  const key = new PluginKey('slash-menu-view');

  const plugin = new Plugin({
    key,
    view(editorView) {
      const slashView = new SlashMenuView(ctx, editorView);
      return {
        update(view: EditorView, prevState?: EditorState) {
          slashView.update(view, prevState);
        },
        destroy() {
          slashView.destroy();
        },
      };
    },
  });

  return plugin;
}
