'use strict';
/* ============================================================
 * UI：顶栏 / 城市面板 / 各类弹窗 / 主题
 * ============================================================ */
function toast(msg){
  const t=document.createElement('div');
  t.className='toast';t.textContent=msg;
  $('#toasts').appendChild(t);
  setTimeout(()=>t.remove(),3400);
}
const mroot=$('#modal-root');
function modal(html,opts){
  opts=opts||{};
  mroot.innerHTML=`<div class="modal">${html}</div>`;
  mroot.classList.add('show');
  mroot.onclick=e=>{if(e.target===mroot&&!opts.lock)closeModal()};
  return mroot.firstElementChild;
}
function closeModal(){mroot.classList.remove('show');mroot.innerHTML='';}

function renderTopbar(){
  const f=F(state.player),fd=FACTS[state.player];
  $('#tb-fact').textContent=`${fd.name}·${fd.leader}·${RANKS[rankIdxOf(state.player)].name}`;
  $('#tb-fact').style.color=fd.color;
  $('#tb-date').textContent=SEASON_EMO[state.season]+' '+dateStr();
  $('#tb-gold').textContent='💰 '+fmtG(f.gold);
  $('#tb-food').textContent='🌾 '+fmtG(f.food);
  $('#tb-city').textContent=`🏯 ${cityIdsOf(state.player).length}/${WIN_CITIES}`;
  renderPowerbar();
}
/* 势力概览条：信息聚合，点击聚焦该势力并弹概况（无弹窗） */
function renderPowerbar(){
  const pb=$('#powerbar');
  if(!pb||!state)return;
  const rows=MAJORS.filter(f=>F(f).alive&&cityIdsOf(f).length>0)
    .map(f=>({f,n:cityIdsOf(f).length})).sort((a,b)=>b.n-a.n);
  pb.innerHTML=rows.map(r=>`<span class="pb-item${r.f===state.player?' me':''}" data-pf="${r.f}">
    <i style="background:${FACTS[r.f].color};width:${6+r.n*3}px"></i>${FACTS[r.f].name}${r.n}${truceLeft(r.f)>0&&r.f!==state.player?'🤝':''}</span>`).join('')
    +`<span class="pb-item" style="cursor:default;opacity:.55"><i style="background:#7d8590;width:${6+cityIdsOf('neutral').length*2}px"></i>群${cityIdsOf('neutral').length}</span>`;
}
$('#powerbar').addEventListener('click',e=>{
  const b=e.target.closest('[data-pf]');
  if(!b||!state)return;
  const f=b.dataset.pf;
  const ids=cityIdsOf(f);
  if(!ids.length)return;
  const cx=ids.reduce((a,i)=>a+C(i).x,0)/ids.length,cy=ids.reduce((a,i)=>a+C(i).y,0)/ids.length;
  vb.x=cx-vb.w/2;vb.y=cy-vb.h/2;clampVB();applyVB();
  const troops=ids.reduce((a,i)=>a+C(i).troops,0);
  toast(`${FACTS[f].name}·${FACTS[f].leader}　${ids.length} 城 · 兵 ${fmtT(troops)} · ${gensOf(f).length} 将 · ${RANKS[rankIdxOf(f)].name}${f!==state.player&&truceLeft(f)>0?' · 停战剩'+truceLeft(f):''}`);
  Sound.play('tap');
});
function renderAll(){renderMap();renderTopbar();checkRank();if(selected>=0)renderPanel();}
let armyTarget=-1,recruitOpen=false; // 面板内嵌交互状态
function select(i){
  if(selected!==i){armyTarget=-1;recruitOpen=false;}
  selected=i;
  renderMap();renderPanel();
  $('#panel').classList.add('show');
  document.body.classList.add('panel-open');
  Sound.play('tap');
}
function deselect(){
  selected=-1;armyTarget=-1;recruitOpen=false;
  $('#panel').classList.remove('show');
  document.body.classList.remove('panel-open');
  renderMap();
}
function deselectKeepPanel(){selected=-1;armyTarget=-1;recruitOpen=false;$('#panel').classList.remove('show');document.body.classList.remove('panel-open');renderMap();}
function ownerTag(fid){
  const fd=FACTS[fid];
  return `<span class="ftag" style="color:${fd.color};border-color:${fd.color}">${fd.name} · ${fd.leader}</span>`;
}
function gchipHTML(g){
  const dot=g.fid===state.player?`<i style="display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:3px;background:${g.loy>=80?'#6fe89a':g.loy>=60?'#e8c96a':'#ff7a7a'}"></i>`:'';
  return `<span class="gchip">${dot}${titleOf(g)?'⚜':''}${g.name}·${effWar(g)}${g.skill?'<small style="color:#e8c96a">·'+SKILLS[g.skill].name+'</small>':''}</span>`;
}
function renderPanel(){
  if(selected<0)return;
  const c=C(selected),mine=c.owner===state.player,f=F(state.player);
  const fresh=c.troops-c.tired;
  const gens=generalsIn(selected);
  const t=TRAITS[c.trait];
  const gHtml=gens.length?gens.map(gchipHTML).join('')
    :'<span class="dim" style="font-size:12px">无驻将</span>';
  let html=`
  <div class="p-head">
    <span class="cname serif">${c.cap?'★':''}${c.name}</span>${ownerTag(c.owner)}
    <button class="icon-btn x" data-act="close">✕</button>
  </div>
  <div class="flavor">『 ${c.tag} 』</div>
  <div class="statrow">
    <span class="stat">⚔️ 兵力 <b>${fmtT(c.troops)}</b><span class="dim">/${fmtT(cityCap(c))}</span>${mine&&c.tired>0?` <span class="dim">(可战 ${fmtT(fresh)})</span>`:''}</span>
    <span class="stat">🛡 城防 ${c.wall}</span>
    <span class="stat">🌾 农业 ${c.farm}</span>
    <span class="stat">💰 商业 ${c.comm}</span>
    <span class="stat trait">${t.icon} ${t.name} · ${t.desc}</span>
  </div>
  ${(()=>{const gov=governorOf(selected);
    return gov?`<div style="font-size:12px;margin-bottom:6px;color:#d9c08a">✦ 太守 <b>${gov.name}</b>（政 ${gov.pol}）理政，金粮 +${Math.round(Math.min(0.25,gov.pol/400)*100)}%</div>`
      :(gens.length===0&&MAJORS.includes(c.owner)?`<div style="font-size:12px;margin-bottom:6px;color:#ff9a9a">⚠ 无将驻守：守军战力 -10%，出征/运兵至多 8000</div>`:'');})()}
  <div class="gens">${gHtml}</div>`;
  if(mine){
    const dF=devCost(c.farm),dC=devCost(c.comm);
    let dW=wallCost(c.wall);
    if(hasSkillIn(selected,'zhu'))dW=Math.round(dW/2); // 筑城特技
    const used=c.devUsed;
    const rm=recruitMult(c);
    const mF=maxLv(c,'farm'),mC=maxLv(c,'comm'),mW=maxLv(c,'wall');
    html+=`<div class="sec-title">内 政 ${used?'<span style="color:#caa64b">（本回合已执行）</span>':''}</div>
    <div class="actgrid">
      <button class="btn" data-act="dev-farm" ${used||c.farm>=mF||f.gold<dF?'disabled':''}>🌾 劝农<small>${c.farm>=mF?'已满级':dF+'金'}</small></button>
      <button class="btn" data-act="dev-comm" ${used||c.comm>=mC||f.gold<dC?'disabled':''}>💰 通商<small>${c.comm>=mC?'已满级':dC+'金'}</small></button>
      <button class="btn" data-act="dev-wall" ${used||c.wall>=mW||f.gold<dW?'disabled':''}>🛡 筑城<small>${c.wall>=mW?'已满级':dW+'金'}</small></button>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn gold" style="flex:2.2;flex-direction:row;justify-content:space-between;padding:12px 14px" data-act="recruit" ${c.recUsed||c.troops>=cityCap(c)?'disabled':''}>
        <span>⚔️ 征兵 ${recruitOpen?'▲':'▼'}</span><small>${c.recUsed?'已征募':c.troops>=cityCap(c)?'营垒已满':`${(RG*rm).toFixed(2)}金+${(RF*rm).toFixed(2)}粮/人`}</small>
      </button>
      <button class="btn gold" style="flex:1;flex-direction:row;padding:12px 6px" data-act="qrec" ${c.recUsed||c.troops>=cityCap(c)?'disabled':''}>
        <span>⚡速征</span>
      </button>
    </div>`;
    // —— 征兵内嵌区 ——
    if(recruitOpen&&!c.recUsed){
      const max=Math.min(RECRUIT_CAP,cityCap(c)-c.troops,Math.floor(f.gold/(RG*rm)/100)*100,Math.floor(f.food/(RF*rm)/100)*100);
      if(max>=100){
        html+=`<div class="inline-box" data-max="${max}">
          <div style="text-align:center;font-size:24px;font-weight:800;color:#e8c96a"><span id="ir-n">${Math.min(2000,max)}</span> <span style="font-size:13px">人</span>
            <span class="dim" style="font-size:12px">　💰<span id="ir-g"></span> 🌾<span id="ir-f"></span></span></div>
          <input type="range" id="ir-slider" min="100" max="${max}" step="100" value="${Math.min(2000,max)}">
          <div class="qbtns"><button data-irq=".25">25%</button><button data-irq=".5">50%</button><button data-irq=".75">75%</button><button data-irq="1">全力</button>
            <button class="go" data-act="ir-go">征募！</button></div>
        </div>`;
      }else html+=`<div class="dim" style="font-size:12px;margin-top:6px">金钱或粮草不足，无法征兵</div>`;
    }
    // —— 出兵 ——
    if(armyTarget>=0&&ADJ[selected].includes(armyTarget)){
      const B=C(armyTarget),hostile=B.owner!==state.player;
      const dGens=generalsIn(armyTarget);
      const cap0=Math.min(Math.max(500,fresh),leadCap(gens)); // 初始：全将统御
      let def=Math.min(cap0,hostile?Math.ceil(B.troops*1.6/100)*100+1000:Math.floor(fresh/2/100)*100);
      def=clamp(def,500,cap0);
      const gHtml=gens.length?gens.map(g=>
        `<label class="gchk"><input type="checkbox" data-iag="${g.id}" checked>${titleOf(g)?'⚜':''}${g.name} 统${effWar(g)}<small class="dim">·御${fmtT(effWar(g)*300)}</small></label>`).join('')
        :'<span class="dim" style="font-size:12px">本城无武将随行（民兵至多 8000）</span>';
      html+=`<div class="sec-title">${hostile?'⚔️ 进攻':'🚚 调动'} → ${B.name}
        ${hostile?`<span class="dim">（${FACTS[B.owner].name}军 ${fmtT(B.troops)} · 防${B.wall} · ${leadName(dGens)}守）</span>`:''}</div>
      <div class="inline-box">
        <div style="text-align:center;font-size:24px;font-weight:800;color:#e8c96a"><span id="ia-n"></span> <span style="font-size:13px">兵</span>
          <span class="dim" style="font-size:11px">　统御上限 <span id="ia-cap"></span></span></div>
        <input type="range" id="ia-slider" min="500" max="${cap0}" step="100" value="${def}">
        <div class="qbtns"><button data-iaq=".25">25%</button><button data-iaq=".5">50%</button><button data-iaq=".75">75%</button><button data-iaq="1">全军</button></div>
        <div style="margin-top:6px">${gHtml}</div>
        <div class="est" id="ia-est" style="margin-top:8px"></div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn" style="flex:1;flex-direction:row" data-act="ia-cancel">返 回</button>
          <button class="btn primary" style="flex:2;flex-direction:row;background:linear-gradient(#d9b455,#9a7a28);border-color:#e8c96a;color:#221a06;font-weight:700" data-act="ia-go">${hostile?'出 征 ！':'调 动'}</button>
        </div>
      </div>`;
    }else{
      html+=`<div class="sec-title">出 兵（可战 ${fmtT(fresh)}）${state.season===3?'<span style="color:#7fb3e8">❄️ 冬季 -10%</span>':''}</div>`;
      ADJ[selected].forEach(n=>{
        const tc=C(n),hostile=tc.owner!==state.player;
        const dg=generalsIn(n);
        const et=edgeType(selected,n);
        const eTag=et!=='p'?` · ${ETYPE_INFO[et].icon}${ETYPE_INFO[et].name}`:'';
        html+=`<div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn ${hostile?'atk':'mov'}" style="flex:1;flex-direction:row;justify-content:space-between;padding:12px 12px" data-act="army:${n}" ${fresh<500?'disabled':''}>
            <span>${hostile?'⚔️ 进攻':'🚚 调动'} → ${tc.name}</span>
            <small>${FACTS[tc.owner].name}军 ${fmtT(tc.troops)}${hostile?` · 防${tc.wall}${dg.length?' · '+leadName(dg):''}`:''}${eTag}</small>
          </button>
          <button class="btn ${hostile?'atk':'mov'}" style="flex:none;flex-direction:row;padding:12px 9px" data-act="quick:${n}" ${fresh<500?'disabled':''} title="${hostile?'全军即刻出击':'移防一半兵力'}">
            <span>⚡</span>
          </button>
        </div>`;
      });
      if(fresh<500)html+=`<div class="dim" style="font-size:12px;margin-top:6px">可战之兵不足 500，无法出兵（新兵需休整一回合）</div>`;
    }
  }else{
    const sources=ADJ[selected].filter(n=>C(n).owner===state.player);
    html+=`<div class="sec-title">情 报</div>
    <div style="font-size:13.5px;line-height:1.8" class="dim">${c.owner==='neutral'
      ?'群雄割据之城，守军不属任何大势力。攻占中立城池有机会招揽在野名将。'
      :FACTS[c.owner].leader+'治下之城。'}</div>`;
    const sp=stratChance(selected);
    const used=state.stratUsed;
    const c1=stratCost(600),c2=stratCost(900),c3=stratCost(1500);
    html+=`<div class="sec-title">计 略（成算 ${Math.round(sp*100)}%${used?' · 本回合已用计':''}${courtHas(state.player,'gui')?' · 鬼谋减费':''}）</div>
    <div class="actgrid">
      <button class="btn" data-act="strat-rumor" ${used||f.gold<c1?'disabled':''}>🗣 流言<small>${c1}金 · 城防-1</small></button>
      <button class="btn" data-act="strat-burn" ${used||f.gold<c2?'disabled':''}>🔥 烧粮<small>${c2}金 · 守军-12%</small></button>
      <button class="btn" data-act="strat-turn" ${used||f.gold<c3||!gens.length?'disabled':''}>🕊 离间<small>${c3}金 · 摇其忠心</small></button>
    </div>`;
    if(sources.length){
      html+=`<div class="sec-title">可由以下城池发兵</div>`;
      sources.forEach(n=>{
        const s=C(n),fr=s.troops-s.tired;
        html+=`<button class="btn wide atk" data-act="armyfrom:${n}" ${fr<500?'disabled':''}>
          <span>⚔️ 自 ${s.name} 出击</span><small>可战 ${fmtT(fr)}</small></button>`;
      });
    }else{
      html+=`<div class="dim" style="font-size:12px;margin-top:8px">无相邻己方城池，需先打通进军路线</div>`;
    }
  }
  $('#panel').innerHTML=html;
  bindPanelInline();
}
/* 面板内嵌控件绑定（滑杆/估算实时刷新） */
function bindPanelInline(){
  const p=$('#panel');
  // 征兵滑杆
  const irs=p.querySelector('#ir-slider');
  if(irs){
    const c=C(selected),rm=recruitMult(c);
    const upd=()=>{
      const n=+irs.value;
      p.querySelector('#ir-n').textContent=n.toLocaleString();
      p.querySelector('#ir-g').textContent=fmtG(n*RG*rm);
      p.querySelector('#ir-f').textContent=fmtG(n*RF*rm);
    };
    irs.addEventListener('input',upd);upd();
    p.querySelectorAll('[data-irq]').forEach(b=>b.onclick=()=>{
      const max=+p.querySelector('.inline-box').dataset.max;
      irs.value=Math.max(100,Math.floor(max*+b.dataset.irq/100)*100);upd();Sound.play('tap');
    });
  }
  // 出兵滑杆
  const ias=p.querySelector('#ia-slider');
  if(ias&&armyTarget>=0){
    const from=selected,to=armyTarget;
    const A=C(from),B=C(to),hostile=B.owner!==state.player;
    const fresh=A.troops-A.tired;
    const picked=()=>[...p.querySelectorAll('input[data-iag]:checked')].map(x=>state.generals.find(g=>g.id===+x.dataset.iag));
    const upd=()=>{
      // 统御上限随勾选武将实时变化
      const cap=Math.max(500,Math.min(fresh,leadCap(picked())));
      ias.max=cap;
      if(+ias.value>cap)ias.value=cap;
      const capEl=p.querySelector('#ia-cap');
      if(capEl)capEl.textContent=fmtT(Math.min(fresh,leadCap(picked())));
      const n=+ias.value;
      p.querySelector('#ia-n').textContent=n.toLocaleString();
      const est=p.querySelector('#ia-est');
      if(hostile){
        const ap=atkPowerOf(n,picked(),from,to),dp=defPowerOf(to),r=ap/Math.max(1,dp);
        let txt,col;
        if(r>1.45){txt='🔥 胜算极大';col='#6fe89a'}
        else if(r>1.08){txt='✅ 略占优势';col='#a8e06f'}
        else if(r>0.85){txt='⚖️ 势均力敌';col='#e8c96a'}
        else{txt='☠️ 凶多吉少';col='#ff7a7a'}
        const tn=terrainNote(from,to);
        est.innerHTML=`我 <b>${fmtG(ap)}</b> ⚡ 敌 <b>${fmtG(dp)}</b> · <span style="color:${col};font-weight:700">${txt}</span>
        <div class="dim" style="font-size:11.5px;margin-top:2px">${tn?tn+' · ':''}留守 ${fmtT(A.troops-n)}</div>`;
      }else{
        est.innerHTML=`调动后本城留守 <b>${fmtT(A.troops-n)}</b>，${B.name} 兵力 <b>${fmtT(B.troops+n)}</b>
        <div class="dim" style="font-size:11.5px;margin-top:2px">${techDone(state.player,'yi')?'📖 驿传：移防即刻可战':'移防之兵需休整一回合'}</div>`;
      }
    };
    ias.addEventListener('input',upd);
    p.querySelectorAll('input[data-iag]').forEach(x=>x.addEventListener('change',upd));
    p.querySelectorAll('[data-iaq]').forEach(b=>b.onclick=()=>{
      ias.value=Math.max(500,Math.floor(+ias.max*+b.dataset.iaq/100)*100);upd();Sound.play('tap');
    });
    upd();
  }
}
$('#panel').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');
  if(!b||busy)return;
  const act=b.dataset.act;
  Sound.play('tap');
  if(act==='close')return deselect();
  if(act==='recruit'){recruitOpen=!recruitOpen;armyTarget=-1;return renderPanel();}
  if(act==='qrec')return doQuickRecruit(selected);
  if(act==='ir-go')return doInlineRecruit();
  if(act==='ia-cancel'){armyTarget=-1;return renderPanel();}
  if(act==='ia-go')return doInlineArmy();
  if(act.startsWith('quick:'))return doQuickArmy(selected,+act.slice(6));
  if(act.startsWith('strat-'))return doStrat(selected,act.slice(6));
  if(act.startsWith('dev-'))return doDev(selected,act.slice(4));
  if(act.startsWith('army:')){armyTarget=+act.slice(5);recruitOpen=false;return renderPanel();}
  if(act.startsWith('armyfrom:'))return openArmyModal(+act.slice(9),selected);
});
function doInlineRecruit(){
  const c=C(selected),f=F(state.player);
  const sl=$('#panel').querySelector('#ir-slider');
  if(!sl||c.recUsed)return;
  const n=+sl.value,rm=recruitMult(c);
  f.gold-=n*RG*rm;f.food-=n*RF*rm;
  c.troops+=n;c.tired+=n;c.recUsed=true;recruitOpen=false;
  addLog(`${c.name} 征募新兵 ${n} 人`);
  Sound.play('coin');
  toast(`⚔️ ${c.name} 征募 ${n.toLocaleString()} 名新兵`);
  renderAll();save();
}
function doInlineArmy(){
  const from=selected,to=armyTarget;
  if(to<0)return;
  const sl=$('#panel').querySelector('#ia-slider');
  const n=+sl.value;
  const gsel=[...$('#panel').querySelectorAll('input[data-iag]:checked')].map(x=>+x.dataset.iag);
  const B=C(to),hostile=B.owner!==state.player;
  armyTarget=-1;
  busy=true;deselectKeepPanel();
  animateMarch(from,to,FACTS[state.player].color,()=>{
    if(hostile){
      const r=doBattle(from,to,n,gsel);
      renderAll();save();
      showBattleModal(r);
      busy=false;
    }else{
      doTransfer(from,to,n,gsel);
      toast(`🚚 ${n.toLocaleString()} 兵移驻 ${B.name}`);
      busy=false;
      select(to);renderAll();save();
    }
  });
}
/* 兼容旧入口（地图点击直达出兵）：现为面板内嵌 */
function openArmyModal(from,to){
  selected=from;armyTarget=to;recruitOpen=false;
  renderMap();renderPanel();
  $('#panel').classList.add('show');
  document.body.classList.add('panel-open');
}

