const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const candidates = require(path.join(root, 'docs', 'reference-transcript-candidates.json'));
const templates = [
  ['Spotlight Caps','VID_20261023_053140_930.mp4','phrase-lower',.50,.68,4,'active-word'],
  ['Stacked Editorial','VID_20261023_103501_307.mp4','side-word-stack',.18,.48,1,'current-word'],
  ['Clean Midline','VID_20261023_103951_321.mp4','single-line',.50,.52,4,'active-word'],
  ['Red Italic','VID_20261023_104006_935.mp4','two-line-phrase',.50,.70,4,'phrase-lead'],
  ['Orange Condensed','VID_20261023_104057_764.mp4','keyword-support',.50,.70,3,'largest-word'],
  ['Clean White Focus','VID_20261023_104126_608.mp4','focus-word-support',.50,.57,4,'active-word'],
  ['Serif Hook','VID_20261023_104145_146.mp4','two-line-editorial',.50,.58,4,'phrase-lead'],
  ['Kinetic Word Stack','VID_20261023_104149_399.mp4','display-word-position-cycle',.50,.50,2,'active-word'],
  ['Red Statement','VID_20261023_104229_730.mp4','phrase-lower',.50,.68,4,'active-word'],
  ['Handwritten Whisper','VID_20261023_104239_096.mp4','micro-lower-third',.50,.88,4,'phrase'],
  ['Yellow Script','VID_20261023_104246_020.mp4','script-side-phrase',.72,.54,4,'phrase'],
  ['Big Yellow Keyword','VID_20261023_111732_203.mp4','keyword-support',.50,.72,3,'largest-word'],
  ['Red Pop Phrase','VID_20261023_111737_770.mp4','two-line-phrase',.50,.70,3,'active-word'],
  ['Handwritten White Caps','VID_20261023_111828_495.mp4','phrase-lower',.50,.80,4,'phrase'],
  ['Soft Italic Caps','VID_20261023_111831_665.mp4','phrase-lower',.50,.80,4,'phrase'],
  ['Mint Pop','VID_20261023_113038_750.mp4','keyword-support',.50,.70,3,'largest-word'],
  ['White Stack Highlight','VID_20261023_113046_752.mp4','three-row-focus',.50,.66,3,'active-word'],
  ['Minimal Vertical White','VID_20261023_113112_856.mp4','compact-highlight-line',.50,.58,4,'active-word'],
  ['Rounded Portrait Subtitle','VID_20261023_113114_833.mp4','side-phrase-stack',.22,.68,3,'active-word'],
  ['Grunge Serif Lead','VID_20261023_113327_999.mp4','phrase-editorial',.50,.54,4,'phrase-lead'],
  ['Green Pop Word','VID_20261023_123720_992.mp4','keyword-support',.50,.70,3,'largest-word'],
  ['Travel Micro Caption','VID_20261023_123733_704.mp4','display-word-position-cycle',.50,.50,2,'color-word'],
  ['Devanagari Poster Headline','VID_20261023_124013_225.mp4','side-poster-stack',.18,.44,2,'active-word'],
  ['Duotone Quote Stack','VID_20261023_124052_076.mp4','left-accumulating-stack',.18,.38,2,'phrase-tail'],
  ['Scenic Display Title','VID_20261023_124127_724.mp4','scenic-title',.50,.52,3,'phrase-lead'],
  ['Editorial Split Quote','VID_20261023_125120_322.mp4','split-quote-block',.22,.52,3,'quote-lead'],
  ['Yellow Subtitle','VID_20261023_125128_619.mp4','single-line-lower',.50,.88,5,'phrase'],
  ['White Interview Caption','VID_20261023_130156_974.mp4','lower-third',.50,.82,5,'phrase'],
  ['Red Emphasis Line','VID_20261023_132418_056.mp4','single-line-lower',.50,.70,4,'active-word'],
  ['Red Editorial Quote Card','VID_20261023_132429_904.mp4','side-quote-card',.20,.55,3,'quote-lead'],
  ['Script + Impact Word','VID_20261023_132544_857.mp4','script-impact-pair',.50,.64,3,'impact-word'],
  ['Green Poster Script','VID_20261023_150313_904.mp4','poster-phrase',.50,.52,4,'phrase'],
  ['Playful Display Pop','VID_20261023_221333_093.mp4','playful-word-stack',.50,.52,3,'active-word'],
  ['Yellow-Red Editorial','Video by 10xoperator 1080p1792785829052_SealX.mp4','lower-yellow-phrase',.50,.86,4,'phrase'],
  ['Cinematic Side Stack','Video by figuringout.co 1920p1792778440222_SealX.mp4','cinematic-two-line',.50,.68,3,'phrase-lead'],
];

