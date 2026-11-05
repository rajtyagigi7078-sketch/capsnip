export type CatalogTemplate = {
  id: string;
  name: string;
  category: 'subtitle' | 'display' | 'composition';
  width: number;
  height: number;
  accent: string;
  phrase: string;
  layout: 'focus' | 'line' | 'stack';
  font: string;
  size: number;
  motion: 'pop' | 'rise' | 'fade' | 'slide' | 'stagger';
  anchor: 'upper' | 'center' | 'lower' | 'left' | 'right';
  italic?: boolean;
  prototype?: 'mint' | 'stacked' | 'duotone';
};

// These 32 catalog entries complement the three hand-built prototypes.
// Layouts and animation values remain adjustable pending full-frame visual matching.
const raw: Array<[string,string,CatalogTemplate['category'],number,number,string,string,CatalogTemplate['layout'],string,number,CatalogTemplate['motion'],CatalogTemplate['anchor'],boolean?]> = [
  ['spotlight-caps','Spotlight Caps','subtitle',1080,1080,'#55f0cf','YAAR PUBLISH','focus','Impact, Arial Narrow, sans-serif',112,'pop','lower'],
  ['clean-midline','Clean Midline','subtitle',1280,720,'#39ddd0','FEATURE KAAFI','line','Arial, sans-serif',58,'fade','center'],
  ['red-italic','Red Italic','subtitle',1080,1920,'#ff374c','YEH BILKUL SAHI','line','Arial, sans-serif',72,'rise','lower',true],
  ['orange-condensed','Orange Condensed','subtitle',1080,1920,'#ff9c24','KYA BAAT HAI','focus','Impact, Arial Narrow, sans-serif',118,'pop','lower'],
  ['clean-white-focus','Clean White Focus','subtitle',1280,720,'#55e6dd','CAPTION AB READY','line','Arial, sans-serif',66,'fade','center'],
  ['serif-hook','Serif Hook','display',1080,1200,'#f8e9d7','A NEW STORY','line','Georgia, serif',76,'rise','center',true],
  ['kinetic-word-stack','Kinetic Word Stack','subtitle',1280,590,'#ffca3a','SAY IT LOUD','stack','Impact, Arial Narrow, sans-serif',82,'stagger','center'],
  ['red-statement','Red Statement','subtitle',1080,1920,'#ff354d','THIS IS THE MOMENT','line','Arial, sans-serif',76,'pop','lower'],
  ['handwritten-whisper','Handwritten Whisper','subtitle',1280,866,'#fffdf6','just one thing','line','cursive',62,'fade','lower',true],
  ['yellow-script','Yellow Script','subtitle',1280,866,'#ffe24d','make it count','line','cursive',74,'rise','lower',true],
  ['big-yellow-keyword','Big Yellow Keyword','subtitle',1280,720,'#ffd93d','REVIEW KARKE','focus','Impact, Arial Narrow, sans-serif',126,'pop','lower'],
  ['red-pop-phrase','Red Pop Phrase','subtitle',1080,1920,'#ff4b8b','BILKUL READY','stack','Arial Black, Arial, sans-serif',84,'pop','center'],
  ['handwritten-white-caps','Handwritten White Caps','subtitle',1064,720,'#ffffff','KEEP MOVING','line','cursive',78,'slide','center',true],
  ['soft-italic-caps','Soft Italic Caps','subtitle',1280,866,'#fffdf9','STAY WITH ME','line','Arial, sans-serif',70,'fade','lower',true],
  ['white-stack-highlight','White Stack Highlight','subtitle',1280,960,'#43dfd0','CAPTION BILKUL READY','stack','Arial Black, Arial, sans-serif',82,'stagger','center'],
  ['minimal-vertical-white','Minimal Vertical White','subtitle',720,1280,'#ffffff','JUST LISTEN','line','Arial Narrow, sans-serif',56,'fade','center'],
  ['rounded-portrait-subtitle','Rounded Portrait Subtitle','subtitle',1080,1920,'#ffffff','HELLO THERE','line','Arial Rounded MT Bold, Arial, sans-serif',70,'rise','lower'],
  ['grunge-serif-lead','Grunge Serif Lead','display',1280,960,'#f4eee6','THE LONG ROAD','line','Georgia, serif',92,'rise','center'],
  ['green-pop-word','Green Pop Word','subtitle',1080,1920,'#43ef87','KYA MAST HAI','focus','Impact, Arial Narrow, sans-serif',126,'pop','lower'],
  ['travel-micro-caption','Travel Micro Caption','subtitle',1080,1920,'#ffffff','ON THE WAY','line','Arial, sans-serif',44,'fade','lower'],
  ['devanagari-poster-headline','Devanagari Poster Headline','composition',1080,1920,'#9b2443','ये बात समझो','stack','Arial Black, Noto Sans Devanagari, sans-serif',82,'stagger','left'],
  ['scenic-display-title','Scenic Display Title','composition',1080,1920,'#fff5df','FIND YOUR WAY','line','Georgia, serif',88,'fade','center',true],
  ['editorial-split-quote','Editorial Split Quote','composition',1080,1080,'#e6ca82','A BETTER WAY','stack','Georgia, serif',88,'rise','left'],
  ['yellow-subtitle','Yellow Subtitle','subtitle',1080,1080,'#ffdc32','AB BILKUL READY','line','Arial, sans-serif',66,'pop','lower'],
  ['white-interview-caption','White Interview Caption','subtitle',1080,1080,'#ffffff','LET ME EXPLAIN','line','Arial, sans-serif',54,'fade','lower'],
  ['red-emphasis-line','Red Emphasis Line','subtitle',1080,1920,'#ff3045','THIS REALLY MATTERS','line','Arial Black, Arial, sans-serif',66,'pop','lower'],
  ['red-editorial-quote-card','Red Editorial Quote Card','composition',1080,1920,'#d62a48','A WORD TO REMEMBER','stack','Georgia, serif',84,'rise','left'],
  ['script-impact-word','Script + Impact Word','display',1080,1920,'#ffdf55','make it BIG','line','cursive',82,'pop','center',true],
  ['green-poster-script','Green Poster Script','composition',1080,1920,'#7bf04a','make your story','line','cursive',92,'fade','center',true],
  ['playful-display-pop','Playful Display Pop','display',1280,720,'#44f0ce','YOUR STORY POPS','stack','Arial Rounded MT Bold, Arial, sans-serif',94,'pop','center'],
  ['yellow-red-editorial','Yellow-Red Editorial','composition',1920,1080,'#ffb52e','FEATURE KAafi USEFUL','stack','Impact, Arial Narrow, sans-serif',88,'stagger','center'],
  ['cinematic-side-stack','Cinematic Side Stack','composition',1080,1920,'#f5e6c8','A QUIET MOMENT','stack','Georgia, serif',82,'fade','right',true],
];

