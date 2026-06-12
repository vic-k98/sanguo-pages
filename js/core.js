'use strict';
/* ============================================================
 * 核心逻辑：状态 / 存档 / 经济 / 战斗 / 俘虏忠诚 / 科技 / 计略 / 外交
 * ============================================================ */
const $=s=>document.querySelector(s);
const rnd=(a,b)=>a+Math.random()*(b-a);
const ri=(a,b)=>Math.floor(rnd(a,b+1));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmtT=n=>n>=10000?(Math.round(n/1000)/10)+'万':''+n;
const fmtG=n=>Math.floor(n).toLocaleString('en-US');
const store={
  get(k){try{return localStorage.getItem(k)}catch(e){return null}},
  set(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}},
  del(k){try{localStorage.removeItem(k)}catch(e){}}
};
const SAVE_KEY='sgbh_save_v8';

/* ============ 音效 ============ */
const Sound={
  ctx:null,on:store.get('sgbh_sound')!=='0',
  init(){if(!this.ctx){try{this.ctx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}
    if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume();},
  tone(f,t,dur,type,vol){
    type=type||'sine';vol=vol===undefined?.18:vol;
    if(!this.on||!this.ctx)return;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type;o.frequency.value=f;o.connect(g);g.connect(this.ctx.destination);
    const now=this.ctx.currentTime+t;
    g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(vol,now+.012);
    g.gain.exponentialRampToValueAtTime(.001,now+dur);
    o.start(now);o.stop(now+dur+.05);
  },
  play(k){
    if(!this.on||!this.ctx)return;
    switch(k){
      case 'tap':this.tone(660,0,.06,'triangle',.1);break;
      case 'coin':this.tone(880,0,.09,'triangle');this.tone(1320,.07,.12,'triangle');break;
      case 'march':this.tone(220,0,.12,'square',.08);this.tone(180,.12,.14,'square',.08);break;
      case 'battle':this.tone(110,0,.25,'sawtooth',.14);this.tone(90,.18,.3,'sawtooth',.14);break;
      case 'duel':this.tone(1100,0,.07,'square',.1);this.tone(1400,.09,.07,'square',.1);this.tone(900,.18,.12,'square',.1);break;
      case 'win':[523,659,784,1047].forEach((f,i)=>this.tone(f,i*.11,.22,'triangle'));break;
      case 'lose':[440,370,294,220].forEach((f,i)=>this.tone(f,i*.13,.25,'sine'));break;
      case 'turn':this.tone(392,0,.1,'triangle');this.tone(523,.09,.14,'triangle');break;
      case 'hist':this.tone(330,0,.3,'sine',.12);this.tone(440,.22,.35,'sine',.12);break;
    }
  }
};
document.addEventListener('pointerdown',()=>Sound.init(),{once:false});

/* ============ 游戏状态 ============ */
let state=null,selected=-1,busy=false;

function newGame(playerFid,diff,opts){
  opts=Object.assign({wealth:1,hist:true,neu:1},opts||{});
  state={
    v:8,player:playerFid,diff:diff,turn:1,year:200,season:0,won:false,fired:[],opts:opts,
    factions:{},log:[],
    cities:CITY_DEFS.map(d=>({name:d[0],x:d[1],y:d[2],owner:d[3],
      troops:d[3]==='neutral'?Math.round(d[4]*opts.neu):d[4],
      farm:d[5],comm:d[6],wall:d[7],cap:d[8],trait:d[9],tag:d[10],tired:0,devUsed:false,recUsed:false})),
    generals:GEN_DEFS.map((g,i)=>({id:i,name:g[0],war:g[1],wu:g[2],int:g[3],pol:g[4],cha:g[5],
      fid:g[6],city:g[7],skill:g[8],title:null,
      loy:g[0]===FACTS[g[6]].leader?100:82+ri(0,14)})),
    pool:POOL_DEFS.map((g,i)=>({id:100+i,name:g[0],war:g[1],wu:g[2],int:g[3],pol:g[4],cha:g[5],debut:g[6],skill:g[7]})),
    pendingCaptives:[],
    rkLast:0,truce:{},stratUsed:false,
  };
  MAJORS.forEach(f=>{state.factions[f]={gold:Math.round(2000*opts.wealth),food:Math.round(2500*opts.wealth),
    alive:true,techs:[],researching:null}});
  addLog(`${FACTS[playerFid].leader}举义兵于${capOf(playerFid)}，大业自此始！`);
}
function capOf(fid){const c=state.cities.find(c=>c.owner===fid&&c.cap);return c?c.name:'';}
function C(i){return state.cities[i]}
function F(fid){return state.factions[fid]}
function cityIdsOf(fid){return state.cities.map((c,i)=>c.owner===fid?i:-1).filter(i=>i>=0)}
function generalsIn(cid){return state.generals.filter(g=>g.city===cid&&g.fid===C(cid).owner)}
function gensOf(fid){return state.generals.filter(g=>g.fid===fid)}
function bestGen(gens){return gens.reduce((a,b)=>effWar(a)>effWar(b)?a:b)}
function bestWuGen(gens){return gens.reduce((a,b)=>duelPower(a)>duelPower(b)?a:b)}
function skillName(g){return g.skill?SKILLS[g.skill].name:''}
function hasSkillIn(cid,sk){return generalsIn(cid).some(g=>g.skill===sk)}
function courtHas(fid,sk){return state.generals.some(g=>g.fid===fid&&g.skill===sk)}
function duelPower(g){return g.wu+(g.skill==='shen'?12:0)}
function armyMult(gens){
  if(!gens.length)return 1;
  const best=Math.max(...gens.map(g=>effWar(g)));
  let m=1+(best-60)/150+0.02*Math.min(gens.length-1,3);
  if(gens.some(g=>g.skill==='fei'))m*=1.08; // 飞将
  return m;
}
function leadName(gens){return gens.length?bestGen(gens).name:'无'}
function maxLv(c,kind){return kind==='wall'?6:(c.trait==='pass'?3:10)}
function recruitMult(c){
  let m=c.trait==='horse'?0.75:c.trait==='wild'?0.65:1;
  if(hasSkillIn(state.cities.indexOf(c),'mu'))m*=0.8;          // 募兵
  if(MAJORS.includes(c.owner)&&techDone(c.owner,'zheng'))m*=0.85; // 征兵令
  return m;
}
function rankIdxOf(fid){const n=cityIdsOf(fid).length;let r=0;RANKS.forEach((x,i)=>{if(n>=x.c)r=i});return r;}
function titleOf(g){return g.title?TITLES.find(t=>t.id===g.title):null}
function effWar(g){const t=titleOf(g);return Math.min(100,g.war+(t?t.bonus:0))}
function countTitle(fid,id){return state.generals.filter(g=>g.fid===fid&&g.title===id).length}
function techDone(fid,id){return F(fid)&&F(fid).techs&&F(fid).techs.includes(id)}
function dateStr(){return `${state.year}年 ${SEASONS[state.season]}`}
function addLog(msg){state.log.push(`【${dateStr()}】${msg}`);if(state.log.length>300)state.log.shift()}
function availPool(){return state.pool.filter(p=>p.debut<=state.year)}
function drawPool(){
  const av=availPool();
  if(!av.length)return null;
  const g=av[ri(0,av.length-1)];
  state.pool.splice(state.pool.indexOf(g),1);
  return g;
}
function hireGeneral(g,fid,cid,loy){
  state.generals.push({id:g.id,name:g.name,war:g.war,wu:g.wu,int:g.int||50,pol:g.pol||50,cha:g.cha||50,
    fid:fid,city:cid,skill:g.skill||null,title:null,loy:loy||85});
}
function toPool(g){
  const i=state.generals.indexOf(g);
  if(i>=0)state.generals.splice(i,1);
  state.pool.push({id:g.id,name:g.name,war:g.war,wu:g.wu,int:g.int,pol:g.pol,cha:g.cha,debut:state.year,skill:g.skill});
}
function save(){
  if(!store.set(SAVE_KEY,JSON.stringify(state))&&!save.warned){
    save.warned=true;toast('⚠️ 此环境无法持久存档，关闭页面进度将丢失');
  }
}
function loadSave(){
  const s=store.get(SAVE_KEY);
  if(!s)return false;
  try{const o=JSON.parse(s);if(o&&o.v===8&&o.cities&&o.cities.length===CITY_DEFS.length){state=o;return true}}catch(e){}
  return false;
}

/* ============ 计略 ============ */
function stratIntOf(fid){
  const gs=gensOf(fid);
  let v=gs.length?Math.max(...gs.map(g=>g.int)):50;
  if(courtHas(fid,'suan'))v+=12;       // 神算
  return v;
}
function stratChance(cid){
  const atk=stratIntOf(state.player);
  const dg=generalsIn(cid);
  let def=dg.length?Math.max(...dg.map(g=>g.int)):50;
  if(hasSkillIn(cid,'kan'))def+=20;    // 看破
  return clamp(0.5+(atk-def)/200,0.15,0.9);
}
function stratCost(base){return courtHas(state.player,'gui')?Math.round(base*0.6):base} // 鬼谋
function doStrat(cid,kind){
  const c=C(cid),f=F(state.player);
  if(state.stratUsed)return;
  const cost=stratCost(kind==='rumor'?600:kind==='burn'?900:1500);
  if(f.gold<cost){toast('💰 金钱不足');return;}
  f.gold-=cost;state.stratUsed=true;
  const ok=Math.random()<stratChance(cid);
  if(!ok){
    Sound.play('lose');
    toast(`💨 细作败露，${c.name} 守备愈严！`);addLog(`行计 ${c.name} 败露`);
  }else{
    Sound.play('coin');flashCity(cid);
    if(kind==='rumor'){
      c.wall=Math.max(0,c.wall-1);
      toast(`🗣 流言四起，${c.name} 城防松动（-1）！`);addLog(`流言乱 ${c.name}，城防受损`);
    }else if(kind==='burn'){
      const d=Math.floor(c.troops*0.12);
      c.troops-=d;c.tired=Math.min(c.tired,c.troops);
      if(MAJORS.includes(c.owner))F(c.owner).food=Math.max(0,F(c.owner).food-800);
      toast(`🔥 火烧粮屯！${c.name} 守军折损 ${d}`);addLog(`烧 ${c.name} 粮屯，敌军折损 ${d}`);
    }else{
      const dg=generalsIn(cid);
      if(dg.length){
        const g=dg[ri(0,dg.length-1)];
        g.loy=Math.max(0,(g.loy||80)-30);
        if(g.loy<50){
          toPool(g);
          toast(`🕊 离间得逞！${g.name} 心灰意冷，挂印而去`);addLog(`离间 ${c.name}，${g.name} 出走在野`);
        }else{
          toast(`🕊 流言入耳，${g.name} 心生嫌隙（忠诚 ${g.loy}）`);addLog(`离间 ${g.name}，其忠诚动摇`);
        }
      }
    }
  }
  save();renderAll();
}

/* ============ 战力计算 ============ */
function terrainFactor(et,gens,fromTrait){
  let pen=et==='r'?(fromTrait==='port'?0:0.15):et==='m'?0.12:0;
  if(pen>0&&gens&&gens.some(g=>g.skill==='ji'))pen*=0.5; // 疾驰
  return 1-pen;
}
function atkPowerOf(commit,gens,fromCid,toCid){
  let m=armyMult(gens);
  const t=C(fromCid).trait;
  const fid=C(fromCid).owner;
  if(t==='horse'||t==='port')m*=1.08;
  if(state.season===3)m*=0.9;
  if(MAJORS.includes(fid)){
    if(techDone(fid,'qiang'))m*=1.05;
    if(toCid!==undefined&&techDone(fid,'qixie'))m*=1.08;
  }
  if(toCid!==undefined)m*=terrainFactor(edgeType(fromCid,toCid),gens,t);
  return commit*m;
}
function terrainNote(fromCid,toCid){
  const et=edgeType(fromCid,toCid);
  if(et==='r')return C(fromCid).trait==='port'?'⛵ 舟师渡江，如履平地':'🌊 渡江强攻 -15%';
  if(et==='m')return '⛰ 山道险阻 -12%';
  return '';
}
function defPowerOf(cid){
  const d=C(cid);
  let m=armyMult(generalsIn(cid))*(1+d.wall*0.06)*1.12;
  if(d.trait==='fort')m*=1.15;
  if(d.trait==='pass')m*=1.3;
  if(hasSkillIn(cid,'tie'))m*=1.1;                       // 铁壁
  if(MAJORS.includes(d.owner)&&techDone(d.owner,'shou'))m*=1.08;
  if(MAJORS.includes(d.owner)&&cityIdsOf(d.owner).length<=3)m*=1.1;
  return Math.max(1,d.troops)*m;
}

/* ============ 武将去留：城破俘虏 / 出奔 ============ */
function captureOrFlee(cid,attFid,report){
  const owner=C(cid).owner;
  const others=cityIdsOf(owner).filter(i=>i!==cid);
  state.generals.filter(g=>g.fid===owner&&g.city===cid).forEach(g=>{
    const isLeader=g.name===FACTS[owner].leader;
    if(g.skill!=='yun'&&!isLeader&&Math.random()<0.4){ // 强运/君主不被俘
      g.fid='cap';g.city=-1;g.captor=attFid;
      if(report)report.captives.push(g.id);
    }else if(others.length){
      g.city=others[ri(0,others.length-1)];
    }else{
      toPool(g);
    }
  });
}
function tryRecruitCaptive(g,fid){
  const gs=gensOf(fid);
  const charm=gs.length?Math.max(...gs.map(x=>x.cha)):60;
  let p=clamp(0.7-(g.loy||80)/150+charm/400+(courtHas(fid,'ren')?0.15:0),0.05,0.9);
  if(Math.random()<p){
    g.fid=fid;g.title=null;g.loy=62+ri(0,10);
    const home=cityIdsOf(fid);
    g.city=home.length?home[ri(0,home.length-1)]:-1;
    delete g.captor;
    return true;
  }
  return false;
}
function releaseCaptive(g){
  const orig=MAJORS.find(f=>gensOf(f).length&&false); // 原势力不可考则归野
  const ownerAlive=MAJORS.find(f=>FACTS[f].leader!==g.name&&false);
  // 简化：释放即归在野（乱世飘零）
  delete g.captor;
  toPool(g);
}
function checkElimination(fid){
  if(!MAJORS.includes(fid))return;
  if(cityIdsOf(fid).length===0&&F(fid).alive){
    F(fid).alive=false;
    state.generals.filter(g=>g.fid===fid).forEach(g=>{g.fid='pool2';toPool(g)});
    state.generals=state.generals.filter(g=>g.fid!=='pool2');
    const msg=`💀 ${FACTS[fid].name}国覆灭，${FACTS[fid].leader}败走！`;
    addLog(msg);toast(msg);
  }
}
function maybeRecruitPool(fid,cid){
  if(Math.random()>0.5)return null;
  const g=drawPool();
  if(!g)return null;
  hireGeneral(g,fid,cid,80);
  return g;
}
function nerfCities(fid,keep){
  const k=(state&&fid===state.player)?(1+keep)/2:keep;
  cityIdsOf(fid).forEach(i=>{const c=C(i);c.troops=Math.max(800,Math.floor(c.troops*k));c.tired=Math.min(c.tired,c.troops)});
}

/* ============ 战斗 ============ */
function doBattle(from,to,commit,genIds){
  const A=C(from),D=C(to);
  const attFid=A.owner,defFid=D.owner;
  const ag=genIds.map(id=>state.generals.find(g=>g.id===id)).filter(Boolean);
  const dg=generalsIn(to);
  let duel=null,duelA=1,duelD=1;
  if(ag.length&&dg.length&&Math.random()<0.35){
    const a=bestWuGen(ag),d=bestWuGen(dg);
    const aWin=duelPower(a)+rnd(0,30)>duelPower(d)+rnd(0,30);
    if(aWin)a.wu=Math.min(100,a.wu+1);else d.wu=Math.min(100,d.wu+1);
    const winner=aWin?a:d;
    const extra=winner.skill==='wei'?0.05:0; // 威风
    duel={a:a.name,d:d.name,aWin,
      text:DUEL_WIN[ri(0,DUEL_WIN.length-1)]
        .replaceAll('{w}',aWin?a.name:d.name).replaceAll('{l}',aWin?d.name:a.name)
        .replaceAll('{s}',aWin?'攻':'守')};
    if(aWin)duelA=1.15+extra;else duelD=1.15+extra;
  }
  const atkP=atkPowerOf(commit,ag,from,to)*duelA*rnd(0.88,1.12);
  const defP=defPowerOf(to)*duelD*rnd(0.88,1.12);
  const tot=atkP+defP;
  const won=atkP>defP;
  let attLoss=Math.min(commit,Math.round(commit*(defP/tot)*0.9));
  let defLoss;
  A.troops-=commit;A.tired=Math.min(A.tired,A.troops);
  let joined=null;
  const report={from,to,attFid,defFid,commit,won,duel,captives:[],
    attLead:leadName(ag),defLead:leadName(dg),
    involvesPlayer:attFid===state.player||defFid===state.player};
  if(won){
    defLoss=D.troops;
    const surv=commit-attLoss;
    captureOrFlee(to,attFid,report);
    const prevOwner=D.owner;
    D.owner=attFid;D.troops=surv;D.tired=surv;
    D.wall=Math.max(0,D.wall-1);D.devUsed=false;D.recUsed=false;
    ag.forEach(g=>g.city=to);
    if(ag.length){const lg=bestGen(ag);lg.war=Math.min(99,lg.war+1);}
    if(prevOwner==='neutral')joined=maybeRecruitPool(attFid,to);
    addLog(`${FACTS[attFid].name}军${leadName(ag)!=='无'?'('+leadName(ag)+')':''} 攻克 ${D.name}！歼敌 ${defLoss}，自损 ${attLoss}`);
    checkElimination(prevOwner);
  }else{
    defLoss=Math.min(D.troops,Math.round(D.troops*(atkP/tot)*0.9));
    const surv=commit-attLoss;
    A.troops+=surv;A.tired+=surv;
    D.troops-=defLoss;
    if(dg.length){const lg=bestGen(dg);lg.war=Math.min(99,lg.war+1);}
    let wallNote='';
    const ramOk=atkP>defP*0.6||(MAJORS.includes(attFid)&&techDone(attFid,'qixie'));
    if(ramOk&&D.wall>0){D.wall--;wallNote=`，${D.name} 城垣受损`;}
    addLog(`${FACTS[attFid].name}军强攻 ${D.name} 受挫，损兵 ${attLoss}，守军折损 ${defLoss}${wallNote}`);
  }
  flashCity(to);
  report.attLoss=attLoss;report.defLoss=defLoss;report.joined=joined;
  // 俘虏处置：AI 立即招降，玩家进入待决名单
  report.captives.slice().forEach(gid=>{
    const g=state.generals.find(x=>x.id===gid);
    if(!g)return;
    if(attFid===state.player){
      state.pendingCaptives.push(gid);
    }else{
      if(tryRecruitCaptive(g,attFid)){
        if(report.involvesPlayer)addLog(`${g.name} 被${FACTS[attFid].name}军俘获，归降之`);
      }else releaseCaptive(g);
    }
  });
  return report;
}
function doTransfer(from,to,n,genIds){
  const A=C(from),B=C(to);
  A.troops-=n;A.tired=Math.min(A.tired,A.troops);
  B.troops=Math.min(TROOP_CAP,B.troops+n);
  if(!techDone(A.owner,'yi'))B.tired+=n; // 驿传：调动无需休整
  genIds.forEach(id=>{const g=state.generals.find(g=>g.id===id);if(g)g.city=to;});
  addLog(`${A.name} 移兵 ${n} 至 ${B.name}`);
}

/* ============ 外交 ============ */
function truceLeft(fid){return (state.truce&&state.truce[fid])||0}

/* ============ 科技 ============ */
function startResearch(fid,techId){
  const f=F(fid),t=TECHS.find(x=>x.id===techId);
  if(!t||f.researching||f.techs.includes(techId)||f.gold<t.cost)return false;
  f.gold-=t.cost;
  f.researching={id:techId,left:t.turns};
  return true;
}
function tickResearch(){
  MAJORS.forEach(fid=>{
    const f=F(fid);
    if(!f.alive||!f.researching)return;
    f.researching.left--;
    if(f.researching.left<=0){
      f.techs.push(f.researching.id);
      const t=TECHS.find(x=>x.id===f.researching.id);
      f.researching=null;
      if(fid===state.player){
        Sound.play('win');
        toast(`📖 「${t.name}」研习功成！${t.desc}`);addLog(`研成 ${t.name}`);
      }
    }
  });
}

/* ============ 经济与时间 ============ */
function neutralRegen(){
  const cap=Math.round(14000*(state.opts?state.opts.neu:1));
  state.cities.forEach(c=>{
    if(c.owner==='neutral'&&c.troops<cap)c.troops=Math.min(cap,c.troops+250);
  });
}
function incomeAll(){
  MAJORS.forEach(fid=>{
    const f=F(fid);
    if(!f.alive)return;
    const mult=fid===state.player?1:state.diff;
    let gold=0,food=0,troops=0;
    cityIdsOf(fid).forEach(i=>{
      const c=C(i);
      let g=(GOLD_BASE+c.comm*GOLD_PER_COMM)*(c.trait==='trade'?1.4:1);
      let fd=c.farm*FOOD_PER_FARM*(state.season===2?2:1)*(c.trait==='gran'?1.4:1);
      if(hasSkillIn(i,'shang'))g*=1.2;  // 商才
      if(hasSkillIn(i,'tun'))fd*=1.2;   // 屯田
      gold+=g;food+=fd;troops+=c.troops;
    });
    if(techDone(fid,'shi'))gold*=1.15;
    if(techDone(fid,'tun'))food*=1.15;
    let upkeep=troops*UPKEEP;
    if(techDone(fid,'juntun'))upkeep*=0.8;
    f.gold+=Math.round(gold*mult*(1+RANKS[rankIdxOf(fid)].inc));
    f.food+=Math.round(food*mult-upkeep);
    if(f.food<0){
      cityIdsOf(fid).forEach(i=>{const c=C(i);const d=Math.floor(c.troops*0.08);c.troops-=d;c.tired=Math.min(c.tired,c.troops);});
      f.food=0;
      if(fid===state.player){toast('⚠️ 军粮告罄，士卒逃散！');addLog('军粮不足，各城士卒逃散 8%');}
    }
  });
}
function randomEvent(){
  if(Math.random()>0.3)return;
  const ids=cityIdsOf(state.player);
  if(!ids.length)return;
  const cid=ids[ri(0,ids.length-1)],c=C(cid);
  const ev=EVENTS[ri(0,EVENTS.length-1)];
  ev.f(F(state.player),c);
  const msg=ev.t.replace('{c}',c.name);
  toast(msg);addLog(msg);
}
function checkDefections(){
  state.generals.slice().forEach(g=>{
    if(!MAJORS.includes(g.fid))return;
    if(g.name===FACTS[g.fid].leader)return;
    if((g.loy||80)<55&&Math.random()<0.1){
      const wasPlayer=g.fid===state.player;
      toPool(g);
      const msg=`💔 ${g.name} 不满已久，弃官出走，流落在野！`;
      addLog(msg);
      if(wasPlayer)toast(msg);
    }
  });
}
function advanceTime(){
  state.turn++;
  state.season++;
  if(state.season>3){
    state.season=0;state.year++;
    state.pool.filter(p=>p.debut===state.year).forEach(p=>{
      const msg=`🌟 少年英杰「${p.name}」（统${p.war}/武${p.wu}/智${p.int}）初出茅庐，流落在野`;
      toast(msg);addLog(msg);
    });
  }
  state.cities.forEach(c=>{c.tired=0;c.devUsed=false;c.recUsed=false;});
  state.stratUsed=false;
  if(state.truce)Object.keys(state.truce).forEach(k=>{if(state.truce[k]>0)state.truce[k]--});
  tickResearch();
  checkDefections();
}
function checkHistory(){
  if(state.opts&&!state.opts.hist)return [];
  const fired=[];
  HISTORY.forEach(h=>{
    if(state.fired.includes(h.id))return;
    if(state.year<h.y||(state.year===h.y&&state.season<h.s))return;
    state.fired.push(h.id);
    if(!h.cond())return;
    let extra='';
    try{extra=h.fx()||''}catch(e){}
    fired.push({title:h.title,text:h.text+(extra?'<br>'+extra:''),year:h.y});
    addLog(`〔史〕${h.title}`);
  });
  return fired;
}
