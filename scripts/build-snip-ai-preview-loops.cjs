'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const renderer = require('../assets/snip-ai-ffmpeg-renderer.cjs');
const templates = require('../assets/snip-ai-caption-templates.js');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'assets', 'snip-ai-preview-loops');
const ffmpeg = process.env.CAPSNIP_FFMPEG || path.join(process.env.LOCALAPPDATA || '', 'Snip AI', 'windows-runtime', 'ffmpeg', 'ffmpeg.exe');
const duration = 2.6, width = 960, height = 540, fps = 30;
if (!fs.existsSync(ffmpeg)) throw new Error(`FFmpeg not found: ${ffmpeg}`);
fs.mkdirSync(output, { recursive:true });

for (const template of templates) {
  const sample = template.previewText.split(/\s+/), extra = ['DEKHO','YEH','KAISA','ABHI','ACHA','KARO'];
  const tokens = [...sample, ...extra.filter(word => !sample.includes(word))].slice(0, Math.min(6, Math.max(3, template.wordsPerLine)));
  const slot = (duration - 0.3) / tokens.length;
  const words = tokens.map((text,index) => ({ text, start:0.15 + index * slot, end:0.15 + index * slot + slot * 0.94 }));
  const fontFile = path.join(root, 'assets', 'fonts', 'snip-ai', template.ffmpegFontFile);
  const built = renderer.buildCaptionFilter(words, { template:template.engineTemplate, width, height, fontFile, secondaryFontFile:template.ffmpegSecondaryFontFile?path.join(root,'assets','fonts','snip-ai',template.ffmpegSecondaryFontFile):undefined, verticalPosition:template.verticalPosition });
  const destination = path.join(output, `${template.engineTemplate}.mp4`);
  const args = ['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',`color=c=black:s=${width}x${height}:r=${fps}:d=${duration}`,
    '-vf',built.filter,'-an','-t',String(duration),'-r',String(fps),'-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',destination];
  const result = spawnSync(ffmpeg,args,{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
  if (result.error || result.status !== 0) throw new Error(`${template.name}: ${result.error?.message || result.stderr || `FFmpeg exit ${result.status}`}`);
  console.log(`${template.name}: ${path.basename(destination)} (${fs.statSync(destination).size} bytes)`);
}
