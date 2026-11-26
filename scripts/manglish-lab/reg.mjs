import fs from "node:fs";
const R = await import("./rank.ts");
const M = await import("/home/claude/litma/packages/shared/src/manglish.ts");
const words=[]; for (const l of fs.readFileSync("/home/claude/data/words.tsv","utf8").split("\n")) { const t=l.indexOf("\t"); if(t<0) continue; words.push([l.slice(0,t),+l.slice(t+1)]); if(words.length>=150000) break; }
const idx=R.buildIndex(words);
const vec=JSON.parse(fs.readFileSync("/home/claude/litma/apps/mobile/test/manglish_vectors.json","utf8"));
const keys=[...new Set([...Object.keys(vec), ...Object.keys(M.COMMON)])];
let same=0; const diff=[];
for (const k of keys){ const old=M.manglishCandidates(k,6); const nw=R.suggest(idx,k,6); if(nw[0]===old[0]) same++; else diff.push(`${k}: ${old[0]} → ${nw[0]}   (old still at #${nw.indexOf(old[0])+1||"-"})`); }
console.log(keys.length, "same first:", same); console.log(diff.join("\n"));
