const { app, BrowserWindow, dialog, ipcMain, shell, session, safeStorage } = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let mainWindow;
const ROOT = __dirname;
const ENGINE = path.join(ROOT, 'engine', 'transcribe.py');
const HARDWARE_PROFILE = path.join(app.getPath('userData'), 'hardware-profile.json');
const PROJECT_HISTORY_FILE = path.join(app.getPath('userData'), 'project-history.json');
const LICENSE_FILE = path.join(app.getPath('userData'), 'store-license.dat');
const STORE_SUPABASE_URL = 'https://lhwvxzumettopbydrysl.supabase.co';
const STORE_PUBLISHABLE_KEY = 'sb_publishable_5m7VQ1dQ8jZxMPRmId-SAw_cQsDSzhK';

async function readStoreLicense() {
  try {
    const raw = await fs.readFile(LICENSE_FILE);
    const text = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8');
    const state = JSON.parse(text);
    return state?.active === true && state?.product_slug === 'capsnip' ? state : null;
  } catch { return null; }
}

async function saveStoreLicense(state) {
  const text = JSON.stringify(state);
  const bytes = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text, 'utf8');
  await fs.mkdir(path.dirname(LICENSE_FILE), { recursive: true });
  await fs.writeFile(LICENSE_FILE, bytes);
}

async function getStoreDeviceId() {
  const state = await readStoreLicense();
  if (state?.device_id) return state.device_id;
  const file = path.join(app.getPath('userData'), 'store-device-id');
  let id = await fs.readFile(file, 'utf8').catch(() => '');
  if (!/^[a-f0-9-]{32,64}$/i.test(id)) {
    id = crypto.randomUUID();
    await fs.writeFile(file, id, 'utf8');
  }
  return id;
}

async function readProjectHistory() {
  try {
    const data = JSON.parse(await fs.readFile(PROJECT_HISTORY_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function rememberProject(project, filePath) {
  const updatedAt = project.updatedAt || new Date().toISOString();
  const normalizedPath = path.resolve(filePath).toLowerCase();
  const history = await readProjectHistory();
  const previous = history.find(item => item?.filePath && path.resolve(item.filePath).toLowerCase() === normalizedPath);
  const entry = {
    filePath, name: project.name || path.basename(filePath, path.extname(filePath)),
    mediaPath: project.mediaPath || null, templateName: project.templateName || '',
    duration: Number(project.duration) || 0, createdAt: previous?.createdAt || project.createdAt || updatedAt, updatedAt,
  };
  const next = [entry, ...history.filter(item => item?.filePath && path.resolve(item.filePath).toLowerCase() !== normalizedPath)].slice(0, 100);
  await fs.mkdir(path.dirname(PROJECT_HISTORY_FILE), { recursive: true });
  const temporary = `${PROJECT_HISTORY_FILE}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(next, null, 2), 'utf8');
  await fs.rename(temporary, PROJECT_HISTORY_FILE);
  return entry;
}

async function loadProjectFile(filePath) {
  const contents = await fs.readFile(filePath, 'utf8');
  const project = JSON.parse(contents);
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw new Error('This Capsnip project file is invalid.');
  await rememberProject(project, filePath);
  return { ...project, projectFilePath: filePath, mediaUrl: project.mediaPath ? pathToFileURL(project.mediaPath).href : null };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480, height: 940, minWidth: 1024, minHeight: 650,
    backgroundColor: '#050708', title: 'Capsnip',
    webPreferences: {
      preload: path.join(ROOT, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`Capsnip page load failed (${code}): ${description} · ${url}`);
  });
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`Capsnip preload failed (${preloadPath}):`, error);
  });
  mainWindow.loadFile(path.join(ROOT, 'index.html'));
}

  app.whenReady().then(() => {
  session.defaultSession.on('will-download', async (_event, item) => {
    const defaultFolder = path.join(app.getPath('videos'), 'Capsnip Exports');
    await fs.mkdir(defaultFolder, { recursive: true });
    const choice = await dialog.showSaveDialog(mainWindow, {
      title: 'Save finished caption video',
      defaultPath: path.join(defaultFolder, item.getFilename()),
      filters: [{ name: 'WebM video', extensions: ['webm'] }],
    });
    if (choice.canceled || !choice.filePath) item.cancel();
    else item.setSavePath(choice.filePath);
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('media:choose', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a video or audio file', properties: ['openFile'],
    filters: [{ name: 'Media', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'wav', 'mp3', 'm4a', 'aac'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  return { path: filePath, name: path.basename(filePath), url: pathToFileURL(filePath).href };
});

ipcMain.handle('license:status', async () => ({ active: Boolean(await readStoreLicense()) }));
ipcMain.handle('license:activate', async (_event, suppliedKey) => {
  const key = String(suppliedKey || '').trim().toUpperCase();
  // Local-only preview key. Never accept it from a packaged customer build.
  if (!app.isPackaged && key === 'SNIP-CAP-DEMO-2026-OPEN-TEST') {
    const deviceId = await getStoreDeviceId();
    await saveStoreLicense({ active: true, product_slug: 'capsnip', device_id: deviceId, key_last4: 'TEST', activated_at: new Date().toISOString(), development_preview: true });
    return { active: true, key_last4: 'TEST', development_preview: true };
  }
  if (!/^SNIP-CAP-[A-Z0-9-]{15,36}$/.test(key)) throw new Error('Enter a valid Capsnip activation key from Snip Store.');
  const deviceId = await getStoreDeviceId();
  let response;
  try {
    response = await fetch(`${STORE_SUPABASE_URL}/functions/v1/store-activate-license`, {
      method: 'POST',
      headers: { apikey: STORE_PUBLISHABLE_KEY, Authorization: `Bearer ${STORE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_slug: 'capsnip', license_key: key, device_id: deviceId }),
      signal: AbortSignal.timeout(20000),
    });
  } catch { throw new Error('Could not reach Snip Store. Check your internet connection and try again.'); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.active !== true) throw new Error(result.error || 'This key could not activate Capsnip.');
  await saveStoreLicense({ active: true, product_slug: 'capsnip', device_id: deviceId, key_last4: String(result.key_last4 || key.slice(-4)), activated_at: new Date().toISOString() });
  return { active: true, key_last4: String(result.key_last4 || key.slice(-4)) };
});

