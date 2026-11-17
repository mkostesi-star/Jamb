// Builds the site's own pages: the rules in each language, the privacy page and the terms page (English and Croatian).
// The rules take their wording from the game itself (i18n.js, engine.js), so the pages always say what the game does.
//   node tools/pages.js        (writes rules/, privacy/, terms/)
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const E=require(path.join(ROOT,'engine.js'));
const I=require(path.join(ROOT,'i18n.js')).JambI18n;
const SITE='https://yambcafe.com';
const LANGS=['en','hr','sr','bs','sl','de'];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const CSS=`@font-face{font-family:'Fraunces';font-style:normal;font-weight:400 900;font-display:swap;src:url(/fonts/fraunces-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Fraunces';font-style:normal;font-weight:400 900;font-display:swap;src:url(/fonts/fraunces-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'Instrument Sans';font-style:normal;font-weight:400 700;font-display:swap;src:url(/fonts/instrument-sans-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Instrument Sans';font-style:normal;font-weight:400 700;font-display:swap;src:url(/fonts/instrument-sans-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
:root{--plaster:#F4EFE6;--paper:#FFFCF6;--espresso:#2A1A12;--muted:#6E5D4E;--terra:#C25A3C;--terra-ink:#A84A2F;--terra-lo:#8E3A26;--line:rgba(42,26,18,.13)}
*{box-sizing:border-box}
html{background:var(--plaster)}
body{margin:0;min-height:100vh;background:var(--plaster);color:var(--espresso);font:400 17px/1.6 'Instrument Sans',system-ui,sans-serif;padding:24px 16px 48px}
.card{max-width:720px;margin:0 auto;background:var(--paper);border:1px solid rgba(42,26,18,.10);border-radius:18px;padding:32px clamp(18px,5vw,48px) 36px;box-shadow:0 22px 40px -22px rgba(70,50,30,.45),0 2px 6px rgba(70,50,30,.10)}
.top{display:flex;align-items:center;gap:14px;margin-bottom:6px}
.top img{width:56px;height:56px;border-radius:12px;flex:none}
h1{font:700 clamp(28px,6vw,38px)/1.1 Fraunces,Georgia,serif;letter-spacing:-.01em;margin:0;color:var(--espresso)}
.date{color:var(--muted);margin:6px 0 22px;font-size:15px}
h2{font:700 22px/1.25 Fraunces,Georgia,serif;letter-spacing:-.005em;margin:30px 0 8px;color:var(--espresso);padding-bottom:6px;border-bottom:1px solid var(--line)}
p,li{max-width:62ch}
ul{padding-left:22px;margin:8px 0}
li{margin:4px 0}
a{color:var(--terra-ink);text-underline-offset:2px}
.short{background:#F6F0E6;border-left:4px solid var(--terra);padding:12px 16px;border-radius:4px;margin:18px 0}
.short ul{margin:4px 0}
.lead{font-size:18.5px}
dl{margin:8px 0;display:grid;grid-template-columns:2.2em 1fr;gap:6px 10px}
dt{font:700 20px/1.3 Fraunces,Georgia,serif;color:var(--espresso);text-align:center;background:#F3ECE0;border-radius:4px;align-self:start;padding:1px 0}
dd{margin:0}
table{border-collapse:collapse;width:100%;margin:8px 0}
th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--line)}
th{font-weight:600;white-space:nowrap;color:var(--espresso);width:34%}
.fine{color:var(--muted);font-size:15px}
.go{display:inline-block;margin:26px 0 4px;padding:14px 26px;border-radius:12px;background:var(--terra);color:#FFF8F0;text-decoration:none;font-weight:600;font-size:18px;box-shadow:0 3px 0 var(--terra-lo)}
.go:hover{filter:brightness(1.05)}
.langs{margin-top:30px;padding-top:14px;border-top:1px solid var(--line);font-size:15px;color:var(--muted)}
.langs a,.langs b{margin-right:10px;white-space:nowrap}
.foot{margin-top:10px;font-size:15px;color:var(--muted)}
.foot a{color:inherit;margin-right:12px}
.back{display:inline-block;margin-top:30px;padding:12px 22px;border-radius:12px;background:var(--espresso);color:var(--paper);text-decoration:none;font-weight:600}
.back:hover{filter:brightness(1.25)}`;

