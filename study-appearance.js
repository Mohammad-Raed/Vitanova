/* Device-local appearance controls shared by the hub, lectures and flashcards. */
(() => {
  'use strict';
  const root=document.documentElement, device=matchMedia('(prefers-color-scheme: dark)');
  const key='vitanova:appearance:v1', themeKey='vitanova:theme:v1';
  const palettes=[
    ['atlas','Atlas','Cool blue and clean slate','#527cf6','#0e1729'],
    ['linen','Linen','Warm stone and copper','#b55e32','#27201c'],
    ['orchid','Orchid','Soft rose and aubergine','#a14883','#231a2a'],
    ['graphite','Graphite','Neutral ink and silver','#68737e','#16191e']
  ];
  const read=k=>{try{return localStorage.getItem(k);}catch{return null;}};
  const write=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
  let prefs={palette:'atlas',mode:'auto'};
  function load(){
    let saved;try{saved=JSON.parse(read(key));}catch{}
    if(palettes.some(([id])=>id===saved?.palette))prefs.palette=saved.palette;
    if(['light','dark','auto'].includes(saved?.mode))prefs.mode=saved.mode;
  }
  load();
  const mount=document.querySelector('#sidebar-appearance,.vn-lecture-controls,.fc-top nav');
  if(!mount||typeof HTMLDialogElement==='undefined')return;
  const el=(tag,label,cls)=>{const n=document.createElement(tag);if(label)n.textContent=label;if(cls)n.className=cls;return n;};
  const open=el('button','Appearance','vn-appearance-trigger');open.type='button';open.setAttribute('aria-haspopup','dialog');mount.append(open);
  const dialog=el('dialog',null,'vn-appearance');dialog.setAttribute('aria-labelledby','vn-appearance-title');
  const head=el('div',null,'vn-appearance-head'), title=el('h2','Appearance');title.id='vn-appearance-title';
  const close=el('button','Close','vn-appearance-close');close.type='button';head.append(title,close);
  dialog.append(head,el('p','Choose a palette and display mode. Changes apply immediately and stay on this device.'));
  const modes=el('div',null,'vn-appearance-modes');modes.setAttribute('role','group');modes.setAttribute('aria-label','Display mode');
  const grid=el('div',null,'vn-appearance-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Color palette');
  function apply(){
    const mode=prefs.mode==='auto'?(device.matches?'dark':'light'):prefs.mode;
    root.dataset.palette=prefs.palette;root.dataset.theme=mode;
    for(const b of modes.children)b.setAttribute('aria-pressed',String(b.dataset.mode===prefs.mode));
    for(const b of grid.children)b.setAttribute('aria-pressed',String(b.dataset.palette===prefs.palette));
  }
  function update(values){Object.assign(prefs,values);write(key,JSON.stringify(prefs));apply();}
  for(const mode of ['light','dark','auto']){
    const b=el('button',mode[0].toUpperCase()+mode.slice(1));b.type='button';b.dataset.mode=mode;b.onclick=()=>update({mode});modes.append(b);
  }
  for(const [id,label,description,accent,base] of palettes){
    const b=el('button',null,'vn-palette-option');b.type='button';b.dataset.palette=id;
    const swatch=el('span',null,'vn-palette-swatch');swatch.style.setProperty('--swatch-accent',accent);swatch.style.setProperty('--swatch-base',base);swatch.setAttribute('aria-hidden','true');
    b.append(swatch,el('strong',label),el('small',description));b.onclick=()=>update({palette:id});grid.append(b);
  }
  dialog.append(modes,grid);document.body.append(dialog);
  open.onclick=()=>dialog.showModal();close.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>open.focus());
  device.addEventListener('change',()=>{if(prefs.mode==='auto')apply();});
  window.addEventListener('pageshow',()=>{load();apply();});
  window.addEventListener('storage',e=>{if(e.key===key){load();apply();}});
  // The original quick toggle remains available; use its choice in the picker too.
  mount.querySelector('.vn-theme-toggle,#fc-theme')?.addEventListener('click',()=>{
    const mode=read(themeKey);if(mode==='light'||mode==='dark')update({mode});
  });
  apply();
})();
