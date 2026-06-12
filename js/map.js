'use strict';
/* ============================================================
 * 地图渲染：地形 / 疆域涂色 / 城池节点 / 手势缩放 / LOD
 * ============================================================ */
const svg=$('#map-svg');
const NS='http://www.w3.org/2000/svg';
let cityRefs=[],cellRefs=[];
let vb={x:70,y:-10,w:860,h:784};
const BASE_VW=1000;
const MINW=230,MAXW=980;
const PAN_BOX={x:-60,y:-110,x2:1020,y2:850};
let lastK=0;
let zoomerEls=[],zoomPtEls=[];

/* ---- 势力范围：维诺图 + 海岸裁剪 ---- */
const LAND_CLIP=[[30,18],[300,0],[620,0],[830,26],[858,80],[874,228],[914,342],[902,470],
  [950,588],[926,792],[858,838],[600,812],[300,788],[110,726],[26,560],[12,256]];
function clipHalf(poly,nx,ny,mx,my){
  const out=[];
  for(let k=0;k<poly.length;k++){
    const a=poly[k],b=poly[(k+1)%poly.length];
    const da=(a[0]-mx)*nx+(a[1]-my)*ny;
    const db=(b[0]-mx)*nx+(b[1]-my)*ny;
    if(da<=0)out.push(a);
    if((da<0&&db>0)||(da>0&&db<0)){
      const t=da/(da-db);
      out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
    }
  }
  return out;
}
function computeCells(){
  const sites=CITY_DEFS.map(d=>[d[1],d[2]]);
  return sites.map((s,i)=>{
    let poly=LAND_CLIP;
    for(let j=0;j<sites.length;j++){
      if(j===i)continue;
      const o=sites[j];
      poly=clipHalf(poly,o[0]-s[0],o[1]-s[1],(o[0]+s[0])/2,(o[1]+s[1])/2);
      if(poly.length<3)return [];
    }
    return poly;
  });
}

