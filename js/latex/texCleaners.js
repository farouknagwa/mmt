/**
 * Regex-based LaTeX cleaners ported from clean_wrapped_slides.py
 */

export const LATEX_COMMAND_REPLACEMENTS = [
  [['nagwaangle'], '\\AngleNotation'],
  [['nagwacombination'], '\\combination'],
  [['nagwacomplexconjugate'], '\\complexconjugate'],
  [['nagwacrossproduct'], '\\crossproduct'],
  [['nagwafactorial'], '\\factorial'],
  [['nagwainterval', 'nagwaintervalib'], '\\interval'],
  [['nagwalinesegment'], '\\linesegment'],
  [['nagwamatrix'], '\\MatrixNotation'],
  [['nagwadeterminant'], '\\Determinant'],
  [['nagwameasureangle'], '\\measureangle'],
  [['nagwamoment'], '\\moment'],
  [['nagwaparallel'], '\\ParallelNotation'],
  [['nagwapermutation'], '\\permutation'],
  [['nagwaray'], '\\ray'],
  [['nagwasequenceterm'], '\\SequenceTerm'],
  [['nagwasetcomplement'], '\\setcomplement'],
  [['nagwasetminus'], '\\SetMinusNotation'],
  [['nagwastraightline'], '\\StraightLine'],
  [['nagwatriangle'], '\\TriangleNotation'],
  [['nagwaunitvector'], '\\unitvector'],
  [['vec', 'nagwavector'], '\\VectorNotation'],
  [['nagwavectorcomponents'], '\\vectorcomponents'],
  [['nagwavectormagnitude'], '\\vectormagnitude'],
  [['nagward'], '\\RecurringDecimals'],
  [['nagwablue'], 'Blue'],
  [['nagwared'], 'Red'],
  [['nagwagreen'], 'Green'],
];

/**
 * Fix paths in \\includegraphics and \\includesvg — remove slide_id/ prefix.
 * @param {string} content
 * @param {string} slideId
 * @returns {string}
 */
export function fixIncludegraphicsPaths(content, slideId) {
  const pattern = /\\(includegraphics|includesvg)(\[[^\]]*\])?\{([^}]+)\}/g;
  return content.replace(pattern, (match, command, options = '', path) => {
    let cleaned = path.trim();
    const prefix = `${slideId}/`;
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length);
    }
    return `\\${command}${options}{${cleaned}}`;
  });
}

/**
 * Master general cleaning for LaTeX slide content.
 * @param {string} content
 * @returns {string}
 */
export function applyGeneralCleaning(content) {
  let result = content;

  result = result.replace(/\$([»«])\$/g, '$1');
  result = result.replace(/\\begin\{question\}\s*/g, '');
  result = result.replace(/\s*\\end\{question\}/g, '');
  result = result.replace(/ARtextrm/g, 'text');
  result = result.replace(/ENtextrm/g, 'text');
  result = result.replace(/nagwaTextBlankkk/g, 'longblank');
  result = result.replace(/nagwaTextBlankk/g, 'mediumblank');
  result = result.replace(/nagwaTextBlank/g, 'shortblank');

  for (const [sources, replacement] of LATEX_COMMAND_REPLACEMENTS) {
    for (const source of sources) {
      const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\\\?\\b${escaped}\\b`, 'gi');
      result = result.replace(pattern, replacement);
    }
  }

  return result;
}

/**
 * Extract slide content from \\slidestandalone{title}{...}\\end{document}
 * @param {string} texContent
 * @returns {{ preamble: string, slideTitle: string, slideContent: string } | null}
 */
export function extractSlideContent(texContent) {
  const pattern = /(.*?)\\slidestandalone\{([^}]+)\}\{(.*?)\}\\end\{document\}/s;
  const match = texContent.match(pattern);
  if (!match) return null;
  return {
    preamble: match[1],
    slideTitle: match[2],
    slideContent: match[3],
  };
}

/**
 * Reconstruct a TEX file with cleaned slide content.
 * @param {string} preamble
 * @param {string} slideTitle
 * @param {string} slideContent
 * @returns {string}
 */
export function reconstructTexFile(preamble, slideTitle, slideContent) {
  return `${preamble}\\slidestandalone{${slideTitle}}{${slideContent}}\\end{document}`;
}
