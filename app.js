import * as THREE from 'three';
import {OrbitControls} from 'https://unpkg.com/three@0.181.0/examples/jsm/controls/OrbitControls.js';
import {IfcAPI} from 'web-ifc';
const $=id=>document.getElementById(id), view=$('viewer');
const scene=new THREE.Scene();scene.background=new THREE.Color(0xf4f3f1);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.01,1e9);
const modelUp=new THREE.Vector3(0,-1,0);camera.up.copy(modelUp);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.localClippingEnabled=true;view.appendChild(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.screenSpacePanning=true;
scene.add(new THREE.HemisphereLight(0xffffff,0x777777,2));
const sun=new THREE.DirectionalLight(0xffffff,2.4);sun.position.set(1,3,2);scene.add(sun);
const root=new THREE.Group();scene.add(root);
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2(),meshes=[],allMats=new Set();
let ifc,modelID,modelBox,unit=1,mode='identify',cutAxis='z',cutInvert=false,cutOn=false,first=null,selected=null;
const measurements=[],labels=[];const plane=new THREE.Plane();const temp=new THREE.Vector3();
function status(s){$('status').textContent=s;}
function progress(n,t){$('progress').value=n;$('loadingText').textContent=t;status(t);}
function changeMode(m){mode=m;for(const id of ['identify','measure','cut'])$(id).classList.toggle('active',id===m);$('measurePanel').classList.toggle('show',m==='measure');$('cutPanel').classList.toggle('show',m==='cut');if(m!=='measure')first=null;}
function fit(dir='iso'){
 if(!modelBox)return;const sphere=modelBox.getBoundingSphere(new THREE.Sphere()),c=sphere.center,r=Math.max(sphere.radius,1);
 const size=modelBox.getSize(new THREE.Vector3()),horizontal= size.x>=size.z?new THREE.Vector3(.35,0,1):new THREE.Vector3(1,0,.35);
 const p=dir==='top'?c.clone().addScaledVector(modelUp,r*2.5).add(new THREE.Vector3(0,0,.001)):dir==='front'?c.clone().addScaledVector(modelUp,r*.05).add(new THREE.Vector3(0,0,r*2.5)):c.clone().add(horizontal.addScaledVector(modelUp,1.5).normalize().multiplyScalar(r*2.7));
 camera.up.copy(dir==='top'?new THREE.Vector3(0,0,1):modelUp);orbit.target.copy(c);camera.position.copy(p);camera.near=Math.max(r/10000,.01);camera.far=Math.max(r*60,1000);camera.updateProjectionMatrix();orbit.update();
}
function setCut(){if(!modelBox)return;const axis=cutAxis==='x'?new THREE.Vector3(1,0,0):cutAxis==='y'?new THREE.Vector3(0,0,1):modelUp.clone();
 const center=modelBox.getCenter(new THREE.Vector3()),size=modelBox.getSize(new THREE.Vector3());const extent=cutAxis==='x'?size.x:cutAxis==='y'?size.z:size.y;
 const pos=axis.dot(center)+((+$('cutRange').value/100)-.5)*extent*(cutAxis==='z'?-1:1);
 plane.normal.copy(axis).multiplyScalar(cutInvert?-1:1);plane.constant=-pos*(cutInvert?-1:1);
 for(const m of allMats)m.clippingPlanes=cutOn?[plane]:[];
 $('cutPct').textContent=$('cutRange').value+'%';}
function intersect(e){const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(mouse,camera);return ray.intersectObjects(meshes,false).find(hit=>!cutOn||plane.distanceToPoint(hit.point)>=-.0001);}
function fmt(d){const v=d*unit;return v>=1?v.toLocaleString('pt-BR',{maximumFractionDigits:3,minimumFractionDigits:2})+' m':(v*100).toLocaleString('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1})+' cm';}
function addMarker(point,color=0xf36b21){const obj=new THREE.Mesh(new THREE.SphereGeometry(Math.max(modelBox?.getSize(new THREE.Vector3()).length()*.002,.006),10,8),new THREE.MeshBasicMaterial({color,depthTest:false}));obj.position.copy(point);obj.renderOrder=100;scene.add(obj);return obj;}
function clearMeasurements(){for(const m of measurements){scene.remove(m.line);scene.remove(m.a);scene.remove(m.b);m.label.remove();}measurements.length=0;first=null;$('measureHelp').textContent='Clique em dois pontos da estrutura para cotar.';}
function measurePoint(point){if(!first){first=point.clone();$('measureHelp').textContent='Primeiro ponto selecionado. Clique no segundo ponto.';return;}
 const dist=point.distanceTo(first),geo=new THREE.BufferGeometry().setFromPoints([first,point]);const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xf36b21,depthTest:false}));line.renderOrder=101;scene.add(line);
 const label=document.createElement('div');label.className='bubble';label.textContent=fmt(dist);document.body.append(label);
 measurements.push({line,a:addMarker(first),b:addMarker(point),label,mid:first.clone().add(point).multiplyScalar(.5)});$('measureHelp').textContent='Última cota: '+fmt(dist)+' • selecione outro par de pontos.';first=null;}