ipcMain.handle('media:prepare-preview', async (_event, filePath) => {
  const stat = await fs.stat(filePath);
  const key = crypto.createHash('sha1').update(`${filePath}:${stat.size}:${stat.mtimeMs}`).digest('hex');
  const previewDir = path.join(app.getPath('temp'), 'CapsnipPreviews');
  const previewPath = path.join(previewDir, `${key}.webm`);
  await fs.mkdir(previewDir, { recursive: true });
  try {
    await fs.access(previewPath);
  } catch {
    let lastError = 'Python speech runtime is unavailable.';
    for (const executable of await pythonCandidates()) {
      const result = await run(executable, [path.join(ROOT, 'engine', 'preview_proxy.py'), '--input', filePath, '--output', previewPath], 180000);
      if (result.code === 0) return { path: previewPath, url: pathToFileURL(previewPath).href };
      try { lastError = JSON.parse(result.stdout).error || result.stderr || lastError; }
      catch { lastError = result.stderr || result.stdout || lastError; }
    }
    throw new Error(`Could not prepare this video for preview: ${lastError}`);
  }
  return { path: previewPath, url: pathToFileURL(previewPath).href };
});

ipcMain.handle('project:save', async (_event, project) => {
  let filePath = project.projectFilePath;
  if (!filePath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Capsnip project', defaultPath: `${safeName(project.name || 'Untitled Project')}.capsnip.json`,
      filters: [{ name: 'Capsnip Project', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return null;
    filePath = result.filePath;
  }
  const savedProject = { ...project, app: 'Capsnip', schemaVersion: 1, updatedAt: new Date().toISOString() };
  await fs.writeFile(filePath, JSON.stringify(savedProject, null, 2), 'utf8');
  const historyEntry = await rememberProject(savedProject, filePath);
  return { filePath, historyEntry };
});

ipcMain.handle('project:history', async () => {
  const history = await readProjectHistory();
  const existing = [];
  for (const item of history) {
    try { await fs.access(item.filePath); existing.push(item); } catch { /* Drop projects whose files were moved or deleted. */ }
  }
  if (existing.length !== history.length) {
    await fs.writeFile(PROJECT_HISTORY_FILE, JSON.stringify(existing, null, 2), 'utf8');
  }
  return existing;
});

ipcMain.handle('project:open-history', async (_event, filePath) => {
  const history = await readProjectHistory();
  const entry = history.find(item => item?.filePath && path.resolve(item.filePath).toLowerCase() === path.resolve(String(filePath || '')).toLowerCase());
  if (!entry) throw new Error('This project is no longer in your Capsnip history.');
  return loadProjectFile(entry.filePath);
});

ipcMain.handle('project:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Open Capsnip project', properties: ['openFile'], filters: [{ name: 'Capsnip Project', extensions: ['json'] }] });
  if (result.canceled || !result.filePaths[0]) return null;
  return loadProjectFile(result.filePaths[0]);
});

ipcMain.handle('subtitle:save', async (_event, { text, format, name }) => {
  const ext = format === 'vtt' ? 'vtt' : 'srt';
  const result = await dialog.showSaveDialog(mainWindow, { title: `Export ${ext.toUpperCase()} subtitles`, defaultPath: `${safeName(name || 'captions')}.${ext}`, filters: [{ name: `${ext.toUpperCase()} subtitles`, extensions: [ext] }] });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, text, 'utf8');
  return result.filePath;
});

