'use strict';
/* ============================================================
 * AI：八路诸侯（性格 / 内政 / 征兵 / 攻伐 / 授衔 / 研习）
 * ============================================================ */
function aiConfer(fid){
  const f=F(fid),rk=rankIdxOf(fid);
  const cand=state.generals.filter(g=>g.fid===fid&&!g.title).sort((a,b)=>b.war-a.war)[0];
  if(!cand)return;
  const avail=TITLES.filter(t=>t.req<=rk&&f.gold>t.cost*2.5&&countTitle(fid,t.id)<t.max)
    .sort((a,b)=>b.bonus-a.bonus)[0];
  if(avail){f.gold-=avail.cost;cand.title=avail.id;cand.loy=Math.min(100,(cand.loy||80)+15);}
}
function aiResearch(fid){
  const f=F(fid);
  if(f.researching)return;
  const order=['shi','tun','qiang','shou','zheng','qixie','juntun','yi'];
  for(const id of order){
    if(f.techs.includes(id))continue;
    const t=TECHS.find(x=>x.id===id);
    if(f.gold>t.cost*3){startResearch(fid,id);break;}
    break;
  }
}
function aiTurn(fid,reports){
  const f=F(fid);
  if(!f.alive)return;
  const p=PERSONA[fid];
  aiConfer(fid);
  aiResearch(fid);
  const myIds=cityIdsOf(fid);
  // 武将调度：富余武将外派到无将之城（优先边境）
  {
    const noGen=myIds.filter(i=>generalsIn(i).length===0)
      .sort((a,b)=>(ADJ[b].some(m=>C(m).owner!==fid)?1:0)-(ADJ[a].some(m=>C(m).owner!==fid)?1:0));
    for(const tgt of noGen){
      const src=myIds.find(i=>generalsIn(i).length>=2);
      if(src===undefined)break;
      const gs=generalsIn(src);
      gs.sort((a,b)=>effWar(a)-effWar(b))[0].city=tgt; // 派次将赴任
    }
  }
  for(const cid of myIds){
    const c=C(cid);
    if(c.owner!==fid)continue;
    const hostileN=ADJ[cid].filter(n=>C(n).owner!==fid);
    const isBorder=hostileN.length>0;
    // 内政
    if(!c.devUsed){
      const mF=Math.min(9,maxLv(c,'farm')),mC=Math.min(9,maxLv(c,'comm'));
      if(isBorder&&c.wall<p.wallMax&&f.gold>wallCost(c.wall)+600){f.gold-=wallCost(c.wall);c.wall++;c.devUsed=true;}
      else if(c.farm<=c.comm&&c.farm<mF&&f.gold>devCost(c.farm)+500){f.gold-=devCost(c.farm);c.farm++;c.devUsed=true;}
      else if(c.comm<mC&&f.gold>devCost(c.comm)+500){f.gold-=devCost(c.comm);c.comm++;c.devUsed=true;}
    }
    // 征兵：打不动邻敌时蓄力攻坚
    let recTarget=p.rec;
    if(isBorder){
      const weakest=Math.min(...hostileN.map(n=>defPowerOf(n)));
      const myP=atkPowerOf(c.troops,generalsIn(cid),cid);
      if(weakest*1.05>myP)recTarget=Math.min(42000,p.rec+20000);
    }
    if(!c.recUsed&&isBorder&&c.troops<Math.min(recTarget,cityCap(c))){
      const rm=recruitMult(c);
      const n=Math.min(RECRUIT_CAP,cityCap(c)-c.troops,Math.floor(f.gold*0.6/(RG*rm)/100)*100,Math.floor(f.food*0.4/(RF*rm)/100)*100);
      if(n>=1000){f.gold-=n*RG*rm;f.food-=n*RF*rm;c.troops+=n;c.tired+=n;c.recUsed=true;}
    }
    // 进攻
    const fresh=c.troops-c.tired;
    if(fresh>4000){
      let thr=p.atk;
      if(fresh>p.rec*1.2)thr=p.atk*0.8;
      if(myIds.length>=15)thr*=0.62;
      else if(myIds.length>=12)thr*=0.8;
      thr=Math.max(myIds.length>=15?1.0:1.05,thr);
      const ratio=fresh>p.rec*1.2?0.9:0.85;
      const cityGens=generalsIn(cid);
      const lcap=leadCap(cityGens); // 统御上限
      let best=-1,bestScore=0;
      for(const n of hostileN){
        const t=C(n);
        if(t.owner===state.player&&truceLeft(fid)>0)continue;
        const need=defPowerOf(n)*thr+1000;
        const commit=Math.min(Math.floor(fresh*ratio),lcap);
        const myP=atkPowerOf(commit,cityGens,cid,n);
        if(myP>need){
          const score=(myP/Math.max(1,need))*(t.owner==='neutral'?p.neu:1);
          if(score>bestScore){bestScore=score;best=n;}
        }
      }
      if(best>=0){
        const commit=Math.min(Math.floor(fresh*ratio),lcap);
        const gids=cityGens.map(g=>g.id);
        const r=doBattle(cid,best,commit,gids);
        reports.push(r);
        continue;
      }
    }
    // 增援前线
    if(!isBorder&&c.troops>8000){
      const friends=ADJ[cid].filter(n=>C(n).owner===fid);
      const front=friends.find(n=>ADJ[n].some(m=>C(m).owner!==fid));
      const tgt=front!==undefined?front:friends[0];
      if(tgt!==undefined){
        const t=C(tgt);
        const n=Math.min(Math.floor((c.troops-4000)/100)*100,
          leadCap(generalsIn(cid)),Math.max(0,cityCap(t)-t.troops));
        if(n>=1000){
          c.troops-=n;c.tired=Math.min(c.tired,c.troops);
          t.troops+=n;t.tired+=n;
          state.generals.filter(g=>g.fid===fid&&g.city===cid).slice(1).forEach(g=>g.city=tgt);
        }
      }
    }
  }
}
