import db from '@/lib/db';
import {
  chats as chatsTable,
  messages as messagesTable,
} from '@/lib/db/schema';
import { desc, sql, like, or, inArray } from 'drizzle-orm';

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

export const GET = async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const q = searchParams.get('q')?.trim() || '';

    const parsedLimit = parseInt(limitParam ?? '50', 10);
    const parsedOffset = parseInt(offsetParam ?? '0', 10);
    const maxLimit = q ? 200 : 50;
    const defaultLimit = q ? 200 : 50;
    const limit = isNaN(parsedLimit)
      ? defaultLimit
      : Math.min(Math.max(parsedLimit, 1), maxLimit);
    const offset = isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

    if (q) {
      const searchPattern = `%${q}%`;

      // Fetch matching messages with content so we can build excerpts
      const matchingMessages = await db
        .select({ chatId: messagesTable.chatId, content: messagesTable.content })
        .from(messagesTable)
        .where(like(messagesTable.content, searchPattern));

      // First match per chatId → excerpt
      const chatIdToExcerpt = new Map<string, string>();
      for (const msg of matchingMessages) {
        if (!chatIdToExcerpt.has(msg.chatId)) {
          chatIdToExcerpt.set(msg.chatId, extractExcerpt(msg.content, q));
        }
      }

      const matchingChatIds = Array.from(chatIdToExcerpt.keys());

      const whereCondition =
        matchingChatIds.length > 0
          ? or(
              like(chatsTable.title, searchPattern),
              inArray(chatsTable.id, matchingChatIds),
            )
          : like(chatsTable.title, searchPattern);

      const totalRows = await db
        .select({ count: sql`count(*)` })
        .from(chatsTable)
        .where(whereCondition);
      const total = Number(totalRows?.[0]?.count ?? 0);

      const rows = await db
        .select()
        .from(chatsTable)
        .where(whereCondition)
        .orderBy(desc(sql`rowid`))
        .limit(limit)
        .offset(offset);

      const chats = rows.map((chat) => ({
        ...chat,
        matchExcerpt: chatIdToExcerpt.get(chat.id) ?? null,
      }));

      return Response.json(
        { chats, total, limit, offset, hasMore: offset + rows.length < total },
        { status: 200 },
      );
    }

    const totalRows = await db
      .select({ count: sql`count(*)` })
      .from(chatsTable);
    const total = Number(totalRows?.[0]?.count ?? 0);

    const rows = await db
      .select()
      .from(chatsTable)
      .orderBy(desc(sql`rowid`))
      .limit(limit)
      .offset(offset);

    return Response.json(
      {
        chats: rows,
        total,
        limit,
        offset,
        hasMore: offset + rows.length < total,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
