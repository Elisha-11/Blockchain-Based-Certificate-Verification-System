// frontend/src/utils/documentScanner.js
import jsQR from 'jsqr';
import { sha256Hex } from './sha256';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// pdf.js runs parsing off the main thread. Vite resolves the `?url` import to
// the emitted asset path, which keeps the worker working in both `vite dev`
// and a production build — a bare string path breaks in one or the other.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Reads a certificate identifier out of an uploaded certificate document, so a
 * verifier can drop in the PDF or a photo instead of transcribing an ID by
 * hand.
 *
 * Nothing here decides whether a certificate is genuine. All this does is work
 * out WHICH certificate is being presented; authenticity still comes from the
 * registry and the blockchain, exactly as it does for a typed ID. A forged
 * document carrying a real certificate's QR code will resolve to that real
 * certificate — which is why the caller also sends the file's SHA-256, so the
 * document itself is fingerprinted in the verification log.
 */

// The QR code printed on a certificate encodes "<origin>/verify?id=<cert_id>",
// so the id query parameter is the most reliable thing to look for.
const VERIFY_URL_PATTERN = /[?&]id=([A-Za-z0-9-]+)/;

// The exact shape of a generated id: CERT-<millisecond timestamp>-<6 alnum>.
// The length bounds are load-bearing. This pattern is also run against text
// with all whitespace removed, and without them a greedy character class
// swallows whatever word happened to follow the id on the page.
const GENERATED_ID_PATTERN = /CERT-\d{10,16}-[A-Z0-9]{6}/i;

// Looser form for the older institution-prefixed ids (UNZA-2026-TEST001).
// Their length is not fixed, so this one is only trusted where the
// surrounding word boundaries are still intact.
const LEGACY_ID_PATTERN = /\b((?:UNZA|CBU|ECZ|ZAQA)-[A-Za-z0-9]+-[A-Za-z0-9]+)\b/;

// Page widths, in pixels, to rasterize a PDF page to before decoding. The
// printed QR is only 70px on an A4 page, so the page must be rendered well
// above its natural size for the code's modules to survive as distinct
// pixels. Two passes, because the larger one costs real memory and is usually
// not needed.
const PDF_TARGET_WIDTHS = [2400, 3600];

// Only the first few pages are examined. A certificate is a single page, and
// scanning an arbitrarily long PDF would let one upload lock up the tab.
const MAX_PDF_PAGES = 3;

const MAX_FILE_BYTES = 15 * 1024 * 1024;

const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

/**
 * SHA-256 of the uploaded file, as a lowercase hex digest.
 *
 * Sent with the verification request so repeated presentations of the same
 * document file are recognisable in the audit log. Runs entirely in the
 * browser — the file itself is never uploaded anywhere.
 *
 * Prefers Web Crypto, which is hardware-accelerated, but falls back to the
 * JavaScript implementation when it is unavailable. `crypto.subtle` only
 * exists in a secure context (HTTPS or localhost), so it is undefined when
 * this app is opened over http:// on a LAN IP — the normal way a phone
 * reaches it. Both paths produce the same digest.
 *
 * @returns {Promise<string|null>} Hex digest, or null if it could not be computed
 */
export async function fingerprintFile(file) {
  const buffer = await file.arrayBuffer();

  if (globalThis.crypto?.subtle?.digest) {
    try {
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (err) {
      // Some browsers expose subtle but reject it outside a secure context.
      console.warn('[documentScanner] Web Crypto unavailable, using fallback:', err);
    }
  }

  try {
    return sha256Hex(new Uint8Array(buffer));
  } catch (err) {
    // The fingerprint is forensic metadata for the audit log, not part of the
    // authenticity decision, so losing it must never stop a verification.
    console.error('[documentScanner] Could not fingerprint document:', err);
    return null;
  }
}

/**
 * Pulls a certificate id out of text, whether that text came from a decoded QR
 * payload or from a PDF's text layer.
 *
 * The whitespace-stripped pass exists because the certificate number is
 * printed in a narrow `break-all` block, so it wraps across several lines and
 * pdf.js reports each rendered line as its own text item. Joined with spaces
 * the id arrives broken ("CERT-17924 04298839- 29V5HO"), and once the spaces
 * are removed there is no word boundary left in front of it either — which is
 * why GENERATED_ID_PATTERN carries no \b and relies on exact lengths instead.
 */
export function certIdFromText(text) {
  if (!text) return null;

  const squashed = text.replace(/\s+/g, '');

  for (const candidate of [text, squashed]) {
    const url = candidate.match(VERIFY_URL_PATTERN);
    if (url) return url[1];

    const generated = candidate.match(GENERATED_ID_PATTERN);
    if (generated) return generated[0];
  }

  const legacy = text.match(LEGACY_ID_PATTERN) || squashed.match(LEGACY_ID_PATTERN);
  return legacy ? legacy[1] : null;
}

/** Runs jsQR over image data, trying inverted modules too (a photo of a screen). */
function decodeImageData(imageData) {
  for (const inversionAttempts of ['dontInvert', 'attemptBoth']) {
    const found = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts });
    if (found && found.data) return found.data;
  }
  return null;
}

