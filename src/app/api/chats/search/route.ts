import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '@/lib/config';
import { getAvailableChatModelProviders } from '@/lib/providers';
import { removeThinkingBlocks } from '@/lib/utils/contentUtils';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { desc, inArray, like, or, sql } from 'drizzle-orm';

const searchTermsPrompt = `You are a search assistant. Given a natural language query, extract specific search terms to find relevant conversations in a personal chat history.

Query: {query}

Extract 1-5 specific, distinct search terms or phrases that could appear in conversations matching this query. Each term should be concise (1-4 words).

Output each term on a separate line between <terms> and </terms> XML tags. Do not include any other text.

Example:
Query: Find conversations about Star Wars and space combat
<terms>
Star Wars
space combat
X-Wing
Tie Fighter
</terms>

Now extract terms for the actual query:
<terms>
`;

interface ChatModel {
  provider: string;
  model: string;
  ollamaContextWindow?: number;
}

interface LlmSearchBody {
  query: string;
  chatModel?: ChatModel;
}

interface ChatRow {
  id: string;
  title: string;
  createdAt: string;
  focusMode: string;
  files: unknown;
  matchExcerpt: string | null;
}

function extractExcerpt(content: string, term: string, contextLen = 80): string {
  const lowerContent = content.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const idx = lowerContent.indexOf(lowerTerm);

  if (idx === -1) {
    const max = contextLen * 2;
    return content.length > max ? content.slice(0, max).trim() + '…' : content.trim();
  }

  const start = Math.max(0, idx - contextLen);
  const end = Math.min(content.length, idx + term.length + contextLen);

  let excerpt = content.slice(start, end).trim();
  if (start > 0) excerpt = '…' + excerpt;
  if (end < content.length) excerpt = excerpt + '…';

  return excerpt;
}

const searchByTerm = async (term: string): Promise<ChatRow[]> => {
  const pattern = `%${term}%`;

  const matchingMessages = await db
    .select({ chatId: messages.chatId, content: messages.content })
    .from(messages)
    .where(like(messages.content, pattern));

  const chatIdToExcerpt = new Map<string, string>();
  for (const msg of matchingMessages) {
    if (!chatIdToExcerpt.has(msg.chatId)) {
      chatIdToExcerpt.set(msg.chatId, extractExcerpt(msg.content, term));
    }
  }

  const matchingChatIds = Array.from(chatIdToExcerpt.keys());

  const whereCondition =
    matchingChatIds.length > 0
      ? or(like(chats.title, pattern), inArray(chats.id, matchingChatIds))
      : like(chats.title, pattern);

  const rows = await db
    .select()
    .from(chats)
    .where(whereCondition)
    .orderBy(desc(sql`rowid`));

  return rows.map((chat) => ({
    ...chat,
    matchExcerpt: chatIdToExcerpt.get(chat.id) ?? null,
  }));
};

export const POST = async (req: Request) => {
  try {
    const body: LlmSearchBody = await req.json();

    if (!body.query?.trim()) {
      return Response.json({ message: 'Query is required' }, { status: 400 });
    }

    const chatModelProviders = await getAvailableChatModelProviders();
    const chatModelProvider =
      chatModelProviders[
        body.chatModel?.provider || Object.keys(chatModelProviders)[0]
      ];
    const chatModel =
      chatModelProvider?.[
        body.chatModel?.model || Object.keys(chatModelProvider)[0]
      ];

    let llm: BaseChatModel | undefined;

    if (body.chatModel?.provider === 'custom_openai') {
      llm = new ChatOpenAI({
        apiKey: getCustomOpenaiApiKey(),
        modelName: getCustomOpenaiModelName(),
        configuration: {
          baseURL: getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    } else if (chatModelProvider && chatModel) {
      llm = chatModel.model;
      if (llm instanceof ChatOllama && body.chatModel?.provider === 'ollama') {
        llm.numCtx = body.chatModel.ollamaContextWindow || 2048;
      }
    }

    if (!llm) {
      return Response.json({ error: 'Invalid chat model' }, { status: 400 });
    }

    (llm as unknown as ChatOpenAI).temperature = 0;

    const chain = RunnableSequence.from([
      PromptTemplate.fromTemplate(searchTermsPrompt),
      llm,
      new StringOutputParser(),
    ]);

    const rawOutput = await chain.invoke({ query: body.query.trim() });

    // Remove thinking blocks from output (e.g., reasoning models)
    const cleaned = removeThinkingBlocks(rawOutput);

    // The prompt injects the opening <terms> tag, so parse up to </terms>
    const endTagIndex = cleaned.indexOf('</terms>');
    const termsText =
      endTagIndex !== -1 ? cleaned.slice(0, endTagIndex) : cleaned;

    const terms = termsText
      .split('\n')
      .map((line) => line.replace(/^(\s*(-|\*|\d+\.)\s*)+/, '').trim())
      .filter((line) => line.length > 0 && !line.startsWith('<'));

    const searchTerms = terms.length > 0 ? terms : [body.query.trim()];

    // Search for each term; first match wins for deduplication and excerpt
    const seen = new Map<string, ChatRow>();

    for (const term of searchTerms) {
      const rows = await searchByTerm(term);
      for (const chat of rows) {
        if (!seen.has(chat.id)) {
          seen.set(chat.id, chat);
        }
      }
    }

    const combinedChats = Array.from(seen.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    return Response.json(
      {
        chats: combinedChats,
        terms: searchTerms,
        total: combinedChats.length,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in LLM chat search: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
