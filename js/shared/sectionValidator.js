/** Section validation — port of section_validator.py */

import { fetchSectionData } from './sectionsApi.js';
import { getRawMetasessionData } from './metasessionApi.js';
import { loadSessionRows } from './sessionCsv.js';

export const SECTIONS_VALIDATION_RESULTS_FILE = 'sections_validation_results.txt';

function metasessionFieldValues(metasessionData) {
  const subjectObj = metasessionData.subject || {};
  const languageObj = metasessionData.language || {};
  const countryObj = metasessionData.country || {};
  const gradeObj = metasessionData.grade || {};
  const termObj = metasessionData.term || {};
  return {
    subject_id: String(subjectObj.id ?? ''),
    subject_name: String(subjectObj.name ?? ''),
    subject_language_iso_code: String(languageObj.iso_code ?? ''),
    term_code: typeof termObj === 'object' && termObj?.id != null ? `t${termObj.id}` : '',
    grade_id: String(gradeObj.id ?? ''),
    grade_url_text: String(gradeObj.url_text ?? ''),
    country_localization_key: String(countryObj.name ?? ''),
    country_iso_code: String(countryObj.iso_code ?? ''),
    language_name: String(languageObj.name ?? ''),
  };
}

function fieldCheckRows(sectionData, metasessionData) {
  const metaVals = metasessionFieldValues(metasessionData);
  const specs = [
    ['subject_id', 'subject_id', 'subject.id'],
    ['subject_name', 'subject_name', 'subject.name'],
    ['subject_language_iso_code', 'subject_language_iso_code', 'language.iso_code'],
    ['term_code', 'term_code', 'term.id (as t{id})'],
    ['grade_id', 'grade_id', 'grade.id'],
    ['grade_url_text', 'grade_url_text', 'grade.url_text'],
    ['country_localization_key', 'country_localization_key', 'country.name'],
    ['country_iso_code', 'country_iso_code', 'country.iso_code'],
    ['language_name', 'language_name', 'language.name'],
  ];
  return specs.map(([secField, metaKey, metaLabel]) => {
    const secStr = String(sectionData[secField] ?? '').trim();
    const metaStr = String(metaVals[metaKey] ?? '').trim();
    let status = 'SKIP';
    if (secStr && metaStr) {
      status = secStr.toLowerCase() === metaStr.toLowerCase() ? 'OK' : 'MISMATCH';
    }
    return {
      field: secField,
      section_label: `section.${secField}`,
      metasession_label: `metasession.${metaLabel}`,
      section_value: secStr || '(empty)',
      metasession_value: metaStr || '(empty)',
      status,
    };
  });
}

