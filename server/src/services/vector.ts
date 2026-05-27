import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { createEmbeddings } from './llm';
import { getDb, readDocContent } from '../db';

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
  separators: ['\n## ', '\n### ', '\n\n', '\n', ' '],
});

export async function buildIndex(): Promise<{ indexedCount: number; nodeCount: number }> {
  const db = getDb();
  const embeddings = createEmbeddings();

  const nodes = db.prepare(
    'SELECT id, title FROM nodes WHERE is_trash = 0'
  ).all() as { id: string; title: string }[];

  let indexedCount = 0;

  db.prepare('DELETE FROM embeddings').run();

  for (const node of nodes) {
    const content = readDocContent(node.id);
    if (!content.trim()) continue;

    const fullText = `# ${node.title}\n\n${content}`;
    const docs = await splitter.splitText(fullText);

    if (docs.length === 0) continue;

    const vectors = await embeddings.embedDocuments(docs);

    const insert = db.prepare(
      'INSERT INTO embeddings (node_id, chunk_index, content, embedding, updated_at) VALUES (?, ?, ?, ?, ?)'
    );

    const now = Date.now();
    for (let i = 0; i < docs.length; i++) {
      const buffer = Buffer.from(new Float32Array(vectors[i]).buffer);
      insert.run(node.id, i, docs[i], buffer, now);
    }

    indexedCount += docs.length;
  }

  return { indexedCount, nodeCount: nodes.length };
}

export function getVectorStats(): { indexedCount: number; nodeCount: number; lastIndexedAt: number | null } {
  const db = getDb();
  const stats = db.prepare(
    'SELECT COUNT(DISTINCT node_id) as nodeCount, COUNT(*) as indexedCount, MAX(updated_at) as lastIndexedAt FROM embeddings'
  ).get() as { nodeCount: number; indexedCount: number; lastIndexedAt: number | null };
  return stats;
}

export async function vectorSearch(query: string, topK: number = 5): Promise<Array<{
  nodeId: string; title: string; score: number; content: string;
}>> {
  const db = getDb();
  const embeddings = createEmbeddings();

  const queryVector = await embeddings.embedQuery(query);

  const allEmbeddings = db.prepare(
    `SELECT e.node_id, e.chunk_index, e.content, e.embedding,
            n.title
     FROM embeddings e
     JOIN nodes n ON n.id = e.node_id
     WHERE n.is_trash = 0`
  ).all() as { node_id: string; chunk_index: number; content: string; embedding: Buffer; title: string }[];

  const results = allEmbeddings.map(row => {
    const vecBuffer = row.embedding as Buffer;
    const vec = new Float32Array(vecBuffer.buffer, vecBuffer.byteOffset, vecBuffer.byteLength / 4);
    const qVec = new Float32Array(queryVector);

    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vec.length; i++) {
      dot += vec[i] * qVec[i];
      normA += vec[i] * vec[i];
      normB += qVec[i] * qVec[i];
    }
    const score = normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));

    return {
      nodeId: row.node_id,
      title: row.title,
      score,
      content: row.content,
    };
  });

  results.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.nodeId)) return false;
    seen.add(r.nodeId);
    return true;
  }).slice(0, topK);
}
