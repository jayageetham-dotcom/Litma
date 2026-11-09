const {open,hideLocalNote,recorder,tapEl}=require('./rec.cjs');
const path=require('path');
(async()=>{const {b,p,url}=await open();
 await p.goto(url('/desk/'));await p.waitForTimeout(1800);
 await hideLocalNote(p);
 const rec=await recorder(p,'picker',path.join(__dirname,'../reel-types/public/picker.mp4'));await p.waitForTimeout(700);
 await tapEl(p,rec,p.getByRole('button',{name:'New work'}).last());await p.waitForTimeout(1100);
 // flick: find the scrolling element inside the sheet and ease it down like a thumb would
 await p.evaluate(async()=>{const d=document.querySelector('.dialog');const sc=[d,...d.querySelectorAll('*')].find(e=>e.scrollHeight>e.clientHeight+20&&getComputedStyle(e).overflowY!='visible');
  const flick=(dist,ms)=>new Promise(r=>{const s=sc.scrollTop,t0=performance.now();const f=t=>{const k=Math.min(1,(t-t0)/ms);sc.scrollTop=s+dist*(1-Math.pow(1-k,3));k<1?requestAnimationFrame(f):r();};requestAnimationFrame(f);});
  await flick(700,650);await new Promise(r=>setTimeout(r,350));await flick(900,700);await new Promise(r=>setTimeout(r,350));await flick(1100,800);});
 await p.waitForTimeout(800);console.log(await rec.stop());await b.close();})();
