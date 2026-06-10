/**
 * JSZip-based PPTX reader — minimal python-pptx-compatible surface for extractCsv.
 *
 * Expects globalThis.JSZip or pass { JSZip } in options.
 */

function localName(el) {
  if (!el) return '';
  return el.localName || String(el.tagName || '').split(':').pop();
}

function findDescendant(node, name) {
  if (!node) return null;
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop();
    if (localName(cur) === name) return cur;
    for (let i = cur.childNodes.length - 1; i >= 0; i -= 1) {
      stack.push(cur.childNodes[i]);
    }
  }
  return null;
}

function findAllDescendants(node, name) {
  const out = [];
  if (!node) return out;
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop();
    if (localName(cur) === name) out.push(cur);
    for (let i = cur.childNodes.length - 1; i >= 0; i -= 1) {
      stack.push(cur.childNodes[i]);
    }
  }
  return out;
}

/**
 * Match python-pptx TextFrame.text: paragraph texts joined by \\n, runs concatenated.
 * @param {Element} txBody
 */
export function collectTextFromTxBody(txBody) {
  if (!txBody) return '';

  const paragraphs = [];
  const walk = (node) => {
    if (!node) return;
    if (localName(node) === 'p') {
      const parts = [];
      const collectRuns = (n) => {
        if (!n) return;
        if (localName(n) === 'br') {
          parts.push('\n');
          return;
        }
        if (localName(n) === 't') {
          parts.push(n.textContent || '');
          return;
        }
        for (const child of n.childNodes) {
          collectRuns(child);
        }
      };
      collectRuns(node);
      paragraphs.push(parts.join(''));
      return;
    }
    for (const child of node.childNodes) {
      walk(child);
    }
  };

  walk(txBody);

  if (paragraphs.length === 0) {
    const parts = [];
    for (const el of txBody.getElementsByTagName('*')) {
      if (localName(el) === 't') parts.push(el.textContent || '');
    }
    return parts.join('');
  }

  return paragraphs.join('\n');
}

function parseRgbFromSpPr(spPr) {
  if (!spPr) return null;
  const srgb = findDescendant(spPr, 'srgbClr');
  if (srgb) {
    const hex = (srgb.getAttribute('val') || '').trim();
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
  }
  const scheme = findDescendant(spPr, 'schemeClr');
  if (scheme) {
    return null;
  }
  return null;
}

function getPlaceholderType(spEl) {
  const nvSpPr = findDescendant(spEl, 'nvSpPr');
  const ph = findDescendant(nvSpPr, 'ph');
  return ph ? (ph.getAttribute('type') || '') : '';
}

function parseShape(spEl) {
  const nvSpPr = findDescendant(spEl, 'nvSpPr');
  const cNvPr = findDescendant(nvSpPr, 'cNvPr');
  const shapeId = cNvPr ? parseInt(cNvPr.getAttribute('id') || '0', 10) : 0;
  const txBody = findDescendant(spEl, 'txBody');
  const hasTextFrame = Boolean(txBody);
  const text = hasTextFrame ? collectTextFromTxBody(txBody) : '';
  const spPr = findDescendant(spEl, 'spPr');
  const fillRgb = parseRgbFromSpPr(spPr);
  const placeholderType = getPlaceholderType(spEl);
  const isTitle = ['title', 'ctrTitle'].includes(placeholderType);

  return {
    shapeId,
    hasTextFrame,
    text,
    fillRgb,
    placeholderType,
    isTitle,
  };
}

function parseSlideXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const spTree = findDescendant(doc.documentElement, 'spTree');
  const spElements = findAllDescendants(spTree, 'sp');

  const shapes = spElements.map(parseShape);
  let titleShape = shapes.find((s) => s.isTitle) || null;
  if (!titleShape) {
    titleShape = shapes.find((s) => s.hasTextFrame && s.text.trim()) || null;
  }

  return {
    shapes,
    titleShape,
  };
}

async function readZipEntryText(zip, path) {
  const file = zip.file(path);
  if (!file) return null;
  return file.async('string');
}

async function resolveSlidePaths(zip) {
  const presXml = await readZipEntryText(zip, 'ppt/presentation.xml');
  const relsXml = await readZipEntryText(zip, 'ppt/_rels/presentation.xml.rels');
  if (!presXml || !relsXml) return [];

  const presDoc = new DOMParser().parseFromString(presXml, 'application/xml');
  const relsDoc = new DOMParser().parseFromString(relsXml, 'application/xml');

  const relMap = new Map();
  for (const rel of relsDoc.getElementsByTagName('*')) {
    if (localName(rel) !== 'Relationship') continue;
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) {
      relMap.set(id, target);
    }
  }

  function relationshipId(el) {
    for (const attr of el.attributes || []) {
      if (attr.localName === 'id' && (attr.prefix === 'r' || attr.name === 'r:id')) {
        return attr.value;
      }
    }
    return el.getAttribute('r:id')
      || el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  }

  function resolveTarget(target) {
    const t = (target || '').replace(/^\.\//, '');
    if (t.startsWith('ppt/')) return t;
    if (t.startsWith('slides/')) return `ppt/${t}`;
    return `ppt/slides/${t}`;
  }

  const slidePaths = [];
  for (const sldId of presDoc.getElementsByTagName('*')) {
    if (localName(sldId) !== 'sldId') continue;
    const rId = relationshipId(sldId);
    if (rId && relMap.has(rId)) {
      slidePaths.push(resolveTarget(relMap.get(rId)));
    }
  }
  return slidePaths;
}

/**
 * Open a PPTX from ArrayBuffer/Uint8Array.
 * @param {ArrayBuffer|Uint8Array} data
 * @param {{ JSZip?: typeof import('jszip') }} [options]
 * @returns {Promise<{ slides: Array<{ shapes: object[], titleShape: object|null }> }>}
 */
export async function openPresentation(data, options = {}) {
  const JSZip = options.JSZip || globalThis.JSZip;
  if (!JSZip) {
    throw new Error('JSZip is required. Load JSZip globally or pass { JSZip } to openPresentation.');
  }

  const zip = await JSZip.loadAsync(data);
  const slidePaths = await resolveSlidePaths(zip);
  const slides = [];

  for (const slidePath of slidePaths) {
    const xml = await readZipEntryText(zip, slidePath);
    if (xml) {
      slides.push(parseSlideXml(xml));
    }
  }

  return { slides };
}

/**
 * Open PPTX via virtual filesystem path (reads binary through vfs.read).
 * @param {object} vfs
 * @param {string} path
 * @param {object} [options]
 */
export async function openPresentationFromVfs(vfs, path, options = {}) {
  const data = await vfs.read(path, { binary: true });
  return openPresentation(data, options);
}
