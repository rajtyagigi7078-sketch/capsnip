(() => {
  const presets = [
    ['pop','Pop','#FFFFFF','#FFE500',64,900,5,'pop',true,.62],
    ['karaoke','Karaoke','#D9D9D9','#00E5FF',62,800,5,'karaoke',true,.62],
    ['bold-center','Bold Center','#FFFFFF','#FFFFFF',76,900,1,'fade',true,.62],
    ['punch','Punch','#FFFFFF','#FF2A2A',66,900,5,'punch',true,.62],
    ['minimal','Minimal','#F5F5F5','#FFFFFF',48,700,1,'single-fade',false,.60],
    ['highlight-box','Highlight Box','#FFFFFF','#FFFFFF',60,800,5,'side-reveal',true,.62],
    ['typewriter','Typewriter','#FFFFFF','#22C55E',58,800,5,'typewriter',true,.62],
    ['bounce','Bounce','#FFFFFF','#FF2D9A',68,900,4,'single-fade',true,.62],
    ['kinetic','Kinetic','#FFFFFF','#00E5FF',64,900,5,'kinetic',true,.62],
    ['podcast','Podcast','#FFFFFF','#FFD928',52,700,6,'podcast',true,.62],
    ['yellow-stack','Yellow Stack','#FFD928','#FFD928',72,900,3,'dual-line',true,.62],
    ['violet-pill','Violet Pill','#FFFFFF','#FFFFFF',64,800,4,'blur-in',true,.62],
    ['dual-line','Dual Line','#FFD928','#FFD928',64,900,3,'dual-line',true,.62],
    ['bold-karaoke','Bold Karaoke','#FFFFFF','#FFD928',64,900,4,'fade',true,.62],
    ['soft-lyric','Soft Lyric','#F4F1EA','#FFFFFF',48,700,5,'single-fade',true,.60],
  ];
  const fontFiles={pop:'Poppins.ttf',karaoke:'LeagueSpartan.ttf','bold-center':'Anton.ttf',punch:'AlfaSlabOne.ttf',minimal:'Nunito.ttf','highlight-box':'Kanit.ttf',typewriter:'Teko.ttf',bounce:'Rubik.ttf',kinetic:'Oswald.ttf',podcast:'BebasNeue.ttf','yellow-stack':'Anton.ttf','violet-pill':'Poppins.ttf','dual-line':'Anton.ttf','bold-karaoke':'Anton.ttf','soft-lyric':'Nunito.ttf'};
  const fontFamilies={pop:'Poppins',karaoke:'League Spartan','bold-center':'Anton',punch:'Alfa Slab One',minimal:'Nunito','highlight-box':'Kanit',typewriter:'Teko',bounce:'Rubik',kinetic:'Oswald',podcast:'Bebas Neue','yellow-stack':'Anton','violet-pill':'Poppins','dual-line':'Anton','bold-karaoke':'Anton','soft-lyric':'Nunito'};
  const paletteFamilies={pop:'Neon',karaoke:'Neon','bold-center':'Basic',punch:'Vibrant',minimal:'Basic','highlight-box':'Jewel',typewriter:'Neon',bounce:'Vibrant',kinetic:'Neon',podcast:'Vibrant','yellow-stack':'Vibrant','violet-pill':'Jewel','dual-line':'Vibrant','bold-karaoke':'Basic','soft-lyric':'Pastel'};
  const templates = presets.map(([key,label,primaryColor,accentColor,size,weight,wordsPerLine,animation,shadow,verticalPosition]) => ({
    id:`snip-ai-${key}`,name:`Snip AI · ${label}`,category:'snip-ai',engineTemplate:key,
    accent:accentColor,baseColor:primaryColor,layout:wordsPerLine===1?'line':'stack',
    font:`'Snip AI ${fontFamilies[key]}', sans-serif`,
    size,weight,motion:animation,italic:false,ffmpegFontFile:fontFiles[key],secondaryFont:key==='dual-line'?'Snip AI Nunito, sans-serif':undefined,ffmpegSecondaryFontFile:key==='dual-line'?'Nunito.ttf':undefined,
    primaryColor,accentColor,wordsPerLine,shadow,verticalPosition,
    boxColor:key==='highlight-box'?'#0F766E':key==='violet-pill'?'#8B5CF6':key==='podcast'?'#161616':undefined,
    secondaryColor:key==='dual-line'?'#FFFFFF':undefined,secondaryFontSize:key==='yellow-stack'?68:key==='dual-line'?48:undefined,
    dualSecondaryColor:key==='yellow-stack'?'#FFD928':undefined,
    dualPrimaryUppercase:key==='dual-line',uppercase:key==='bold-karaoke',
    previewText:key==='podcast'?'PODCAST MOMENT':key==='typewriter'?'WATCH THIS NOW':'KYA BAAT HAI',colorFamily:paletteFamilies[key]||'Basic',
    source:'Snip AI FFmpeg caption renderer',
  }));
  if(typeof window!=='undefined')window.capsnipSnipAiTemplates=templates;
  if(typeof module!=='undefined'&&module.exports)module.exports=templates;
})();