function page({lang,file,title,desc,h1,date,body,alts}){
  const depth=file.split('/').length-1,up='../'.repeat(depth);
  const url=SITE+'/'+file.replace(/index\.html$/,'');
  const alt=(alts||[]).map(a=>`<link rel="alternate" hreflang="${a.lang}" href="${SITE}/${a.file.replace(/index\.html$/,'')}">`).join('\n');
  return `<!DOCTYPE html>
<html lang="${I.locale(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${alt}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/icons/v10/icon-512.png">
<link rel="icon" href="${up}favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="${up}icons/v10/favicon-32.png">
<style>
${CSS}
</style>
</head>
<body>
<main class="card">
<div class="top"><img src="${up}icons/v10/icon-192.png" alt=""><h1>${esc(h1)}</h1></div>
${date?`<p class="date">${esc(date)}</p>`:''}
${body}
</main>
<script>
/* visitor numbers, the same way as in the game: no cookies, nothing kept on this device (see the privacy page) */
(function(){try{if(!/(^|\\.)yambcafe\\.com$/.test(location.hostname))return;var r='direct';try{var u=document.referrer&&new URL(document.referrer);if(u&&u.hostname&&u.hostname!==location.hostname)r=u.hostname.replace(/^www\\./,'').slice(0,60);}catch(e){}
fetch('https://ovyoybgtoaahkrcylrkw.supabase.co/rest/v1/rpc/count_visit',{method:'POST',keepalive:true,headers:{apikey:'sb_publishable_KGd1nYui7gP1uP4-RQPcyw_49D9no_F','Content-Type':'application/json'},
body:JSON.stringify({p_page:${JSON.stringify(file.replace(/\/?index\.html$/,'')||'home')},p_src:r,p_lang:${JSON.stringify(lang)},p_app:false,p_dev:(navigator.maxTouchPoints||0)>0?(Math.min(screen.width,screen.height)<600?'phone':'tablet'):'desktop',p_hour:new Date().getHours()})}).catch(function(){});}catch(e){}})();
</script>
</body>
</html>
`;
}

