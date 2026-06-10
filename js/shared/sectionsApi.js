/** QMS sections / questions API — port of sections_api.py */

const BASE_URL = 'https://qms-api.nagwa.com/v1';
const DEFAULT_TIMEOUT_MS = 150_000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function requestJson(fetchFn, method, path, { jsonBody = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(`${BASE_URL}/${path.replace(/^\//, '')}`, {
      method,
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: jsonBody != null ? JSON.stringify(jsonBody) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchQuestionsMetadata(questionIds, { fetchFn = fetch, raiseOnError = false } = {}) {
  if (!questionIds?.length) return [];
  try {
    const data = await requestJson(fetchFn, 'POST', '/questions/metadata', {
      jsonBody: { question_ids: questionIds },
    });
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      for (const key of ['questions', 'data', 'results']) {
        if (Array.isArray(data[key])) return data[key];
      }
    }
    throw new Error('Unexpected response shape from /questions/metadata');
  } catch (e) {
    if (raiseOnError) throw e;
    return null;
  }
}

export async function fetchTranslationForParents(
  questionParentIds,
  { translationLanguageIsoCode = 'ar', fetchFn = fetch, raiseOnError = false } = {},
) {
  if (!questionParentIds?.length) return null;
  try {
    return await requestJson(
      fetchFn,
      'POST',
      `/questions/translations?translation-language=${translationLanguageIsoCode}`,
      { jsonBody: { question_parent_ids: questionParentIds } },
    );
  } catch (e) {
    if (raiseOnError) throw e;
    return null;
  }
}

export async function fetchSectionData(sectionId, { fetchFn = fetch, raiseOnError = false } = {}) {
  if (!sectionId) return null;
  try {
    return await requestJson(fetchFn, 'GET', `/sections/${sectionId}`);
  } catch (e) {
    if (raiseOnError) throw e;
    return null;
  }
}

export function translationResponseToParentMap(trans) {
  const out = {};
  if (!trans) return out;
  if (Array.isArray(trans)) {
    for (const item of trans) {
      if (!item || typeof item !== 'object') continue;
      const parent = item.parent_question_id ?? item.parent_id;
      const qid = item.question_id;
      if (parent != null && qid != null) out[String(parent)] = String(qid);
    }
    return out;
  }
  if (typeof trans === 'object') {
    const mapping = trans.translations ?? trans.question_parent_ids ?? trans;
    if (mapping && typeof mapping === 'object' && !Array.isArray(mapping)) {
      for (const [k, v] of Object.entries(mapping)) {
        if (v == null) continue;
        if (typeof v === 'object' && v.question_id != null) out[String(k)] = String(v.question_id);
        else out[String(k)] = String(v);
      }
    } else if (Array.isArray(mapping)) {
      for (const item of mapping) {
        if (!item || typeof item !== 'object') continue;
        const p = item.parent_question_id ?? item.parent_id;
        const q = item.question_id;
        if (p != null && q != null) out[String(p)] = String(q);
      }
    }
  }
  return out;
}
