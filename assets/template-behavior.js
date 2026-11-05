// Typography behavior shared by the live preview and video renderer.
(() => {
  const rows = [
    ['Spotlight Caps','Kinetic Typography','Anton, Impact, sans-serif','pop','word','mint','upper',900],
    ['Stacked Editorial','Stacked Typography','Bodoni Moda, Georgia, serif','side-stagger','stack','white-gray','upper',800],
    ['Clean Midline','Highlight Typography','Aldrich, sans-serif','word-swap','word','cyan','sentence',700],
    ['Red Italic','Highlight Typography','Righteous, sans-serif','phrase-cut','word','red','sentence',800,'italic'],
    ['Orange Condensed','Kinetic Typography','Bowlby One SC, Impact, sans-serif','orange-bounce','word','orange','upper',900],
    ['Clean White Focus','Highlight Typography','Oswald, sans-serif','active-scale','word','cyan','sentence',800],
    ['Serif Hook','Editorial Typography','Bodoni Moda, Georgia, serif','serif-rise','phrase','cream','title',700,'italic'],
    ['Kinetic Word Stack','Kinetic Typography','Anton, Impact, sans-serif','stack-pop','word','rainbow','upper',900,'','Monoton'],
    ['Red Statement','Highlight Typography','League Gothic, Impact, sans-serif','red-flash','word','red','upper',900],
    ['Handwritten Whisper','Handwritten Typography','Rock Salt, cursive','soft-fade','phrase','white','sentence',400],
    ['Yellow Script','Handwritten Typography','Moo Lah Lah, cursive','script-fade','phrase','yellow','sentence',400],
    ['Big Yellow Keyword','Kinetic Typography','Boldonse, Impact, sans-serif','keyword-stomp','word','yellow','upper',900],
    ['Red Pop Phrase','Highlight Typography','Plaster, Impact, sans-serif','pink-pop','word','pink','upper',900],
    ['Handwritten White Caps','Handwritten Typography','Barriecito, cursive','marker-wipe','phrase','white','upper',500],
    ['Soft Italic Caps','Handwritten Typography','Over the Rainbow, cursive','soft-italic-dissolve','phrase','white','upper',400,'italic'],
    ['Mint Pop','Kinetic Typography','Vina Sans, sans-serif','mint-spring','word','mint','upper',900],
    ['White Stack Highlight','Stacked Typography','Bowlby One SC, sans-serif','stack-focus','stack','cyan','upper',900],
    ['Minimal Vertical White','Stacked Typography','Silkscreen, monospace','minimal-cut','stack','white','upper',700],
    ['Rounded Portrait Subtitle','Stacked Typography','Mouse Memoirs, sans-serif','rounded-rise','stack','white','sentence',700],
    ['Grunge Serif Lead','Editorial Typography','Special Elite, serif','texture-rise','phrase','cream','upper',400],
    ['Green Pop Word','Kinetic Typography','Viga, sans-serif','green-pulse','word','green','upper',900],
    ['Travel Micro Caption','Handwritten Typography','Aladin, cursive','micro-fade','phrase','white','sentence',400],
    ['Devanagari Poster Headline','Stacked Typography','Nirmala UI, sans-serif','poster-build','stack','burgundy-gold','native',800],
    ['Duotone Quote Stack','Stacked Typography','Boldonse, sans-serif','duotone-stagger','stack','burgundy','lower',900],
    ['Scenic Display Title','Editorial Typography','Limelight, serif','scenic-drift','phrase','cream','title',400],
    ['Editorial Split Quote','Editorial Typography','Bodoni Moda, Georgia, serif','editorial-unfold','line','gold','title',700],
    ['Yellow Subtitle','Highlight Typography','Silkscreen, monospace','yellow-snap','word','yellow','sentence',700],
    ['White Interview Caption','Editorial Typography','Oswald, sans-serif','lower-third-fade','line','white','sentence',500],
    ['Red Emphasis Line','Highlight Typography','Anton, Impact, sans-serif','red-word-punch','word','red','upper',900],
    ['Red Editorial Quote Card','Editorial Typography','Bodoni Moda, Georgia, serif','card-reveal','line','red','title',700],
    ['Script + Impact Word','Handwritten Typography','Aladin, cursive','script-impact-swap','phrase','yellow','sentence',500],
    ['Green Poster Script','Handwritten Typography','Barrio, cursive','slow-script-write','phrase','green','sentence',500],
    ['Playful Display Pop','Kinetic Typography','Bubblegum Sans, sans-serif','playful-stagger','word','rainbow','title',800],
    ['Yellow-Red Editorial','Stacked Typography','Freeman, sans-serif','editorial-color-build','stack','yellow-red','title',800],
    ['Cinematic Side Stack','Editorial Typography','League Gothic, sans-serif','cinematic-reveal','line','cream','title',800],
  ];
  const behavior = Object.fromEntries(rows.map(([name, typographyCategory, font, animation, grouping, palette, casing, weight, fontStyle, middleWordFont]) => [name, {
    name, typographyCategory, font, animation, grouping, palette, casing, weight,
    italic:fontStyle === 'italic', middleWordFont:middleWordFont || null,
    source:'CAPSNIP-REFERENCE-AUDIT.md',
  }]));
  const popStyles = new Set(['Spotlight Caps','Orange Condensed','Kinetic Word Stack','Big Yellow Keyword','Red Pop Phrase','Mint Pop','Green Pop Word','Red Emphasis Line','Playful Display Pop']);
  for (const item of Object.values(behavior)) item.sfx = popStyles.has(item.name) ? 'pop' : 'tick';
  for (const template of (typeof window !== 'undefined' ? window.capsnipMotionTemplates || [] : [])) {
    behavior[template.name] = {
      name:template.name, typographyCategory:'Motion Graphic', grouping:'line', anchor:'center',
      font:template.font, animation:'static-line', sfx:'line-tick', palette:'video', casing:'upper',
      confidence:'medium', category:'motion-graphic', maxLineWords:template.maxLineWords,
      maxSecondLineWords:template.maxSecondLineWords, fillVideo:template.fillVideo,
    };
  }
  if (typeof window !== 'undefined') window.capsnipTemplateBehavior = behavior;
  if (typeof module !== 'undefined' && module.exports) module.exports = behavior;
})();