const catalog: CatalogTemplate[] = raw.map(([id,name,category,width,height,accent,phrase,layout,font,size,motion,anchor,italic]) => ({id,name,category,width,height,accent,phrase,layout,font,size,motion,anchor,italic}));

export const CATALOG_TEMPLATES: CatalogTemplate[] = [
  catalog[0],
  {id:'stacked-editorial',name:'Stacked Editorial',category:'subtitle',width:1280,height:720,accent:'#f5f3ec',phrase:'JO INTENT KAR RAHA',layout:'stack',font:'Arial Narrow, Impact, sans-serif',size:76,motion:'stagger',anchor:'left',prototype:'stacked'},
  ...catalog.slice(1,14),
  {id:'mint-pop',name:'Mint Pop',category:'subtitle',width:1280,height:960,accent:'#30f2b5',phrase:'ME KYUNKI BADA PEEDA',layout:'focus',font:'Arial Narrow, Impact, sans-serif',size:132,motion:'pop',anchor:'lower',prototype:'mint'},
  ...catalog.slice(14,20),
  {id:'duotone-quote-stack',name:'Duotone Quote Stack',category:'composition',width:1080,height:1920,accent:'#8c1534',phrase:'KYA AB KYA BOLU MAI UNKO',layout:'stack',font:'Arial Black, Arial, sans-serif',size:76,motion:'stagger',anchor:'left',prototype:'duotone'},
  ...catalog.slice(20),
];
