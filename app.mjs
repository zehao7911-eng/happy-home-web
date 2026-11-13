const {clamp,blend,HOME,LANDMARKS,decode64,makeTerrain,sanitize,locomotion,DEFAULT_STATE}=World;
const {View}=Art;
const {bridge}=SDK;
const $=id=>document.getElementById(id);
const canvas=$('view'), panel=$('panel'), game=$('game');
const key='happy-home-web-v1';
function read(){
  try{return JSON.parse(localStorage.getItem(key)||'null')||{};}catch{return {};}
}
const terrain=makeTerrain(decode64(MAP.heights));
const raw=read(),data=sanitize(raw.run,terrain);
const profile={best:Number.isInteger(raw.profile?.best)?clamp(raw.profile.best,0,7):0,
  rewards:{like:raw.profile?.rewards?.like===true,comment:raw.profile?.rewards?.comment===true}};
let sound=raw.sound===true, audio, volume;
let view, sdk, motion={speed:0,moved:0,drop:0}, lastSave=0, session=false;
let time=0,intro=data.stamps||raw.run||matchMedia('(prefers-reduced-motion: reduce)').matches?0:1;
let cameraYaw=data.mode==='drive'?data.car.yaw:data.player.yaw,pitch=.11,freeLook=0;
let notice=0,lastStep=0,lastDust=0,lastBump=0;
let goalKey='', continuePlay=false, approachJeep=false;
const press=new Set(),touch={x:0,y:0,id:null};
const input={x:0,y:0,cameraYaw,jump:false};
const mover=locomotion(data,terrain,MAP.parts);
const ease=x=>x*x*(3-2*x);
function persist(){
  try{localStorage.setItem(key,JSON.stringify({run:data,profile,sound}));}catch{}
}
function merge(next,cloud){
  const best=Number.isInteger(next?.best)?clamp(next.best,0,7):0;
  const old=profile.best;
  profile.best|=best;
  for(const name of ['like','comment'])profile.rewards[name] ||= next?.rewards?.[name]===true;
  persist();
  if(cloud&&old!==profile.best&&panel.open)updatePanel();
}
function announce(text,seconds=2){
  $('toast').textContent=text;$('toast').hidden=false;notice=time+seconds;
}
function start(){
  if(!session&&!data.finished&&!continuePlay){session=true;sdk.start();}
}
function activateAudio(){
  if(!sound)return;
  try{
    const Engine=window.AudioContext||window.webkitAudioContext;
    if(!Engine)return;
    if(!audio){audio=new Engine();volume=audio.createGain();volume.gain.value=.45;volume.connect(audio.destination);}
    audio.resume().catch(()=>{});
  }catch{}
}
function tone(hz,len=.13,vol=.1,shape='sine',bend=1,offset=0){
  if(!sound||!audio||audio.state!=='running')return;
  const t=audio.currentTime+offset,o=audio.createOscillator(),g=audio.createGain();
  o.type=shape;o.frequency.setValueAtTime(hz,t);o.frequency.exponentialRampToValueAtTime(hz*bend,t+len);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.014);
  g.gain.exponentialRampToValueAtTime(.0001,t+len+.025);
  o.connect(g);g.connect(volume);o.start(t);o.stop(t+len+.03);
}
function chord(){
  [523,659,784,1047].forEach((v,i)=>tone(v,.26,.12,'sine',1,i*.062));
}
function target(){
  if(data.finished)return null;
  if(!data.stamps&&!continuePlay&&data.mode!=='drive'&&Math.hypot(data.player.x-data.car.x,data.player.z-data.car.z)>13)
    return {name:'Jeep',x:data.car.x,y:data.car.y+6.4,z:data.car.z,car:true};
  const next=LANDMARKS.findIndex((_,i)=>!(data.stamps&1<<i));
  if(next<0)return null;
  const v=LANDMARKS[next];
  return {...v,y:terrain.ground(v.x,v.z)+5.5};
}
function updateUI(){
  const drive=data.mode==='drive',a=drive?data.car:data.player;
  const inRange=Math.hypot(data.player.x-data.car.x,data.player.z-data.car.z)<14&&Math.abs(data.player.y-data.car.y)<7;
  $('action').disabled=false;
  $('action').hidden=!drive&&!inRange&&(data.stamps!==0||continuePlay);
  $('action').textContent=drive?'Get out':inRange?'Get in':'Find Jeep';
  $('jump').hidden=drive;
  $('tv').hidden=drive||Math.hypot(a.x-MAP.tv[0],a.z-MAP.tv[2])>11||Math.abs(a.y-MAP.tv[1])>9;
  $('tv').setAttribute('aria-pressed',String(data.tv));
  const v=target();
  const title=v?.car?'Take the Jeep':v?.name||'Free Roam';
  const sub=v?.car?'Tap Jeep or walk up':data.finished?'All three stamps collected':'Visit the three landmarks';
  if(goalKey!==title+sub){
    $('objective-title').textContent=title;$('objective-sub').textContent=sub;
    $('keys').innerHTML=drive?'W / S <b>Throttle</b> · A / D <b>Steer</b> · E <b>Exit</b>':'WASD <b>Move</b> · Drag <b>Look</b> · Space <b>Jump</b>';
    goalKey=title+sub;
  } else if(drive!==game.classList.contains('driving')){
    $('keys').innerHTML=drive?'W / S <b>Throttle</b> · A / D <b>Steer</b> · E <b>Exit</b>':'WASD <b>Move</b> · Drag <b>Look</b> · Space <b>Jump</b>';
  }
  game.classList.toggle('driving',drive);
  $('compass').hidden=!v;
  if(v){
    const p=view.project(v.x,v.y,v.z);
    const d=Math.hypot(v.x-a.x,v.z-a.z);
    const angle=Math.atan2(v.x-a.x,-(v.z-a.z))-cameraYaw;
    $('needle').style.transform='rotate('+angle+'rad)';
    $('distance').textContent=Math.round(d)+' m';
    const marker=$('marker');
    marker.hidden=!(p.visible&&p.x>16&&p.x<86&&p.y>25&&p.y<81);
    marker.style.left=p.x+'%';marker.style.top=p.y+'%';
    marker.querySelector('b').textContent=v.name;
    marker.dataset.action=v.car?'jeep':'look';
  }else $('marker').hidden=true;
}
function inspect(){
  if(data.finished)return;
  const a=data.mode==='drive'?data.car:data.player;
  LANDMARKS.forEach((l,i)=>{
    const mask=1<<i;
    if(data.stamps&mask||Math.hypot(a.x-l.x,a.z-l.z)>l.range)return;
    data.stamps|=mask;profile.best|=mask;
    announce(l.name+' stamped!',2.5);
    view.burst(a.x,a.y+3,a.z,18,0xffd878);
    chord();persist();sdk.save();
    if(data.stamps===7){
      data.finished=true;
      if(session)sdk.end();
      session=false;
      persist();sdk.save();openPanel(true);
    }
  });
}
function useAction(){
  if(panel.open)return;
  activateAudio();
  if(data.mode==='walk'&&Math.hypot(data.player.x-data.car.x,data.player.z-data.car.z)>=14){
    const a=data.player,b=data.car;
    cameraYaw=Math.atan2(b.x-a.x,-(b.z-a.z));freeLook=time+4;intro=0;approachJeep=true;
    announce('Walking to the Jeep',1.2);return;
  }
  start();
  const result=mover.action();
  if(result==='drive'){
    cameraYaw=data.car.yaw;freeLook=0;intro=0;pitch=.1;
    tone(118,.24,.11,'triangle',1.65);
    announce('Jeep ready');view.burst(data.car.x,data.car.y+1,data.car.z,10,0xe0c39d);
  }
  if(result==='exit'){cameraYaw=data.player.yaw;tone(160,.15,.09,'triangle',.6);}
  if(result==='blocked')announce('Back up to make room');
  persist();updateUI();
}
function toggleTV(){
  if($('tv').hidden||panel.open)return;
  activateAudio();start();data.tv=!data.tv;
  tone(data.tv?510:220,.16,.085,'square',.82);
  announce(data.tv?'TV on':'TV off',1.5);persist();
}
function updatePanel(){
  $('passport').replaceChildren(...LANDMARKS.map((l,i)=>{
    const row=document.createElement('div');row.className='stamp';
    const dot=document.createElement('span'),done=Boolean(data.stamps&1<<i);
    row.classList.toggle('done',done);dot.textContent=done?'✓':'○';
    row.append(dot,document.createTextNode(l.name));return row;
  }));
  const support=sdk?.support()||{};
  const notes=[];
  if(profile.rewards.like)notes.push('Golden trail unlocked');
  else if(support.like)notes.push('Like this game in GameWave for a golden trail.');
  if(profile.rewards.comment)notes.push('Sunset trail unlocked');
  else if(support.comment)notes.push('Leave a direct GameWave comment for a sunset trail.');
  $('reward').hidden=!notes.length;$('reward').textContent=notes.join(' ');
}
function clearInput(){
  approachJeep=false;press.clear();touch.x=touch.y=0;touch.id=null;input.jump=false;
  $('knob').style.transform='';
}
function openPanel(won=false){
  clearInput();updatePanel();$('panel-title').textContent=won?'Tour Complete':'Field Notes';
  $('continue').textContent=won?'Keep exploring':'Resume';
  $('restart').hidden=!data.finished;
  if(!panel.open)panel.showModal();
}
function closePanel(){
  if(panel.open)panel.close();
  clearInput();
}
function back(reset){
  if(reset){
    const fresh=DEFAULT_STATE();
    Object.assign(data,fresh);session=false;continuePlay=false;sdk.prepare();
  }
  mover.resetPosition();
  cameraYaw=data.player.yaw;freeLook=0;pitch=.11;intro=0;view.ready=false;
  closePanel();persist();updateUI();
}
function init(){
  try{view=new View(canvas,MAP,terrain,decode64(MAP.shapes));}
  catch(e){console.error(e);$('error').hidden=false;return;}
  sdk=bridge({read:()=>structuredClone(profile),write:merge,changed(event){
    if(event.type==='reward'){
      announce(event.kind==='like'?'Golden trail unlocked!':'Sunset trail unlocked!');
      chord();
    }
    if(panel.open)updatePanel();
  }});
  function resize(){
    const bounds=game.getBoundingClientRect(),host=sdk.viewport();
    const w=host&&Math.abs(host.width-bounds.width)<5?host.width:bounds.width;
    const h=host&&Math.abs(host.height-bounds.height)<5?host.height:bounds.height;
    if(w>0&&h>0)view.resize(Math.round(w),Math.round(h));
  }
  new ResizeObserver(resize).observe(game);resize();
  $('sound').setAttribute('aria-pressed',String(sound));
  $('sound').onclick=()=>{sound=!sound;$('sound').setAttribute('aria-pressed',String(sound));activateAudio();if(sound)tone(440);persist();};
  $('menu').onclick=()=>openPanel();
  $('continue').onclick=()=>{continuePlay=data.finished;closePanel();};
  $('return').onclick=()=>back(false);
  $('restart').onclick=()=>back(true);
  $('action').onclick=useAction;
  $('tv').onclick=toggleTV;
  $('jump').onclick=()=>{activateAudio();start();input.jump=true;intro=0;};
  $('marker').onclick=()=>{if($('marker').dataset.action==='jeep')useAction();};
  panel.addEventListener('cancel',clearInput);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();persist();$('error').hidden=false;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();persist();audio?.suspend().catch(()=>{});}else activateAudio();});
  addEventListener('pagehide',()=>{persist();sdk.stop();});
  addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  addEventListener('blur',clearInput);
  addEventListener('keydown',e=>{
    if(e.code==='Escape'){if(!panel.open)openPanel();return;}
    if(panel.open||e.altKey||e.metaKey||e.ctrlKey)return;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','KeyW','KeyA','KeyS','KeyD','KeyT'].includes(e.code)){
      if(e.code==='Space'&&e.target instanceof HTMLButtonElement)return;
      e.preventDefault();activateAudio();press.add(e.code);
      if(!e.repeat&&e.code==='KeyE')useAction();
      if(!e.repeat&&e.code==='KeyT')toggleTV();
      if(!e.repeat&&e.code==='Space'){start();input.jump=true;intro=0;}
    }
  });
  addEventListener('keyup',e=>press.delete(e.code));
  let look=null;
  canvas.addEventListener('pointerdown',e=>{
    if(look||e.button>0)return;activateAudio();intro=0;
    look={id:e.pointerId,x:e.clientX,y:e.clientY};
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(e.pointerId!==look?.id)return;
    cameraYaw-=(e.clientX-look.x)*.009;
    pitch=clamp(pitch+(e.clientY-look.y)*.006,-.36,.78);
    look.x=e.clientX;look.y=e.clientY;freeLook=time+3;
  });
  const unlook=e=>{if(e.pointerId===look?.id)look=null;};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,unlook);
  const stick=$('stick');
  function steer(e){
    const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,range=r.width*.34;
    const x=(e.clientX-cx)/range,y=(cy-e.clientY)/range,ratio=Math.max(1,Math.hypot(x,y));
    touch.x=x/ratio;touch.y=y/ratio;
    $('knob').style.transform='translate('+touch.x*range+'px,'+(-touch.y*range)+'px)';
  }
  stick.addEventListener('pointerdown',e=>{
    if(touch.id!==null)return;activateAudio();intro=0;touch.id=e.pointerId;
    stick.setPointerCapture(e.pointerId);steer(e);
  });
  stick.addEventListener('pointermove',e=>{if(touch.id===e.pointerId)steer(e);});
  function release(e){if(touch.id===e.pointerId){touch.id=null;touch.x=touch.y=0;$('knob').style.transform='';}}
  for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,release);
  const pressed=(a,b)=>press.has(a)||press.has(b)?1:0;
  let previous=performance.now(),acc=0,displayTime=0;
  function frame(now){
    requestAnimationFrame(frame);
    if(document.hidden){previous=now;return;}
    const dt=clamp((now-previous)/1000,.001,.07);
    previous=now;
    if(panel.open)return;
    time+=dt;displayTime+=dt;
    intro=Math.max(0,intro-dt*.78);
    const active=data.mode==='drive'?data.car:data.player;
    if(data.mode==='drive'&&time>freeLook){
      const delta=active.yaw-cameraYaw;
      cameraYaw+=Math.atan2(Math.sin(delta),Math.cos(delta))*Math.min(1,dt*5);
    }
    input.x=clamp(touch.x+pressed('KeyD','ArrowRight')-pressed('KeyA','ArrowLeft'),-1,1);
    input.y=clamp(touch.y+pressed('KeyW','ArrowUp')-pressed('KeyS','ArrowDown'),-1,1);
    input.cameraYaw=cameraYaw;
    if(approachJeep){
      const a=data.player,b=data.car;
      if(data.mode!=='walk'||Math.hypot(a.x-b.x,a.z-b.z)<11||Math.hypot(input.x,input.y)>.1){
        approachJeep=false;
      }else{
        const direction=Math.atan2(b.x-a.x,-(b.z-a.z));
        const angle=direction-cameraYaw;
        input.x=Math.sin(angle);input.y=Math.cos(angle);
      }
    }
    if(Math.hypot(input.x,input.y)>.10){start();intro=0;}
    acc+=dt;
    while(acc>=1/60){
      motion=mover.step(1/60,input);acc-=1/60;
    }
    if(session)inspect();
    if(motion.drop>13&&time-lastBump>.16){lastBump=time;tone(100,.14,.09,'triangle',.68);}
    if(motion.bump&&Math.abs(motion.speed)>6&&time-lastBump>.22){
      lastBump=time;tone(91,.16,.11,'triangle',.65);
      view.burst(active.x,active.y+1,active.z,4,0xbfa58f);
    }
    if(Math.abs(motion.speed)>12&&time-lastDust>.10){
      lastDust=time;view.burst(active.x-Math.sin(active.yaw)*6,active.y+.3,active.z+Math.cos(active.yaw)*6,2,
        profile.rewards.comment?0xf1a48f:profile.rewards.like?0xf8d46f:0xd5c29c);
      if(time-lastStep>.20){lastStep=time;tone(57+Math.abs(motion.speed),.15,.035,'triangle',1.17);}
    }
    if(data.mode==='walk'&&motion.moved>.15&&time-lastStep>.26){
      lastStep=time;tone(135,.08,.027,'triangle',.67);
    }
    if(displayTime>=.026){
      view.update(data,time,displayTime,cameraYaw,pitch,motion,ease(intro),mover.near);
      displayTime=0;updateUI();
    }
    if(notice&&time>=notice){notice=0;$('toast').hidden=true;}
    if(time-lastSave>3){lastSave=time;persist();}
  }
  view.update(data,0,1/60,cameraYaw,pitch,motion,ease(intro),mover.near);
  updateUI();requestAnimationFrame(frame);
}
$('retry').onclick=()=>location.reload();
init();