// Convert the high-quality browser canvas render to a broadly compatible MP4.
ipcMain.handle('render:mp4', async (event, payload) => {
  const bytes = payload?.bytes;
  if (!bytes || !Number(bytes.byteLength)) throw new Error('The rendered video data is empty.');
  const ffmpeg = await ffmpegCandidate();
  if (!ffmpeg) throw new Error('MP4 export needs FFmpeg. Install it or set CAPSNIP_FFMPEG to its executable.');
  const outputDir = await exportDirectory(payload?.outputDir);
  await fs.mkdir(outputDir, { recursive: true });
  const save = await dialog.showSaveDialog(mainWindow, {
    title: 'Export captioned MP4',
    defaultPath: path.join(outputDir, `${safeName(payload.name || 'Capsnip Video')}.mp4`),
    filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
  });
  if (save.canceled || !save.filePath) return { cancelled: true };
  const tempFile = path.join(app.getPath('temp'), `capsnip-${crypto.randomUUID()}.webm`);
  await fs.writeFile(tempFile, Buffer.from(bytes));
  try {
    const quality = payload.quality === 'high' ? '16' : payload.quality === 'small' ? '21' : '18';
    const args = ['-hide_banner', '-y', '-nostats', '-progress', 'pipe:1', '-i', tempFile, '-c:v', 'libx264', '-preset', 'medium', '-crf', quality,
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', save.filePath];
    event.sender.send('render:progress', { percent: 0, message: 'Encoding H.264 MP4…' });
    await new Promise((resolve, reject) => {
      const process = spawn(ffmpeg, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '', lastPercent = 0;
      process.stdout.on('data', chunk => {
        const clipDuration = Math.max(0.01, Number(payload.duration) || 1);
        for (const line of chunk.toString().split(/\r?\n/)) if (line.startsWith('out_time_ms=')) {
          const percent = Math.min(99, Math.floor(Number(line.slice(12)) / 1_000_000 / clipDuration * 100));
          if (percent >= lastPercent + 2) { lastPercent = percent; event.sender.send('render:progress', { percent, message: `Encoding H.264 MP4… ${percent}%` }); }
        }
      });
      process.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-4000); });
      process.on('error', reject);
      process.on('close', code => code === 0 ? resolve() : reject(new Error(stderr || `FFmpeg exited with code ${code}`)));
    });
    event.sender.send('render:progress', { percent: 100, message: 'MP4 export complete.' });
    return { path: save.filePath };
  } finally { await fs.rm(tempFile, { force: true }).catch(() => {}); }
});

async function engineStatus(forceDetect = false) {
  let savedProfile = null;
  if (!forceDetect) {
    try { savedProfile = JSON.parse(await fs.readFile(HARDWARE_PROFILE, 'utf8')); } catch { /* first launch */ }
  }
  const candidates = await pythonCandidates();
  for (const executable of candidates) {
    const result = await run(executable, [ENGINE, savedProfile ? '--install-check' : '--check'], 8000);
    if (result.code === 0) {
      try {
        const status = JSON.parse(result.stdout);
        if (savedProfile) return { ...savedProfile, ...status };
        await fs.mkdir(path.dirname(HARDWARE_PROFILE), { recursive: true });
        const profile = { ...status, detectedAt: new Date().toISOString(), cpuModel: status.cpuModel || 'base', gpuModel: status.gpuModel || 'base' };
        await fs.writeFile(HARDWARE_PROFILE, JSON.stringify(profile, null, 2), 'utf8');
        return profile;
      } catch { /* report below */ }
    }
  }
  return savedProfile ? { ...savedProfile, ready: false, engineInstalled: false, message: 'Speech engine is not installed yet. Use Setup engine in the README.' }
    : { ready: false, device: 'cpu', deviceName: 'CPU', cpuModel: 'base', gpuModel: 'base', recommendedModel: 'base', message: 'Speech engine is not installed yet. Use Setup engine in the README.' };
}
ipcMain.handle('engine:status', async (_event, options = {}) => engineStatus(Boolean(options.forceDetect)));

let transcriptionProcess;
let transcriptionCancelled = false;
ipcMain.handle('engine:transcribe', async (event, options) => {
  if (transcriptionProcess) throw new Error('A transcription is already running.');
  transcriptionCancelled = false;
  const python = (await pythonCandidates())[0];
  const profile = await engineStatus(false);
  // This Windows package is deliberately CPU-only; never select CUDA based
  // on a stale first-run hardware profile from an older installation.
  const selectedDevice = 'cpu';
  const cpuModel = ['tiny', 'base', 'small'].includes(profile.cpuModel) ? profile.cpuModel : 'base';
  const model = cpuModel;
  const nodeRuntime = path.join(ROOT, 'engine', 'swift-node', 'runtime', process.platform === 'win32' ? 'node.exe' : 'node');
  const bundledNode = await fs.access(nodeRuntime).then(() => nodeRuntime).catch(() => process.execPath);
  const ffmpeg = await ffmpegCandidate();
  const args = [ENGINE, '--input', options.path, '--model', model,
    '--cpu-model', cpuModel, '--language', options.language === 'english' ? 'english' : 'hinglish',
    '--device', selectedDevice, '--threads', String(Math.max(1, Math.min(32, Number(profile.cpuThreads) || 4)))];
  return new Promise((resolve, reject) => {
    transcriptionProcess = spawn(python, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: {
      ...process.env, PYTHONIOENCODING: 'utf-8', CAPSNIP_NODE: bundledNode,
      ...(ffmpeg ? { CAPSNIP_FFMPEG: ffmpeg } : {}),
      SNIP_AI_SWIFT_DEVICE: 'cpu'
    } });
    let stdout = '';
    transcriptionProcess.stdout.on('data', chunk => { stdout += chunk.toString(); });
    transcriptionProcess.stderr.on('data', chunk => { event.sender.send('engine:progress', chunk.toString().trim()); });
    transcriptionProcess.on('error', error => { transcriptionProcess = null; reject(error); });
    transcriptionProcess.on('close', code => {
      transcriptionProcess = null;
      if (transcriptionCancelled) { transcriptionCancelled = false; reject(new Error('Transcription cancelled.')); return; }
      try {
        const data = JSON.parse(stdout);
        if (code === 0) resolve(data); else reject(new Error(data.error || `Transcription exited with code ${code}`));
      } catch { reject(new Error(stdout || 'Transcription engine could not start.')); }
    });
  });
});
ipcMain.handle('engine:cancel', () => { if (transcriptionProcess) { transcriptionCancelled = true; transcriptionProcess.kill(); } return true; });
ipcMain.handle('app:open-path', (_event, target) => shell.openPath(target));
ipcMain.handle('app:open-external', (_event, target) => { if (!['mailto:snipaisupport@gmail.com','https://instagram.com/suchsnip'].includes(String(target))) throw new Error('Unsupported external link.'); return shell.openExternal(String(target)); });
ipcMain.handle('app:choose-output-folder', async () => { const result = await dialog.showOpenDialog(mainWindow, { title:'Choose MP4 export folder', properties:['openDirectory','createDirectory'] }); return result.canceled ? null : result.filePaths[0]; });
ipcMain.handle('app:open-data-folder', async (_event, kind) => { const root=app.getPath('userData'); const target=kind==='preview-cache'?path.join(app.getPath('temp'),'CapsnipPreviews'):root; await fs.mkdir(target,{recursive:true}); return shell.openPath(target); });

