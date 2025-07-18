import {
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '@/lib/providers';

export const GET = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const includeHidden = url.searchParams.get('include_hidden') === 'true';

    const [chatModelProviders, embeddingModelProviders] = await Promise.all([
      getAvailableChatModelProviders({ includeHidden }),
      getAvailableEmbeddingModelProviders({ includeHidden }),
    ]);

    Object.keys(chatModelProviders).forEach((provider) => {
      Object.keys(chatModelProviders[provider]).forEach((model) => {
        delete (chatModelProviders[provider][model] as { model?: unknown })
          .model;
      });
    });

    Object.keys(embeddingModelProviders).forEach((provider) => {
      Object.keys(embeddingModelProviders[provider]).forEach((model) => {
        delete (embeddingModelProviders[provider][model] as { model?: unknown })
          .model;
      });
    });

    return Response.json(
      {
        chatModelProviders,
        embeddingModelProviders,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while fetching models', err);
    return Response.json(
      {
        message: 'An error has occurred.',
      },
      {
        status: 500,
      },
    );
  }
};
