import * as T from 'three';
import { GLTFLoader } from './GLTFLoader.js';
import { OrbitControls } from './OrbitControls.js';
import { RoomEnvironment } from './RoomEnvironment.js';

const $=id=>document.getElementById(id),fa=n=>new Intl.NumberFormat('fa-IR').format(n);
const stage=$('stage'), scene=new T.Scene();
let renderer;
try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch(error){$('loading').innerHTML='<strong>نمایش سه‌بعدی در این مرورگر فعال نیست.</strong><small>WebGL را فعال کنید یا مرورگر دیگری باز کنید.</small>';$('status').textContent='WebGL در دسترس نیست';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,window.matchMedia('(max-width:760px)').matches?1.5:2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.localClippingEnabled=true;renderer.domElement.setAttribute('aria-label','مدل سه‌بعدی پمپ صنعتی؛ برای چرخش بکشید');stage.prepend(renderer.domElement);
const camera=new T.PerspectiveCamera(38,1,.005,100),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.075;controls.minDistance=.35;controls.maxDistance=4;controls.maxPolarAngle=Math.PI*.88;controls.autoRotateSpeed=.65;
const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
scene.add(new T.HemisphereLight(0xe6f6ff,0x71818a,2));const key=new T.DirectionalLight(0xfff4e1,3);key.position.set(-1.5,3,2);key.castShadow=true;key.shadow.mapSize.set(window.matchMedia('(max-width:760px)').matches?1024:2048,window.matchMedia('(max-width:760px)').matches?1024:2048);Object.assign(key.shadow.camera,{left:-1,right:1,top:1,bottom:-1,near:.1,far:8});key.shadow.bias=-.00015;key.shadow.normalBias=.001;key.shadow.radius=3;scene.add(key);const rim=new T.DirectionalLight(0x8ad8e8,1.4);rim.position.set(1.3,1.8,-2.4);scene.add(rim);const fill=new T.DirectionalLight(0xc7e6ff,1.8);fill.position.set(2,1,-1);scene.add(fill);
const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({color:0x163a4b,opacity:.17}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);const grid=new T.GridHelper(4,60,0x8cabbc,0xaec3cf);grid.material.transparent=true;grid.material.opacity=.105;grid.position.y=.0005;scene.add(grid);
const root=new T.Group();scene.add(root);
// Procedural contact occlusion strengthens depth without heavy post-processing on phones.
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;const shadowCtx=shadowCanvas.getContext('2d');const shadowGradient=shadowCtx.createRadialGradient(64,64,2,64,64,63);shadowGradient.addColorStop(0,'rgba(8,19,27,0.35)');shadowGradient.addColorStop(.35,'rgba(8,19,27,0.20)');shadowGradient.addColorStop(1,'rgba(8,19,27,0)');shadowCtx.fillStyle=shadowGradient;shadowCtx.fillRect(0,0,128,128);const contactMap=new T.CanvasTexture(shadowCanvas);const contactShadow=new T.Mesh(new T.PlaneGeometry(.8,.8),new T.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,opacity:.8}));contactShadow.rotation.x=-Math.PI/2;contactShadow.renderOrder=1;scene.add(contactShadow);const parts=[],shellParts=[];let selectedPart=null,isolation=false,rotorPart=null,rotorAngle=0,rotorPivot=new T.Vector3(),mountFrame=null,modelBounds=null,audioContext=null,audioGain=null,audioOscillators=[],audioEnabled=false;let modelCenter=new T.Vector3(0,.16,0),explodeCurrent=0,explodeTarget=0,playing=true,flowPhase=0,speed=1,last=performance.now(),background='studio',ready=false,responsiveFactor=.68;
const curve=new T.CatmullRomCurve3([new T.Vector3(0,.185,.435),new T.Vector3(0,.185,.31),new T.Vector3(0,.185,.235),new T.Vector3(0,.185,.187),new T.Vector3(-.049,.205,.187),new T.Vector3(-.042,.246,.187),new T.Vector3(.018,.275,.187),new T.Vector3(.073,.277,.187),new T.Vector3(.08,.335,.187),new T.Vector3(.08,.455,.187)],false,'centripetal');
const flowGroup=new T.Group();root.add(flowGroup);const pathMaterial=new T.MeshBasicMaterial({color:0x20a6bc,transparent:true,opacity:.17,depthTest:false,depthWrite:false});const tube=new T.Mesh(new T.TubeGeometry(curve,150,.0025,6,false),pathMaterial);tube.renderOrder=20;flowGroup.add(tube);
const particleCount=240;
const dots=new T.InstancedMesh(new T.SphereGeometry(.0032,7,5),new T.MeshBasicMaterial({color:0xff3028,transparent:true,opacity:.95,depthTest:false,depthWrite:false,toneMapped:false}),particleCount);dots.renderOrder=21;dots.frustumCulled=false;flowGroup.add(dots);const dummy=new T.Object3D();
const arrows=[];for(const [p,dir] of [[new T.Vector3(0,.185,.38),new T.Vector3(0,0,1)],[new T.Vector3(.08,.40,.187),new T.Vector3(0,-1,0)]]){const a=new T.ArrowHelper(dir,p,.033,0x00aeba,.013,.009);a.line.material.depthTest=false;a.cone.material.depthTest=false;a.line.material.depthWrite=false;a.cone.material.depthWrite=false;a.line.renderOrder=22;a.cone.renderOrder=22;flowGroup.add(a);arrows.push(a);}
function setShellColor(color){$('shellColor').value=color;$('colorValue').textContent=color.toUpperCase();shellParts.forEach(m=>m.material.color.set(color));document.querySelectorAll('[data-color]').forEach(b=>{const on=b.dataset.color===color.toLowerCase();b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});}
function setBackground(mode,color){background=mode;stage.classList.toggle('dark-mode',mode==='dark');document.querySelectorAll('[data-bg]').forEach(b=>b.classList.toggle('active',b.dataset.bg===mode));if(mode==='studio'){scene.background=null;stage.style.background='radial-gradient(ellipse at 50% 40%,#eff3f6,#cbd7df)';grid.material.color.set(0xb4cad7);ground.material.opacity=.17;}else{const hex=color||(mode==='dark'?'#182630':'#f2f4f5');scene.background=new T.Color(hex);$('backgroundColor').value=hex;stage.style.background=hex;grid.material.color.set(mode==='dark'?0x486474:0xa7bac6);ground.material.opacity=mode==='dark'?.32:.17;}}
function frame(view='perspective'){const directions={perspective:new T.Vector3(1.05,.65,1.05),front:new T.Vector3(0,.1,1.6),top:new T.Vector3(0,1.7,.001)};const size=stage.getBoundingClientRect(),portrait=size.width/size.height;responsiveFactor=portrait<1.2?1.08:.68;const d=directions[view].clone().multiplyScalar(responsiveFactor*(1+explodeTarget*.35));camera.position.copy(modelCenter).add(d);controls.target.copy(modelCenter);controls.update();$('viewName').textContent={perspective:'سه‌ربع',front:'روبرو',top:'بالا'}[view];document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));}
function updateCutaway(){
 parts.forEach(p=>{
  const mat=p.mesh.material;
  const cut=$('cutaway').checked&&((p.index>=9&&p.index<=19)||p.index===26);
  const faded=isolation&&selectedPart&&p!==selectedPart;
  p.mesh.visible=!faded;
  mat.transparent=cut&&p!==selectedPart;
  mat.opacity=mat.transparent?.14:1;
  mat.depthWrite=!mat.transparent;
  if(mat.emissive){mat.emissive.copy(p.originalEmissive);mat.emissiveIntensity=p.originalEmissiveIntensity;if(selectedPart===p){mat.emissive.set(0x18bba9);mat.emissiveIntensity=.28;}}
  mat.needsUpdate=true;
 });
}
function resize(){const rect=stage.getBoundingClientRect();if(!rect.width||!rect.height)return;const next=rect.width/rect.height<1.2?1.08:.68;if(next!==responsiveFactor){const delta=camera.position.clone().sub(controls.target).multiplyScalar(next/responsiveFactor);camera.position.copy(controls.target).add(delta);responsiveFactor=next;controls.update();}camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();renderer.setSize(rect.width,rect.height);}
new ResizeObserver(resize).observe(stage);
new GLTFLoader().load('./motor.glb',g=>{const box=new T.Box3().setFromObject(g.scene);modelCenter=box.getCenter(new T.Vector3());const floor=box.min.y-.003;ground.position.y=floor;grid.position.y=floor+.0005;const modelSize=box.getSize(new T.Vector3());contactShadow.scale.set(Math.max(.6,modelSize.x*1.6),Math.max(.7,modelSize.z*1.55),1);contactShadow.position.set(modelCenter.x,floor+.0015,modelCenter.z);
g.scene.traverse(mesh=>{if(!mesh.isMesh)return;const index=parseInt(mesh.name.slice(0,3),10);mesh.material=mesh.material.clone();mesh.material.roughness=Math.max(.32,Math.min(.72,mesh.material.roughness??.48));if(mesh.material.metalness!==undefined)mesh.material.metalness=Math.min(.78,Math.max(.05,mesh.material.metalness||.24));mesh.castShadow=true;mesh.receiveShadow=true;const b=new T.Box3().setFromObject(mesh),center=b.getCenter(new T.Vector3());const dir=center.clone().sub(modelCenter);if(dir.length()<.01)dir.set(.1,.1,.1);dir.normalize();let offset=dir.multiplyScalar(.10);if(index>=9&&index<=19){offset=new T.Vector3((center.x)*.2,Math.max(0,center.y-.185)*.4,.12+(index===10?.07:index===11?.13:index===12?.2:0));}else if(index===37){offset.set(0,.055,.065);}else if(index===42||index>=43&&index<=46){offset.set(.04,.20,0);}else if(index>=47){offset.z-=.13;offset.y+=.02;}parts.push({mesh,index,original:mesh.position.clone(),originalQuat:mesh.quaternion.clone(),offset,center:center.clone(),originalEmissive:mesh.material.emissive?mesh.material.emissive.clone():new T.Color(0),originalEmissiveIntensity:mesh.material.emissiveIntensity||1});if([9,10,11,20,23,26,94].includes(index))shellParts.push(mesh);});root.add(g.scene);modelBounds=new T.Box3().setFromObject(g.scene);createMountingFrame(modelBounds);initializeParts();setShellColor('#247b95');ready=true;$('partCount').textContent=parts.length;$('loading').hidden=true;$('status').textContent='مدل آماده است';frame();resize();},undefined,e=>{$('loading').innerHTML='<strong class="error">بارگذاری مدل انجام نشد</strong><small>صفحه را دوباره بارگذاری کنید.</small>';$('status').textContent='خطا در بارگذاری مدل';console.error(e);});
// On phones, one compact control group is shown at a time while the model remains visible.
const mobileControls=$('controlsPanel');
const mobileTabs=[...document.querySelectorAll('[data-mobile-panel]')];
function setMobilePanel(name){
 mobileControls.dataset.openPanel=name||'';
 mobileControls.classList.toggle('mobile-panel-open',Boolean(name));
 mobileTabs.forEach(button=>{
  const active=button.dataset.mobilePanel===name;
  button.classList.toggle('is-active',active);
  button.setAttribute('aria-expanded',String(active));
 });
 document.querySelectorAll('[data-panel-section]').forEach(section=>{
  section.classList.toggle('is-mobile-active',section.dataset.panelSection===name);
 });
}
mobileTabs.forEach(button=>button.addEventListener('click',()=>{
 setMobilePanel(mobileControls.dataset.openPanel===button.dataset.mobilePanel?'':button.dataset.mobilePanel);
}));
setMobilePanel('');


