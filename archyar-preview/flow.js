"use strict";
/* Archiyar UI flow: in-memory design prototype. No account, server or persistent project save. */
(() => {
  const engine=window.ArchyarPreview;
  if(!engine){console.error("Archiyar engine bridge missing");return;}
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const num=(n,d=1)=>Number(n||0).toLocaleString("fa-IR",{maximumFractionDigits:d});
  const icon=(name)=>{
    const shapes={
      arrow:'<path d="M19 5 12 12l7 7M12 12h14"/>',building:'<path d="M7 27V5h17v22M4 27h24M12 10h3m5 0h1m-9 6h3m5 0h1m-9 6h3"/>',
      plus:'<path d="M12 5v14M5 12h14"/>',project:'<rect x="4" y="4" width="20" height="20" rx="3"/><path d="M9 4v20M9 11h15"/>',
      floors:'<path d="m14 3 11 6-11 6L3 9l11-6Zm-11 13 11 6 11-6M3 21l11 6 11-6"/>',
      file:'<path d="M6 3h12l6 6v16H6V3Zm12 0v6h6M10 15h10M10 19h10"/>',
      camera:'<path d="M4 9h5l2-3h7l2 3h4v14H4V9Z"/><circle cx="14" cy="16" r="4"/>',
      marker:'<path d="M4 11V4h7m6 0h7v7M4 17v7h7m6 0h7v-7M10 10h8v8h-8Z"/>',
      scan:'<path d="M3 10V4h7m8 0h6v6M3 18v6h7m8 0h6v-6M8 14h12"/>',
      ruler:'<path d="m4 17 13-13 9 9-13 13-9-9Zm10-7 4 4m-8 0 3 3m5 1 2 2"/>',
      shield:'<path d="M14 3 24 7v7c0 7-5 11-10 13C9 25 4 21 4 14V7l10-4Zm-4 11 3 3 6-6"/>',
      settings:'<circle cx="14" cy="14" r="4"/><path d="m13 2 2 0 1 4 3 1 4-2 2 3-3 3v4l3 3-2 3-4-2-3 1-1 4h-3l-1-4-3-1-4 2-2-3 3-3v-4L3 8l2-3 4 2 3-1 1-4Z"/>',
      clock:'<circle cx="14" cy="14" r="11"/><path d="M14 7v7l5 3"/>',
      chevron:'<path d="m8 10 6 6 6-6"/>',
      check:'<path d="m4 14 7 7L24 7"/>',eye:'<path d="M2 14s5-8 12-8 12 8 12 8-5 8-12 8S2 14 2 14Z"/><circle cx="14" cy="14" r="4"/>',
      warning:'<path d="m14 3 12 22H2L14 3Zm0 8v6m0 3v1"/>',door:'<path d="M7 3h16v22H7V3Zm5 5v13m6-8v2"/>',
      cloud:'<path d="M5 19a7 7 0 0 1 5-12c3-5 11-4 13 2a6 6 0 0 1 0 12H8"/>',
      note:'<path d="M6 3h16v22H6V3Zm4 7h8m-8 5h8m-8 5h5"/>',
      lock:'<rect x="5" y="11" width="18" height="15" rx="3"/><path d="M9 11V7a5 5 0 0 1 10 0v4"/>'
    };
    return '<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(shapes[name]||shapes.project)+'</svg>';
  };
  const mark='<svg class="flow-logo-svg" viewBox="0 0 70 70" aria-hidden="true"><defs><linearGradient id="flowGold" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#c39b6c"/><stop offset=".55" stop-color="#f4d8b7"/><stop offset="1" stop-color="#a37d55"/></linearGradient></defs><path fill="url(#flowGold)" d="M9 48 24 19C27 12 33 9 38 11s7 7 9 14l15 34H43L33 32c-2-5-5-5-7 0l-6 14v13H9Z"/></svg>';
  const timestamp=()=>new Date().toLocaleString("fa-IR",{dateStyle:"short",timeStyle:"short"});
  let projects=[{
    id:"sample",name:"ساختمان نیلوفر",address:"پروژه نمونه آموزشی",description:"ساختمان مسکونی سه‌طبقه · داده نمونه",type:"demo",level:"نمونه",updated:"پروژه نمونه",pdfs:{},photos:[],notes:[],markerId:"ARCH-YAR-SAMPLE-01",cache:null
  }];
  let activeId="sample",screen="home",viewFloor=0,sheetClose=null,previousScreen="project",welcomeSeen=false;
  const active=()=>projects.find(p=>p.id===activeId)||projects[0];
  const root=document.createElement("div");
  root.id="appScreens";
  root.className="flow-root";
  document.querySelector(".app").appendChild(root);
  const dialog=document.createElement("div");dialog.id="flowSheet";dialog.className="flow-sheet-backdrop";
  dialog.innerHTML='<section class="flow-sheet" role="dialog" aria-modal="true"><header><h3 id="flowSheetTitle"></h3><button data-sheet-close aria-label="بستن">×</button></header><div id="flowSheetBody"></div><footer id="flowSheetFooter"></footer></section>';
  document.querySelector(".app").appendChild(dialog);
  function openSheet(title,body,buttons=[]){
    $("flowSheetTitle").textContent=title;$("flowSheetBody").innerHTML=body;
    $("flowSheetFooter").innerHTML=buttons.map((b,i)=>'<button class="flow-button '+(b.variant||"primary")+'" data-sheet-button="'+i+'">'+esc(b.label)+'</button>').join("");
    $("flowSheetFooter").onclick=e=>{
      const b=e.target.closest("[data-sheet-button]");if(!b)return;
      const index=Number(b.dataset.sheetButton),handler=buttons[index].handler;
      if(handler&&handler()===false)return;
      closeSheet();
    };
    dialog.classList.add("open");
  }
  function closeSheet(){dialog.classList.remove("open");if(sheetClose)sheetClose();sheetClose=null;}
  dialog.onclick=e=>{if(e.target===dialog||e.target.closest("[data-sheet-close]"))closeSheet();};
  const head=(title,subtitle,back="home",extra="")=>'<div class="flow-pagehead"><button class="flow-back" data-go="'+back+'" aria-label="بازگشت">'+icon("arrow")+'</button><div class="flow-page-title"><div class="flow-brow">ARCHIYAR / '+esc(subtitle)+'</div><h1>'+esc(title)+'</h1></div><div class="flow-head-extra">'+extra+'</div></div>';
  const panel=(heading,body,action="")=>'<section class="flow-panel"><header class="flow-panelhead"><h2>'+heading+'</h2>'+action+'</header>'+body+'</section>';
  const floorname=f=>f?"طبقه "+f.name:"";
  function rememberProject(){active().cache=engine.exportSession();active().updated=timestamp();}
  function chooseProject(id){
    if(activeId!==id)rememberProject();
    const p=projects.find(x=>x.id===id);if(!p)return;
    activeId=id;
    if(p.cache)engine.importSession(p.cache);else engine.reset(p.type==="demo");
    viewFloor=0;engine.selectFloor(0);navigate("project");
  }
  function editor(kind){
    rememberProject();previousScreen=screen;
    engine.selectFloor(viewFloor);
    if(kind==="ar"){navigate("reference");return;}
    engine.changeView(kind==="iso"?"iso":"plan");
    navigate("editor");
  }
  function navigate(next){
    screen=next;
    root.classList.toggle("flow-hidden",next==="editor");
    document.body.classList.toggle("flow-editor",next==="editor");
    document.querySelector(".topbar").style.display=next==="editor"?"flex":"none";
    const oldBack=$("editorBack");if(oldBack)oldBack.style.display=next==="editor"?"grid":"none";
    if(next==="editor")return;
    render();
  }
  function switchFloor(i){
    rememberProject();if(engine.selectFloor(i)){viewFloor=i;navigate("floor");}
  }
  const portraitCover='<div class="flow-building"><div class="tower t1"></div><div class="tower t2"></div><div class="tower t3"></div><div class="tower-shine"></div></div>';
  function projectTile(p){
    return '<article class="flow-project-card" data-open-project="'+p.id+'"><div class="flow-project-cover">'+portraitCover+'<span class="flow-overlay-tag">'+(p.type==="demo"?"پروژه نمونه":"جلسه موقت")+'</span></div><div class="flow-project-desc"><strong>'+esc(p.name)+'</strong><span>'+esc(p.description)+'</span><small>'+esc(p.updated)+'</small></div><div class="flow-card-chevron">‹</div></article>';
  }
  function home(){
    return '<div class="flow-home"><div class="flow-home-hero"><div class="flow-home-art">'+portraitCover+'</div><header class="flow-home-top"><div class="flow-lockup">'+mark+'<div><strong>Archiyar</strong><small>دستیار معماری و اجرای ساختمان</small></div></div><button class="flow-icon-btn" data-action="settings" aria-label="تنظیمات">'+icon("settings")+'</button></header><div class="flow-home-content"><span class="flow-kicker">ARCHITECTURE / AUGMENTED SPACE</span><h1>فضا را طراحی کن.<br><em>در واقعیت ببین.</em></h1><p>از نقشه تا اجرا، طبقات و جزئیات پروژه در یک محیط منسجم.</p><div class="flow-home-cta"><button class="flow-button primary" data-action="resume">'+icon("arrow")+' ادامه آخرین پروژه</button><button class="flow-button outlined" data-go="projects">همه پروژه‌ها</button></div></div><div class="flow-home-sidenote">تجربه آزمایشی · بدون ذخیره دائمی</div></div>'+
     '<div class="flow-home-body">'+
     '<div class="flow-section-line"><h2>شروع سریع</h2><span>برای بررسی گردش کار آرچیار</span></div>'+
     '<div class="flow-quick-grid">'+
     '<button data-action="new" class="flow-quick-tile">'+icon("plus")+'<b>پروژه جدید</b><span>یک طبقه خالی، فقط در این جلسه</span></button>'+
     '<button data-action="demo" class="flow-quick-tile">'+icon("building")+'<b>پروژه نمونه</b><span>سه طبقه و دیوارهای آماده</span></button>'+
     '<button data-action="testar" class="flow-quick-tile">'+icon("scan")+'<b>آزمایش محیط AR</b><span>شبیه‌سازی رابط، بدون دوربین</span></button>'+
     '<button data-action="settings" class="flow-quick-tile">'+icon("settings")+'<b>تنظیمات و وضعیت</b><span>راهنما، مجوز و محدودیت‌ها</span></button>'+
     '</div><div class="flow-section-line"><h2>آخرین پروژه</h2><button class="flow-textlink" data-go="projects">مشاهده همه ‹</button></div>'+
     '<div class="flow-project-list">'+projectTile(active())+'</div>'+
     '<div class="flow-footnote">'+icon("warning")+' در نسخه پیش‌نمایش تمام ویرایش‌ها، نقشه‌های بارگذاری‌شده و عکس‌ها با بارگذاری دوباره صفحه از بین می‌روند.</div></div></div>';
  }
  function projectsPage(){
    return head("پروژه‌های من","پروژه‌ها","home",'<button class="flow-button primary compact" data-action="new">'+icon("plus")+' پروژه جدید</button>')+
      '<div class="flow-pagebody"><div class="flow-note">'+icon("warning")+' این فهرست موقت است. در محصول اصلی، پروژه‌های مجاز به ذخیره به‌صورت محلی و آفلاین در دسترس خواهند بود.</div>'+
      '<div class="flow-project-list">'+projects.map(projectTile).join("")+'</div>'+
      '<button class="flow-addline" data-action="new">'+icon("plus")+' ساخت پروژه آزمایشی جدید</button></div>';
  }
  function projectPage(){
    const p=active(),fl=engine.getFloors(),length=fl.reduce((a,f)=>a+f.wallLength,0),area=fl.reduce((a,f)=>a+f.area,0);
    const floorsHtml=fl.map(f=>'<button class="flow-floor-item" data-floor="'+f.index+'"><div class="flow-floor-number">'+num(f.index+1,0)+'</div><div class="flow-floor-text"><strong>طبقه '+esc(f.name)+'</strong><small>تراز '+(f.elevation>=0?"+":"")+num(f.elevation)+' متر · '+num(f.wallCount,0)+' دیوار</small></div><span class="flow-floor-area">'+(f.roomCount?num(f.area)+" m²":"بدون فضای بسته")+'</span><span class="flow-card-chevron">‹</span></button>').join("");
    return head(p.name,"داشبورد پروژه","projects",'<button class="flow-button soft compact" data-action="edit-project">'+icon("settings")+' ویرایش پروژه</button>')+
     '<div class="flow-pagebody"><div class="flow-project-hero"><div class="flow-project-hero-art">'+portraitCover+'</div><div class="flow-project-hero-copy"><span class="flow-kicker">PROJECT OVERVIEW</span><h2>'+esc(p.name)+'</h2><p>'+esc(p.description)+'</p><div class="flow-hero-meta">'+icon("clock")+' آخرین فعالیت: '+esc(p.updated)+'</div></div></div>'+
     '<div class="flow-metrics"><div><span>طبقات</span><b>'+num(fl.length,0)+'</b><small>در این پروژه</small></div><div><span>دیوارها</span><b>'+num(fl.reduce((a,f)=>a+f.wallCount,0),0)+'</b><small>قطعه</small></div><div><span>مساحت محورها</span><b>'+num(area)+'</b><small>متر مربع · نمونه</small></div><div><span>طول دیوار</span><b>'+num(length)+'</b><small>متر · نمونه</small></div></div>'+
     '<div class="flow-primary-row"><button class="flow-button primary" data-action="work">'+icon("scan")+' ورود به محیط کار</button><button class="flow-button outlined" data-action="quantities">'+icon("ruler")+' شناسنامه و متره</button></div>'+
     '<div class="flow-dashboard-grid">'+
     panel('طبقات پروژه',floorsHtml, '<span class="flow-muted">انتخاب برای مشاهده جزئیات</span>')+
     panel('مدارک و اطلاعات',[
      ['file','نقشه‌های PDF','اتصال به طبقه و تنظیم مقیاس','docs'],['camera','گالری پروژه',p.photos.length+' تصویر در این جلسه','gallery'],
      ['marker','مارکر ثابت','نسخه چاپیِ مرجع نمونه','marker'],['clock','تاریخچه تغییرات','Undo · Snapshot · Revision','versions'],
      ['note','خروجی‌ها','پیش‌نمایش مدارک و گزارش‌ها','export']
     ].map(([ico,label,sub,key])=>'<button class="flow-action-line" data-action="'+key+'">'+icon(ico)+'<span><b>'+label+'</b><small>'+esc(sub)+'</small></span><span class="flow-card-chevron">‹</span></button>').join(""))+
     '</div>'+
     '<div class="flow-note">'+icon("cloud")+' ذخیره محلی و همگام‌سازی در اپ بومیِ دارای مجوز طراحی شده‌اند؛ در این پیش‌نمایش اتصال به سرور و ذخیره واقعی فعال نیست.</div></div>';
  }
  function floorPage(){
    const p=active(),f=engine.getFloors()[viewFloor],doc=p.pdfs[viewFloor],layers=engine.getState().layers;
    return head("طبقه "+f.name,p.name,"project",'<button class="flow-button soft compact" data-action="floor-settings">'+icon("settings")+' تنظیمات طبقه</button>')+
      '<div class="flow-pagebody"><div class="flow-floor-hero"><div class="flow-floor-map"><svg viewBox="0 0 200 125" aria-hidden="true"><path d="M19 21h158v84H110V72H19V21Z" fill="#d6b58a26" stroke="#d9b286" stroke-width="5"/><path d="M79 21v51M79 56h53" fill="none" stroke="#b29d82" stroke-width="3"/></svg></div><div><span class="flow-kicker">FLOOR WORKSPACE</span><h2>طبقه '+esc(f.name)+'</h2><p>تراز '+(f.elevation>=0?"+":"")+num(f.elevation)+' متر · سقف '+num(f.ceiling)+' متر</p><span class="flow-muted">'+num(f.wallCount,0)+' دیوار · '+num(f.roomCount,0)+' فضای بسته</span></div></div>'+
      '<div class="flow-primary-row"><button class="flow-button primary" data-action="floor-2d">'+icon("project")+' ترسیم و ویرایش پلان</button><button class="flow-button outlined" data-action="floor-ar">'+icon("scan")+' ورود به نمای AR</button></div>'+
      '<div class="flow-dashboard-grid">'+
      panel('نقشه مرجع و PDF','<div class="flow-file-status">'+icon("file")+'<div><b>'+(doc?esc(doc.name):"هیچ نقشه‌ای متصل نیست")+'</b><small>'+(doc?"PDF موقت · فقط همین جلسه":"اتصال یک PDF به طبقه و سپس تنظیم مبنای آن")+'</small></div></div><div class="flow-panel-buttons"><button class="flow-button soft compact" data-action="pick-pdf">'+(doc?"تعویض PDF":"انتخاب فایل PDF")+'</button>'+(doc?'<button class="flow-button soft compact" data-action="view-pdf">مشاهده PDF</button>':'')+'</div><div class="flow-muted flow-inline-note">مقیاس و جهت نقشه در نسخه فعلی هنوز کالیبره نمی‌شوند؛ PDF فقط برای مشاهده متصل می‌شود.</div>')+
      panel('لایه‌ها و نمایش',[
       ["walls","دیوارها",f.wallCount],["rooms","فضاهای بسته",f.roomCount],["mep","تأسیسات نمونه","نمایشی"]
      ].map(([key,label,count])=>'<label class="flow-layer-row"><span>'+esc(label)+' <small>'+num(Number(count)||0,0)+(typeof count==="string"?" نمایشی":"")+'</small></span><input type="checkbox" data-layer="'+key+'" '+(layers[key]?"checked":"")+'></label>').join("")+'<div class="flow-inline-note">نمایش لایه‌ها برای هر طبقه مستقل است و با ورود به محیط کار اعمال می‌شود.</div>')+
      panel('ابزارهای این طبقه',[
       ["marker","مارکر ثابت و چاپ نمونه"],["quantities","مساحت و متره هندسی"],["gallery","عکس‌ها و یادداشت‌های اجرایی"],["versions","تاریخچه و بازگشت موقت"]
      ].map(([key,label])=>'<button class="flow-action-line" data-action="'+key+'">'+icon(key==="marker"?"marker":key==="gallery"?"camera":"ruler")+'<span><b>'+label+'</b></span><span class="flow-card-chevron">‹</span></button>').join(""))+
      '</div></div>';
  }
  function referencePage(){
    const f=engine.getFloors()[viewFloor];
    return head("ورود به واقعیت افزوده","تنظیم مرجع","floor")+
     '<div class="flow-pagebody"><div class="flow-reference-head">'+icon("scan")+'<h2>تنظیم موقعیت مدل در محیط</h2><p>پیش از نمایش مدل، باید مرجع مکانی انتخاب شود. این صفحه فقط جریان استفاده را شبیه‌سازی می‌کند؛ هیچ دوربین یا رهگیری فعالی وجود ندارد.</p></div>'+
     '<div class="flow-ref-grid"><button class="flow-ref-choice" data-action="with-marker">'+icon("marker")+'<b>ورود با مارکر</b><span>شناسایی الگوی ثابت ثبت‌شده برای طبقه '+esc(f.name)+'</span><small>۱. چاپ مارکر  ۲. اسکن  ۳. بازبینی مقیاس</small></button>'+
     '<button class="flow-ref-choice" data-action="without-marker">'+icon("ruler")+'<b>ورود بدون مارکر</b><span>انتخاب مبدأ، خط جهت و فاصله معلوم</span><small>۱. سطح و تراز  ۲. جهت  ۳. مقیاس  ۴. کنترل</small></button></div>'+
     '<div class="flow-note">'+icon("warning")+' نمای AR موجود فقط نمونه رابط است؛ هیچ اندازه‌گیری، ردیابی یا جانمایی واقعی انجام نمی‌شود.</div></div>';
  }
  function showSettings(){
    openSheet("تنظیمات و وضعیت برنامه",'<div class="flow-settings-list">'+[
     ["shield","نسخه","پیش‌نمایش طراحی، بدون حساب یا پرداخت واقعی"],
     ["cloud","اتصال و داده","بدون سرور و بدون ذخیره‌سازی دائم"],
     ["lock","قفل پروژه","در اپ نهایی، مشاهده بدون بازکردن قفل و ویرایش پس از آن"],
     ["file","نقشه و واحدها","متر واحد اصلی مدل هندسی است"],
     ["scan","AR","ردیابی و کالیبراسیون فقط در نسخه بومی قابل آزمون‌اند"]
    ].map(([i,h,p])=>'<div>'+icon(i)+'<span><b>'+h+'</b><small>'+p+'</small></span></div>').join("")+'</div>',[{label:"متوجه شدم"}]);
  }
  function createProjectSheet(){
    openSheet("پروژه آزمایشی جدید",'<p>در پیش‌نمایش رایگان، یک طبقه خالی در حافظه همین جلسه ساخته می‌شود. امکان ذخیره، صدور فایل اجرایی یا بازیابی پس از بستن صفحه وجود ندارد.</p><label class="flow-input-label">نام پروژه<input id="projectName" type="text" maxlength="45" placeholder="مثلاً ساختمان مسکونی" autocomplete="off"></label><label class="flow-input-label">توضیح کوتاه<input id="projectDescription" type="text" maxlength="90" placeholder="اختیاری"></label><div class="flow-field-hint" id="projectValidation">برای ایجاد پروژه فقط یک نام لازم است.</div>',[
      {label:"انصراف",variant:"soft"},
      {label:"ایجاد پروژه موقت",handler:()=>{
        const name=$("projectName").value.trim();
        if(!name){$("projectValidation").textContent="نام پروژه نباید خالی باشد.";return false;}
        rememberProject();
        const id="session-"+projects.length;
        projects.push({id,name,description:$("projectDescription").value.trim()||"پروژه موقت · یک طبقه",type:"session",level:"نمونه",updated:timestamp(),pdfs:{},photos:[],notes:[],markerId:"ARCH-YAR-TEMP-"+id,cache:null});
        activeId=id;engine.reset(false);viewFloor=0;navigate("project");
      }}
    ]);
  }
  function editProjectSheet(){
    const p=active();
    openSheet("مشخصات پروژه", '<label class="flow-input-label">نام پروژه<input id="editProjectName" maxlength="45" value="'+esc(p.name)+'"></label><label class="flow-input-label">توضیح پروژه<input id="editProjectDescription" maxlength="90" value="'+esc(p.description)+'"></label><div class="flow-field-hint" id="editProjectValidation">تغییرات فقط تا بسته شدن این پیش‌نمایش باقی می‌مانند.</div>',[
      {label:"انصراف",variant:"soft"},
      {label:"ثبت موقت",handler:()=>{
        const name=$("editProjectName").value.trim();if(!name){$("editProjectValidation").textContent="نام پروژه لازم است.";return false;}
        p.name=name;p.description=$("editProjectDescription").value.trim();p.updated=timestamp();navigate("project");
      }}
    ]);
  }
  function floorSettingsSheet(){
    const f=engine.getFloors()[viewFloor];
    openSheet("ویرایش اطلاعات طبقه",'<label class="flow-input-label">نام طبقه<input type="text" id="editFloorName" maxlength="30" value="'+esc(f.name)+'"></label><div class="flow-fields-two"><label class="flow-input-label">تراز کف (متر)<input type="number" id="editFloorLevel" step=".1" value="'+f.elevation+'"></label><label class="flow-input-label">ارتفاع تا سقف (متر)<input type="number" min="2" max="9" step=".1" id="editFloorCeiling" value="'+f.ceiling+'"></label></div><div class="flow-field-hint" id="floorValidation">دیوارهایی که ارتفاع خودکار دارند، به ارتفاع جدید سقف متصل می‌مانند.</div>',[
      {label:"انصراف",variant:"soft"},{label:"اعمال تغییرات",handler:()=>{
        const name=$("editFloorName").value.trim(),level=Number($("editFloorLevel").value),ceiling=Number($("editFloorCeiling").value);
        if(!name||!Number.isFinite(level)||Math.abs(level)>100||!Number.isFinite(ceiling)||ceiling<2||ceiling>9){
          $("floorValidation").textContent="نام معتبر، تراز بین ۱۰۰- تا ۱۰۰+ و ارتفاع سقف بین ۲ تا ۹ متر لازم است.";return false;
        }
        engine.renameFloor(viewFloor,name);engine.setFloorElevation(viewFloor,level);engine.setCeiling(viewFloor,ceiling);rememberProject();navigate("floor");
      }}
    ]);
  }
  function photosPage(){
    const p=active(),tiles=p.photos.map((a,i)=>'<button class="flow-photo" data-photo="'+i+'"><img src="'+a.url+'" alt="'+esc(a.name)+'"><span>'+esc(a.name)+'</span></button>').join("");
    return head("گالری پروژه",p.name,"project",'<button class="flow-button soft compact" data-action="add-photo">'+icon("plus")+' افزودن عکس</button>')+
     '<div class="flow-pagebody"><div class="flow-note">'+icon("camera")+' تصاویر فقط در حافظه موقت این جلسه نگهداری می‌شوند و به سرور ارسال نمی‌شوند.</div>'+
     (tiles?'<div class="flow-photo-grid">'+tiles+'</div>':'<div class="flow-empty">'+icon("camera")+'<h2>هنوز تصویری اضافه نشده است</h2><p>عکس‌های کارگاه و جزئیات پنهان ساختمان در گالری پروژه قرار می‌گیرند.</p><button class="flow-button primary" data-action="add-photo">افزودن تصویر</button></div>')+'</div>';
  }
  function floorDocs(){
    return head("مدارک پروژه",active().name,"project")+'<div class="flow-pagebody">'+engine.getFloors().map(f=>{
      const doc=active().pdfs[f.index];
      return '<button class="flow-action-line large" data-floor="'+f.index+'">'+icon("file")+'<span><b>طبقه '+esc(f.name)+'</b><small>'+(doc?esc(doc.name):"بدون فایل PDF")+'</small></span><span class="flow-card-chevron">‹</span></button>';
    }).join("")+'</div>';
  }
  function exportPanel(){
    openSheet("خروجی پروژه",'<p>در محصول نهایی، خروجی نقشه PDF، گزارش متره و مارکر ثابت قابل اشتراک خواهد بود.</p><div class="flow-note">'+icon("lock")+' این نسخه رایگان فقط پیش‌نمایش است. تولید پرونده اجرایی، خروجی نقشه و ذخیره‌سازی پروژه فعال نشده‌اند.</div>',[{label:"بستن"}]);
  }
  function quantitiesSheet(){
    const floors=engine.getFloors();
    openSheet("شناسنامه و متره مقدماتی",'<p>این اعداد از محور دیوار و هندسه بسته نمونه محاسبه شده‌اند؛ مقادیر خالص اجرایی، مصالح، تقاطع‌ها و بازشوها کسر نشده‌اند.</p><div class="flow-total-grid"><div><small>مجموع طول دیوار</small><b>'+num(floors.reduce((a,f)=>a+f.wallLength,0))+' m</b></div><div><small>مساحت بر اساس محور</small><b>'+num(floors.reduce((a,f)=>a+f.area,0))+' m²</b></div></div>'+floors.map(f=>'<div class="flow-quantity-row"><span>طبقه '+esc(f.name)+'</span><b>'+num(f.wallLength)+' m</b><b>'+num(f.area)+' m²</b></div>').join("")+'<div class="flow-note">'+icon("warning")+' داده برای برآورد اجرایی یا سفارش مصالح قابل اتکا نیست.</div>',[{label:"بستن"}]);
  }
  function galleryImage(i){
    const item=active().photos[i];
    if(!item)return;
    openSheet(item.name,'<img class="flow-dialog-image" src="'+item.url+'" alt="'+esc(item.name)+'"><p>این تصویر به پروژه موقت فعلی اضافه شده و پس از خروج از صفحه قابل بازیابی نیست.</p>',[
      {label:"حذف تصویر",variant:"soft",handler:()=>{active().photos.splice(i,1);navigate("gallery");}},
      {label:"بستن"}
    ]);
  }
  function markerSvg(){
    const p=active(),f=engine.getFloors()[viewFloor];
    const seed=p.markerId+"-"+viewFloor;let n=0;for(const c of seed)n=(n*33+c.charCodeAt(0))>>>0;
    let matrix='';
    for(let y=0;y<9;y++)for(let x=0;x<9;x++){
      n=(n*1664525+1013904223)>>>0;
      const border=x===0||x===8||y===0||y===8;
      if(border||(n&3)===1)matrix+='<rect x="'+(28+x*10)+'" y="'+(30+y*10)+'" width="10" height="10" fill="#171717"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 250" width="210mm" height="250mm" role="img">'+
      '<rect width="210" height="250" fill="white"/><text x="105" y="14" text-anchor="middle" font-family="Arial" font-size="8" fill="#161616">ARCHIYAR / STATIC SAMPLE MARKER</text>'+
      '<rect x="23" y="25" width="100" height="100" fill="#fff" stroke="#111" stroke-width="2"/>'+matrix+
      '<text x="105" y="140" text-anchor="middle" font-family="Arial" font-size="5.5">'+esc(seed)+'</text>'+
      '<text x="105" y="149" text-anchor="middle" font-family="Arial" font-size="5">Floor: '+esc(f.name)+'</text>'+
      '<path d="M26 166h50m-50-2v4m50-4v4" stroke="#111" stroke-width=".5"/><text x="51" y="163" text-anchor="middle" font-size="4" font-family="Arial">50 mm control ruler</text>'+
      '<text x="22" y="183" font-family="Arial" font-size="4.5">Print at 100% / Actual size. Do not scale to fit.</text>'+
      '<text x="22" y="191" font-family="Arial" font-size="4.2">UI DEMO ONLY — not an AR-tracking or production marker.</text></svg>';
  }
  function markerSheet(){
    const svg=markerSvg(),seed=esc(active().markerId+"-"+viewFloor);
    openSheet("مارکر ثابت · نسخه نمایشی",'<p>هویت مارکر برای طبقه در طول جلسه ثابت می‌ماند. چاپ مجدد همان طرح را تولید می‌کند؛ این الگو هنوز برای رهگیری واقعی AR کالیبره یا اعتبارسنجی نشده است.</p><div class="flow-marker-preview">'+svg+'</div><div class="flow-quantity-row"><span>شناسه نمونه</span><b dir="ltr">'+seed+'</b></div><div class="flow-quantity-row"><span>اندازه چاپ</span><b>۱۰۰٪ · A4</b></div>',[
      {label:"بستن",variant:"soft"},
      {label:"دریافت نمونه SVG",handler:()=>{
        const blob=new Blob([svg],{type:"image/svg+xml;charset=utf-8"});
        const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="Archiyar-marker-demo-"+viewFloor+".svg";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }}
    ]);
  }
  function noMarkerSheet(type){
    const withMarker=type==="with-marker";
    openSheet(withMarker?"شبیه‌سازی ورود با مارکر":"شبیه‌سازی ورود بدون مارکر",
      '<p>'+(withMarker?"در محصول نهایی، مارکر ثابت باید شناسایی و با طبقه و اندازه چاپ تطبیق داده شود.":"در محصول نهایی، ابتدا نقطه مبدأ، سپس خط جهت و فاصله معلوم و در پایان نقطه کنترل مستقل تعیین می‌شود.")+'</p>'+
      '<div class="flow-steps">'+(withMarker?["انتخاب مارکر طبقه","بازشناسی و کنترل اندازه","بازیابی جانمایی مدل"]:["شناسایی سطح و تراز","انتخاب مبدأ و جهت","تعیین خط مقیاس","بازبینی کنترل مستقل"]).map((x,i)=>'<div><span>'+num(i+1,0)+'</span>'+x+'</div>').join("")+'</div>'+
      '<div class="flow-note">'+icon("warning")+' این مراحل صرفاً توضیح تعامل هستند. نتیجه سنجش/رهگیری تولید نمی‌شود.</div>',[
        {label:"بازگشت",variant:"soft"},
        {label:"مشاهده پوسته AR",handler:()=>{engine.changeView("ar");navigate("editor");}}
      ]);
  }
  function action(name){
    if(name==="resume"){chooseProject(activeId);return;}
    if(name==="demo"){chooseProject("sample");return;}
    if(name==="new"){createProjectSheet();return;}
    if(name==="settings"){showSettings();return;}
    if(name==="testar"){chooseProject("sample");viewFloor=0;engine.selectFloor(0);navigate("reference");return;}
    if(name==="work"){viewFloor=0;engine.selectFloor(0);navigate("floor");return;}
    if(name==="floor-2d"){editor("plan");return;}
    if(name==="floor-ar"){editor("ar");return;}
    if(name==="edit-project"){editProjectSheet();return;}
    if(name==="floor-settings"){floorSettingsSheet();return;}
    if(name==="with-marker"||name==="without-marker"){noMarkerSheet(name);return;}
    if(name==="docs"){navigate("docs");return;}
    if(name==="gallery"){navigate("gallery");return;}
    if(name==="pick-pdf"){$("flowPdfInput").click();return;}
    if(name==="view-pdf"){
      const doc=active().pdfs[viewFloor];if(doc)window.open(doc.url,"_blank","noopener,noreferrer");return;
    }
    if(name==="add-photo"){$("flowPhotoInput").click();return;}
    if(name==="marker"){markerSheet();return;}
    if(name==="quantities"){quantitiesSheet();return;}
    if(name==="export"){exportPanel();return;}
    if(name==="versions"){engine.showVersions();return;}
  }
  function render(){
    const current={
      home:home,projects:projectsPage,project:projectPage,floor:floorPage,reference:referencePage,gallery:photosPage,docs:floorDocs
    };
    if(!current[screen])return;
    root.innerHTML=current[screen]();
    root.scrollTop=0;
  }
  root.addEventListener("click",e=>{
    const project=e.target.closest("[data-open-project]");if(project){chooseProject(project.dataset.openProject);return;}
    const floor=e.target.closest("[data-floor]");if(floor){switchFloor(Number(floor.dataset.floor));return;}
    const photo=e.target.closest("[data-photo]");if(photo){galleryImage(Number(photo.dataset.photo));return;}
    const nav=e.target.closest("[data-go]");if(nav){navigate(nav.dataset.go);return;}
    const act=e.target.closest("[data-action]");if(act){action(act.dataset.action);}
  });
  root.addEventListener("change",e=>{
    const layer=e.target.closest("[data-layer]");if(layer){engine.toggleLayer(layer.dataset.layer,layer.checked);rememberProject();}
  });
  const inputPdf=document.createElement("input");inputPdf.type="file";inputPdf.accept="application/pdf,.pdf";inputPdf.id="flowPdfInput";inputPdf.hidden=true;document.body.appendChild(inputPdf);
  inputPdf.onchange=e=>{
    const f=e.target.files?.[0];if(!f)return;
    if(f.type!=="application/pdf"&&!f.name.toLowerCase().endsWith(".pdf")){openSheet("نوع فایل نامعتبر","<p>برای نقشه مرجع، فایل PDF انتخاب کنید.</p>",[{label:"بستن"}]);return;}
    if(f.size>25*1024*1024){openSheet("حجم زیاد","<p>در این پیش‌نمایش فقط فایل تا ۲۵ مگابایت قابل نمایش است.</p>",[{label:"بستن"}]);return;}
    const prev=active().pdfs[viewFloor];if(prev)URL.revokeObjectURL(prev.url);
    active().pdfs[viewFloor]={name:f.name,url:URL.createObjectURL(f)};active().updated=timestamp();
    inputPdf.value="";navigate("floor");
  };
  const inputPhoto=document.createElement("input");inputPhoto.type="file";inputPhoto.accept="image/*";inputPhoto.id="flowPhotoInput";inputPhoto.hidden=true;document.body.appendChild(inputPhoto);
  inputPhoto.onchange=e=>{
    const f=e.target.files?.[0];if(!f)return;
    if(!f.type.startsWith("image/")||f.size>12*1024*1024){openSheet("فایل نامناسب","<p>فایل تصویری با حجم کمتر از ۱۲ مگابایت انتخاب کنید.</p>",[{label:"بستن"}]);return;}
    active().photos.push({name:f.name,url:URL.createObjectURL(f),floor:viewFloor,time:timestamp()});
    active().updated=timestamp();inputPhoto.value="";navigate("gallery");
  };
  const editorBack=document.createElement("button");editorBack.id="editorBack";editorBack.className="flow-editor-back";editorBack.setAttribute("aria-label","بازگشت به صفحه طبقه");editorBack.innerHTML=icon("arrow");
  document.querySelector(".topbar").appendChild(editorBack);
  editorBack.onclick=()=>{rememberProject();navigate("floor");};
  const originalBrand=document.querySelector(".brand");if(originalBrand){originalBrand.style.cursor="pointer";originalBrand.onclick=()=>{rememberProject();navigate("project");};}
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&dialog.classList.contains("open"))closeSheet();});
  navigate("home");
})();
