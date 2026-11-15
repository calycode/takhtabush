/**
 * Derives every shipped brand raster from the master SVG so the logo lives in
 * one place. Run `pnpm brand:generate` after replacing the master asset.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'util-resources', 'branding', 'takhtabush-logo.svg');
const WEBAPP_PUBLIC = path.join(ROOT, 'packages', 'webapp', 'public');
const DOCS_MEDIA = path.join(ROOT, 'docs', '_media');
const EXTENSION_ASSETS = path.join(ROOT, 'packages', 'browser-extension', 'src', 'assets');

const BRAND_GREEN = '#087F43';
const BRAND_GOLD = '#BA8B35';
const SURFACE = '#f7f8fa';
const MUTED = '#5b6572';

const source = readFileSync(SOURCE);

type RenderOptions = {
   background?: string;
   inset?: number;
};

async function render(size: number, options: RenderOptions = {}): Promise<Buffer> {
   const inset = options.inset ?? 1;
   const inner = Math.max(1, Math.round(size * inset));
   const mark = await sharp(source).resize(inner, inner, { fit: 'contain' }).png().toBuffer();

   if (!options.background) return sharp(mark).resize(size, size).png().toBuffer();

   return sharp({
      create: { width: size, height: size, channels: 4, background: options.background },
   })
      .composite([{ input: mark, gravity: 'center' }])
      .png()
      .toBuffer();
}

async function write(file: string, data: Buffer | string): Promise<void> {
   mkdirSync(path.dirname(file), { recursive: true });
   writeFileSync(file, data);
   console.log(`  ${path.relative(ROOT, file)}`);
}

/** Win32 icon container with PNG payloads (supported since Windows Vista). */
function ico(images: Array<{ size: number; png: Buffer }>): Buffer {
   const header = Buffer.alloc(6);
   header.writeUInt16LE(0, 0);
   header.writeUInt16LE(1, 2);
   header.writeUInt16LE(images.length, 4);

   const entries: Buffer[] = [];
   let offset = header.length + images.length * 16;

   for (const image of images) {
      const entry = Buffer.alloc(16);
      entry.writeUInt8(image.size >= 256 ? 0 : image.size, 0);
      entry.writeUInt8(image.size >= 256 ? 0 : image.size, 1);
      entry.writeUInt8(0, 2);
      entry.writeUInt8(0, 3);
      entry.writeUInt16LE(1, 4);
      entry.writeUInt16LE(32, 6);
      entry.writeUInt32LE(image.png.length, 8);
      entry.writeUInt32LE(offset, 12);
      entries.push(entry);
      offset += image.png.length;
   }

   return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

async function ogImage(): Promise<Buffer> {
   const width = 1200;
   const height = 630;
   const mark = await render(200);
   const copy = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="260">
      <text x="600" y="78" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
         font-weight="700" font-size="72" letter-spacing="-1.5" fill="${BRAND_GREEN}">Takhtabush</text>
      <text x="600" y="146" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
         font-size="26" fill="${MUTED}">A self-hosted flashcard workspace on one Cloudflare Worker.</text>
   </svg>`;
   const copyLayer = await sharp(Buffer.from(copy)).png().toBuffer();

   return sharp({ create: { width, height, channels: 4, background: SURFACE } })
      .composite([
         { input: mark, left: Math.round((width - 200) / 2), top: 128 },
         { input: copyLayer, left: 0, top: 372 },
         {
            input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="6">
            <rect width="120" height="6" rx="3" fill="${BRAND_GOLD}" />
         </svg>`),
            left: Math.round((width - 120) / 2),
            top: 358,
         },
      ])
      .png()
      .toBuffer();
}

async function main(): Promise<void> {
   console.log(`Brand source: ${path.relative(ROOT, SOURCE)}`);

   await write(path.join(WEBAPP_PUBLIC, 'logo.svg'), source);
   await write(path.join(WEBAPP_PUBLIC, 'favicon.png'), await render(32));
   await write(
      path.join(WEBAPP_PUBLIC, 'apple-touch-icon.png'),
      await render(180, { background: '#ffffff', inset: 0.86 }),
   );
   await write(path.join(WEBAPP_PUBLIC, 'icon-192.png'), await render(192));
   await write(path.join(WEBAPP_PUBLIC, 'icon-512.png'), await render(512));
   await write(
      path.join(WEBAPP_PUBLIC, 'icon-maskable-512.png'),
      await render(512, { background: '#ffffff', inset: 0.76 }),
   );

   const icoSizes = [16, 32, 48];
   const icoImages = await Promise.all(
      icoSizes.map(async (size) => ({ size, png: await render(size) })),
   );
   await write(path.join(WEBAPP_PUBLIC, 'favicon.ico'), ico(icoImages));

   await write(path.join(DOCS_MEDIA, 'logo.svg'), source);
   await write(path.join(DOCS_MEDIA, 'logo.png'), await render(512));
   await write(path.join(DOCS_MEDIA, 'favicon.png'), await render(32));
   await write(
      path.join(DOCS_MEDIA, 'apple-touch-icon.png'),
      await render(180, { background: '#ffffff', inset: 0.86 }),
   );
   await write(path.join(DOCS_MEDIA, 'og-image.png'), await ogImage());

   await write(path.join(EXTENSION_ASSETS, 'icon.png'), await render(512));
}

main().catch((error) => {
   console.error('Failed to generate brand assets:', error);
   process.exit(1);
});
