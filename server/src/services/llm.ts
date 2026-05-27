import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

export function createChatModel() {
  return new ChatOpenAI({
    modelName: process.env.AI_CHAT_MODEL || 'gpt-4o',
    temperature: 0.7,
    streaming: true,
    configuration: {
      baseURL: process.env.AI_API_BASE,
      apiKey: process.env.AI_API_KEY,
    },
  });
}

export function createEmbeddings() {
  return new OpenAIEmbeddings({
    model: process.env.AI_EMBEDDING_MODEL || 'text-embedding-3-small',
    configuration: {
      baseURL: process.env.AI_API_BASE,
      apiKey: process.env.AI_API_KEY,
    },
  });
}
