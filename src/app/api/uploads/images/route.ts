import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const uploadDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const images = formData.getAll('images') as File[];

    if (!images.length) {
      return NextResponse.json(
        { message: 'No images provided' },
        { status: 400 },
      );
    }

    const processedImages: {
      imageId: string;
      fileName: string;
      mimeType: string;
    }[] = [];

    for (const image of images) {
      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(image.type)) {
        return NextResponse.json(
          {
            message: `Unsupported image type: ${image.type}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
          },
          { status: 400 },
        );
      }

      // Validate file extension
      const ext = image.name.split('.').pop()?.toLowerCase();
      if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          {
            message: `Unsupported file extension: .${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
          },
          { status: 400 },
        );
      }

      // Validate file size
      if (image.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            message: `File "${image.name}" exceeds maximum size of 10MB`,
          },
          { status: 400 },
        );
      }

      const imageId = crypto.randomBytes(16).toString('hex');
      const uniqueFileName = `${imageId}.${ext}`;
      const filePath = path.join(uploadDir, uniqueFileName);

      const buffer = Buffer.from(await image.arrayBuffer());
      fs.writeFileSync(filePath, new Uint8Array(buffer));

      processedImages.push({
        imageId,
        fileName: image.name,
        mimeType: image.type,
      });
    }

    return NextResponse.json({ images: processedImages });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
}
