export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const blend = (a, b, t) => a + (b - a) * t;
export const HOME = [-381.8, 40.4, -134.8];
export const GARAGE = [-371.9, 40, -116.4];
export const LANDMARKS = [
  {name:'Starter House', x:-305.9, z:-159.6, range:16},
  {name:'The Hills', x:-407, z:174, range:35},
  {name:'Space Station', x:131, z:211, range:35}
];
export const START_YAW = Math.PI / 2 + .02;
export const DEFAULT_STATE = () => ({
  player:{x:HOME[0], y:HOME[1], z:HOME[2], yaw:2.24},
  car:{x:GARAGE[0], y:GARAGE[1], z:GARAGE[2], yaw:START_YAW},
  mode:'walk', stamps:0, finished:false, tv:false
});
export function decode64(s) {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
export function makeTerrain(heights) {
  const cell = (x,z) => x<0||z<0||x>=512||z>=512 ? 0 : heights[z*512+x]*4;
  function corner(i,j) {
    const h=[cell(i-1,j-1),cell(i,j-1),cell(i-1,j),cell(i,j)].filter(Boolean);
    return h.length ? h.reduce((a,b)=>a+b,0)/h.length : 0;
  }
  function ground(x,z) {
    const u=x/4+256, v=z/4+256, i=Math.floor(u),j=Math.floor(v);
    return blend(blend(corner(i,j),corner(i+1,j),u-i),blend(corner(i,j+1),corner(i+1,j+1),u-i),v-j);
  }
  return {cell,corner,ground};
}
export function colliders(parts) {
  const buckets = new Map();
  const bucket = (x,z) => Math.floor(x/16)+','+Math.floor(z/16);
  for (const [id,p] of parts.entries()) {
    if (!(p[18]&1) || p[19]===1 || p[19]===2 || p[19]===20 || p[16]===1 || p[19]>=10) continue;
    const [x,y,z,sx,sy,sz,a,b,c,d,e,f,g,h,i]=p;
    const hx=(Math.abs(a)*sx+Math.abs(b)*sy+Math.abs(c)*sz)/2;
    const hy=(Math.abs(d)*sx+Math.abs(e)*sy+Math.abs(f)*sz)/2;
    const hz=(Math.abs(g)*sx+Math.abs(h)*sy+Math.abs(i)*sz)/2;
    const box={id,x,z,low:y-hy,top:y+hy,sx,sz,hx,hz,a,c,g,i,tilted:Math.abs(e)<.91};
    for(let j=Math.floor((z-hz-3)/16);j<=Math.floor((z+hz+3)/16);j++){
      for(let k=Math.floor((x-hx-3)/16);k<=Math.floor((x+hx+3)/16);k++){
        const key=k+','+j;
        if(!buckets.has(key))buckets.set(key,[]);
        buckets.get(key).push(box);
      }
    }
  }
  function nearby(x,z,r){
    return (buckets.get(bucket(x,z))||[]).filter(q=>{
      const dx=x-q.x,dz=z-q.z;
      if(Math.abs(dx)>q.hx+r||Math.abs(dz)>q.hz+r)return false;
      return q.tilted||Math.abs(dx*q.a+dz*q.g)<=q.sx/2+r&&Math.abs(dx*q.c+dz*q.i)<=q.sz/2+r;
    });
  }
  return nearby;
}
export function sanitize(raw, terrain) {
  const base=DEFAULT_STATE();
  const valid=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
  if(!raw || typeof raw!=='object')return base;
  for(const key of ['player','car']){
    const p=raw[key];
    if(p&&valid(p.x,-1018,1018)&&valid(p.z,-1018,1018)&&terrain.ground(p.x,p.z)>1&&valid(p.y,1,180)&&valid(p.yaw,-Math.PI,Math.PI))base[key]={x:p.x,y:p.y,z:p.z,yaw:p.yaw};
  }
  base.mode=raw.mode==='drive'?'drive':'walk';
  base.stamps=Number.isInteger(raw.stamps)?raw.stamps&7:0;
  base.finished=raw.finished===true&&base.stamps===7;
  base.tv=raw.tv===true;
  return base;
}
export function locomotion(data, terrain, parts) {
  const near=colliders(parts);
  let speed=0, vy=0, grounded=true, drop=0, groundLast=0;
  const wrap=yaw=>Math.atan2(Math.sin(yaw),Math.cos(yaw));
  function floor(x,z,foot,r,step) {
    let top=terrain.ground(x,z);
    for(const box of near(x,z,r*.72))if(box.top<=foot+step&&box.top>top)top=box.top;
    return top;
  }
  function step(dt,input) {
    const drive=data.mode==='drive', p=drive?data.car:data.player;
    const radius=drive?2.9:1.05, height=drive?6:4.9, stepHeight=drive?3.1:1.45;
    let dx=0,dz=0;
    if(drive){
      const target=input.y>=0?input.y*49:input.y*21;
      speed=blend(speed,target,Math.min(1,dt*(input.y?2.5:4.8)));
      p.yaw=wrap(p.yaw+input.x*dt*2.05*clamp(Math.abs(speed)/10+.05,.05,1)*Math.sign(speed||1));
      dx=Math.sin(p.yaw)*speed*dt;
      dz=-Math.cos(p.yaw)*speed*dt;
    }else{
      const n=Math.min(1,Math.hypot(input.x,input.y));
      if(n>.045){
        const direction=input.cameraYaw+Math.atan2(input.x,input.y);
        dx=Math.sin(direction)*n*19*dt;
        dz=-Math.cos(direction)*n*19*dt;
        p.yaw=wrap(p.yaw+wrap(direction-p.yaw)*Math.min(dt*14,1));
      }
      if(grounded&&input.jump){vy=24;grounded=false;input.jump=false;}
    }
    const oldX=p.x,oldZ=p.z;
    function walkTo(x,z){
      const f=terrain.ground(x,z);
      if(f<2||f>p.y+stepHeight+.1)return false;
      if(near(x,z,radius).some(b=>b.top>p.y+stepHeight&&b.low<p.y+height-.16))return false;
      p.x=x;p.z=z;
      return true;
    }
    let bump=false;
    if(dx&&!walkTo(p.x+dx,p.z))bump=true;
    if(dz&&!walkTo(p.x,p.z+dz))bump=true;
    if(bump&&drive)speed*=.8;
    const nextFloor=floor(p.x,p.z,p.y,radius,stepHeight);
    groundLast=nextFloor;
    if(drive){
      p.y=blend(p.y,nextFloor,Math.min(1,dt*9));
    }else{
      const before=vy;
      if(nextFloor>p.y&&grounded)p.y=nextFloor;
      vy-=56*dt;
      p.y+=vy*dt;
      if(vy>0&&near(p.x,p.z,radius*.7).some(b=>b.low>p.y&&b.low<p.y+height&&b.top>p.y+height)){
        vy=0;p.y-=Math.max(0,before)*dt;
      }
      if(p.y<=nextFloor){drop=grounded?0:-vy;p.y=nextFloor;vy=0;grounded=true;}
      else{drop=0;grounded=false;}
    }
    return {speed,moved:Math.hypot(p.x-oldX,p.z-oldZ),drop,bump,ground:groundLast};
  }
  function action(){
    if(data.mode==='drive'){
      const c=data.car;
      for(const angle of [Math.PI/2,-Math.PI/2,Math.PI,0]){
        const a=c.yaw+angle,x=c.x+Math.sin(a)*6.3,z=c.z-Math.cos(a)*6.3,y=terrain.ground(x,z);
        if(y>2&&!near(x,z,1).some(b=>b.top>y+1.4&&b.low<y+5)){
          Object.assign(data.player,{x,y,z,yaw:c.yaw});data.mode='walk';speed=0;return 'exit';
        }
      }
      return 'blocked';
    }
    const p=data.player,c=data.car;
    if(Math.hypot(p.x-c.x,p.z-c.z)<14&&Math.abs(p.y-c.y)<7){
      data.mode='drive';speed=0;return 'drive';
    }
    return '';
  }
  function resetPosition(){
    const next=DEFAULT_STATE();
    Object.assign(data.player,next.player);
    Object.assign(data.car,next.car);
    data.mode='walk';speed=0;vy=0;grounded=true;
  }
  return {step,action,resetPosition,near};
}