/**
 * Decodes a canvas, retrying on sub-regions when the whole image fails.
 *
 * jsQR has to locate the code before it can read it, and a 70px QR inside a
 * full page is easy to miss. Narrowing to the region where the code is
 * actually printed — the footer, centred — gives the locator far less to sift
 * through and succeeds on pages the whole-image pass gives up on.
 */
function decodeQrFromCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  if (!width || !height) return null;

  const regions = [
    { x: 0, y: 0, w: width, h: height },
    { x: 0, y: Math.floor(height * 0.5), w: width, h: Math.ceil(height * 0.5) },
    {
      x: Math.floor(width * 0.25),
      y: Math.floor(height * 0.55),
      w: Math.ceil(width * 0.5),
      h: Math.ceil(height * 0.45)
    }
  ];

  for (const { x, y, w, h } of regions) {
    if (w < 40 || h < 40) continue;
    const found = decodeImageData(ctx.getImageData(x, y, w, h));
    if (found) return found;
  }
  return null;
}

function canvasFromBitmap(bitmap, targetEdge) {
  const longest = Math.max(bitmap.width, bitmap.height);
  // Never upscale: it adds no detail and multiplies the work.
  const scale = targetEdge ? Math.min(1, targetEdge / longest) : 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas
    .getContext('2d', { willReadFrequently: true })
    .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function scanImage(file, attempts) {
  const bitmap = await createImageBitmap(file);

  try {
    // Full resolution first. Downscaling to 1600px used to be the only pass,
    // which quietly destroyed small printed QR codes in phone photos; the
    // reduced sizes are now fallbacks only, where averaging away camera noise
    // can occasionally help.
    for (const targetEdge of [null, 2000, 1200]) {
      const canvas = canvasFromBitmap(bitmap, targetEdge);
      attempts.push(`image ${canvas.width}x${canvas.height}`);

      const found = certIdFromText(decodeQrFromCanvas(canvas));
      if (found) return found;
    }
    return null;
  } finally {
    if (bitmap.close) bitmap.close();
  }
}

async function scanPdf(file, attempts) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  try {
    const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);

    for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
      const page = await pdf.getPage(pageNum);

      // The text layer first: a PDF printed from this app carries the
      // certificate number as selectable text, which is far cheaper and more
      // reliable than rasterizing and decoding the QR image.
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item) => item.str).join(' ');
      attempts.push(`page ${pageNum} text layer (${textContent.items.length} items)`);

      const fromText = certIdFromText(text);
      if (fromText) return fromText;

      // Scanned or image-only PDFs have no usable text layer, so fall back to
      // rendering the page and decoding the printed QR code.
      const naturalWidth = page.getViewport({ scale: 1 }).width;

      for (const targetWidth of PDF_TARGET_WIDTHS) {
        const viewport = page.getViewport({ scale: targetWidth / naturalWidth });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        await page.render({
          canvasContext: canvas.getContext('2d', { willReadFrequently: true }),
          viewport
        }).promise;

        attempts.push(`page ${pageNum} render ${canvas.width}x${canvas.height}`);

        const fromQr = certIdFromText(decodeQrFromCanvas(canvas));
        if (fromQr) return fromQr;
      }
    }

    return null;
  } finally {
    // Frees the worker's copy of the document; without this a few uploads in
    // one session hold on to a surprising amount of memory.
    await pdf.destroy();
  }
}

/**
 * Extracts the certificate identifier from an uploaded document.
 *
 * @param {File} file - A PDF or image of the certificate
 * @returns {Promise<{cert_id: string, document_sha256: string|null}>}
 * @throws {Error} With a message written for the person doing the verifying
 */
export async function extractCertificateFromFile(file) {
  if (!file) {
    throw new Error('No file selected.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('That file is larger than 15MB. Please upload the certificate on its own.');
  }

  // Extension is checked as well as MIME type, because some browsers report an
  // empty type for files picked from certain sources.
  const looksAccepted =
    ACCEPTED_TYPES.includes(file.type) || /\.(pdf|png|jpe?g|webp)$/i.test(file.name);
  if (!looksAccepted) {
    throw new Error('Please upload the certificate as a PDF, PNG or JPG.');
  }

  // Computed before extraction so the document is fingerprinted even if no
  // certificate code turns out to be readable from it.
  const document_sha256 = await fingerprintFile(file);
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

  // Every pass is recorded so a document that will not scan can be diagnosed
  // from the browser console rather than by guesswork.
  const attempts = [];

  let cert_id;
  try {
    cert_id = isPdf ? await scanPdf(file, attempts) : await scanImage(file, attempts);
  } catch (err) {
    // A corrupt or password-protected file lands here. Surfaced as a readable
    // message rather than the library's internal error text.
    console.error('[documentScanner] Failed to read document:', err, attempts);
    throw new Error(
      'That file could not be read. It may be corrupted or password-protected.',
      { cause: err }
    );
  }

  if (!cert_id) {
    console.warn('[documentScanner] No certificate code found. Passes tried:', attempts);
    throw new Error(
      'No certificate code could be found in that document. Try a sharper photo with the whole QR code visible, or switch to "Enter ID" and type the certificate number printed under the QR code.'
    );
  }

  console.info('[documentScanner] Found', cert_id, 'after', attempts.length, 'pass(es):', attempts);
  return { cert_id: cert_id.toUpperCase(), document_sha256 };
}