function truncate(value, maxLen) {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 3)}...`;
}

async function appendResults(vfs, resultsPath, block) {
  let prev = '';
  try {
    prev = await vfs.readText(resultsPath);
  } catch {
    prev = '';
  }
  await vfs.writeText(resultsPath, prev + block);
}

export async function initSectionsValidationResults(vfs) {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const text = `${'='.repeat(80)}\nSECTION vs METASESSION VALIDATION RESULTS\n${'='.repeat(80)}\nReport started: ${stamp}\nThis file lists every field compared between the QMS section API and the metasession API, plus question_id membership checks.\nQuestion-id checks run from xml_builder after translation (when applicable).\nStatus OK = values match (case-insensitive). MISMATCH = differ.\nSKIP = one or both sides empty; not treated as a failure.\n\n`;
  await vfs.writeText(SECTIONS_VALIDATION_RESULTS_FILE, text);
}

export function applyQuestionIdTransform(sectionMap, transform) {
  if (!transform) return sectionMap;
  const out = {};
  const qidRe = /^(\d{12})/;
  for (const [sectionId, qids] of Object.entries(sectionMap)) {
    const transformed = [];
    for (const q of qids) {
      const raw = transform(q);
      if (!raw) continue;
      const s = String(raw).trim();
      const m = qidRe.exec(s);
      transformed.push(m ? m[1] : s);
    }
    out[sectionId] = transformed;
  }
  return out;
}

export async function collectSectionQuestionMapFromRows(rows) {
  const sectionMap = {};
  for (const row of rows) {
    const sid = String(row.section_id ?? '').trim();
    if (!sid) continue;
    const qid = String(row.question_id ?? '').trim();
    if (!qid) continue;
    const m = /^(\d{12})/.exec(qid);
    if (!sectionMap[sid]) sectionMap[sid] = [];
    sectionMap[sid].push(m ? m[1] : qid);
  }
  return sectionMap;
}

export async function validateSectionAgainstMetasession(
  sectionId,
  metasessionId,
  usedQuestionIds,
  {
    vfs,
    sectionData = null,
    metasessionData = null,
    csvBasename = '',
    questionIdsNote = '',
    fetchFn = fetch,
    log = console.log,
  } = {},
) {
  const errors = [];
  let sectionFetchOk = true;
  let metasessionFetchOk = true;

  if (!sectionData) {
    sectionData = await fetchSectionData(sectionId, { fetchFn });
  }
  if (!sectionData) {
    sectionFetchOk = false;
    errors.push(`[section_id=${sectionId}] Could not fetch section data from QMS API.`);
  }

  if (!metasessionData) {
    metasessionData = await getRawMetasessionData(metasessionId, { fatal: false, log, fetchFn });
  }
  if (!metasessionData) {
    metasessionFetchOk = false;
    errors.push(`[metasession_id=${metasessionId}] Could not fetch metasession data from API.`);
  }

  const fieldRows = sectionFetchOk && metasessionFetchOk
    ? fieldCheckRows(sectionData, metasessionData)
    : [];

  if (sectionFetchOk && metasessionFetchOk) {
    for (const row of fieldRows) {
      if (row.status === 'MISMATCH') {
        errors.push(
          `[section_id=${sectionId}] Mismatch: ${row.section_label}=${JSON.stringify(row.section_value)} vs ${row.metasession_label}=${JSON.stringify(row.metasession_value)}`,
        );
      }
    }
  }

  let apiQuestionIds = new Set();
  if (sectionData && Array.isArray(sectionData.question_ids)) {
    apiQuestionIds = new Set(sectionData.question_ids.map(String));
  }

  const usedUnique = [...new Set(usedQuestionIds.filter(Boolean).map(String))].sort();
  const matchedQids = usedUnique.filter((q) => apiQuestionIds.has(q));
  const missingQids = usedUnique.filter((q) => !apiQuestionIds.has(q));

  if (sectionFetchOk && metasessionFetchOk && missingQids.length) {
    errors.push(
      `[section_id=${sectionId}] ${missingQids.length} question_id(s) used in processing but NOT in section.question_ids: ${JSON.stringify(missingQids)}`,
    );
  }

  if (vfs) {
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const overall = errors.length ? 'FAILED' : 'PASSED';
    let block = `${'-'.repeat(80)}\nChecked at: ${stamp}\n`;
    if (csvBasename) block += `CSV file: ${csvBasename}\n`;
    block += `Metasession ID: ${metasessionId}\nSection ID: ${sectionId}\nOverall: ${overall}\n\n`;
    block += '--- API fetch ---\n';
    block += `  QMS section API (/sections/${sectionId}): ${sectionFetchOk ? 'OK' : 'FAILED'}\n`;
    block += `  Metasession API (id=${metasessionId}): ${metasessionFetchOk ? 'OK' : 'FAILED'}\n\n`;

    if (sectionFetchOk && metasessionFetchOk) {
      block += '--- Metadata cross-check (section vs metasession) ---\n';
      block += `${'Field'.padEnd(28)} | ${'Section (QMS)'.padEnd(24)} | ${'Metasession API'.padEnd(24)} | Status\n`;
      block += `${'-'.repeat(80)}\n`;
      for (const row of fieldRows) {
        block += `${row.field.padEnd(28)} | ${truncate(row.section_value, 22).padEnd(24)} | ${truncate(row.metasession_value, 22).padEnd(24)} | ${row.status}\n`;
      }
      const okCount = fieldRows.filter((r) => r.status === 'OK').length;
      const mismatchCount = fieldRows.filter((r) => r.status === 'MISMATCH').length;
      block += `\nSummary: ${okCount} matched, ${mismatchCount} mismatch(es), ${fieldRows.length - okCount - mismatchCount} skipped.\n\n`;
      block += '--- Question IDs ---\n';
      if (questionIdsNote) block += `  ${questionIdsNote}\n`;
      block += `  Unique question_id(s) checked for this section: ${usedUnique.length}\n`;
      block += `  question_ids returned by section API: ${apiQuestionIds.size}\n`;
      block += `  Used in CSV and listed in section API (matched): ${matchedQids.length}\n`;
      block += `  Used in CSV but NOT in section API (missing): ${missingQids.length}\n\n`;
      if (errors.length) {
        block += '--- Issues ---\n';
        for (const err of errors) block += `  ${err}\n`;
        block += '\n';
      }
    } else {
      for (const err of errors) block += `  Error: ${err}\n`;
      block += '\n';
    }
    await appendResults(vfs, SECTIONS_VALIDATION_RESULTS_FILE, block);
  }

  if (errors.length && vfs) {
    let logText = '';
    try { logText = await vfs.readText('full_log.txt'); } catch { /* */ }
    const chunk = `\n=== Section Validation: section_id=${sectionId}  metasession_id=${metasessionId} ===\n${errors.map((e) => `  ${e}`).join('\n')}\n`;
    await vfs.writeText('full_log.txt', logText + chunk);
  }

  return errors;
}

export async function validateSectionsInCsv(
  ctx,
  csvPath,
  metasessionId,
  {
    questionIdTransform = null,
    questionIdsNote = '',
    fetchFn = null,
    log = null,
  } = {},
) {
  if (!metasessionId) return [];

  const vfs = ctx.vfs || ctx;
  const fetchImpl = fetchFn || ctx.config?.fetchFn || fetch;
  const logFn = log || ctx.log || console.log;

  const rows = await loadSessionRows(vfs, csvPath);
  let sectionMap = await collectSectionQuestionMapFromRows(rows);
  if (!Object.keys(sectionMap).length) {
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await appendResults(
      vfs,
      SECTIONS_VALIDATION_RESULTS_FILE,
      `${'-'.repeat(80)}\nChecked at: ${stamp}\nCSV file: ${csvPath.split('/').pop()}\nMetasession ID: ${metasessionId}\nResult: No section_id values found in this CSV — nothing to validate.\n\n`,
    );
    return [];
  }

  sectionMap = applyQuestionIdTransform(sectionMap, questionIdTransform);
  const metasessionData = await getRawMetasessionData(metasessionId, { fatal: false, log: logFn });
  const allErrors = [];
  for (const [sectionId, qids] of Object.entries(sectionMap)) {
    if (!sectionId) continue;
    const errs = await validateSectionAgainstMetasession(sectionId, metasessionId, qids, {
      vfs,
      metasessionData,
      csvBasename: csvPath.split('/').pop(),
      questionIdsNote,
      fetchFn: fetchImpl,
      log: logFn,
    });
    allErrors.push(...errs);
  }
  return allErrors;
}
