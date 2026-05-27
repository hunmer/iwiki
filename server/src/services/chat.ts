import { createChatModel } from './llm';
import { vectorSearch } from './vector';

const SYSTEM_PROMPT = `你是 iWiki 知识库的 AI 助手。根据以下检索到的文档内容回答用户的问题。
如果文档内容不足以回答问题，请如实说明。
回答时引用来源文档的标题。`;

export async function* streamChat(
  message: string,
  history: Array<{ role: string; content: string }> = []
) {
  const results = await vectorSearch(message, 5);

  const contextText = results.length > 0
    ? results.map((r, i) => `[${i + 1}] ${r.title}:\n${r.content}`).join('\n\n---\n\n')
    : '没有找到相关文档。';

  const chatModel = createChatModel();

  const messages = [
    { role: 'system' as const, content: `${SYSTEM_PROMPT}\n\n参考文档:\n${contextText}` },
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user' as const, content: message },
  ];

  const stream = await chatModel.stream(messages);

  for await (const chunk of stream) {
    if (chunk.content) {
      yield chunk.content as string;
    }
  }
}