/* Industrial inspection tools: use actual GLB nodes and neutral identifiers where metadata is absent. */

const viewerModeButtons=[...document.querySelectorAll('[data-mode]')];
function setViewerMode(mode){
 viewerModeButtons.forEach(button=>{
  const active=button.dataset.mode===mode;
  button.classList.toggle('selected',active);
  button.setAttribute('aria-pressed',String(active));
 });
 if(mode==='showcase'){
  if(selectedPart)clearSelection();
  setAssemblyStep(0);
  $('autoRotate').checked=true;controls.autoRotate=true;
  setMobilePanel('');frame('perspective');
 }else{
  $('autoRotate').checked=false;controls.autoRotate=false;
  if(mode==='assembly'){setMobilePanel('assembly');if(Number($('assemblyStep').value)===0)setAssemblyStep(1);}
  if(mode==='inspection')setMobilePanel('shell');
 }
}
viewerModeButtons.forEach(button=>button.addEventListener('click',()=>setViewerMode(button.dataset.mode)));

const raycaster=new T.Raycaster(),pointer=new T.Vector2();
const sectionLabels={0:'مونتاژ کامل',1:'جداسازی پوسته',2:'بررسی اجزای داخلی',3:'جداسازی محرک',4:'نمای قطعات بازشده'};
const sectionNotes={0:'مجموعه در وضعیت بسته',1:'پوسته و پوشش‌ها به‌صورت نمایشی جدا می‌شوند',2:'گروه اجزای میانی برای بازرسی باز می‌شود',3:'مجموعه محرک و قطعات عقب جدا می‌شوند',4:'همه گروه‌ها در نمای انفجاری نمایش داده می‌شوند'};
function displayName(p){
 const raw=(p.mesh.name||'').trim(),number=Number.isFinite(p.index)?String(p.index).padStart(3,'0'):'—';
 const useful=raw&&!/^[0-9_.\s-]+$/.test(raw)?raw.replace(/_/g,' '):'قطعه';
 return useful+' · '+number;
}
function renderPartList(){
 const target=$('partsList');if(!target)return;
 const query=$('partsSearch').value.trim().toLocaleLowerCase();
 const filtered=parts.filter(p=>displayName(p).toLocaleLowerCase().includes(query)||String(p.index).includes(query));
 $('listCount').textContent=fa(filtered.length)+' / '+fa(parts.length);
 const list=document.createDocumentFragment();
 filtered.slice(0,150).forEach(p=>{
  const btn=document.createElement('button');btn.type='button';btn.className='part-list-item'+(selectedPart===p?' selected':'');btn.setAttribute('role','listitem');
  const tag=document.createElement('span');tag.className='part-dot';tag.textContent=p===rotorPart?'⟳':'◈';
  const label=document.createElement('span');label.textContent=displayName(p);
  btn.append(tag,label);btn.addEventListener('click',()=>selectPart(p,true));list.append(btn);
 });
 if(!filtered.length){const empty=document.createElement('span');empty.className='parts-placeholder';empty.textContent='قطعه‌ای پیدا نشد.';list.append(empty);}
 target.replaceChildren(list);
}
function updateSelectionUI(){
 const active=Boolean(selectedPart);
 $('pickHud').hidden=!active;
 $('selectionName').textContent=active?displayName(selectedPart):'یک قطعه از مدل انتخاب کنید';
 $('selectionMeta').textContent=active?'شماره قطعه از فایل سه‌بعدی خوانده شده است':'با لمس مدل یا انتخاب از فهرست';
 if(active){$('pickHudName').textContent=displayName(selectedPart);$('pickHudDesc').textContent=isolation?'نمایش تکی فعال است':'برای بررسی دقیق می‌توانید روی قطعه تمرکز کنید';}
 ['focusPart','isolatePart','clearPart','setRotor'].forEach(id=>$(id).disabled=!active);
 $('isolatePart').textContent=isolation?'بازگرداندن قطعات':'نمایش قطعه به‌تنهایی';
 $('hudIsolate').textContent=isolation?'نمایش همه':'نمایش تکی';
 renderPartList();updateCutaway();
}
function focusPart(){
 if(!selectedPart)return;
 const box=new T.Box3().setFromObject(selectedPart.mesh);if(box.isEmpty())return;
 const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
 const radius=Math.max(.035,size.length()*.5);
 const aspect=Math.max(.6,camera.aspect),halfFov=T.MathUtils.degToRad(camera.fov)*.5;
 const distance=Math.max(.12,radius/Math.sin(halfFov)*1.65/(Math.min(1,aspect)));
 const direction=camera.position.clone().sub(controls.target).normalize();
 controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,Math.min(controls.maxDistance,Math.max(controls.minDistance,distance)));controls.update();
}
function selectPart(p,focus=false){
 selectedPart=p||null;isolation=false;updateSelectionUI();
 if(selectedPart&&focus)focusPart();
 if(window.matchMedia('(max-width:760px)').matches&&selectedPart&&typeof setMobilePanel==='function')setMobilePanel('shell');
}
function toggleIsolate(){
 if(!selectedPart)return;isolation=!isolation;updateSelectionUI();
 if(isolation)focusPart();
}
function clearSelection(){selectedPart=null;isolation=false;updateSelectionUI();frame();}
function configureRotor(p){
 if(!p)return;
 rotorPart=p;rotorAngle=0;rotorPivot.copy(p.center);
 // The source file does not supply reliable engineering part names. Selection can be corrected interactively.
 $('rotorStatus').textContent='پروانه: '+displayName(p);
 $('setRotor').textContent=p===selectedPart?'پروانه انتخاب شد':'این قطعه پروانه است';
 renderPartList();
}
function initializeParts(){
 parts.sort((a,b)=>a.index-b.index);
 const named=parts.find(p=>/impeller|rotor|fan|پروانه/i.test(p.mesh.name));
 configureRotor(named||parts.find(p=>p.index===37)||null);
 renderPartList();updateSelectionUI();
}
function stageGroup(p){return p.index<=19?1:p.index<42?2:3;}
function setAssemblyStep(n){
 const step=T.MathUtils.clamp(Math.round(Number(n)||0),0,4);
 $('assemblyStep').value=step;$('assemblyStepValue').textContent=fa(step)+' از ۴';
 $('assemblyStepTitle').textContent=sectionLabels[step];$('assemblyStepText').textContent=sectionNotes[step];
 $('stepPrev').disabled=step===0;$('stepNext').disabled=step===4;
 $('explode').value=step*25;$('explode').dispatchEvent(new Event('input'));
 if(step>0){isolation=false;updateSelectionUI();}
}
function createMountingFrame(box){
 const frame=new T.Group(),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
 const width=Math.max(.24,size.x*1.16),depth=Math.max(.32,size.z*1.12),thickness=Math.max(.012,Math.min(width,depth)*.035);
 const y=box.min.y-.023;
 const metal=new T.MeshStandardMaterial({color:0x384b56,metalness:.76,roughness:.34});
 function bar(w,d,x,z){
  const mesh=new T.Mesh(new T.BoxGeometry(w,thickness,d),metal);
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;frame.add(mesh);
 }
 bar(width,thickness,center.x,center.z-depth/2);bar(width,thickness,center.x,center.z+depth/2);
 bar(thickness,depth,center.x-width/2,center.z);bar(thickness,depth,center.x+width/2,center.z);
 const boltMaterial=new T.MeshStandardMaterial({color:0xaabec6,metalness:.85,roughness:.27});
 for(const x of [center.x-width*.43,center.x+width*.43])for(const z of [center.z-depth*.43,center.z+depth*.43]){
  const bolt=new T.Mesh(new T.CylinderGeometry(thickness*.27,thickness*.27,thickness*.18,12),boltMaterial);
  bolt.position.set(x,y+thickness*.58,z);bolt.castShadow=true;frame.add(bolt);
 }
 frame.visible=false;scene.add(frame);mountFrame=frame;
}
function applyFrameSetting(){
 const enabled=$('mountingFrame').checked;
 if(mountFrame)mountFrame.visible=enabled;
 if(modelBounds){ground.position.y=modelBounds.min.y-(enabled?.045:.003);grid.position.y=ground.position.y+.0005;contactShadow.position.y=ground.position.y+.0015;}
}
const touchStart={x:0,y:0,down:false,multitouch:false};
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(!e.isPrimary){touchStart.multitouch=true;return;}touchStart.x=e.clientX;touchStart.y=e.clientY;touchStart.down=true;touchStart.multitouch=false;});
renderer.domElement.addEventListener('pointercancel',()=>{touchStart.down=false;touchStart.multitouch=false;});
renderer.domElement.addEventListener('pointerup',e=>{
 if(!touchStart.down||touchStart.multitouch||!e.isPrimary||!ready||Math.hypot(e.clientX-touchStart.x,e.clientY-touchStart.y)>7)return;
 touchStart.down=false;
 const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
 raycaster.setFromCamera(pointer,camera);
 const hits=raycaster.intersectObjects(parts.map(p=>p.mesh).filter(m=>m.visible),false);
 if(hits.length){const part=parts.find(p=>p.mesh===hits[0].object);if(part)selectPart(part,false);}
});
$('partsSearch').addEventListener('input',renderPartList);
$('focusPart').addEventListener('click',focusPart);
$('hudFocus').addEventListener('click',focusPart);
$('isolatePart').addEventListener('click',toggleIsolate);
$('hudIsolate').addEventListener('click',toggleIsolate);
$('clearPart').addEventListener('click',clearSelection);
$('hudClear').addEventListener('click',clearSelection);
$('setRotor').addEventListener('click',()=>{if(selectedPart)configureRotor(selectedPart);});
$('assemblyStep').addEventListener('input',e=>setAssemblyStep(e.target.value));
$('stepPrev').addEventListener('click',()=>setAssemblyStep(Number($('assemblyStep').value)-1));
$('stepNext').addEventListener('click',()=>setAssemblyStep(Number($('assemblyStep').value)+1));
$('mountingFrame').addEventListener('change',applyFrameSetting);
$('rotorSpin').addEventListener('change',updateRotorStatus);
function updateRotorStatus(){
 $('rotorPlayState').textContent=playing&&$('rotorSpin').checked&&rotorPart?'در حال چرخش':'متوقف';
}
function syncAudio(){
 if(!audioContext||!audioGain)return;
 const target=(audioEnabled&&playing)?0.035:0;
 audioGain.gain.setTargetAtTime(target,audioContext.currentTime,.065);
 for(const [i,osc] of audioOscillators.entries())osc.frequency.setTargetAtTime((i===0?72:144)*Math.max(.35,speed),audioContext.currentTime,.08);
 $('soundToggle').classList.toggle('is-active',audioEnabled);
 $('soundToggle').setAttribute('aria-pressed',String(audioEnabled));
 $('soundToggle').setAttribute('aria-label',audioEnabled?'قطع صدای موتور':'فعال کردن صدای موتور');
 $('soundToggle').querySelector('span').textContent=audioEnabled?'قطع صدا':'صدا';
}
$('soundToggle').addEventListener('click',async()=>{
 try{
  if(!audioContext){
   const AudioCtor=window.AudioContext||window.webkitAudioContext;
   if(!AudioCtor)throw Error('Web Audio API is not supported');
   audioContext=new AudioCtor();audioGain=audioContext.createGain();audioGain.gain.value=0;
   const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=340;filter.Q.value=.7;
   audioGain.connect(filter);filter.connect(audioContext.destination);
   for(const [wave,volume] of [['sawtooth',.22],['sine',.6]]){
    const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type=wave;gain.gain.value=volume;osc.connect(gain);gain.connect(audioGain);osc.start();audioOscillators.push(osc);
   }
  }
  await audioContext.resume();audioEnabled=!audioEnabled;syncAudio();
 }catch(error){console.warn('Motor sound unavailable:',error);$('soundToggle').title='صدا در این مرورگر قابل اجرا نیست';}
});
window.addEventListener('pagehide',()=>{if(audioContext)audioContext.close().catch(()=>{});});

