/**
 * Port of clean_wrapped_slides.py — AI disabled (ai_choice='none').
 */

import {
  applyGeneralCleaning,
  fixIncludegraphicsPaths,
} from '../latex/texCleaners.js';

/**
 * @param {object} ctx
 * @param {string} slideDir
 * @param {string} slideId
 */
async function processSlide(ctx, slideDir, slideId) {
  const { vfs, log } = ctx;
  const slideTex = `${slideDir}/${slideId}.tex`;

  if (!(await vfs.exists(slideTex))) return;

  let originalContent;
  try {
    originalContent = await vfs.readText(slideTex);
  } catch (e) {
    log(`❌ Error reading ${slideTex}: ${e.message}`);
    return;
  }

  let content = originalContent;
  const changes = [];

  let newContent = fixIncludegraphicsPaths(content, slideId);
  if (newContent !== content) {
    changes.push('Fixed image paths');
    content = newContent;
  }

  newContent = applyGeneralCleaning(content);
  if (newContent !== content) {
    changes.push('Applied general cleaning');
    content = newContent;
  }

  // AI cleaning disabled — ai_choice='none'

  if (content !== originalContent) {
    try {
      await vfs.writeText(slideTex, content);
      log(`✅ Cleaned ${slideId}.tex: ${changes.join(', ')}`);
    } catch (e) {
      log(`❌ Error writing ${slideTex}: ${e.message}`);
    }
  } else {
    log(`⏭️  No changes needed for ${slideId}.tex`);
  }
}

/**
 * @param {object} ctx
 * @param {string} sessionDir
 */
async function processSession(ctx, sessionDir) {
  const { vfs, log } = ctx;
  const sessionName = sessionDir.split('/').pop();
  log(`\n${'='.repeat(60)}`);
  log(`Cleaning session: ${sessionName}`);
  log('='.repeat(60));

  const items = await vfs.listDir(sessionDir);
  const slideDirs = [];

  for (const item of items) {
    const itemPath = `${sessionDir}/${item}`;
    if ((await vfs.isDir(itemPath)) && /^\d{9,}$/.test(item)) {
      slideDirs.push({ path: itemPath, id: item });
    }
  }

  slideDirs.sort((a, b) => a.id.localeCompare(b.id));

  if (!slideDirs.length) {
    log('⚠️  No slide directories found');
    return;
  }

  log(`Found ${slideDirs.length} slide directories`);

  for (const { path, id } of slideDirs) {
    await processSlide(ctx, path, id);
  }

  log(`✅ Completed cleaning session: ${sessionName}`);
}

/**
 * @param {object} ctx
 * @returns {Promise<{ ok: boolean, sessionsProcessed: number }>}
 */
export async function runCleanWrappedSlides(ctx) {
  const { vfs, log, config } = ctx;
  const tempDir = config.filesDir || 'files';

  log('='.repeat(60));
  log('Clean Wrapped Slide TEX Files');
  log('='.repeat(60));
  log('\nAI cleaning disabled - only basic cleaning will be applied');

  if (!(await vfs.isDir(tempDir))) {
    log(`Error: TEMP directory not found: ${tempDir}`);
    return { ok: false, sessionsProcessed: 0 };
  }

  const items = await vfs.listDir(tempDir);
  const sessionDirs = [];
  for (const item of items) {
    const itemPath = `${tempDir}/${item}`;
    if (await vfs.isDir(itemPath)) sessionDirs.push(itemPath);
  }
  sessionDirs.sort();

  if (!sessionDirs.length) {
    log(`No session directories found in ${tempDir}`);
    return { ok: false, sessionsProcessed: 0 };
  }

  log(`Found ${sessionDirs.length} session directories in ${tempDir}`);

  for (const sessionDir of sessionDirs) {
    await processSession(ctx, sessionDir);
  }

  log(`\n${'='.repeat(60)}`);
  log('All sessions cleaned!');
  log(`${'='.repeat(60)}\n`);

  return { ok: true, sessionsProcessed: sessionDirs.length };
}
