// Screen-record Litma at phone size (1080x1920) with CDP screencast; frames + timestamps -> CFR mp4.
const {open,hideLocalNote}=require('./lib.cjs');
const path=require('path');
const fs=require('fs'),{execFileSync}=require('child_process');
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
// out: the mp4 to write. Frames come only when the screen changes, so they are re-timed to 30 fps.
async function recorder(p,name,out){
  const dir=path.join(__dirname,'.frames',name);fs.mkdirSync(path.dirname(dir),{recursive:true});fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir);
  const s=await p.context().newCDPSession(p);const frames=[];const taps=[];let t0=null;
  s.on('Page.screencastFrame',async f=>{const t=f.metadata.timestamp;if(t0===null)t0=t;const n=frames.length;
    fs.writeFileSync(path.join(dir,`${String(n).padStart(5,'0')}.jpg`),Buffer.from(f.data,'base64'));frames.push(t-t0);
    s.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
  await s.send('Page.startScreencast',{format:'jpeg',quality:95,maxWidth:1080,maxHeight:1920,everyNthFrame:1});
  const now=()=>t0===null?0:Date.now()/1000-t0;
  return {tap:(x,y)=>taps.push({t:now(),x:x*2.5,y:y*2.5}), mark:(label)=>taps.push({t:now(),label}),
   async stop(){await new Promise(r=>setTimeout(r,600));await s.send('Page.stopScreencast');
    const lines=[];for(let i=0;i<frames.length;i++){const d=(frames[i+1]??frames[i]+0.5)-frames[i];lines.push(`file '${dir}/${String(i).padStart(5,'0')}.jpg'`,`duration ${Math.max(d,0.001).toFixed(4)}`);}
    lines.push(`file '${dir}/${String(frames.length-1).padStart(5,'0')}.jpg'`);const list=path.join(__dirname,'.frames',`${name}.txt`);fs.writeFileSync(list,lines.join('\n'));
    execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',list,'-vf','fps=30,scale=1080:1920:flags=lanczos,format=yuv420p','-c:v','libx264','-crf','12','-preset','medium',out]);
    fs.writeFileSync(path.join(__dirname,'.frames',`${name}.events.json`),JSON.stringify(taps,null,1));
    return {frames:frames.length,dur:frames.at(-1)};}};
}
// Human typing: uneven gaps, longer pause after a word and a sentence.
async function human(p,text,r,{base=95,typo=null}={}){
  for(let i=0;i<text.length;i++){const c=text[i];
    if(typo&&i===typo.at){await p.keyboard.type(typo.wrong,{delay:base});await p.waitForTimeout(260+r()*200);for(const _ of typo.wrong)await p.keyboard.press('Backspace',{delay:90});await p.waitForTimeout(140);}
    await p.keyboard.type(c);let d=base*(0.55+r()*0.9);if(c===' ')d+=120+r()*260;if(c==='.')d+=380;await p.waitForTimeout(d);}
}
async function tapEl(p,rec,loc){const bb=await loc.boundingBox();const x=bb.x+bb.width/2,y=bb.y+bb.height/2;rec.tap(x,y);await p.touchscreen.tap(x,y);}
module.exports={open,hideLocalNote,recorder,human,rng,tapEl};
