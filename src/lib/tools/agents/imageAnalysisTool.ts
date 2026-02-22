import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import { Document } from '@langchain/core/documents';
import { HumanMessage } from '@langchain/core/messages';
import { Command, getCurrentTaskInput } from '@langchain/langgraph';
import { SimplifiedAgentStateType } from '@/lib/state/chatAgentState';
import { ToolMessage } from '@langchain/core/messages';
import { removeThinkingBlocks } from '@/lib/utils/contentUtils';
import { isSoftStop } from '@/lib/utils/runControl';
import axios from 'axios';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_PREFIXES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

const ImageAnalysisToolSchema = z.object({
  url: z.string().describe('The URL of the image to analyze'),
  query: z
    .string()
    .describe(
      'What to look for or describe about the image, guided by the user query',
    ),
});

/**
 * ImageAnalysisTool - Fetches an image from a URL and analyzes it using a
 * vision-capable system LLM, returning a description/analysis as a document.
 */
export const imageAnalysisTool = tool(
  async (
    input: z.infer<typeof ImageAnalysisToolSchema>,
    config?: RunnableConfig,
  ) => {
    try {
      const { url, query } = input;

      console.log(
        `ImageAnalysisTool: Analyzing image at "${url}" for query: "${query}"`,
      );

      const messageId: string | undefined = (
        config as unknown as Record<string, Record<string, unknown>>
      )?.configurable?.messageId as string | undefined;
      const retrievalSignal: AbortSignal | undefined = (
        config as unknown as Record<string, Record<string, unknown>>
      )?.configurable?.retrievalSignal as AbortSignal | undefined;

      if (messageId && isSoftStop(messageId)) {
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content: 'Operation stopped by user.',
                tool_call_id: (
                  config as unknown as { toolCall: { id: string } }
                )?.toolCall.id,
              }),
            ],
          },
        });
      }

      if (!config?.configurable?.systemLlm) {
        throw new Error('System LLM not available in config');
      }
      const llm = config.configurable.systemLlm;
      const emitter = config.configurable?.emitter as
        | import('events').EventEmitter
        | undefined;

      // Fetch the image
      let imageBuffer: Buffer;
      let contentType: string;
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 30000,
          maxContentLength: MAX_IMAGE_SIZE,
          signal: retrievalSignal,
          headers: {
            Accept: 'image/*',
            'User-Agent':
              'Mozilla/5.0 (compatible; Perplexica/1.0; +https://github.com/ItzCraworplexica)',
          },
        });

        contentType = (response.headers['content-type'] || '').toLowerCase();
        imageBuffer = Buffer.from(response.data);
      } catch (fetchError: unknown) {
        const msg =
          fetchError instanceof Error
            ? fetchError.message
            : 'Failed to fetch image';
        console.error(`ImageAnalysisTool: Error fetching image: ${msg}`);
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content: `Failed to fetch image from URL: ${msg}`,
                tool_call_id: (
                  config as unknown as { toolCall: { id: string } }
                )?.toolCall.id,
              }),
            ],
          },
        });
      }

      // Validate that the response is actually an image
      const mimeType = ALLOWED_MIME_PREFIXES.find((prefix) =>
        contentType.startsWith(prefix),
      );
      if (!mimeType) {
        console.warn(
          `ImageAnalysisTool: URL returned non-image content-type: ${contentType}`,
        );
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content: `URL did not return a supported image format. Content-Type: ${contentType}`,
                tool_call_id: (
                  config as unknown as { toolCall: { id: string } }
                )?.toolCall.id,
              }),
            ],
          },
        });
      }

      if (imageBuffer.length === 0) {
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content: 'Image URL returned empty content.',
                tool_call_id: (
                  config as unknown as { toolCall: { id: string } }
                )?.toolCall.id,
              }),
            ],
          },
        });
      }

      // Check soft-stop again before the expensive LLM call
      if (messageId && isSoftStop(messageId)) {
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content: 'Operation stopped by user.',
                tool_call_id: (
                  config as unknown as { toolCall: { id: string } }
                )?.toolCall.id,
              }),
            ],
          },
        });
      }

      // Build base64 data URI
      const base64Data = imageBuffer.toString('base64');
      const dataUri = `data:${mimeType};base64,${base64Data}`;

      // Invoke the vision LLM with a multimodal message
      const analysisPrompt = `You are an image analysis assistant. Analyze the image and provide a detailed, relevant description.

Focus on aspects of the image that relate to or help answer this query: "${query}"

Provide:
1. A brief description of what the image shows
2. Any relevant details, text, data, or information visible in the image
3. How the image content relates to the query

Be factual and specific. Describe only what you can actually see in the image.`;

      const humanMessage = new HumanMessage({
        content: [
          { type: 'text', text: analysisPrompt },
          { type: 'image_url', image_url: { url: dataUri } },
        ],
      });

      const result = await llm.invoke([humanMessage], {
        signal: retrievalSignal || config?.signal,
      });

      // Emit token usage
      const usageData =
        result.usage_metadata ??
        (result.response_metadata?.usage as
          | Record<string, number>
          | null
          | undefined);
      if (emitter && usageData) {
        const rawUsage = usageData as Record<string, number>;
        const inputTokens =
          rawUsage.input_tokens ||
          rawUsage.prompt_tokens ||
          rawUsage.promptTokens ||
          0;
        const outputTokens =
          rawUsage.output_tokens ||
          rawUsage.completion_tokens ||
          rawUsage.completionTokens ||
          0;
        emitter.emit(
          'tool_llm_usage',
          JSON.stringify({
            target: 'system',
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens:
              rawUsage.total_tokens ||
              rawUsage.totalTokens ||
              inputTokens + outputTokens,
          }),
        );
      }

      const analysisContent = removeThinkingBlocks(result.content as string);

      if (!analysisContent || analysisContent.trim().length < 10) {
        console.warn(
          'ImageAnalysisTool: LLM returned insufficient analysis content',
        );
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content:
                  'The image could not be analyzed — the vision model returned no useful content.',
                tool_call_id: (
                  config as unknown as { toolCall: { id: string } }
                )?.toolCall.id,
              }),
            ],
          },
        });
      }

      const currentState = getCurrentTaskInput() as SimplifiedAgentStateType;
      const currentDocCount = currentState.relevantDocuments?.length ?? 0;

      const document = new Document({
        pageContent: analysisContent,
        metadata: {
          sourceId: currentDocCount + 1,
          title: `Image Analysis: ${query.slice(0, 100)}`,
          url: url,
          source: url,
          processingType: 'image-analysis',
          searchQuery: query,
        },
      });

      console.log(
        `ImageAnalysisTool: Successfully analyzed image (${analysisContent.length} chars)`,
      );

      return new Command({
        update: {
          relevantDocuments: [document],
          messages: [
            new ToolMessage({
              content: JSON.stringify({ document: [document] }),
              tool_call_id: (config as unknown as { toolCall: { id: string } })
                ?.toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      console.error('ImageAnalysisTool: Error during image analysis:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: 'Error occurred during image analysis: ' + errorMessage,
              tool_call_id: (config as unknown as { toolCall: { id: string } })
                ?.toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: 'image_analysis',
    description:
      'Fetches an image from a URL and analyzes its visual content using a vision model. Use this to understand what is shown in an image found on the web — charts, diagrams, photos, screenshots, infographics, etc. The URL must point directly to an image file.',
    schema: ImageAnalysisToolSchema,
  },
);