// ------------------------------------------------------------------ rules: the words the game does not have yet
const R={
  en:{file:'rules/index.html',title:'How to play Yamb · Yamb Café',h1:'How to play Yamb',
    desc:'The rules of Yamb (Jamb), the dice game with five dice and a score sheet of columns: a turn, the columns, the scoring, and where to play it free.',
    lead:'Yamb, called Jamb in Croatia, Serbia, Bosnia and Herzegovina and Slovenia, is a dice game for one to six players. It is close to Yahtzee, with one twist that makes it deeper: the score sheet has several columns, and each column is filled in its own order.',
    turn:'A turn',cols:'The columns',colsIntro:'Yamb Café starts with four columns. Each one holds the same boxes, from the ones down to Yamb.',
    more:'More columns for house rules',moreIntro:'These can be added under “{rules}”:',modes:'Ways to play in Yamb Café',
    go:'Play Yamb Café, free',goNote:'In the browser on any device. No sign-in needed.',langs:'This page in:',terms:'Terms'},
  hr:{file:'rules/hr/index.html',title:'Pravila igre Jamb · Yamb Café',h1:'Kako se igra Jamb',
    desc:'Pravila Jamba, igre s pet kocaka i listićem sa stupcima: potez, stupci, bodovanje i gdje ga besplatno igrati.',
    lead:'Jamb je igra s kockama za jednog do šest igrača. Sličan je Yahtzeeju, ali s jednom razlikom koja ga čini dubljim: listić ima nekoliko stupaca, a svaki se popunjava svojim redom.',
    turn:'Potez',cols:'Stupci',colsIntro:'Yamb Café počinje s četiri stupca. U svakom su ista polja, od jedinica do Jamba.',
    more:'Dodatni stupci za kućna pravila',moreIntro:'Ovi se stupci mogu dodati pod „{rules}“:',modes:'Načini igre u Yamb Caféu',
    go:'Igraj Yamb Café besplatno',goNote:'U pregledniku na bilo kojem uređaju, bez prijave.',langs:'Ova stranica na:',terms:'Uvjeti'},
  sr:{file:'rules/sr/index.html',title:'Pravila igre Jamb · Yamb Café',h1:'Kako se igra Jamb',
    desc:'Pravila Jamba, igre sa pet kockica i listićem sa kolonama: potez, kolone, bodovanje i gde da ga besplatno igrate.',
    lead:'Jamb je igra kockicama za jednog do šest igrača. Sličan je Yahtzeeju, ali sa jednom razlikom koja ga čini dubljim: listić ima nekoliko kolona, a svaka se popunjava svojim redom.',
    turn:'Potez',cols:'Kolone',colsIntro:'Yamb Café počinje sa četiri kolone. U svakoj su ista polja, od jedinica do Jamba.',
    more:'Dodatne kolone za kućna pravila',moreIntro:'Ove kolone mogu da se dodaju pod „{rules}“:',modes:'Načini igre u Yamb Caféu',
    go:'Igraj Yamb Café besplatno',goNote:'U pregledaču na bilo kom uređaju, bez prijave.',langs:'Ova stranica na:',terms:'Uslovi'},
  bs:{file:'rules/bs/index.html',title:'Pravila igre Jamb · Yamb Café',h1:'Kako se igra Jamb',
    desc:'Pravila Jamba, igre sa pet kockica i listićem s kolonama: potez, kolone, bodovanje i gdje ga besplatno igrati.',
    lead:'Jamb je igra kockicama za jednog do šest igrača. Sličan je Yahtzeeju, ali s jednom razlikom koja ga čini dubljim: listić ima nekoliko kolona, a svaka se popunjava svojim redom.',
    turn:'Potez',cols:'Kolone',colsIntro:'Yamb Café počinje s četiri kolone. U svakoj su ista polja, od jedinica do Jamba.',
    more:'Dodatne kolone za kućna pravila',moreIntro:'Ove kolone se mogu dodati pod „{rules}“:',modes:'Načini igre u Yamb Caféu',
    go:'Igraj Yamb Café besplatno',goNote:'U pregledniku na bilo kojem uređaju, bez prijave.',langs:'Ova stranica na:',terms:'Uslovi'},
  sl:{file:'rules/sl/index.html',title:'Pravila igre Jamb · Yamb Café',h1:'Kako se igra Jamb',
    desc:'Pravila Jamba, igre s petimi kockami in listom s stolpci: poteza, stolpci, točkovanje in kje ga igrati brezplačno.',
    lead:'Jamb je igra s kockami za enega do šest igralcev. Podoben je Yahtzeeju, a z eno razliko, ki ga naredi globljega: list ima več stolpcev in vsak se izpolnjuje po svojem vrstnem redu.',
    turn:'Poteza',cols:'Stolpci',colsIntro:'Yamb Café se začne s štirimi stolpci. V vsakem so ista polja, od enic do Jamba.',
    more:'Dodatni stolpci za hišna pravila',moreIntro:'Te stolpce lahko dodate pod „{rules}“:',modes:'Načini igre v Yamb Caféju',
    go:'Igraj Yamb Café brezplačno',goNote:'V brskalniku na kateri koli napravi, brez prijave.',langs:'Ta stran v jeziku:',terms:'Pogoji'},
  de:{file:'rules/de/index.html',title:'Yamb Spielregeln · Yamb Café',h1:'So spielt man Yamb',
    desc:'Die Regeln von Yamb (Jamb), dem Würfelspiel mit fünf Würfeln und einem Block mit Spalten: ein Zug, die Spalten, die Wertung und wo man es kostenlos spielt.',
    lead:'Yamb, in Kroatien, Serbien, Bosnien und Herzegowina und Slowenien Jamb genannt, ist ein Würfelspiel für einen bis sechs Spieler. Es ähnelt Kniffel, mit einem Unterschied, der es tiefer macht: Der Block hat mehrere Spalten, und jede wird in ihrer eigenen Reihenfolge gefüllt.',
    turn:'Ein Zug',cols:'Die Spalten',colsIntro:'Yamb Café beginnt mit vier Spalten. In jeder stehen dieselben Felder, von den Einsern bis zum Yamb.',
    more:'Weitere Spalten für Hausregeln',moreIntro:'Diese Spalten lassen sich unter „{rules}“ hinzufügen:',modes:'So spielt man in Yamb Café',
    go:'Yamb Café kostenlos spielen',goNote:'Im Browser auf jedem Gerät, ohne Anmeldung.',langs:'Diese Seite auf:',terms:'Bedingungen'}
};
const privFile=l=>l==='hr'?'privacy/hr/index.html':'privacy/index.html';
const termsFile=l=>l==='hr'?'terms/hr/index.html':'terms/index.html';
const rel=(from,to)=>{const d=from.split('/').length-1;return '../'.repeat(d)+to.replace(/index\.html$/,'');};