function plain(v){if(v===null||v===undefined)return '';if(typeof v==='object'){if('value'in v)return String(v.value);return JSON.stringify(v);}return String(v);}
function displayInfo(id){$('info').classList.add('show');const table=$('infoData');table.replaceChildren();let line;try{line=ifc.GetLine(modelID,id,false);}catch(e){line={};}
 const info={Tipo:meshes.find(m=>m.userData.id===id)?.userData.type||'Elemento IFC',Nome:plain(line.Name),Descrição:plain(line.Description),Identificação:plain(line.Tag),'Global ID':plain(line.GlobalId),'Express ID':id,'Object Type':plain(line.ObjectType)};
 for(const [k,v] of Object.entries(info)){if(v==='')continue;const a=document.createElement('b'),b=document.createElement('span');a.textContent=k;b.textContent=v;table.append(a,b);}}
function pick(e){const hit=intersect(e);if(!hit)return;if(mode==='measure'){measurePoint(hit.point);return;}if(mode!=='identify')return;
 if(selected){scene.remove(selected);selected.geometry.dispose();selected.material.dispose();selected=null;}
 const target=hit.object;const edges=new THREE.EdgesGeometry(target.geometry,35);selected=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:0xf36b21,depthTest:false}));selected.matrixAutoUpdate=false;selected.matrix.copy(target.matrixWorld);selected.renderOrder=50;scene.add(selected);displayInfo(target.userData.id);}
let down;renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};},{passive:true});renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)return;pick(e);},{passive:true});
function geomFromIfc(gid,cache){if(cache.has(gid))return cache.get(gid);const g=ifc.GetGeometry(modelID,gid),verts=ifc.GetVertexArray(g.GetVertexData(),g.GetVertexDataSize()),indices=ifc.GetIndexArray(g.GetIndexData(),g.GetIndexDataSize());if(!verts.length||!indices.length){g.delete?.();return null;}
 const pos=new Float32Array(verts.length/2),norm=new Float32Array(verts.length/2);for(let i=0,j=0;i<verts.length;i+=6,j+=3){pos[j]=verts[i];pos[j+1]=verts[i+1];pos[j+2]=verts[i+2];norm[j]=verts[i+3];norm[j+1]=verts[i+4];norm[j+2]=verts[i+5];}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(norm,3));geo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices),1));cache.set(gid,geo);g.delete?.();return geo;}
