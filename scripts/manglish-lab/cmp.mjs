import fs from "node:fs";
const R = await import("./rank.ts");
const words=[]; for (const l of fs.readFileSync("/home/claude/data/words.tsv","utf8").split("\n")) { const t=l.indexOf("\t"); if(t<0) continue; words.push([l.slice(0,t),+l.slice(t+1)]); if(words.length>=150000) break; }
const idx=R.buildIndex(words);
const s=fs.readFileSync("sample.tsv","utf8").split("\n").map(l=>l.split("\t"));
const g=fs.readFileSync("google.txt","utf8").trim().split(/\s+/).map(w=>w.replace(/‌|‍/g,""));
console.log("google words", g.length);
let G=0,O=0,O6=0,agree=0; const diff=[];
s.forEach(([ml,en],i)=>{ const o=R.suggest(idx,en,6); if(g[i]===ml)G++; if(o[0]===ml)O++; if(o.includes(ml))O6++; if(o[0]===g[i])agree++; else if (g[i]===ml) diff.push(`${en}: google ${g[i]} ours ${o.slice(0,3).join(" ")}`); });
console.log({sample:s.length, googleFirst:G, oursFirst:O, oursTop6:O6, sameAsGoogle:agree});
console.log(diff.slice(0,40).join("\n"));
