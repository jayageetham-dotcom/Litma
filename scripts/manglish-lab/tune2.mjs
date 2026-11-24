import fs from "node:fs";
const R = await import("./rank.ts");
const norm = (w) => w.replace(/ൌ/g, "ൗ").replace(/[‌‍]/g, "");
const words=[]; for (const l of fs.readFileSync("/home/claude/data/words.tsv","utf8").split("\n")) { const t=l.indexOf("\t"); if(t<0) continue; words.push([l.slice(0,t),+l.slice(t+1)]); if(words.length>=150000) break; }
const idx=R.buildIndex(words);
const dv=fs.readFileSync("/home/claude/data/dakshina-valid.tsv","utf8").trim().split("\n").slice(1).map(l=>l.split("\t")).filter(([m,e])=>/^[a-z]+$/.test(e)).map(([m,e])=>[norm(m),e]);
const s=fs.readFileSync("sample.tsv","utf8").split("\n").map(l=>l.split("\t"));
const g=fs.readFileSync("google.txt","utf8").trim().split(/\s+/).map(norm);
function run(){ let t1=0,t6=0; for(const [m,e] of dv){const c=R.suggest(idx,e,6); if(c[0]===m)t1++; if(c.includes(m))t6++;}
 let gs=0,ok=0; s.forEach(([m,e],i)=>{const c=R.suggest(idx,e,6); if(c[0]===g[i])gs++; if(c[0]===norm(m))ok++;});
 return {t1:+(100*t1/dv.length).toFixed(1),t6:+(100*t6/dv.length).toFixed(1),sameGoogle:gs,sampleRight:ok}; }
console.log("current", JSON.stringify(R.W), run());
let best=null;
for (const lit of [0.3,0.6]) for (const freq of [0.2,0.3]) for (const len of [0,0.3,0.6]) for (const dbl of [0,0.3,0.6]) for (const chillu of [0,0.5]) {
  Object.assign(R.W,{lit,freq,len,dbl,chillu}); const r=run(); const sc=r.t1+r.t6/2+r.sameGoogle/6;
  if(!best||sc>best.sc){best={sc,...R.W,...r};console.log(JSON.stringify(best));}
}
