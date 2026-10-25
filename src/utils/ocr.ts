import type { OcrElement } from './dtr-layout';

// Native (Android/iOS) text recognition with on-device ML Kit, flattened to positioned words.
// The web build uses ocr.web.ts instead; Expo picks the right file per platform.
// The native module is loaded lazily so the rest of the app still runs in Expo Go,
// where the module doesn't exist.
export async function recognizeElements(imageUri: string): Promise<OcrElement[]> {
  let recognizeText: (uri: string) => Promise<{
    blocks: { lines: { elements: { text: string; frame: { left: number; top: number; right: number; bottom: number } }[] }[] }[];
  }>;
  try {
    ({ recognizeText } = await import('@infinitered/react-native-mlkit-text-recognition'));
  } catch {
    throw new Error(
      'On-device reading needs a development build, which Expo Go does not include. Use the web version, or build the app with "npx expo run:android".'
    );
  }

  // The scanner may return a bare path; try it as a file:// URI first, then as given.
  const candidates = imageUri.startsWith('/') ? [`file://${imageUri}`, imageUri] : [imageUri];

  let lastError: unknown;
  for (const uri of candidates) {
    try {
      const result = await recognizeText(uri);
      const elements: OcrElement[] = [];
      for (const block of result.blocks) {
        for (const line of block.lines) {
          for (const el of line.elements) {
            elements.push({
              text: el.text,
              left: el.frame.left,
              top: el.frame.top,
              right: el.frame.right,
              bottom: el.frame.bottom,
            });
          }
        }
      }
      return elements;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Text recognition failed.');
}