function material(color,cache){const v=[color.x,color.y,color.z,color.w],key=v.map(n=>n.toFixed(3)).join('|');if(cache.has(key))return cache.get(key);const m=new THREE.MeshStandardMaterial({color:new THREE.Color(v[0],v[1],v[2]),roughness:.72,side:THREE.DoubleSide,transparent:v[3]<.995,opacity:v[3],depthWrite:v[3]>.7});allMats.add(m);cache.set(key,m);return m;}
async function load(){try{
 progress(5,'Baixando IFC...');const res=await fetch('./modelo.ifc',{cache:'no-store'});if(!res.ok)throw new Error('Não foi encontrado modelo.ifc (HTTP '+res.status+').');const bytes=new Uint8Array(await res.arrayBuffer());progress(34,'Inicializando geometria IFC...');
 ifc=new IfcAPI();ifc.SetWasmPath('https://unpkg.com/web-ifc@0.0.77/');await ifc.Init();modelID=ifc.OpenModel(bytes,{COORDINATE_TO_ORIGIN:true,USE_FAST_BOOLS:true});
 // Web-IFC usa Z vertical; neste modelo, o eixo vertical fica voltado para baixo no sistema Y-up do Three.js.
 root.rotation.x=Math.PI/2;
 try{const text=new TextDecoder().decode(bytes.slice(0,Math.min(bytes.length,1000000)));let m=text.match(/IFCSIUNIT\(\*,\.LENGTHUNIT\.,(\.MILLI\.|\.CENTI\.|\$),\.METRE\.\)/i);unit=m?({'.MILLI.':.001,'.CENTI.':.01,'$':1}[m[1].toUpperCase()]||1):1;}catch(e){}
 const geometryCache=new Map(),materials=new Map();let count=0;
 ifc.StreamAllMeshes(modelID,mesh=>{
  for(let i=0;i<mesh.geometries.size();i++){
   const shape=mesh.geometries.get(i),geo=geomFromIfc(shape.geometryExpressID,geometryCache);if(!geo)continue;
   const mat=material(shape.color,materials),obj=new THREE.Mesh(geo,mat);const mat4=new THREE.Matrix4().fromArray(shape.flatTransformation);obj.applyMatrix4(mat4);obj.userData.id=mesh.expressID;
   try{const ln=ifc.GetLine(modelID,mesh.expressID,false);obj.userData.type=plain(ln?.constructor?.name)||'Elemento IFC';}catch(e){}
   root.add(obj);meshes.push(obj);count++;
  }
 });
 progress(87,'Enquadrando '+count+' elementos...');root.updateMatrixWorld(true);modelBox=new THREE.Box3().setFromObject(root);if(modelBox.isEmpty())throw new Error('O IFC não contém geometria visualizável.');fit();$('meta').textContent=count.toLocaleString('pt-BR')+' objetos gráficos • IFC2X3 • Medições reais';
 $('loading').style.display='none';status('Modelo carregado');
 }catch(err){console.error(err);$('error').textContent='Erro: '+err.message+'\nConfira se o site foi publicado em HTTPS e se modelo.ifc está na mesma pasta.';status('Erro ao carregar');}}
$('fit').onclick=()=>fit();$('iso').onclick=()=>fit('iso');$('top').onclick=()=>fit('top');$('front').onclick=()=>fit('front');
$('identify').onclick=()=>changeMode('identify');$('measure').onclick=()=>changeMode('measure');$('cut').onclick=()=>{changeMode('cut');cutOn=true;setCut();};
$('closeInfo').onclick=()=>$('info').classList.remove('show');$('clearMeasure').onclick=clearMeasurements;
for(const b of document.querySelectorAll('[data-axis]'))b.onclick=()=>{cutAxis=b.dataset.axis;for(const el of document.querySelectorAll('[data-axis]'))el.classList.toggle('active',el===b);setCut();};
$('cutRange').oninput=setCut;$('cutInvert').onclick=()=>{cutInvert=!cutInvert;setCut();};$('cutClear').onclick=()=>{cutOn=false;setCut();$('cutPanel').classList.remove('show');changeMode('identify');};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
(function render(){requestAnimationFrame(render);orbit.update();for(const m of measurements){temp.copy(m.mid).project(camera);m.label.style.left=((temp.x+1)/2*innerWidth)+'px';m.label.style.top=((-temp.y+1)/2*innerHeight)+'px';m.label.style.display=temp.z>1?'none':'block';}renderer.render(scene,camera);})();
load();