let motionRenderProcess = null;
let motionRenderCancelled = false;
const snipAiCaptionRenderer = require(path.join(ROOT, 'assets', 'snip-ai-ffmpeg-renderer.cjs'));
const snipAiTemplates = [...require(path.join(ROOT, 'assets', 'snip-ai-caption-templates.js')),...require(path.join(ROOT, 'assets', 'mixed-caption-templates.js'))];
ipcMain.handle('render:snip-ai', async (event, options) => {
  if (motionRenderProcess) throw new Error('A video export is already running.');
  motionRenderCancelled = false;
  const template = snipAiTemplates.find(item => item.id === options?.templateId);
  if (!template) throw new Error('Choose an available FFmpeg caption style.');
  const input = String(options?.inputPath || ''), stat = await fs.stat(input).catch(() => null);
  if (!stat?.isFile()) throw new Error('The source video could not be found.');
  const ffmpeg = await ffmpegCandidate();
  if (!ffmpeg) throw new Error('FFmpeg is unavailable. Install FFmpeg or set CAPSNIP_FFMPEG to its executable.');
  const duration = Math.max(0.05, Number(options.duration) || 0);
  const width = evenDimension(options.width, 1920), height = evenDimension(options.height, 1080);
  const fps = Math.min(60, Math.max(12, Number(options.fps) || 30));
  const customFontFile = resolveCustomCaptionFont(options?.userFontFile);
  const fontFile = customFontFile || path.join(ROOT, 'assets', 'fonts', 'snip-ai', template.ffmpegFontFile || 'Anton.ttf');
  await fs.access(fontFile).catch(() => { throw new Error(`Caption font is missing: ${template.ffmpegFontFile || 'Anton.ttf'}`); });
  const words = [];
  const soundEvents = [];
  for (const segment of Array.isArray(options.segments) ? options.segments : []) {
    const start = Math.max(0, Number(segment.start) || 0), end = Math.min(duration, Number(segment.end) || duration);
    if (end <= start) continue;
    const provided = Array.isArray(segment.words) && segment.words.length ? segment.words : String(segment.text || '').trim().split(/\s+/).filter(Boolean).map((text, index, list) => ({
      text, start: start + (end - start) * index / list.length, end: start + (end - start) * (index + 1) / list.length,
    }));
    for (const word of provided) {
      const pos=segment.position&&Number.isFinite(Number(segment.position.x))&&Number.isFinite(Number(segment.position.y))?{x:Math.max(.06,Math.min(.94,Number(segment.position.x))),y:Math.max(.06,Math.min(.94,Number(segment.position.y)))}:null;
      const item={text:word.text,start:Math.max(start,Number(word.start)||start),end:Math.min(end,Number(word.end)||end),...(pos?{position:pos}:{})};
      if(template.category==='mixed'&&word.fontAsset){const asset=String(word.fontAsset).replace(/\\/g,'/');const fontRoot=path.resolve(ROOT,'assets','fonts');const fontPath=asset.startsWith('windows/')?path.join(process.env.WINDIR||'C:\\Windows','Fonts',path.basename(asset)):path.resolve(fontRoot,asset);if(asset.startsWith('windows/')||fontPath.startsWith(fontRoot+path.sep)){await fs.access(fontPath).catch(()=>{throw new Error(`Mixed caption font is missing: ${path.basename(fontPath)}`)});item.fontFile=fontPath;item.fontFamily=String(word.fontFamily||'sans-serif');item.baseColor=String(word.baseColor||template.primaryColor||'#FFFFFF');item.accentColor=String(word.accentColor||template.accentColor||'#FFE24D');item.fontSize=Math.max(6,Math.round((Number(word.fontSize)||template.fontSize||64)*(Number(options.captionScale)||1)));item.fontWeight=Math.max(100,Math.min(1000,Number(word.fontWeight)||template.weight||800))}}
      words.push(item);
      if(options.soundEffects)soundEvents.push({time:item.start,kind:isCaptionEmphasis(item.text)?'pop':'tick'});
    }
  }
  if (!words.length) throw new Error('Generate timed captions before exporting.');
  const frameChoice = options.frameSize || 'source';
  const reframeMode=options.reframeMode==='fill'?'fill':'fit';
  const sizeFilter = frameChoice === 'source' ? '' : reframeMode==='fill'?`scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,`:`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,`;
  const built = snipAiCaptionRenderer.buildCaptionFilter(words, {
    template:template.engineTemplate,width,height,fontFile,
    ...(options?.primaryColor?{primaryColor:options.primaryColor}:{}),...(options?.accentColor?{accentColor:options.accentColor}:{}),
    ...(options?.revealPace==='slow'?{wordsPerLine:1}:{}),
    secondaryFontFile:template.ffmpegSecondaryFontFile?path.join(ROOT,'assets','fonts','snip-ai',template.ffmpegSecondaryFontFile):undefined,
    fontScale:Math.round(Math.max(.12,Math.min(2.4,Number(options.captionScale)||1))*100),
    verticalPosition:Math.max(.06,Math.min(.94,Number(options.captionPosition?.y)||template.verticalPosition)),
    horizontalPosition:Math.max(.06,Math.min(.94,Number(options.captionPosition?.x)||.5)),
  });
  if (!built.filter) throw new Error('FFmpeg did not produce a caption filter for this clip.');
  const outputDir = await exportDirectory(options?.outputDir);
  await fs.mkdir(outputDir, { recursive:true });
  const destination = await dialog.showSaveDialog(mainWindow, {
    title:'Export MP4 with Snip AI FFmpeg captions',
    defaultPath:path.join(outputDir, `${safeName(options.name || 'Capsnip Snip AI')}.mp4`),
    filters:[{ name:'MP4 video', extensions:['mp4'] }],
  });
  if (destination.canceled || !destination.filePath) return { cancelled:true };
  const crf = options.quality === 'high' ? '16' : options.quality === 'small' ? '21' : '18';
  const vf = `${sizeFilter}${built.filter}`;
  const args = ['-hide_banner','-nostats','-progress','pipe:1','-filter_complex_threads','1','-i',input];
  let audioMap=null,audioFilter=null,soundPath=null;
  if(options.soundEffects&&soundEvents.length){soundPath=path.join(app.getPath('temp'),`Capsnip-word-cues-${crypto.randomUUID()}.wav`);await writeLineTickWav(soundPath,duration,soundEvents);args.push('-i',soundPath);const hasSourceAudio=options.includeAudio!==false&&await hasAudioStream(ffmpeg,input);if(hasSourceAudio)audioFilter=`[0:a]aresample=48000,volume=0.90[originalaudio];[1:a]aresample=48000,volume=1.0[wordcues];[originalaudio][wordcues]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.96[aout]`;else audioFilter='[1:a]aresample=48000,volume=1.0,alimiter=limit=0.96[aout]';audioMap='[aout]';}
  if(audioMap){args.push('-filter_complex',`${audioFilter};[0:v:0]${vf}[outv]`,'-map','[outv]','-map',audioMap)}
  else args.push('-vf',vf,'-map','0:v:0',...(options.includeAudio===false?[]:['-map','0:a?']));
  args.push('-t',duration.toFixed(3),'-r',String(fps),'-fps_mode','cfr',
    '-c:v','libx264','-preset','medium','-crf',crf,'-pix_fmt','yuv420p',...(audioMap||options.includeAudio!==false?['-c:a','aac','-b:a','192k']:[]),'-movflags','+faststart',destination.filePath,'-y');
  event.sender.send('render:progress', { percent:0, message:`Preparing FFmpeg captions · ${template.name}` });
  try {
    await new Promise((resolve, reject) => {
      motionRenderProcess = spawn(ffmpeg,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,FONTCONFIG_FILE:path.join(ROOT,'assets','fonts.conf'),FONTCONFIG_PATH:path.join(ROOT,'assets'),XDG_CACHE_HOME:path.join(app.getPath('userData'),'fontconfig-cache')}});
      if (motionRenderCancelled) motionRenderProcess.kill();
      let stderr='',lastPercent=0;
      motionRenderProcess.stdout.on('data',chunk=>{for(const line of chunk.toString().split(/\r?\n/))if(line.startsWith('out_time_ms=')){const percent=Math.min(99,Math.floor(Number(line.slice(12))/1_000_000/duration*100));if(percent>=lastPercent+2){lastPercent=percent;event.sender.send('render:progress',{percent,message:`Rendering ${template.name} · ${percent}%`})}}});
      motionRenderProcess.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-5000)});
      motionRenderProcess.on('error',error=>{motionRenderProcess=null;reject(error)});
      motionRenderProcess.on('close',code=>{motionRenderProcess=null;if(motionRenderCancelled){resolve();return}if(code===0)resolve();else reject(new Error(stderr.trim()||`FFmpeg exited with code ${code}`))});
    });
    if(motionRenderCancelled){await fs.rm(destination.filePath,{force:true}).catch(()=>{});event.sender.send('render:progress',{percent:0,message:'Export cancelled.'});return{cancelled:true}}
    event.sender.send('render:progress',{percent:100,message:`${template.name} MP4 export complete.`});
    return{cancelled:false,path:destination.filePath,wordCount:built.wordCount,lineCount:built.lineCount};
  } finally { motionRenderCancelled=false;if(soundPath)await fs.rm(soundPath,{force:true}).catch(()=>{}); }
});
const motionTemplates = require(path.join(ROOT, 'assets', 'motion-graphic-templates.js'));
ipcMain.handle('render:motion-graphic', async (event, options) => {
  if (motionRenderProcess) throw new Error('A video export is already running.');
  motionRenderCancelled = false;
  const template = motionTemplates.find(item => item.id === options?.templateId);
  if (!template) throw new Error('Choose one of the 12 Motion Graphic Caption styles.');
  const input = String(options?.inputPath || '');
  const stat = await fs.stat(input).catch(() => null);
  if (!stat?.isFile()) throw new Error('The source video could not be found.');
  const fillPath = path.join(ROOT, 'assets', 'motion-fill', template.fillVideo);
  await fs.access(fillPath);
  const ffmpeg = await ffmpegCandidate();
  if (!ffmpeg) throw new Error('FFmpeg is unavailable. Install FFmpeg or set CAPSNIP_FFMPEG to its executable.');
  const duration = Math.max(0.05, Number(options.duration) || 0);
  const width = evenDimension(options.width, 1920), height = evenDimension(options.height, 1080);
  const captionScale = Math.max(0.12, Math.min(2.4, Number(options.captionScale) || 1));
  const captionPosition = { x:Math.max(0.06,Math.min(0.94,Number(options.captionPosition?.x)||0.5)), y:Math.max(0.06,Math.min(0.94,Number(options.captionPosition?.y)||0.76)) };
  const fps = Math.min(60, Math.max(12, Number(options.fps) || 30));
  const segments = Array.isArray(options.segments) ? options.segments : [];
  const hasDevanagari = segments.some(segment => /[\u0900-\u097f]/.test(`${segment.text || ''} ${(segment.words || []).map(word => word.text || '').join(' ')}`));
  const customFontFile=resolveCustomCaptionFont(options?.userFontFile);
  const fontPath = customFontFile || path.join('C:\\Windows\\Fonts', hasDevanagari ? 'Nirmala.ttc' : template.fontFile);
  await fs.access(fontPath).catch(() => { throw new Error(`Font file is missing: ${template.fontFile}`); });
  const outputDir = await exportDirectory(options?.outputDir);
  await fs.mkdir(outputDir, { recursive: true });
  const destination = await dialog.showSaveDialog(mainWindow, {
    title: 'Export video with Motion Graphic captions',
    defaultPath: path.join(outputDir, `${safeName(options.name || 'Capsnip Motion Caption')}.mp4`),
    filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
  });
  if (destination.canceled || !destination.filePath) return { cancelled: true };

  const workDir = path.join(app.getPath('temp'), `CapsnipRender-${crypto.randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });
  const filterPath = value => String(value).replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\:').replace(/'/g, "\\'");
  const reframeMode=options.reframeMode==='fill'?'fill':'fit';
  const sourceFrameFilter=reframeMode==='fill'?`scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`:`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`;
  const graph = [`[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps},setsar=1[fill]`,
    `color=c=black:s=${width}x${height}:r=${fps}:d=${duration.toFixed(3)}[mask0]`,
    `[0:v]${sourceFrameFilter},fps=${fps},setsar=1[base]`];
  let priorMask = 'mask0', layer = 0, textFileIndex = 0;
  const soundEvents=[];
  for (const segment of segments) {
    const allWords = Array.isArray(segment.words) && segment.words.length ? segment.words : String(segment.text || '').trim().split(/\s+/).map((text, i, words) => ({
      text, start:Number(segment.start) + (Number(segment.end) - Number(segment.start)) * i / words.length,
      end:Number(segment.start) + (Number(segment.end) - Number(segment.start)) * (i + 1) / words.length,
    }));
    const singleWordReveal=options?.revealPace==='slow';
    for (let offset = 0; offset < allWords.length; offset += singleWordReveal?1:6) {
      const words = allWords.slice(offset, offset + (singleWordReveal?1:6));
      if (!words.length) continue;
      const splitAt = words.length <= 4 ? words.length : words.length - 2;
      const lines = [words.slice(0, splitAt), words.slice(splitAt)].filter(line => line.length);
      const segmentPosition=segment.position&&Number.isFinite(Number(segment.position.x))&&Number.isFinite(Number(segment.position.y))?{x:Math.max(.06,Math.min(.94,Number(segment.position.x))),y:Math.max(.06,Math.min(.94,Number(segment.position.y)))}:captionPosition;
      const start = Math.max(0, Number(words[0].start) || 0);
      const end = Math.min(duration, Number(words[words.length - 1].end) || duration);
      if (end <= start) continue;
      if(options.soundEffects)for(const word of words)soundEvents.push({time:Math.max(0,Number(word.start)||start),kind:isCaptionEmphasis(word.text)?'pop':'tick'});
      const size = Math.round(height * template.size / 1080 * captionScale);
      const lineHeight = size * 1.08, blockHeight = lines.length * lineHeight;
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const content = lines[lineIndex].map(word => String(word.text || '').trim().toLocaleUpperCase()).join(' ');
        const textFile = path.join(workDir, `line-${textFileIndex++}.txt`);
        await fs.writeFile(textFile, content, 'utf8');
        const next = `mask${++layer}`;
        const y = lines.length === 1 ? `(h*${segmentPosition.y.toFixed(4)})-text_h/2` : `(h*${segmentPosition.y.toFixed(4)})-${(blockHeight/2).toFixed(2)}+${(lineIndex*lineHeight).toFixed(2)}`;
        const centerX = `(w-text_w)/2+${((segmentPosition.x-0.5)*width).toFixed(2)}`;
        const fontSize = String(size), x = centerX, alpha = '1';
        const enable = `between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})`;
        graph.push(`[${priorMask}]drawtext=fontfile='${filterPath(fontPath)}':textfile='${filterPath(textFile)}':fontcolor=white:borderw=0:fontsize='${fontSize}':x='${x}':y='${y}':alpha='${alpha}':enable='${enable}'[${next}]`);
        priorMask = next;
      }
    }
  }
  graph.push(`[fill][${priorMask}]alphamerge[captionfill]`, `[base][captionfill]overlay=shortest=1:format=auto[outv]`);
  const args = ['-hide_banner','-nostats','-progress','pipe:1','-filter_complex_threads','1','-i',input,'-stream_loop','-1','-i',fillPath];
  let audioMap='0:a?';
  if(options.soundEffects&&soundEvents.length){const soundPath=path.join(workDir,'line-tick.wav');await writeLineTickWav(soundPath,duration,soundEvents);args.push('-i',soundPath);if(options.includeAudio!==false&&await hasAudioStream(ffmpeg,input)){graph.push(`[0:a]aresample=48000,volume=0.90[originalaudio]`,`[2:a]aresample=48000,volume=1.0[linesfx]`,`[originalaudio][linesfx]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.96[aout]`)}else graph.push(`[2:a]aresample=48000,volume=1.0,alimiter=limit=0.96[aout]`);audioMap='[aout]';}
  const crf = options.quality === 'high' ? '16' : options.quality === 'small' ? '21' : '18';
  args.push('-filter_complex',graph.join(';'),'-map','[outv]',...(options.includeAudio===false&&!options.soundEffects?['-an']:['-map',audioMap]),'-t',duration.toFixed(3),'-r',String(fps),'-fps_mode','cfr','-c:v','libx264','-preset','medium','-crf',crf,'-pix_fmt','yuv420p',...(options.includeAudio===false&&!options.soundEffects?[]:['-c:a','aac','-b:a','192k']),'-movflags','+faststart',destination.filePath,'-y');
  const env = { ...process.env, FONTCONFIG_FILE:path.join(ROOT,'assets','fonts.conf'), FONTCONFIG_PATH:path.join(ROOT,'assets'), XDG_CACHE_HOME:path.join(app.getPath('userData'),'fontconfig-cache') };
  event.sender.send('render:progress', { percent:0, message:'Preparing motion graphic render…' });
  try {
    await new Promise((resolve, reject) => {
      motionRenderProcess = spawn(ffmpeg, args, { windowsHide:true, stdio:['ignore','pipe','pipe'], env });
      if (motionRenderCancelled) motionRenderProcess.kill();
      let stderr = '', lastPercent = 0;
      motionRenderProcess.stdout.on('data', chunk => {
        const data = chunk.toString();
        for (const line of data.split(/\r?\n/)) if (line.startsWith('out_time_ms=')) {
          const current = Number(line.slice(12)) / 1000000;
          const percent = Math.min(99, Math.floor(current / duration * 100));
          if (percent >= lastPercent + 2) { lastPercent = percent; event.sender.send('render:progress', { percent, message:`Rendering motion captions… ${percent}%` }); }
        }
      });
      motionRenderProcess.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-4000); });
      motionRenderProcess.on('error', error => { motionRenderProcess = null; reject(error); });
      motionRenderProcess.on('close', code => {
        motionRenderProcess = null;
        if (motionRenderCancelled) { resolve(); return; }
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}`));
      });
    });
    if (motionRenderCancelled) {
      await fs.rm(destination.filePath, { force:true }).catch(()=>{});
      event.sender.send('render:progress', { percent:0, message:'Export cancelled.' });
      return { cancelled:true };
    }
    event.sender.send('render:progress', { percent:100, message:'Motion graphic export complete.' });
    return { cancelled:false, path:destination.filePath };
  } finally { motionRenderCancelled = false; await fs.rm(workDir, { recursive:true, force:true }).catch(()=>{}); }
});
ipcMain.handle('render:cancel', () => {
  motionRenderCancelled = true;
  if (motionRenderProcess) motionRenderProcess.kill();
  return true;
});