/* ---- 内政 ---- */
function doDev(cid,kind){
  const c=C(cid),f=F(state.player);
  if(c.devUsed)return;
  const lvNow=kind==='farm'?c.farm:kind==='comm'?c.comm:c.wall;
  if(lvNow>=maxLv(c,kind))return;
  let cost,label;
  if(kind==='farm'){cost=devCost(c.farm);label='农业';}
  else if(kind==='comm'){cost=devCost(c.comm);label='商业';}
  else{cost=wallCost(c.wall);if(hasSkillIn(cid,'zhu'))cost=Math.round(cost/2);label='城防';}
  if(f.gold<cost){toast('💰 金钱不足');return;}
  f.gold-=cost;c.devUsed=true;
  if(kind==='farm')c.farm++;else if(kind==='comm')c.comm++;else c.wall++;
  const lv=kind==='farm'?c.farm:kind==='comm'?c.comm:c.wall;
  addLog(`${c.name} ${label}提升至 ${lv} 级`);
  Sound.play('coin');
  toast(`✨ ${c.name} ${label} → Lv.${lv}`);
  renderAll();save();
}
/* ---- 无弹窗快捷操作 ---- */
function doQuickRecruit(cid){
  const c=C(cid),f=F(state.player);
  if(c.recUsed)return;
  const rm=recruitMult(c),rg=RG*rm,rf=RF*rm;
  const n=Math.min(2000,RECRUIT_CAP,cityCap(c)-c.troops,Math.floor(f.gold/rg/100)*100,Math.floor(f.food/rf/100)*100);
  if(n<100){toast('💰 金钱或粮草不足');return;}
  f.gold-=n*rg;f.food-=n*rf;
  c.troops+=n;c.tired+=n;c.recUsed=true;
  Sound.play('coin');
  toast(`⚡ ${c.name} 速征 ${n.toLocaleString()} 兵`);addLog(`${c.name} 速征 ${n} 兵`);
  renderAll();save();
}
function doQuickArmy(from,to){
  const A=C(from),B=C(to);
  const hostile=B.owner!==state.player;
  const fresh=A.troops-A.tired;
  if(fresh<500){toast('可战之兵不足');return;}
  const gens=generalsIn(from);
  const cap=Math.min(fresh,leadCap(gens));      // 统御上限
  const n=hostile?cap:Math.max(500,Math.floor(cap/2/100)*100);
  const gsel=gens.map(g=>g.id);
  busy=true;deselectKeepPanel();
  animateMarch(from,to,FACTS[state.player].color,()=>{
    if(hostile){
      const r=doBattle(from,to,n,gsel);
      renderAll();save();
      showBattleModal(r);
      busy=false;
    }else{
      doTransfer(from,to,n,gsel);
      toast(`🚚 ${n.toLocaleString()} 兵移驻 ${B.name}`);
      busy=false;
      select(to);renderAll();save();
    }
  });
}
function showBattleModal(r){
  const A=C(r.from),D=C(r.to);
  const m=modal(`
    <h3>⚔️ ${A.name} → ${D.name} 之战</h3>
    <div class="b-side"><span style="color:${FACTS[r.attFid].color}">攻 ${FACTS[r.attFid].name}军 · ${r.attLead}</span><span>${r.commit.toLocaleString()} 兵</span></div>
    <div class="b-side"><span style="color:${FACTS[r.defFid].color}">守 ${FACTS[r.defFid].name}军 · ${r.defLead}</span><span>${(r.defLoss+(r.won?0:C(r.to).troops)).toLocaleString()} 兵</span></div>
    <div id="bt-stage"><div class="battle-stage">⚔️</div>
    <div style="text-align:center" class="dim">两军交锋，杀声震天…</div></div>
  `,{lock:true});
  Sound.play('battle');
  if(r.duel)setTimeout(()=>Sound.play('duel'),400);
  setTimeout(()=>{
    const ok=r.won;
    Sound.play(ok?'win':'lose');
    m.querySelector('#bt-stage').innerHTML=`
      ${r.duel?`<div class="duel">⚡ 阵前单挑：<b>${r.duel.a}</b> 对阵 <b>${r.duel.d}</b><br>${r.duel.text}</div>`:''}
      <div class="b-result ${ok?'win':'lose'}">${ok?'🎉 攻克 '+D.name+' ！':'💥 攻势受挫，败退而归'}</div>
      <div style="text-align:center;font-size:14px;line-height:2">
        我军伤亡 <b style="color:#ff9a9a">${r.attLoss.toLocaleString()}</b>　敌军${ok?'全灭':'伤亡'} <b style="color:#9ad0ff">${r.defLoss.toLocaleString()}</b>
        ${ok?`<br>${fmtT(r.commit-r.attLoss)} 大军进驻 ${D.name}（需休整）`:''}
        ${r.joined?`<br>💫 在野名将 <b style="color:#e8c96a">${r.joined.name}·${r.joined.war}</b> 慕名来投！`:''}
      </div>
      <div class="row"><button class="btn primary" id="bt-ok">确 定</button></div>`;
    m.querySelector('#bt-ok').onclick=()=>{
      closeModal();
      if(r.won)select(r.to);
      if(state.pendingCaptives.length)showCaptives(()=>checkVictory());
      else checkVictory();
    };
  },r.duel?1500:1000);
}
/* ---- 俘虏处置 ---- */
function showCaptives(cb){
  const gid=state.pendingCaptives[0];
  const g=state.generals.find(x=>x.id===gid);
  if(!g){state.pendingCaptives.shift();
    if(state.pendingCaptives.length)return showCaptives(cb);
    save();return cb&&cb();}
  const gs=gensOf(state.player);
  const charm=gs.length?Math.max(...gs.map(x=>x.cha)):60;
  const p=clamp(0.7-(g.loy||80)/150+charm/400+(courtHas(state.player,'ren')?0.15:0),0.05,0.9);
  const m=modal(`<h3>⛓ 阵前得将 · ${g.name}</h3>
    <div class="b-side"><span>统 ${g.war} · 武 ${g.wu} · 智 ${g.int}</span><span>${g.skill?'特技·'+SKILLS[g.skill].name:'无特技'} · 忠诚 ${g.loy}</span></div>
    <div style="font-size:13.5px;line-height:1.9" class="dim">${g.name} 被我军生擒，绑缚帐前。是劝其归降，还是放归山林？</div>
    <button class="btn gold wide" id="cp-rec"><span>🙏 劝降（成算约 ${Math.round(p*100)}%）</span></button>
    <button class="btn wide" id="cp-rel"><span>🕊 释放（归隐在野）</span></button>`,{lock:true});
  const done=()=>{
    state.pendingCaptives.shift();
    save();renderAll();closeModal();
    if(state.pendingCaptives.length)showCaptives(cb);
    else cb&&cb();
  };
  m.querySelector('#cp-rec').onclick=()=>{
    if(tryRecruitCaptive(g,state.player)){
      Sound.play('win');toast(`🎉 ${g.name} 纳头便拜，愿效犬马之劳！`);addLog(`劝降 ${g.name} 成功`);
    }else{
      Sound.play('lose');toast(`💨 ${g.name} 宁死不降，放归山林`);addLog(`劝降 ${g.name} 未果`);
      releaseCaptive(g);
    }
    done();
  };
  m.querySelector('#cp-rel').onclick=()=>{
    releaseCaptive(g);
    toast(`🕊 ${g.name} 拜谢而去`);addLog(`释放 ${g.name}`);
    done();
  };
}
/* ---- 武将府 ---- */
function showRoster(tab){
  tab=tab||'mine';
  const fid=state.player;
  const idx=rankIdxOf(fid);
  const f=F(fid);
  let body='';
  const statLine=g=>`统 <b>${effWar(g)}</b> · 武 ${g.wu} · 智 ${g.int} · 政 ${g.pol} · 魅 ${g.cha}`;
  if(tab==='mine'){
    const gens=gensOf(fid).sort((a,b)=>effWar(b)-effWar(a));
    body=gens.map(g=>{
      const t=titleOf(g);
      const loyCol=g.loy>=80?'#9ae6a8':g.loy>=60?'#e8c96a':'#ff8a8a';
      return `<div class="g-row">
        <div class="g-info"><b>${t?'<span style="color:#e8c96a">'+t.name+' · </span>':''}${g.name}</b>
          ${g.skill?`<span style="color:#e8c96a;font-size:12px">〔${SKILLS[g.skill].name}〕</span>`:''}
          <div class="g-stats">${statLine(g)} · <span style="color:${loyCol}">忠 ${g.loy}</span> · 驻 ${g.city>=0?C(g.city).name:'—'}</div></div>
        <div style="display:flex;flex-direction:column;gap:4px;flex:none">
          <button class="btn" style="padding:5px 10px;min-height:0" data-confer="${g.id}">${t?'改授':'授衔'}</button>
          <div style="display:flex;gap:4px">
            <button class="btn" style="padding:5px 8px;min-height:0;font-size:12px" data-gift="${g.id}" ${f.gold<500||g.loy>=100?'disabled':''}>赏赐</button>
            <button class="btn" style="padding:5px 8px;min-height:0;font-size:12px" data-move="${g.id}" ${f.gold<100?'disabled':''}>调驻</button>
          </div>
        </div>
      </div>`}).join('')||'<div class="dim">麾下无将</div>';
    body+=`<div class="dim" style="font-size:12px;margin-top:8px">赏赐 500金 忠诚+10 · 调驻 100金 移防他城 · 统御 = 统率×300，决定出征/运兵规模。</div>`;
  }else if(tab==='world'){
    body=MAJORS.filter(x=>x!==fid&&F(x).alive).map(x=>{
      const gens=gensOf(x).sort((a,b)=>effWar(b)-effWar(a));
      const fd=FACTS[x];
      return `<div style="margin:10px 0 2px;font-weight:700;color:${fd.color}">${fd.name} · ${fd.leader}
        <span class="dim" style="font-size:12px;font-weight:400">　${cityIdsOf(x).length} 城 · ${RANKS[rankIdxOf(x)].name}</span></div>`+
        (gens.map(g=>{const t=titleOf(g);
          return `<div style="font-size:13px;padding:3px 0;border-bottom:1px dashed #2a3650">${t?'<span style="color:#e8c96a">'+t.name+'·</span>':''}${g.name}${g.skill?'<span style="color:#e8c96a;font-size:11px">〔'+SKILLS[g.skill].name+'〕</span>':''}
            <span class="dim" style="font-size:12px">　统${effWar(g)} 武${g.wu} 智${g.int} · 驻 ${g.city>=0?C(g.city).name:'—'}</span></div>`}).join('')
        ||'<div class="dim" style="font-size:12px">无将</div>');
    }).join('');
  }else{
    const av=availPool().sort((a,b)=>b.war-a.war);
    const future=state.pool.filter(p=>p.debut>state.year).sort((a,b)=>a.debut-b.debut);
    body=(av.length?'<div class="sec-title" style="margin-top:0">在野遗贤 · 攻占中立城或际遇可招揽</div>'+
      av.map(g=>`<div style="font-size:13.5px;padding:4px 0;border-bottom:1px dashed #2a3650"><b>${g.name}</b>${g.skill?'<span style="color:#e8c96a;font-size:11px">〔'+SKILLS[g.skill].name+'〕</span>':''}
        <span class="dim" style="font-size:12px">　统${g.war} 武${g.wu} 智${g.int} 政${g.pol}</span></div>`).join('')
      :'<div class="dim">当世已无在野名将</div>')+
      (future.length?`<div class="sec-title">未出世 · 将按史实年份登场</div>`+
      future.map(g=>`<div style="font-size:13px;padding:4px 0;border-bottom:1px dashed #2a3650;opacity:.55">${g.name}
        <span style="font-size:12px">　统${g.war} 武${g.wu} 智${g.int} · <b>${g.debut} 年</b>出仕</span></div>`).join(''):'');
  }
  const seg=t=>`class="btn" style="flex:1;min-height:38px;padding:6px;flex-direction:row;${tab===t?'border-color:#caa64b;background:#332a14':''}"`;
  const m=modal(`<h3>👤 武将府</h3>
    <div style="font-size:13px;margin-bottom:8px">官居 <b style="color:#e8c96a">${RANKS[idx].name}</b> · 岁入 +${Math.round(RANKS[idx].inc*100)}%</div>
    <div style="display:flex;gap:8px;margin-bottom:6px">
      <button ${seg('mine')} data-tab="mine">我 方</button>
      <button ${seg('world')} data-tab="world">天 下</button>
      <button ${seg('wild')} data-tab="wild">在 野</button>
    </div>
    ${body}
    <div class="row"><button class="btn primary" onclick="closeModal()">关 闭</button></div>`);
  m.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{Sound.play('tap');closeModal();showRoster(b.dataset.tab)});
  m.querySelectorAll('[data-confer]').forEach(b=>b.onclick=()=>{Sound.play('tap');showConfer(+b.dataset.confer)});
  m.querySelectorAll('[data-gift]').forEach(b=>b.onclick=()=>{
    const g=state.generals.find(x=>x.id===+b.dataset.gift);
    if(!g||f.gold<500)return;
    f.gold-=500;g.loy=Math.min(100,(g.loy||80)+10);
    Sound.play('coin');toast(`🎁 赏赐 ${g.name}，忠诚 ${g.loy}`);addLog(`赏赐 ${g.name}`);
    save();closeModal();showRoster('mine');
  });
  m.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{Sound.play('tap');showMoveGen(+b.dataset.move)});
}
/* 武将调驻：选择目的城 */
function showMoveGen(gid){
  const g=state.generals.find(x=>x.id===gid);
  if(!g)return;
  const rows=cityIdsOf(state.player).map(i=>{
    const c=C(i);
    const here=g.city===i;
    const gov=governorOf(i);
    return `<button class="btn wide" data-mvto="${i}" ${here?'disabled':''} style="margin-top:6px">
      <span>${c.cap?'★':''}${c.name}${here?'（现驻）':''}</span>
      <small>兵 ${fmtT(c.troops)}/${fmtT(cityCap(c))} · ${generalsIn(i).length} 将${gov?' · 太守'+gov.name:''}</small>
    </button>`}).join('');
  const m=modal(`<h3>🐎 调驻 · ${g.name} <small class="dim">（统御 ${fmtT(effWar(g)*300)} · 100金）</small></h3>${rows}
    <div class="row"><button class="btn" id="mv-back">返 回</button></div>`);
  m.querySelector('#mv-back').onclick=()=>{closeModal();showRoster('mine');};
  m.querySelectorAll('[data-mvto]').forEach(b=>b.onclick=()=>{
    if(moveGeneral(gid,+b.dataset.mvto)){closeModal();showRoster('mine');}
  });
}
function showConfer(gid){
  const g=state.generals.find(x=>x.id===gid);
  if(!g)return;
  const f=F(state.player),idx=rankIdxOf(state.player);
  const cur=titleOf(g);
  const opts=TITLES.map(t=>{
    const used=countTitle(state.player,t.id);
    const free=used<t.max;
    let why='';
    if(t.req>idx)why='需官居 '+RANKS[t.req].name;
    else if(cur&&t.bonus<=cur.bonus)why='不及现职';
    else if(!free)why='此衔已授';
    else if(f.gold<t.cost)why='金钱不足';
    return `<button class="btn wide" data-t="${t.id}" ${why?'disabled':''} style="margin-top:6px">
      <span>${t.name} <small style="color:#9ae6a8">统率 +${t.bonus}</small></span>
      <small>${why||t.cost.toLocaleString()+' 金'}</small></button>`;
  }).join('');
  const m=modal(`<h3>⚜ 授衔 · ${g.name}${cur?'（现任'+cur.name+'）':''}</h3>${opts}
    <div class="row"><button class="btn" id="cf-back">返 回</button></div>`);
  m.querySelector('#cf-back').onclick=()=>{closeModal();showRoster();};
  m.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{
    const t=TITLES.find(x=>x.id===b.dataset.t);
    f.gold-=t.cost;g.title=t.id;
    g.loy=Math.min(100,(g.loy||80)+15);
    Sound.play('coin');
    toast(`⚜ 拜 ${g.name} 为 ${t.name}！统率 ${effWar(g)}，忠诚 ${g.loy}`);
    addLog(`拜 ${g.name} 为 ${t.name}`);
    save();renderAll();closeModal();showRoster();
  });
}
/* ---- 军技府 ---- */
function showTechs(){
  const fid=state.player,f=F(fid);
  const cur=f.researching?TECHS.find(t=>t.id===f.researching.id):null;
  const rows=TECHS.map(t=>{
    const done=f.techs.includes(t.id);
    const busy2=!!f.researching;
    let st='';
    if(done)st='<span style="color:#9ae6a8">✓ 已研成</span>';
    else if(cur&&cur.id===t.id)st=`<span style="color:#e8c96a">研习中 · 剩 ${f.researching.left} 回合</span>`;
    else if(busy2)st='<span class="dim">候研</span>';
    else if(f.gold<t.cost)st='<span class="dim">金不足</span>';
    return `<div class="g-row">
      <div class="g-info"><b>${t.name}</b><div class="g-stats">${t.desc} · ${t.cost.toLocaleString()} 金 · ${t.turns} 回合</div></div>
      ${done||busy2||f.gold<t.cost?`<span style="font-size:12px;flex:none">${st}</span>`
        :`<button class="btn" style="padding:7px 12px;min-height:0;flex:none" data-tech="${t.id}">研习</button>`}
    </div>`}).join('');
  const m=modal(`<h3>📖 军 技 府</h3>
    <div class="dim" style="font-size:12.5px;margin-bottom:6px">同一时间只可研习一项；研成后全国生效，永不失传。</div>
    ${rows}
    <div class="row"><button class="btn primary" onclick="closeModal()">关 闭</button></div>`);
  m.querySelectorAll('[data-tech]').forEach(b=>b.onclick=()=>{
    if(startResearch(fid,b.dataset.tech)){
      const t=TECHS.find(x=>x.id===b.dataset.tech);
      Sound.play('coin');
      toast(`📖 开始研习「${t.name}」，需 ${t.turns} 回合`);addLog(`始研 ${t.name}`);
      save();renderTopbar();closeModal();showTechs();
    }
  });
}
/* ---- 外交 ---- */
function showDiplomacy(){
  const f=F(state.player);
  const rows=MAJORS.filter(x=>x!==state.player&&F(x).alive).map(x=>{
    const fd=FACTS[x];
    const n=cityIdsOf(x).length;
    const troops=cityIdsOf(x).reduce((a,i)=>a+C(i).troops,0);
    const cost=500+n*300;
    const tl=truceLeft(x);
    return `<div class="g-row">
      <div class="g-info"><b style="color:${fd.color}">${fd.name} · ${fd.leader}</b>
        <div class="g-stats">${n} 城 · 总兵力 ${fmtT(troops)} · ${tl>0?`<span style="color:#9ae6a8">停战 剩 ${tl} 回合</span>`:'<span style="color:#ff9a9a">无盟约</span>'}</div></div>
      <button class="btn" style="padding:7px 10px;min-height:0;flex:none" data-truce="${x}" ${f.gold<cost||tl>=12?'disabled':''}>
        <span style="font-size:13px">🤝 修好</span><small>${cost}金·停战6回合</small></button>
    </div>`}).join('');
  const m=modal(`<h3>🤝 外 交</h3>
    <div class="dim" style="font-size:12.5px;margin-bottom:6px">纳币修好可换停战之约：约期内对方不会进攻我方城池（可叠加，至多 12 回合）。约满之日，刀兵再起。</div>
    ${rows||'<div class="dim">天下已无对手</div>'}
    <div class="row"><button class="btn primary" onclick="closeModal()">关 闭</button></div>`);
  m.querySelectorAll('[data-truce]').forEach(b=>b.onclick=()=>{
    const x=b.dataset.truce;
    const cost=500+cityIdsOf(x).length*300;
    if(f.gold<cost)return;
    f.gold-=cost;
    if(!state.truce)state.truce={};
    state.truce[x]=Math.min(12,truceLeft(x)+6);
    Sound.play('coin');
    toast(`🤝 与 ${FACTS[x].leader} 缔结停战之约（${state.truce[x]} 回合）`);
    addLog(`纳币 ${cost} 金，与${FACTS[x].name}停战`);
    save();renderTopbar();closeModal();showDiplomacy();
  });
}
function checkRank(){
  if(!state)return;
  const idx=rankIdxOf(state.player);
  if(state.rkLast===undefined)state.rkLast=idx;
  if(idx>state.rkLast){
    state.rkLast=idx;
    Sound.play('win');
    toast(`🎉 晋位「${RANKS[idx].name}」！岁入 +${Math.round(RANKS[idx].inc*100)}%，可授更高将军号`);
    addLog(`晋位 ${RANKS[idx].name}`);
  }else if(idx<state.rkLast)state.rkLast=idx;
}
/* ---- 史话 / 战报 / 抉择 ---- */
function showHistoryModal(list,cb){
  Sound.play('hist');
  const html=list.map(h=>`<div class="hist-item">
    <div class="hist-title">📜 ${h.title} · 公元 ${h.year} 年</div>
    <div class="hist-text">${h.text}</div></div>`).join('');
  const m=modal(`<h3 class="serif" style="letter-spacing:6px">史 　话</h3>${html}
    <div class="row"><button class="btn primary" id="h-ok">铭 记</button></div>`,{lock:true});
  m.querySelector('#h-ok').onclick=()=>{closeModal();renderAll();cb&&cb();};
}
function showWarReport(list,cb){
  const html=list.map(r=>{
    const atkMe=r.attFid===state.player;
    const line=`${FACTS[r.attFid].name}军(${r.attLead}) ${r.commit.toLocaleString()} 兵${r.won?'攻克':'强攻'} <b>${C(r.to).name}</b>${r.won?'':'未果'}`;
    const col=(r.won&&!atkMe)?'#ff8a8a':(!r.won&&!atkMe)?'#6fe89a':'#e8e2d0';
    return `<div style="padding:7px 0;border-bottom:1px dashed #2a3650;color:${col};font-size:14px">⚔️ ${line}<br>
      <span class="dim" style="font-size:12px">攻方伤亡 ${r.attLoss.toLocaleString()} / 守方${r.won?'全灭':'伤亡'} ${r.defLoss.toLocaleString()}${r.duel?` · ⚡${r.duel.a} 单挑 ${r.duel.d}，${r.duel.aWin?r.duel.a:r.duel.d} 胜`:''}</span></div>`;
  }).join('');
  const m=modal(`<h3>🛡 边关战报</h3>${html}
    <div class="row"><button class="btn primary" id="wr-ok">知道了</button></div>`,{lock:true});
  m.querySelector('#wr-ok').onclick=()=>{closeModal();cb&&cb();};
}
function showChoiceEvent(cb){
  const ids=cityIdsOf(state.player);
  if(!ids.length){cb&&cb();return;}
  const cid=ids[ri(0,ids.length-1)],c=C(cid);
  const ev=CHOICES[ri(0,CHOICES.length-1)];
  const aOk=!ev.a.cond||ev.a.cond();
  const m=modal(`<h3>${ev.t} · ${c.name}</h3>
    <div style="font-size:14px;line-height:1.9">${ev.d.replaceAll('{c}',`<b style="color:#e8c96a">${c.name}</b>`)}</div>
    <button class="btn gold wide" id="ch-a" ${aOk?'':'disabled'}><span style="text-align:left">${ev.a.label}</span></button>
    <button class="btn wide" id="ch-b"><span style="text-align:left">${ev.b.label}</span></button>`,{lock:true});
  const done=msg=>{closeModal();if(msg){toast(msg);addLog(msg);}save();renderAll();cb&&cb();};
  m.querySelector('#ch-a').onclick=()=>{Sound.play('coin');done(ev.a.fx(c,cid))};
  m.querySelector('#ch-b').onclick=()=>{Sound.play('tap');done(ev.b.fx?ev.b.fx(c,cid):'')};
}
/* ---- 日志 / 帮助 / 菜单 ---- */
function showLog(){
  const html=state.log.slice().reverse().map(l=>`<div>${l}</div>`).join('')||'<div class="dim">暂无记录</div>';
  modal(`<h3>📜 史官记事</h3><div class="loglist">${html}</div>
    <div class="row"><button class="btn primary" onclick="closeModal()">关闭</button></div>`);
}
function showHelp(){
  modal(`<h3>📜 玩法说明</h3><div class="helpbox">
  <b>🎯 胜利</b>：占领 ${WIN_CITIES} 座城池，或消灭其余七路诸侯。若有强敌先据 ${AI_WIN} 城一统天下，则大势已去。<br>
  <b>🎛 自定义开局</b>：可调难度、起始国力、史话开关、群雄守军强度。<br>
  <b>🏯 内政</b>：每城每回合一次开发与一次征兵。商业产金、农业产粮，秋季粮产翻倍，冬季出征 -10%。<br>
  <b>🗺 地利</b>：城池特性（🌾粮仓 💰商都 🛡️雄关 🐎马场 ⛵水港 🏹蛮地 ⛩️关隘）与道路地形（🌊渡河 ⛰山道）均影响战力。<br>
  <b>⚔️ 出兵</b>：点己方城市选相邻目标；新征/新到之兵需休整一回合（研成驿传可免）。攻城虽败亦损敌城防。<br>
  <b>👤 武将五维</b>：统率(领军) 武力(单挑) 智力(计略) 政治(内政) 魅力(劝降)。各有特技（神将/飞将/神算/铁壁…），胜仗与单挑可成长。<br>  <b>🏯 武将与城</b>：驻城政治最高者为<b>太守</b>（金粮加成至 +25%）；无将之城守军 -10%。武将府可花 100 金<b>调驻</b>任意己方城。<br>
  <b>🎖 统御</b>：出征与运兵规模 = 随行武将统率×300 之和（无将仅 8000 民兵）；城池驻兵上限由城防与农商等级决定。<br>
  <b>❤️ 忠诚</b>：授衔与赏赐可提升忠诚；忠诚过低武将会弃官出走，亦会被敌国离间。<br>
  <b>⛓ 俘虏</b>：城破时敌将可能被擒——劝降纳为己用（魅力与仁德加成），或释放归野。<br>
  <b>⚜ 官衔</b>：领土晋位（6城州牧→10城大将军→14城丞相）提升岁入并解锁将军号（统率 +2~+9）。<br>
  <b>📖 军技</b>：顶栏 📖 研习科技——屯田/市易/驿传/攻城器械等八项，研成全国生效。<br>
  <b>🗣 计略</b>：流言/烧粮/离间，每回合一计，成算取决于双方智者（神算/看破/鬼谋特技参与）。<br>
  <b>🤝 外交</b>：纳币修好换停战之约，约期内对方不犯我境。<br>
  <b>🌟 风云人物</b>：庞统、姜维、邓艾等名将按史实年份出世，武将府「在野」页可查。<br>
  <b>📜 史话</b>：官渡、赤壁、三顾茅庐……历史如期上演，影响天下大势。<br>
  <b>🗺 操作</b>：拖动平移，捏合/滚轮缩放；放大可见内政、驻将、山名与古迹；势力范围块标示各方疆域。<br>
  <b>💾 存档</b>：每个操作即时自动保存，刷新随时续档；重开请点 ☰ → 重新开始。</div>
  <div class="row"><button class="btn primary" onclick="closeModal()">明白了</button></div>`);
}
function showGameMenu(){
  const m=modal(`<h3>☰ 菜单</h3>
    <button class="btn wide" id="gm-theme"><span>${document.body.classList.contains('light')?'🌙 配色：水墨纸卷':'🌑 配色：夜色玄黑'}</span></button>
    <button class="btn wide" id="gm-tcell"><span>${svg.classList.contains('no-tcell')?'🗺 势力涂色：关':'🗺 势力涂色：开'}</span></button>
    <button class="btn wide" id="gm-sound"><span>${Sound.on?'🔊 音效：开':'🔇 音效：关'}</span></button>
    <button class="btn wide" id="gm-help"><span>📜 玩法说明</span></button>
    <button class="btn wide atk" id="gm-restart"><span>🔄 放弃本局，重新开始</span></button>
    <div class="row"><button class="btn primary" onclick="closeModal()">返回游戏</button></div>`);
  m.querySelector('#gm-theme').onclick=e=>{
    const light=document.body.classList.toggle('light');
    store.set('sgbh_theme',light?'light':'dark');
    e.currentTarget.querySelector('span').textContent=light?'🌙 配色：水墨纸卷':'🌑 配色：夜色玄黑';
    Sound.play('tap');
  };
  m.querySelector('#gm-tcell').onclick=e=>{
    const off=svg.classList.toggle('no-tcell');
    store.set('sgbh_tcell',off?'0':'1');
    e.currentTarget.querySelector('span').textContent=off?'🗺 势力涂色：关':'🗺 势力涂色：开';
    Sound.play('tap');
  };
  m.querySelector('#gm-sound').onclick=e=>{
    Sound.on=!Sound.on;store.set('sgbh_sound',Sound.on?'1':'0');
    e.currentTarget.querySelector('span').textContent=Sound.on?'🔊 音效：开':'🔇 音效：关';
    Sound.play('tap');
  };
  m.querySelector('#gm-help').onclick=()=>{closeModal();showHelp();};
  m.querySelector('#gm-restart').onclick=()=>{
    closeModal();
    const c=modal(`<h3>⚠️ 确认重开？</h3><div style="font-size:14px">当前进度将被清除，不可恢复。</div>
      <div class="row"><button class="btn" id="rc-no">取消</button><button class="btn atk" id="rc-yes" style="flex-direction:row">确认重开</button></div>`);
    c.querySelector('#rc-no').onclick=closeModal;
    c.querySelector('#rc-yes').onclick=()=>{store.del(SAVE_KEY);location.reload();};
  };
}
/* ---- 开局界面 ---- */
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('show'));
  $(id).classList.add('show');
}
let setupFid='shu',setupDiff=1,setupWealth=1,setupHist=true,setupNeu=1;
function buildSetup(){
  const wrap=$('#fact-cards');
  wrap.innerHTML='';
  MAJORS.forEach(fid=>{
    const fd=FACTS[fid];
    const card=document.createElement('div');
    card.className='fcard'+(fid===setupFid?' sel':'');
    card.style.setProperty('--fc',fd.color);
    card.innerHTML=`<div class="fname" style="color:${fd.color}">${fd.name}</div>
      <div class="fmini">${fd.leader} · ${CITY_DEFS.filter(d=>d[3]===fid).length}城</div>`;
    card.onclick=()=>{
      setupFid=fid;Sound.play('tap');
      wrap.querySelectorAll('.fcard').forEach(c=>c.classList.remove('sel'));
      card.classList.add('sel');
      renderFactDetail();
    };
    wrap.appendChild(card);
  });
  renderFactDetail();
}
function renderFactDetail(){
  const fd=FACTS[setupFid];
  const topGens=GEN_DEFS.filter(g=>g[6]===setupFid).sort((a,b)=>b[1]-a[1]).slice(0,4)
    .map(g=>`${g[0]}<small style="opacity:.6">${g[1]}</small>`).join('、');
  $('#fact-detail').innerHTML=`<b style="color:${fd.color}">${fd.name} · ${fd.leader}</b>
    　<span style="color:#8fb3d9">⚜ ${PERSONA[setupFid].label}</span><br>
    ${fd.desc}<br><span style="color:#e8c96a">👤 ${topGens}</span>`;
}
function bindSeg(id,fn){
  $(id).addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    fn(b);Sound.play('tap');
    $(id).querySelectorAll('button').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel');
  });
}
