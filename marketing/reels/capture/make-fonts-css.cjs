// Writes google-fonts.css: Litma's Google Fonts families served from npm (Fontsource) for the recorder.
const fs=require('fs'),path=require('path');
const nm=path.join(__dirname,'node_modules');
const src=[
 ['Inter','@fontsource-variable/inter/wght.css'],
 ['Manrope','@fontsource-variable/manrope/wght.css'],
 ['Anek Malayalam','@fontsource-variable/anek-malayalam/standard.css'],
 ['Noto Sans Malayalam','@fontsource-variable/noto-sans-malayalam/wght.css'],
 ...[400,500,600,700].map(w=>['Noto Serif Malayalam',`@fontsource/noto-serif-malayalam/${w}.css`]),
 ...[400,700].map(w=>['Manjari',`@fontsource/manjari/${w}.css`]),
 ...[400,700].map(w=>['Gayathri',`@fontsource/gayathri/${w}.css`]),
 ['Chilanka','@fontsource/chilanka/400.css'],
 ...[400,600,700].map(w=>['Baloo Chettan 2',`@fontsource/baloo-chettan-2/${w}.css`]),
];
let css='';
for(const [fam,file] of src){
  const pkg=file.split('/').slice(0,2).join('/');
  let c=fs.readFileSync(path.join(nm,file),'utf8');
  c=c.replace(/font-family:\s*'[^']+'/g,`font-family:'${fam}'`).replace(/url\(\.\/files\//g,`url(/__fonts/${pkg}/files/`).replace(/font-display:\s*swap/g,'font-display:block');
  css+=c+'\n';
}
fs.writeFileSync(path.join(__dirname,'google-fonts.css'),css);
console.log((css.match(/@font-face/g)||[]).length,'faces');
