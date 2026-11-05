(() => {
  const templates = [
    { id:'mix-spectrum-pop', name:'Mix Lab · Spectrum Pop', engineTemplate:'pop', animationLabel:'Word Pop', sources:['Mint Pop','Snip AI · Pop','Video Fill · Impact','Green Pop Word','Snip AI · Highlight Box','Red Pop Phrase','Video Fill · Cooper Black','Big Yellow Keyword','Snip AI · Bounce','Playful Display Pop'] },
    { id:'mix-neon-karaoke', name:'Mix Lab · Neon Karaoke', engineTemplate:'karaoke', animationLabel:'Karaoke Sweep', sources:['Clean Midline','Snip AI · Karaoke','Video Fill · Agency Block','Red Emphasis Line','Snip AI · Typewriter','Yellow Subtitle','Video Fill · Bahnschrift','Green Pop Word','Snip AI · Bold Karaoke','Red Statement'] },
    { id:'mix-kinetic-stack', name:'Mix Lab · Kinetic Stack', engineTemplate:'kinetic', animationLabel:'Kinetic Stack', sources:['Kinetic Word Stack','Snip AI · Kinetic','Video Fill · Tw Cen Condensed','White Stack Highlight','Snip AI · Yellow Stack','Duotone Quote Stack','Video Fill · Rockwell Extra Bold','Stacked Editorial','Snip AI · Dual Line','Yellow-Red Editorial'] },
    { id:'mix-impact-punch', name:'Mix Lab · Impact Punch', engineTemplate:'punch', animationLabel:'Punch In', sources:['Big Yellow Keyword','Snip AI · Punch','Video Fill · Franklin Heavy','Orange Condensed','Snip AI · Bold Center','Red Emphasis Line','Video Fill · Gill Ultra','Spotlight Caps','Snip AI · Bold Karaoke','Red Pop Phrase'] },
    { id:'mix-soft-drift', name:'Mix Lab · Soft Drift', engineTemplate:'soft-lyric', animationLabel:'Soft Fade', sources:['Handwritten Whisper','Snip AI · Soft Lyric','Video Fill · Cooper Black','Yellow Script','Snip AI · Minimal','Scenic Display Title','Video Fill · Eras Bold','Travel Micro Caption','Snip AI · Violet Pill','Soft Italic Caps'] },
    { id:'mix-editorial-rise', name:'Mix Lab · Editorial Rise', engineTemplate:'bold-center', animationLabel:'Editorial Rise', sources:['Serif Hook','Snip AI · Bold Center','Video Fill · Rockwell Extra Bold','Editorial Split Quote','Snip AI · Podcast','Grunge Serif Lead','Video Fill · Britannic Bold','Red Editorial Quote Card','Snip AI · Dual Line','Cinematic Side Stack'] },
  ];
  const mixed=templates.map(template=>({...template,category:'mixed',fontSize:72,weight:900,primaryColor:'#FFFFFF',accentColor:'#FFE24D',verticalPosition:.62,ffmpegFontFile:'Anton.ttf'}));
  if(typeof window!=='undefined')window.capsnipMixedTemplates=mixed;
  if(typeof module!=='undefined'&&module.exports)module.exports=mixed;
})();
