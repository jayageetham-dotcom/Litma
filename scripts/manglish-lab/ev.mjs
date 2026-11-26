import fs from "node:fs";
const R = await import("./rank.ts");
const N = +process.argv[2] || 375000;
const ok=/^[ഀ-ൿ‌‍]+$/;
const words=[];
for (const l of fs.readFileSync("/home/claude/data/words.tsv","utf8").split("\n")) {
  const t=l.indexOf("\t"); if(t<0) continue; const w=l.slice(0,t); words.push([w,+l.slice(t+1)]); if(words.length>=N) break; }
console.time("index"); const idx=R.buildIndex(words); console.timeEnd("index");
let big=0; for (const b of idx.values()) big=Math.max(big,b.length); console.log("buckets",idx.size,"largest",big);
function load(f){ if(f.endsWith(".json")) return fs.readFileSync(f,"utf8").trim().split("\n").map(l=>{const o=JSON.parse(l);return [o["native word"],o["english word"]]});
 return fs.readFileSync(f,"utf8").trim().split("\n").slice(1).map(l=>l.split("\t")); }
const files = process.argv.slice(3).length ? process.argv.slice(3) : ["/home/claude/data/dakshina-valid.tsv"];
for (const f of files) {
  const rows=load(f).filter(([m,e])=>/^[a-z]+$/.test(e)); let t1=0,t6=0; console.time(f);
  for (const [ml,en] of rows){ const c=R.suggest(idx,en,6); if(c[0]===ml)t1++; if(c.includes(ml))t6++; }
  console.timeEnd(f);
  console.log(f.split("/").pop(), rows.length, "top1", (100*t1/rows.length).toFixed(1), "top6", (100*t6/rows.length).toFixed(1));
}
