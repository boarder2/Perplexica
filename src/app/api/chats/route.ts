import db from '@/lib/db';
import { chats as chatsTable } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

export const GET = async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const parsedLimit = parseInt(limitParam ?? '50', 10);
    const parsedOffset = parseInt(offsetParam ?? '0', 10);
    const limit = isNaN(parsedLimit)
      ? 50
      : Math.min(Math.max(parsedLimit, 1), 50);
    const offset = isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

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
