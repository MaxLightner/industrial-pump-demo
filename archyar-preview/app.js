"use strict";
/* Archyar Stage-1 preview. Demonstration geometry only; no persistent project storage. */
(function () {
  const $ = (id) => document.getElementById(id);
  const scene = $("scene"), viewport = $("viewport"), context = $("contextTools");
  const P = { x: 240, y: 135, s: 60 };
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const round = (v, n = 2) => Number(v.toFixed(n));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const same = (a, b) => dist(a, b) < 0.0001;
  const fmt = (v) => Number(v).toLocaleString("fa-IR", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const coord = (p) => [P.x + p[0] * P.s, P.y + p[1] * P.s];
  const points = (vs) => vs.map((p) => p.map((x) => round(x)).join(",")).join(" ");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  let nextId = 1;
  function wall(a, b, height = 3.1, thickness = .2) {
    return { id: nextId++, a: a.slice(), b: b.slice(), h: height, auto: true, t: thickness, locked: false, material: "بلوک سفالی" };
  }
  function rect(x1, y1, x2, y2, h = 3.1) {
    return [wall([x1,y1],[x2,y1],h), wall([x2,y1],[x2,y2],h), wall([x2,y2],[x1,y2],h), wall([x1,y2],[x1,y1],h)];
  }
  let floors = [
    { name:"همکف", elevation:0, ceiling:3.1, walls:rect(1.8,1.6,10.4,7.8).concat([wall([6.6,1.6],[6.6,7.8])]) },
    { name:"اول", elevation:3.3, ceiling:3.1, walls:rect(2.2,2.1,10.7,7.9).concat([wall([6.1,2.1],[6.1,7.9])]) },
    { name:"دوم", elevation:6.6, ceiling:3, walls:rect(2.2,2.1,9.3,7.4,3).concat([wall([5.7,2.1],[5.7,7.4],3)]) }
  ];
  floors.forEach(f=>{f.layers={walls:true,rooms:true,mep:true};});
  const state = { floor:0, view:"plan", tool:"select", selected:null, snap:true, layers:{walls:true,rooms:true,mep:true}, start:null, cursor:null, measure:null, history:[], future:[], snapshots:[], revisions:[], modalAction:null };
  const current = () => floors[state.floor];
  const selected = () => current().walls.find((w) => w.id === state.selected);
  const len = (w) => dist(w.a,w.b);
  let toastTimeout;
  function toast(message) {
    $("toast").textContent=message; $("toast").classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout=setTimeout(() => $("toast").classList.remove("show"),2500);
  }
  function remember() {
    state.history.push(clone(floors));
    if (state.history.length > 70) state.history.shift();
    state.future=[];
  }
  function mutate(fn) {
    remember(); fn(); state.start=null; state.measure=null; render();
  }
  function undo() {
    if (!state.history.length) return;
    state.future.push(clone(floors));
    floors=state.history.pop(); state.selected=null; state.start=null; render(); toast("آخرین تغییر برگشت.");
  }
  function redo() {
    if (!state.future.length) return;
    state.history.push(clone(floors));
    floors=state.future.pop(); state.selected=null; state.start=null; render(); toast("تغییر دوباره اعمال شد.");
  }
  function toWorld(event) {
    const c=scene.createSVGPoint(); c.x=event.clientX; c.y=event.clientY;
    const m=scene.getScreenCTM();
    if (!m) return [0,0];
    const p=c.matrixTransform(m.inverse());
    return [(p.x-P.x)/P.s,(p.y-P.y)/P.s];
  }
  function foot(a,b,p) {
    const vx=b[0]-a[0],vy=b[1]-a[1],sq=vx*vx+vy*vy;
    const t=sq ? Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/sq)) : 0;
    return [a[0]+vx*t,a[1]+vy*t];
  }
  function snapped(p) {
    if (!state.snap) return p;
    let winner=null,best=16/P.s;
    current().walls.forEach((w) => [w.a,w.b].forEach((q) => {
      const d=dist(p,q);if (d<best){winner=q;best=d;}
    }));
    if(winner)return winner.slice();
    current().walls.forEach((w) => {
      const q=foot(w.a,w.b,p),d=dist(p,q);
      if(d<best){winner=q;best=d;}
    });
    if(winner)return winner.slice();
    return [Math.round(p[0]*4)/4,Math.round(p[1]*4)/4];
  }
  function segmentIntersection(a,b,c,d) {
    const rx=b[0]-a[0],ry=b[1]-a[1],sx=d[0]-c[0],sy=d[1]-c[1];
    const cross=rx*sy-ry*sx;
    if(Math.abs(cross)<1e-10) return null;
    const qx=c[0]-a[0],qy=c[1]-a[1];
    const t=(qx*sy-qy*sx)/cross,u=(qx*ry-qy*rx)/cross;
    if(t < -1e-8 || t > 1+1e-8 || u < -1e-8 || u > 1+1e-8) return null;
    return { point:[a[0]+t*rx,a[1]+t*ry],t,u };
  }
  /* Planar graph / half-edge face walk. Counts only closed bounded regions from wall axes. */
  function roomsFor(walls) {
    const cuts=walls.map((w)=>[{t:0,p:w.a},{t:1,p:w.b}]);
    for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
      const c=segmentIntersection(walls[i].a,walls[i].b,walls[j].a,walls[j].b);
      if(c){cuts[i].push({t:c.t,p:c.point});cuts[j].push({t:c.u,p:c.point});}
    }
    const nodes=new Map(),adj=new Map(),edgeKeys=new Set();
    const key=(p)=>round(p[0],5)+":"+round(p[1],5);
    function connect(a,b) {
      const ak=key(a),bk=key(b);
      if(ak===bk)return;
      const k=[ak,bk].sort().join("|");
      if(edgeKeys.has(k))return;
      edgeKeys.add(k);nodes.set(ak,a);nodes.set(bk,b);
      if(!adj.has(ak))adj.set(ak,new Set());
      if(!adj.has(bk))adj.set(bk,new Set());
      adj.get(ak).add(bk);adj.get(bk).add(ak);
    }
    cuts.forEach((arr)=>{
      arr.sort((a,b)=>a.t-b.t);
      for(let j=0;j<arr.length-1;j++)connect(arr[j].p,arr[j+1].p);
    });
    const sorted=new Map();
    for(const [k,neighbors] of adj){
      const a=nodes.get(k);
      sorted.set(k,[...neighbors].sort((p,q)=>{
        const b=nodes.get(p),c=nodes.get(q);
        return Math.atan2(b[1]-a[1],b[0]-a[0])-Math.atan2(c[1]-a[1],c[0]-a[0]);
      }));
    }
    const seen=new Set(),faces=[];
    for(const [a,neighbors] of sorted)for(const b of neighbors){
      if(seen.has(a+"|"+b))continue;
      const walk=[],local=new Set();let u=a,v=b,closed=false;
      for(let k=0;k<500;k++){
        const edge=u+"|"+v;
        if(local.has(edge)){closed=(u===a&&v===b);break;}
        local.add(edge);walk.push(nodes.get(u));
        const choices=sorted.get(v); if(!choices)break;
        const i=choices.indexOf(u);if(i===-1)break;
        const n=choices[(i-1+choices.length)%choices.length];
        u=v;v=n;
      }
      for(const k of local)seen.add(k);
      if(!closed||walk.length<3)continue;
      let a2=0,cx=0,cy=0;
      for(let k=0;k<walk.length;k++){
        const p=walk[k],q=walk[(k+1)%walk.length],cross=p[0]*q[1]-q[0]*p[1];
        a2+=cross;cx+=(p[0]+q[0])*cross;cy+=(p[1]+q[1])*cross;
      }
      if(a2>0.001){faces.push({poly:walk,area:a2/2,center:[cx/(3*a2),cy/(3*a2)]});}
    }
    return faces;
  }
  function floorMetrics() {
    const ws=current().walls;
    const rooms=roomsFor(ws);
    return { rooms, area:rooms.reduce((s,r)=>s+r.area,0),length:ws.reduce((s,w)=>s+len(w),0),volume:ws.reduce((s,w)=>s+len(w)*w.t*w.h,0),surface:ws.reduce((s,w)=>s+2*len(w)*w.h,0) };
  }
  function lineSvg(w) {
    const a=coord(w.a),b=coord(w.b),stroke=Math.max(4,w.t*P.s);
    const chosen=state.selected===w.id, lockColor=w.locked?"#a6b3c0":"#54798e";
    return '<g data-wall="'+w.id+'"><line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#fff" stroke-width="'+(stroke+3)+'" stroke-linecap="square" pointer-events="none"/>'+
      '<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="'+(chosen?"#169ed1":lockColor)+'" stroke-width="'+stroke+'" stroke-linecap="square" pointer-events="none"/>'+
      (chosen?'<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#d4f6ff" stroke-width="2" stroke-dasharray="8 7" pointer-events="none"/>':'')+
      '<line data-wall="'+w.id+'" x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="transparent" stroke-width="'+Math.max(22,stroke+8)+'" stroke-linecap="round" />'+
      (chosen?'<circle cx="'+a[0]+'" cy="'+a[1]+'" r="6" fill="#fff" stroke="#169ed1" stroke-width="3" pointer-events="none"/><circle cx="'+b[0]+'" cy="'+b[1]+'" r="6" fill="#fff" stroke="#169ed1" stroke-width="3" pointer-events="none"/>':'')+
      (w.locked?'<text x="'+(a[0]+b[0])/2+'" y="'+((a[1]+b[1])/2-13)+'" text-anchor="middle" fill="#7e8c9b" font-size="15" pointer-events="none">♙</text>':'')+'</g>';
  }
  function drawPlan(m) {
    let html='<g>';
    if(state.layers.rooms) m.rooms.forEach((r,i)=>{
      html+='<polygon points="'+points(r.poly.map(coord))+'" fill="'+(i%2?"#e3eff1":"#e8f5f2")+'" fill-opacity=".8" stroke="none"/>';
      const c=coord(r.center);
      html+='<text class="room-label" x="'+c[0]+'" y="'+(c[1]-7)+'">فضای '+fmt(i+1)+'</text><text class="room-label room-area" x="'+c[0]+'" y="'+(c[1]+12)+'">'+fmt(r.area)+' m²</text>';
    });
    if(state.layers.mep)html+='<polyline points="'+points([[3,3.25],[4.6,3.25],[4.6,5.6],[5.5,5.6]].map(coord))+'" fill="none" stroke="#eb925c" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="11 7" opacity=".8"/><text x="435" y="328" fill="#cb895f" font-size="11">تأسیسات نمونه</text>';
    if(state.layers.walls)current().walls.forEach((w)=>html+=lineSvg(w));
    if(state.tool==="wall"&&state.start&&state.cursor){
      const a=coord(state.start),b=coord(state.cursor),l=dist(state.start,state.cursor);
      html+='<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#16a799" stroke-width="13" opacity=".5" stroke-dasharray="9 7"/><circle cx="'+a[0]+'" cy="'+a[1]+'" r="7" fill="#fff" stroke="#16a799" stroke-width="3"/><circle cx="'+b[0]+'" cy="'+b[1]+'" r="5" fill="#16a799"/><text class="dim-label" x="'+((a[0]+b[0])/2)+'" y="'+((a[1]+b[1])/2-15)+'" text-anchor="middle">'+fmt(l)+' m</text>';
    }
    if(state.tool==="measure"&&state.start&&state.cursor){
      const a=coord(state.start),b=coord(state.cursor);
      html+='<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#db9041" stroke-width="2" stroke-dasharray="5 4"/><text class="dim-label" x="'+(a[0]+b[0])/2+'" y="'+((a[1]+b[1])/2-10)+'" text-anchor="middle">'+fmt(dist(state.start,state.cursor))+' m</text>';
    }
    if(state.measure){
      const a=coord(state.measure.a),b=coord(state.measure.b);
      html+='<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#df9145" stroke-width="2"/><text class="dim-label" x="'+(a[0]+b[0])/2+'" y="'+((a[1]+b[1])/2-15)+'" text-anchor="middle">'+fmt(dist(state.measure.a,state.measure.b))+' m</text>';
    }
    html+='</g>';return html;
  }
  function iso(p,z=0) {return [600+(p[0]-p[1])*44,125+(p[0]+p[1])*21-z*43];}
  function prism(w) {
    const dx=w.b[0]-w.a[0],dy=w.b[1]-w.a[1],length=Math.hypot(dx,dy)||1;
    const n=[-dy*w.t/(2*length),dx*w.t/(2*length)];
    const a=[w.a[0]+n[0],w.a[1]+n[1]],b=[w.b[0]+n[0],w.b[1]+n[1]];
    const c=[w.b[0]-n[0],w.b[1]-n[1]],d=[w.a[0]-n[0],w.a[1]-n[1]];
    const s=(arr)=>points(arr.map((p)=>iso(p[0],p[1])));
    const s3=(arr,z)=>points(arr.map((p)=>iso(p,z)));
    return '<polygon points="'+points([iso(d),iso(c),iso(c,w.h),iso(d,w.h)])+'" fill="#83a5b5" stroke="#6d8c9f" stroke-width="1"/>'+
      '<polygon points="'+points([iso(a),iso(b),iso(b,w.h),iso(a,w.h)])+'" fill="'+(w.locked?"#afbcc4":"#a6bfca")+'" stroke="#7194a5" stroke-width="1"/>'+
      '<polygon points="'+s3([a,b,c,d],w.h)+'" fill="'+(state.selected===w.id?"#29afce":"#d5e6eb")+'" stroke="#7296a7" stroke-width="1.5"/>';
  }
  function drawIso(m) {
    let html='<g><polygon points="140,185 720,90 1110,400 490,680" fill="#e8eef0" fill-opacity=".38"/>';
    if(state.layers.rooms)m.rooms.forEach((r,i)=>html+='<polygon points="'+points(r.poly.map((p)=>iso(p,0)))+'" fill="'+(i%2?"#d9eee8":"#e5f0ec")+'" stroke="#b7d5d0" stroke-width="1" opacity=".95"/>');
    if(state.layers.mep)html+='<polyline points="'+points([[3,3.25],[4.6,3.25],[4.6,5.6],[5.5,5.6]].map((p)=>iso(p,.1)))+'" fill="none" stroke="#e99c6e" stroke-width="5" stroke-dasharray="8 5"/>';
    if(state.layers.walls)current().walls.slice().sort((a,b)=>((a.a[0]+a.b[0]+a.a[1]+a.b[1])-(b.a[0]+b.b[0]+b.a[1]+b.b[1]))).forEach((w)=>html+=prism(w));
    html+='</g>';return html;
  }
  function renderFloorList(){
    $("floorList").innerHTML=floors.map((f,i)=>'<button class="floor-item '+(state.floor===i?"selected":"")+'" data-floor="'+i+'"><span>▱</span><span>طبقه '+f.name+'</span><span class="floor-num">'+(f.elevation>=0?"+":"")+fmt(f.elevation)+' m</span></button>').join("");
  }
  function renderProperties(m) {
    const w=selected(),box=$("propertiesContent");
    if(!w){
      box.innerHTML='<div class="prop-empty"><span class="empty-symbol">⌗</span><strong style="color:#607789">هیچ دیواری انتخاب نشده است</strong><span>یک دیوار را انتخاب کنید تا طول، ارتفاع، ضخامت، قفل و آفست آن را تنظیم کنید.</span><div class="notice">ترسیم دیوار با دو نقطه انجام می‌شود؛ برای شروع نیاز به واردکردن طول نیست.</div></div>';
      return;
    }
    box.innerHTML='<div class="prop-head"><span class="prop-icon">▥</span><div><strong>دیوار '+fmt(w.id)+'</strong><small>'+(w.locked?"قفل شده · فقط مشاهده":"قابل ویرایش · طبقه "+current().name)+'</small></div></div>'+
      '<div class="prop-group"><div class="prop-title">ابعاد هندسی <small style="color:#9aa7b5">متر</small></div>'+
      fieldHtml("طول","length",len(w),w.locked)+fieldHtml("ضخامت","t",w.t,w.locked)+fieldHtml("ارتفاع","h",w.auto?current().ceiling:w.h,w.locked||w.auto)+
      '<label class="toggle-small"><input id="autoHeight" type="checkbox" '+(w.auto?"checked ":"")+(w.locked?"disabled":"")+'> اتصال ارتفاع به سقف طبقه ('+fmt(current().ceiling)+' متر)</label></div>'+
      '<div class="prop-group"><div class="prop-title">مشخصات اجرایی</div><div class="material-swatch"><div class="swatch"></div><div><strong>'+esc(w.material)+'</strong><small>متریال نمونه؛ نرخ و مقدار خرید تعریف نشده است</small></div></div></div>'+
      '<div class="prop-group"><div class="prop-title">ویرایش</div><div class="two-col"><button class="cta secondary" data-action="offset" '+(w.locked?"disabled":"")+'>⇆ آفست</button><button class="cta ghost" data-action="lock">'+(w.locked?"بازکردن قفل":"قفل دیوار")+'</button></div><div class="two-col" style="margin-top:9px"><button class="cta ghost" style="flex:1;color:#b5535b" data-action="delete" '+(w.locked?"disabled":"")+'>حذف دیوار</button></div></div>'+
      '<div class="notice">طول و حجم دیوار از هندسه مدل محاسبه می‌شود. این پیش‌نمایش متره اجراییِ تأییدشده نیست.</div>';
  }
  function fieldHtml(label,key,value,disabled) {
    return '<div class="value-row"><label>'+label+'</label><div class="field"><input type="number" min="0.05" step="0.01" data-field="'+key+'" value="'+round(value,3)+'" '+(disabled?"disabled":"")+'><span>m</span></div></div>';
  }
  function placeContext() {
    const w=selected();
    if(!w||state.view!=="plan"||!state.layers.walls){context.classList.remove("show");return;}
    const at=coord([(w.a[0]+w.b[0])/2,(w.a[1]+w.b[1])/2]);
    const p=scene.createSVGPoint();p.x=at[0];p.y=at[1];
    const matrix=scene.getScreenCTM();if(!matrix){context.classList.remove("show");return;}
    const screen=p.matrixTransform(matrix),r=viewport.getBoundingClientRect();
    context.style.left=Math.max(10,Math.min(r.width-50,screen.x-r.left+25))+"px";
    context.style.top=Math.max(68,Math.min(r.height-200,screen.y-r.top-70))+"px";
    context.classList.add("show");
  }
  function render(){
    const m=floorMetrics();
    renderFloorList();renderProperties(m);
    $("scene").innerHTML=state.view==="plan"?drawPlan(m):state.view==="iso"?drawIso(m):"";
    $("scene").style.display=state.view==="ar"?"none":"block";
    $("gridBackground").style.display=state.view==="plan"?"block":"none";
    $("viewport").style.background=state.view==="iso"?"linear-gradient(145deg,#e7eef1,#f8fafb)":"#eef4f7";
    $("arPanel").classList.toggle("visible",state.view==="ar");
    $("floorTag").textContent="طبقه "+current().name+" · +"+fmt(current().elevation)+" متر";
    $("crumbFloor").textContent="طبقه "+current().name;
    $("viewDescription").textContent=state.view==="plan"?"ترسیم پلان در ابعاد نمونه":state.view==="iso"?"تجسم حجمی بر اساس هندسه نمونه":"پوسته نمایشی AR";
    $("statsArea").textContent=m.rooms.length?fmt(m.area):"—";
    $("statsWall").textContent=fmt(m.length);
    $("wallCount").textContent=fmt(current().walls.length);
    $("roomCount").textContent=fmt(m.rooms.length);
    $("layerWalls").checked=state.layers.walls;
    $("layerRooms").checked=state.layers.rooms;
    $("layerMep").checked=state.layers.mep;
    $("snapBtn").style.color=state.snap?"#129c92":"#b0bcc6";
    $("statusSnap").textContent="اسنپ: "+(state.snap?"فعال":"خاموش");
    $("statusTool").textContent="ابزار: "+({select:"انتخاب",wall:"دیوار",offset:"آفست",measure:"اندازه",quantities:"متره"}[state.tool]||state.tool);
    $("undoBtn").disabled=!state.history.length;$("redoBtn").disabled=!state.future.length;
    document.querySelectorAll("[data-view]").forEach((b)=>b.classList.toggle("active",b.dataset.view===state.view));
    document.querySelectorAll("[data-tool]").forEach((b)=>b.classList.toggle("active",b.dataset.tool===state.tool));
    scene.classList.toggle("drawing",state.tool==="wall"||state.tool==="measure");
    $("properties").classList.toggle("open",Boolean(selected())&&window.innerWidth<=830);
    placeContext();
  }
  function selectWall(id){state.selected=id;state.start=null;render();}
  function activateTool(tool){
    if(tool==="snapshot"){createSnapshot();return;}
    if(tool==="quantities"){showQuantities();return;}
    if(state.view!=="plan"){state.view="plan";toast("ابزارهای هندسی در نمای ۲بعدی فعال‌اند.");}
    state.tool=tool;state.start=null;state.cursor=null;
    if(tool==="offset"&&!selected())toast("برای آفست ابتدا یک دیوار انتخاب کنید.");
    else if(tool==="offset"&&selected())showOffset();
    render();
  }
  function sceneClick(e){
    if(state.view!=="plan")return;
    const clicked=e.target.closest("[data-wall]");
    const id=clicked?Number(clicked.dataset.wall):null;
    if(state.tool==="select"){
      state.selected=id;render();return;
    }
    if(state.tool==="offset"){
      if(id){state.selected=id;render();showOffset();}
      else toast("یک دیوار را برای آفست انتخاب کنید.");
      return;
    }
    if(state.tool==="wall"||state.tool==="measure"){
      const p=snapped(toWorld(e));
      if(!state.start){state.start=p;state.cursor=p;render();return;}
      if(dist(p,state.start)<.08){toast("نقطه پایان باید با شروع فاصله داشته باشد.");return;}
      const a=state.start.slice(),b=p.slice(),tool=state.tool;
      if(tool==="wall"){
        mutate(()=>{const w=wall(a,b,current().ceiling);current().walls.push(w);state.selected=w.id;});
        toast("دیوار ساخته شد؛ طول و ضخامت را می‌توانید تغییر دهید.");
      }else{state.measure={a,b};state.start=null;state.cursor=null;render();toast("طول اندازه‌گیری‌شده: "+fmt(dist(a,b))+" متر (نمونه)");}
    }
  }
  function pointerMove(e){
    if(!state.start||state.view!=="plan")return;
    state.cursor=snapped(toWorld(e));
    const m=floorMetrics();scene.innerHTML=drawPlan(m);placeContext();
  }
  function editField(key,value){
    const w=selected();if(!w||w.locked)return;
    const v=Number(value);
    if(!Number.isFinite(v)||v<=0){toast("مقدار باید عددی مثبت باشد.");render();return;}
    if(key==="length"){
      if(v>50){toast("در پیش‌نمایش طول بیش از ۵۰ متر مجاز نیست.");render();return;}
      const old=w.b.slice(),l=len(w);if(l<1e-5)return;
      const next=[w.a[0]+(w.b[0]-w.a[0])*v/l,w.a[1]+(w.b[1]-w.a[1])*v/l];
      mutate(()=>current().walls.forEach((other)=>{
        if(other.id===w.id){other.b=next.slice();return;}
        if(same(other.a,old)&&!other.locked)other.a=next.slice();
        if(same(other.b,old)&&!other.locked)other.b=next.slice();
      }));
    }else if(key==="t"||key==="h"){
      if(v>10){toast("این مقدار برای پیش‌نمایش خارج از محدوده است.");render();return;}
      mutate(()=>{w[key]=v;if(key==="h")w.auto=false;});
    }
  }
  function lockSelected() {const w=selected();if(!w)return;mutate(()=>{w.locked=!w.locked;});toast(w.locked?"دیوار قفل شد.":"قفل دیوار باز شد.");}
  function deleteSelected(){
    const w=selected();if(!w||w.locked)return;
    mutate(()=>{current().walls=current().walls.filter((x)=>x.id!==w.id);state.selected=null;});
    toast("دیوار حذف شد.");
  }
  function modal(title,body,button,onConfirm){
    $("modalTitle").textContent=title;$("modalBody").innerHTML=body;
    $("modalPrimary").textContent=button||"تأیید";
    $("modalPrimary").style.display=onConfirm?"":"none";
    state.modalAction=onConfirm||null;$("modalBackdrop").classList.add("open");
  }
  function closeModal(){$("modalBackdrop").classList.remove("open");state.modalAction=null;}
  function showOffset(){
    const w=selected();if(!w)return;
    if(w.locked){toast("برای آفست ابتدا قفل دیوار را باز کنید.");return;}
    modal("آفست دیوار",'<p>یک دیوار موازی در سمت انتخاب‌شده ایجاد می‌شود. فاصله بر حسب متر از محور دیوار مبناست.</p><div class="value-row"><label>فاصله</label><div class="field"><input id="offsetValue" type="number" min="0.05" max="5" step="0.05" value="0.30"><span>m</span></div></div><div class="two-col"><button class="choice active" id="sidePositive" type="button">سمت اول</button><button class="choice" id="sideNegative" type="button">سمت مقابل</button></div>','ایجاد آفست',()=>{
      const d=Number($("offsetValue").value);
      if(!Number.isFinite(d)||d<.05||d>5){toast("فاصله آفست باید بین ۰٫۰۵ و ۵ متر باشد.");return false;}
      const positive=$("sidePositive").classList.contains("active")?1:-1;
      const dx=w.b[0]-w.a[0],dy=w.b[1]-w.a[1],l=len(w);
      if(l<1e-5)return false;
      const offset=[-dy/l*d*positive,dx/l*d*positive];
      mutate(()=>{const n=wall([w.a[0]+offset[0],w.a[1]+offset[1]],[w.b[0]+offset[0],w.b[1]+offset[1]],w.h,w.t);n.auto=w.auto;n.material=w.material;current().walls.push(n);state.selected=n.id;});
      toast("دیوار موازی با فاصله "+fmt(d)+" متر ایجاد شد.");return true;
    });
    $("sidePositive").onclick=()=>{$("sidePositive").classList.add("active");$("sideNegative").classList.remove("active");};
    $("sideNegative").onclick=()=>{$("sideNegative").classList.add("active");$("sidePositive").classList.remove("active");};
  }
  function showQuantities(){
    const m=floorMetrics();const rows=[
      ["تعداد دیوار",fmt(current().walls.length)+" عدد"],
      ["طول محور دیوارها",fmt(m.length)+" متر"],
      ["سطح ناخالص دو وجه دیوار",fmt(m.surface)+" متر مربع"],
      ["حجم ساده دیوار بدون کسر تقاطع",fmt(m.volume)+" متر مکعب"],
      ["تعداد فضاهای بسته",fmt(m.rooms.length)+" فضا"],
      ["مجموع مساحت بر اساس محور دیوار",m.rooms.length?fmt(m.area)+" متر مربع":"قابل محاسبه نیست"]
    ];
    modal("متره اولیه · طبقه "+current().name,'<p>مقادیر زیر فقط از هندسه ثبت‌شده محاسبه شده‌اند. ضخامت دیوارها، بازشوها، تقاطع‌ها و ضوابط خالص‌سازی مساحت در این نمایش لحاظ نشده‌اند.</p>'+rows.map((r)=>'<div class="metric"><span>'+r[0]+'</span><strong>'+r[1]+'</strong></div>').join("")+'<div class="notice" style="margin-top:17px">این محاسبات برای برآورد اجرایی، سفارش مصالح یا تأیید اندازه‌گیری میدانی مناسب نیستند.</div>',null,null);
  }
  function createSnapshot(){
    const label="Snapshot "+fmt(state.snapshots.length+1);
    state.snapshots.push({label,date:new Date().toLocaleString("fa-IR"),data:clone(floors)});
    toast("نقطه بازگشت موقت ساخته شد: "+label);
  }
  function saveRevision(){
    const txt=$("revisionName");const name=txt?txt.value.trim():"";
    if(!name){toast("برای Revision عنوان وارد کنید.");return false;}
    state.revisions.push({label:name.slice(0,60),date:new Date().toLocaleString("fa-IR"),data:clone(floors)});
    toast("نسخه موقت ثبت شد.");return true;
  }
  function showVersions(){
    const entries=[...state.revisions.map((r,i)=>({r,i,type:"Revision"})),...state.snapshots.map((r,i)=>({r,i,type:"Snapshot"}))].reverse();
    modal("نسخه‌ها و نقاط بازگشت",'<p>Undo و Redo فرمان‌های اخیر را بازمی‌گردانند. Snapshot و Revision فقط تا زمانی که این صفحه باز است نگه داشته می‌شوند؛ پس از بارگذاری مجدد حذف می‌شوند.</p><div class="value-row"><label>نام نسخه</label><input id="revisionName" type="text" maxlength="60" placeholder="مثلاً اصلاح دیوارهای طبقه همکف" style="flex:1"></div><button class="cta secondary" id="saveRevisionBtn" style="width:100%;margin-top:7px">ثبت Revision موقت</button><div style="margin-top:15px">'+(entries.length?entries.map((e)=>'<div class="modal-item"><div><strong>'+esc(e.r.label)+'</strong><small>'+e.type+' · '+esc(e.r.date)+'</small></div><button class="cta ghost" data-restore="'+e.type+':'+e.i+'">بازیابی</button></div>').join(""):'<div class="notice">هنوز نسخه‌ای ثبت نشده است.</div>')+'</div>',null,null);
    $("saveRevisionBtn").onclick=()=>{if(saveRevision())showVersions();};
    document.querySelectorAll("[data-restore]").forEach((b)=>b.onclick=()=>{
      const pair=b.dataset.restore.split(":"),entry=(pair[0]==="Revision"?state.revisions:state.snapshots)[Number(pair[1])];
      modal("بازیابی "+entry.label,'<p>وضعیت فعلی به عنوان یک مرحله قابل Undo باقی می‌ماند. می‌خواهید این نسخه را در جلسه فعلی بازیابی کنید؟</p>','بازیابی',()=>{
        mutate(()=>{floors=clone(entry.data);state.selected=null;});
        toast("نسخه بازیابی شد.");return true;
      });
    });
  }
  function switchFloor(i){current().layers=clone(state.layers);state.floor=i;state.layers=clone(current().layers||{walls:true,rooms:true,mep:true});state.selected=null;state.start=null;state.measure=null;state.tool="select";render();}
  function switchView(view){state.view=view;state.start=null;state.cursor=null;state.selected=null;state.tool="select";render();}
  function simpleModal(title,description){modal(title,'<p>'+description+'</p><div class="notice">این بخش هنوز در پیش‌نمایش پیاده‌سازی نشده و عملکرد واقعی Android / AR ندارد.</div>',null,null);}
  function help(){
    modal("راهنمای نسخه پیش‌نمایش",'<div class="metric"><span>ترسیم دیوار</span><strong>دیوار ← نقطه شروع ← نقطه پایان</strong></div><div class="metric"><span>ویرایش</span><strong>انتخاب یک دیوار ← مشخصات سمت چپ</strong></div><div class="metric"><span>اتصال به دیوار</span><strong>اسنپ به انتها یا میانه</strong></div><div class="metric"><span>آفست</span><strong>انتخاب دیوار ← آفست</strong></div><div class="metric"><span>بازگشت</span><strong>Ctrl+Z / Ctrl+Y</strong></div><div class="metric"><span>لغو ترسیم</span><strong>Esc</strong></div><div class="notice" style="margin-top:16px">در این نسخه هیچ ذخیره ماندگار، سرور، مدل AR، دوربین یا اندازه‌گیری واقعی فعال نیست.</div>',null,null);
  }
  $("scene").addEventListener("pointerdown",sceneClick);
  $("scene").addEventListener("pointermove",pointerMove);
  $("scene").addEventListener("contextmenu",(e)=>{e.preventDefault();state.start=null;state.cursor=null;render();});
  $("tools").addEventListener("click",(e)=>{const b=e.target.closest("[data-tool]");if(b)activateTool(b.dataset.tool);});
  document.querySelectorAll("[data-view]").forEach((b)=>b.onclick=()=>switchView(b.dataset.view));
  $("floorList").addEventListener("click",(e)=>{const b=e.target.closest("[data-floor]");if(b)switchFloor(Number(b.dataset.floor));});
  $("propertiesContent").addEventListener("change",(e)=>{
    const f=e.target.dataset.field;
    if(f)editField(f,e.target.value);
    if(e.target.id==="autoHeight"){
      const w=selected();if(!w||w.locked)return;
      const on=e.target.checked;mutate(()=>{w.auto=on;if(on)w.h=current().ceiling;});
    }
  });
  $("propertiesContent").addEventListener("click",(e)=>{
    const b=e.target.closest("[data-action]");if(!b)return;
    if(b.dataset.action==="offset")showOffset();
    if(b.dataset.action==="lock")lockSelected();
    if(b.dataset.action==="delete")deleteSelected();
  });
  context.addEventListener("click",(e)=>{
    const b=e.target.closest("[data-context]");if(!b)return;
    if(b.dataset.context==="properties"){$("properties").classList.add("open");toast("مشخصات دیوار در پنل ویرایش نمایش داده شد.");}
    if(b.dataset.context==="lock")lockSelected();
    if(b.dataset.context==="offset")showOffset();
    if(b.dataset.context==="delete")deleteSelected();
  });
  $("undoBtn").onclick=undo;$("redoBtn").onclick=redo;$("openRevisions").onclick=showVersions;
  $("helpBtn").onclick=help;$("roomsBtn").onclick=showQuantities;
  $("snapBtn").onclick=()=>{state.snap=!state.snap;render();toast("اسنپ "+(state.snap?"روشن":"خاموش")+" شد.");};
  $("fitBtn").onclick=()=>{state.start=null;state.cursor=null;state.tool="select";state.selected=null;render();toast("نما به وضعیت اولیه بازگشت.");};
  $("layerWalls").onchange=(e)=>{state.layers.walls=e.target.checked;render();};
  $("layerRooms").onchange=(e)=>{state.layers.rooms=e.target.checked;render();};
  $("layerMep").onchange=(e)=>{state.layers.mep=e.target.checked;render();};
  $("pdfBtn").onclick=()=>simpleModal("نقشه مرجع PDF","بارگذاری PDF و تنظیم مبنای مقیاس در نسخه بعد طراحی می‌شود. نقشه‌ای در پروژه نمونه متصل نیست.");
  $("galleryBtn").onclick=()=>simpleModal("گالری پروژه","بخش ثبت عکس، موقعیت و تاریخچه اجرایی در گام‌های بعد ارائه خواهد شد.");
  $("markerDemo").onclick=()=>simpleModal("جریان مارکر ثابت","چاپ مارکر با هویت ثابت، اندازه فیزیکی مشخص و خط‌کش کنترل چاپ در اپ بومی بررسی می‌شود.");
  $("executionDemo").onclick=()=>simpleModal("ابزارهای اجرای واقعی","گونیا، اندازه‌گیری زاویه واقعی و شاقول به داده سنسورها و تست روی دستگاه نیاز دارند؛ هیچ عددی در این پیش‌نمایش به‌عنوان اندازه واقعی نمایش داده نمی‌شود.");
  $("modalClose").onclick=closeModal;
  $("modalPrimary").onclick=()=>{if(!state.modalAction)return;const close=state.modalAction();if(close!==false)closeModal();};
  $("modalBackdrop").addEventListener("pointerdown",(e)=>{if(e.target===$("modalBackdrop"))closeModal();});
  $("closeProps").onclick=()=>{$("properties").classList.remove("open");state.selected=null;render();};
  $("mobileNav").onclick=()=>{$("sidebar").classList.toggle("open");};
  $("sidebar").addEventListener("click",(e)=>{if(e.target.closest("[data-floor]")&&window.innerWidth<600)$("sidebar").classList.remove("open");});
  document.addEventListener("keydown",(e)=>{
    const editing=["INPUT","TEXTAREA"].includes(document.activeElement.tagName);
    if(e.key==="Escape"){if($("modalBackdrop").classList.contains("open"))closeModal();else{state.start=null;state.cursor=null;state.tool="select";render();}return;}
    if(editing)return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();if(e.shiftKey)redo();else undo();}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo();}
    if(e.key==="Delete"&&selected()&&!selected().locked)deleteSelected();
  });
  window.addEventListener("resize",placeContext);
  const initialDemo = clone(floors);
  /* Session-only bridge for home, project and floor screens.
     No persistence, authentication or network calls. */
  window.ArchyarPreview = Object.freeze({
    exportSession:()=>clone({floors,history:state.history,future:state.future,snapshots:state.snapshots,revisions:state.revisions,floor:state.floor,layers:state.layers}),
    importSession:(saved)=>{
      if(!saved||!Array.isArray(saved.floors)||!saved.floors.length)return false;
      floors=clone(saved.floors);state.floor=Math.max(0,Math.min(floors.length-1,saved.floor||0));
      state.layers=clone(saved.layers||floors[state.floor].layers||{walls:true,rooms:true,mep:true});
      state.history=clone(saved.history||[]);state.future=clone(saved.future||[]);
      state.snapshots=clone(saved.snapshots||[]);state.revisions=clone(saved.revisions||[]);
      state.selected=null;state.start=null;state.cursor=null;state.measure=null;state.tool="select";state.view="plan";render();return true;
    },
    getFloors: () => floors.map((f,i)=>({
      index:i,name:f.name,elevation:f.elevation,ceiling:f.ceiling,
      wallCount:f.walls.length,roomCount:roomsFor(f.walls).length,
      area:round(roomsFor(f.walls).reduce((a,r)=>a+r.area,0),2),
      wallLength:round(f.walls.reduce((a,w)=>a+len(w),0),2)
    })),
    getState:()=>({floor:state.floor,view:state.view,tool:state.tool,snap:state.snap,layers:clone(state.layers),
      history:state.history.length,revisions:state.revisions.length,snapshots:state.snapshots.length}),
    selectFloor:(index)=>{if(Number.isInteger(index)&&index>=0&&index<floors.length){switchFloor(index);return true;}return false;},
    reset:(demo=true)=>{
      const template=demo?clone(initialDemo):[{name:"همکف",elevation:0,ceiling:3.1,walls:[]}];
      floors=template;
      state.floor=0;state.layers=clone(floors[0].layers||{walls:true,rooms:true,mep:true});state.selected=null;state.start=null;state.cursor=null;state.measure=null;
      state.tool="select";state.view="plan";state.history=[];state.future=[];
      state.snapshots=[];state.revisions=[];render();return true;
    },
    renameFloor:(index,name)=>{
      if(!floors[index]||typeof name!=="string"||!name.trim())return false;
      mutate(()=>{floors[index].name=name.trim().slice(0,32);});return true;
    },
    setFloorElevation:(index,val)=>{
      if(!floors[index]||!Number.isFinite(val)||Math.abs(val)>100)return false;
      mutate(()=>{floors[index].elevation=val;});return true;
    },
    setCeiling:(index,val)=>{
      if(!floors[index]||!Number.isFinite(val)||val<2||val>9)return false;
      mutate(()=>{floors[index].ceiling=val;floors[index].walls.forEach(w=>{if(w.auto)w.h=val;});});return true;
    },
    startTool:(tool)=>{if(["select","wall","offset","measure","quantities","snapshot"].includes(tool))activateTool(tool);},
    changeView:(view)=>{if(["plan","iso","ar"].includes(view))switchView(view);},
    toggleLayer:(layer,enabled)=>{
      const names={walls:"layerWalls",rooms:"layerRooms",mep:"layerMep"};
      if(!names[layer])return false;
      state.layers[layer]=Boolean(enabled);current().layers=clone(state.layers);render();return true;
    },
    showQuantities:()=>showQuantities(),
    showVersions:()=>showVersions(),
    showHelp:()=>help()
  });
  const originalRender=render;
  render=function(){
    originalRender();
    document.dispatchEvent(new CustomEvent("archyar:render",{detail:{
      floor:state.floor,view:state.view,tool:state.tool
    }}));
  };
  render();
})();
