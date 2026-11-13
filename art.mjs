const T=globalThis.THREE;
const pos=new T.Vector3(), scale=new T.Vector3(), matrix=new T.Matrix4(), rot=new T.Matrix4();
const white=new T.Color(0xffffff);

function wedge(){
  const v=[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5]];
  const faces=[[0,1,2,3],[5,4,3,2],[4,0,3],[1,5,2],[4,5,1,0]];
  const pts=[];
  for(const f of faces){
    pts.push(...v[f[0]],...v[f[1]],...v[f[2]]);
    if(f.length===4)pts.push(...v[f[0]],...v[f[2]],...v[f[3]]);
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(pts,3));
  g.computeVertexNormals();
  return g;
}
const geometry={
  0:new T.SphereGeometry(.5,12,8),1:new T.BoxGeometry(1,1,1),
  2:new T.CylinderGeometry(.5,.5,1,16).rotateZ(Math.PI/2),3:wedge()
};
const solid=new T.MeshLambertMaterial({color:0xffffff,side:T.DoubleSide});
const glass=new Map();
function material(transparency){
  if(transparency===0)return solid;
  if(!glass.has(transparency))glass.set(transparency,new T.MeshLambertMaterial({color:0xffffff,opacity:1-transparency,transparent:true,depthWrite:false,side:T.DoubleSide}));
  return glass.get(transparency);
}
function pose(p,x=0,y=0,z=0){
  rot.set(p[6],p[7],p[8],0,p[9],p[10],p[11],0,p[12],p[13],p[14],0,0,0,0,1);
  pos.set(p[0]-x,p[1]-y,p[2]-z);
  scale.set(p[3],p[4],p[5]);
  return matrix.copy(rot).scale(scale).setPosition(pos);
}
function model(p,x=0,y=0,z=0){
  const m=new T.Mesh(geometry[p[17]]||geometry[1],material(p[16]).clone());
  m.material.color.setHex(p[15]);
  m.matrix.copy(pose(p,x,y,z));
  m.matrixAutoUpdate=false;
  return m;
}
function batch(group, rows){
  const lists=new Map();
  for(const p of rows){
    const key=p[17]+'|'+p[16];
    if(!lists.has(key))lists.set(key,[]);
    lists.get(key).push(p);
  }
  for(const list of lists.values()){
    const p=list[0], batch=new T.InstancedMesh(geometry[p[17]]||geometry[1],material(p[16]),list.length);
    list.forEach((part,i)=>{
      batch.setMatrixAt(i,pose(part));
      batch.setColorAt(i,white.setHex(part[15]));
    });
    batch.frustumCulled=false;
    group.add(batch);
  }
}
function hills(terrain,shapes,scene){
  const mat=new T.MeshLambertMaterial({vertexColors:true,side:T.FrontSide});
  const colors=[0x718b43,0x748c45,0x6f8942,0x728b45,0x708b44].map(c=>new T.Color(c));
  const tilePoints=[[0,0],[0,1],[1,0],[1,1]];
  for(let z=0;z<512;z+=32)for(let x=0;x<512;x+=32){
    const points=[],rgb=[];
    function triangle(a,b,c,color){
      points.push(...a,...b,...c);
      for(let k=0;k<3;k++)rgb.push(color.r,color.g,color.b);
    }
    function quad(a,b,c,d,color){
      triangle(a,b,c,color);triangle(c,b,d,color);
    }
    for(let j=z;j<z+32;j++)for(let i=x;i<x+32;i++){
      const h=terrain.cell(i,j);
      if(!h)continue;
      const bits=shapes[j*512+i],shape=bits>>3&7,dir=bits>>6&3;
      const color=colors[(i*11^j*7)%colors.length];
      const slab=(i-256)*4,back=(j-256)*4;
      const offset=tilePoints.map(([u,v])=>{
        let a=u,b=v;
        for(let q=0;q<dir;q++)[a,b]=[b,1-a];
        if(shape===1)return b?0:-4;
        if(shape===2)return a&&b?0:-4;
        if(shape===3)return a||b?0:-4;
        return 0;
      });
      const v=tilePoints.map(([u,w],k)=>[slab+u*4,h+offset[k],back+w*4]);
      if(shape===4)triangle(v[0],v[1],v[2],color);
      else if((shape===2||shape===3)&&(dir%2===0)){
        triangle(v[0],v[1],v[3],color);triangle(v[0],v[3],v[2],color);
      }else quad(...v,color);
      const walls=[[0,1,i-1,j],[1,3,i,j+1],[3,2,i+1,j],[2,0,i,j-1]];
      for(const [m,n,u,w] of walls){
        const bottom=terrain.cell(u,w);
        if(bottom>=Math.max(v[m][1],v[n][1]))continue;
        const floor=Math.max(0,bottom||h-12);
        const a=v[m],b=v[n];
        quad(a,[a[0],Math.min(a[1],floor),a[2]],b,[b[0],Math.min(b[1],floor),b[2]],color);
      }
    }
    if(!points.length)continue;
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(points,3));
    g.setAttribute('color',new T.Float32BufferAttribute(rgb,3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    scene.add(new T.Mesh(g,mat));
  }
}
function makeAvatar(){
  const body=new T.Group(), parts={};
  const box=(color,w,h,d,x,y,z,parent=body)=>{
    const m=new T.Mesh(geometry[1],new T.MeshLambertMaterial({color}));
    m.scale.set(w,h,d);
    m.position.set(x,y,z);
    parent.add(m);
    return m;
  };
  box(0x297ace,2.05,2.05,1.08,0,2.97,0);
  const head=new T.Mesh(new T.CylinderGeometry(.72,.76,1.02,12),new T.MeshLambertMaterial({color:0xffce45}));
  head.position.y=4.58;
  body.add(head);
  for(const x of [-.23,.23])box(0x252b34,.105,.16,.045,x,4.67,-.715);
  for(const [x,y] of [[-.19,4.43],[-.075,4.38],[.075,4.38],[.19,4.43]])box(0x252b34,.125,.06,.04,x,y,-.722);
  for(const i of [-1,1]){
    const arm=new T.Group(), leg=new T.Group();
    arm.position.set(i*1.35,3.92,0);
    leg.position.set(i*.51,1.95,0);
    box(0xffcf43,.62,1.75,.73,0,-.79,0,arm);
    box(0x39536d,.92,1.84,1,0,-.92,0,leg);
    body.add(arm,leg);
    parts[i]={arm,leg};
  }
  return {body,parts};
}
function softShadow(){
  const c=document.createElement('canvas');c.width=c.height=64;
  const g=c.getContext('2d');
  const grad=g.createRadialGradient(32,32,4,32,32,30);
  grad.addColorStop(0,'rgba(25,49,39,0.40)');grad.addColorStop(1,'rgba(25,49,39,0)');
  g.fillStyle=grad;g.fillRect(0,0,64,64);
  const m=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false}));
  m.rotation.x=-Math.PI/2;
  return m;
}
function skyDome(){
  return new T.Mesh(new T.SphereGeometry(1200,32,16),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,
    vertexShader:'varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader:`varying vec3 p;
    void main(){
      vec3 d=normalize(p); float t=clamp(d.y*2.5+.11,0.,1.);
      vec3 a=vec3(.94,.96,.87),b=vec3(.28,.58,.81);
      float s=pow(max(0.,dot(d,normalize(vec3(-.48,.48,-.68)))),35.);
      gl_FragColor=vec4(mix(a,b,t)+s*vec3(.36,.27,.15),1.);
    }`
  }));
}
export class View {
  constructor(canvas,map,terrain,shapes){
    this.terrain=terrain;
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});
    this.renderer.outputEncoding=T.sRGBEncoding;
    this.renderer.setClearColor(0xc8deeb);
    const scene=this.scene=new T.Scene();
    scene.fog=new T.Fog(0xb6d0ea,530,1450);
    this.sky=skyDome();
    scene.add(this.sky,new T.AmbientLight(0xffffff,ORIGINAL.ambient[0]*1.30));
    const sun=new T.DirectionalLight(0xfff8e8,ORIGINAL.brightness*.68);
    sun.position.set(-80,140,-95);
    scene.add(sun);
    hills(terrain,shapes,scene);
    const byTile=new Map(),dynamic=new Map();
    const imported=new Set(ORIGINAL.meshes.map(m=>m[0]));
    this.visuals=SourceVisuals.makeSourceVisuals(ORIGINAL,scene);
    for(const [i,p] of map.parts.entries()){
      if(imported.has(i))continue;
      if(p[16]>=1||p[19])continue;
      const key=Math.floor(p[0]/58)+','+Math.floor(p[2]/58);
      if(!byTile.has(key))byTile.set(key,[]);
      byTile.get(key).push(p);
    }
    for(const parts of byTile.values())batch(scene,parts);
    this.doors=map.doors.map((ids,i)=>{
      const leaf=ids.map(id=>{
        const p=map.parts[id],m=model(p);
        scene.add(m);dynamic.set(id,m);
        return {p,m};
      });
      return {leaf,amount:0,x:(leaf[0].p[0]+leaf[1].p[0])/2,y:leaf[0].p[1],z:(leaf[0].p[2]+leaf[1].p[2])/2,axis:i===0?0:2};
    });
    const tvPart=map.parts.find(p=>p[19]===20);
    this.tv=model(tvPart);
    scene.add(this.tv);
    this.tvStatic=this.visuals.tv(tvPart,this.tv);
    this.car=new T.Group();
    this.wheels=[];
    for(const id of map.jeep){
      const p=map.parts[id];
      if(p[16]===1)continue;
      const m=model(p,World.GARAGE[0],World.GARAGE[1],World.GARAGE[2]);
      dynamic.set(id,m);
      if(p[19]===2){
        const pivot=new T.Group();
        pivot.position.set(p[0]-World.GARAGE[0],p[1]-World.GARAGE[1],p[2]-World.GARAGE[2]);
        m.matrix.setPosition(0,0,0);
        pivot.add(m);this.car.add(pivot);this.wheels.push(pivot);
      }else this.car.add(m);
    }
    this.visuals.overlay(ORIGINAL.decals,dynamic,map.parts);
    for(const mesh of ORIGINAL.meshes)this.visuals.importMesh(mesh,map.parts);
    this.avatar=makeAvatar();
    this.playerShadow=softShadow();
    this.carShadow=softShadow();
    scene.add(this.car,this.avatar.body,this.playerShadow,this.carShadow);
    this.camera=new T.PerspectiveCamera(57,1,.13,1120);
    this.camPos=new T.Vector3();
    this.focus=new T.Vector3();
    this.ready=false;
    this.particles=[];
    const dust=new T.MeshBasicMaterial({color:0xe4c899,transparent:true,opacity:.56,depthWrite:false});
    for(let i=0;i<26;i++){
      const m=new T.Mesh(geometry[0],dust.clone());
      m.visible=false;scene.add(m);this.particles.push({m,life:0});
    }
  }
  resize(w,h){
    this.camera.aspect=w/h;
    this.camera.fov=w<h?82:ORIGINAL.fov;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,w<h?1.35:1.65));
    this.renderer.setSize(w,h,false);
  }
  burst(x,y,z,n,color){
    for(let i=0;i<n;i++){
      const p=this.particles.find(v=>v.life<=0);
      if(!p)return;
      p.life=.36+Math.random()*.42;p.total=p.life;
      p.m.visible=true;p.m.position.set(x,y,z);
      p.m.material.color.setHex(color);
      const a=Math.random()*6.28,s=1+Math.random()*6;
      p.vx=Math.cos(a)*s;p.vz=Math.sin(a)*s;p.vy=1+Math.random()*5;
      p.size=.3+Math.random()*.6;
    }
  }
  update(data,time,dt,cameraYaw,pitch,motion,intro,near){
    const player=data.player,car=data.car,drive=data.mode==='drive', active=drive?car:player;
    this.car.position.set(car.x,car.y,car.z);
    this.car.rotation.y=World.START_YAW-car.yaw;
    for(const w of this.wheels)w.rotation.z-=motion.speed*dt*.48;
    const avatar=this.avatar;
    avatar.body.visible=!drive;
    avatar.body.position.set(player.x,player.y,player.z);
    avatar.body.rotation.y=-player.yaw;
    const gait=Math.sin(time*13)*Math.min(.8,motion.moved*3.4);
    for(const i of [-1,1]){
      avatar.parts[i].arm.rotation.x=i*gait;
      avatar.parts[i].leg.rotation.x=-i*gait;
    }
    this.playerShadow.visible=!drive;
    this.playerShadow.position.set(player.x,this.terrain.ground(player.x,player.z)+.08,player.z);
    this.playerShadow.scale.set(6,6,1);
    this.carShadow.position.set(car.x,this.terrain.ground(car.x,car.z)+.08,car.z);
    this.carShadow.scale.set(18,13,1);
    for(const door of this.doors){
      const open=!drive&&Math.hypot(door.x-player.x,door.z-player.z)<8&&Math.abs(player.y-(door.y-4))<5;
      door.amount=World.blend(door.amount,open?1:0,Math.min(1,dt*10));
      for(const leaf of door.leaf){
        const side=Math.sign(leaf.p[door.axis]-(door.axis===0?door.x:door.z));
        leaf.m.matrix.copy(pose(leaf.p));
        leaf.m.matrix.elements[door.axis+12]+=side*(door.axis===0?3.45:1.15)*door.amount;
        leaf.m.matrixWorldNeedsUpdate=true;
      }
    }
    this.tvStatic(data.tv,time);
    for(const p of this.particles)if(p.life>0){
      p.life=Math.max(0,p.life-dt);
      p.m.visible=p.life>0;
      p.m.position.x+=p.vx*dt;p.m.position.y+=p.vy*dt;p.m.position.z+=p.vz*dt;
      p.m.material.opacity=p.life/p.total*.57;
      p.m.scale.setScalar(p.size*(1.5-p.life/p.total));
    }
    const arm=drive?29:20;
    const yaw=cameraYaw-intro*.78;
    const height=(drive?14:9)+pitch*13+intro*22;
    const wanted=new T.Vector3(active.x-Math.sin(yaw)*(arm+intro*12),active.y+height,active.z+Math.cos(yaw)*(arm+intro*12));
    const target=new T.Vector3(active.x+Math.sin(yaw)*(drive?6:2),active.y+(drive?3.6:3.1),active.z-Math.cos(yaw)*(drive?6:2));
    if(!intro&&!drive){
      for(let n=2;n<=9;n++){
        const k=n/10,v=target.clone().lerp(wanted,k);
        if(v.y<this.terrain.ground(v.x,v.z)+.5||near(v.x,v.z,.28).some(b=>b.low<v.y+.35&&b.top>v.y-.15)){
          wanted.lerpVectors(target,wanted,Math.max(.15,k-.13));break;
        }
      }
    }
    if(intro>.01){
      const q=ORIGINAL.camera;
      const archived=new T.Vector3(q[0],q[1],q[2]);
      const gaze=new T.Vector3(q[0]-q[5]*30,q[1]-q[8]*30,q[2]-q[11]*30);
      wanted.lerp(archived,intro);
      target.lerp(gaze,intro);
    }
    const lerp=this.ready?1-Math.exp(-dt*12):1;
    this.camPos.lerp(wanted,lerp);this.focus.lerp(target,lerp);this.ready=true;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.focus);
    this.sky.position.copy(this.camPos);
    this.renderer.render(this.scene,this.camera);
  }
  project(x,y,z){
    const p=new T.Vector3(x,y,z).project(this.camera);
    return {x:(p.x*.5+.5)*100,y:(.5-p.y*.5)*100,visible:p.z<1&&p.z>-1&&Math.abs(p.x)<1.04&&Math.abs(p.y)<1.04};
  }
}