async function exportDirectory(requested) { const fallback=path.join(app.getPath('videos'),'Capsnip Exports'); if(requested){const resolved=path.resolve(String(requested));const stat=await fs.stat(resolved).catch(()=>null);if(stat?.isDirectory())return resolved;} return fallback; }
function resolveCustomCaptionFont(relativePath){if(typeof relativePath!=='string'||!relativePath)return null;const root=path.resolve(ROOT,'assets','fonts'),file=path.resolve(root,relativePath),relative=path.relative(root,file);if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||!relative.toLowerCase().endsWith('.ttf'))return null;return file}
async function ffmpegCandidate() {
  const candidates = [process.env.CAPSNIP_FFMPEG, path.join(ROOT,'runtime','ffmpeg.exe'), path.join(app.getPath('userData'),'ffmpeg','ffmpeg.exe'), process.platform==='win32'&&process.env.LOCALAPPDATA?path.join(process.env.LOCALAPPDATA,'Snip AI','windows-runtime','ffmpeg','ffmpeg.exe'):null, 'ffmpeg'].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes(path.sep)) { try { await fs.access(candidate); return candidate; } catch { continue; } }
    return candidate;
  }
  return null;
}
async function hasAudioStream(ffmpeg,input){
  const probe=ffmpeg.includes(path.sep)?path.join(path.dirname(ffmpeg),process.platform==='win32'?'ffprobe.exe':'ffprobe'):'ffprobe';
  return new Promise(resolve=>{let stdout='';let child;try{child=spawn(probe,['-v','error','-select_streams','a:0','-show_entries','stream=index','-of','csv=p=0',input],{windowsHide:true,stdio:['ignore','pipe','ignore']});}catch{return resolve(false)}child.stdout.on('data',chunk=>stdout+=chunk.toString());child.on('error',()=>resolve(false));child.on('close',code=>resolve(code===0&&stdout.trim().length>0));});
}
function isCaptionEmphasis(text){return /^(great|amazing|insane|crazy|massive|powerful|important|awesome|incredible|fantastic|wow|mast|zabardast|bahut|bada|heavy|best|brilliant|perfect|excellent|mindblowing|genius)$/i.test(String(text||'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,''))}
async function writeLineTickWav(file,duration,times){
 const sampleRate=16000,totalFrames=Math.max(1,Math.ceil(duration*sampleRate)),header=Buffer.alloc(44);header.write('RIFF',0);header.writeUInt32LE(36+totalFrames*2,4);header.write('WAVE',8);header.write('fmt ',12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(sampleRate,24);header.writeUInt32LE(sampleRate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(totalFrames*2,40);
 const events=times.map(event=>typeof event==='number'?{time:event,kind:'tick'}:{time:Number(event?.time),kind:event?.kind==='pop'?'pop':'tick'}).filter(event=>Number.isFinite(event.time)&&event.time>=0&&event.time<duration).sort((a,b)=>a.time-b.time).map(event=>({frame:Math.round(event.time*sampleRate),end:Math.round(event.time*sampleRate)+Math.round((event.kind==='pop'?.095:.055)*sampleRate),kind:event.kind}));const handle=await fs.open(file,'w');try{await handle.write(header,0,44,0);const chunkFrames=8192,active=[];let eventIndex=0;for(let offset=0;offset<totalFrames;offset+=chunkFrames){const count=Math.min(chunkFrames,totalFrames-offset),buffer=Buffer.alloc(count*2),limit=offset+count;while(eventIndex<events.length&&events[eventIndex].frame<limit)active.push(events[eventIndex++]);for(const event of active){const begin=Math.max(offset,event.frame),finish=Math.min(limit,event.end);for(let frame=begin;frame<finish;frame++){const t=(frame-event.frame)/sampleRate,envelope=Math.exp(-t*(event.kind==='pop'?38:88)),tone=event.kind==='pop'?Math.sin(2*Math.PI*(190-900*t)*t)+.22*Math.sin(2*Math.PI*1350*t):Math.sin(2*Math.PI*2350*t)+.25*Math.sin(2*Math.PI*3400*t),level=event.kind==='pop'?.52:.62;buffer.writeInt16LE(Math.round(Math.max(-1,Math.min(1,tone*level*envelope))*32767),(frame-offset)*2)}}for(let i=active.length-1;i>=0;i--)if(active[i].end<=limit)active.splice(i,1);await handle.write(buffer,0,buffer.length,44+offset*2)}}finally{await handle.close()}
}
function evenDimension(value, fallback) { const n=Math.max(2,Math.round(Number(value)||fallback));return n%2?n-1:n; }

function safeName(value) { return String(value).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 100) || 'Untitled Project'; }
async function pythonCandidates() {
  const candidates = [process.env.CAPSNIP_PYTHON, path.join(ROOT, '.venv', 'Scripts', 'python.exe'), process.platform === 'win32' ? 'python' : 'python3', 'py'].filter(Boolean);
  const available = [];
  for (const candidate of candidates) {
    if (candidate.includes(path.sep)) {
      try { await fs.access(candidate); available.push(candidate); } catch { /* next candidate */ }
    } else available.push(candidate);
  }
  return available;
}
function run(executable, args, timeoutMs) {
  return new Promise(resolve => {
    const child = spawn(executable, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }); let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); resolve({ code: 1, stdout, stderr: 'timeout' }); }, timeoutMs);
    child.stdout.on('data', c => stdout += c); child.stderr.on('data', c => stderr += c);
    child.on('error', e => { clearTimeout(timer); resolve({ code: 1, stdout, stderr: e.message }); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
