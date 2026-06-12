'use strict';
/* ============================================================
 * 主流程：回合 / 胜负 / 入口绑定 / 初始化
 * ============================================================ */
function runSteps(steps){
  const next=()=>{const s=steps.shift();if(s)s(next);};
  next();
}
function endTurn(){
  if(busy)return;
  busy=true;
  deselect();closeModal();
  $('#turn-overlay').classList.add('show');
  setTimeout(()=>{
    const reports=[];
    MAJORS.filter(f=>f!==state.player&&F(f).alive).forEach(fid=>aiTurn(fid,reports));
    neutralRegen();
    incomeAll();
    advanceTime();
    randomEvent();
    const hist=checkHistory();
    save();
    renderAll();
    $('#turn-overlay').classList.remove('show');
    Sound.play('turn');
    toast(`${SEASON_EMO[state.season]} ${dateStr()} · 第 ${state.turn} 回合`);
    const steps=[];
    if(hist.length)steps.push(cb=>showHistoryModal(hist,cb));
    const mine=reports.filter(r=>r.involvesPlayer);
    if(mine.length)steps.push(cb=>showWarReport(mine,cb));
    if(Math.random()<0.25)steps.push(cb=>showChoiceEvent(cb));
    steps.push(cb=>{checkVictory();if(cb)cb();});
    runSteps(steps);
    busy=false;
  },700);
}
function checkVictory(){
  const myCities=cityIdsOf(state.player).length;
  if(myCities===0){
    Sound.play('lose');
    modal(`<h3 style="color:#ff7a7a">💀 大势已去</h3>
      <div style="font-size:15px;line-height:2">${dateStr()}，${FACTS[state.player].leader}兵败城失，霸业成空。<br>共历 ${state.turn} 回合。胜败兵家常事，重整旗鼓再来！</div>
      <div class="row"><button class="btn primary" id="vd-new">重 新 开 始</button></div>`,{lock:true})
      .querySelector('#vd-new').onclick=()=>{store.del(SAVE_KEY);location.reload();};
    return;
  }
  const colossus=MAJORS.find(f=>f!==state.player&&cityIdsOf(f).length>=AI_WIN);
  if(colossus){
    Sound.play('lose');
    modal(`<h3 style="color:#ff7a7a">🏯 天下易主</h3>
      <div style="font-size:15px;line-height:2">${dateStr()}，${FACTS[colossus].leader}并吞八荒，山河尽入${FACTS[colossus].name}手。${FACTS[state.player].leader}纵有壮志，大势已去……<br>共历 ${state.turn} 回合。</div>
      <div class="row"><button class="btn primary" id="vd-new2">重 整 河 山</button></div>`,{lock:true})
      .querySelector('#vd-new2').onclick=()=>{store.del(SAVE_KEY);location.reload();};
    return;
  }
  if(!state.warnBig){
    const big=MAJORS.find(f=>f!==state.player&&cityIdsOf(f).length>=15);
    if(big){state.warnBig=true;
      const msg=`⚠️ ${FACTS[big].leader}已据十五城，天下将倾，宜早图之！`;
      toast(msg);addLog(msg);}
  }
  if(state.won)return;
  const rivalsAlive=MAJORS.filter(f=>f!==state.player&&cityIdsOf(f).length>0);
  if(myCities>=WIN_CITIES||rivalsAlive.length===0){
    state.won=true;save();
    Sound.play('win');
    modal(`<h3 style="color:#6fe89a">👑 天下归一</h3>
      <div style="font-size:15px;line-height:2.1">${dateStr()}，${FACTS[state.player].leader}${rivalsAlive.length===0?'扫平群雄':'据'+myCities+'城'}，威加海内，天下大定！<br>
      历时 <b>${state.turn}</b> 回合（${state.year-200} 年征战）<br>麾下名将 <b>${gensOf(state.player).length}</b> 员</div>
      <div class="row"><button class="btn" id="vw-go">继续征伐</button><button class="btn primary" id="vw-new">再 来 一 局</button></div>`,{lock:true});
    $('#vw-go').onclick=closeModal;
    $('#vw-new').onclick=()=>{store.del(SAVE_KEY);location.reload();};
  }
}
function startGame(){
  showScreen('#screen-game');
  vb={x:70,y:-10,w:860,h:784};
  buildMap();renderTopbar();
  deselect();
}
/* ---- 绑定 ---- */
bindSeg('#diff-seg',b=>setupDiff=+b.dataset.d);
bindSeg('#wealth-seg',b=>setupWealth=+b.dataset.w);
bindSeg('#hist-seg',b=>setupHist=b.dataset.h==='1');
bindSeg('#neu-seg',b=>setupNeu=+b.dataset.n);
$('#btn-new').onclick=()=>{Sound.play('tap');buildSetup();showScreen('#screen-setup');};
$('#btn-back').onclick=()=>{Sound.play('tap');showScreen('#screen-menu');};
$('#btn-start').onclick=()=>{
  Sound.play('turn');
  newGame(setupFid,setupDiff,{wealth:setupWealth,hist:setupHist,neu:setupNeu});
  save();
  startGame();
  setTimeout(()=>{toast(`${SEASON_EMO[0]} ${FACTS[setupFid].leader}据${capOf(setupFid)}而起，点击城池开始经营！`)},400);
};
$('#btn-continue').onclick=()=>{
  if(loadSave()){Sound.play('turn');startGame();toast('▶ 已读取存档，继续征程');}
  else{toast('存档读取失败');$('#btn-continue').style.display='none';}
};
$('#btn-help0').onclick=()=>{Sound.play('tap');showHelp();};
$('#btn-endturn').onclick=endTurn;
$('#btn-log').onclick=()=>{Sound.play('tap');showLog();};
$('#btn-help').onclick=()=>{Sound.play('tap');showHelp();};
$('#btn-gmenu').onclick=()=>{Sound.play('tap');showGameMenu();};
$('#btn-gens').onclick=()=>{Sound.play('tap');showRoster();};
$('#btn-diplo').onclick=()=>{Sound.play('tap');showDiplomacy();};
$('#btn-tech').onclick=()=>{Sound.play('tap');showTechs();};
/* PWA */
if('serviceWorker' in navigator&&location.protocol==='https:'){
  addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
/* 初始化 */
(function(){
  if(store.get('sgbh_theme')==='light')document.body.classList.add('light');
  if(loadSave()){
    $('#btn-continue').style.display='block';
    startGame();
    setTimeout(()=>{
      toast('▶ 已恢复进度 · 重开请点右上 ☰');
      if(state.pendingCaptives&&state.pendingCaptives.length)showCaptives(()=>{});
    },350);
  }
})();
