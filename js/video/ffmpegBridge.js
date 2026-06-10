/**
 * Lazy ffmpeg.wasm loader and video frame extraction.
 */

/** @type {import('@ffmpeg/ffmpeg').FFmpeg | null} */
let ffmpegInstance = null;
/** @type {Promise<import('@ffmpeg/ffmpeg').FFmpeg> | null} */
let loadPromise = null;

/**
 * @param {object} ctx
 * @param {object} ctx.config
 * @param {string} [ctx.config.ffmpegCoreBaseUrl]
 * @param {Function} ctx.log
 * @returns {Promise<import('@ffmpeg/ffmpeg').FFmpeg>}
 */
export async function getFFmpeg(ctx) {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');

    const ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => {
      if (ctx?.log) ctx.log(`[ffmpeg] ${message}`);
    });

    const base =
      ctx?.config?.ffmpegCoreBaseUrl ||
      'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

/**
 * Extract a single frame at timestampSec from video bytes.
 * @param {object} ctx
 * @param {Uint8Array} videoBytes
 * @param {number} timestampSec
 * @param {string} [videoFileName]
 * @returns {Promise<Uint8Array>} PNG bytes
 */
export async function extractFrame(ctx, videoBytes, timestampSec, videoFileName = 'input.mp4') {
  const ffmpeg = await getFFmpeg(ctx);
  const inputName = videoFileName;
  const outputName = 'frame.png';
  const ts = Math.max(0, timestampSec);

  await ffmpeg.writeFile(inputName, videoBytes);

  const fastCmd = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', ts.toFixed(3),
    '-i', inputName,
    '-frames:v', '1',
    '-q:v', '2',
    outputName,
  ];

  const fallbackCmd = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', inputName,
    '-ss', ts.toFixed(3),
    '-frames:v', '1',
    '-q:v', '2',
    outputName,
  ];

  try {
    await ffmpeg.exec(fastCmd);
  } catch {
    await ffmpeg.deleteFile(outputName).catch(() => {});
    await ffmpeg.exec(fallbackCmd);
  }

  const pngData = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});

  return pngData instanceof Uint8Array ? pngData : new Uint8Array(pngData);
}

/**
 * Reset the lazy loader (e.g. for tests or re-init).
 */
export function resetFFmpeg() {
  ffmpegInstance = null;
  loadPromise = null;
}
