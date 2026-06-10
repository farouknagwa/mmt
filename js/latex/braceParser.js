/**
 * Balanced-brace parser for LaTeX command arguments.
 */

/**
 * Return [openIdx, closeIdx] for the first balanced {...} starting at
 * startSearchIndex, or null if not found.
 * @param {string} text
 * @param {number} startSearchIndex
 * @returns {[number, number] | null}
 */
export function findBraceBounds(text, startSearchIndex = 0) {
  const openBrace = text.indexOf('{', startSearchIndex);
  if (openBrace === -1) return null;

  let balance = 0;
  for (let i = openBrace; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') balance += 1;
    else if (ch === '}') balance -= 1;
    if (balance === 0) return [openBrace, i];
  }
  return null;
}

/**
 * If content contains \\slidestandalone, return only the second {...} argument
 * (avoids double preamble). Otherwise return the full content.
 * @param {string} remoteTexContent
 * @returns {string}
 */
export function extractContentForInjection(remoteTexContent) {
  const cmdStart = remoteTexContent.indexOf('\\slidestandalone');
  if (cmdStart === -1) return remoteTexContent;

  const arg1Bounds = findBraceBounds(remoteTexContent, cmdStart);
  if (!arg1Bounds) return remoteTexContent;

  const arg2Bounds = findBraceBounds(remoteTexContent, arg1Bounds[1] + 1);
  if (!arg2Bounds) return remoteTexContent;

  const [startIdx, endIdx] = arg2Bounds;
  return remoteTexContent.slice(startIdx + 1, endIdx);
}

/**
 * Inject remote content into the second argument of \\slidestandalone{...}{...}.
 * @param {string} localTexContent
 * @param {string} remoteTexContent
 * @returns {{ ok: boolean, content?: string, error?: string }}
 */
export function injectRemoteContent(localTexContent, remoteTexContent) {
  const cmdStart = localTexContent.indexOf('\\slidestandalone');
  if (cmdStart === -1) {
    return { ok: false, error: '\\slidestandalone command not found' };
  }

  const arg1Bounds = findBraceBounds(localTexContent, cmdStart);
  if (!arg1Bounds) {
    return { ok: false, error: 'Could not parse first argument' };
  }

  const arg2Bounds = findBraceBounds(localTexContent, arg1Bounds[1] + 1);
  if (!arg2Bounds) {
    return { ok: false, error: 'Could not parse second argument' };
  }

  const [startIdx, endIdx] = arg2Bounds;
  const content =
    localTexContent.slice(0, startIdx + 1) +
    '\n' +
    remoteTexContent +
    '\n' +
    localTexContent.slice(endIdx);

  return { ok: true, content };
}
