/**
 * Export virtual filesystem tree as a ZIP download.
 */

function normalizePath(p) {
  return String(p).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '');
}

/**
 * @param {import('./virtualFs.js').VirtualFs} vfs
 * @param {typeof JSZip} JSZipCtor
 * @returns {Promise<Blob>}
 */
export async function buildZipFromVfs(vfs, JSZipCtor) {
  const zip = new JSZipCtor();
  for (const path of vfs.allPaths()) {
    if (path.endsWith('/.keep')) continue;
    const bytes = await vfs.readBytes(path);
    zip.file(path, bytes);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {import('./virtualFs.js').VirtualFs} vfs
 * @param {typeof JSZip} JSZipCtor
 * @param {string} [filename]
 */
export async function downloadVfsAsZip(vfs, JSZipCtor, filename = 'metasession_markup_output.zip') {
  const blob = await buildZipFromVfs(vfs, JSZipCtor);
  downloadBlob(blob, filename);
}