function updateZoomScale(){
  const k=clamp(vb.w/BASE_VW,0.5,1.15);
  if(Math.abs(k-lastK)<0.004)return;
  lastK=k;
  for(const el of zoomerEls)el.setAttribute('transform',`scale(${k})`);
  for(const el of zoomPtEls)el.setAttribute('transform',`translate(${el.dataset.zx},${el.dataset.zy}) scale(${k})`);
}
function clampVB(){
  vb.w=clamp(vb.w,MINW,MAXW);vb.h=vb.w*0.912;
  vb.x=clamp(vb.x,PAN_BOX.x-vb.w*0.1,PAN_BOX.x2-vb.w*0.9);
  vb.y=clamp(vb.y,PAN_BOX.y-vb.h*0.1,PAN_BOX.y2-vb.h*0.9);
}
function applyVB(){
  svg.setAttribute('viewBox',`${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  svg.classList.toggle('far',vb.w>885);
  svg.classList.toggle('near',vb.w<620);
  svg.classList.toggle('close',vb.w<400);
  updateZoomScale();
}
function svgEl(tag,attrs){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);return e}
function svgText(cls,x,y,str,attrs){
  const t=svgEl('text',Object.assign({class:cls,x:x,y:y},attrs||{}));t.textContent=str;return t}

function buildTerrain(){
  const defs=svgEl('defs',{});
  defs.innerHTML=`
    <radialGradient id="landGlow" cx="42%" cy="38%" r="80%">
      <stop offset="0%" stop-color="#1c2942"/><stop offset="55%" stop-color="#15203466"/><stop offset="100%" stop-color="#101a2b"/>
    </radialGradient>
    <linearGradient id="seaGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1d33"/><stop offset="100%" stop-color="#061120"/>
    </linearGradient>
    <radialGradient id="shine" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#fff" stop-opacity=".32"/>
      <stop offset="45%" stop-color="#fff" stop-opacity=".07"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="desert" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8a7340" stop-opacity=".16"/>
      <stop offset="100%" stop-color="#8a7340" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="steppe" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3f5a3a" stop-opacity=".22"/>
      <stop offset="100%" stop-color="#3f5a3a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="jungle" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#2e5a3a" stop-opacity=".2"/>
      <stop offset="100%" stop-color="#2e5a3a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="plateau" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#5a6a8a" stop-opacity=".16"/>
      <stop offset="100%" stop-color="#5a6a8a" stop-opacity="0"/>
    </radialGradient>`;
  svg.appendChild(defs);
  svg.appendChild(svgEl('rect',{class:'land-base',x:-3000,y:-3000,width:8000,height:7600,fill:'#141e2e'}));
  svg.appendChild(svgEl('rect',{class:'land-glow',x:-100,y:-110,width:1200,height:1140,fill:'url(#landGlow)'}));
  svg.appendChild(svgEl('ellipse',{cx:480,cy:-180,rx:950,ry:230,fill:'url(#steppe)'}));
  svg.appendChild(svgEl('ellipse',{cx:-220,cy:60,rx:420,ry:300,fill:'url(#desert)'}));
  svg.appendChild(svgEl('ellipse',{cx:-200,cy:520,rx:330,ry:340,fill:'url(#plateau)'}));
  svg.appendChild(svgEl('ellipse',{cx:380,cy:1060,rx:700,ry:230,fill:'url(#jungle)'}));
  for(let i=0;i<16;i++){
    const gx=-180+i*82+(i%3)*14,gy=-66-(i%4)*26;
    svg.appendChild(svgEl('path',{class:'grass',d:`M ${gx},${gy} q 2,-7 4,0 M ${gx+6},${gy+1} q 2,-9 4,0 M ${gx+12},${gy} q 2,-6 4,0`}));
  }
  svg.appendChild(svgText('outer-label',430,-105,'漠 北 草 原',{'font-size':'30'}));
  svg.appendChild(svgText('outer-sub',430,-72,'匈奴 · 鲜卑驰骋之地',{'font-size':'14'}));
  [[-90,40],[-170,90],[-60,130],[-200,180],[-110,230],[-250,40],[-160,-30]].forEach(p=>{
    svg.appendChild(svgEl('path',{class:'dune',d:`M ${p[0]},${p[1]} q 26,-15 52,0 M ${p[0]+14},${p[1]+10} q 18,-10 36,0`}));
  });
  svg.appendChild(svgText('outer-label',-120,150,'西 域',{'font-size':'28',fill:'#b89c64'}));
  svg.appendChild(svgText('outer-sub',-118,182,'丝路古道 · 楼兰于阗',{'font-size':'13',fill:'#a8905c'}));
  [[-70,380,1.1],[-150,450,1.3],[-90,540,1.2],[-180,610,1],[-60,660,.9],[-220,340,1]].forEach(m=>{
    const g=svgEl('g',{transform:`translate(${m[0]},${m[1]}) scale(${m[2]})`});
    g.appendChild(svgEl('path',{class:'snowmtn',d:'M -20,10 L 0,-16 L 20,10 Z'}));
    g.appendChild(svgEl('path',{class:'snowcap',d:'M -6,-8 L 0,-16 L 6,-8 L 3,-5 L 0,-8 L -3,-5 Z'}));
    svg.appendChild(g);
  });
  const ql=svgText('outer-label',-130,500,'西 羌 雪 域',{'font-size':'24',fill:'#9aaccc'});
  ql.setAttribute('transform','rotate(-90 -130 500)');svg.appendChild(ql);
  [[60,960],[170,990],[300,965],[420,1000],[540,970],[660,995],[200,1040],[460,1045],[-40,1000]].forEach(p=>{
    const g=svgEl('g',{transform:`translate(${p[0]},${p[1]})`});
    g.appendChild(svgEl('line',{class:'tree-t',x1:0,y1:6,x2:0,y2:-4}));
    g.appendChild(svgEl('circle',{class:'tree-c',cx:0,cy:-8,r:7}));
    g.appendChild(svgEl('circle',{class:'tree-c',cx:-6,cy:-3,r:5}));
    g.appendChild(svgEl('circle',{class:'tree-c',cx:6,cy:-3,r:5}));
    svg.appendChild(g);
  });
  svg.appendChild(svgText('outer-label',330,1070,'南 中 · 百 越',{'font-size':'26',fill:'#7fa382'}));
  svg.appendChild(svgText('outer-sub',330,1098,'瘴疠丛林 · 不毛之地',{'font-size':'13',fill:'#6f9372'}));
  svg.appendChild(svgEl('path',{class:'sea',d:
    'M 845,-80 C 838,5 902,55 932,105 C 960,150 898,190 872,228 '+
    'C 850,262 900,295 912,340 C 925,395 885,430 900,468 '+
    'C 912,515 958,535 948,585 C 938,655 962,715 925,790 '+
    'C 905,838 932,880 952,935 C 962,990 940,1060 955,1130 L 955,4600 L 5000,4600 L 5000,-3000 L 845,-3000 Z'}));
  [[930,160],[955,300],[942,430],[975,520],[935,665],[968,740],[915,60],[990,880],[1060,400],[1100,640]].forEach(p=>{
    svg.appendChild(svgEl('path',{class:'wave',d:`M ${p[0]},${p[1]} q 11,-7 22,0 q 11,7 22,0`}));
  });
  svg.appendChild(svgText('sea-label',912,72,'渤 海',{'font-size':'18'}));
  const seaL=svgText('sea-label',1000,560,'东　海',{'font-size':'26'});
  seaL.setAttribute('transform','rotate(90 1000 560)');
  svg.appendChild(seaL);
  svg.appendChild(svgText('',1030,300,'⛵',{'font-size':'20',opacity:'.55','text-anchor':'middle'}));
  svg.appendChild(svgText('',1005,750,'⛵',{'font-size':'15',opacity:'.45','text-anchor':'middle'}));
  svg.appendChild(svgEl('ellipse',{cx:1080,cy:700,rx:24,ry:9,fill:'#1d2c44',stroke:'#3a577c','stroke-width':1.5,opacity:.9}));
  svg.appendChild(svgText('sea-label',1080,684,'夷洲',{'font-size':'12','text-anchor':'middle'}));
  // 长城
  svg.appendChild(svgEl('path',{d:'M 130,78 C 260,40 420,22 560,26 C 660,29 760,42 858,72',
    fill:'none',stroke:'#8a7355','stroke-width':3,'stroke-dasharray':'9 5',opacity:.6,'stroke-linecap':'round'}));
  [[180,62],[300,36],[430,23],[560,26],[680,31],[790,49]].forEach(p=>{
    svg.appendChild(svgEl('rect',{x:p[0]-3.5,y:p[1]-5.5,width:7,height:10,fill:'#8a7355',opacity:.75,rx:1}));
  });
  svg.appendChild(svgText('mtn-label',478,12,'长　城',{fill:'rgba(160,138,100,.7)','font-size':'14'}));
  [[250,-95],[610,-122],[850,-88]].forEach(p=>{
    const g=svgEl('g',{transform:`translate(${p[0]},${p[1]})`,opacity:.55});
    g.appendChild(svgEl('path',{d:'M -11,0 a11,8 0 0 1 22,0 Z',fill:'#4a5a44',stroke:'#6a7a5a','stroke-width':1.2}));
    g.appendChild(svgEl('line',{x1:0,y1:-8,x2:0,y2:-14,stroke:'#8a7355','stroke-width':1.2}));
    svg.appendChild(g);
  });
  svg.appendChild(svgText('',-150,212,'🐫',{'font-size':'16',opacity:'.55','text-anchor':'middle'}));
  svg.appendChild(svgText('',-215,238,'🐫',{'font-size':'12',opacity:'.45','text-anchor':'middle'}));
  svg.appendChild(svgEl('ellipse',{cx:1062,cy:152,rx:20,ry:8,fill:'#1d2c44',stroke:'#3a577c','stroke-width':1.5,opacity:.9}));
  svg.appendChild(svgEl('path',{class:'mtn2',d:'M 1054,150 L 1060,140 L 1066,150',opacity:.8}));
  svg.appendChild(svgText('sea-label',1062,134,'蓬莱',{'font-size':'12','text-anchor':'middle'}));
  [3,9,11,13,17,19].forEach(ci=>{
    const c=CITY_DEFS[ci];
    const g=svgEl('g',{class:'lod-near',transform:`translate(${c[1]-54},${c[2]+2})`,opacity:.55});
    for(let r=0;r<3;r++)g.appendChild(svgEl('line',{x1:0,y1:r*6,x2:20,y2:r*6,stroke:'#6a7a4a','stroke-width':1.1}));
    for(let q=0;q<3;q++)g.appendChild(svgEl('line',{x1:q*10,y1:-2,x2:q*10,y2:14,stroke:'#6a7a4a','stroke-width':1.1}));
    svg.appendChild(g);
  });
  [['祁连山',175,188],['阴山',420,70],['燕山',688,64],['太行山',548,268],
   ['秦岭',300,402],['巴山',252,538],['巫山',378,572],['大别山',655,492],
   ['南岭',645,788],['武夷山',822,764],['陇山',105,356]].forEach(m=>{
    const t=svgEl('text',{class:'mtn-label lod-near zoom-pt','data-zx':m[1],'data-zy':m[2],transform:`translate(${m[1]},${m[2]})`});
    t.textContent=m[0];svg.appendChild(t);
  });
  [['🏔 恒山',505,118],['🏔 华山',350,345],['🏔 嵩山',505,362],['🏔 泰山',758,246],['🏔 衡山',545,726]].forEach(m=>{
    const t=svgEl('text',{class:'mtn-label yue lod-near zoom-pt','data-zx':m[1],'data-zy':m[2],transform:`translate(${m[1]},${m[2]})`});
    t.textContent=m[0];svg.appendChild(t);
  });
  [['⚔ 官渡',645,250],['⚔ 赤壁',652,628],['⚔ 夷陵',390,632],['⚔ 五丈原',338,362],
   ['◆ 铜雀台',552,182],['◆ 卧龙岗',430,470],['◆ 桃园',592,44]].forEach(l=>{
    const t=svgEl('text',{class:'landmark lod-near zoom-pt','data-zx':l[1],'data-zy':l[2],transform:`translate(${l[1]},${l[2]})`});
    t.textContent=l[0];svg.appendChild(t);
  });
  const MTNS=[
    [175,158,3,1],[420,42,4,.9],[688,38,3,.85],
    [532,162,3,.95],[548,238,3,.9],[516,120,2,.8],
    [302,378,4,1.05],[238,470,3,1],[205,508,3,.9],
    [380,548,3,.85],[372,592,2,.75],[655,468,3,.85],
    [645,762,4,.95],[822,740,3,.85],[105,330,3,.9],
    [62,118,2,.85],[148,256,2,.8]
  ];
  MTNS.forEach(m=>{
    const g=svgEl('g',{transform:`translate(${m[0]},${m[1]}) scale(${m[3]})`});
    for(let i=0;i<m[2];i++){
      const off=(i-(m[2]-1)/2)*22;
      const h=i%2===0?11:8;
      g.appendChild(svgEl('path',{class:i%2===0?'mtn':'mtn2',
        d:`M ${off-13},7 L ${off},-${h} L ${off+13},7`}));
    }
    svg.appendChild(g);
  });
  const huanghe='M 30,128 C 130,158 200,128 250,168 C 305,212 380,238 540,250 C 660,259 780,262 905,345';
  const changjiang='M 118,478 C 200,520 268,588 360,622 C 450,656 540,640 622,610 C 720,575 850,540 945,492';
  const weishui='M 142,312 C 230,322 330,308 458,318';
  const hanshui='M 298,452 C 392,470 462,498 482,508 C 530,528 560,528 596,528';
  svg.appendChild(svgEl('path',{class:'river-c',d:weishui,opacity:.45}));
  svg.appendChild(svgEl('path',{class:'river-c',d:hanshui,opacity:.45}));
  svg.appendChild(svgEl('path',{class:'river-w',d:huanghe}));
  svg.appendChild(svgEl('path',{class:'river-c',d:huanghe}));
  svg.appendChild(svgEl('path',{class:'river-w',d:changjiang}));
  svg.appendChild(svgEl('path',{class:'river-c',d:changjiang}));
  const hl=svgText('river-label',210,128,'黄 河');hl.setAttribute('transform','rotate(9 210 128)');svg.appendChild(hl);
  const cl=svgText('river-label',520,675,'长 江');cl.setAttribute('transform','rotate(-7 520 675)');svg.appendChild(cl);
  svg.appendChild(svgText('lake-label',300,295,'渭水'));
  svg.appendChild(svgText('lake-label',412,476,'汉水'));
  svg.appendChild(svgEl('ellipse',{class:'lake',cx:496,cy:644,rx:24,ry:13}));
  svg.appendChild(svgText('lake-label',496,668,'洞庭'));
  svg.appendChild(svgEl('ellipse',{class:'lake',cx:668,cy:618,rx:18,ry:12}));
  svg.appendChild(svgText('lake-label',668,642,'鄱阳'));
  svg.appendChild(svgEl('ellipse',{class:'lake',cx:856,cy:580,rx:14,ry:9}));
  svg.appendChild(svgText('lake-label',856,600,'太湖'));
  [[455,730],[505,755],[820,690],[862,700],[748,640]].forEach(p=>{
    const g=svgEl('g',{transform:`translate(${p[0]},${p[1]})`,opacity:.6});
    g.appendChild(svgEl('circle',{class:'tree-c',cx:0,cy:-5,r:5}));
    g.appendChild(svgEl('circle',{class:'tree-c',cx:7,cy:-2,r:4}));
    g.appendChild(svgEl('line',{class:'tree-t',x1:0,y1:3,x2:0,y2:-2}));
    svg.appendChild(g);
  });
  const comp=svgEl('g',{class:'compass',transform:'translate(38,838)'});
  comp.appendChild(svgEl('circle',{r:24,fill:'#141e30',stroke:'#4a5a78','stroke-width':1.5}));
  comp.appendChild(svgEl('path',{d:'M 0,-16 L 5,8 L 0,3 L -5,8 Z',fill:'#caa64b',opacity:.9}));
  comp.appendChild(svgText('',0,-30,'北',{fill:'#9aabc8','font-size':'13','text-anchor':'middle','font-family':'"Songti SC","KaiTi",serif'}));
  svg.appendChild(comp);
}

function buildMap(){
  svg.innerHTML='';
  applyVB();
  buildTerrain();
  cellRefs=[];
  const cellG=svgEl('g',{});
  computeCells().forEach((poly,i)=>{
    if(poly.length<3){cellRefs.push(null);return;}
    const p=svgEl('path',{class:'tcell',d:'M '+poly.map(pt=>pt[0].toFixed(1)+','+pt[1].toFixed(1)).join(' L ')+' Z'});
    cellG.appendChild(p);cellRefs.push(p);
  });
  svg.appendChild(cellG);
  if(store.get('sgbh_tcell')==='0')svg.classList.add('no-tcell');
  const eg=svgEl('g',{});
  EDGES.forEach(e=>{
    const a=e[0],b=e[1],t=e[2];
    eg.appendChild(svgEl('line',{class:'edge'+(t!=='p'?' '+t:''),x1:C(a).x,y1:C(a).y,x2:C(b).x,y2:C(b).y}));
    if(t!=='p'){
      const mx=(C(a).x+C(b).x)/2,my=(C(a).y+C(b).y)/2;
      const bg=svgEl('g',{transform:`translate(${mx},${my})`});
      const bz=svgEl('g',{class:'zoomer'});
      bz.appendChild(svgEl('circle',{class:'ebadge-bg',cx:0,cy:0,r:9.5}));
      const bt=svgText('ebadge',0,4,ETYPE_INFO[t].icon);
      bt.setAttribute('fill',t==='r'?'#7fb3e8':'#c8b88a');
      bz.appendChild(bt);
      bz.appendChild(svgText('ebadge-label lod-close',0,20,ETYPE_INFO[t].name));
      bg.appendChild(bz);
      eg.appendChild(bg);
    }
  });
  svg.appendChild(eg);
  cityRefs=[];
  state.cities.forEach((c,i)=>{
    const small=c.trait==='pass';
    const g=svgEl('g',{class:'city'+(small?' small':''),'data-id':i,transform:`translate(${c.x},${c.y})`});
    const z=svgEl('g',{class:'zoomer'});
    z.appendChild(svgEl('circle',{class:'ring',r:small?26:34}));
    if(c.cap)z.appendChild(svgEl('circle',{class:'capring',r:29}));
    z.appendChild(svgEl('circle',{class:'bshadow',cx:1.5,cy:3.5,r:small?17:24}));
    z.appendChild(svgEl('circle',{class:'body',r:small?17:24}));
    z.appendChild(svgEl('circle',{r:small?17:24,fill:'url(#shine)','pointer-events':'none'}));
    const fch=svgEl('text',{class:'fch',y:small?5:7});z.appendChild(fch);
    const ti=svgEl('text',{class:'ticon',y:small?-24:-32});ti.textContent=TRAITS[c.trait].icon;z.appendChild(ti);
    const nm=svgEl('text',{class:'name'+(c.cap?' cap':''),y:small?34:46});nm.textContent=(c.cap?'★':'')+c.name;z.appendChild(nm);
    const tr=svgEl('text',{class:'troops',y:small?48:63});z.appendChild(tr);
    z.appendChild(svgEl('text',{class:'cstats lod-near',y:small?61:77}));
    z.appendChild(svgEl('text',{class:'gline lod-near',y:small?74:91}));
    const tg=svgEl('text',{class:'ctag lod-close',y:small?87:105});
    tg.textContent='『'+c.tag.split('，')[0]+'』';z.appendChild(tg);
    g.appendChild(z);
    svg.appendChild(g);
    cityRefs.push({g,body:z.querySelector('.body'),fch,troops:tr,
      cstats:z.querySelector('.cstats'),gline:z.querySelector('.gline')});
  });
  svg.appendChild(svgEl('g',{id:'fx-layer'}));
  zoomerEls=[...svg.querySelectorAll('.zoomer')];
  zoomPtEls=[...svg.querySelectorAll('.zoom-pt')];
  lastK=0;updateZoomScale();
  renderMap();
}
function renderMap(){
  const myFid=state.player;
  state.cities.forEach((c,i)=>{
    const r=cityRefs[i];
    if(!r)return;
    r.body.setAttribute('fill',FACTS[c.owner].color);
    const cell=cellRefs[i];
    if(cell){
      cell.setAttribute('fill',FACTS[c.owner].color);
      cell.setAttribute('fill-opacity',c.owner==='neutral'?0.06:0.16);
    }
    r.fch.textContent=FACTS[c.owner].name;
    r.troops.textContent=fmtT(c.troops);
    r.cstats.textContent=`农${c.farm} 商${c.comm} 防${c.wall}`;
    const gg=generalsIn(i);
    r.gline.textContent=gg.length?gg.slice(0,3).map(x=>x.name).join(' ')+(gg.length>3?` 等${gg.length}将`:''):'';
    r.g.classList.remove('sel','atk','mov');
  });
  if(selected>=0){
    const sc=C(selected);
    cityRefs[selected].g.classList.add('sel');
    if(sc.owner===myFid){
      ADJ[selected].forEach(n=>{
        cityRefs[n].g.classList.add(C(n).owner===myFid?'mov':'atk');
      });
    }else{
      ADJ[selected].forEach(n=>{
        if(C(n).owner===myFid)cityRefs[n].g.classList.add('mov');
      });
    }
  }
}
function flashCity(i){
  const g=cityRefs[i]&&cityRefs[i].g;
  if(g){g.classList.remove('flash');requestAnimationFrame(()=>g.classList.add('flash'));
    setTimeout(()=>g.classList.remove('flash'),1100);}
}
function animateMarch(from,to,color,cb){
  const layer=$('#fx-layer');
  const a=C(from),b=C(to);
  const dot=svgEl('circle',{r:11,fill:color,stroke:'#fff','stroke-width':2.5});
  layer.appendChild(dot);
  Sound.play('march');
  const t0=performance.now(),dur=620;
  (function step(t){
    const p=Math.min(1,(t-t0)/dur),e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    dot.setAttribute('cx',a.x+(b.x-a.x)*e);
    dot.setAttribute('cy',a.y+(b.y-a.y)*e-Math.sin(p*Math.PI)*18);
    if(p<1)requestAnimationFrame(step);else{dot.remove();cb&&cb();}
  })(t0);
}

/* ============ 手势 ============ */
(function(){
  const ptrs=new Map();
  let vbStart=null,ctmInv=null,startMid=null,startDist=0,anchor=null,moved=0,downT=0;
  function ptUnderStart(x,y){
    const pt=svg.createSVGPoint();pt.x=x;pt.y=y;
    return pt.matrixTransform(ctmInv);
  }
  function mid(){
    const a=[...ptrs.values()];
    if(a.length===1)return{x:a[0].x,y:a[0].y};
    return{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};
  }
  function dist(){
    const a=[...ptrs.values()];
    if(a.length<2)return 0;
    return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
  }
  function beginGesture(){
    vbStart={...vb};
    ctmInv=svg.getScreenCTM().inverse();
    startMid=mid();startDist=dist();
    anchor=ptUnderStart(startMid.x,startMid.y);
  }
  svg.addEventListener('pointerdown',e=>{
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.size<=2)beginGesture();
    if(ptrs.size===1){moved=0;downT=performance.now();}
  });
  let rafPending=false;
  function doPan(){
    if(!vbStart||!ptrs.size)return;
    const cm=mid();
    let newW=vbStart.w;
    if(ptrs.size>=2&&startDist>0){
      const d=dist();
      if(d>0)newW=clamp(vbStart.w*startDist/d,MINW,MAXW);
    }
    const cmU=ptUnderStart(cm.x,cm.y);
    const k=newW/vbStart.w;
    vb.w=newW;vb.h=vbStart.h*k;
    vb.x=anchor.x-(cmU.x-vbStart.x)*k;
    vb.y=anchor.y-(cmU.y-vbStart.y)*k;
    clampVB();
    applyVB();
  }
  svg.addEventListener('pointermove',e=>{
    if(!ptrs.has(e.pointerId))return;
    const p=ptrs.get(e.pointerId);
    moved+=Math.hypot(e.clientX-p.x,e.clientY-p.y);
    p.x=e.clientX;p.y=e.clientY;
    if(!vbStart)return;
    if(!rafPending){rafPending=true;requestAnimationFrame(()=>{rafPending=false;doPan();});}
  });
  function up(e){
    const was=ptrs.size;
    ptrs.delete(e.pointerId);
    if(ptrs.size>0){beginGesture();return;}
    vbStart=null;
    if(was===1&&moved<12&&performance.now()-downT<600){
      const g=e.target.closest&&e.target.closest('g.city');
      if(busy)return;
      if(g)select(+g.dataset.id);
      else deselect();
    }
  }
  svg.addEventListener('pointerup',up);
  svg.addEventListener('pointercancel',up);
  svg.addEventListener('pointerleave',e=>{if(ptrs.has(e.pointerId))up(e);});
  svg.addEventListener('wheel',e=>{
    e.preventDefault();
    const k=e.deltaY>0?1.13:0.885;
    const newW=clamp(vb.w*k,MINW,MAXW);
    const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;
    const sp=pt.matrixTransform(svg.getScreenCTM().inverse());
    const kk=newW/vb.w;
    vb.x=sp.x-(sp.x-vb.x)*kk;vb.y=sp.y-(sp.y-vb.y)*kk;
    vb.w=newW;vb.h*=kk;
    clampVB();
    applyVB();
  },{passive:false});
})();