document.querySelectorAll('[data-color]').forEach(b=>b.addEventListener('click',()=>setShellColor(b.dataset.color)));$('shellColor').addEventListener('input',e=>setShellColor(e.target.value));document.querySelectorAll('[data-bg]').forEach(b=>b.addEventListener('click',()=>setBackground(b.dataset.bg)));$('backgroundColor').addEventListener('input',e=>{setBackground('custom',e.target.value);stage.classList.toggle('dark-mode',new T.Color(e.target.value).getHSL({}).l<.3);});
$('light').addEventListener('input',()=>{renderer.toneMappingExposure=1.15*Number($('light').value)/100;$('lightValue').textContent=fa($('light').value)+'٪';});$('explode').addEventListener('input',()=>{const previous=1+explodeTarget*.35;explodeTarget=Number($('explode').value)/100;const delta=camera.position.clone().sub(controls.target).multiplyScalar((1+explodeTarget*.35)/previous);camera.position.copy(controls.target).add(delta);controls.update();$('explodeValue').textContent=fa($('explode').value)+'٪';});$('cutaway').addEventListener('change',updateCutaway);$('wireframe').addEventListener('change',()=>parts.forEach(p=>p.mesh.material.wireframe=$('wireframe').checked));
function syncPlay(){const active=playing&&$('flow').checked;$('play').textContent=active?'Ⅱ':'▶';$('play').setAttribute('aria-label',active?'توقف افکت جریان':'پخش افکت جریان');$('playState').textContent=!$('flow').checked?'نمایش جریان خاموش است':playing?'جریان در حال حرکت':'جریان متوقف است';document.body.classList.toggle('paused',!active);updateRotorStatus();syncAudio();}
$('flow').addEventListener('change',()=>{flowGroup.visible=$('flow').checked;syncPlay();});$('play').addEventListener('click',()=>{if(!$('flow').checked){$('flow').checked=true;flowGroup.visible=true;playing=true;}else playing=!playing;syncPlay();});$('flowSpeed').addEventListener('input',()=>{speed=Number($('flowSpeed').value)/100;$('flowSpeedValue').textContent=speed.toFixed(1)+'×';$('speedReadout').textContent=speed.toFixed(1)+'×';syncAudio();});document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>frame(b.dataset.view)));$('autoRotate').addEventListener('change',()=>controls.autoRotate=$('autoRotate').checked);$('resetCamera').addEventListener('click',()=>frame());$('zoomIn').addEventListener('click',()=>{const v=camera.position.clone().sub(controls.target);v.multiplyScalar(.84);camera.position.copy(controls.target).add(v);controls.update();});$('zoomOut').addEventListener('click',()=>{const v=camera.position.clone().sub(controls.target);v.multiplyScalar(1.18);camera.position.copy(controls.target).add(v);controls.update();});$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();}catch{$('status').textContent='تمام‌صفحه در این مرورگر پشتیبانی نمی‌شود';}});
$('resetAll').addEventListener('click',()=>{setShellColor('#247b95');setBackground('studio');$('backgroundColor').value='#dbe3e9';$('light').value=100;$('light').dispatchEvent(new Event('input'));$('explode').value=0;$('explode').dispatchEvent(new Event('input'));$('cutaway').checked=false;updateCutaway();$('wireframe').checked=false;$('wireframe').dispatchEvent(new Event('change'));$('flow').checked=true;flowGroup.visible=true;playing=true;syncPlay();$('flowSpeed').value=100;$('flowSpeed').dispatchEvent(new Event('input'));$('autoRotate').checked=false;controls.autoRotate=false;$('rotorSpin').checked=true;$('mountingFrame').checked=false;applyFrameSetting();setAssemblyStep(0);clearSelection();frame();syncAudio();});
setBackground('studio');setAssemblyStep(0);frame();resize();
renderer.setAnimationLoop(now=>{
 const dt=Math.max(0,Math.min((now-last)/1000,.05));last=now;controls.update();
 if(ready){
  explodeCurrent=T.MathUtils.damp(explodeCurrent,explodeTarget,7,dt);
  if(playing&&$('rotorSpin').checked&&rotorPart)rotorAngle=(rotorAngle+dt*5.5*speed)%(Math.PI*2);
  const spinQuat=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),rotorAngle);
  parts.forEach(p=>{
   const stepFactor=T.MathUtils.clamp(explodeCurrent*4-(stageGroup(p)-1),0,1);
   p.mesh.position.copy(p.original).addScaledVector(p.offset,stepFactor*1.65);
   p.mesh.quaternion.copy(p.originalQuat);
   if(p===rotorPart&&$('rotorSpin').checked){
    p.mesh.position.sub(rotorPivot).applyQuaternion(spinQuat).add(rotorPivot);
    p.mesh.quaternion.premultiply(spinQuat);
   }
  });
 }
 // The path is traversed in reverse relative to the original proof-of-concept.
 if(playing&&flowGroup.visible)flowPhase=(flowPhase+dt*.18*speed)%1;
 for(let i=0;i<particleCount;i++){
  const t=((i/particleCount-flowPhase)%1+1)%1,pos=curve.getPointAt(t);
  const spread=.006;pos.x+=Math.sin(i*2.399)*spread;pos.y+=Math.cos(i*2.399)*spread;
  dummy.position.copy(pos);dummy.scale.setScalar(.65+.35*(i%3)/2);dummy.updateMatrix();dots.setMatrixAt(i,dummy.matrix);
 }
 dots.instanceMatrix.needsUpdate=true;pathMaterial.opacity=.12+.035*Math.sin(now*.0015);
 renderer.render(scene,camera);
});
