import fs from "node:fs";
const R = await import("./rank.ts");
const words=[]; for (const l of fs.readFileSync("/home/claude/data/words.tsv","utf8").split("\n")) { const t=l.indexOf("\t"); if(t<0) continue; words.push([l.slice(0,t),+l.slice(t+1)]); if(words.length>=150000) break; }
const idx=R.buildIndex(words); const inl=new Set(words.map(w=>w[0]));
const rows=fs.readFileSync("/home/claude/data/dakshina-valid.tsv","utf8").trim().split("\n").slice(1).map(l=>l.split("\t")).filter(([m,e])=>/^[a-z]+$/.test(e));
// group: words with several native targets for one romanization count as ambiguous
const byEn={}; for(const [m,e] of rows)(byEn[e]??=new Set()).add(m);
let amb=0, notin=0, other=[];
for (const [ml,en] of rows){ const c=R.suggest(idx,en,6); if(c[0]===ml) continue; if(byEn[en].has(c[0])) {amb++;continue;} if(!inl.has(ml)){notin++;continue;} other.push(`${en}: want ${ml} got ${c.slice(0,3).join(" ")}`); }
console.log({amb,notin,other:other.length}); console.log(other.filter((_,i)=>i%9==0).slice(0,40).join("\n"));
