---
name: image-attachments
description: Image attachment feature including upload/serving endpoints, multimodal LLM messages, clipboard paste handling, and UI components. Use when working on image upload, image display, multimodal chat messages, the uploads API, MessageInput image handling, or vision model integration.
---

# Image Attachments

Users can attach images to chat messages via clipboard paste or file picker. Images are stored on disk in the `uploads/` directory (not in SQLite) to avoid database bloat. The feature works across all focus modes.

## Data Flow

1. User pastes/picks image(s) → `POST /api/uploads/images` → saved to `uploads/` with random hex filename → returns `{ images: [{ imageId, fileName, mimeType }] }`
2. Thumbnails shown in MessageInput; user can remove individual images before sending
3. On send, `messageImageIds` and `messageImages` are included in the API payload
4. `chat/route.ts` converts image-bearing messages to multimodal `HumanMessage` with `image_url` content parts (base64 data URLs)
5. Image references are threaded through `MetaSearchAgent` → `AgentSearch` → `SimplifiedAgent`
6. Images are persisted in the user message's `metadata` JSON column for history replay
7. Chat history tuples are extended to `[human, ai, imageIds?]` to carry images across conversation turns

## API Endpoints

- `POST /api/uploads/images` — Upload images (max 10MB each, png/jpg/jpeg/gif/webp)
- `GET /api/uploads/images/[imageId]` — Serve uploaded images with immutable cache headers; validates hex-only imageId to prevent path traversal

## Key Files

- `src/app/api/uploads/images/route.ts` — Upload endpoint
- `src/app/api/uploads/images/[imageId]/route.ts` — Serving endpoint
- `src/lib/utils/images.ts` — `loadImageAsBase64()` and `buildMultimodalHumanMessage()` utilities
- `src/components/MessageInput.tsx` — Paste handler, thumbnail strip, upload logic
- `src/components/MessageInputActions/Attach.tsx` — File picker routes images vs documents
- `src/components/MessageBox.tsx` — Renders image gallery in user messages
- `src/components/ChatWindow.tsx` — `ImageAttachment` type, `pendingImages` state, payload wiring

## Security

- MIME type validation (only image types accepted)
- File size limit (10MB per image)
- Hex-only imageId validation (`/^[a-f0-9]{32}$/`) prevents path traversal
- Images served with correct Content-Type from file extension

## Multimodal Message Construction

The `buildMultimodalHumanMessage()` utility in `src/lib/utils/images.ts`:

1. Takes message content string and array of image IDs
2. Loads each image from disk via `loadImageAsBase64()`
3. Constructs a LangChain `HumanMessage` with `content` array containing:
   - `{ type: "text", text: messageContent }`
   - `{ type: "image_url", image_url: { url: "data:<mime>;base64,<data>" } }` for each image

## Chat History Threading

Chat history tuples are extended from `[human, ai]` to `[human, ai, imageIds?]` so images carry across conversation turns. When replaying history, `buildMultimodalHumanMessage()` is called for messages that have associated image IDs.
