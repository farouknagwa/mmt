/**
 * Port of run_all.py step 10 — rename session folders to CSV stem and remove CSV.
 */

/**
 * @param {object} ctx
 * @returns {Promise<{ ok: boolean, renamed: number }>}
 */
export async function runRenameSessionFolders(ctx) {
  const { vfs, log, config } = ctx;
  const filesDir = config.filesDir || 'files';

  if (!(await vfs.isDir(filesDir))) {
    log(`Step 10: '${filesDir}/' not found — nothing to rename.`);
    return { ok: true, renamed: 0 };
  }

  let renamed = 0;
  let skippedNoCsv = 0;
  const items = await vfs.listDir(filesDir);

  for (const item of items) {
    if (item.startsWith('.')) continue;
    const itemPath = `${filesDir}/${item}`;
    if (!(await vfs.isDir(itemPath))) continue;

    const entries = await vfs.listDir(itemPath);
    const csvFiles = entries.filter((f) => f.toLowerCase().endsWith('.csv'));
    if (!csvFiles.length) {
      skippedNoCsv += 1;
      log(`Skip ${item}: no CSV in folder (step 5 should copy csvs/ file here).`);
      continue;
    }

    let csvName = csvFiles[0];
    for (const c of csvFiles) {
      const stem = c.replace(/\.csv$/i, '');
      if (stem.startsWith(item)) {
        csvName = c;
        break;
      }
    }

    const csvPath = `${itemPath}/${csvName}`;
    const newName = csvName.replace(/\.csv$/i, '');

    if (newName === item) {
      await vfs.remove(csvPath);
      log(`Removed CSV from already-named folder: ${item}`);
      continue;
    }

    const newPath = `${filesDir}/${newName}`;
    if (await vfs.exists(newPath)) {
      log(`⚠️  Skip ${item}: target folder already exists: ${newName}`);
      continue;
    }

    await vfs.rename(itemPath, newPath);
    await vfs.remove(`${newPath}/${csvName}`);
    log(`Renamed ${item} -> ${newName} and removed CSV`);
    renamed += 1;
  }

  if (renamed === 0 && skippedNoCsv > 0) {
    log(`Step 10: ${skippedNoCsv} session folder(s) had no CSV — rename skipped. Re-run from step 5 after fixing make_files.`);
  } else if (renamed === 0) {
    log('Step 10: No session folders needed renaming.');
  } else {
    log(`Step 10: Renamed ${renamed} session folder(s) and removed CSV(s).`);
  }

  return { ok: true, renamed };
}
