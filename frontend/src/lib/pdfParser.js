// ─────────────────────────────────────────────────────────────────
// lib/pdfParser.js
// Single Responsibility: Extracts text from a PDF file using pdfjs-dist.
// ─────────────────────────────────────────────────────────────────

import * as pdfjsLib from "pdfjs-dist";

// Use the bundled worker from pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

/**
 * Reads a PDF File object and extracts all text content.
 * @param {File} file - The PDF file from an <input type="file"> element
 * @returns {Promise<string>} - The extracted text
 */
export async function extractTextFromPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item) => item.str);
        pages.push(strings.join(" "));
    }

    return pages.join("\n\n");
}