function rulesPage(l){
  const W=R[l],t=(k,v)=>I.t(l,k,v),r=E.normRules({});
  const colName=c=>t('col.'+c),rowName=x=>t('row.'+x);
  const cols=r.cols.map(c=>`<dt>${E.COLS[c].sym}</dt><dd><b>${esc(colName(c))}.</b> ${esc(t('colD.'+c))}</dd>`).join('\n');
  const extra=E.COL_ORDER.filter(c=>!r.cols.includes(c)).map(c=>`<dt>${E.COLS[c].sym}</dt><dd><b>${esc(colName(c))}.</b> ${esc(t('colD.'+c))}</dd>`).join('\n');
  const kenta=r.kenta==='roll'?t('kentaRoll',{a:r.k1,b:r.k2,c:r.k3}):t('kentaFlat',{a:r.ks,b:r.kb});
  const rows=[['1 – 6',t('sc.upper')],[t('bonusTitle'),t('sc.bonus',{a:r.bonusAt,b:r.bonus})],['Max, Min',t('sc.maxmin',{n:''})],[t('midOnes'),t('sc.midOnes')],
    [rowName('kenta'),kenta],[rowName('triling'),t('sc.tri',{b:r.tri})],[rowName('ful'),t('sc.ful',{b:r.ful})],[rowName('poker'),t('sc.poker',{b:r.poker})],[rowName('jamb'),t('sc.jamb',{b:r.jamb})]];
  const modes=[[t('playChar'),t('cpuD')],[t('daily'),t('dailySame')+'. '+t('dailyHow')+'.'],[t('modePP'),t('modePPD')],[t('modeOnline'),t('modeOnlineD')],[t('modeDuel'),t('modeDuelD')],[t('modeTable'),t('modeTableD')]];
  const cap=s=>{s=s.charAt(0).toUpperCase()+s.slice(1);return /[.!?]$/.test(s)?s:s+'.';};
  const langs=LANGS.map(x=>x===l?`<b>${esc(I.name(x))}</b>`:`<a href="${rel(W.file,R[x].file)}" hreflang="${x}">${esc(I.name(x))}</a>`).join(' ');
  const body=`<p class="lead">${esc(W.lead)}</p>
<h2>${esc(W.turn)}</h2>
<p>${esc(t('howIntro',{n:5}))}</p>
<h2>${esc(W.cols)}</h2>
<p>${esc(W.colsIntro)}</p>
<dl>
${cols}
</dl>
<h2>${esc(t('scoring'))}</h2>
<table>
${rows.map(([a,b])=>`<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('\n')}
</table>
<p class="fine">${esc(t('howNote'))}</p>
<h2>${esc(W.more)}</h2>
<p>${esc(W.moreIntro.replace('{rules}',t('modeRules')))}</p>
<dl>
${extra}
</dl>
<h2>${esc(W.modes)}</h2>
<ul>
${modes.map(([a,b])=>`<li><b>${esc(a)}.</b> ${esc(cap(b))}</li>`).join('\n')}
</ul>
<a class="go" href="${rel(W.file,'index.html')}?ref=rules-${l}">${esc(W.go)}</a>
<p class="fine">${esc(W.goNote)}</p>
<p class="langs">${esc(W.langs)} ${langs}</p>
<p class="foot"><a href="${rel(W.file,privFile(l))}">${esc(t('privacy'))}</a><a href="${rel(W.file,termsFile(l))}">${esc(W.terms)}</a></p>`;
  return page({lang:l,file:W.file,title:W.title,desc:W.desc,h1:W.h1,body,alts:LANGS.map(x=>({lang:x,file:R[x].file})).concat([{lang:'x-default',file:R.en.file}])});
}

// ------------------------------------------------------------------ privacy and terms (English and Croatian)
const DOCS=require('./pages-text.js');
function docPage(kind,l){
  const d=DOCS[kind][l],file=kind==='privacy'?privFile(l):termsFile(l);
  const other=l==='hr'?'en':'hr',otherFile=kind==='privacy'?privFile(other):termsFile(other);
  const body=d.body.replace(/\{\{(\w+)\}\}/g,(m,k)=>({
    privacy:rel(file,privFile(l)),terms:rel(file,termsFile(l)),rules:rel(file,R[l==='hr'?'hr':'en'].file),game:rel(file,'index.html')}[k]||m))+
    `\n<p class="langs"><a href="${rel(file,otherFile)}" hreflang="${other}">${other==='hr'?'Hrvatski':'English'}</a></p>\n<a class="back" href="${rel(file,'index.html')}">${esc(d.back)}</a>`;
  return page({lang:l,file,title:d.title,desc:d.desc,h1:d.h1,date:d.date,body,
    alts:[{lang:'en',file:kind==='privacy'?privFile('en'):termsFile('en')},{lang:'hr',file:kind==='privacy'?privFile('hr'):termsFile('hr')}]});
}

const out=[];
const write=(file,html)=>{const f=path.join(ROOT,file);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,html);out.push(file);};
for(const l of LANGS)write(R[l].file,rulesPage(l));
for(const kind of ['privacy','terms'])for(const l of ['en','hr'])write(kind==='privacy'?privFile(l):termsFile(l),docPage(kind,l));
console.log(out.join('\n'));
