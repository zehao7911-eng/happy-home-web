const T=globalThis.THREE;

export function makeSourceVisuals(source,scene){
  const textures=new Map();
  const materials=new Map();
  const geometry=new Map();
  const chunks=new Map();
  function texture(id){
    if(!textures.has(id)){
      const tex=new T.TextureLoader().load(source.assets[id]);
      tex.encoding=T.sRGBEncoding;
      tex.wrapS=tex.wrapT=T.RepeatWrapping;
      tex.anisotropy=4;
      textures.set(id,tex);
    }
    return textures.get(id);
  }
  function material(id,alpha){
    const key=id+'|'+alpha;
    if(!materials.has(key)){
      materials.set(key,new T.MeshLambertMaterial({map:texture(id),transparent:alpha>0,opacity:1-alpha,
        alphaTest:.025,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,side:T.DoubleSide}));
    }
    return materials.get(key);
  }
  function surface(part, face, tileU, tileV){
    const dims=[[part[5],part[4]],[part[3],part[5]],[part[3],part[4]],
      [part[5],part[4]],[part[3],part[5]],[part[3],part[4]]][face];
    const coord=[[part[3]/2,0,0],[0,part[4]/2,0],[0,0,part[5]/2],
      [-part[3]/2,0,0],[0,-part[4]/2,0],[0,0,-part[5]/2]][face];
    const rotation=[[0,Math.PI/2,0],[-Math.PI/2,0,0],[0,0,0],
      [0,-Math.PI/2,0],[Math.PI/2,0,0],[0,Math.PI,0]][face];
    const g=new T.PlaneGeometry(...dims);
    const uv=g.attributes.uv;
    if(tileU&&tileV)for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*dims[0]/tileU,uv.getY(i)*dims[1]/tileV);
    g.rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2]);
    const l=Math.hypot(...coord);
    if(l)for(let j=0;j<3;j++)coord[j]*=1+.014/l;
    g.translate(...coord);
    return g;
  }
  function rigid(part){
    const p=part;
    return new T.Matrix4().set(p[6],p[7],p[8],p[0],p[9],p[10],p[11],p[1],p[12],p[13],p[14],p[2],0,0,0,1);
  }
  function attach(parent, part,mesh){
    const group=new T.Group();
    group.scale.set(1/part[3],1/part[4],1/part[5]);
    group.add(mesh);
    parent.add(group);
  }
  function overlay(rows,links,parts){
    for(const [index,face,id,alpha,u,v] of rows){
      const part=parts[index];
      if(part[16]>=1)continue;
      const geo=surface(part,face,u,v);
      const mat=material(id,alpha);
      if(links.has(index)){
        attach(links.get(index),part,new T.Mesh(geo,mat));
        continue;
      }
      geo.applyMatrix4(rigid(part));
      const key=id+'|'+alpha+'|'+Math.floor(part[0]/64)+'|'+Math.floor(part[2]/64);
      if(!chunks.has(key))chunks.set(key,{mat,pos:[],nor:[],uv:[]});
      const b=chunks.get(key);
      for(const i of geo.index.array){
        b.pos.push(geo.attributes.position.getX(i),geo.attributes.position.getY(i),geo.attributes.position.getZ(i));
        b.nor.push(geo.attributes.normal.getX(i),geo.attributes.normal.getY(i),geo.attributes.normal.getZ(i));
        b.uv.push(geo.attributes.uv.getX(i),geo.attributes.uv.getY(i));
      }
      geo.dispose();
    }
    for(const b of chunks.values()){
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(b.pos,3));
      g.setAttribute('normal',new T.Float32BufferAttribute(b.nor,3));
      g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));
      g.computeBoundingSphere();
      scene.add(new T.Mesh(g,b.mat));
    }
  }
  function importMesh([i,id,tex,s,o],parts){
    if(!geometry.has(id)){
      const positions=[],normals=[],uvs=[],v=source.models[id];
      for(let j=0;j<v.length;j+=3){
        positions.push(...v[j]);normals.push(...v[j+1]);uvs.push(v[j+2][0],v[j+2][1]);
      }
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
      g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
      geometry.set(id,g);
    }
    const m=new T.Mesh(geometry.get(id),material(tex,0));
    m.position.set(...o);
    m.scale.set(...s.map(x=>x*.5));
    const group=new T.Group();
    group.matrix.copy(rigid(parts[i]));
    group.matrixAutoUpdate=false;
    group.add(m);
    scene.add(group);
  }
  function tv(part,parent){
    const geo=surface(part,3,0,0);
    const mat=new T.MeshBasicMaterial({map:texture('58247550'),side:T.DoubleSide,
      polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    const mesh=new T.Mesh(geo,mat);
    attach(parent,part,mesh);
    return (on,time)=>{
      mesh.visible=on;
      mat.map=texture(Math.floor(time*5)%2?'58247679':'58247550');
    };
  }
  return {overlay,importMesh,tv};
}
