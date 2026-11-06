(() => {
  const api = window.capsnip || {};
  const activationGate=document.getElementById('activationGate'),activationForm=document.getElementById('activationForm'),activationError=document.getElementById('activationError'),activationSubmit=document.getElementById('activationSubmit');
  if(activationGate){void Promise.resolve(api.getLicenseStatus?.()).then(state=>{if(state?.active)activationGate.hidden=true}).catch(()=>{});activationForm?.addEventListener('submit',async event=>{event.preventDefault();if(!api.activateLicense){activationError.textContent='This Capsnip build needs an update to activate licenses.';return}activationSubmit.disabled=true;activationSubmit.textContent='Checking activation key…';activationError.textContent='';try{await api.activateLicense(document.getElementById('activationKey').value);activationGate.hidden=true;toast('Capsnip activated for this computer.')}catch(error){activationError.textContent=error?.message||'Activation failed. Check the key and try again.'}finally{activationSubmit.disabled=false;activationSubmit.textContent='Activate and open Capsnip'}})}
  const preview = document.querySelector('.preview');
  const captionField = document.getElementById('script');
  document.querySelectorAll('.nav[data-page]').forEach(button => button.addEventListener('click', () => go(button.dataset.page)));
  const mediaInput = document.createElement('input');
  mediaInput.type = 'file';
  mediaInput.accept = 'video/*,audio/*';
  mediaInput.hidden = true;
  document.body.appendChild(mediaInput);

  let media = null;
  let renderedVideoPath = null;
  let exportState = 'idle';
  let exportRequestActive = false;
  function setExportState(state) {
    exportState = state;
    const button = document.getElementById('exportVideoButton');
    if (button) { button.disabled = state === 'rendering'; button.textContent = state === 'rendering' ? 'Rendering MP4…' : state === 'exported' ? '✓ Exported · Export again' : '✧　Export video'; }
    const cancel = document.getElementById('cancelRender');
    if (cancel) { cancel.hidden = state !== 'rendering'; cancel.disabled = false; }
  }
  function pauseExportMedia() {
    video?.pause(); renderedPreviewVideo?.pause(); motionFillVideo.pause();
    document.getElementById('exportVideoPreview')?.pause();
    stopCaptionPreviewFrames();
  }
  function completeExport(path) {
    const parts = String(path).replace(/\\/g, '/').split('/');
    renderedVideoPath = `file:///${parts.map((part,index)=>index===0?part:encodeURIComponent(part)).join('/')}`;
    pauseExportMedia();
    const outputVideo = document.getElementById('exportVideoPreview');
    if (outputVideo) { outputVideo.loop = false; outputVideo.autoplay = false; outputVideo.src = renderedVideoPath; outputVideo.load(); }
    showRenderedEditorPreview(renderedVideoPath);
    pauseExportMedia();
    setExportState('exported');
    const label = document.getElementById('renderText'), bar = document.getElementById('renderProgressBar');
    if (label) label.textContent = '✓ Exported · MP4 saved';
    if (bar) bar.style.width = '100%';
  }
  let video = null;
  let renderedPreviewVideo = null;
  const motionMaskPreview = document.getElementById('motionMaskPreview');
  let motionMaskCanvas = null;
  let motionMaskContext = null;
  let motionFillPath = '';
  const motionFillVideo = document.createElement('video');
  motionFillVideo.muted = true; motionFillVideo.loop = true; motionFillVideo.playsInline = true; motionFillVideo.preload = 'auto';
  motionFillVideo.addEventListener('loadeddata',()=>updateCaptionPreview());
  motionFillVideo.style.display = 'none'; document.body.appendChild(motionFillVideo);
  let duration = 0;
  let projectName = 'First Project';
  let currentProjectFilePath = null;
  let engine = (()=>{try{return JSON.parse(localStorage.getItem('capsnip.deviceProfile')||'null')||{ready:false,device:'cpu',model:'base'}}catch{return{ready:false,device:'cpu',model:'base'}}})();
  let captionSegments = [];
  let selectedPositionIndex = -1;
  let captionPositionMode=localStorage.getItem('capsnip.positionMode')==='line'?'line':'all';
  let appliedTemplate = null;
  let captionEditsPending = false;
  let captionStyleOverrides=(()=>{try{return JSON.parse(localStorage.getItem('capsnip.styleOverrides')||'{}')}catch{return{}}})();
  Object.values(captionStyleOverrides).forEach(style=>{if(style&&(!style.revealPace||style.revealPace==='readable'))style.revealPace='stacked'});
  localStorage.setItem('capsnip.styleOverrides',JSON.stringify(captionStyleOverrides));
  const captionDemo = document.getElementById('captionDemo');
  if (captionDemo) captionDemo.style.display = 'none';
  let captionPositionWasManuallySet=localStorage.getItem('capsnip.captionPosition')!==null;
  let captionPosition = JSON.parse(localStorage.getItem('capsnip.captionPosition') || '{"x":0.5,"y":0.76}');
  let captionScale = Number(localStorage.getItem('capsnip.captionScale') || 1);
  const captionDragHit = document.getElementById('captionDragHit');
  const captionResizeHandle = document.getElementById('captionResizeHandle');
  let lastTickWord = -1;
  let previewAudioContext=null,previewAudioSource=null,previewAudioSourceElement=null,lastPreviewSfxKey='';
  let captionPreviewFrame=0;
  const captionFontFamilies=['Anton','Aldrich','Righteous','Bowlby One SC','Oswald','League Gothic','Boldonse','Plaster','Vina Sans','Viga','Monoton','Bodoni Moda','Silkscreen','Mouse Memoirs','Special Elite','Limelight','Freeman','Rock Salt','Moo Lah Lah','Barriecito','Over the Rainbow','Aladin','Barrio','Bubblegum Sans','Snip AI Poppins','Snip AI League Spartan','Snip AI Anton','Snip AI Alfa Slab One','Snip AI Nunito','Snip AI Kanit','Snip AI Teko','Snip AI Rubik','Snip AI Oswald','Snip AI Bebas Neue'];
  void Promise.allSettled(captionFontFamilies.map(family=>document.fonts.load(`900 28px '${family}'`))).then(()=>{window.refreshCapsnipTemplatePreviews?.();updateCaptionPreview?.()});
  function renderTranscriptRows(){
    const host=document.getElementById('transcriptRows'); if(!host)return; host.innerHTML='';
    if(!captionSegments.length){host.innerHTML='<div class="empty-transcript">Import a clip, then generate captions.</div>';updateLinePositionControls();return}
    if(selectedPositionIndex<0||selectedPositionIndex>=captionSegments.length)selectedPositionIndex=0;
    captionSegments.forEach((segment,index)=>{const row=document.createElement('div');row.className=`transcript-row${index===selectedPositionIndex?' selected-line':''}`;row.innerHTML=`<time>${formatTime(segment.start)}</time><input class="transcript-line-text" aria-label="Caption ${index+1}" value=""><button class="move-line-button" type="button" aria-label="Choose position for caption ${index+1}">↗ Move</button>`;const input=row.querySelector('input'),move=row.querySelector('.move-line-button');input.value=segment.text||'';input.addEventListener('focus',()=>selectLineForPosition(index));input.addEventListener('input',()=>{captionSegments[index].words=retimeEditedWords(segment,input.value);captionSegments[index].text=input.value;captionField.value=captionSegments.map(x=>x.text).join('\n');updateCaptionPreview()});move.addEventListener('click',event=>{event.stopPropagation();captionPositionMode='line';localStorage.setItem('capsnip.positionMode','line');selectLineForPosition(index)});row.addEventListener('click',()=>selectLineForPosition(index));host.appendChild(row)});
    updateLinePositionControls();
  }
  function referencePattern(name,index=0){const set=(window.capsnipCaptionPatterns||{})[name];if(!set?.sequence?.length)return null;return{set,cue:set.sequence[((Math.max(0,index)%set.sequence.length)+set.sequence.length)%set.sequence.length]}}
  function patternPosition(name,index=0){const pattern=referencePattern(name,index);return !captionPositionWasManuallySet&&pattern?.set.anchor?pattern.set.anchor:captionPosition}
  function captionPositionFor(index,name=appliedTemplate){const position=captionSegments[index]?.position;if(position&&Number.isFinite(Number(position.x))&&Number.isFinite(Number(position.y)))return{x:Number(position.x),y:Number(position.y)};return patternPosition(name,index)}
  function selectLineForPosition(index){if(index<0||index>=captionSegments.length)return;if(captionPositionMode==='line')clearRenderedEditorPreview();selectedPositionIndex=index;const segment=captionSegments[index];document.querySelectorAll('.transcript-row').forEach((row,rowIndex)=>row.classList.toggle('selected-line',rowIndex===index));if(captionPositionMode==='line'&&video&&Number.isFinite(Number(segment.start))){video.pause();video.currentTime=Number(segment.start)}updateCaptionPreview()}
  function updateLinePositionControls(){const title=document.getElementById('linePositionTitle'),grid=document.getElementById('linePositionGrid'),segment=captionSegments[selectedPositionIndex],allButton=document.getElementById('positionAllMode'),lineButton=document.getElementById('positionLineMode'),instructions=document.getElementById('positionInstructions'),reset=document.getElementById('resetLinePosition');if(!title||!grid)return;title.textContent=captionPositionMode==='all'?'All captions':segment?`Line ${selectedPositionIndex+1} · ${formatTime(segment.start)}`:'Choose a line';allButton?.classList.toggle('active',captionPositionMode==='all');lineButton?.classList.toggle('active',captionPositionMode==='line');if(instructions)instructions.innerHTML=captionPositionMode==='all'?'<strong>Move every caption</strong>Drag the caption on the video or tap a spot. This becomes the default position for every line.':'<strong>Move only the selected line</strong>Choose a transcript row first, then drag the caption or tap a position.';if(reset)reset.disabled=captionPositionMode!=='line'||!segment||!segment.position;grid.querySelectorAll('button').forEach(button=>{button.disabled=captionPositionMode==='line'&&!segment;button.classList.remove('active');const position=captionPositionMode==='line'&&segment?.position?segment.position:captionPosition,x=Number(button.dataset.x),y=Number(button.dataset.y);if(Math.abs(position.x-x)<.16&&Math.abs(position.y-y)<.16)button.classList.add('active')})}
  updateLinePositionControls();
  function updateCaptionPreview(){if(renderedPreviewVideo){if(motionMaskPreview)motionMaskPreview.style.display='none';if(captionDragHit)captionDragHit.style.display='none';if(captionResizeHandle)captionResizeHandle.style.display='none';return}const t=video?.currentTime||0;const segmentIndex=captionSegments.findIndex(x=>t>=x.start&&t<=captionDisplayEnd(x)),segment=segmentIndex>=0?captionSegments[segmentIndex]:null;const theme=(window.capsnipThemes||[]).find(x=>x.name===appliedTemplate),position=captionPositionFor(segmentIndex);if(captionDemo)captionDemo.style.display='none';const visible=Boolean(segment&&appliedTemplate&&theme);if(motionMaskPreview){motionMaskPreview.style.display=visible?'block':'none';if(visible){const rect=preview.getBoundingClientRect(),dpr=localStorage.getItem('capsnip.previewQuality')==='balanced'?Math.min(1,window.devicePixelRatio||1):Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(motionMaskPreview.width!==w||motionMaskPreview.height!==h){motionMaskPreview.width=w;motionMaskPreview.height=h}const ctx=motionMaskPreview.getContext('2d');ctx?.clearRect(0,0,w,h);if(theme.category==='motion-graphic'){ensureMotionFillVideo(theme);drawVideoFilledCaption(ctx,segment,t,w,h,theme,motionFillVideo,position,captionScale)}else drawCaption(ctx,segment,t,w,h,appliedTemplate,position,captionScale,segmentIndex)}}if(captionDragHit)captionDragHit.style.display=visible?'block':'none';if(captionResizeHandle)captionResizeHandle.style.display=visible?'block':'none';if(captionDragHit){captionDragHit.style.left=`${position.x*100}%`;captionDragHit.style.top=`${position.y*100}%`}if(captionResizeHandle){captionResizeHandle.style.left=`${position.x*100}%`;captionResizeHandle.style.top=`${Math.max(.02,position.y-.055*captionScale)*100}%`}const captionTrack=document.querySelector('.track.caption');if(captionTrack?.parentElement)captionTrack.parentElement.style.display=appliedTemplate?'flex':'none';if(segment){if(captionTrack)captionTrack.textContent=`Aa　${formatTime(segment.start)}　${segment.text}`;const timing=document.querySelector('.track.caption + .smallmuted');if(timing)timing.textContent=`${formatTime(segment.start)} — ${formatTime(segment.end)}`}updateLinePositionControls()}
  function seekToFirstCaption(){if(!video||!captionSegments.length)return;const first=captionSegments.find(segment=>Number.isFinite(Number(segment.start))&&Number.isFinite(Number(segment.end)));if(!first)return;const start=Math.max(0,Math.min(Math.max(0,(duration||video.duration||first.end)-.02),Number(first.start)+.01));try{video.currentTime=start}catch{}syncTimeline();updateCaptionPreview()}
  function followMotionVideoFrames(source){if(source!==video||captionPreviewFrame)return;let lastFrame=0;const paint=now=>{if(video!==source||source.paused){captionPreviewFrame=0;return}if(now-lastFrame>=1000/60){lastFrame=now;updateCaptionPreview();syncTimeline();playPreviewWordCue(source.currentTime)}captionPreviewFrame=requestAnimationFrame(paint)};captionPreviewFrame=requestAnimationFrame(paint)}
  function stopCaptionPreviewFrames(){if(captionPreviewFrame){cancelAnimationFrame(captionPreviewFrame);captionPreviewFrame=0}updateCaptionPreview()}

  const nameField = document.getElementById('topTitle');
  function setProjectTitle(value) {
    projectName = value || 'Untitled Project';
    nameField.textContent = `${projectName}　⌄`;
  }
  async function pickFile() {
    if (typeof api.chooseMedia === 'function') {
      try {
        const item = await api.chooseMedia();
        if (item) loadMedia(item);
        return;
      } catch (error) {
        console.error('Capsnip file picker failed:', error);
        toast('Desktop picker failed. Opening the alternate file picker…');
        mediaInput.value = '';
        mediaInput.click();
        return;
      }
    }
    mediaInput.value = '';
    mediaInput.click();
  }
  async function ensurePreviewFallback(item, sourceVideo) {
    if (!item.path || !api.preparePreview || item.previewProxy) return Boolean(item.previewProxy);
    if (item.previewTask) return item.previewTask;
    item.previewTask = (async () => {
      try {
        toast('Preparing a compatible local preview…');
        const proxy = await api.preparePreview(item.path);
        if (video !== sourceVideo) return false;
        item.previewProxy = true;
        await new Promise((resolve, reject) => {
          sourceVideo.addEventListener('canplay', resolve, { once: true });
          sourceVideo.addEventListener('error', () => reject(new Error('Converted preview could not be decoded.')), { once: true });
          sourceVideo.src = proxy.url;
          sourceVideo.load();
        });
        return true;
      } catch (error) {
        item.previewProxy = false;
        item.previewTask = null;
        toast(error.message || 'This media file could not be previewed.');
        return false;
      }
    })();
    return item.previewTask;
  }
  function loadMedia(item, preserveTranscript = false) {
    if (!item || (!item.url && !item.file)) {
      toast('The selected file could not be opened. Try importing it again.');
      return;
    }
    clearRenderedEditorPreview();
    media = item;
    renderedVideoPath = null;
    if (!preserveTranscript) {
      currentProjectFilePath = null;
      captionField.value = '';
      captionSegments = [];
      captionEditsPending = false;
      appliedTemplate = null;
      document.getElementById('captionDemo').innerHTML = '<small>CAPTIONS</small><strong>READY</strong><small>WHEN YOU ARE</small>';
    }
    const url = item.url || URL.createObjectURL(item.file);
    if (video) video.remove();
    video = document.createElement('video');
    video.src = url;
    video.preload = 'metadata';
    video.playsInline = true;
    video.addEventListener('timeupdate',()=>{updateCaptionPreview();syncTimeline();updateExportPreview()});
    video.addEventListener('play',()=>{if(document.getElementById('tickEffects')?.classList.contains('on')){try{previewAudioContext??=new AudioContext();previewAudioContext.resume()}catch{}}followMotionVideoFrames(video)});
    video.addEventListener('pause',stopCaptionPreviewFrames);
    video.addEventListener('seeked',()=>updateCaptionPreview());
    video.addEventListener('play',()=>{const button=document.querySelector('.playmini');if(button)button.textContent='Ⅱ'});
    video.addEventListener('pause',()=>{const button=document.querySelector('.playmini');if(button)button.textContent='▶'});
    video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:0;background:#050708';
    preview.insertBefore(video, preview.querySelector('.preview-label'));
    preview.querySelector('.scene').style.display = 'none';
    video.addEventListener('loadedmetadata', () => {
      duration = video.duration || 0;
      document.querySelector('.timebar').style.display='flex';if(seekTrack)seekTrack.style.display='block';
      const label = preview.querySelector('.preview-label');
      label.textContent = `◉ ${item.name}　·　${formatTime(duration)}`;
      fitPreviewToSource();
      syncTimeline();
      const end = document.querySelector('.smallmuted');
      if (end) end.textContent = `${formatTime(duration)} total`;
      toast(`Loaded ${item.name}`);
    }, { once: true });
    video.addEventListener('error', async () => {
      const failedVideo = video;
      void ensurePreviewFallback(item, failedVideo);
    }, { once: true });
    setProjectTitle(item.name.replace(/\.[^.]+$/, ''));
    go('editor');
  }
  function showRenderedEditorPreview(url){
    clearRenderedEditorPreview();if(!url||!preview)return;
    renderedPreviewVideo=document.createElement('video');renderedPreviewVideo.src=url;renderedPreviewVideo.controls=false;renderedPreviewVideo.playsInline=true;renderedPreviewVideo.preload='metadata';renderedPreviewVideo.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:0;background:#050708';
    const resultVideo=renderedPreviewVideo;renderedPreviewVideo.addEventListener('loadedmetadata',()=>{if(renderedPreviewVideo!==resultVideo)return;preview.querySelector('.preview-label').textContent=`◉ Final MP4 · ${formatTime(resultVideo.duration)}`;fitPreviewToSource();});
    renderedPreviewVideo.addEventListener('play',()=>{if(document.querySelector('.playmini'))document.querySelector('.playmini').textContent='Ⅱ'});
    renderedPreviewVideo.addEventListener('pause',()=>{if(document.querySelector('.playmini'))document.querySelector('.playmini').textContent='▶'});
    renderedPreviewVideo.addEventListener('timeupdate',()=>{syncTimeline();updateExportPreview()});preview.insertBefore(renderedPreviewVideo,preview.querySelector('.preview-label'));if(video)video.style.display='none';if(motionMaskPreview)motionMaskPreview.style.display='none';renderedPreviewVideo.loop=false;renderedPreviewVideo.autoplay=false;renderedPreviewVideo.load();
  }
  function clearRenderedEditorPreview(){if(!renderedPreviewVideo)return;const previewTime=renderedPreviewVideo.currentTime;renderedPreviewVideo.pause();renderedPreviewVideo.remove();renderedPreviewVideo=null;if(video){video.style.display='';if(Number.isFinite(previewTime))try{video.currentTime=Math.max(0,Math.min(Number.isFinite(video.duration)?video.duration:previewTime,previewTime))}catch{}}if(preview){const label=preview.querySelector('.preview-label');if(label&&media)label.textContent=`◉ ${media.name}　·　${formatTime(duration)}`}if(video?.videoWidth)fitPreviewToSource();}
  function invalidateCaptionRender(){renderedVideoPath=null;clearRenderedEditorPreview();captionEditsPending=captionSegments.length>0;if(captionEditsPending){const apply=document.getElementById('applyCaptions');if(apply)apply.dataset.applied='false'}updateCaptionApplyButton();updateCaptionPreview();updateExportPreview();}  function fitPreviewToSource(){
    if(!video?.videoWidth||!video.videoHeight||!preview)return;
    const source=renderedPreviewVideo||video,choice=document.getElementById('editorFrameSize')?.value||localStorage.getItem('capsnip.frameSize')||'source';let targetWidth=source.videoWidth,targetHeight=source.videoHeight;if(choice!=='source'){[targetWidth,targetHeight]=choice.split('x').map(Number)}
    const stage=preview.parentElement,availableWidth=stage.clientWidth,availableHeight=stage.clientHeight,ratio=targetWidth/targetHeight;
    const width=Math.max(1,Math.floor(Math.min(availableWidth,availableHeight*ratio))),height=Math.max(1,Math.floor(width/ratio));
    preview.style.aspectRatio=`${targetWidth} / ${targetHeight}`;
    preview.style.width=`${width}px`;preview.style.height=`${height}px`;preview.style.maxWidth='100%';preview.style.maxHeight='100%';
    preview.style.justifySelf='center';preview.style.alignSelf='center';
    const mode=document.getElementById('editorReframeMode')?.value||localStorage.getItem('capsnip.reframeMode')||'fit';if(video){video.style.objectFit=mode==='fill'?'cover':'contain';video.style.background='#000'}if(renderedPreviewVideo){renderedPreviewVideo.style.objectFit=mode==='fill'?'cover':'contain';renderedPreviewVideo.style.background='#000'}const label=preview.querySelector('.preview-label');if(label)label.textContent=`◉ ${media?.name||'Preview'}　·　${targetWidth}:${targetHeight} · ${mode==='fill'?'Fill':'Fit'}`;
    updateCaptionPreview();
  }
  window.addEventListener('resize',fitPreviewToSource);
  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '00:00';
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // Import is available from both the Home CTA and the editor preview.
  document.querySelectorAll('button').forEach(button => {
    if (button.textContent.includes('Import a video')) button.onclick = pickFile;
  });
  const importButton = document.createElement('button');
  importButton.className = 'preview-controls-import';
  importButton.textContent = '＋ Import clip';
  importButton.style.cssText = 'position:absolute;right:14px;top:14px;z-index:3;border:1px solid #ffffff30;border-radius:12px;padding:7px 10px;background:#101719;color:#eef5f7;font:10px var(--font);cursor:pointer';
  importButton.onclick = pickFile;
  preview.appendChild(importButton);
  window.addEventListener('capsnip:import', event => loadMedia(event.detail));
  window.capsnipImport = pickFile;
  window.pickFileFromHome = pickFile;
  mediaInput.addEventListener('change', () => {
    const file = mediaInput.files && mediaInput.files[0];
    if (file) loadMedia({ name: file.name, file, path: api.getFilePath ? api.getFilePath(file) : null });
  });
  preview.addEventListener('dragover', event => { event.preventDefault(); preview.style.outline = '2px solid var(--blue)'; });
  preview.addEventListener('dragleave', () => { preview.style.outline = ''; });
  preview.addEventListener('drop', event => {
    event.preventDefault(); preview.style.outline = '';
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) loadMedia({ name: file.name, file, path: api.getFilePath ? api.getFilePath(file) : null });
  });

  // Connect preview playback to the selected local clip.
  async function playImportedVideo() {
    if (!video) return pickFile();
    try { await video.play(); }
    catch (error) {
      const sourceVideo = video;
      if (await ensurePreviewFallback(media, sourceVideo)) {
        try { await video.play(); } catch (fallbackError) { toast(fallbackError.message || 'Could not play this file'); }
      } else toast(error.message || 'Could not play this file');
    }
  }
  document.querySelector('.playmini').onclick = () => {
    const active=renderedPreviewVideo||video;if(!active)return pickFile();
    if(active.paused){if(active===video)void playImportedVideo();else active.play().catch(error=>toast(error.message||'Could not play this preview'))}else active.pause();
  };

  const seekTrack=document.getElementById('videoSeekTrack');
  document.querySelector('.track.caption')?.parentElement&&(document.querySelector('.track.caption').parentElement.style.display='none');
  document.querySelector('.timebar').style.display='none';if(seekTrack)seekTrack.style.display='none';
  function syncTimeline(){const active=renderedPreviewVideo||video;if(!seekTrack||!active)return;const ratio=duration?Math.max(0,Math.min(1,active.currentTime/duration)):0;const head=seekTrack.querySelector('.playhead');if(head)head.style.left=`${ratio*100}%`;seekTrack.setAttribute('aria-valuenow',String(Math.round(ratio*100)));const labels=document.querySelectorAll('.timebar span');labels.forEach((label,index)=>label.textContent=`${Math.round((duration||50)*index/Math.max(1,labels.length-1))}s`)}
  function seekFromPointer(event){const active=renderedPreviewVideo||video;if(!active||!duration)return;const rect=seekTrack.getBoundingClientRect();const ratio=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));active.currentTime=ratio*duration;syncTimeline();updateCaptionPreview()}
  if(seekTrack){seekTrack.addEventListener('pointerdown',event=>{seekTrack.setPointerCapture(event.pointerId);seekFromPointer(event)});seekTrack.addEventListener('pointermove',event=>{if(event.buttons)seekFromPointer(event)});seekTrack.addEventListener('keydown',event=>{const active=renderedPreviewVideo||video;if(!active||!duration)return;const delta=event.shiftKey?10:1;if(event.key==='ArrowRight'){active.currentTime=Math.min(duration,active.currentTime+delta);event.preventDefault()}if(event.key==='ArrowLeft'){active.currentTime=Math.max(0,active.currentTime-delta);event.preventDefault()}})}
  const transport=document.querySelector('.transport');if(transport){const marks=transport.querySelectorAll('span');marks[3]?.addEventListener('click',()=>{const active=renderedPreviewVideo||video;if(active)active.currentTime=0});marks[4]?.addEventListener('click',()=>{const active=renderedPreviewVideo||video;if(active)active.currentTime=Math.min(duration||Infinity,active.currentTime+5)});}
  syncTimeline();
  // Saved projects are indexed locally so Home and Projects show real file history.
  let projectHistory = [];
  const projectPalette = ['linear-gradient(135deg,#203c48,#17232c 52%,#456c6f)','linear-gradient(135deg,#284956,#222f42 52%,#568080)','linear-gradient(135deg,#4c3947,#252d3b 55%,#8b6665)','linear-gradient(135deg,#344b46,#253b4b 55%,#9d987c)'];
  function formatProjectDuration(value){const seconds=Math.max(0,Math.floor(Number(value)||0));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}
  function formatProjectDate(value){const date=new Date(value);if(!Number.isFinite(date.getTime()))return 'Saved project';const days=Math.floor((Date.now()-date.getTime())/86400000);if(days<=0)return 'Edited today';if(days===1)return 'Edited yesterday';return `Edited ${date.toLocaleDateString()}`}
  function renderHistoryList(host,records,limit=Infinity){
    if(!host)return;host.replaceChildren();const shown=records.slice(0,limit);
    if(!shown.length){const empty=document.createElement('div');empty.className='history-empty';const mark=document.createElement('img');mark.src='assets/capsnip-mark.svg';mark.alt='Capsnip';const title=document.createElement('b');title.textContent='No saved projects yet';const note=document.createElement('small');note.textContent=host.id==='homeRecentProjects'?'Save a project from the Editor and it will show up here.':'Projects you save on this computer will appear here.';empty.append(mark,title,note);host.append(empty);return}
    shown.forEach((item,index)=>{const card=document.createElement('div');card.className='project project-open';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`Open project ${item.name||'Untitled Project'}`);const thumb=document.createElement('div');thumb.className='project-thumb';thumb.style.background=projectPalette[index%projectPalette.length];const badge=document.createElement('img');badge.src='assets/capsnip-mark.svg';badge.alt='';thumb.append(badge);const title=document.createElement('b');title.textContent=item.name||'Untitled Project';const details=document.createElement('small');details.textContent=`${formatProjectDuration(item.duration)} · ${item.templateName||'No caption style'} · ${formatProjectDate(item.updatedAt)}`;card.append(thumb,title,details);const open=()=>void openHistoryProject(item.filePath);card.addEventListener('click',open);card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}});host.append(card)})
  }
  function renderProjectHistory(){renderHistoryList(document.getElementById('homeRecentProjects'),projectHistory,3);const host=document.getElementById('projectHistoryGrid');if(!host)return;const search=(document.getElementById('projectHistorySearch')?.value||'').trim().toLocaleLowerCase(),sort=document.getElementById('projectHistorySort')?.value||'recent';let visible=projectHistory.filter(item=>`${item.name||''} ${item.templateName||''}`.toLocaleLowerCase().includes(search));if(sort==='name')visible.sort((a,b)=>(a.name||'').localeCompare(b.name||''));else if(sort==='created')visible.sort((a,b)=>new Date(a.createdAt||a.updatedAt)-new Date(b.createdAt||b.updatedAt));else visible.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));renderHistoryList(host,visible)}
  async function refreshProjectHistory(){if(!api.getProjectHistory)return;try{projectHistory=await api.getProjectHistory()||[];renderProjectHistory()}catch(error){console.warn('Could not load saved project history:',error)}}
  async function applyProjectData(data){
    if(!data)return;currentProjectFilePath=data.projectFilePath||null;captionField.value=data.transcript||(data.segments||[]).map(segment=>segment.text).join('\n');
    if(data.templateName&&styles.some(([name])=>name===data.templateName)){selected=data.templateName;appliedTemplate=data.segments?.length?data.templateName:null}
    else{appliedTemplate=null}
    captionSegments=Array.isArray(data.segments)?data.segments:[];captionEditsPending=false;duration=Number(data.duration)||0;setProjectTitle(data.name||'Untitled Project');renderTranscriptRows();
    if(data.mediaPath)loadMedia({path:data.mediaPath,name:data.mediaPath.split(/[\\/]/).pop(),url:data.mediaUrl||`file:///${data.mediaPath.replace(/\\/g,'/')}`},true);
    if(appliedTemplate){applyTemplatePreview(appliedTemplate);const apply=document.getElementById('applyCaptions');if(apply){apply.dataset.applied='true';apply.disabled=false}}const first=captionSegments[0],track=document.querySelector('.track.caption');if(track)track.textContent=first?`Aa　${formatTime(first.start)}　${first.text}`:'Aa　No captions yet';updateCaptionPreview();go('editor');await refreshProjectHistory();
  }
  async function openHistoryProject(filePath){try{if(!api.openProjectFromHistory)throw new Error('Project history is unavailable outside the Capsnip desktop app.');const data=await api.openProjectFromHistory(filePath);await applyProjectData(data);toast('Project opened from history')}catch(error){toast(error.message||'Could not open project');await refreshProjectHistory()}}
  document.getElementById('projectHistorySearch')?.addEventListener('input',renderProjectHistory);document.getElementById('projectHistorySort')?.addEventListener('change',renderProjectHistory);
  const projectHistoryGrid=document.getElementById('projectHistoryGrid'),projectGridView=document.getElementById('projectGridView'),projectListView=document.getElementById('projectListView');projectGridView?.addEventListener('click',()=>{projectHistoryGrid?.classList.remove('list-view');projectGridView.classList.add('active');projectListView?.classList.remove('active')});projectListView?.addEventListener('click',()=>{projectHistoryGrid?.classList.add('list-view');projectListView.classList.add('active');projectGridView?.classList.remove('active')});
  void refreshProjectHistory();
  // Save new files once, then update the same project and keep it in history.
  const saveButton = document.createElement('button');
  saveButton.className = 'subtab';
  saveButton.textContent = 'Save project';
  saveButton.style.marginLeft = 'auto';
  document.querySelector('.top-right').prepend(saveButton);
  saveButton.onclick = async () => {
    if (!api.saveProject) return toast('Open this folder with npm start to save a project file');
    try {
      const saved = await api.saveProject({ name: projectName, projectFilePath: currentProjectFilePath, mediaPath: media?.path || null, templateId: slug(selected), templateName: selected, transcript: captionField.value, duration, segments: captionSegments.map(segment => ({ ...segment, words: segment.words?.map(word => ({ ...word })) || [] })) });
      if (saved){currentProjectFilePath=saved.filePath||saved;await refreshProjectHistory();toast('Project saved to your history')}
    } catch (error) { toast(error.message || 'Could not save project'); }
  };
  const openProject = document.createElement('button');
  openProject.className = 'subtab'; openProject.textContent = 'Open project';
  document.querySelector('.top-right').prepend(openProject);
  openProject.onclick = async () => {if(!api.openProject)return toast('Open this folder with npm start to open projects');try{const data=await api.openProject();if(data){await applyProjectData(data);toast('Project opened')}}catch(error){toast(error.message||'Could not open project')}};

  // Run the local Python worker when installed; otherwise give a direct setup path.
  const transcribeButton = document.getElementById('generateCaptions');
  const generationOverlay=document.createElement('div');generationOverlay.id='generationOverlay';generationOverlay.style.cssText='display:none;position:fixed;inset:0;z-index:1000;background:#030608c9;backdrop-filter:blur(10px);place-items:center;padding:20px';
  generationOverlay.innerHTML='<section style="width:min(480px,100%);padding:28px;border:1px solid #37454a;border-radius:24px;background:#171c1f;box-shadow:0 25px 90px #000a"><div style="font-size:26px;margin-bottom:10px;color:#a8daf2">✧</div><h2 id="generationTitle" style="margin:0 0 7px;font-size:20px;color:#f0f3f4">Preparing</h2><p id="generationDetail" style="margin:0;color:#9daaad;font-size:12px;line-height:1.6">Getting your local caption engine ready.</p><div style="height:7px;background:#30383b;border-radius:9px;margin:22px 0 10px;overflow:hidden"><i id="generationBar" style="display:block;width:8%;height:100%;border-radius:9px;background:linear-gradient(90deg,#7dc9ec,#8ee9d5);transition:width .5s ease"></i></div><div style="display:flex;justify-content:space-between;align-items:center;color:#aeb9bc;font-size:11px"><span id="generationStage">Starting</span><span id="generationEstimate">Estimating time…</span></div><div id="generationError" style="display:none;margin-top:16px;color:#ff9ea4;font-size:12px"></div><button id="generationCancel" class="subtab" style="margin-top:20px">Cancel</button></section>';
  document.body.appendChild(generationOverlay);
  let generationStarted=0,generationTimer=null,generationBusy=false;
  function showGeneration(stage,title,detail,percent,estimate){generationOverlay.style.display='grid';generationBusy=true;document.getElementById('generationTitle').textContent=title;document.getElementById('generationDetail').textContent=detail;document.getElementById('generationStage').textContent=stage;document.getElementById('generationBar').style.width=percent+'%';document.getElementById('generationEstimate').textContent='Calculating estimate…';document.getElementById('generationCancel').textContent='Cancel';document.getElementById('generationCancel').disabled=false;document.getElementById('generationCancel').onclick=async()=>{if(generationBusy){document.getElementById('generationDetail').textContent='Stopping the local transcription…';await api.cancelTranscription?.();}};document.getElementById('generationError').style.display='none';generationStarted=Date.now();clearInterval(generationTimer);generationTimer=setInterval(()=>{const elapsed=Math.floor((Date.now()-generationStarted)/1000);const remaining=Math.max(0,(estimate?.seconds||0)-elapsed);document.getElementById('generationEstimate').textContent=remaining?`About ${Math.ceil(remaining/60)} min remaining · ${formatTime(elapsed)} elapsed`:`${formatTime(elapsed)} elapsed`;},1000);}
  function finishGeneration(){clearInterval(generationTimer);generationTimer=null;generationBusy=false;generationOverlay.style.display='none';}
  document.getElementById('generationCancel').onclick=async()=>{if(generationBusy){document.getElementById('generationDetail').textContent='Stopping the local transcription…';await api.cancelTranscription?.();}};
  const progressUnsubscribe=api.onProgress?api.onProgress(message=>{const detail=document.getElementById('generationDetail');if(detail&&generationOverlay.style.display!=='none')detail.textContent=message.replace(/\s+/g,' ').trim().slice(-220);}):null;void progressUnsubscribe;
  const customFontSelect=document.getElementById('captionFontSelect'),fontOptionsHost=document.getElementById('fontOptions'),fontSearch=document.getElementById('fontSearch'),baseColorInput=document.getElementById('captionBaseColor'),highlightColorInput=document.getElementById('captionHighlightColor'),revealPaceSelect=document.getElementById('captionRevealPace');
  const fontById=id=>(window.capsnipFontCatalog||[]).find(font=>font.id===id);
  let fontPreviewObserver=null;
  function populateFontSelect(){
    if(!customFontSelect||!fontOptionsHost)return;
    if('IntersectionObserver'in window)fontPreviewObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;const card=entry.target;const font=fontById(card.dataset.fontId);if(font){fontPreviewObserver.unobserve(card);void loadCustomFont(font.id).then(()=>card.classList.add('font-loaded')).catch(()=>card.classList.add('font-fallback'))}}),{root:fontOptionsHost,rootMargin:'70px'});
    const templateCard=document.createElement('button');templateCard.type='button';templateCard.className='font-option';templateCard.dataset.fontId='';templateCard.dataset.fontName='template font';templateCard.setAttribute('aria-label','Use template font');const templateSample=document.createElement('span');templateSample.className='font-option-sample';templateSample.textContent='Aa Bb 123';const templateName=document.createElement('span');templateName.className='font-option-name';templateName.textContent='Use template font';templateCard.append(templateSample,templateName);templateCard.addEventListener('click',()=>{customFontSelect.value='';updateFontCards();customFontSelect.dispatchEvent(new Event('change',{bubbles:true}))});fontOptionsHost.append(templateCard);
    for(const item of window.capsnipFontCatalog||[]){const label=item.label.replace(/^(Capsnip|Typography|Snip AI)\s*[·-]\s*/,'');const option=document.createElement('option');option.value=item.id;option.textContent=label;customFontSelect.appendChild(option);const card=document.createElement('button');card.type='button';card.className='font-option';card.dataset.fontId=item.id;card.dataset.fontName=label.toLocaleLowerCase();card.setAttribute('aria-label',`Select ${label} font`);const sample=document.createElement('span');sample.className='font-option-sample';sample.textContent='Aa Bb 123';sample.style.fontFamily=`'${item.family}', sans-serif`;const name=document.createElement('span');name.className='font-option-name';name.textContent=label;card.append(sample,name);card.addEventListener('click',()=>{customFontSelect.value=item.id;updateFontCards();customFontSelect.dispatchEvent(new Event('change',{bubbles:true}));void loadCustomFont(item.id).catch(error=>toast(error.message||'Could not load this font'))});fontOptionsHost.append(card);fontPreviewObserver?.observe(card)}
    updateFontCards();
  }
  function updateFontCards(){if(!fontOptionsHost)return;const selectedId=customFontSelect?.value||'';fontOptionsHost.querySelectorAll('.font-option').forEach(card=>{const selected=card.dataset.fontId===selectedId;card.classList.toggle('selected',selected);card.setAttribute('aria-pressed',String(selected))})}
  fontSearch?.addEventListener('input',()=>{const query=fontSearch.value.trim().toLocaleLowerCase();fontOptionsHost?.querySelectorAll('.font-option').forEach(card=>{card.hidden=!card.dataset.fontName.includes(query)})});populateFontSelect();
  function getStyleDraft(){const theme=(window.capsnipThemes||[]).find(item=>item.name===selected)||{};return{fontId:customFontSelect?.value||'',baseColor:baseColorInput?.value||theme.baseColor||'#ffffff',accentColor:highlightColorInput?.value||theme.accent||'#ffe24d',revealPace:revealPaceSelect?.value||'stacked'}}
  function styleDraftIsDirty(){const current=captionStyleOverrides[selected]||{},theme=(window.capsnipThemes||[]).find(item=>item.name===selected)||{};const draft=getStyleDraft();return draft.fontId!==(current.fontId||'')||draft.baseColor.toLowerCase()!==(current.baseColor||theme.baseColor||'#ffffff').toLowerCase()||draft.accentColor.toLowerCase()!==(current.accentColor||theme.accent||'#ffe24d').toLowerCase()||draft.revealPace!==(current.revealPace||'stacked')}
  function updateStyleControls(){if(!customFontSelect)return;const theme=(window.capsnipThemes||[]).find(item=>item.name===selected)||{},saved=captionStyleOverrides[selected]||{},videoFill=theme.category==='motion-graphic';customFontSelect.value=saved.fontId||'';updateFontCards();if(baseColorInput){baseColorInput.value=saved.baseColor||theme.baseColor||'#ffffff';baseColorInput.disabled=videoFill}if(highlightColorInput){highlightColorInput.value=saved.accentColor||theme.accent||'#ffe24d';highlightColorInput.disabled=videoFill}if(revealPaceSelect)revealPaceSelect.value=saved.revealPace||'stacked';const name=document.getElementById('styleSelectedName');if(name)name.textContent=selected?(videoFill?`${selected} · video fill colors`:selected):'Choose a template';const apply=document.getElementById('applyStyleChanges');if(apply){apply.disabled=!captionEditsPending&&!styleDraftIsDirty()&&selected===appliedTemplate;apply.textContent=captionSegments.length?'Apply changes':'Save style for captions'}updateCaptionApplyButton()}
  function updateCaptionApplyButton(){const button=document.getElementById('generateCaptions');if(!button||!captionSegments.length)return;const needsApply=captionEditsPending||selected!==appliedTemplate||styleDraftIsDirty();button.disabled=!needsApply;button.textContent=needsApply?'Apply changes':'Captions applied'}
  function setEditorMode(mode){const style=mode==='style';document.getElementById('captionEditorPanel').style.display=style?'none':'block';document.getElementById('styleEditorPanel').style.display=style?'block':'none';document.getElementById('captionsModeButton').classList.toggle('on',!style);document.getElementById('styleModeButton').classList.toggle('on',style);if(style)updateStyleControls()}
  window.setEditorMode=setEditorMode;
  async function loadCustomFont(id){const item=fontById(id);if(!item)return null;const existing=[...document.fonts].find(font=>font.family===item.family);if(existing?.status==='loaded')return item;const url=new URL('assets/fonts/'+item.path.split('/').map(encodeURIComponent).join('/'),document.baseURI).href;const face=new FontFace(item.family,`url("${url}")`);await face.load();document.fonts.add(face);return item}
  async function commitStyleDraft(){const draft=getStyleDraft(),font=await loadCustomFont(draft.fontId);captionStyleOverrides[selected]={...draft,fontFamily:font?.family||'',fontPath:font?.path||''};localStorage.setItem('capsnip.styleOverrides',JSON.stringify(captionStyleOverrides));if(captionSegments.length){renderedVideoPath=null;clearRenderedEditorPreview();captionEditsPending=false;appliedTemplate=selected;applyTemplatePreview(selected);seekToFirstCaption();const applyBtn=document.getElementById('applyCaptions');if(applyBtn){applyBtn.dataset.applied='true';applyBtn.textContent='✓　Captions applied'}const generate=document.getElementById('generateCaptions');generate.disabled=true;generate.textContent='Captions applied';toast(`${selected} appearance applied`)}else toast('Style saved; generate captions to see it');updateStyleControls();updateCaptionPreview()}
  [customFontSelect,baseColorInput,highlightColorInput,revealPaceSelect].filter(Boolean).forEach(control=>control.addEventListener('change',()=>{const apply=document.getElementById('applyStyleChanges');if(apply){apply.disabled=false;apply.textContent=captionSegments.length?'Apply changes':'Save style for captions'};updateCaptionApplyButton()}));
  document.getElementById('applyStyleChanges')?.addEventListener('click',()=>void commitStyleDraft());
  window.onCaptionTemplateSelect=name=>{updateStyleControls();updateCaptionApplyButton()};
  transcribeButton.onclick=async()=>{
    if(!media?.path)return toast('Import a video file first');
    if(!api.engineStatus||!api.transcribe)return toast('Start the desktop app and install the speech engine first');
    if(captionSegments.length){
      if(!captionEditsPending&&selected===appliedTemplate&&!styleDraftIsDirty())return toast('These captions already use this style.');
      await commitStyleDraft();return;
    }
    transcribeButton.disabled=true;transcribeButton.textContent='Generating…';document.getElementById('applyCaptions').disabled=true;
    const alreadyTranscribed=captionSegments.length>0;
    let transcriptionInfo=null;
    try{
      let estimateSeconds=Math.max(8,Math.round((duration||60)*(engine.device==='cuda'?.28:.75)+(alreadyTranscribed?0:12)));
      if(alreadyTranscribed){showGeneration('Step 1 of 2','Preparing caption render','Using your edited transcript and selected caption style.',35,{seconds:Math.max(5,Math.round((duration||60)*.04))});}
      else{
        showGeneration('Step 1 of 2','Transcribing your video','The local speech model is creating timestamped caption lines. You can’t change editor settings during generation.',12,{seconds:estimateSeconds});
        engine=await refreshEngine(false);if(!engine.ready)throw new Error(engine.message||'Speech engine is not installed. Follow the README setup steps.');
        const language=document.getElementById('languageSelect').value;
        document.getElementById('generationDetail').textContent=language==='hinglish'?'Transcribing Hinglish locally with the bundled Swift speech model on CPU.':'Transcribing English locally with faster-whisper on CPU.';
        const result=await api.transcribe({path:media.path,language});if(!result.segments?.length)throw new Error('No speech was detected in this clip.');
        transcriptionInfo=result;
        captionSegments=result.segments;captionField.value=captionSegments.map(segment=>segment.text).join('\n');duration=result.duration||captionSegments.at(-1).end||duration;renderTranscriptRows();
      }
      showGeneration('Step 2 of 2','Rendering captions','Applying the selected style to the video preview and synchronizing timestamped edits.',76,{seconds:Math.max(2,Math.round((duration||60)*.04))});
      await new Promise(resolve=>setTimeout(resolve,700));
      if(styleDraftIsDirty())await commitStyleDraft();captionEditsPending=false;appliedTemplate=selected;applyTemplatePreview(appliedTemplate);seekToFirstCaption();
      const applyBtn=document.getElementById('applyCaptions');applyBtn.disabled=false;applyBtn.dataset.applied='true';applyBtn.textContent='✓　Captions applied';
      const statusBadges=document.querySelectorAll('.rightpanel .smallmuted');if(statusBadges[1])statusBadges[1].textContent=transcriptionInfo?.model?.includes('swift')?`Swift Hinglish · ${String(transcriptionInfo.device||'cpu').toUpperCase()} ready`:`${engine.deviceName||engine.device||'Local'} · ${engine.device==='cuda'?engine.gpuModel:engine.cpuModel} ready`;
      updateStyleControls();document.getElementById('generationTitle').textContent='Your video is ready';document.getElementById('generationDetail').textContent=`${captionSegments.length} timestamped captions are applied. Edit words in the transcript; changes appear in the preview immediately.`;document.getElementById('generationStage').textContent='Complete';document.getElementById('generationBar').style.width='100%';document.getElementById('generationEstimate').textContent='';document.getElementById('generationCancel').textContent='Continue editing';document.getElementById('generationCancel').onclick=finishGeneration;generationBusy=false;clearInterval(generationTimer);setTimeout(()=>{if(generationOverlay.style.display!=='none')finishGeneration();document.getElementById('generationCancel').textContent='Cancel';},1600);toast(`Captions ready · ${captionSegments.length} lines`);
    }catch(error){const detail=document.getElementById('generationError');detail.textContent=error.message||'Caption generation failed';detail.style.display='block';document.getElementById('generationTitle').textContent='Generation stopped';document.getElementById('generationStage').textContent='Needs attention';document.getElementById('generationBar').style.width='100%';document.getElementById('generationBar').style.background='#ff777f';document.getElementById('generationCancel').textContent='Close';document.getElementById('generationCancel').onclick=finishGeneration;generationBusy=false;clearInterval(generationTimer);toast(error.message||'Caption generation failed');}
    finally{const styleNeedsApply=captionSegments.length>0&&selected!==appliedTemplate;transcribeButton.disabled=captionSegments.length>0&&!styleNeedsApply;transcribeButton.textContent=styleNeedsApply?'Apply changes':captionSegments.length?'Captions applied':'✧　Generate captions';}
  };

  document.getElementById('applyCaptions')?.addEventListener('click',()=>{if(!captionSegments.length)return toast('Transcribe the clip first');captionEditsPending=false;renderedVideoPath=null;clearRenderedEditorPreview();appliedTemplate=selected;applyTemplatePreview(selected);seekToFirstCaption();updateCaptionApplyButton();document.getElementById('applyCaptions').dataset.applied='true';document.getElementById('applyCaptions').textContent='✓　Captions applied';toast(`${selected} applied to ${captionSegments.length} timed captions`)});
  captionField.addEventListener('input', () => {
    const lines = captionField.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) { captionSegments = []; renderTranscriptRows(); return; }
    const applyBtn=document.getElementById('applyCaptions');if(applyBtn)applyBtn.dataset.applied='false';
    if (captionSegments.length === lines.length) {
      captionSegments = captionSegments.map((segment, index) => ({ ...segment, text: lines[index], words: lines[index] === segment.text ? segment.words : retimeEditedWords(segment, lines[index]) }));
    } else {
      const start = captionSegments[0]?.start || 0;
      const end = captionSegments[captionSegments.length - 1]?.end || duration || 4;
      const previousWords=captionSegments.flatMap(segment=>segment.words||[]);
      captionSegments = [{ start, end, text: lines.join(' '), words: retimeEditedWords({start,end,words:previousWords},lines.join(' ')) }];
    }
    const first = captionSegments[0];
    const track = document.querySelector('.track.caption');
    if (track) track.textContent = first ? `Aa　${formatTime(first.start)}　${first.text}` : 'Aa　No captions yet';
    renderTranscriptRows(); updateCaptionPreview();
  });
  document.getElementById('addCaption')?.addEventListener('click',()=>{const start=captionSegments.at(-1)?.end||0;const segment={start,end:start+2,text:'New caption',words:[]};captionSegments.push(segment);captionField.value=captionSegments.map(x=>x.text).join('\n');renderTranscriptRows()});

  function playCaptionSound(context,destination,kind='tick'){
    if(!context||!destination)return;
    const now=context.currentTime,master=context.createGain();master.gain.setValueAtTime(.9,now);master.connect(destination);
    const tone=(type,from,to,duration,level)=>{const osc=context.createOscillator(),gain=context.createGain();osc.type=type;osc.frequency.setValueAtTime(from,now);if(to!==from)osc.frequency.exponentialRampToValueAtTime(Math.max(1,to),now+duration);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(level,now+.003);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain).connect(master);osc.start(now);osc.stop(now+duration+.005)};
    if(kind==='pop'){tone('triangle',185,76,.095,.58);tone('sine',1350,780,.028,.22)}else tone('sine',2300,1550,.052,.62);
  }
  function isEmphasisWord(text){const token=String(text||'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');return /^(great|amazing|insane|crazy|massive|powerful|important|awesome|incredible|fantastic|wow|mast|zabardast|bahut|bada|heavy|best|brilliant|perfect|excellent|mindblowing|genius)$/.test(token)}
  function playPreviewWordCue(t){if(!video||renderedPreviewVideo||!document.getElementById('tickEffects')?.classList.contains('on'))return;const index=captionSegments.findIndex(segment=>t>=segment.start&&t<=captionDisplayEnd(segment));if(index<0){lastPreviewSfxKey='';return}const words=wordsWithTiming(captionSegments[index]),wordIndex=words.findIndex(word=>t>=word.start&&t<=word.end);if(wordIndex<0)return;const key=`${index}:${wordIndex}`;if(key===lastPreviewSfxKey)return;lastPreviewSfxKey=key;try{previewAudioContext??=new AudioContext();if(previewAudioContext.state==='suspended')previewAudioContext.resume();const rule=(window.capsnipTemplateBehavior||{})[appliedTemplate]||{};playCaptionSound(previewAudioContext,previewAudioContext.destination,(isEmphasisWord(words[wordIndex].text)||rule.sfx==='pop')?'pop':'tick')}catch{}}
  function isTypographyTemplate(name=appliedTemplate){return ['Kinetic Typography','Highlight Typography','Stacked Typography','Handwritten Typography','Editorial Typography'].includes((window.capsnipTemplateBehavior||{})[name]?.typographyCategory)}
  function retimeEditedWords(segment,text){const tokens=String(text||'').trim().split(/\s+/).filter(Boolean),source=(segment.words||[]).filter(word=>word&&word.text);if(!tokens.length||!source.length)return[];const edges=[Number(source[0].start)||Number(segment.start)||0,...source.map((word,index)=>Math.max(Number(word.end)||Number(word.start)||0,index?Number(source[index-1].end)||0:0))],count=source.length;const at=position=>{const bounded=Math.max(0,Math.min(count,position)),whole=Math.floor(bounded),fraction=bounded-whole;if(whole>=count)return edges[count];return edges[whole]+(edges[whole+1]-edges[whole])*fraction};return tokens.map((word,index)=>({text:word,start:at(index*count/tokens.length),end:Math.max(at(index*count/tokens.length)+.001,at((index+1)*count/tokens.length))}))}
  function wordsWithTiming(segment){const source=segment.words?.length?segment.words:(segment.text||'').trim().split(/\s+/).filter(Boolean).map(text=>({text}));if(!source.length)return[];const pace=captionStyleOverrides[appliedTemplate]?.revealPace||'stacked';if(segment.words?.length&&(isTypographyTemplate()||pace==='natural'))return source;const start=Number(segment.start)||0,span=Math.max(.05,(Number(segment.end)||start+1)-start),step=pace==='slow'?Math.max(span/source.length,.62):span/source.length;return source.map((word,index)=>({text:word.text,start:start+index*step,end:start+(index+1)*step}))}
  function captionDisplayEnd(segment){const end=Number(segment.end)||0;if(isTypographyTemplate()||(captionStyleOverrides[appliedTemplate]?.revealPace||'stacked')!=='slow')return end;return Math.min(duration||Infinity,Math.max(end,wordsWithTiming(segment).at(-1)?.end||end))}
  // Local WebM rendering: encode the source video and timed caption overlay in Chromium.
  async function renderLocalWebM(button) {
    if (!captionSegments.length) { toast('Step 1 · Transcribe your clip first'); return; }
    if (document.getElementById('applyCaptions')?.dataset.applied !== 'true') { toast('Step 2 · Apply captions before exporting'); return; }
    if (!media || !video) { toast('Import a video clip before exporting'); return; }
    renderedVideoPath=null;updateExportPreview();const motionTheme=(window.capsnipThemes||[]).find(item=>item.name===appliedTemplate);
    if(motionTheme?.category==='motion-graphic'){await renderMotionGraphicWorker(button,motionTheme);return}
    if(motionTheme?.category==='snip-ai'||motionTheme?.category==='mixed'){await renderSnipAiWorker(button,motionTheme);return}
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast('This computer cannot record WebM in the current app runtime'); return; }
    const frameChoice=document.getElementById('exportFrameSize')?.value||'source';
    const reframeMode=document.getElementById('exportReframeMode')?.value||localStorage.getItem('capsnip.reframeMode')||'fit';
    const [requestedWidth,requestedHeight]=frameChoice==='source'?[video.videoWidth,video.videoHeight]:frameChoice.split('x').map(Number);
    const outWidth=Math.max(2,Math.round(requestedWidth/2)*2),outHeight=Math.max(2,Math.round(requestedHeight/2)*2);
    const canvas = document.createElement('canvas');
    canvas.width=outWidth;canvas.height=outHeight;
    const ctx = canvas.getContext('2d');
    const exportFpsChoice=document.getElementById('exportFps')?.value||'60';
    const sourceFpsStream=(()=>{try{return video.captureStream?video.captureStream():video.mozCaptureStream()}catch{return null}})();
    const sourceFps=sourceFpsStream?.getVideoTracks?.()[0]?.getSettings?.().frameRate||30;
    sourceFpsStream?.getTracks?.().forEach(track=>track.stop());
    const exportFps=exportFpsChoice==='source'?Math.min(60,Math.max(24,Math.round(sourceFps))):Math.min(60,Math.max(24,Number(exportFpsChoice)||60));
    const canvasStream=canvas.captureStream(exportFps);
    const tickOn=document.getElementById('tickEffects')?.classList.contains('on'),includeOriginalAudio=localStorage.getItem('capsnip.includeAudio')!=='false';
    const audioCtx=(tickOn||includeOriginalAudio)?(previewAudioContext??=new AudioContext()):null,audioMix=audioCtx?.createMediaStreamDestination();
    if(includeOriginalAudio&&audioCtx&&audioMix)try{if(previewAudioSourceElement!==video){previewAudioSource=audioCtx.createMediaElementSource(video);previewAudioSourceElement=video}previewAudioSource.disconnect();previewAudioSource.connect(audioCtx.destination);previewAudioSource.connect(audioMix)}catch{}
    const tickOut=tickOn?audioMix:null;if(audioMix)audioMix.stream.getAudioTracks().forEach(track=>canvasStream.addTrack(track));
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp8,opus';
    let recorder;
    const qualityChoice=document.getElementById('exportQuality')?.value||'high';
    const renderBitrate=outWidth>=3840?32_000_000:outWidth>=1920?18_000_000:10_000_000;
    try { recorder = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: renderBitrate }); }
    catch (error) { toast(`Could not start video encoder: ${error.message}`); return; }
    const chunks = [];motionExportActive=true;cancelCanvasRender=false;activeCanvasRecorder=recorder;
    const status = document.getElementById('renderStatus');
    const label = document.getElementById('renderText');
    status.style.display = 'block';
    button.disabled = true; button.textContent = 'Rendering MP4…';
    let animationFrame;let lastSfxKey='';let recorderFinished=false;
    const sourceVideo=video;
    const stopRecorder=()=>{if(recorder.state!=='inactive')recorder.stop()};
    const cleanupRecording=()=>{
      cancelAnimationFrame(animationFrame);
      sourceVideo.removeEventListener('ended',stopRecorder);
      sourceVideo.pause();motionFillVideo.pause();
      canvasStream.getTracks().forEach(track=>track.stop());
      audioMix?.disconnect();
      if(includeOriginalAudio&&previewAudioSource){try{previewAudioSource.disconnect();previewAudioSource.connect(audioCtx.destination)}catch{}}
      stopCaptionPreviewFrames();
    };
    const draw = () => {
      const w = canvas.width, h = canvas.height;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      if (video.videoWidth && video.videoHeight) {
        const scale = reframeMode==='fill'?Math.max(w / video.videoWidth, h / video.videoHeight):Math.min(w / video.videoWidth, h / video.videoHeight);
        const sw = video.videoWidth * scale, sh = video.videoHeight * scale;
        ctx.drawImage(video, (w - sw) / 2, (h - sh) / 2, sw, sh);
      }
      const t = video.currentTime || 0;
      updateCaptionPreview();
      let segmentIndex=captionSegments.findIndex(s=>t>=s.start&&t<=captionDisplayEnd(s));if(segmentIndex<0)segmentIndex=captionSegments.findIndex(s=>Math.abs(t-s.start)<.8);const segment=segmentIndex>=0?captionSegments[segmentIndex]:null;
      if (segment && segment.text) drawCaption(ctx, segment, t, w, h, appliedTemplate, captionPositionFor(segmentIndex), captionScale, segmentIndex, true);
      if(tickOut&&segment){const words=wordsWithTiming(segment),wordIndex=words.findIndex(word=>t>=word.start&&t<=word.end);if(wordIndex>=0){const key=`${segmentIndex}:${wordIndex}`;if(key!==lastSfxKey){lastSfxKey=key;const token=(words[wordIndex].text||'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');const heavy=/^(great|amazing|insane|crazy|massive|powerful|important|awesome|incredible|fantastic|wow|mast|zabardast|bahut|bada|heavy|best|brilliant|perfect|excellent|mindblowing|genius)$/.test(token);const rule=(window.capsnipTemplateBehavior||{})[appliedTemplate]||{};playCaptionSound(audioCtx,tickOut,(heavy||rule.sfx==='pop')?'pop':'tick')}}}
      const percent = duration ? Math.min(100, Math.round(t / duration * 100)) : 0;
      label.textContent = `Rendering high-quality video… ${percent}% · ${formatTime(t)} / ${formatTime(duration)}`;const progressBar=document.getElementById('renderProgressBar');if(progressBar)progressBar.style.width=percent+'%';
      animationFrame = requestAnimationFrame(draw);
    };
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = event => {cancelCanvasRender=true;stopRecorder();cleanupRecording();motionExportActive=false;activeCanvasRecorder=null;setExportState('idle');toast(event.error?.message || 'Video export failed');};
    recorder.onstop = async () => {
      if(recorderFinished)return;recorderFinished=true;cleanupRecording();
      if(cancelCanvasRender){cancelCanvasRender=false;motionExportActive=false;activeCanvasRecorder=null;label.textContent='Export cancelled';setExportState('idle');return}
      lastTickWord=-1;
      cancelAnimationFrame(animationFrame);
      const blob = new Blob(chunks, { type: mime });
      label.textContent = 'Encoding MP4 · high quality…';
      const unsubscribeProgress=api.onRenderProgress?.(progress=>{label.textContent=progress.message||'Encoding MP4…';const pbar=document.getElementById('renderProgressBar');if(pbar)pbar.style.width=`${progress.percent||0}%`});      try {
        const bytes=await blob.arrayBuffer();
        const result=await api.exportMp4({bytes,name:projectName,quality:qualityChoice,duration,outputDir:localStorage.getItem('capsnip.outputDir')||undefined});
        if(result?.cancelled){label.textContent='Export cancelled';return}
        completeExport(result.path);
        toast('MP4 with captions is ready');burst();
      }catch(error){label.textContent=`MP4 export failed · ${error.message}`;toast(error.message||'MP4 export failed')}
      finally{unsubscribeProgress?.();motionExportActive=false;activeCanvasRecorder=null;setExportState(exportState==='exported'?'exported':'idle')}
    };
    const start = async () => {
      if(audioCtx?.state==='suspended')await audioCtx.resume().catch(()=>{});
      if(motionTheme?.category==='motion-graphic'){motionFillVideo.currentTime=0;motionFillVideo.play().catch(()=>{})}
      video.pause();video.loop=false;video.onended=null;video.currentTime = 0;
      video.addEventListener('ended',stopRecorder,{once:true});
      draw(); recorder.start(1000);
      video.play().catch(error => { cancelCanvasRender=true;stopRecorder();toast(`Could not play source clip: ${error.message}`); });
    };
    if (video.readyState >= 2) start(); else video.addEventListener('canplay', start, { once: true });
  }
  let motionExportActive = false, activeCanvasRecorder = null, cancelCanvasRender = false;
  window.cancelCapsnipRender = async () => {
    if(activeCanvasRecorder&&activeCanvasRecorder.state!=='inactive'){cancelCanvasRender=true;video?.pause();activeCanvasRecorder.stop();return}
    if (!motionExportActive) return;
    const cancelButton = document.getElementById('cancelRender');
    if (cancelButton) { cancelButton.disabled = true; cancelButton.textContent = 'Cancelling…'; }
    await api.cancelMotionGraphic?.();
  };  async function renderMotionGraphicWorker(button,theme){
    if(!api.renderMotionGraphic)return toast('The FFmpeg export worker is unavailable in this app build.');
    renderedVideoPath=null;const status=document.getElementById('renderStatus'),label=document.getElementById('renderText'),bar=status?.querySelector('.progress i');
    renderedVideoPath=null;if(status)status.style.display='block';if(button){button.disabled=true;button.textContent='Rendering MP4…'}if(label)label.textContent='Preparing motion graphic export…';if(bar)bar.style.width='0%';motionExportActive=true;const cancelButton=document.getElementById('cancelRender');if(cancelButton){cancelButton.disabled=false;cancelButton.textContent='Cancel export';}
    const unsubscribe=api.onRenderProgress?.(progress=>{if(label)label.textContent=progress.message||'Rendering video…';if(bar)bar.style.width=`${progress.percent||0}%`});
    try{
      const frameChoice=document.getElementById('exportFrameSize')?.value||'source';const [width,height]=frameChoice==='source'?[video.videoWidth,video.videoHeight]:frameChoice.split('x').map(Number);
      const result=await api.renderMotionGraphic({inputPath:media.path,templateId:theme.id,name:projectName,duration,width,height,reframeMode:document.getElementById('exportReframeMode')?.value||'fit',quality:document.getElementById('exportQuality')?.value||'high',fps:Math.min(60,Math.max(24,Number(document.getElementById('exportFps')?.value)||60)),userFontFile:fontById(captionStyleOverrides[theme.name]?.fontId)?.path,revealPace:captionStyleOverrides[theme.name]?.revealPace||'stacked',soundEffects:document.getElementById('tickEffects')?.classList.contains('on')===true,includeAudio:localStorage.getItem('capsnip.includeAudio')!=='false',outputDir:localStorage.getItem('capsnip.outputDir')||undefined,captionPosition,captionScale,segments:captionSegments.map((segment,index)=>({start:segment.start,end:segment.end,text:segment.text,position:captionPositionFor(index,theme.name),words:wordsWithTiming(segment).map(word=>({text:word.text,start:word.start,end:word.end}))}))});
      if(result?.cancelled){if(label)label.textContent='Export cancelled';toast('Export cancelled');return;}
      completeExport(result.path);
      if(label)label.textContent='✓ Exported · MP4 saved';if(bar)bar.style.width='100%';toast('Motion graphic MP4 is ready');burst();
    }catch(error){if(label)label.textContent=`Export failed · ${error.message}`;toast(error.message||'Motion graphic export failed')}
    finally{motionExportActive=false;unsubscribe?.();if(cancelButton){cancelButton.disabled=false;cancelButton.textContent='Cancel export';}setExportState(exportState==='exported'?'exported':'idle')}
  }
  async function renderSnipAiWorker(button,theme){
    if(!api.renderSnipAi)return toast('The Snip AI FFmpeg renderer is unavailable in this app build.');
    renderedVideoPath=null;const status=document.getElementById('renderStatus'),label=document.getElementById('renderText'),bar=status?.querySelector('.progress i');
    renderedVideoPath=null;if(status)status.style.display='block';if(button){button.disabled=true;button.textContent='Rendering MP4…'}if(label)label.textContent=`Preparing ${theme.name} FFmpeg render…`;if(bar)bar.style.width='0%';motionExportActive=true;
    const cancelButton=document.getElementById('cancelRender');if(cancelButton){cancelButton.disabled=false;cancelButton.textContent='Cancel export'}
    const unsubscribe=api.onRenderProgress?.(progress=>{if(label)label.textContent=progress.message||'Rendering video…';if(bar)bar.style.width=`${progress.percent||0}%`});
    try{
      const frameChoice=document.getElementById('exportFrameSize')?.value||'source',dimensions=frameChoice==='source'?[video.videoWidth,video.videoHeight]:frameChoice.split('x').map(Number);
      const styleOverride=captionStyleOverrides[theme.name]||{},fontChoice=fontById(styleOverride.fontId);const result=await api.renderSnipAi({inputPath:media.path,templateId:theme.id,name:projectName,duration,width:dimensions[0],height:dimensions[1],frameSize:frameChoice,reframeMode:document.getElementById('exportReframeMode')?.value||'fit',quality:document.getElementById('exportQuality')?.value||'high',userFontFile:fontChoice?.path,revealPace:styleOverride.revealPace||'stacked',primaryColor:styleOverride.baseColor,accentColor:styleOverride.accentColor,soundEffects:document.getElementById('tickEffects')?.classList.contains('on')===true,includeAudio:localStorage.getItem('capsnip.includeAudio')!=='false',outputDir:localStorage.getItem('capsnip.outputDir')||undefined,fps:Math.min(60,Math.max(12,Number(document.getElementById('exportFps')?.value)||30)),captionPosition,captionScale,segments:captionSegments.map((segment,index)=>{let mixedWordIndex=0;const tokens=wordsWithTiming(segment);const position=captionPositionFor(index,theme.name);return{start:segment.start,end:Math.max(Number(segment.end)||0,tokens.at(-1)?.end||0),text:segment.text,position,words:tokens.map(word=>{const sourceStyle=theme.category==='mixed'?theme.sourceStyles[mixedWordIndex++%theme.sourceStyles.length]:null,style=sourceStyle?{fontAsset:fontChoice?.path||sourceStyle.fontAsset,fontFamily:fontChoice?.family||sourceStyle.fontFamily,fontWeight:sourceStyle.weight,fontSize:sourceStyle.size,baseColor:styleOverride.baseColor||sourceStyle.baseColor,accentColor:styleOverride.accentColor||sourceStyle.accentColor}:null;return{text:word.text,start:word.start,end:word.end,position,...(style||{})}})}})});
      if(result?.cancelled){if(label)label.textContent='Export cancelled';toast('Export cancelled');return}
      completeExport(result.path);
      if(label)label.textContent='✓ Exported · MP4 saved';if(bar)bar.style.width='100%';toast(`${theme.name} MP4 is ready`);burst();
    }catch(error){if(label)label.textContent=`Export failed · ${error.message}`;toast(error.message||'FFmpeg caption export failed')}
    finally{motionExportActive=false;unsubscribe?.();if(cancelButton){cancelButton.disabled=false;cancelButton.textContent='Cancel export'}setExportState(exportState==='exported'?'exported':'idle')}
  }
  const typographyLineLayouts=[
    {top:'left',bottom:'right'},{top:'left',bottom:'center'},{top:'left',bottom:'left'},
    {top:'center',bottom:'right'},{top:'right',bottom:'left'},{top:'left',bottom:'right'},
    {top:'left',bottom:'center'},{top:'center',bottom:'left'},{top:'right',bottom:'center'},
    {top:'left',bottom:'right'},{top:'center',bottom:'right'},{top:'left',bottom:'left'},
    {top:'right',bottom:'right'},{top:'left',bottom:'center'},{top:'center',bottom:'left'},
  ];
  function drawTopDownWordStack(ctx,words,t,w,h,position,fontSize,fontFamily,weight,italic,baseColor,accentColor,rule,cueIndex=0){
    if(!words.length)return;let activeIndex=words.findIndex(word=>t>=word.start&&t<=word.end);if(activeIndex<0){activeIndex=-1;for(let i=0;i<words.length;i++){if(words[i].start<=t)activeIndex=i;else break}}if(activeIndex<0)return;
    const first=Math.floor(activeIndex/3)*3,visible=words.slice(first,activeIndex+1),centerX=w*position.x,centerY=h*position.y,maxWidth=w*.86,activeWord=words[activeIndex],progress=Math.max(0,Math.min(1,(t-activeWord.start)/.14)),ease=1-Math.pow(1-progress,3),tierScale=[.48,1.48,.48],tierY=[-1.16,0,1.16],layout=typographyLineLayouts[((cueIndex+Math.floor(first/3))%typographyLineLayouts.length+typographyLineLayouts.length)%typographyLineLayouts.length],group=words.slice(first,first+3),middleText=group[1]?.text||group[0]?.text||'',textFor=word=>rule.casing==='upper'?String(word.text).toLocaleUpperCase():rule.casing==='lower'?String(word.text).toLocaleLowerCase():String(word.text);
    ctx.save();ctx.font=`${italic?'italic ':''}${weight} ${fontSize}px ${fontFamily}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=Math.max(2,fontSize*.09);ctx.shadowOffsetX=0;ctx.shadowOffsetY=Math.max(1,fontSize*.04);
    const middleWidth=Math.min(maxWidth,ctx.measureText(textFor({text:middleText})).width*tierScale[1]);
    visible.forEach((word,index)=>{const slot=index%3,isActive=index===visible.length-1,scale=tierScale[slot],text=textFor(word),measure=ctx.measureText(text).width,fitScale=Math.min(1,maxWidth/Math.max(1,measure*scale)),renderedWidth=measure*scale*fitScale,align=slot===0?layout.top:slot===2?layout.bottom:'center';let x=centerX;if(align==='left')x=centerX-middleWidth/2+renderedWidth/2;else if(align==='right')x=centerX+middleWidth/2-renderedWidth/2;x=Math.max(renderedWidth/2+2,Math.min(w-renderedWidth/2-2,x));const y=centerY+fontSize*tierY[slot]+(isActive?(1-ease)*fontSize*.08:0);ctx.globalAlpha=isActive?ease:.96;ctx.fillStyle=slot===1?accentColor:baseColor;ctx.save();ctx.translate(x,y);ctx.scale(fitScale*scale*(isActive?.96+.04*ease:1),scale*(isActive?.96+.04*ease:1));ctx.fillText(text,0,0);ctx.restore()});ctx.restore();ctx.globalAlpha=1;
  }
  function drawCaption(ctx,segment,t,w,h,templateName=appliedTemplate,position=captionPosition,scaleFactor=captionScale,patternCueIndex=0,forcePosition=false){
    const pacedWords=wordsWithTiming(segment),rawTokens=pacedWords.map(word=>word.text).filter(Boolean);
    if(!rawTokens.length)return;
    const span=Math.max(.1,(segment.end||t+1)-segment.start),styleName=templateName||'Mint Pop';
    const theme=(window.capsnipThemes||[]).find(item=>item.name===styleName)||{},rule=(window.capsnipTemplateBehavior||{})[styleName]||{},reference=referencePattern(styleName,patternCueIndex),styleOverride=captionStyleOverrides[styleName]||{},fontChoice=fontById(styleOverride.fontId),fontFamily=fontChoice?.family||rule.font||theme.font||'Arial,sans-serif';
    // The caller resolves global/reference anchors and any per-line override.
    // Keep that position in both the live editor and final export.
    if(theme.category==='motion-graphic'){drawVideoFilledCaption(ctx,segment,t,w,h,theme,motionFillVideo,position,scaleFactor);return}
    if(theme.category==='snip-ai'||theme.category==='mixed'){drawSnipAiCaption(ctx,segment,t,w,h,theme,position,scaleFactor);return}
    const tokens=rawTokens.map(word=>rule.casing==='upper'?word.toLocaleUpperCase():rule.casing==='lower'?word.toLocaleLowerCase():word);
    let active=styleOverride.revealPace==='natural'&&segment.words?.length?Math.max(0,segment.words.findIndex(word=>t>=word.start&&t<=word.end)):Math.min(tokens.length-1,Math.max(0,pacedWords.findIndex(word=>t>=word.start&&t<=word.end)));
    if(styleOverride.revealPace==='slow'&&tokens.length>1){active=Math.max(0,active);tokens.splice(0,tokens.length,tokens[active]);active=0}
    const palette={mint:'#30f2b5',cyan:'#39ddd0',red:'#ff374c',orange:'#ff9c24',cream:'#f8e9d7',white:'#fffdf6',yellow:'#ffe24d',pink:'#ff4b8b',green:'#43ef87',gold:'#e6ca82',burgundy:'#8c1534','burgundy-gold':'#9b2443','yellow-red':'#ffb52e',rainbow:'#44f0ce'};
    const accent=styleOverride.accentColor||theme.accent||palette[rule.palette]||'#45efc8',baseColor=styleOverride.baseColor||theme.baseColor||'#fffdf6';
    const composition=theme.category==='composition'||styles.find(item=>item[0]===styleName)?.[1]==='composition';
    const typography=rule.typographyCategory||'Kinetic Typography';
    const fontSize=Math.round(h*((theme.size||70)/1080)*scaleFactor),italic=Boolean(rule.italic||theme.italic),weight=rule.weight||(/Serif|Editorial|Cinematic/i.test(styleName)?700:900);
    if(isTypographyTemplate(templateName)||(styleOverride.revealPace!=='natural'&&styleOverride.revealPace!=='slow')){drawTopDownWordStack(ctx,pacedWords,t,w,h,position,fontSize,fontFamily,weight,italic,baseColor,accent,rule,patternCueIndex);return}
    const regularFont=`${italic?'italic ':''}${weight} ${fontSize}px ${fontFamily}`;
    ctx.font=regularFont;ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineCap='round';
    if(typography==='Stacked Typography'){
      const mainIndex=active>=0?active:Math.floor(tokens.length/2),mainWord=tokens[mainIndex],before=tokens.slice(0,mainIndex).join(' '),after=tokens.slice(mainIndex+1).join(' ');
      const centerX=w*position.x,centerY=h*position.y,mainSize=fontSize*1.42,supportSize=fontSize*.67;
      const intro=Math.max(0,Math.min(1,(t-segment.start)/.3)),ease=1-Math.pow(1-intro,3),pulse=Math.sin(Math.max(0,t-segment.start)*9);
      ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,.23)';ctx.shadowBlur=Math.max(2,fontSize*.045);ctx.shadowOffsetY=Math.max(1,fontSize*.018);
      if(before){ctx.font=`${italic?'italic ':''}${Math.min(weight,700)} ${supportSize}px ${fontFamily}`;ctx.fillStyle=baseColor;ctx.globalAlpha=.94*ease;ctx.fillText(before,centerX,centerY-mainSize*.64,w*.84)}
      ctx.font=`${italic?'italic ':''}${weight} ${mainSize}px ${fontFamily}`;ctx.fillStyle=accent;ctx.globalAlpha=ease;ctx.translate(centerX,centerY);ctx.scale(.84+.16*ease+(t<segment.start+.35?.035*Math.sin(pulse):0),.84+.16*ease+(t<segment.start+.35?.035*Math.sin(pulse):0));ctx.fillText(mainWord,0,0,w*.88);ctx.restore();
      if(after){ctx.save();ctx.font=`${italic?'italic ':''}${Math.min(weight,700)} ${supportSize}px ${fontFamily}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=baseColor;ctx.globalAlpha=.94*ease;ctx.shadowColor='rgba(0,0,0,.23)';ctx.shadowBlur=Math.max(2,fontSize*.045);ctx.shadowOffsetY=Math.max(1,fontSize*.018);ctx.fillText(after,centerX,centerY+mainSize*.64,w*.84);ctx.restore()}
      ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.shadowOffsetY=0;return;
    }
    const maxWidth=w*(composition?.72:.88),lines=[];
    const wrapLine=words=>{let line=[];for(const word of words){const candidate=[...line,word].join(' ');if(line.length&&ctx.measureText(candidate).width>maxWidth){lines.push(line);line=[word]}else line.push(word)}if(line.length)lines.push(line)};
    const rowPattern=reference?.cue?.rowWordCounts||[];
    if(rowPattern.length){
      const weights=[...rowPattern];while(weights.length>tokens.length&&weights.length>1)weights[weights.length-2]+=weights.pop();
      const totalWeight=weights.reduce((a,b)=>a+b,0)||1,counts=weights.map(weight=>Math.max(1,Math.floor(tokens.length*weight/totalWeight)));
      while(counts.reduce((a,b)=>a+b,0)>tokens.length){let i=counts.findIndex(count=>count>1);if(i<0)break;counts[i]--}
      while(counts.reduce((a,b)=>a+b,0)<tokens.length){let i=weights.indexOf(Math.max(...weights));counts[i]++}
      let cursor=0;for(const count of counts){wrapLine(tokens.slice(cursor,cursor+count));cursor+=count}
    }else wrapLine(tokens);
    if(rule.animation==='side-stagger'||rule.animation==='duotone-stagger'){lines.length=0;tokens.forEach(word=>lines.push([word]))}
    const anchor=rule.anchor==='left'||rule.anchor==='right'?rule.anchor:(theme.anchor==='left'||/Side Stack|Duotone Quote Stack|Stacked Editorial/i.test(styleName)?'left':'center');
    ctx.textAlign='left';const lineHeight=fontSize*1.18,blockHeight=lines.length*lineHeight;let y=h*position.y-blockHeight/2;
    if(styleName==='Red Editorial Quote Card'){const widest=Math.max(...lines.map(words=>words.reduce((sum,word)=>sum+ctx.measureText(word).width,0)+(words.length-1)*ctx.measureText(' ').width));const left=w*position.x-widest/2-fontSize*.24;const top=y-fontSize*.34;ctx.save();ctx.fillStyle='#74172ddc';ctx.beginPath();ctx.roundRect(left,top,widest+fontSize*.48,blockHeight+fontSize*.68,fontSize*.18);ctx.fill();ctx.restore()}
    let tokenCursor=0;
    lines.forEach(words=>{
      const items=words.map(word=>{const index=tokenCursor++,isActive=index===active;let family=fontFamily;if(!styleOverride.fontId&&rule.middleWordFont&&index===Math.floor(tokens.length/2))family=`'${rule.middleWordFont}', ${family}`;if(!styleOverride.fontId&&styleName==='Script + Impact Word'&&isActive)family='Impact, sans-serif';ctx.font=`${italic?'italic ':''}${weight} ${fontSize}px ${family}`;return{word,index,isActive,width:ctx.measureText(word).width,font:ctx.font}});
      const gap=ctx.measureText(' ').width,totalWidth=items.reduce((sum,item)=>sum+item.width,0)+Math.max(0,items.length-1)*gap;
      const lineCenter=rule.anchor==='left'?w*.12:rule.anchor==='right'?w*.88:w*position.x;let x=anchor==='left'?lineCenter:anchor==='right'?lineCenter-totalWidth:lineCenter-totalWidth/2;
      items.forEach((item,wordIndex)=>{
        const animation=rule.animation||'pop',isActive=item.index===active,stagger=['side-stagger','stack-pop','stack-focus','duotone-stagger','poster-build','editorial-unfold','playful-stagger','editorial-color-build'].includes(animation);
        const delay=stagger?item.index*.065:0,raw=Math.max(0,Math.min(1,(t-segment.start-delay)/.34)),ease=1-Math.pow(1-raw,3),pulse=Math.sin(Math.max(0,t-segment.start)*10);
        let scale=1,dx=0,dy=0,alpha=1,rotation=0,clip=null;
        switch(animation){
          case'pop':scale=.78+.22*ease+.025*Math.sin(ease*Math.PI);break;
          case'orange-bounce':scale=.72+.28*ease+.09*Math.sin(ease*Math.PI);dy=(1-ease)*fontSize*.12;break;
          case'keyword-stomp':scale=.48+.52*ease;dy=(1-ease)*fontSize*.16;break;
          case'pink-pop':case'mint-spring':case'playful-stagger':scale=.72+.28*ease+(isActive?.035*Math.sin(pulse):.025*Math.sin(ease*Math.PI));break;
          case'rounded-rise':scale=.88+.12*ease;dy=(1-ease)*fontSize*.22;break;
          case'yellow-snap':scale=.88+.12*ease;break;
          case'red-word-punch':scale=isActive?1.12+.025*Math.sin(pulse):.84+.16*ease;break;
          case'active-scale':scale=isActive?1.16:1;break;
          case'stack-pop':scale=.82+.18*ease+(isActive?.04*Math.sin(pulse):0);break;
          case'green-pulse':scale=isActive?1+.045*Math.sin(pulse):1;break;
          case'red-flash':alpha=isActive?.82+.18*Math.abs(Math.sin(t*7)):1;break;
          case'side-stagger':case'duotone-stagger':dx=(1-ease)*(anchor==='right'?-fontSize*.7:fontSize*.7);alpha=.65+.35*ease;break;
          case'serif-rise':case'texture-rise':case'poster-build':dy=(1-ease)*fontSize*(animation==='poster-build'?.7:.38);alpha=.55+.45*ease;break;
          case'lower-third-fade':dy=(1-ease)*fontSize*.28;alpha=ease;break;
          case'soft-fade':case'script-fade':case'soft-italic-dissolve':case'micro-fade':case'slow-script-write':case'card-reveal':case'cinematic-reveal':alpha=animation==='slow-script-write'?Math.min(1,Math.max(0,(t-segment.start-delay)/.65)):ease;if(animation==='card-reveal')scale=.96+.04*ease;break;
          case'marker-wipe':case'phrase-cut':clip=ease;dx=(1-ease)*fontSize*.22;break;
          case'word-swap':scale=isActive?1.05:1;break;
          case'scenic-drift':alpha=ease;dx=(1-ease)*fontSize*.12;dy=(1-ease)*fontSize*.08;break;
          case'editorial-unfold':rotation=(1-ease)*-.08;dy=(1-ease)*fontSize*.18;alpha=.45+.55*ease;break;
          case'script-impact-swap':scale=isActive?1.12:.96+.04*ease;break;
          case'minimal-cut':alpha=1;break;
          case'stack-focus':scale=isActive?1.08:1;alpha=.74+.26*ease;break;
          case'editorial-color-build':alpha=.72+.28*ease;break;
        }
        if(typography==='Kinetic Typography'&&isActive)scale*=1.1;
        const activeColor=isActive&&(typography==='Kinetic Typography'||typography==='Highlight Typography');ctx.font=item.font;ctx.fillStyle=activeColor?accent:typography==='Handwritten Typography'?accent:typography==='Editorial Typography'&&item.index===0?accent:(animation==='side-stagger'&&item.index<active?'#c9c9c5':baseColor);
        ctx.shadowColor='rgba(0,0,0,.22)';ctx.shadowBlur=Math.max(2,fontSize*.045);ctx.shadowOffsetY=Math.max(1,fontSize*.018);
        ctx.save();ctx.globalAlpha=alpha;ctx.translate(x+item.width/2+dx,y+dy);ctx.rotate(rotation);ctx.scale(scale,scale);
        if(clip!==null){ctx.beginPath();ctx.rect(-item.width/2-fontSize,-fontSize,Math.max(0,item.width+fontSize*2)*clip,fontSize*2);ctx.clip()}
        ctx.textAlign='center';ctx.fillText(item.word,0,0);ctx.restore();x+=item.width+gap;
      });y+=lineHeight;
    });
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.globalAlpha=1;
  }
  function ensureMotionFillVideo(theme){
    if(!theme?.fillVideo)return false;
    const url=new URL(`assets/motion-fill/${theme.fillVideo}`,document.baseURI).href;
    if(motionFillPath!==url){motionFillPath=url;motionFillVideo.src=url;motionFillVideo.load()}
    if(motionFillVideo.readyState>=2){motionFillVideo.play().catch(()=>{});return true}
    motionFillVideo.play().catch(()=>{});return false;
  }
  async function waitForMotionFillVideo(theme){
    if(!theme?.fillVideo)throw new Error('This motion graphic style has no fill video.');
    ensureMotionFillVideo(theme);
    if(motionFillVideo.readyState<2)await new Promise((resolve,reject)=>{const ready=()=>{clean();resolve()};const failed=()=>{clean();reject(new Error('Could not load the motion fill video.'))};const clean=()=>{motionFillVideo.removeEventListener('loadeddata',ready);motionFillVideo.removeEventListener('error',failed)};motionFillVideo.addEventListener('loadeddata',ready,{once:true});motionFillVideo.addEventListener('error',failed,{once:true})});
    await motionFillVideo.play();
  }
  window.startMotionGraphicPreview=name=>{const theme=(window.capsnipThemes||[]).find(x=>x.name===name);if(theme)ensureMotionFillVideo(theme);updateCaptionPreview()};
  window.stopMotionGraphicPreview=()=>{if(motionMaskPreview){motionMaskPreview.style.display='none';const ctx=motionMaskPreview.getContext('2d');ctx?.clearRect(0,0,motionMaskPreview.width,motionMaskPreview.height)}};
  function drawMotionGraphicPreview(segment,t){
    if(!motionMaskPreview||!video)return;
    const rect=preview.getBoundingClientRect(),dpr=localStorage.getItem('capsnip.previewQuality')==='balanced'?Math.min(1,window.devicePixelRatio||1):Math.min(2,window.devicePixelRatio||1);
    const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
    if(motionMaskPreview.width!==width||motionMaskPreview.height!==height){motionMaskPreview.width=width;motionMaskPreview.height=height}
    const ctx=motionMaskPreview.getContext('2d');if(ctx)drawVideoFilledCaption(ctx,segment,t,width,height,(window.capsnipThemes||[]).find(x=>x.name===appliedTemplate)||{},motionFillVideo);
  }
  function drawVideoFilledCaption(ctx,segment,t,w,h,theme,fillVideo,position=captionPosition,scaleFactor=captionScale){
    ctx.clearRect(0,0,w,h);
    if(!fillVideo||fillVideo.readyState<2||!fillVideo.videoWidth||!fillVideo.videoHeight)return;
    const sourceWords=wordsWithTiming(segment);
    if(!sourceWords.length)return;
    let activeIndex=sourceWords.findIndex(word=>t>=word.start&&t<=word.end);if(activeIndex<0)activeIndex=Math.max(0,sourceWords.findIndex(word=>word.start>t)-1);
    const chunkStart=Math.floor(Math.max(0,activeIndex)/6)*6,chunk=(captionStyleOverrides[appliedTemplate]?.revealPace||'stacked')==='slow'?sourceWords.slice(activeIndex,activeIndex+1):sourceWords.slice(chunkStart,chunkStart+6);
    const firstCount=chunk.length<=4?chunk.length:4;
    const lines=[chunk.slice(0,firstCount),chunk.slice(firstCount)].filter(line=>line.length);
    const customFont=fontById(captionStyleOverrides[appliedTemplate]?.fontId),fontSize=Math.max(18,h*(Number(theme.size)||84)/1080*scaleFactor),font=`900 ${fontSize}px ${customFont?.family||theme.font||'Arial Black, sans-serif'}`;
    if(!motionMaskCanvas){motionMaskCanvas=document.createElement('canvas');motionMaskContext=motionMaskCanvas.getContext('2d')}
    if(!motionMaskContext)return;
    if(motionMaskCanvas.width!==w||motionMaskCanvas.height!==h){motionMaskCanvas.width=w;motionMaskCanvas.height=h}
    const mask=motionMaskContext;mask.clearRect(0,0,w,h);mask.font=font;mask.textBaseline='middle';mask.textAlign='center';mask.fillStyle='#fff';
    const lineHeight=fontSize*1.08,blockHeight=lines.length*lineHeight,centerX=w*position.x,firstY=h*position.y-blockHeight/2+lineHeight/2;
    lines.forEach((line,index)=>mask.fillText(line.map(word=>(word.text||'').trim().toLocaleUpperCase()).join(' '),centerX,firstY+index*lineHeight,w*.9));
    const scale=Math.max(w/fillVideo.videoWidth,h/fillVideo.videoHeight),fw=fillVideo.videoWidth*scale,fh=fillVideo.videoHeight*scale;
    ctx.save();ctx.drawImage(fillVideo,(w-fw)/2,(h-fh)/2,fw,fh);ctx.globalCompositeOperation='destination-in';ctx.drawImage(motionMaskCanvas,0,0,w,h);ctx.globalCompositeOperation='source-over';ctx.restore();
  }
  function drawSnipAiCaption(ctx,segment,t,w,h,theme,position,scaleFactor){
    const override=captionStyleOverrides[appliedTemplate]||{},font=fontById(override.fontId),options={...theme,font:font?`'${font.family}'`:theme.font,primaryColor:override.baseColor||theme.primaryColor||theme.baseColor,accentColor:override.accentColor||theme.accentColor||theme.accent,dualPrimaryColor:override.accentColor||theme.dualPrimaryColor,dualSecondaryColor:override.baseColor||theme.dualSecondaryColor},sourceWords=wordsWithTiming(segment);if(!sourceWords.length)return;
    let words=sourceWords.map((word,index)=>{const mixed=options.category==='mixed'?options.sourceStyles[index%options.sourceStyles.length]:null;return{...word,text:options.uppercase?word.text.toLocaleUpperCase():word.text,...(mixed?{fontFamily:font?`'${font.family}'`:mixed.fontFamily,fontWeight:mixed.weight,fontSize:mixed.size*h/1080*scaleFactor,mixedBaseColor:override.baseColor||mixed.baseColor,mixedAccentColor:override.accentColor||mixed.accentColor}: {})}});
    let activeIndex=words.findIndex(word=>t>=word.start&&t<=word.end);if(override.revealPace==='slow'&&words.length>1){activeIndex=Math.max(0,activeIndex);words=[words[activeIndex]];activeIndex=0}const fontSize=Math.max(12,Math.round(Number(options.size||64)*h/1080*scaleFactor));
    const gap=fontSize*Math.min(.18,Math.max(.06,Number(options.gap??.12))),maxWidth=w*.84,scaleReserve=options.engineTemplate==='punch'?1.22:options.engineTemplate==='pop'?1.14:options.engineTemplate==='bounce'?1.12:options.engineTemplate==='kinetic'?1.08:1.04;
    const measure=word=>{ctx.font=`${word.fontWeight||options.weight||800} ${word.fontSize||fontSize}px ${word.fontFamily||options.font||'Arial, sans-serif'}`;const measuredWidth=ctx.measureText(word.text).width;return{...word,measuredWidth,reservedWidth:measuredWidth*scaleReserve,fontSize:word.fontSize||fontSize}};
    const measured=words.map(measure),lines=[];
    if(options.engineTemplate==='dual-line'||options.engineTemplate==='yellow-stack'){
      let cursor=0;while(cursor<measured.length){const chunk=measured.slice(cursor,cursor+Math.max(2,(options.wordsPerLine||3)*2)),splitAt=Math.ceil(chunk.length/2),groupStart=chunk[0].start,groupEnd=chunk.at(-1).end;
        [[0,chunk.slice(0,splitAt)],[1,chunk.slice(splitAt)]].forEach(([rowIndex,row])=>{if(row.length){const formatted=row.map(word=>({...word,rowIndex,text:rowIndex===0&&options.dualPrimaryUppercase?word.text.toUpperCase():word.text,fontSize:rowIndex===1&&options.secondaryFontSize?options.secondaryFontSize* h/1080*scaleFactor:fontSize,fontWeight:rowIndex===1?700:options.weight,fontFamily:rowIndex===1&&options.secondaryFont?options.secondaryFont:options.font})).map(measure);formatted.groupStart=groupStart;formatted.groupEnd=groupEnd;formatted.rowIndex=rowIndex;lines.push(formatted)}});cursor+=chunk.length}
    }else if(options.engineTemplate==='kinetic'){
      let cursor=0,groupId=0;while(cursor<measured.length){let chunkSize=Math.min(6,measured.length-cursor),remaining=measured.slice(cursor);if(chunkSize>2){const secondWidth=remaining.slice(2,chunkSize).reduce((sum,word)=>sum+word.reservedWidth,0)+gap*Math.max(0,chunkSize-3);while(chunkSize>3&&secondWidth>maxWidth)chunkSize--}const chunk=remaining.slice(0,chunkSize),groupStart=chunk[0].start,groupEnd=chunk.at(-1).end;[[0,chunk.slice(0,2)],[1,chunk.slice(2)]].forEach(([rowIndex,row])=>{if(row.length){row.groupId=groupId;row.groupStart=groupStart;row.groupEnd=groupEnd;row.rowIndex=rowIndex;lines.push(row)}});cursor+=chunkSize;groupId++}
    }else{
      let row=[],rowWidth=0;for(const word of measured){const needed=(row.length?gap:0)+word.reservedWidth;if(row.length&&(row.length>=(options.wordsPerLine||5)||rowWidth+needed>maxWidth)){lines.push(row);row=[];rowWidth=0}row.push(word);rowWidth+=(row.length===1?word.reservedWidth:gap+word.reservedWidth)}if(row.length)lines.push(row)
    }
    if(!lines.length)return;
    const centerX=w*position.x,centerY=h*position.y,captionTopY=centerY-fontSize/2,lineHeight=fontSize*Math.min(1.5,Math.max(1,Number(options.lineHeightRatio)||1.24));
    const drawText=(text,x,y,size,color,alpha=1,scale=1,shadow=options.shadow,weight=options.weight||800,family=options.font||'Arial, sans-serif')=>{ctx.save();ctx.globalAlpha=alpha;ctx.font=`${weight} ${size}px ${family}`;ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillStyle=color;ctx.shadowColor=shadow?'rgba(0,0,0,.55)':'transparent';ctx.shadowBlur=shadow?Math.max(1,size*.055):0;ctx.shadowOffsetX=shadow?2:0;ctx.shadowOffsetY=shadow?2:0;if(scale!==1){const measured=ctx.measureText(text).width;ctx.translate(x+measured/2,y);ctx.scale(scale,scale);ctx.textAlign='center';ctx.fillText(text,0,0);ctx.restore();return}ctx.fillText(text,x,y);ctx.restore()};
    const alphaFade=(word,duration)=>Math.max(0,Math.min(1,(t-word.start)/duration));
    for(const line of lines){
      const lineStart=line.groupStart??line[0].start,lineEnd=line.groupEnd??line.at(-1).end;if(t<lineStart||t>lineEnd)continue;
      if(options.engineTemplate==='typewriter'){
        const reveal=[];line.forEach((word,index)=>{const chars=Array.from(word.text),charDuration=(word.end-word.start)/Math.max(1,chars.length);chars.forEach((character,charIndex)=>reveal.push({character,at:word.start+charIndex*charDuration}));if(index<line.length-1)reveal.push({character:' ',at:word.end})});
        let prefix='',visibleText='';reveal.forEach((item,index)=>{prefix+=item.character;const at=Math.max(lineStart,item.at),next=index+1<reveal.length?Math.max(at+.001,reveal[index+1].at):lineEnd;if(t>=at&&t<=next)visibleText=prefix});
        if(visibleText){ctx.font=`${options.weight||800} ${fontSize}px ${options.font||'Arial, sans-serif'}`;const textWidth=ctx.measureText(visibleText).width;drawText(visibleText,Math.max(0,centerX-textWidth/2),captionTopY+fontSize/2,fontSize,options.accentColor,1,1,options.shadow)}continue
      }
      const lineWidth=line.reduce((sum,word)=>sum+word.measuredWidth,0)+gap*Math.max(0,line.length-1);let x=centerX-lineWidth/2;
      let y=captionTopY+fontSize/2;if(options.engineTemplate==='kinetic')y=centerY-lineHeight+(line.rowIndex||0)*lineHeight;else if(options.engineTemplate==='dual-line'||options.engineTemplate==='yellow-stack')y=centerY-lineHeight/2-fontSize/2+(line.rowIndex||0)*lineHeight;
      line.forEach((word,index)=>{
        const isActive=word===words[activeIndex],past=t>=word.end,center=x+word.measuredWidth/2;let baseAlpha=Number(options.opacity??.9),activeAlpha=1,scale=1,dx=0,baseColor=word.mixedBaseColor||options.primaryColor,activeColor=word.mixedAccentColor||options.accentColor;
        if(options.engineTemplate==='kinetic'||options.engineTemplate==='dual-line'||options.engineTemplate==='yellow-stack'){baseAlpha=past?Number(options.opacity??.9):0;if(options.engineTemplate==='dual-line'||options.engineTemplate==='yellow-stack'){baseColor=word.rowIndex===0?options.dualPrimaryColor||options.primaryColor:options.dualSecondaryColor||options.secondaryColor||options.primaryColor;activeColor=word.rowIndex===0?options.dualPrimaryColor||options.accentColor:options.dualSecondaryColor||options.secondaryColor||options.accentColor}}
        if(options.engineTemplate==='bold-center'||options.engineTemplate==='minimal')baseAlpha=0;
        if(options.engineTemplate==='pop'){scale=1+.14*Math.max(0,1-(t-word.start)/.16);activeAlpha=alphaFade(word,.07)}
        if(options.engineTemplate==='punch'){scale=1+.22*Math.max(0,1-(t-word.start)/.18);dx=(1-Math.min(1,Math.max(0,(t-word.start)/.12)))*(index%2===0?-86:86);activeAlpha=alphaFade(word,.07);activeColor=override.accentColor||((index+lines.indexOf(line))%2===0?'#FF2A2A':'#FFE600')}
        if(options.engineTemplate==='karaoke')activeAlpha=Math.min(1,Math.max(0,(t-word.start)/.24));
        if(options.animation==='fade'||options.animation==='single-fade'||options.animation==='side-reveal'||options.animation==='blur-in')activeAlpha=alphaFade(word,Number(options.fadeInDuration)||.12);
        if(options.animation==='side-reveal')dx=(1-Math.min(1,Math.max(0,(t-word.start)/.16)))*22;
        if(isActive&&(options.engineTemplate==='highlight-box'||options.engineTemplate==='violet-pill'||options.engineTemplate==='podcast')){const boxColor=options.engineTemplate==='podcast'?options.boxColor:options.boxColor||'#0F766E',bw=word.measuredWidth+fontSize*.42,bh=fontSize*1.02;ctx.save();ctx.globalAlpha=options.engineTemplate==='podcast'?.78:.98;ctx.fillStyle=boxColor;ctx.fillRect(center-bw/2,y-bh/2,bw,bh);ctx.restore()}
        if(options.engineTemplate==='karaoke'&&isActive){ctx.save();ctx.globalAlpha=.28;ctx.shadowColor=word.mixedAccentColor||options.accentColor;ctx.shadowBlur=fontSize*.38;ctx.fillStyle=word.mixedAccentColor||options.accentColor;ctx.font=`${word.fontWeight||options.weight||800} ${word.fontSize||fontSize}px ${word.fontFamily||options.font||'Arial, sans-serif'}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(word.text,center+dx,y);ctx.restore()}
        if(options.engineTemplate==='punch'&&isActive){ctx.save();ctx.globalAlpha=Math.max(0,1-(t-word.start)/.07);ctx.fillStyle='#FF2A2A';ctx.fillRect(center-word.measuredWidth/2-fontSize*.12,y-fontSize*.52,word.measuredWidth+fontSize*.24,fontSize*1.04);ctx.restore()}
        const currentColor=isActive?activeColor:baseColor,previewAlpha=isActive?activeAlpha:baseAlpha;
        if(options.engineTemplate==='bold-center'||options.engineTemplate==='minimal'){if(!isActive){x+=word.measuredWidth+gap;return}}
        drawText(word.text,center-word.measuredWidth/2+dx,y,word.fontSize||fontSize,currentColor,previewAlpha,scale,options.shadow,word.fontWeight||options.weight||800,word.fontFamily||options.font||'Arial, sans-serif');x+=word.measuredWidth+gap;
      });
    }
  }
  function updateExportPreviewAspect(){const frame=document.getElementById('exportPreviewFrame'),choice=document.getElementById('exportFrameSize')?.value||'source';if(!frame)return;let width,height;if(choice==='source'&&video?.videoWidth){width=video.videoWidth;height=video.videoHeight}else if(choice!=='source'){[width,height]=choice.split('x').map(Number)}else{width=16;height=9}if(!width||!height)return;const maxWidth=Math.max(180,Math.min(560,(frame.parentElement?.clientWidth||600)-30)),maxHeight=360,scale=Math.min(maxWidth/width,maxHeight/height);frame.style.width=`${Math.round(width*scale)}px`;frame.style.height=`${Math.round(height*scale)}px`;frame.style.aspectRatio=`${width}/${height}`;frame.style.marginInline='auto';frame.dataset.aspect=`${width}:${height}`}
  function updateExportPreview(){
    const exportVideo=document.getElementById('exportVideoPreview'),canvas=document.getElementById('exportCaptionCanvas');if(!exportVideo||!canvas)return;
    exportVideo.style.objectFit=(document.getElementById('exportReframeMode')?.value||localStorage.getItem('capsnip.reframeMode'))==='fill'?'cover':'contain';exportVideo.style.background='#000';
    if(renderedVideoPath){if(exportVideo.src!==renderedVideoPath){exportVideo.src=renderedVideoPath;exportVideo.load()}canvas.style.display='none';return}
    if(!video)return;const source=video.currentSrc||video.src;
    if(exportVideo.src!==source){exportVideo.src=source;exportVideo.load();exportVideo.addEventListener('loadedmetadata',()=>{try{exportVideo.currentTime=Math.min(video.currentTime||0,Math.max(0,exportVideo.duration-.05))}catch{}updateExportPreview();if(document.getElementById('page-export')?.classList.contains('active')&&exportState!=='rendering'&&exportState!=='exported')exportVideo.play().catch(()=>{})},{once:true})}
    if(!video.videoWidth||!video.videoHeight)return;
    const frameChoice=document.getElementById('exportFrameSize')?.value||'source',[targetWidth,targetHeight]=frameChoice==='source'?[video.videoWidth,video.videoHeight]:frameChoice.split('x').map(Number);if(canvas.width!==targetWidth||canvas.height!==targetHeight){canvas.width=targetWidth;canvas.height=targetHeight}
    const ctx=canvas.getContext('2d'),t=exportVideo.readyState>=1?exportVideo.currentTime:(video.currentTime||0),segmentIndex=captionSegments.findIndex(segment=>t>=segment.start&&t<=captionDisplayEnd(segment)),segment=segmentIndex>=0?captionSegments[segmentIndex]:null,theme=(window.capsnipThemes||[]).find(item=>item.name===appliedTemplate);
    ctx.clearRect(0,0,canvas.width,canvas.height);canvas.style.display=segment&&theme?'block':'none';if(segment&&theme){const position=captionPositionFor(segmentIndex,appliedTemplate);if(theme.category==='motion-graphic'){ensureMotionFillVideo(theme);drawVideoFilledCaption(ctx,segment,t,canvas.width,canvas.height,theme,motionFillVideo,position,captionScale)}else drawCaption(ctx,segment,t,canvas.width,canvas.height,appliedTemplate,position,captionScale,segmentIndex,true)}
  }
  window.openExportPage=()=>{if(!media||!captionSegments.length||!appliedTemplate)return toast('Generate captions before opening export');video?.pause();go('export');updateExportPreviewAspect();updateExportPreview();const exportVideo=document.getElementById('exportVideoPreview');if(exportVideo){exportVideo.volume=.9;if(exportVideo.readyState>=2&&!renderedVideoPath&&video)try{exportVideo.currentTime=Math.min(video.currentTime||0,Math.max(0,exportVideo.duration-.05))}catch{}if(exportState!=='exported')exportVideo.play().catch(()=>{})}};
  document.getElementById('exportVideoPreview')?.addEventListener('timeupdate',updateExportPreview);document.getElementById('exportVideoPreview')?.addEventListener('seeked',updateExportPreview);
  document.getElementById('exportFrameSize')?.addEventListener('change',()=>{renderedVideoPath=null;updateExportPreviewAspect();updateExportPreview()});
  const exportReframe=document.getElementById('exportReframeMode'),reframeHelp=document.getElementById('exportReframeHelp');function updateReframePreview(){const mode=exportReframe?.value||'fit';localStorage.setItem('capsnip.reframeMode',mode);if(editorReframe)editorReframe.value=mode;if(settingsReframe)settingsReframe.value=mode;renderedVideoPath=null;fitPreviewToSource();if(reframeHelp)reframeHelp.textContent=mode==='fill'?'Zoom/crop edges to fill the selected frame.':'Keep full video; add black bars as needed.';updateExportPreviewAspect();updateExportPreview()}
  window.addEventListener('resize',updateExportPreviewAspect);
  window.rendering = async button => {
    if(exportRequestActive||motionExportActive||exportState==='rendering')return;
    exportRequestActive=true;setExportState('rendering');pauseExportMedia();
    try { await renderLocalWebM(button); }
    catch(error){toast(error.message||'Export failed');}
    finally {exportRequestActive=false;if(!motionExportActive)setExportState(exportState==='exported'?'exported':'idle');}
  };
  document.querySelector('.back')?.addEventListener('click',async()=>{
    if(document.getElementById('page-export')?.classList.contains('active')){
      if(exportState==='rendering'||motionExportActive){toast('Cancel the current export before returning to the editor.');return;}
      pauseExportMedia();go('editor');setProjectTitle(projectName);syncTimeline();updateCaptionPreview();
    }else{go('home');}
  });
  window.addEventListener('keydown', event => {
    // Keep project shortcuts from changing editor state behind the blocking render dialog.
    if (generationBusy) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveButton.click(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') { event.preventDefault(); openProject.click(); }
  });
  function slug(value) { return String(value || 'capsnip').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'capsnip'; }

  async function refreshEngine() {
    try { engine = api.engineStatus ? await api.engineStatus() : engine; localStorage.setItem('capsnip.deviceProfile',JSON.stringify(engine)); }
    catch { /* keep the last cached profile */ }
    const badges=document.querySelectorAll('.rightpanel .smallmuted');
    if(badges[0])badges[0].textContent=engine.ready?'Local speech engine':'Install speech engine in README';
    if(badges[1])badges[1].textContent=engine.ready?`${engine.deviceName||engine.device.toUpperCase()} ready`:'Local engine not installed';
    const hardware=document.getElementById('hardwareProfile'),modelInfo=document.getElementById('modelProfile');
    if(hardware)hardware.textContent=`${engine.deviceName||engine.device||'CPU'}${engine.gpuName?` · ${engine.gpuName}`:''} · ${engine.ramGb||'—'} GB RAM`;
    if(modelInfo)modelInfo.textContent=`CPU model: ${engine.cpuModel||'base'} · CPU transcription`;
    const setup=document.getElementById('engineSetupStatus');
    if(setup)setup.textContent=engine.ready?`Ready · ${engine.deviceName||engine.device} · ${engine.device==='cuda'?engine.gpuModel:engine.cpuModel}`:(engine.message||'Speech engine not installed');
    return engine;
  }
  const languageSelect=document.getElementById('languageSelect');
  const savedLanguage=localStorage.getItem('capsnip.language'); if(savedLanguage)languageSelect.value=savedLanguage;
  languageSelect.addEventListener('change',()=>localStorage.setItem('capsnip.language',languageSelect.value));
  const tickToggle=document.getElementById('tickEffects'); if(tickToggle){if(localStorage.getItem('capsnip.tickEffects')===null)localStorage.setItem('capsnip.tickEffects','true');tickToggle.classList.toggle('on',localStorage.getItem('capsnip.tickEffects')==='true');tickToggle.setAttribute('aria-checked',String(tickToggle.classList.contains('on')));tickToggle.addEventListener('click',()=>{tickToggle.classList.toggle('on');const enabled=tickToggle.classList.contains('on');tickToggle.setAttribute('aria-checked',String(enabled));localStorage.setItem('capsnip.tickEffects',String(enabled));lastPreviewSfxKey='';invalidateCaptionRender();if(enabled)try{previewAudioContext??=new AudioContext();void previewAudioContext.resume().then(()=>playCaptionSound(previewAudioContext,previewAudioContext.destination,'tick')).catch(()=>{})}catch{}})}
  const saveCaptionPosition=()=>{captionPositionWasManuallySet=true;localStorage.setItem('capsnip.captionPosition',JSON.stringify(captionPosition))};
  document.getElementById('positionAllMode')?.addEventListener('click',()=>{captionPositionMode='all';localStorage.setItem('capsnip.positionMode','all');clearRenderedEditorPreview();updateCaptionPreview()});document.getElementById('positionLineMode')?.addEventListener('click',()=>{captionPositionMode='line';localStorage.setItem('capsnip.positionMode','line');clearRenderedEditorPreview();updateCaptionPreview()});document.getElementById('resetLinePosition')?.addEventListener('click',()=>{if(captionSegments[selectedPositionIndex]){delete captionSegments[selectedPositionIndex].position;invalidateCaptionRender()}});
  if(captionDragHit){let moving=false;captionDragHit.addEventListener('pointerdown',event=>{moving=true;captionDragHit.setPointerCapture(event.pointerId);event.preventDefault()});captionDragHit.addEventListener('pointermove',event=>{if(!moving)return;const rect=preview.getBoundingClientRect(),position={x:Math.min(.94,Math.max(.06,(event.clientX-rect.left)/rect.width)),y:Math.min(.94,Math.max(.06,(event.clientY-rect.top)/rect.height))},time=video?.currentTime||0,visibleIndex=captionSegments.findIndex(segment=>time>=segment.start&&time<=captionDisplayEnd(segment)),targetIndex=visibleIndex>=0?visibleIndex:selectedPositionIndex;if(captionPositionMode==='line'&&targetIndex>=0&&captionSegments[targetIndex]){selectedPositionIndex=targetIndex;captionSegments[targetIndex].position=position;document.querySelectorAll('.transcript-row').forEach((row,rowIndex)=>row.classList.toggle('selected-line',rowIndex===targetIndex))}else{captionPosition=position;captionSegments.forEach(segment=>delete segment.position);saveCaptionPosition()}invalidateCaptionRender()});captionDragHit.addEventListener('pointerup',()=>moving=false);captionDragHit.addEventListener('pointercancel',()=>moving=false)}
  document.getElementById('linePositionGrid')?.addEventListener('click',event=>{const button=event.target.closest('button[data-x]');if(!button)return;const position={x:Number(button.dataset.x),y:Number(button.dataset.y)};if(captionPositionMode==='line'){if(selectedPositionIndex<0||!captionSegments[selectedPositionIndex])return;captionSegments[selectedPositionIndex].position=position}else{captionPosition=position;captionSegments.forEach(segment=>delete segment.position);saveCaptionPosition()}invalidateCaptionRender()});
  if(captionResizeHandle){let resizeStart=null;captionResizeHandle.addEventListener('pointerdown',event=>{resizeStart={y:event.clientY,scale:captionScale};captionResizeHandle.setPointerCapture(event.pointerId);event.preventDefault()});captionResizeHandle.addEventListener('pointermove',event=>{if(!resizeStart)return;const rect=preview.getBoundingClientRect();captionScale=Math.max(.12,Math.min(2.4,resizeStart.scale-(event.clientY-resizeStart.y)/Math.max(160,rect.height)*2.4));localStorage.setItem('capsnip.captionScale',String(captionScale));invalidateCaptionRender()});captionResizeHandle.addEventListener('pointerup',()=>resizeStart=null);captionResizeHandle.addEventListener('pointercancel',()=>resizeStart=null)}
  if(captionDemo){captionDemo.style.left=`${captionPosition.x*100}%`;captionDemo.style.top=`${captionPosition.y*100}%`;captionDemo.style.transform='translate(-50%,-50%)';let moving=false;captionDemo.addEventListener('pointerdown',e=>{moving=true;captionDemo.setPointerCapture(e.pointerId)});captionDemo.addEventListener('pointermove',e=>{if(!moving)return;const rect=preview.getBoundingClientRect();captionPosition={x:Math.min(.9,Math.max(.1,(e.clientX-rect.left)/rect.width)),y:Math.min(.9,Math.max(.1,(e.clientY-rect.top)/rect.height))};captionDemo.style.left=`${captionPosition.x*100}%`;captionDemo.style.top=`${captionPosition.y*100}%`;localStorage.setItem('capsnip.captionPosition',JSON.stringify(captionPosition))});captionDemo.addEventListener('pointerup',()=>moving=false)}
  const templateSampleText={'Spotlight Caps':'YAAR PUBLISH','Stacked Editorial':'JO INTENT KAR RAHA','Clean Midline':'FEATURE KAAFI','Red Italic':'YEH BILKUL SAHI','Orange Condensed':'KYA BAAT HAI','Clean White Focus':'CAPTION AB READY','Serif Hook':'A NEW STORY','Kinetic Word Stack':'SAY IT LOUD','Red Statement':'THIS IS THE MOMENT','Handwritten Whisper':'JUST ONE THING','Yellow Script':'MAKE IT COUNT','Big Yellow Keyword':'REVIEW KARKE','Red Pop Phrase':'BILKUL READY','Handwritten White Caps':'KEEP MOVING','Soft Italic Caps':'STAY WITH ME','Mint Pop':'BADA DUKH HO RHA','White Stack Highlight':'CAPTION BILKUL READY','Minimal Vertical White':'JUST LISTEN','Rounded Portrait Subtitle':'HELLO THERE','Grunge Serif Lead':'THE LONG ROAD','Green Pop Word':'KYA MAST HAI','Travel Micro Caption':'ON THE WAY','Devanagari Poster Headline':'ये बात समझो','Duotone Quote Stack':'KYA AB KYA BOLU','Scenic Display Title':'FIND YOUR WAY','Editorial Split Quote':'A BETTER WAY','Yellow Subtitle':'AB BILKUL READY','White Interview Caption':'LET ME EXPLAIN','Red Emphasis Line':'THIS REALLY MATTERS','Red Editorial Quote Card':'A WORD TO REMEMBER','Script + Impact Word':'MAKE IT BIG','Green Poster Script':'MAKE YOUR STORY','Playful Display Pop':'YOUR STORY POPS','Yellow-Red Editorial':'FEATURE KAAFI USEFUL','Cinematic Side Stack':'A QUIET MOMENT'};
  const previewLoops=new WeakMap();
  const previewStartTimes=new WeakMap();
  function paintTemplateSample(canvas){
    const name=canvas.dataset.stylePreview;if(!name)return;
    const theme=(window.capsnipThemes||[]).find(item=>item.name===name),ctx=canvas.getContext('2d');if(!theme||!ctx)return;
    const phrase=templateSampleText[name]||'CAPTION LOOKS GREAT',sampleWords=phrase.trim().split(/\s+/),period=2.6;
    let start=previewStartTimes.get(canvas);if(start===undefined){start=performance.now()/1000;previewStartTimes.set(canvas,start)}
    const motionEnabled=localStorage.getItem('capsnip.previewMotion')!=='false',elapsed=motionEnabled?performance.now()/1000-start:0,time=motionEnabled?elapsed%period:.8,sequence=(window.capsnipCaptionPatterns||{})[name]?.sequence||[],patternCueIndex=motionEnabled&&sequence.length?Math.floor(elapsed/period)%sequence.length:0,cue=referencePattern(name,patternCueIndex)?.cue;
    const tokenCount=Math.max(1,Math.min(8,cue?.sourceWordCount||sampleWords.length)),extras=['DEKHO','YEH','KAISA','ABHI','ACHA','KARO','WOW','NOW'].filter(word=>!sampleWords.includes(word)),tokens=[...sampleWords,...extras].slice(0,tokenCount);
    const words=tokens.map((text,index)=>({text,start:index*period/tokens.length,end:(index+1)*period/tokens.length})),segment={text:tokens.join(' '),start:0,end:period,words};
    const rect=canvas.getBoundingClientRect(),coverScale=Math.max(rect.width/canvas.width,rect.height/canvas.height),baseFont=canvas.height*(Number(theme.size)||70)/1080,rule=(window.capsnipTemplateBehavior||{})[name]||{};let rows=[];
    if(rule.typographyCategory==='Stacked Typography')rows=tokens.map((_,index)=>[tokens.slice(0,index).join(' '),tokens.slice(index+1).join(' ')].filter(Boolean)).flat();
    else if(['side-stagger','duotone-stagger'].includes(rule.animation))rows=tokens.map(word=>word);
    else{let weights=[...(cue?.rowWordCounts||[tokens.length])];while(weights.length>tokens.length&&weights.length>1)weights[weights.length-2]+=weights.pop();const total=weights.reduce((a,b)=>a+b,0)||1,counts=weights.map(weight=>Math.max(1,Math.floor(tokens.length*weight/total)));while(counts.reduce((a,b)=>a+b,0)>tokens.length){const index=counts.findIndex(count=>count>1);if(index<0)break;counts[index]--}while(counts.reduce((a,b)=>a+b,0)<tokens.length){const index=weights.indexOf(Math.max(...weights));counts[index]++}let cursor=0;rows=counts.map(count=>tokens.slice(cursor,cursor+=count).join(' '))}
    const lineCount=Math.max(1,rule.typographyCategory==='Stacked Typography'?3:rows.length),widestLine=Math.max(4,...rows.map(line=>line.length)),targetFont=Math.min(44,rect.height*.80/(lineCount*1.18),rect.width*.84/(widestLine*.70)),previewScale=Math.min(7,Math.max(1.2,targetFont/Math.max(1,baseFont*coverScale)));
    ctx.fillStyle='#050708';ctx.fillRect(0,0,canvas.width,canvas.height);drawCaption(ctx,segment,time,canvas.width,canvas.height,name,{x:.5,y:.52},previewScale,patternCueIndex,true);
  }
  const templatePreviewObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{const canvas=entry.target;if(entry.isIntersecting){if(previewLoops.has(canvas))return;let last=0;const loop=now=>{if(!canvas.isConnected){previewLoops.delete(canvas);return}if(now-last>=1000/60){last=now;paintTemplateSample(canvas)}previewLoops.set(canvas,requestAnimationFrame(loop))};previewLoops.set(canvas,requestAnimationFrame(loop))}else if(previewLoops.has(canvas)){cancelAnimationFrame(previewLoops.get(canvas));previewLoops.delete(canvas)}}),{rootMargin:'100px'});
  window.refreshCapsnipTemplatePreviews=(host=document)=>host.querySelectorAll('canvas.caption-loop-canvas:not([data-observed])').forEach(canvas=>{canvas.dataset.observed='true';templatePreviewObserver.observe(canvas)});
  window.refreshCapsnipTemplatePreviews();
  window.refreshCapsnipEngine=refreshEngine;
  const settingsTabs=[...document.querySelectorAll('[data-settings-tab]')],settingsPanels=[...document.querySelectorAll('[data-settings-panel]')];
  settingsTabs.forEach(tab=>tab.addEventListener('click',()=>{settingsTabs.forEach(item=>item.classList.toggle('active',item===tab));settingsPanels.forEach(panel=>panel.classList.toggle('active',panel.dataset.settingsPanel===tab.dataset.settingsTab));if(tab.dataset.settingsTab==='transcription')void refreshEngine()}));
  const settingsFrame=document.getElementById('settingsFrameSize'),settingsReframe=document.getElementById('settingsReframeMode'),settingsFps=document.getElementById('settingsFps'),settingsQuality=document.getElementById('settingsQuality'),exportFrame=document.getElementById('exportFrameSize'),exportReframeMode=document.getElementById('exportReframeMode'),exportFps=document.getElementById('exportFps'),exportQuality=document.getElementById('exportQuality');
  const syncSelect=(a,b,key,fallback)=>{if(!a||!b)return;a.value=localStorage.getItem(key)||fallback;b.value=a.value;a.addEventListener('change',()=>{b.value=a.value;localStorage.setItem(key,a.value)});b.addEventListener('change',()=>{a.value=b.value;localStorage.setItem(key,b.value)})};syncSelect(settingsFrame,exportFrame,'capsnip.frameSize','source');syncSelect(settingsReframe,exportReframeMode,'capsnip.reframeMode','fit');syncSelect(settingsFps,exportFps,'capsnip.fps','source');syncSelect(settingsQuality,exportQuality,'capsnip.quality','high');
  const editorFrame=document.getElementById('editorFrameSize'),editorReframe=document.getElementById('editorReframeMode');if(editorFrame)editorFrame.value=localStorage.getItem('capsnip.frameSize')||'source';if(editorReframe)editorReframe.value=localStorage.getItem('capsnip.reframeMode')||'fit';
  function syncEditorReframe(){const frame=editorFrame?.value||'source',mode=editorReframe?.value||'fit';localStorage.setItem('capsnip.frameSize',frame);localStorage.setItem('capsnip.reframeMode',mode);if(exportFrame)exportFrame.value=frame;if(settingsFrame)settingsFrame.value=frame;if(exportReframeMode)exportReframeMode.value=mode;if(settingsReframe)settingsReframe.value=mode;renderedVideoPath=null;clearRenderedEditorPreview();fitPreviewToSource();updateReframePreview()}
  editorFrame?.addEventListener('change',syncEditorReframe);editorReframe?.addEventListener('change',syncEditorReframe);
  exportFrame?.addEventListener('change',()=>{if(editorFrame)editorFrame.value=exportFrame.value;localStorage.setItem('capsnip.frameSize',exportFrame.value);clearRenderedEditorPreview();fitPreviewToSource()});
  settingsFrame?.addEventListener('change',()=>{if(editorFrame)editorFrame.value=settingsFrame.value;localStorage.setItem('capsnip.frameSize',settingsFrame.value);clearRenderedEditorPreview();fitPreviewToSource()});
  settingsReframe?.addEventListener('change',()=>{if(exportReframeMode)exportReframeMode.value=settingsReframe.value;updateReframePreview()});exportReframeMode?.addEventListener('change',updateReframePreview);updateReframePreview();
  const outputFolderLabel=document.getElementById('outputFolderLabel'),outputLabels=[...document.querySelectorAll('.settings-output-label')];function updateOutputFolderLabel(value){const display=value?value.replace(/\\/g,'/').split('/').filter(Boolean).at(-1):'Videos / Capsnip Exports';if(outputFolderLabel){outputFolderLabel.textContent=display;outputFolderLabel.title=value||''}outputLabels.forEach(label=>{label.textContent=value||'Videos / Capsnip Exports';label.title=value||''})}updateOutputFolderLabel(localStorage.getItem('capsnip.outputDir'));
  async function chooseOutputFolder(){const folder=await api.chooseOutputFolder?.();if(!folder)return;localStorage.setItem('capsnip.outputDir',folder);updateOutputFolderLabel(folder);toast('MP4 export folder updated')}document.getElementById('browseOutputFolder')?.addEventListener('click',chooseOutputFolder);document.querySelectorAll('[data-pick-output-folder]').forEach(button=>button.addEventListener('click',chooseOutputFolder));
  const audioToggles=[document.getElementById('settingsAudio'),document.getElementById('exportIncludeAudio')].filter(Boolean);function setAudioToggle(value){localStorage.setItem('capsnip.includeAudio',String(value));audioToggles.forEach(toggle=>{toggle.classList.toggle('on',value);toggle.setAttribute('aria-checked',String(value))})}setAudioToggle(localStorage.getItem('capsnip.includeAudio')!=='false');audioToggles.forEach(toggle=>toggle.addEventListener('click',()=>setAudioToggle(!toggle.classList.contains('on'))));
  const settingsLanguage=document.getElementById('settingsLanguage');if(settingsLanguage){settingsLanguage.value=localStorage.getItem('capsnip.language')||languageSelect.value;settingsLanguage.addEventListener('change',()=>{languageSelect.value=settingsLanguage.value;localStorage.setItem('capsnip.language',settingsLanguage.value)})}languageSelect.addEventListener('change',()=>{if(settingsLanguage)settingsLanguage.value=languageSelect.value;localStorage.setItem('capsnip.language',languageSelect.value)});
  document.getElementById('refreshEngineButton')?.addEventListener('click',async()=>{const status=document.getElementById('engineSetupStatus');if(status)status.textContent='Checking local Whisper setup…';const result=await refreshEngine();if(status)status.textContent=result.ready?`Ready · ${result.deviceName||result.device} · ${result.device==='cuda'?result.gpuModel:result.cpuModel}`:(result.message||'Speech engine is not installed')});
  document.getElementById('openModelFolder')?.addEventListener('click',()=>api.openDataFolder?.('app-data'));document.getElementById('openModelFolderStorage')?.addEventListener('click',()=>api.openDataFolder?.('app-data'));document.getElementById('openPreviewCache')?.addEventListener('click',()=>api.openDataFolder?.('preview-cache'));
  const themeSelect=document.getElementById('settingsTheme');if(themeSelect){themeSelect.value=localStorage.getItem('capsnip.theme')||'dark';const applyTheme=()=>{const light=themeSelect.value==='light'||themeSelect.value==='system'&&window.matchMedia('(prefers-color-scheme: light)').matches;document.body.classList.toggle('system-light',light);document.body.dataset.theme=themeSelect.value};applyTheme();themeSelect.addEventListener('change',()=>{localStorage.setItem('capsnip.theme',themeSelect.value);applyTheme()});window.matchMedia('(prefers-color-scheme: light)').addEventListener('change',applyTheme)}
  const motionToggle=document.getElementById('settingsPreviewMotion');function setPreviewMotion(value){localStorage.setItem('capsnip.previewMotion',String(value));document.body.classList.toggle('preview-motion-off',!value);if(motionToggle){motionToggle.classList.toggle('on',value);motionToggle.setAttribute('aria-checked',String(value))}}setPreviewMotion(localStorage.getItem('capsnip.previewMotion')!=='false');motionToggle?.addEventListener('click',()=>setPreviewMotion(!motionToggle.classList.contains('on')));
  const previewQuality=document.getElementById('settingsPreviewQuality');if(previewQuality){previewQuality.value=localStorage.getItem('capsnip.previewQuality')||'high';previewQuality.addEventListener('change',()=>{localStorage.setItem('capsnip.previewQuality',previewQuality.value);updateCaptionPreview();window.refreshCapsnipTemplatePreviews?.()})}
  document.querySelectorAll('a.contact-link').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();api.openExternal?.(link.href)}));  void refreshEngine();
})();