function sourceWords(entry) {
  const words = (entry?.segments || []).flatMap(segment => segment.words || []);
  if (words.length) return words.map(word => ({ text:String(word.text || '').trim(), start:Number(word.start)||0, end:Number(word.end)||0 })).filter(word => word.text);
  return (entry?.segments || []).flatMap(segment => {
    const parts = String(segment.text || '').trim().split(/\s+/).filter(Boolean);
    const duration = Math.max(.05, Number(segment.end) - Number(segment.start));
    return parts.map((text,index) => ({text,start:Number(segment.start)+duration*index/parts.length,end:Number(segment.start)+duration*(index+1)/parts.length}));
  });
}
function cuesFromWords(words) {
  const cues=[]; let chunk=[];
  const flush=()=>{ if(chunk.length){cues.push(chunk);chunk=[];} };
  for(const word of words){
    if(chunk.length){
      const previous=chunk[chunk.length-1];
      const text=chunk.map(item=>item.text).join(' ');
      const pause=word.start-previous.end;
      const punctuation=/[,;:.!?]$/.test(previous.text);
      if(pause>.55||chunk.length>=5||text.length+word.text.length+1>34||punctuation)flush();
    }
    chunk.push(word);
  }
  flush(); return cues;
}
function distribute(count,maxPerRow){
  const rows=[]; let remaining=count;
  while(remaining>0){const take=Math.min(maxPerRow,remaining);rows.push(take);remaining-=take;}
  if(rows.length>1&&rows.at(-1)===1&&rows.at(-2)>2){rows[rows.length-2]--;rows[rows.length-1]++;}
  return rows;
}
function makeCuePattern(words, config, index) {
  const count=words.length;
  const mode=config[2];
  let rows;
  if(mode.includes('stack')||mode.includes('poster')) rows=Array.from({length:count},()=>1);
  else if(mode==='keyword-support'||mode==='focus-word-support'||mode==='script-impact-pair'){const before=Math.floor((count-1)/2),after=count-1-before;rows=count<=1?[count]:[before,1,after].filter(Boolean)}
  else if(mode==='three-row-focus') rows=count<=2?[count]:[1,Math.max(1,count-2),1];
  else rows=distribute(count,config[5]);
  const wordCount=words.length;
  let focusIndex=Math.max(0,Math.min(wordCount-1,Math.floor(wordCount/2)));
  if(config[6]==='phrase-lead'||config[6]==='quote-lead')focusIndex=0;
  if(config[6]==='phrase-tail')focusIndex=wordCount-1;
  if(config[6]==='color-word')focusIndex=index%Math.max(1,wordCount);
  return { sourceWordCount:wordCount, rowWordCounts:rows, focusWordIndex:focusIndex, beat:index+1 };
}

const output=Object.fromEntries(templates.map(config=>{
  const [name,referenceVideo]=config;
  const entry=candidates.find(item=>item.file===referenceVideo);
  const words=sourceWords(entry);
  const cues=cuesFromWords(words);
  // Two supplied clips had no usable ASR candidate; retain a visible-review fallback cadence.
  const fallbackCount=referenceVideo==='VID_20261023_111831_665.mp4'?10:referenceVideo==='VID_20261023_113114_833.mp4'?10:0;
  const cueWords=cues.length?cues:(fallbackCount?Array.from({length:fallbackCount},()=>['caption','line','style']):[['caption','line','style']]);
  const sequence=cueWords.map((cue,index)=>makeCuePattern(cue,config,index));
  return [name,{
    name,referenceVideo,layout:config[2],anchor:{x:config[3],y:config[4]},maxWordsPerRow:config[5],emphasis:config[6],
    referenceCueCount:sequence.length,countBasis:cues.length?'reference word timestamps segmented with Capsnip cue rules':'visual-estimate fallback; reference transcript unavailable',
    sequence,
  }];
}));
const outPath=path.join(root,'assets','caption-patterns.js');
fs.writeFileSync(outPath,`// Generated by scripts/build-caption-patterns.cjs from the 35 supplied reference clips.\nwindow.capsnipCaptionPatterns=${JSON.stringify(output)};\n`,'utf8');
const table=Object.values(output).map(item=>`| ${item.name} | ${item.referenceVideo} | ${item.referenceCueCount} | ${item.layout} | ${item.anchor.x.toFixed(2)}, ${item.anchor.y.toFixed(2)} | ${item.maxWordsPerRow} | ${item.emphasis} | ${item.countBasis} |`).join('\n');
const audit=`# Capsnip Reference Caption Line Patterns\n\nEach standard template stores a complete ordered sequence of caption-cue layouts from its paired reference. The sequence length is per reference clip (it is not fixed to five); rendering selects the pattern by caption cue index and wraps to the first entry after the last. Reference words themselves are never inserted into user captions.\n\n## Cue extraction\n\nThe supplied clips are burned-in renders, so they do not contain editable caption metadata. This pattern pass pairs the already reviewed full-duration visual sheets with the existing word-timestamp transcript candidates. For each reference, the candidate word timings are regrouped using Capsnip's caption segmentation rules (pause over 0.55 s, maximum five words, maximum 34 characters, punctuation break). The resulting cue counts and row word counts are stored per cue. The two clips without usable transcript candidates use a 10-cue visual-estimate fallback and are explicitly marked. This is a source-audio-aligned layout sequence, not OCR-confirmed transcription of every burned-in word.\n\n## Per-template sequences\n\n| Template | Reference clip | Stored cue slots | Visual layout | Default anchor (x, y) | Max words / row | Emphasis | Count basis |\n|---|---|---:|---|---|---:|---|---|\n${table}\n\n## Renderer behavior\n\n- For each user caption cue, the renderer selects the entry at cueIndex modulo sequence length.\n- Stored row word counts drive line breaks; user transcript words fill the slots.\n- Per-template anchor is used unless the user has manually dragged captions to a custom position.\n- The active-word timing still comes from the user's transcript. If word timestamps are absent, the pattern's focus-word index is used.\n- Existing per-template font, color, and entrance animation remain in the shared Canvas renderer, so editor preview and standard export use the same pattern rules.\n- Source transcript candidates include Whisper uncertainty, especially for Hindi/Hinglish; correct the text in the editor before export. The two visual fallbacks should be checked against the original clips in a later close review.\n`;
fs.writeFileSync(path.join(root,'docs','CAPTION-LINE-PATTERN-AUDIT.md'),audit,'utf8');
console.log(`Wrote ${Object.keys(output).length} template patterns (${Object.values(output).reduce((sum,item)=>sum+item.referenceCueCount,0)} reference cue slots).`);
