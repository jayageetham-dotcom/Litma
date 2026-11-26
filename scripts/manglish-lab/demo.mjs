import fs from "node:fs";
const R = await import("./rank.ts");
const M = await import("/home/claude/litma/packages/shared/src/manglish.ts");
const ok=/^[ഀ-ൿ‌‍]+$/; const words=[];
for (const l of fs.readFileSync("/home/claude/data/words.tsv","utf8").split("\n")) { const t=l.indexOf("\t"); if(t<0) continue; const w=l.slice(0,t); words.push([w,+l.slice(t+1)]); if(words.length>=375000) break; }
const idx=R.buildIndex(words);
for (const w of process.argv.slice(2)) console.log(w.padEnd(16), "old:", M.manglishCandidates(w,4).join(" "), " | new:", R.suggest(idx,w,6).join(" "));
