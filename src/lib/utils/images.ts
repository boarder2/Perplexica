import fs from 'fs';
import path from 'path';
import { HumanMessage } from '@langchain/core/messages';

const uploadDir = path.join(process.cwd(), 'uploads');

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const IMAGE_ID_REGEX = /^[a-f0-9]{32}$/;

/**
 * Load an image from disk and return its base64 data and MIME type.
 */
export function loadImageAsBase64(imageId: string): {
  data: string;
  mimeType: string;
} {
  if (!IMAGE_ID_REGEX.test(imageId)) {
    throw new Error(`Invalid image ID: ${imageId}`);
  }

  const files = fs.readdirSync(uploadDir);
  const imageFile = files.find(
    (f) => f.startsWith(imageId + '.') && !f.includes('-'),
  );

  if (!imageFile) {
    throw new Error(`Image not found: ${imageId}`);
  }

  const ext = imageFile.split('.').pop()?.toLowerCase();
  const mimeType = ext ? MIME_TYPES[ext] : undefined;

  if (!mimeType) {
    throw new Error(`Unknown image format for: ${imageId}`);
  }

  const filePath = path.join(uploadDir, imageFile);
  const buffer = fs.readFileSync(filePath);
  const data = buffer.toString('base64');

  return { data, mimeType };
}

/**
 * Build a multimodal HumanMessage with text and image content parts.
 * Uses LangChain standard content block format for cross-provider compatibility.
 */
export function buildMultimodalHumanMessage(
  text: string,
  imageIds: string[],
): HumanMessage {
  const contentParts: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [];

  // Add text part
  if (text) {
    contentParts.push({ type: 'text', text });
  }

  // Add image parts
  for (const imageId of imageIds) {
    try {
      const { data, mimeType } = loadImageAsBase64(imageId);
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${data}`,
        },
      });
    } catch (error) {
      console.warn(`Failed to load image ${imageId}:`, error);
    }
  }

  // If no images loaded successfully, fall back to plain text
  if (contentParts.length === 1 && contentParts[0].type === 'text') {
    return new HumanMessage(text);
  }

  // If no text and no images, return empty text message
  if (contentParts.length === 0) {
    return new HumanMessage(text || '');
  }

  return new HumanMessage({ content: contentParts });
}
