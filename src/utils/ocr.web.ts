import type { OcrElement } from './dtr-layout';

// Web text recognition with Tesseract.js (runs in the browser, free, no server).
// Same export as ocr.ts, so the calculator screen doesn't care which one it gets.
// Note: the first scan downloads the OCR engine and English data from a CDN (a few MB).

const MAX_WIDTH = 2400;

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not open that image.'));
    img.src = uri;
  });
}

// Grayscale + contrast stretch so pen/pencil on paper stands out from the page.
// The size is normalized too (small images are enlarged up to 2x, huge ones shrunk).
async function preprocess(uri: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(uri);
  const scale = Math.min(2, MAX_WIDTH / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  const gray = new Uint8ClampedArray(px.length / 4);
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) {
    const v = Math.round(0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]);
    gray[i] = v;
    hist[v]++;
  }

  // Stretch between the 2nd and 98th percentile of brightness.
  const pick = (frac: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= gray.length * frac) return v;
    }
    return 255;
  };
  const lo = pick(0.02);
  const hi = Math.max(lo + 1, pick(0.98));
  for (let i = 0; i < gray.length; i++) {
    const v = Math.max(0, Math.min(255, ((gray[i] - lo) * 255) / (hi - lo)));
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

type TessWord = { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } };
type TessWorker = {
  setParameters: (p: Record<string, unknown>) => Promise<unknown>;
  recognize: (
    image: unknown,
    options: object,
    output: object
  ) => Promise<{
    data: { blocks: { paragraphs: { lines: { words: TessWord[] }[] }[] }[] | null };
  }>;
  terminate: () => Promise<unknown>;
};
type TessModule = {
  createWorker?: (lang: string) => Promise<TessWorker>;
  PSM?: { SPARSE_TEXT: unknown };
  default?: { createWorker?: (lang: string) => Promise<TessWorker>; PSM?: { SPARSE_TEXT: unknown } };
};

export async function recognizeElements(imageUri: string): Promise<OcrElement[]> {
  const mod = (await import('tesseract.js')) as unknown as TessModule;
  const createWorker = mod.createWorker ?? mod.default?.createWorker;
  if (!createWorker) throw new Error('Could not load the OCR engine.');

  const canvas = await preprocess(imageUri);
  const worker = await createWorker('eng');
  try {
    // Sparse-text mode suits table cells scattered across a page.
    await worker.setParameters({
      tessedit_pageseg_mode: mod.PSM?.SPARSE_TEXT ?? mod.default?.PSM?.SPARSE_TEXT ?? '11',
    });
    const { data } = await worker.recognize(canvas, {}, { blocks: true });

    const elements: OcrElement[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          for (const w of line.words) {
            if (!w.text.trim()) continue;
            elements.push({ text: w.text, left: w.bbox.x0, top: w.bbox.y0, right: w.bbox.x1, bottom: w.bbox.y1 });
          }
        }
      }
    }
    return elements;
  } finally {
    await worker.terminate();
  }
}