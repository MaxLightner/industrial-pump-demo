"use strict";
/* Tablet-first UI shell, keeping Archiyar's existing in-memory geometry engine. */
(() => {
 const $ = (id) => document.getElementById(id);
 const icon = (name) => {
   const common='viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
   const paths={
     wall:'<path d="M5 27V5h22v22M5 14h22M16 5v9M16 14v13M5 27h22"/>',
     door:'<rect x="7" y="4" width="19" height="24" rx="1"/><path d="M12 4v24M21 17h2"/>',
     ruler:'<path d="M5 23 23 5l5 5-18 18-5-5ZM12 16l3 3m0-6 3 3m0-6 3 3"/>',
     sofa:'<path d="M6 16V8a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8M6 20h20M4 25v-9a3 3 0 0 1 6 0v6h12v-6a3 3 0 0 1 6 0v9H4Zm3 0v3m18-3v3"/>',
     tiles:'<rect x="4" y="4" width="24" height="24" rx="2"/><path d="M12 4v24M20 4v24M4 12h24M4 20h24"/>',
     layers:'<path d="m16 3 13 8-13 8L3 11l13-8Zm-13 14 13 8 13-8M3 23l13 7 13-7"/>',
     walk:'<circle cx="17" cy="5" r="3"/><path d="m15 10-5 6-4 1m9-7 5 6 6 1m-11-6-2 9-5 8m7-8 7 8"/>',
     check:'<path d="m5 16 7 7L27 8"/>',
     expand:'<path d="M13 5H5v8M19 27h8v-8M5 5l9 9m13 13-9-9"/>',
     chevron:'<path d="m7 12 9 9 9-9"/>',
     select:'<path d="M6 4v24l7-8 6 7 4-3-6-7 11-3-22-10Z"/>'
   };
   return '<svg '+common+' aria-hidden="true">'+(paths[name]||paths.wall)+'</svg>';
 };
 const brandIcon = '<svg viewBox="0 0 70 70" aria-hidden="true"><defs><linearGradient id="archGrad" x1="0" y1="1" x2=".9" y2="0"><stop offset="0" stop-color="#b68b59"/><stop offset=".52" stop-color="#f7dfbf"/><stop offset="1" stop-color="#a9835d"/></linearGradient></defs><path d="M9 46.5 24.2 18.1C28 10.8 34 9 38.4 11c4.4 2 6.4 7 8.6 13.5L62 59H43L33 32c-1.6-4.1-4-4.3-6.3-.2L20 45v14H9Z" fill="url(#archGrad)"/><path d="M20 59V45l6.7-13.2c2.3-4.1 4.7-3.9 6.3.2L43 59Z" fill="#f5ddbb" opacity=".76"/></svg>';
 const brand=$("brandNever")||document.querySelector(".brand");
 if(brand){brand.innerHTML='<span class="brand-icon">'+brandIcon+'</span><span>Archiyar</span>';}
 const iconBtn = (id,content) => {const el=$(id);if(el)el.innerHTML=content;};
 iconBtn("undoBtn","↶");iconBtn("redoBtn","↷");
 iconBtn("openRevisions","◷"); iconBtn("helpBtn","⚙");
 $("helpBtn").title="راهنما و تنظیمات پیش‌نمایش";
 const vp=$("viewport");
 const backdrop=document.createElement("div");
 backdrop.className="interior-scene";
 backdrop.innerHTML='<div class="backwall"></div><div class="sidewall"></div><div class="window"></div><div class="light"></div>';
 vp.prepend(backdrop);
 const rail=document.createElement("nav");rail.className="left-rail";rail.setAttribute("aria-label","ابزارهای معماری");
 const items=[
   ["wall","دیوار","wall"],["opening","بازشو","door"],["tools","ابزارها","ruler"],
   ["furniture","مبلمان","sofa"],["materials","متریال","tiles"],["layers","لایه‌ها","layers"]
 ];
 rail.innerHTML=items.map(([id,name,ico])=>'<button class="rail-item '+(id==="wall"?"active":"")+'" type="button" data-rail="'+id+'" aria-label="'+name+'">'+icon(ico)+'<span>'+name+'</span></button>').join("");
 vp.appendChild(rail);
 const mini=document.createElement("section");mini.className="mini-map";
 mini.innerHTML='<div class="mini-map-header"><strong>نمای دوبعدی</strong><button id="miniToggle" aria-label="نمای دوبعدی">'+icon("chevron")+'</button></div><div class="mini-map-body"><svg id="miniScene" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid meet" aria-hidden="true"></svg><button class="expand-mini" id="miniExpand" aria-label="بزرگ‌نمایی پلان">'+icon("expand")+'</button></div><div class="mini-caption">پلان نمونه · همگام با ترسیم</div>';
 vp.appendChild(mini);
 const shapes = {
  plain:'<path d="M15 20 62 3v57L15 77Z" fill="#d8d5d2"/><path d="M15 20 20 16v61l-5 0Z" fill="#f3f1ef"/><path d="M15 20 62 3l6 5-48 17Z" fill="#fff"/>',
  brick:'<path d="M13 20 59 5v59L13 79Z" fill="#b6b1aa"/><path d="M13 20 19 14v62l-6 3Z" fill="#e8e3dc"/><path d="M13 20 59 5l7 5-47 17Z" fill="#efe9e3"/><g stroke="#857f79" opacity=".7"><path d="m15 36 44-15M15 52l44-15M15 68l44-15m-23-41v10m-14 3v10m25-20v10m-11 4v10m-14 3v10"/></g>',
  partition:'<path d="M12 17 59 3v59L12 76Z" fill="#a6a7a6"/><path d="M12 17 18 12v62l-6 2Z" fill="#ddd"/><path d="M12 17 59 3l6 4-47 17Z" fill="#f4f4f2"/><path d="m13 48 45-14M13 68l45-14" stroke="#797d7c"/>',
  curved:'<path d="M14 25q19-27 49-13v50q-31-9-49 15Z" fill="#d8d7d2"/><path d="M14 25q20-23 49-13l-5 6q-24-9-39 13Z" fill="#fff"/>',
  angled:'<path d="M12 28 35 8l27 13v52L35 60 12 79Z" fill="#bdbbb7"/><path d="M12 28 35 8l27 13-5 5-22-11-18 19Z" fill="#fff"/><path d="M35 15v45" stroke="#898780" stroke-width="2"/>'
 };
 const thumbnail=(kind)=>'<span class="asset-shape"><svg viewBox="0 0 82 84" aria-hidden="true">'+shapes[kind]+'</svg></span>';
 const dock=document.createElement("section");dock.className="tool-dock";dock.setAttribute("aria-label","انتخاب ابزار و اجزای معماری");
 dock.innerHTML='<div class="dock-grip"></div><nav class="dock-tabs" aria-label="دسته ابزار">'+[
  ["wall","دیوار"],["opening","در و پنجره"],["furniture","مبلمان"],["materials","متریال"],["building","ساختمان"]
 ].map(([id,name])=>'<button class="dock-tab '+(id==="wall"?"active":"")+'" data-category="'+id+'">'+name+'</button>').join("")+'</nav><div class="asset-scroll" id="assetItems"></div>';
 vp.appendChild(dock);
 const assets={
  wall:[["plain","دیوار داخلی","wall"],["brick","دیوار باربر","sample"],["partition","پارتیشن","sample"],["curved","دیوار منحنی","future"],["angled","دیوار زاویه‌دار","future"]],
  opening:[["plain","در داخلی","future"],["partition","پنجره","future"]],
  furniture:[["plain","مبل","future"],["partition","میز","future"]],
  materials:[["brick","بلوک و آجر","future"],["partition","پوشش دیوار","future"]],
  building:[["angled","طبقات","floors"],["plain","متره","quantities"],["partition","تاریخچه","history"]]
 };
 let category="wall",activeAsset="plain",lastMini="";
 const info=(title,description)=>{
   $("modalTitle").textContent=title;
   $("modalBody").innerHTML='<p>'+description+'</p><div class="notice">این امکان در مرحله بعد توسعه قرار دارد؛ پیش‌نمایش فعلی AR واقعی و ذخیره دائمی ندارد.</div>';
   $("modalPrimary").style.display="none";
   $("modalBackdrop").classList.add("open");
 };
 const originalTool=(key)=>{const el=document.querySelector('#tools [data-tool="'+key+'"]');if(el)el.click();};
 const originalView=(key)=>{const el=document.querySelector('.tab-list [data-view="'+key+'"]');if(el)el.click();};
 const chooseCategory=(next)=>{
   category=next;
   dock.querySelectorAll(".dock-tab").forEach(el=>el.classList.toggle("active",el.dataset.category===next));
   rail.querySelectorAll(".rail-item").forEach(el=>el.classList.toggle("active",el.dataset.rail===next||(next==="building"&&el.dataset.rail==="layers")));
   $("assetItems").innerHTML=assets[next].map(([shape,title,action])=>'<button class="asset-card '+(next==="wall"&&shape===activeAsset?"active":"")+'" data-asset="'+shape+'" data-asset-action="'+action+'" title="'+title+'">'+thumbnail(shape)+'<span>'+title+'</span></button>').join("");
 };
 chooseCategory("wall");
 const mode=document.createElement("div");mode.className="mode-switch";mode.innerHTML='<button data-mode="ar" aria-label="پوسته نمایشی AR">AR</button><button class="active" data-mode="plan" aria-label="پلان دو بعدی">2D</button>';vp.appendChild(mode);
 const right=document.createElement("div");right.className="workspace-actions right-tablet";
 right.innerHTML='<button class="action-round" id="threeD" title="نمای حجمی">3D</button><button class="action-round" id="walkTool" title="ابزار اجرای واقعی">'+icon("walk")+'</button><button class="action-round" id="layerTool" title="طبقات و لایه‌ها">'+icon("layers")+'</button>';
 vp.appendChild(right);
 const oldActions=vp.querySelector(".workspace-actions:not(.right-tablet)");if(oldActions)oldActions.style.display="none";
 const quick=document.createElement("div");quick.className="quick-actions";
 quick.innerHTML='<span class="tool-details" id="activeHint">ابزار: انتخاب</span><button class="touch-circle" id="quickUndo" aria-label="برگشت">↶</button><button class="touch-circle add-main" id="addWall" aria-label="ترسیم دیوار">+</button><button class="touch-circle" id="quickRedo" aria-label="بازانجام">↷</button><button class="finish" id="finishDrawing">'+icon("check")+'اتمام</button>';
 vp.appendChild(quick);
 vp.querySelector(".preview-info").textContent="";
 document.querySelector(".floating-tag").setAttribute("aria-label","اطلاعات طبقه نمونه");
 const setMode=()=>{
   const view=document.querySelector('.tab-list [data-view].active')?.dataset.view||"plan";
   mode.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.mode===view));
   $("threeD").style.borderColor=view==="iso"?"#ffe1a6":"#e2c5a477";
   $("activeHint").textContent="ابزار: "+($("statusTool")?.textContent||"انتخاب").replace("ابزار: ","");
 };
 const updateMini=()=>{
   const scene=$("scene");
   const hasWalls=!!scene.querySelector("g[data-wall]");
   if(hasWalls)lastMini=scene.innerHTML;
   if(lastMini)$("miniScene").innerHTML=lastMini;
   setMode();
 };
 const observer=new MutationObserver(updateMini);
 observer.observe($("scene"),{childList:true,subtree:false});
 updateMini();
 rail.addEventListener("click",e=>{
   const b=e.target.closest("[data-rail]");if(!b)return;
   const id=b.dataset.rail;
   if(id==="wall"){chooseCategory("wall");originalTool("wall");}
   else if(id==="opening")chooseCategory("opening");
   else if(id==="tools"){chooseCategory("building");originalTool("measure");}
   else if(id==="furniture"||id==="materials")chooseCategory(id);
   else if(id==="layers")$("sidebar").classList.toggle("open");
 });
 dock.querySelector(".dock-tabs").addEventListener("click",e=>{const b=e.target.closest("[data-category]");if(b)chooseCategory(b.dataset.category);});
 $("assetItems").addEventListener("click",e=>{
   const b=e.target.closest("[data-asset]");if(!b)return;
   const type=b.dataset.assetAction;activeAsset=b.dataset.asset;
   if(type==="wall"||type==="sample"){chooseCategory("wall");window.ArchyarPreview?.setWallPreset(b.dataset.asset);}
   else if(type==="quantities")originalTool("quantities");
   else if(type==="history")$("openRevisions").click();
   else if(type==="floors")$("sidebar").classList.add("open");
   else info(b.querySelector("span:last-child").textContent,"این گزینه هنوز ابزار هندسی فعال ندارد. در نسخه فعلی، ترسیم مستقیم دیوار داخلی قابل استفاده است.");
 });
 $("addWall").onclick=()=>{chooseCategory("wall");activeAsset="plain";window.ArchyarPreview?.setWallPreset("plain");};
 $("finishDrawing").onclick=()=>{originalTool("select");setMode();};
 $("quickUndo").onclick=()=>$("undoBtn").click();
 $("quickRedo").onclick=()=>$("redoBtn").click();
 $("threeD").onclick=()=>{const curr=document.querySelector(".tab-list [data-view].active")?.dataset.view;originalView(curr==="iso"?"plan":"iso");setMode();};
 $("walkTool").onclick=()=>$("executionDemo").click();
 $("layerTool").onclick=()=>$("sidebar").classList.toggle("open");
 $("miniExpand").onclick=()=>{originalView("plan");$("sidebar").classList.add("open");};
 $("miniToggle").onclick=()=>{mini.querySelector(".mini-map-body").classList.toggle("hidden");};
 mode.addEventListener("click",e=>{const b=e.target.closest("[data-mode]");if(b){originalView(b.dataset.mode);setMode();}});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")$("sidebar").classList.remove("open");});
 $("scene").addEventListener("pointerup",()=>setMode());
 window.addEventListener("resize",updateMini);
})();
