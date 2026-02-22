import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const uploadDir = path.join(process.cwd(), 'uploads');

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const IMAGE_ID_REGEX = /^[a-f0-9]{32}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ imageId: string }> },
) {
  const { imageId } = await params;

  // Validate imageId format (hex only, no path traversal)
  if (!IMAGE_ID_REGEX.test(imageId)) {
    return NextResponse.json(
      { message: 'Invalid image ID' },
      { status: 400 },
    );
  }

  // Find the image file by scanning for matching prefix
  const files = fs.readdirSync(uploadDir);
  const imageFile = files.find(
    (f) => f.startsWith(imageId + '.') && !f.includes('-'),
  );

  if (!imageFile) {
    return NextResponse.json(
      { message: 'Image not found' },
      { status: 404 },
    );
  }

  const ext = imageFile.split('.').pop()?.toLowerCase();
  const mimeType = ext ? MIME_TYPES[ext] : undefined;

  if (!mimeType) {
    return NextResponse.json(
      { message: 'Unknown image format' },
      { status: 400 },
    );
  }

  const filePath = path.join(uploadDir, imageFile);
  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': fileBuffer.length.toString(),
    },
  });
}
