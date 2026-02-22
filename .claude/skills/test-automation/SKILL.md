---
name: test-automation
description: Manual testing workflow using static analysis, curl API testing, and playwright-cli browser automation. Use when testing changes, debugging issues, verifying API endpoints, running the dev server, doing end-to-end validation, or when asked to test or verify anything.
---

# Test Automation

This project does not use a formal test framework. Instead, use the following manual testing workflow combining `curl`, `playwright-cli`, and the dev server.

## Prerequisites

1. Start the dev server: `npm run dev`
2. Wait until `curl -s http://localhost:3000/api/config` returns JSON before running tests.
3. Configure models via the Settings page or localStorage before testing LLM-dependent features.

## Layer 1: Static Analysis

Run these first — they catch most issues without needing a running server:

```bash
npx tsc --noEmit                    # TypeScript type-check (must be 0 errors)
npx eslint src/path/to/files...     # Lint changed files (0 errors; warnings OK)
```

## Layer 2: API Endpoint Testing with curl

Test API routes directly to verify backend logic independent of the UI.

**Upload endpoint example:**

```bash
# Upload an image
curl -s -X POST http://localhost:3000/api/uploads/images \
  -F "images=@/path/to/test.png;type=image/png"
# Expected: {"images":[{"imageId":"<hex>","fileName":"...","mimeType":"image/png"}]}

# Serve it back
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:3000/api/uploads/images/<imageId>
# Expected: 200

# Security: invalid IDs must be rejected
curl -s http://localhost:3000/api/uploads/images/notahexid
# Expected: 400
```

**Chat endpoint example:**

```bash
curl -s -m 120 -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message": {"messageId":"test-1","chatId":"test-1","content":"Hello"},
    "focusMode": "chat",
    "history": [],
    "files": [],
    "chatModel": {"provider":"<provider>","name":"<model>"},
    "embeddingModel": {"provider":"<provider>","name":"<model>"},
    "selectedSystemPromptIds": []
  }' | head -20
# Expected: streaming JSON lines with type "response" containing LLM output
```

**Search endpoint example (streaming):**

```bash
curl -s -m 90 -N -X POST http://localhost:3000/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "test query",
    "focusMode": "chat",
    "history": [],
    "stream": true,
    "chatModel": {"provider":"<provider>","name":"<model>"},
    "embeddingModel": {"provider":"<provider>","name":"<model>"}
  }' | head -20
# Expected: JSON lines starting with {"type":"init"}, then {"type":"response",...}
```

**Key patterns:**

- Use `head -N` or `--max-time` to avoid hanging on streaming endpoints.
- The chat endpoint's `Body.message` requires `{messageId, chatId, content}` (not a plain string query).
- The search endpoint takes `query` as a top-level string and supports `"stream": true`.
- Valid focus modes: `webSearch`, `localResearch`, `chat`.
- Check server logs (the dev server terminal) for backend errors and debug output.

## Layer 3: UI Testing with playwright-cli

Use `playwright-cli` for browser automation to test the frontend end-to-end.

**Basic flow:**

```bash
playwright-cli open http://localhost:3000     # Open the app
playwright-cli snapshot                       # Capture page element tree (YAML)
playwright-cli click <ref>                    # Click an element by ref
playwright-cli fill <ref> "text"              # Fill an input
playwright-cli type "text"                    # Type into focused element
playwright-cli press Enter                    # Press a key
playwright-cli screenshot --filename=test.png # Visual screenshot
playwright-cli close                          # Clean up
```

**Settings configuration:**

```bash
playwright-cli open http://localhost:3000/settings
playwright-cli snapshot                       # Find combobox refs
playwright-cli click <provider-combobox-ref>  # Open provider dropdown
playwright-cli click <option-ref>             # Select provider
playwright-cli click <model-combobox-ref>     # Open model dropdown
playwright-cli click <option-ref>             # Select model
```

**Image attachment testing:**

```bash
# Attach an image via the file input
playwright-cli run-code 'async page => {
  const input = await page.$("input[type=file]");
  await input.setInputFiles("path/to/image.png");
}'
playwright-cli snapshot    # Verify thumbnail appeared + send button enabled
playwright-cli click <send-button-ref>
sleep 30
playwright-cli snapshot    # Verify response rendered with image in chat history
```

**Tips:**

- Files passed to `setInputFiles` must be within the workspace root.
- Use `sleep N` between send and snapshot to wait for LLM responses.
- The snapshot YAML shows element refs, text content, and ARIA attributes — use it to find the right element ref for clicks.
- After clicking a focus mode button, check snapshot for the heading text to confirm which mode is selected.

## Layer 4: Creating Test Images Programmatically

When you need a simple test image without external files:

```bash
python3 -c "
import struct, zlib
def png(w,h,color):
    raw = b''.join(b'\x00'+bytes(color)*w for _ in range(h))
    c = zlib.compress(raw)
    def chunk(t,d): n=len(d); return struct.pack('>I',n)+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',c)+chunk(b'IEND',b'')
open('/tmp/blue-test.png','wb').write(png(100,100,(0,0,255)))
"
```

Or use `playwright-cli screenshot` to capture the running app as a test image.

## Debugging Tips

- **0 tokens / "No valid response found"**: Check that `langgraph_node` values in event filtering match the agent framework version. The `langchain` package's `createAgent` uses node name `model_request` (not `agent`).
- **Parse errors after editing**: Run `npx tsc --noEmit` immediately to catch syntax issues.
- **Server logs**: The dev server terminal shows all request logs, agent initialization, tool usage, and errors. Check it when API responses look wrong.
- **Direct LLM test**: If the agent isn't working, test the LLM provider directly with `curl` to isolate whether the issue is in LangChain or the provider.
