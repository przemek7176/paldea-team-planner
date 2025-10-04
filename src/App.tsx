// @ts-nocheck
/* eslint-disable */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// Types & chart
const TYPES=["Bug","Dark","Dragon","Electric","Fairy","Fighting","Fire","Flying","Ghost","Grass","Ground","Ice","Normal","Poison","Psychic","Rock","Steel","Water"];
const CHART={Bug:{Grass:2,Psychic:2,Dark:2,Fighting:0.5,Flying:0.5,Poison:0.5,Ghost:0.5,Steel:0.5,Fire:0.5,Fairy:0.5},Dark:{Ghost:2,Psychic:2,Dark:0.5,Fighting:0.5,Fairy:0.5},Dragon:{Dragon:2,Steel:0.5,Fairy:0},Electric:{Water:2,Flying:2,Electric:0.5,Grass:0.5,Dragon:0.5,Ground:0},Fairy:{Fighting:2,Dragon:2,Dark:2,Fire:0.5,Poison:0.5,Steel:0.5},Fighting:{Normal:2,Ice:2,Rock:2,Dark:2,Steel:2,Flying:0.5,Ground:0.5,Poison:0.5,Bug:0.5,Psychic:0.5,Fairy:0.5,Ghost:0},Fire:{Grass:2,Ice:2,Bug:2,Steel:2,Fire:0.5,Water:0.5,Rock:0.5,Dragon:0.5},Flying:{Grass:2,Fighting:2,Bug:2,Electric:0.5,Rock:0.5,Steel:0.5},Ghost:{Ghost:2,Psychic:2,Dark:0.5,Normal:0},Grass:{Water:2,Ground:2,Rock:2,Fire:0.5,Grass:0.5,Poison:0.5,Flying:0.5,Bug:0.5,Dragon:0.5,Steel:0.5},Ground:{Fire:2,Electric:2,Poison:2,Rock:2,Steel:2,Grass:0.5,Bug:0.5,Flying:0},Ice:{Grass:2,Ground:2,Flying:2,Dragon:2,Fire:0.5,Water:0.5,Ice:0.5,Steel:0.5},Normal:{Rock:0.5,Steel:0.5,Ghost:0},Poison:{Grass:2,Fairy:2,Poison:0.5,Ground:0.5,Rock:0.5,Ghost:0.5,Steel:0},Psychic:{Fighting:2,Poison:2,Psychic:0.5,Steel:0.5,Dark:0},Rock:{Fire:2,Ice:2,Flying:2,Bug:2,Fighting:0.5,Ground:0.5,Steel:0.5},Steel:{Ice:2,Rock:2,Fairy:2,Fire:0.5,Water:0.5,Electric:0.5,Steel:0.5},Water:{Fire:2,Ground:2,Rock:2,Water:0.5,Grass:0.5,Dragon:0.5}};
const getWeaknesses=(defTypes)=>{
  const mult=Object.fromEntries(TYPES.map(t=>[t,1]));
  for(const atk of TYPES){
    let m=1;
    for(const def of defTypes){ m*= (CHART[atk] && CHART[atk][def]) ?? 1; }
    mult[atk]=m;
  }
  return TYPES.filter(t=>mult[t]>1).map(t=>({type:t,multiplier:mult[t]})).sort((a,b)=>b.multiplier-a.multiplier);
};

// helpers
const cap=(s)=>s.split("-").map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(" ");
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const load=(k,f)=>{try{const x=localStorage.getItem(k);return x?JSON.parse(x):f}catch{return f}};
const preserveScroll=(fn)=>{const y=window.scrollY; fn(); requestAnimationFrame(()=>window.scrollTo(0,y));};

// cache
const cache={async get(url){ const k="cache_"+url; try{const hit=localStorage.getItem(k); if(hit) return JSON.parse(hit);}catch{} const r=await fetch(url); if(!r.ok) throw new Error("fetch fail "+url); const j=await r.json(); try{localStorage.setItem(k,JSON.stringify(j))}catch{} return j; }};

// encounters minimal
const ENCOUNTERS=[{group:"Gyms",name:"Katy - Cortondo (Bug)",roster:[{types:["Bug"]},{types:["Bug"]},{types:["Bug"]}]},{group:"Gyms",name:"Grusha - Glaseado (Ice)",roster:[{types:["Ice"]},{types:["Ice"]},{types:["Ice"]}]}];
// areas
const AREA_LEVELS={"South Province":{"Area One":[5,8],"Area Three":[9,15]},"Glaseado Mountain":{"Peak":[36,45]}};


// --- OCR helpers (Tesseract.js) ---
async function ocrImage(file){
  try{
    const { data } = await Tesseract.recognize(file, 'eng', { logger: ()=>{} });
    return (data && data.text) ? data.text : '';
  }catch(e){ console.error(e); return ''; }
}
function canon(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function bestNameMatch(raw, dict){
  const c = canon(raw);
  if(!c) return null;
  if(dict[c]) return dict[c];
  let best=null, bestScore=-1;
  for(const [k,v] of Object.entries(dict)){
    let score=0;
    if(k===c) score=100;
    else if(k.startsWith(c)) score=80;
    else if(k.includes(c)) score=60;
    else if(c.includes(k)) score=50;
    if(score>bestScore){ bestScore=score; best=v; }
  }
  return best;
}
// ability bonus
const AB={ "huge-power":0.35, "pure-power":0.35, "regenerator":0.20, "beast-boost":0.20, "protean":0.20, "libero":0.20, "magic-guard":0.20, "intimidate":0.15, "levitate":0.10, "prankster":0.10 };

// UI components
const Tag=({children})=><span className="pill">{children}</span>;
const Section=({title,subtitle,children})=>(<div className="mb-6"><h2 className="text-xl font-semibold mb-1">{title}</h2>{subtitle&&<div className="text-sm text-gray-600 mb-2">{subtitle}</div>}<div className="bg-white rounded-2xl shadow p-4">{children}</div></div>);

function App(){
  const [tab,setTab]=useState(load("tab","Setup"));
      const [showImport,setShowImport]=useState(false);
  useEffect(()=>save("tab",tab),[tab]);

  // Profile modal state
  const [detailMon,setDetailMon]=useState(null);
  // TM catalog status
  const [tmStatus,setTmStatus]=useState({ready: !!load("tmMoveSet",null), size: (load("tmMoveSet",null)||[]).length||0, loading:false, scanned:0, pages:0});
  useEffect(()=>{ (async()=>{ try{ setTmStatus(s=>({...s,loading:true})); const set=await ensureTMSet(setTmStatus); setTmStatus({ready:true,size:(set&&set.size)||0,loading:false}); }catch(e){ setTmStatus({ready:false,size:0,loading:false}); } })(); },[]);


  // Species profile modal state
  // dex
  const [dex,setDex]=useState(load("dex_v10b",[]));
  const [loadingDex,setLoadingDex]=useState(false);
  useEffect(()=>{(async()=>{
    if(dex.length) return;
    setLoadingDex(true);
    try{
      const pdx=await cache.get("https://pokeapi.co/api/v2/pokedex/paldea");
      const species=(pdx.pokemon_entries||[]).map(e=>e.pokemon_species.name);
      let id=1; const results=[];
      for(const spec of species){
        try{
          const p=await cache.get(`https://pokeapi.co/api/v2/pokemon/${spec}`);
          const name=cap(spec);
          const types=p.types.map(t=>cap(t.type.name));
          let bst=0; const stats={};
          p.stats.forEach(s=>{stats[s.stat.name]=s.base_stat; bst+=s.base_stat;});
          results.push({id:id++, name, slug:spec, types, stats, bst, speciesUrl:p.species.url});
        }catch{}
      }
      setDex(results); save("dex_v10b",results);
    }catch(e){console.error(e)} finally{setLoadingDex(false);}
  })()},[]);

  // owned & lineup
  const [ownedIds,setOwnedIds]=useState(load("owned",[]));
  const [lineupIds,setLineupIds]=useState(load("lineup",[]));
  useEffect(()=>{save("owned",ownedIds);save("lineup",lineupIds)},[ownedIds,lineupIds]);
  const owned=dex.filter(m=>ownedIds.includes(m.id));
  const lineup=dex.filter(m=>lineupIds.includes(m.id));
  const inLineup=(id)=>lineupIds.includes(id);

  // global clear
  function clearMySelections(){
    if(!window.confirm("Clear Owned, Lineup, Owned Moves and per-mon moves?")) return;
    try{["owned","lineup","ownedMoves","monMoves","monLevels"].forEach(k=>localStorage.removeItem(k));}catch{}
    preserveScroll(()=>{ if(window.__appApi && window.__appApi.clearOwned) window.__appApi.clearOwned(); setLineupIds([]); setOwnedMoves({}); setMonMoves({}); setMonLevels({}); });
  }

  // moves inventory (names only)
  const [moveIndex,setMoveIndex]=useState(load("moveIndex",{}));
  const [loadingIdx,setLoadingIdx]=useState(false);
  useEffect(()=>{(async()=>{
    if(Object.keys(moveIndex).length) return;
    setLoadingIdx(true);
    try{
      const list=await cache.get("https://pokeapi.co/api/v2/move?limit=2000");
      const idx={}; (list.results||[]).forEach(r=>{ idx[cap(r.name)]=r.url; });
      setMoveIndex(idx); save("moveIndex",idx);
    }catch(e){console.error(e)} finally{setLoadingIdx(false);}
  })()},[]);
  const [ownedMoves,setOwnedMoves]=useState(load("ownedMoves",{}));
  useEffect(()=>save("ownedMoves",ownedMoves),[ownedMoves]);

  // per-mon moves and levels
  const [monMoves,setMonMoves]=useState(load("monMoves",{}));
  useEffect(()=>save("monMoves",monMoves),[monMoves]);
  const [monLevels,setMonLevels]=useState(load("monLevels",{}));
  useEffect(()=>save("monLevels",monLevels),[monLevels]);
  // --- M3: TM consumption policy + teach flow ---
  const [tmPolicy,setTmPolicy]=useState(load("tmPolicy","none")); // 'none' | 'consume' | 'ask'
  useEffect(()=>save("tmPolicy",tmPolicy),[tmPolicy]);

  const [replaceCtx,setReplaceCtx]=useState(null); // {mon, moveName}
  const [undo,setUndo]=useState(null); // {monId, prevMoves, newMoves, moveName, consumed}
  const [snack,setSnack]=useState(null);
  useEffect(()=>{
    if(!snack) return;
    const t=setTimeout(()=>setSnack(null), 9000);
    return ()=>clearTimeout(t);
  },[snack]);

  function showUndo(action){
    setUndo(action);
    const mon = dex.find(m=>m.id===action.monId);
    setSnack(`Taught ${action.moveName} to ${mon?mon.name:'Pokémon'} — `);
  }

  function applyConsumption(moveName){
    if(tmPolicy==="none") return null;
    const v = (ownedMoves||{})[moveName];
    if(typeof v === "number"){
      if(tmPolicy==="consume" || (tmPolicy==="ask" && window.confirm('Consume 1 '+moveName+'?'))){
        const next = v - 1;
        if(next < 0){ alert('Not enough TMs of '+moveName); return 'blocked'; }
        setOwnedMoves(prev=>({...prev, [moveName]: next}));
        return {name: moveName, prevCount: v};
      }
      return null;
    } else {
      if(tmPolicy==="ask"){
        const ok = window.confirm('Consume a TM for '+moveName+'? (No counts stored; will not decrement)');
        if(!ok) return null;
      }
      return null;
    }
  }
  function revertConsumption(consumed){
    if(!consumed) return;
    setOwnedMoves(prev=>({...prev,[consumed.name]:consumed.prevCount}));
  }

  async function teachMove(mon, moveName){
    try{
      const cur = monMoves[mon.id] || [];
      if(cur.includes(moveName)){ alert('Already knows '+moveName); return; }
      const learned = await getAllMovesForPokemon(mon);
      const isTM = (learned||[]).some(m=>m.name===moveName && m.tmItem);
      if(!isTM){ alert('That move is not TM-compatible for '+mon.name); return; }
      if(cur.length < 4){
        const consumed = applyConsumption(moveName);
        if(consumed==='blocked') return;
        const prevMoves = cur.slice();
        const newMoves = [...cur, moveName];
        setMonMoves(prev=>({...prev,[mon.id]: newMoves}));
        showUndo({monId:mon.id, prevMoves, newMoves, moveName, consumed});
        return;
      }
      setReplaceCtx({mon, moveName});
    }catch(e){ console.error('teachMove failed', e); }
  }
  function applyReplace(slotIdx){
    const ctx = replaceCtx; if(!ctx) return;
    const {mon, moveName} = ctx;
    const cur = monMoves[mon.id] || [];
    const prevMoves = cur.slice();
    const kept = cur.filter((_,i)=>i!==slotIdx);
    const newMoves = [...kept, moveName];
    const consumed = applyConsumption(moveName);
    if(consumed==='blocked') return;
    setMonMoves(prev=>({...prev,[mon.id]: newMoves}));
    setReplaceCtx(null);
    showUndo({monId:mon.id, prevMoves, newMoves, moveName, consumed});
  }
  function doUndo(){
    if(!undo) return;
    setMonMoves(prev=>({...prev, [undo.monId]: undo.prevMoves}));
    revertConsumption(undo.consumed);
    setUndo(null); setSnack(null);
  }

  // Expose tiny API for DevKit
  useEffect(()=>{
    window.__appApi = {
      dex: ()=>dex,
      owned: ()=>owned,
      addOwnedMon: (id)=>setOwnedIds(prev=> prev.includes(id)? prev : [...prev, id]),
      clearOwned: ()=>setOwnedIds([]),
      setMonMoves: (id, arr)=>setMonMoves(prev=>({...prev,[id]:arr})),
      addOwnedMove: (name, countOrBool=true)=>setOwnedMoves(prev=>({...prev,[name]: countOrBool})),
      teachMove: (mon, move)=>teachMove(mon, move),
    };
  }, [dex, owned, monMoves, ownedMoves, tmPolicy]);


  // learnset cache
  const [learnsetCache,setLearnsetCache]=useState(load("learnsetCache",{}));
  const vgName="scarlet-violet";
  async function getAllMovesForPokemon(mon){
    if(learnsetCache[mon.id]) return learnsetCache[mon.id];
    const p=await cache.get(`https://pokeapi.co/api/v2/pokemon/${mon.slug}`);
    const pref=new Map(); const urls=[];
    for(const mv of (p.moves||[])){
      const sv=(mv.version_group_details||[]).find(d=>d.version_group && d.version_group.name===vgName);
      if(!sv) continue;
      const method=sv.move_learn_method?.name||""; const level=sv.level_learned_at||0;
      const rank=method==="machine"?4:method==="level-up"?3:method==="tutor"?2:method==="egg"?1:0;
      const nm=mv.move.name; const prev=pref.get(nm);
      if(!prev || rank>prev.rank || (rank===prev.rank && level>prev.level)) pref.set(nm,{method,level,rank});
      urls.push(mv.move.url);
    }
    const uniq=[...new Set(urls)]; const out=[];
    for(const url of uniq){
      try{
        const mv=await cache.get(url);
        const name=cap(mv.name); const type=cap(mv.type.name); const power=mv.power||0;
        let tm=null;
        for(const mc of (mv.machines||[])){ if(mc.version_group && mc.version_group.name===vgName){ const machine=await cache.get(mc.machine.url); tm=(machine.item?.name||"").toUpperCase(); break; } }
        const pf=pref.get(mv.name)||{method:"level-up",level:0};
        const source= tm ? tm : (pf.method==="level-up" ? `Level-up${pf.level?` ${pf.level}`:""}` : (pf.method||"").replace("-"," "));
        out.push({name,type,power,tmItem:tm,source});
      }catch{}
    }
    out.sort((a,b)=> (b.power||0)-(a.power||0) || a.name.localeCompare(b.name));
    setLearnsetCache(prev=>({...prev,[mon.id]:out}));
    return out;
  }

  // evo meta
  const [finalMetaCache,setFinalMetaCache]=useState(load("finalMeta",{}));
      const [tmMoveSet,setTmMoveSet]=useState(load("tmMoveSet",null));
      useEffect(()=>save("tmMoveSet",tmMoveSet),[tmMoveSet]);
      async function ensureTMSetOLD(){
        if(tmMoveSet) return tmMoveSet;
        try{
          const mvset=new Set();
          let next="https://pokeapi.co/api/v2/machine?limit=1000";
          while(next){
            const page=await cache.get(next);
            for(const r of (page.results||[])){
              try{
                const mc=await cache.get(r.url);
                if(mc.version_group && mc.version_group.name===vgName){
                  const nm = mc.move?.name; if(nm) mvset.add(nm.toLowerCase());
                }
              }catch(e){}
            }
            next=page.next;
          }
          setTmMoveSet(Array.from(mvset));
          window._tmCatalog = mvset;
          return mvset;
        }catch(e){ console.warn("TM set load failed", e); return new Set(); }
      }

  const [evoSummaryCache,setEvoSummaryCache]=useState(load("evoSummary",{}));
  useEffect(()=>save("evoSummary",evoSummaryCache),[evoSummaryCache]);
  const abilityBonus=(abilities)=>{ let b=0; (abilities||[]).forEach(a=>{ b+=(AB[a.ability?.name]||0); }); return b; };
  async function getFinalMeta(mon){
    if(finalMetaCache[mon.id]) return finalMetaCache[mon.id];
    try{
      const species=await cache.get(mon.speciesUrl);
      const chain=await cache.get(species.evolution_chain.url);
      function path(node,target){ if(node.species.name===target) return [node]; for(const ch of node.evolves_to){ const p=path(ch,target); if(p) return [node,...p]; } return null; }
      const pth=path(chain.chain,mon.slug)||[chain.chain]; let cur=pth[pth.length-1];
      while(cur && cur.evolves_to && cur.evolves_to.length){ cur=cur.evolves_to[0]; }
      const finalSlug=cur?cur.species.name:pth[pth.length-1].species.name;
      const p=await cache.get(`https://pokeapi.co/api/v2/pokemon/${finalSlug}`);
      const stats={}; let bst=0; p.stats.forEach(s=>{stats[s.stat.name]=s.base_stat; bst+=s.base_stat;});
      const meta={finalSlug,finalBST:bst,finalStats:stats,abBonus:abilityBonus(p.abilities||[]),evoCost:0,evoSteps:0};
      setFinalMetaCache(prev=>({...prev,[mon.id]:meta}));
      return meta;
    }catch(e){ return {finalSlug:mon.slug,finalBST:mon.bst,finalStats:mon.stats,abBonus:0,evoCost:0,evoSteps:0}; }
  }
  async function getMetaForLevel(mon, level){
    try{
      const species=await cache.get(mon.speciesUrl);
      const chain=await cache.get(species.evolution_chain.url);
      function pathTo(node,target){ if(node.species.name===target) return [node]; for(const ch of (node.evolves_to||[])){ const p=pathTo(ch,target); if(p) return [node,...p]; } return null; }
      const pth=pathTo(chain.chain, mon.slug) || [chain.chain];
      let stage=pth[0]; let idx=0;
      while(idx<pth.length-1){
        const nxt=pth[idx+1]; const d=(nxt.evolution_details&&nxt.evolution_details[0])||null;
        if(d && d.trigger && d.trigger.name==="level-up"){ const need=d.min_level||0; if(level && level>=need){ stage=nxt; idx++; continue; } else break; }
        break;
      }
      const stageSlug=stage.species.name;
      const p=await cache.get(`https://pokeapi.co/api/v2/pokemon/${stageSlug}`);
      const stats={}; let bst=0; p.stats.forEach(s=>{stats[s.stat.name]=s.base_stat; bst+=s.base_stat;});
      const types=p.types.map(t=>cap(t.type.name));
      let evoCost=0, steps=0; let cur=stage;
      while(cur && cur.evolves_to && cur.evolves_to.length){
        const nxt=cur.evolves_to[0]; const d=(nxt.evolution_details&&nxt.evolution_details[0])||null;
        steps++;
        if(d){ if(d.trigger?.name==="use-item") evoCost+=0.10; else if(d.trigger?.name==="trade") evoCost+=0.20; else if(d.trigger?.name==="level-up" && (d.min_level||0)>=40) evoCost+=0.20; else evoCost+=0.05; } else { evoCost+=0.05; }
        cur=nxt;
      }
      evoCost=Math.min(0.5,evoCost);
      const ab=abilityBonus(p.abilities||[]);
      return {finalSlug:stageSlug,finalBST:bst,finalStats:stats,abBonus:ab,evoCost:evoCost,evoSteps:steps,typesAtLevel:types};
    }catch(e){ const fm=await getFinalMeta(mon); return {...fm, typesAtLevel:mon.types}; }
  }
  async function getEvolutionSummary(mon){
    if(evoSummaryCache[mon.id]) return evoSummaryCache[mon.id];
    try{
      const species=await cache.get(mon.speciesUrl);
      const chain=await cache.get(species.evolution_chain.url);
      function walk(node, arr){ if(node.evolves_to && node.evolves_to.length){ const nxt=node.evolves_to[0]; const d=(nxt.evolution_details&&nxt.evolution_details[0])||null;
        function nice(d){ if(!d) return "Evolve"; if(d.trigger?.name==="level-up") return d.min_level?`Lv ${d.min_level}`:"Level-up"; if(d.trigger?.name==="use-item") return `Use ${cap(d.item.name)}`; if(d.trigger?.name==="trade") return d.held_item?`Trade holding ${cap(d.held_item.name)}`:"Trade"; if(d.min_happiness) return "High friendship"; return "Evolve"; }
        arr.push(`${cap(node.species.name)} → ${cap(nxt.species.name)} (${nice(d)})`); walk(nxt,arr);
      } }
      const parts=[]; walk(chain.chain,parts);
      const txt=parts.join(" → ");
      setEvoSummaryCache(prev=>({...prev,[mon.id]:txt})); return txt;
    }catch(e){ return ""; }
  }

  // scoring helpers
  const normalize=(x,max)=>Math.max(0,Math.min(1,x/max));
  const rolesOf=(stats)=>{ const atk=stats.attack||0, spa=stats["special-attack"]||0, hp=stats.hp||0, def=stats.defense||0, spd=stats["special-defense"]||0, spe=stats.speed||0; const roles=[]; if(Math.max(atk,spa)>=95) roles.push("sweeper"); if(hp+def+spd>=270) roles.push("bulky"); if(spe>=100) roles.push("fast"); return roles.length?roles:["general"]; };
  const targetWeaknessScores=(roster)=>{ const s=Object.fromEntries(TYPES.map(t=>[t,0])); for(const r of roster){ getWeaknesses(r.types).forEach(w=>{ s[w.type]+= (w.multiplier>=4?2:1); }); } return s; };
  const syntheticTargetByLevel=(lmin,lmax)=>{ const base=Object.fromEntries(TYPES.map(t=>[t,1])); if(lmax<=20){ base.Flying+=2;base.Water+=2;base.Ground+=2;base.Rock+=1;base.Fire+=1; } else if(lmax<=35){ base.Water+=2;base.Ground+=2;base.Fighting+=1;base.Fairy+=1;base.Electric+=1; } else { base.Dragon+=2;base.Ice+=2;base.Dark+=1;base.Steel+=1;base.Fairy+=1;base.Ghost+=1; } const roster=[]; Object.entries(base).forEach(([t,w])=>{ for(let i=0;i<w;i++) roster.push({types:[t]}); }); return roster; };
  const W={ Optimal:{w_viab:1.5,w_cov:0.8,dup:-0.6,dupRole:-0.4,fragile:-0.5,slow:-0.3,evo:-0.4}, Tanky:{w_viab:1.3,w_cov:0.7,dup:-0.5,dupRole:-0.5,fragile:-0.8,slow:-0.2,evo:-0.2}, Early:{w_viab:1.0,w_cov:0.8,dup:-0.4,dupRole:-0.3,fragile:-0.3,slow:-0.1,evo:-0.1}, Fun:{w_viab:0.9,w_cov:1.0,dup:-0.2,dupRole:-0.2,fragile:-0.2,slow:-0.1,evo:-0.1} };
  const [playstyle,setPlaystyle]=useState(load("style","Optimal")); const [Vmin,setVmin]=useState(load("Vmin",0.60)); useEffect(()=>{save("style",playstyle);save("Vmin",Vmin)},[playstyle,Vmin]);

  async function scoreMon(mon, targetScores, coveredTypes, usedPrimary, usedPrimaryRole){
    const lvl=monLevels[mon.id]||100;
    const meta=await getMetaForLevel(mon,lvl);
    const st=meta.finalStats;
    const offenseN=normalize(Math.max(st.attack||0,st["special-attack"]||0),160);
    const bulkN=normalize((st.hp||0)+(st.defense||0)+(st["special-defense"]||0),600);
    const speedN=normalize(st.speed||0,160);
    let viability=0.45*offenseN + 0.35*bulkN + 0.20*speedN + meta.abBonus - meta.evoCost;
    if(meta.finalBST && meta.finalBST<400) viability*=0.65; else if(meta.finalBST && meta.finalBST<470) viability*=0.85;
    viability=Math.max(0,Math.min(1.3,viability));
    let covGain=0;
    if(viability>=Vmin){ for(const t of (meta.typesAtLevel||mon.types)){ if(!coveredTypes.has(t)) covGain+=(targetScores[t]||0); } }
    const isFragile=bulkN<0.35, isSlow=speedN<0.25;
    const roles=rolesOf(st); const prio={bulky:3,sweeper:2,fast:1,general:0}; const primaryRole=(roles.slice().sort((a,b)=>(prio[b]||0)-(prio[a]||0))[0])||"general";
    const Wp=W[playstyle]||W.Optimal;
    let score=Wp.w_viab*viability + Wp.w_cov*covGain;
    if(usedPrimary.has((meta.typesAtLevel||mon.types)[0])) score+=Wp.dup;
    if(usedPrimaryRole.has(primaryRole)) score+=Wp.dupRole;
    if(isFragile) score+=Wp.fragile;
    if(isSlow) score+=Wp.slow;
    score+=Wp.evo * (-meta.evoCost);
    const why=[]; if(covGain>0) why.push(`+covers ${covGain.toFixed(0)} weaknesses`); if(meta.abBonus>0.15) why.push("+ability power"); if(meta.evoSteps>0) why.push("−needs evolution"); if(usedPrimary.has((meta.typesAtLevel||mon.types)[0])) why.push("−dup type"); if(isFragile) why.push("−fragile"); if(isSlow) why.push("−slow");
    return {score,viability,primaryRole,why, typesAtLevel:(meta.typesAtLevel||mon.types)};
  }

  async function suggestTeam(pool, roster){
    const targetScores=targetWeaknessScores(roster||[]);
    const team=[]; const why=[]; const covered=new Set(); const usedPrimary=new Set(); const usedPrimaryRole=new Set();
    const candidates=[...pool];
    while(team.length<6 && candidates.length){
      const scored=await Promise.all(candidates.map(m=>scoreMon(m,targetScores,covered,usedPrimary,usedPrimaryRole)));
      let bestIdx=0; let best=null;
      for(let i=0;i<candidates.length;i++){
        const s=scored[i]; const b=best;
        if(!b || s.score>b.score || (s.score===b.score && (s.viability>b.viability || (s.viability===b.viability && candidates[i].name < candidates[bestIdx].name)))){
          bestIdx=i; best=s;
        }
      }
      const pick=candidates[bestIdx];
      team.push(pick); why.push(best.why);
      best.typesAtLevel.forEach(t=>covered.add(t));
      usedPrimary.add(best.typesAtLevel[0]); usedPrimaryRole.add(best.primaryRole);
      candidates.splice(bestIdx,1);
    }
    // convert team of mon objects (we pushed raw mon) + keep why order OK
    return {team:team, why:why};
  }

  function pickMovesFor(mon, learnset, targetRoster){
    const target=targetWeaknessScores(targetRoster||[]);
    const ownedList=(learnset||[]).filter(m=>ownedMoves[m.name]);
    const chosen=[]; const chosenTypes=new Set();
    // STAB
    for(const t of mon.types){
      const cand=ownedList.filter(m=>m.type===t).sort((a,b)=>(b.power||0)-(a.power||0));
      if(cand.length && chosen.length<4){ chosen.push(cand[0]); chosenTypes.add(t); }
    }
    if(chosen.length<2){
      const t=mon.types[0];
      const cand=ownedList.filter(m=>m.type===t && !chosen.some(x=>x.name===m.name)).sort((a,b)=>(b.power||0)-(a.power||0));
      if(cand.length && chosen.length<4){ chosen.push(cand[0]); chosenTypes.add(t); }
    }
    // coverage
    const sortedTypes=Object.entries(target).sort((a,b)=>b[1]-a[1]).map(([t])=>t);
    for(const t of sortedTypes){
      if(chosen.length>=4) break;
      if(chosenTypes.has(t)) continue;
      const cand=ownedList.filter(m=>m.type===t).sort((a,b)=>(b.power||0)-(a.power||0));
      if(cand.length){ chosen.push(cand[0]); chosenTypes.add(t); }
    }
    // uniq
    const uniq=[]; const seen=new Set();
    for(const m of chosen){ if(!seen.has(m.name)){ seen.add(m.name); uniq.push(m); if(uniq.length>=4) break; } }
    return uniq;
  }

  // Tabs components
  function SetupTab({showImport,setShowImport}){

        const [tmNewMove,setTmNewMove]=useState("");
        function addMoveToTmImport(raw){
          const mm = bestNameMatch(raw, moveDict) || raw.trim();
          if(!mm) return;
          setTmImport(prev=>{
            const set = new Set(prev.moves);
            if(!set.has(mm)) set.add(mm);
            return {...prev, moves: Array.from(set)};
          });
          setTmNewMove("");
        }
        function removeMoveFromTmImport(name){
          setTmImport(prev=>({...prev, moves: prev.moves.filter(x=>x!==name)}));
        }
        const pokemonImportRef = React.useRef(null);
        const tmImportRef = React.useRef(null);
        useEffect(()=>{
          if(showImport==="pokemon" && pokemonImportRef.current){ pokemonImportRef.current.scrollIntoView({behavior:"smooth"}); }
          if(showImport==="tm" && tmImportRef.current){ tmImportRef.current.scrollIntoView({behavior:"smooth"}); }
        },[showImport]);

        const [tmImportOpen,setTmImportOpen]=useState(false);
        const [tmImport,setTmImport]=useState({text:"", moves:[], tmOnly:true});

        async function handleTMScreenshot(file){
          // Ensure move index ready
          if(!Object.keys(moveIndex).length){ const list=await cache.get("https://pokeapi.co/api/v2/move?limit=2000"); const idx={}; (list.results||[]).forEach(r=>{ idx[cap(r.name)]=r.url; }); setMoveIndex(idx); save("moveIndex",idx); }
          const text = await ocrImage(file);
          const tokens = text.split(/[\n\r]+/).map(t=>t.trim());

          const matches=[]; const seen=new Set();
          for(const line of tokens){
            if(/^\d+\s*\/\s*\d+$/.test(line)) continue; // skip PP like 5/5
            const mm = bestNameMatch(line, moveDict);
            if(mm && !seen.has(mm)){ seen.add(mm); matches.push(mm); }
          }
          setTmImport({text, moves:matches.slice(0,200), tmOnly:true});
          setTmImportOpen(true);
        }


        const [importOpen,setImportOpen]=useState(false);
        const [importResult,setImportResult]=useState(null); // {text,name,level,moves:[]}
        // Precompute canonical dictionaries
        const nameDict = useMemo(()=>Object.fromEntries(dex.map(m=>[canon(m.name), m.name])),[dex.length]);
        const moveDict = useMemo(()=>Object.fromEntries(Object.keys(moveIndex).map(n=>[canon(n), n])),[Object.keys(moveIndex).length]);

        async function handleScreenshot(file){
          const text = await ocrImage(file);
          // Parse name (prefer a known Dex name in the text)
          let foundName=null;
          const tokens = text.split(/[\n\r]+/).map(t=>t.trim()).filter(Boolean);
          for(const t of tokens){
            const m = bestNameMatch(t, nameDict);
            if(m){ foundName=m; break; }
          }
          // Parse level
          let level=null;
          const lvMatch = text.match(/L[vV]\.?\s*(\d{1,3})/);
          if(lvMatch) level=parseInt(lvMatch[1]);
          // Parse moves
          let moves=[];
          const idx = tokens.findIndex(t=>/current\s*moves/i.test(t));
          let moveLines = idx>=0 ? tokens.slice(idx+1, idx+12) : tokens;
          for(const line of moveLines){
            if(/^\d+\s*\/\s*\d+$/.test(line)) continue;
            if(/change\s*moves/i.test(line)) continue;
            const mm = bestNameMatch(line, moveDict);
            if(mm && !moves.includes(mm)) moves.push(mm);
            if(moves.length>=4) break;
          }
          setImportResult({text, name: foundName, level, moves});
          setImportOpen(true);
        }

    const [q,setQ]=useState("");
    const list=dex.filter(m=>!q || m.name.toLowerCase().includes(q.toLowerCase()));
    const [mvQuery,setMvQuery]=useState("");
    const mvMatches=useMemo(()=>{ const f=mvQuery.trim().toLowerCase(); if(!f) return []; return Object.keys(moveIndex).filter(n=>n.toLowerCase().includes(f)).sort().slice(0,50); },[mvQuery,moveIndex]);
    const [bulkPkmn,setBulkPkmn]=useState("");
    const [bulkMoves,setBulkMoves]=useState("");
    const addMove=(name)=>preserveScroll(()=>setOwnedMoves(prev=>({...prev,[name]:true})));
    const removeMove=(name)=>preserveScroll(()=>setOwnedMoves(prev=>{const cp={...prev}; delete cp[name]; return cp;}));

    return (<>
            
            {/\bdev=1\b/.test(location.search) ? (
              <div className="flex flex-wrap items-center gap-2 text-xs -mt-2 mb-2">
                <span className="text-gray-600">Dev tools (Owned):</span>
                <button type="button" className="px-2 py-1 rounded border" onClick={()=>{
                  const api = window.__appApi;
                  if(!api){ alert('Dev API not ready'); return; }
                  const list = (api.dex && api.dex()) || [];
                  list.forEach(m=> api.addOwnedMon(m.id));
                  alert('All Paldea Pokémon added to Owned.');
                }}>Add all Pokémon</button>
                <button type="button" className="px-2 py-1 rounded border border-rose-300 text-rose-700" onClick={()=>{
                  if(!confirm('Clear ALL Owned Pokémon?')) return;
                  if(window.__appApi && window.__appApi.clearOwned) window.__appApi.clearOwned();
                }}>Clear Owned</button>
              </div>
            ) : null}
        
            
            <Section title="Import Pokémon screenshot" subtitle="Drop a summary screen (e.g., Current Moves). We will OCR name, level, and moves.">
              <div ref={pokemonImportRef}></div>
              <div
                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{e.preventDefault(); const f=e.dataTransfer.files && e.dataTransfer.files[0]; if(f) handleScreenshot(f);}}
                className="border-2 border-dashed rounded-2xl p-6 bg-gray-50 text-center text-sm text-gray-600">
                Drop an image here, or <label className="underline cursor-pointer"><input type="file" accept="image/*" className="hidden" onChange={e=>{ const f=e.target.files && e.target.files[0]; if(f) handleScreenshot(f); }} />choose a file</label>.
              </div>
              {importOpen && importResult && (
                <div className="mt-3 border rounded-2xl p-3 bg-white">
                  <div className="font-medium mb-1">OCR result (editable)</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm">Pokémon</label>
                      <input className="w-full border rounded-xl px-3 py-2" value={importResult.name||''} onChange={e=>setImportResult({...importResult, name:e.target.value})} placeholder="Name" />
                    </div>
                    <div>
                      <label className="text-sm">Level</label>
                      <input type="number" min="1" max="100" className="w-full border rounded-xl px-3 py-2" value={importResult.level||''} onChange={e=>setImportResult({...importResult, level:parseInt(e.target.value||0)})} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="text-sm">Moves (up to 4)</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(importResult.moves||[]).map((mv,i)=>(<span key={mv+i} className="pill">{mv}<button className="ml-1 text-[10px] border rounded px-1" onClick={()=>setImportResult({...importResult, moves:(importResult.moves||[]).filter((_,j)=>j!==i)})}>×</button></span>))}
                    <input className="mt-2 w-full border rounded-xl px-3 py-2" placeholder="Add move... (Enter)" onKeyDown={e=>{ if(e.key==="Enter"){ const val=(e.target.value||"").trim(); if(!val) return; const names=Object.keys(moveIndex||{}); const canonVal=canon(val); let pick=names.find(n=>canon(n).includes(canonVal))||cap(val); const arr=Array.from(new Set([...(importResult.moves||[]), pick])).slice(0,4); setImportResult({...importResult, moves:arr}); e.target.value=""; } }} />
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="px-3 py-2 rounded-xl border" onClick={()=>{
                      const name = importResult.name; const idBy = Object.fromEntries(dex.map(m=>[canon(m.name), m.id]));
                      let id = idBy[canon(name)];
                      if(!id){ id = bestNameMatch(name, idBy); }
                      if(!id){ alert('Could not match Pokémon. Please correct the name.'); return; }
                      const exists=ownedIds.includes(id);
                      let action = exists ? (window.confirm('This Pokémon already exists. Click OK to Replace, or Cancel to Merge.') ? 'replace':'merge') : 'new';
                      preserveScroll(()=>{
                        setOwnedIds(prev=> prev.includes(id)? prev : [...prev, id]);
                        if(importResult.level){
                          setMonLevels(prev=> action==='replace' ? ({...prev,[id]:importResult.level}) : ({...prev,[id]: Math.max(prev[id]||0, importResult.level)}));
                        }
                        if(importResult.moves && importResult.moves.length){
                          setMonMoves(prev=>{
                            const current = prev[id]||[];
                            const inc = importResult.moves.slice(0,4);
                            const next = action==='replace' ? inc : Array.from(new Set([...current, ...inc])).slice(0,4);
                            return ({...prev, [id]: next});
                          });
                          setOwnedMoves(prev=>{ const cp={...prev}; importResult.moves.forEach(n=>cp[n]=true); return cp; });
                        }
                      });
                      console.log(action==='replace'?'Replaced existing Pokémon.':action==='merge'?'Merged with existing.':'Added to collection.');
                      setImportOpen(false); if(setShowImport) setShowImport(false);
                    }}>Save to my collection</button>
                    <button type="button" className="px-3 py-2 rounded-xl border" onClick={()=>{setImportOpen(false); if(setShowImport) setShowImport(false);}}>Close</button>
                  </div>
                </div>
              )}
            </Section>
            
            <Section title="Import TM inventory screenshot" subtitle="Drop your TM list. We'll OCR move names and add them to Owned Moves.">
              <div ref={tmImportRef}></div>
              <div
                onDragOver={e=>e.preventDefault()}
                onDrop={async e=>{e.preventDefault(); const f=e.dataTransfer.files && e.dataTransfer.files[0]; if(f) await handleTMScreenshot(f);}}
                className="border-2 border-dashed rounded-2xl p-6 bg-gray-50 text-center text-sm text-gray-600 mb-2">
                Drop an image here, or <label className="underline cursor-pointer"><input type="file" accept="image/*" className="hidden" onChange={async e=>{ const f=e.target.files && e.target.files[0]; if(f) await handleTMScreenshot(f); }} />choose a file</label>.
              </div>
              {tmImportOpen && (
                <div className="mt-3 border rounded-2xl p-3 bg-white">
                  <div className="font-medium mb-2">OCR result (editable)</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                    <div>
                      <label className="text-sm">Moves detected</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {tmImport.moves.length ? tmImport.moves.map((mv,i)=>(
                          <span key={mv+i} className="pill">
                            {mv}
                            <button type="button" className="ml-2 text-[10px] opacity-70 hover:opacity-100" onClick={()=>removeMoveFromTmImport(mv)}>✕</button>
                          </span>
                        )) : <span className="text-sm text-gray-500">No moves yet - add below</span>}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm">Add a move by name</label>
                      <div className="flex gap-2 mt-1">
                        <input className="w-full border rounded-xl px-3 py-2" placeholder="e.g., Foul Play" value={tmNewMove} onChange={e=>setTmNewMove(e.target.value)} />
                        <button type="button" className="px-3 py-2 rounded-xl border" onClick={()=>addMoveToTmImport(tmNewMove)}>Add</button>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">We fuzzy-match to the move index. Minor OCR typos are okay.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <input id="tmOnly" type="checkbox" checked={tmImport.tmOnly} onChange={e=>setTmImport({...tmImport, tmOnly:e.target.checked})} />
                    <label htmlFor="tmOnly" className="text-sm">Only add if it is a Scarlet/Violet TM (recommended)</label>
                    <button type="button" className="text-xs underline" onClick={async ()=>{ try{ setTmStatus(s=>({...s,loading:true})); const set=await ensureTMSet(setTmStatus); setTmStatus({ready:true,size:(set&&set.size)||0,loading:false}); console.log('TM catalog loaded'); }catch(e){ setTmStatus({ready:false,size:0,loading:false}); console.warn('TM catalog failed to load'); } }}>Load TM catalog</button>
                    <span className="text-xs text-gray-600 ml-2">{tmStatus.loading?"TM catalog: Loading...": tmStatus.ready?`TM catalog: Loaded ✓ (${tmStatus.size||0} moves)`: "TM catalog: Not loaded"}</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="px-3 py-2 rounded-xl border" onClick={async ()=>{
                      let toAdd = tmImport.moves.slice();
                      if(tmImport.tmOnly){
                        const set = await ensureTMSet(setTmStatus);
                        const lower = new Set(Array.isArray(tmMoveSet)?tmMoveSet: Array.from(set));
                        toAdd = toAdd.filter(n=> lower.has(n.toLowerCase().replace(/[^a-z0-9\- ]/g,'' ).replace(/\s+/g,'-')) || lower.has(n.toLowerCase()));
                      }
                      if(!toAdd.length){ alert('No valid moves to add.'); return; }
                      preserveScroll(()=>setOwnedMoves(prev=>{ const cp={...prev}; toAdd.forEach(n=>cp[n]=true); return cp; }));
                      setTmImportOpen(false);
                    }}>Add to my Owned Moves</button>
                    <button type="button" className="px-3 py-2 rounded-xl border" onClick={()=>setTmImportOpen(false)}>Close</button>
                  </div>
                </div>
              )}
            </Section>

        

      <Section title="Owned Pokémon" subtitle="Search and add to Owned. Manage your current lineup (6).">
        <div className="flex flex-col md:flex-row gap-3 mb-3">
          <input className="w-full md:w-1/2 border rounded-xl px-3 py-2" placeholder="Search name..." value={q} onChange={e=>setQ(e.target.value)} onMouseDown={e=>e.stopPropagation()} />
          <div className="text-sm text-gray-600">{loadingDex?"Loading Pokédex...":`${dex.length} mons`}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {list.map(mon=>(
            <div key={mon.id} className={`flex items-center justify-between border rounded-2xl p-3 bg-white ${ownedIds.includes(mon.id)?"ring-2 ring-emerald-400":""}`}>
              <div className="flex items-center gap-2"><Sprite mon={mon} size={32} /><div><div className="font-medium">{mon.name}</div><div className="text-xs text-gray-600">{mon.types.join(" / ")} • BST {mon.bst}</div></div></div>
              <div className="flex gap-2">
                <button type="button" className="px-3 py-1 rounded-xl border text-sm" onClick={()=>preserveScroll(()=>setOwnedIds(prev=>prev.includes(mon.id)?prev.filter(x=>x!==mon.id):[...prev,mon.id]))}>{ownedIds.includes(mon.id)?"Owned ✓":"Own"}</button>
                <button type="button" className="px-3 py-1 rounded-xl border text-sm" onClick={()=>preserveScroll(()=>setLineupIds(prev=>prev.includes(mon.id)?prev.filter(x=>x!==mon.id):(prev.length<6?[...prev,mon.id]:prev)))}>{inLineup(mon.id)?"Remove":"Add to 6"}</button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5"><div className="font-semibold mb-1">Current lineup ({lineup.length}/6)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lineup.map(mon=>(
              <div key={mon.id} className="flex items-center justify-between border rounded-xl p-2 bg-white">
                <div className="flex items-center gap-2"><Sprite mon={mon} size={32} /><div><div className="font-medium">{mon.name}</div><div className="text-xs text-gray-600">{mon.types.join(" / ")} • BST {mon.bst}</div></div></div>
                <button type="button" className="text-xs px-2 py-1 rounded border" onClick={()=>preserveScroll(()=>setLineupIds(prev=>prev.filter(x=>x!==mon.id)))}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Owned Moves moved to Inventory tab in M2 */}


      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">Need a fresh start? This resets Owned Pokémon, lineup, Owned Moves and per-mon moves.</div>
        <button type="button" className="px-3 py-2 rounded-xl border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 text-sm" onClick={clearMySelections}>Clear my selections</button>
      </div>
    </>);
  }

  function MoveEditor({mon,onClose}){
    const [filter,setFilter]=useState("");
    const [list,setList]=useState([]);
    const sel = new Set(monMoves[mon.id]||[]);
    const [local,setLocal]=useState(new Set(sel));
    useEffect(()=>{(async()=>{ const l=await getAllMovesForPokemon(mon); setList(l); })()},[mon.id]);
    const toggle=(name)=>{ const cp=new Set(local); if(cp.has(name)) cp.delete(name); else { if(cp.size>=4) return; cp.add(name); } setLocal(cp); };
    const saveMoves=()=>{ preserveScroll(()=>setMonMoves(prev=>({...prev,[mon.id]:Array.from(local)}))); onClose(); };
    const matches=list.filter(m=>!filter || m.name.toLowerCase().includes(filter.toLowerCase()));
    return (<div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
<style>{`
.pill{display:inline-flex;align-items:center;padding:.125rem .5rem;border-radius:9999px;background:#f3f4f6;color:#111827;font-size:.875rem;line-height:1rem;border:1px solid #e5e7eb;margin-right:.5rem;margin-bottom:.25rem}
.pill:last-child{margin-right:0}
.tag{display:inline-flex;align-items:center;padding:.125rem .5rem;border-radius:.5rem;background:#eff6ff;color:#1d4ed8;font-size:.6875rem;line-height:.875rem;border:1px solid #bfdbfe;margin-right:.25rem;margin-bottom:.25rem}
.muted{color:#6b7280}
`}</style>

      <div className="bg-white rounded-2xl shadow max-w-2xl w-full p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Edit moves - {mon.name} <span className="text-xs text-gray-500">({local.size}/4)</span></div>
          <div className="flex gap-2">
            <button type="button" className="px-3 py-1 rounded border text-sm" onClick={onClose}>Close</button>
            <button type="button" className="px-3 py-1 rounded border text-sm" onClick={()=>setLocal(new Set())}>Clear</button>
            <button type="button" className="px-3 py-1 rounded border text-sm" onClick={saveMoves}>Save</button>
          </div>
        </div>
        <input className="w-full border rounded-xl px-3 py-2 mb-2" placeholder="Search move..." value={filter} onChange={e=>setFilter(e.target.value)} />
        <div className="max-h-[60vh] overflow-auto">
          {matches.map(m=>(<label key={m.name} className={`flex items-center justify-between border rounded-xl p-2 mb-1 ${local.has(m.name)?"bg-emerald-50 border-emerald-300":""}`}>
            <div className="text-sm">• {m.name} <span className="text-[11px] text-gray-600">({m.type}{m.tmItem?` • ${m.tmItem}`:""} • {m.source})</span></div>
            <input type="checkbox" checked={local.has(m.name)} onChange={()=>toggle(m.name)} />
          </label>))}
          {!matches.length && <div className="text-sm text-gray-500">No moves found.</div>}
        </div>
      </div>
    </div>);
  }

  
  function Sprite({mon, size=40, className=""}){
    const [src, setSrc] = React.useState(null);
    useEffect(()=>{(async()=>{
      if(!mon?.slug) return;
      try{
        const p = await cache.get(`https://pokeapi.co/api/v2/pokemon/${mon.slug}`);
        const s = p?.sprites;
        const url = s?.front_default || s?.other?.['official-artwork']?.front_default || s?.other?.dream_world?.front_default || null;
        setSrc(url);
      }catch(e){ setSrc(null); }
    })()},[mon?.slug]);
    return src
      ? <img alt={mon?.name||"pokemon"} src={src} style={{width:size,height:size}} className={className} />
      : <div style={{width:size,height:size}} className={`bg-gray-100 rounded ${className}`} />;
  }

  
  function SpeciesModal({mon, onClose, onTeach}){
    const [abilities, setAbilities] = useState([]);
    const [moves, setMoves] = useState([]);
    const [evo, setEvo] = useState(null);
    const slug = (mon?.slug) || canon(mon?.name).replace(/_/g,'-');

    useEffect(()=>{(async()=>{
      if(!mon) return;
      try{
        const p = await cache.get(`https://pokeapi.co/api/v2/pokemon/${slug}`);
        setAbilities((p.abilities||[]).map(a=>cap(a.ability.name)));
      }catch(e){ setAbilities([]) }
      try{
        const ls = await getAllMovesForPokemon(mon) || [];
        setMoves(ls);
      }catch(e){ setMoves([]) }
      try{
        const es = await getEvolutionSummary(mon);
        setEvo(es||null);
      }catch(e){ setEvo(null) }
    })()},[mon?.id]);

    const level = (monLevels||{})[mon?.id] || null;
    const owned = (ownedMoves||{}) || {};
    const teachNow = moves.filter(m=>m.tmItem && owned[m.name]);
    const planTM   = moves.filter(m=>m.tmItem && !owned[m.name]);
    const levelUps = moves.filter(m=>/Level(?:-?up)?\s*\d+/i.test(m.source)).sort((a,b)=>{
      const la = parseInt((a.source.match(/(?:Level(?:-?up)?\s*(\d+))/i)||[])[1]||999);
      const lb = parseInt((b.source.match(/(?:Level(?:-?up)?\s*(\d+))/i)||[])[1]||999);
      return la-lb;
    });

    return !mon ? null : (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-4" onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sprite mon={mon} size={56} />
              <div>
                <div className="font-semibold text-lg">{mon.name}</div>
                <div className="text-xs text-gray-600">{mon.types.join(" / ")} • BST {mon.bst}</div>
                {abilities.length ? <div className="text-xs mt-1">Abilities: {abilities.join(", ")}</div> : <div className="text-xs text-gray-400">Abilities: -</div>}
              </div>
            </div>
            <button className="px-3 py-1 text-sm border rounded" onClick={onClose}>Close</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <div className="font-medium text-sm mb-1">Teach now (from your bag)</div>
              <div className="space-y-1 text-xs">{teachNow.length ? teachNow.slice(0,40).map(m=>(
                <div key={m.name} className="flex items-center justify-between">
                  <div><span>{m.name}</span> <span className="text-gray-500">{m.type}{m.tmItem?` • ${m.tmItem}`:""}</span></div>
                  {(monMoves[mon.id]||[]).includes(m.name)
                    ? <span className="pill">Already knows</span>
                    : <button className="px-2 py-1 rounded border text-xs" onClick={()=>onTeach && onTeach(mon, m.name)}>Teach now</button>
                  }
                </div>
              )):<div className="text-gray-400">-</div>}</div>
            </div>
            <div>
              <div className="font-medium text-sm mb-1">Plan (TM needed)</div>
              <div className="space-y-1 text-xs">{planTM.length ? planTM.slice(0,40).map(m=>(
                <div key={m.name} className="flex justify-between"><span>{m.name}</span><span className="text-gray-500">{m.type}{m.tmItem?` • ${m.tmItem}`:""}</span></div>
              )):<div className="text-gray-400">-</div>}</div>
            </div>
            <div>
              <div className="font-medium text-sm mb-1">Wait (level-up)</div>
              <div className="space-y-1 text-xs">{levelUps.length ? levelUps.slice(0,40).map(m=>(
                <div key={m.name} className="flex justify-between"><span>{m.name}</span><span className="text-gray-500">{m.source}</span></div>
              )):<div className="text-gray-400">-</div>}</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="font-medium text-sm mb-1">Evolution</div>
            {evo ? <div className="text-xs text-gray-700 whitespace-pre-line">{evo}</div> : <div className="text-xs text-gray-400">-</div>}
          </div>
        </div>
      </div>
    );
  }

  function MyPokemonTab(){
    const [editing,setEditing]=useState(null);
    const list=owned;
    return (<>
      <Section title="My Pokémon" subtitle="Owned Pokémon with level and moves.">
        <div className="mb-4">
          <div className="font-semibold mb-1">Current lineup ({lineup.length}/6)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lineup.map(mon=>(
              <div key={mon.id} className="flex items-center justify-between border rounded-xl p-2 bg-white">
                <div className="flex items-center gap-2"><Sprite mon={mon} size={32} /><div><div className="font-medium">{mon.name}</div><div className="text-xs text-gray-600">{mon.types.join(" / ")} • BST {mon.bst}</div></div></div>
                <button type="button" className="text-xs px-2 py-1 rounded border" onClick={()=>preserveScroll(()=>setLineupIds(prev=>prev.filter(x=>x!==mon.id)))}>Remove</button>
              </div>
            ))}
            {!lineup.length && <div className="text-sm text-gray-500">No Pokémon in lineup yet. Add from Owned or My Pokémon.</div>}
          </div>
        </div>
        {!list.length ? <div className="text-sm text-gray-500">Mark Owned in Setup tab first.</div> :
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {list.map(mon=>(
              <div key={mon.id} className="border rounded-2xl p-3 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Sprite mon={mon} size={32} /><div><div className="font-medium">{mon.name}</div><div className="text-xs text-gray-600">{mon.types.join(" / ")} • BST {mon.bst}</div></div></div>
                  <button type="button" className="text-xs px-2 py-1 rounded border" onClick={()=>setEditing(mon)}>Edit moves</button>
                  <button type="button" className="text-xs px-2 py-1 rounded border ml-2" onClick={()=>setDetailMon(mon)}>Profile</button>
                  <button type="button" className="text-xs px-2 py-1 rounded border ml-2" onClick={()=>preserveScroll(()=>{ setOwnedIds(prev=>prev.filter(x=>x!==mon.id)); setLineupIds(prev=>prev.filter(x=>x!==mon.id)); })}>Remove</button>
                  {inLineup(mon.id)
                    ? <button type="button" className="text-xs px-2 py-1 rounded border ml-2" onClick={()=>preserveScroll(()=>setLineupIds(prev=>prev.filter(x=>x!==mon.id)))}>Remove from lineup</button>
                    : <button type="button" className="text-xs px-2 py-1 rounded border ml-2" onClick={()=>preserveScroll(()=>setLineupIds(prev=> prev.includes(mon.id)? prev : [...prev, mon.id]))}>Add to lineup</button>
                  }
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[11px] text-gray-600">Level</div>
                  <input type="number" min="1" max="100" className="w-20 border rounded-xl px-2 py-1" value={monLevels[mon.id]||""} onChange={e=>preserveScroll(()=>setMonLevels(prev=>({...prev,[mon.id]:parseInt(e.target.value||0)})))} />
                </div>
                <div className="mt-2">
                  <div className="text-[11px] text-gray-600 mb-1">Current moves ({(monMoves[mon.id]||[]).length}/4)</div>
                  <div>{(monMoves[mon.id]||[]).length ? (monMoves[mon.id]||[]).map(n=><span key={n} className="pill">{n}</span>) : <span className="text-xs text-gray-500">No moves saved yet.</span>}</div>
                </div>
              </div>
            ))}
          </div>
        }
      </Section>
      {editing && <MoveEditor mon={editing} onClose={()=>setEditing(null)} />}
    </>);
  }

  function DexTab(){
    const [q,setQ]=useState(load("dex_q")||"");
    useEffect(()=>save("dex_q", q), [q]);
    const list = useMemo(()=>{
      const s = canon(q);
      return s ? dex.filter(m=>canon(m.name).includes(s)) : dex;
    }, [q, dex]);
    useEffect(()=>{(async()=>{ for(const m of list.slice(0,40)){ if(!evoSummaryCache[m.id]){ try{ await getEvolutionSummary(m); }catch{} } } })()},[list.length]);
    const lineupTypes=new Set(); lineup.forEach(m=>m.types.forEach(t=>lineupTypes.add(t)));
    const countersFor=(mon)=>{ const wk=getWeaknesses(mon.types); return Array.from(new Set(wk.filter(w=>lineupTypes.has(w.type)).map(w=>w.type))); };
    return (<>
      <Section key="pokedex" title="Pokédex" subtitle="Weaknesses and counters (based on your lineup), plus evolution terms.">
        <div className="mb-3 flex gap-3">
          <input className="w-full md:w-1/2 border rounded-xl px-3 py-2" placeholder="Search Pokémon..." autoFocus   value={q}   onChange={e=>setQ(e.target.value)} onMouseDown={e=>e.stopPropagation()} />
          <div className="text-sm text-gray-600">{loadingDex?"Loading...":`${list.length} shown / ${dex.length} total`}</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map(mon=>(
            <div key={mon.id} className="border rounded-2xl p-3 bg-white">
              <div className="flex items-center justify-between">
                <div><div className="font-semibold text-lg">{mon.name}</div><div className="text-xs text-gray-600">{mon.types.join(" / ")}</div></div>
                <div className="text-xs text-gray-500">BST {mon.bst}</div>
                <button type="button" className="text-xs px-2 py-1 rounded border ml-2" onClick={()=>setDetailMon(mon)}>Profile</button>
              </div>
              <div className="mt-2">
                <div className="text-sm font-medium mb-1">Evolution:</div>
                <div className="text-xs text-gray-700">{(evoSummaryCache[mon.id]||"") || "-"}</div>
              </div>
              <div className="mt-2">
                <div className="text-sm font-medium mb-1">Weak to:</div>
                <div>{getWeaknesses(mon.types).map(w=><span key={w.type} className="pill">{w.type} ×{w.multiplier}</span>)}</div>
              </div>
              <div className="mt-2">
                <div className="text-sm font-medium mb-1">Counters (your lineup):</div>
                <div>{countersFor(mon).length? countersFor(mon).map(t=><span key={t} className="pill">{t}</span>) : <span className="text-xs text-gray-500">No direct counters in lineup</span>}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>);
  }

  
  // --- M4: Move-Swap Planner helpers ---
  function moveAccuracyOf(m){ return (m && typeof m.accuracy==='number') ? m.accuracy : 100; }
  // Extend learnset loader to include accuracy & damage class if not already present
  const _orig_getAllMovesForPokemon = getAllMovesForPokemon;
  getAllMovesForPokemon = async function(mon){
    const ls = await _orig_getAllMovesForPokemon(mon);
    // If accuracy not present, refetch minimal details for moves (cached)
    const needs = (ls||[]).filter(m=>typeof m.accuracy==='undefined');
    if(needs.length){
      for(const m of needs){
        try{
          const url = (moveIndex?.[m.name]) || null;
          if(url){
            const mv = await cache.get(url);
            m.accuracy = (typeof mv.accuracy==='number') ? mv.accuracy : null;
            m.damageClass = mv.damage_class?.name || null;
          }
        }catch(e){ /* ignore */ }
      }
    }
    return ls;
  }

  function eligibleMoves(mon, learnset){
    const cur = monMoves[mon.id] || [];
    const elig = [];
    for(const m of (learnset||[])){
      const inBag = !!ownedMoves[m.name];
      const isTM = !!m.tmItem;
      if(inBag && isTM) elig.push(m);
    }
    // Include current moves (to allow "keep")
    for(const n of cur){
      if(!(elig.some(x=>x.name===n))){
        const f = (learnset||[]).find(x=>x.name===n);
        if(f) elig.push(f);
        else elig.push({name:n, type:(mon.types[0]||'Normal'), power:0, accuracy:100, damageClass:null, tmItem:null, source:'Current'});
      }
    }
    return elig;
  }

  function sortByPowerAccName(a,b){
    const pa = a.power||0, pb = b.power||0;
    if(pb!==pa) return pb - pa;
    const aa = moveAccuracyOf(a), ab = moveAccuracyOf(b);
    if(ab!==aa) return ab - aa;
    return (a.name||'').localeCompare(b.name||'');
  }

  function typeBeats(type){
    const row=CHART[type]||{}; return Object.keys(row).filter(t=> (row[t]||1) > 1 );
  }

  
      // Tag high accuracy and utility/status; mark redundant if duplicate type on same mon
      function annotateTagsForMove(m, currentTags, mon, proposedSoFar){
        let tags = currentTags ? currentTags.slice() : [];
        if(moveAccuracyOf(m) >= 95) tags.push('[Accuracy]');
        if((m.damageClass && m.damageClass==='status') || (!m.power || m.power===0)) tags.push('[Utility]');
        // Redundant if we already have another move with same type (beyond first occurrence)
        const countSame = proposedSoFar.filter(x=>x.type===m.type).length;
        if(countSame >= 1 && ! (mon.types||[]).includes(m.type)) tags.push('[Redundant]');
        return tags;
      }
function proposeMoveSetsForLineup(lineupMons, learnsets){
    // Greedy: pick up to 2 STAB per mon, then coverage to maximize distinct move types across the team
    const teamChosenTypes = new Set();
    const out = {};
    for(const mon of lineupMons){
      const ls = learnsets[mon.id] || [];
      const elig = eligibleMoves(mon, ls);
      const cur = monMoves[mon.id] || [];
      const proposed=[];
      const tagsMap = {}; // name -> tag chips

      // Prefer STAB (up to 2)
      const stabTypes = new Set(mon.types||[]);
      const stabMoves = elig.filter(m=>stabTypes.has(m.type)).sort((a,b)=>{
        // prefer already-known
        const ak = cur.includes(a.name) ? 1:0, bk = cur.includes(b.name) ? 1:0;
        if(ak!==bk) return bk-ak;
        return sortByPowerAccName(a,b);
      });
      for(const m of stabMoves){
        if(proposed.length>=4) break;
        if(proposed.filter(x=>x.type===m.type).length>=2) continue;
        if(!proposed.some(x=>x.name===m.name)){
          proposed.push(m); tagsMap[m.name] = annotateTagsForMove(m, tagsMap[m.name]||[], mon, proposed);
          tagsMap[m.name] = annotateTagsForMove(m, (tagsMap[m.name]||[]).concat('[STAB]'), mon, proposed);
        }
        if(proposed.filter(x=>stabTypes.has(x.type)).length>=2) break;
      }

      // Coverage: choose moves whose type adds new types to teamChosenTypes
      const coverMoves = elig.filter(m=>!stabTypes.has(m.type));
      // Benefit: number of new move types we add to team set if we pick this move
      function benefitOf(m){
        return teamChosenTypes.has(m.type) ? 0 : 1;
      }
      coverMoves.sort((a,b)=>{
        const ba = benefitOf(a), bb = benefitOf(b);
        if(bb!==ba) return bb - ba;
        // small bonus for types that beat many defender types
        const da = typeBeats(a.type).length, db = typeBeats(b.type).length;
        if(db!==da) return db-da;
        // prefer already-known
        const ak = cur.includes(a.name) ? 1:0, bk = cur.includes(b.name) ? 1:0;
        if(ak!==bk) return bk-ak;
        return sortByPowerAccName(a,b);
      });
      for(const m of coverMoves){
        if(proposed.length>=4) break;
        if(!proposed.some(x=>x.name===m.name)){
          proposed.push(m);
          // add a Coverage tag against the top defended type this move hits
          const vs = typeBeats(m.type);
          const vsTag = vs.length? vs[0] : null;
          if(vsTag) tagsMap[m.name] = annotateTagsForMove(m, (tagsMap[m.name]||[]).concat(`[Coverage vs ${vsTag}]`), mon, proposed);
        }
      }

      // If still less than 4, top up with best remaining (non-duplicate names)
      if(proposed.length<4){
        const rest = elig.filter(m=>!proposed.some(x=>x.name===m.name)).sort(sortByPowerAccName);
        for(const m of rest){
          if(proposed.length>=4) break;
          proposed.push(m);
        }
      }

      // Update teamChosenTypes after we've chosen for this mon
      proposed.forEach(m=>teamChosenTypes.add(m.type));

      // Compute changes list relative to current
      const propNames = proposed.slice(0,4).map(m=>m.name);
      const curNames = cur.slice(0,4);
      const adds = propNames.filter(n=>!curNames.includes(n));
      const drops = curNames.filter(n=>!propNames.includes(n));
      const changes=[];
      for(let i=0;i<Math.max(adds.length,drops.length);i++){
        const to = adds[i]; const fr = drops[i];
        if(fr && to) changes.push({action:'replace', from: fr, to, tags: (tagsMap[to]||[])});
        else if(to) changes.push({action:'add', to, tags:(tagsMap[to]||[])});
      }

      out[mon.id] = { proposed: propNames, changes };
    }
    return out;
  }

  async function computeMoveSwapPlan(){
    const mons = lineup.slice();
    const learnsets = {};
    for(const mon of mons){
      try{ learnsets[mon.id] = await getAllMovesForPokemon(mon); }catch(e){ learnsets[mon.id]=[]; }
    }
    return proposeMoveSetsForLineup(mons, learnsets);
  }
function SuggestionsTab(){
    const [busy,setBusy]=useState(false);
    const [moveSwap,setMoveSwap]=useState({});
    const [encGroup,setEncGroup]=useState(load("encGroup","Gyms"));
    const [encIdx,setEncIdx]=useState(load("encIdx",0));
    useEffect(()=>{save("encGroup",encGroup);save("encIdx",encIdx)},[encGroup,encIdx]);
    const groupList=Array.from(new Set(ENCOUNTERS.map(e=>e.group)));
    const groupEnc=ENCOUNTERS.filter(e=>e.group===encGroup);
    const activeEnc=groupEnc[Math.max(0,Math.min(encIdx,groupEnc.length-1))]||groupEnc[0];
    const [encResult,setEncResult]=useState({team:[],why:[],moves:{}});
    const [owResult,setOwResult]=useState({team:[],why:[],moves:{}});
    const [owMode,setOwMode]=useState("By Area");
    const regList=Object.keys(AREA_LEVELS); const [owRegion,setOwRegion]=useState(load("owRegion",regList[0])); const [owSub,setOwSub]=useState(load("owSub",Object.keys(AREA_LEVELS[regList[0]]||{})[0])); const [lvlMin,setLvlMin]=useState(load("lvlMin",15)); const [lvlMax,setLvlMax]=useState(load("lvlMax",25));
    useEffect(()=>{save("owRegion",owRegion);save("owSub",owSub);save("lvlMin",lvlMin);save("lvlMax",lvlMax)},[owRegion,owSub,lvlMin,lvlMax]);

    
    const inFlight = React.useRef<Promise<void> | null>(null);

    async function runSuggest(roster: any[], setter: (x: any) => void) {
      if (busy || inFlight.current) return; // guard double-clicks / re-entries
      setBusy(true);
      const job = (async () => {
        try {
          if (!owned.length) {
            setter({ team: [], why: [], moves: {} });
            return;
          }
          const { team, why } = await suggestTeam(owned, roster);
          const movesets: Record<string, any[]> = {};
          for (const mon of team) {
            try {
              const learnset = await getAllMovesForPokemon(mon);
              movesets[mon.id] = pickMovesFor(mon, learnset, roster);
            } catch (e) {
              console.warn('moveset failed for', mon?.name, e);
              movesets[mon.id] = [];
            }
          }
          setter({ team, why, moves: movesets });
        } catch (e) {
          console.error('Suggest failed', e);
          setter({ team: [], why: [], moves: {}, error: String(e) });
        } finally {
          setBusy(false);
          inFlight.current = null;
        }
      })();
      inFlight.current = job;
      await job;
    }
return (<>
      <Section title="Style" subtitle="Coverage only counts for viable Pokémon (above threshold).">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium">Preset</label>
          <select className="border rounded-xl px-3 py-2" value={playstyle} onChange={e=>setPlaystyle(e.target.value)}><option>Optimal</option><option>Tanky</option><option>Early</option><option>Fun</option></select>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Viability threshold</span>
            <input type="range" min="0" max="1" step="0.05" value={Vmin} onChange={e=>setVmin(parseFloat(e.target.value))} />
            <span className="text-xs">{Vmin.toFixed(2)}</span>
          </div>
        </div>
      </Section>

      <Section title="Encounters (best team + moves)">
        <div className="flex flex-col md:flex-row gap-3 mb-3">
          <select className="w-full md:w-56 border rounded-xl px-3 py-2" value={encGroup} onChange={e=>{setEncGroup(e.target.value); setEncIdx(0);}}>
            {groupList.map(g=><option key={g}>{g}</option>)}
          </select>
          <select className="w-full md:flex-1 border rounded-xl px-3 py-2" value={encIdx} onChange={e=>setEncIdx(parseInt(e.target.value))}>
            {groupEnc.map((e,i)=><option key={e.name} value={i}>{e.name}</option>)}
          </select>
          <button type="button" className="px-3 py-2 rounded-xl border" disabled={busy} onClick={() => { if (!busy) runSuggest(activeEnc.roster,setEncResult); }} disabled={busy}>{busy?"Computing...":"Suggest team + moves"}</button>
          {encResult.team.length ? <button type="button" className="px-3 py-2 rounded-xl border" onClick={()=>setLineupIds(encResult.team.map(m=>m.id))}>Apply to lineup</button> : null}
        </div>
        {!encResult.team.length ? <div className="text-sm text-gray-500">No result yet.</div> :
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {encResult.team.map((m,i)=>(
              <div key={m.id} className="border rounded-2xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <div><div className="font-medium">{m.name}</div><div className="text-[11px] text-gray-600">Types: {m.types.join(" / ")} • BST {m.bst}</div></div>
                  <button type="button" className="text-xs px-2 py-1 rounded border" onClick={()=>preserveScroll(()=>setLineupIds(prev=>prev.includes(m.id)?prev.filter(x=>x!==m.id):(prev.length<6?[...prev,m.id]:prev)))}>{inLineup(m.id)?"Remove":"Add to 6"}</button>
                </div>
                <div className="mt-1">{(encResult.why[i]||[]).map((t,ix)=><Tag key={ix}>{t}</Tag>)}</div>
                <div className="mt-2"><div className="text-[11px] text-gray-600 mb-1">Suggested moves (from your owned):</div>{(encResult.moves[m.id]||[]).map(mm=>(<div key={mm.name} className="text-sm">• {mm.name} <span className="text-[11px] text-gray-600">({mm.type}{mm.tmItem?` • ${mm.tmItem}`:""} • {mm.source})</span></div>))}</div>
                <div className="mt-2"><div className="text-[11px] text-gray-600 mb-1">Current moves:</div><div>{(monMoves[m.id]||[]).length ? (monMoves[m.id]||[]).map(n=><span key={n} className="pill">{n}</span>) : <span className="text-xs text-gray-500">No moves saved for this mon.</span>}</div></div>
              </div>
            ))}
          </div>
        }
      </Section>

      <Section title="Open World (best team + moves)">
        <div className="flex flex-col md:flex-row gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Mode</span>
            <select className="border rounded-xl px-3 py-2" value={owMode} onChange={e=>setOwMode(e.target.value)}><option>By Area</option><option>By Level</option></select>
          </div>
          {owMode==="By Area" ? (
            <div className="flex gap-2 flex-1">
              <select className="border rounded-xl px-3 py-2" value={owRegion} onChange={e=>{setOwRegion(e.target.value); setOwSub(Object.keys(AREA_LEVELS[e.target.value]||{})[0]||"");}}>{Object.keys(AREA_LEVELS).map(r=><option key={r}>{r}</option>)}</select>
              <select className="border rounded-xl px-3 py-2 flex-1" value={owSub} onChange={e=>setOwSub(e.target.value)}>{(Object.keys(AREA_LEVELS[owRegion]||{})).map(s=><option key={s}>{s}</option>)}</select>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="text-sm">Enemy level</div>
              <input type="number" className="w-20 border rounded-xl px-2 py-1" value={lvlMin} onChange={e=>setLvlMin(parseInt(e.target.value||0))} />
              <span>to</span>
              <input type="number" className="w-20 border rounded-xl px-2 py-1" value={lvlMax} onChange={e=>setLvlMax(parseInt(e.target.value||0))} />
            </div>
          )}
          <button type="button" className="px-3 py-2 rounded-xl border" disabled={busy} onClick={() => { if ( !busy ){ const roster= owMode==="By Area" ? syntheticTargetByLevel(...(AREA_LEVELS[owRegion][owSub]||[15,25])) : syntheticTargetByLevel(lvlMin,lvlMax); runSuggest(roster,setOwResult); } }} disabled={busy}>{busy?"Computing...":"Suggest team + moves"}</button>
          {owResult.team.length ? <button type="button" className="px-3 py-2 rounded-xl border" onClick={()=>setLineupIds(owResult.team.map(m=>m.id))}>Apply to lineup</button> : null}
        </div>
        {!owResult.team.length ? <div className="text-sm text-gray-500">No result yet.</div> :
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {owResult.team.map((m,i)=>(
              <div key={m.id} className="border rounded-2xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <div><div className="font-medium">{m.name}</div><div className="text-[11px] text-gray-600">Types: {m.types.join(" / ")} • BST {m.bst}</div></div>
                  <button type="button" className="text-xs px-2 py-1 rounded border" onClick={()=>preserveScroll(()=>setLineupIds(prev=>prev.includes(m.id)?prev.filter(x=>x!==m.id):(prev.length<6?[...prev,m.id]:prev)))}>{inLineup(m.id)?"Remove":"Add to 6"}</button>
                </div>
                <div className="mt-1">{(owResult.why[i]||[]).map((t,ix)=><Tag key={ix}>{t}</Tag>)}</div>
                <div className="mt-2"><div className="text-[11px] text-gray-600 mb-1">Suggested moves (from your owned):</div>{(owResult.moves[m.id]||[]).map(mm=>(<div key={mm.name} className="text-sm">• {mm.name} <span className="text-[11px] text-gray-600">({mm.type}{mm.tmItem?` • ${mm.tmItem}`:""} • {mm.source})</span></div>))}</div>
                <div className="mt-2"><div className="text-[11px] text-gray-600 mb-1">Current moves:</div><div>{(monMoves[m.id]||[]).length ? (monMoves[m.id]||[]).map(n=><span key={n} className="pill">{n}</span>) : <span className="text-xs text-gray-500">No moves saved for this mon.</span>}</div></div>
              </div>
            ))}
          </div>
        }
      </Section>

      <Section title="Move-Swap Planner (M4)" subtitle="Propose 4-move sets from your bag (TM + current moves). Prefers up to 2 STAB, then fills coverage to maximize distinct types across the lineup.">
        <div className="mb-3 flex items-center gap-2">
          <button type="button" className="px-3 py-2 rounded-xl border" onClick={async ()=>{
            setBusy(true);
            try{
              const plan = await computeMoveSwapPlan().catch(()=>null);
              if(!plan || !Object.keys(plan).length){ setSnack && setSnack('No proposals'); } else { setMoveSwap(plan); }
            } finally { setBusy(false); }
          }}>{busy?'Computing…':'Compute proposals'}</button>
          { moveSwap && Object.keys(moveSwap).length ?
            <button type="button" className="px-3 py-2 rounded-xl border" onClick={async ()=>{
              try{
                const plan = moveSwap || {};
                const nextMonMoves = {...monMoves};
                const taughtByMon = {};
                for(const mon of lineup){
                  const cur = monMoves[mon.id] || [];
                  const prop = (plan[mon.id]?.proposed || cur).slice(0,4);
                  taughtByMon[mon.id] = prop.filter(n=>!cur.includes(n));
                  nextMonMoves[mon.id] = prop;
                }
                if(tmPolicy==='consume'){
                  const counts = {...ownedMoves};
                  for(const mon of lineup){
                    for(const n of (taughtByMon[mon.id]||[])){
                      const v = counts[n];
                      if(typeof v==='number'){
                        if(v-1 < 0){ alert('Not enough '+n+' in inventory. Aborting.'); return; }
                        counts[n] = v-1; if(counts[n]===0) delete counts[n];
                      }
                    }
                  }
                  setOwnedMoves(counts);
                }
                setMonMoves(nextMonMoves);
                setSnack && setSnack('Applied proposed move sets to lineup');
              }catch(e){ console.error(e); alert('Apply all failed'); }
            }}>Apply all to lineup</button> : null }
        </div>
        {(!lineup || !lineup.length) ? <div className="text-sm text-gray-500">Add Pokémon to your lineup first.</div> :
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lineup.map(mon=>{
              const cur = monMoves[mon.id] || [];
              const row = moveSwap?.[mon.id] || {proposed: cur, changes: []};
              return (
                <div key={mon.id} className="border rounded-2xl p-3 bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <div><div className="font-medium">{mon.name}</div><div className="text-[11px] text-gray-600">{mon.types.join(' / ')} • BST {mon.bst}</div></div>
                    <button type="button" className="text-xs px-2 py-1 rounded border" onClick={async ()=>{
                      setBusy(true);
                      try{
                        const plan = await computeMoveSwapPlan().catch(()=>null);
                        if(!plan || !Object.keys(plan).length){ setSnack && setSnack('No proposals'); } else { setMoveSwap(plan); }
                      } finally { setBusy(false); }
                    }}>{busy?'…':'Recompute'}</button>
                  </div>
                  <div className="mt-2">
                    <div className="text-[11px] text-gray-600 mb-1">Current moves</div>
                    <div>{cur.length ? cur.map(n=><span key={n} className="pill">{n}</span>) : <span className="text-xs text-gray-500">No moves saved.</span>}</div>
                  </div>
                  <div className="mt-2">
                    <div className="text-[11px] text-gray-600 mb-1">Proposed set</div>
                    <div>{(row.proposed||[]).map(n=><span key={n} className="pill">{n}</span>)}</div>
                  </div>
                  <div className="mt-2">
                    <div className="text-[11px] text-gray-600 mb-1">Changes</div>
                    <div className="text-sm">
                      {(!row.changes || !row.changes.length) ? <span className="text-xs text-gray-500">No changes</span> :
                        row.changes.map((c,ix)=> (
                          <div key={ix} className="mb-1">
                            {c.action==='replace' ? <>Replace <b>{c.from}</b> → <b>{c.to}</b></> : <>Add <b>{c.to}</b></>}
                            {' '}
                            {(c.tags||[]).map((t,i)=><span key={i} className="pill">{t}</span>)}
                          </div>
                        ))
                      }
                    </div>
                  </div>
                  <div className="mt-2">
                    <button type="button" className="px-3 py-2 rounded-xl border" onClick={()=>{
                      const plan = moveSwap?.[mon.id];
                      if(!plan || !plan.proposed) return;
                      const current = monMoves[mon.id] || [];
                      const proposed = plan.proposed.slice(0,4);
                      const taught = proposed.filter(n=>!current.includes(n));
                      if(tmPolicy==='consume'){
                        const counts = {...ownedMoves};
                        for(const n of taught){
                          const v = counts[n];
                          if(typeof v==='number'){
                            if(v-1 < 0){ alert('Not enough '+n+' in inventory. Aborting.'); return; }
                            counts[n] = v-1;
                            if(counts[n]===0) delete counts[n];
                          }
                        }
                        setOwnedMoves(counts);
                      }
                      setMonMoves(prev=>({...prev, [mon.id]: proposed}));
                      setSnack && setSnack('Move set updated');
                    }}>Apply</button>
                  </div>
                </div>
              );
            })}
          </div>
        }
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-700">All owned (collapsed)</summary>
          {!owned.length ? <div className="text-sm text-gray-500 mt-2">No owned Pokémon</div> :
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {owned.map(mon=>{
                const cur = monMoves[mon.id] || [];
                const row = moveSwap?.[mon.id] || {proposed: cur, changes: []};
                return (
                  <div key={mon.id} className="border rounded-2xl p-3 bg-white">
                    <div className="font-medium">{mon.name}</div>
                    <div className="mt-1 text-[11px] text-gray-600">Current: {cur.join(', ')||'—'}</div>
                    <div className="mt-1 text-[11px] text-gray-600">Proposed: {(row.proposed||[]).join(', ')||'—'}</div>
                  </div>
                );
              })}
            </div>
          }
        </details>
      </Section>
    </>);
  }

  return (<div className="max-w-6xl mx-auto p-5">
    <header className="mb-6 flex items-end justify-between">
      <div><h1 className="text-2xl md:text-3xl font-bold">Paldea Team Planner - v10.4b</h1><p className="text-sm text-gray-600">Setup: Owned + Moves | Suggestions: team + moves | Dex | My Pokémon</p></div>
      <div className="flex items-center gap-3">
        <button type="button" className="px-3 py-2 rounded-xl border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 text-sm" onClick={clearMySelections}>Clear my selections</button>
        <div className="flex items-center gap-2 mr-3">
              <button type="button" className="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50" onClick={()=>{setTab("Setup"); setShowImport("pokemon");}}>Import Pokémon</button>
              <button type="button" className="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50" onClick={()=>{setTab("Setup"); setShowImport("tm");}}>Import TM list</button>
            </div>
            <nav className="flex rounded-2xl bg-white shadow px-1 overflow-x-auto whitespace-nowrap">
          {["Setup","Inventory","Suggestions","Dex","My Pokémon"].map(label=>(<button key={label} type="button" className={`whitespace-nowrap px-4 py-2 text-sm ${tab===label? "bg-slate-900 text-white" : "bg-white text-gray-700 hover:bg-slate-50"} rounded-xl border ${tab===label?"border-slate-900":"border-slate-200"}`} onClick={()=>setTab(label)}>{label}</button>))}
        </nav>
      </div>
    </header>
    {tab==="Setup" ? <SetupTab showImport={showImport} setShowImport={setShowImport}/> : tab==="Inventory" ? <InventoryTab moveIndex={moveIndex} loadingIdx={loadingIdx} ownedMoves={ownedMoves} setOwnedMoves={setOwnedMoves} owned={owned} monMoves={monMoves} getAllMovesForPokemon={getAllMovesForPokemon} tmStatus={tmStatus} setTmStatus={setTmStatus} ensureTMSet={ensureTMSet} teachMove={teachMove} tmPolicy={tmPolicy} setTmPolicy={setTmPolicy}/> : tab==="Suggestions" ? <SuggestionsTab/> : tab==="Dex" ? <DexTab/> : <MyPokemonTab/>}
    
    {detailMon && <SpeciesModal mon={detailMon} onClose={()=>setDetailMon(null)} onTeach={teachMove} />}
    <footer className="mt-8 text-xs text-gray-500">First load fetches data from PokéAPI (cached locally). Your Owned Pokémon, moves, levels and lineup are saved in your browser.
    
    {/* M3 Replace dialog */}
    {replaceCtx && (
      <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={()=>setReplaceCtx(null)}>
        <div className="bg-white rounded-2xl shadow max-w-xl w-full p-4" onClick={e=>e.stopPropagation()}>
          <div className="font-semibold mb-2">Replace a move on {replaceCtx.mon.name}</div>
          <div className="text-sm text-gray-600 mb-2">Choose a slot to replace with <span className="text-gray-900">{replaceCtx.moveName}</span>:</div>
          <div className="space-y-2">
            {(monMoves[replaceCtx.mon.id]||[]).map((n,i)=>(
              <div key={n+i} className="flex items-center justify-between border rounded-xl p-2 bg-white">
                <div className="text-sm">{n}</div>
                <button className="px-3 py-1 rounded border" data-replace-slot={i} onClick={()=>applyReplace(i)}>Replace</button>
              </div>
            ))}
          </div>
          <div className="mt-3 text-right"><button className="px-3 py-1 rounded border" onClick={()=>setReplaceCtx(null)}>Cancel</button></div>
        </div>
      </div>
    )}

    {/* M3 Undo snackbar */}
    {snack && (
      <div className="fixed left-1/2 -translate-x-1/2 bottom-4 bg-white border rounded-xl shadow px-3 py-2 z-[60] flex items-center gap-2">
        <span className="text-sm">{snack}</span>
        <button id="undo-btn" className="px-3 py-1 rounded border" onClick={doUndo}>Undo</button>
      </div>
    )}
</footer>
  </div>);
}


// M2: Inventory Tab (Owned Moves + Teachability-by-TM)
function InventoryTab(props){
  const { moveIndex, loadingIdx, ownedMoves, setOwnedMoves, owned, monMoves, getAllMovesForPokemon, tmStatus, setTmStatus, ensureTMSet, teachMove, tmPolicy, setTmPolicy } = props;

  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("Any");
  const [catFilter, setCatFilter] = React.useState("Any");
  const [showTeachOnly, setShowTeachOnly] = React.useState(false);
  const [selectedMove, setSelectedMove] = React.useState(null);
  const [showNotCompatible, setShowNotCompatible] = React.useState(false);

  // Owned Moves local state (search + bulk)
  const [mvQuery, setMvQuery] = React.useState("");
  const mvMatches = React.useMemo(()=>{
    const f = mvQuery.trim().toLowerCase();
    if(!f) return [];
    return Object.keys(moveIndex).filter(n=>n.toLowerCase().includes(f)).sort().slice(0,50);
  }, [mvQuery, moveIndex]);
  const [bulkMoves, setBulkMoves] = React.useState("");
  const addMove = (name) => setOwnedMoves(prev=>({...prev, [name]: true}));
  const removeMove = (name) => setOwnedMoves(prev=>{ const cp={...prev}; delete cp[name]; return cp; });


  // Auto-load TM catalog on first visit
  React.useEffect(()=>{
    (async()=>{
      try {
        if(!tmStatus.ready && !tmStatus.loading){
          setTmStatus(s=>({...s, loading:true}));
          const set = await ensureTMSet(setTmStatus);
          setTmStatus({ready:true, size: Array.isArray(set)? set.length : (set && set.size) || 0, loading:false});
        }
      } catch(e) {
        console.warn(e);
        setTmStatus({ready:false, size:0, loading:false});
      }
    })();
  },[]);

  // Move meta cache (type + category)
  const [moveMeta, setMoveMeta] = React.useState({});
  React.useEffect(()=>{
    (async()=>{
      const names = Object.keys(ownedMoves||{});
      for(const n of names){
        if(moveMeta[n]) continue;
        const url = moveIndex[n];
        if(!url) continue;
        try{
          const mv = await cache.get(url);
          setMoveMeta(prev=>({...prev, [n]: { type: cap(mv.type?.name||""), cat: cap(mv.damage_class?.name||"") } }));
        }catch(_){}
      }
    })();
  }, [ownedMoves, moveIndex]);

  // canLearnByTM cache per mon.id -> Set(lower move names)
  const [canByMon, setCanByMon] = React.useState({});
  React.useEffect(()=>{
    (async()=>{
      for(const mon of owned){
        if(canByMon[mon.id]) continue;
        try {
          const list = await getAllMovesForPokemon(mon);
          const set = new Set(list.filter(m=>m.tmItem).map(m=>m.name.toLowerCase()));
          setCanByMon(prev=>({...prev, [mon.id]: set}));
        } catch(_){
          setCanByMon(prev=>({...prev, [mon.id]: new Set()}));
        }
      }
    })();
  }, [owned]);

  const names = React.useMemo(()=>Object.keys(ownedMoves||{}).sort(), [ownedMoves]);

  const getOwnedCount = React.useCallback((n)=>{
    const v = (ownedMoves||{})[n];
    return typeof v === "number" ? v : (v ? 1 : 0);
  }, [ownedMoves]);
  function rowCounts(n){
  const low = (n||"").toLowerCase();
  let teach = 0, knows = 0;
  for (const mon of owned) {
    const knowsNow = (monMoves[mon.id]||[]).some(x => (x||"").toLowerCase() === low);
    const can      = (canByMon[mon.id] && canByMon[mon.id].has(low)) || false;
    if (knowsNow) knows++;
    if (can && !knowsNow) teach++;
  }
  return { teach, knows, total: owned.length };
}
    
  


  const filtered = names.filter(n=>{
    const meta = moveMeta[n]||{};
    const passName = !search || n.toLowerCase().includes(search.toLowerCase());
    const passType = typeFilter==="Any" || meta.type===typeFilter;
    const passCat = catFilter==="Any" || meta.cat===catFilter;
    if(!(passName && passType && passCat)) return false;
    if(showTeachOnly){
      const c=rowCounts(n);
      return c.teach>0;
    }
    return true;
  });

  const typeOptions = React.useMemo(()=>{
    const s = new Set();
    for(const n of names){ const m=moveMeta[n]; if(m&&m.type) s.add(m.type); }
    return ["Any", ...Array.from(s).sort()];
  }, [moveMeta, names]);
  const catOptions = ["Any","Physical","Special","Status"];

  // Thumbnail sprite (independent of global Sprite)
const Thumb = ({mon,size=40})=>{
  const [src,setSrc]=React.useState(null);
  React.useEffect(()=>{(async()=>{
    if(!mon?.slug) return;
    try{
      const p = await cache.get(`https://pokeapi.co/api/v2/pokemon/${mon.slug}`);
      const s = p?.sprites;
      const url = s?.front_default || s?.other?.['official-artwork']?.front_default || s?.other?.dream_world?.front_default || null;
      setSrc(url);
    }catch(_){ setSrc(null); }
  })()},[mon?.slug]);
  return src ? <img src={src} alt={mon?.name||'mon'} width={size} height={size} className="rounded bg-slate-100" /> 
             : <div className="rounded bg-slate-200" style={{width:size,height:size}}/>;
};
return (<div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="text-sm text-gray-600">
          TM catalog: { tmStatus.loading ? `Loading… scanned ${tmStatus.scanned||0}${tmStatus.pages?` on ${tmStatus.pages} pages`:''} — found ${tmStatus.size||0}` : (tmStatus.ready ? `Loaded ✓ (${tmStatus.size})` : "Not loaded") }
        </div>
        <div className="flex gap-3 items-center">
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" className="scale-110" checked={showTeachOnly} onChange={e=>setShowTeachOnly(e.target.checked)}/>
            Show only Teach now
          </label>
        </div>
      </header>

      {/* Owned Moves — moved from Setup */}
      <Section title="Owned Moves" subtitle="Search from ALL moves and add to your inventory.">
        <div className="flex flex-col md:flex-row gap-3 mb-3">
          <input className="w-full md:w-1/2 border rounded-xl px-3 py-2" placeholder="Search move (e.g., Bite, Flamethrower)" value={mvQuery} onChange={e=>setMvQuery(e.target.value)} />
          <div className="text-sm text-gray-600">{loadingIdx?"Loading move index...":`${Object.keys(moveIndex).length} moves indexed`}</div>
        </div>
        {mvQuery && <div className="bg-white border rounded-2xl p-3 mb-4 max-h-64 overflow-auto">
          {mvMatches.map(n=>(
            <div key={n} className="flex items-center justify-between border rounded-xl p-2 mb-1">
              <div className="text-sm">{n}</div>
              {ownedMoves[n] ? <button type="button" className="text-xs px-2 py-1 rounded border" onClick={()=>removeMove(n)}>Remove</button> : <button type="button" className="text-xs px-2 py-1 rounded border" onClick={()=>addMove(n)}>Add</button>}
            </div>
          ))}
          {!mvMatches.length && <div className="text-sm text-gray-500">No matches.</div>}
        </div>}
        <div className="font-semibold mb-1">Your move inventory ({Object.keys(ownedMoves).length})</div>
        <div className="bg-white border rounded-2xl p-3 mb-2 max-h-56 overflow-auto">
          {Object.keys(ownedMoves).sort().map(n=><span key={n} className="pill">{n}</span>)}
          {!Object.keys(ownedMoves).length && <div className="text-sm text-gray-500">No moves added yet.</div>}
        
        {/\bdev=1\b/.test(location.search) ? (
          <div className="mt-2 mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-600">Dev tools:</span>
            <button type="button" className="px-2 py-1 rounded border" onClick={async ()=>{
              const set = await ensureTMSet(setTmStatus);
              const arr = Array.isArray(set) ? set : Array.from(set||[]);
              const names = arr.map(s=>cap(String(s).replace(/-/g,' ')));
              setOwnedMoves(prev=>{
                const cp={...prev};
                names.forEach(n=>{ cp[n] = (typeof cp[n]==='number' ? cp[n] : 1); });
                return cp;
              });
              alert('Added all TMs to Owned Moves (idempotent).');
            }}>Add all TMs</button>
            <button type="button" className="px-2 py-1 rounded border border-rose-300 text-rose-700" onClick={()=>{
              if(!confirm('Clear ALL Owned Moves?')) return;
              setOwnedMoves({});
            }}>Clear TMs</button>
          
        
</div>
        ) : null }
        </div>
        <div className="mt-2">
          <div className="font-semibold mb-1">Bulk add moves (one per line)</div>
          <textarea className="w-full border rounded-xl p-2 h-28" placeholder="Bite\nFlamethrower\nThunder Punch" value={bulkMoves} onChange={e=>setBulkMoves(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <button type="button" className="px-3 py-2 rounded-xl border" onClick={()=>{ const names=bulkMoves.replace(/,/g,'\n').split('\n').map(s=>cap(s.trim().toLowerCase())).filter(Boolean); preserveScroll(()=>setOwnedMoves(prev=>{const cp={...prev}; names.forEach(n=>{ if(moveIndex[n]) cp[n]=true; }); return cp;})); }}>Add moves</button>
            <button type="button" className="px-3 py-2 rounded-xl border" onClick={()=>setBulkMoves("")}>Clear</button>
          </div>
        </div>

        <div className="mt-3 bg-white border rounded-2xl p-3">
          <div className="font-semibold mb-1">TM consumption policy</div>
          <select className="border rounded-xl px-3 py-2" value={tmPolicy} onChange={e=>setTmPolicy(e.target.value)}>
            <option value="none">Do not consume (default)</option>
            <option value="consume">Consume 1 per teach (if counts exist)</option>
            <option value="ask">Ask each time</option>
          </select>
          <div className="text-xs text-gray-500 mt-1">If your inventory tracks counts (numbers), we decrement. If it's boolean, we never decrement.</div>
        </div>
      </Section>

      {/* Teachability-by-TM */}
      <Section title="Teachability by TM" subtitle="For each move you own, see which of your Pokémon can learn it now.">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          <input className="w-full md:w-1/2 border rounded-xl px-3 py-2" placeholder="Search move…" value={search} onChange={e=>setSearch(e.target.value)} onClick={e=>e.stopPropagation()} />
          <select className="border rounded-xl px-3 py-2" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
            {typeOptions.map(t=><option key={t}>{t}</option>)}
          </select>
          <select className="border rounded-xl px-3 py-2" value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
            {catOptions.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>

        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 text-xs font-semibold text-gray-600 px-3 py-2 border-b">
            <div className="col-span-5">Move</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-1 text-right">Count</div>
            <div className="col-span-2 text-right">Teachable</div>
          </div>
          <div className="max-h-[420px] overflow-auto">
            {filtered.map(n=>{
              const meta = moveMeta[n]||{};
              const c = rowCounts(n);
              return (
                <div key={n} className="grid grid-cols-12 items-center px-3 py-2 border-b hover:bg-slate-50 cursor-pointer" onClick={()=>setSelectedMove(n)}>
                  <div className="col-span-5 text-sm">{n}</div>
                  <div className="col-span-2"><span className="pill">{meta.type||"—"}</span></div>
                  <div className="col-span-2"><span className="pill">{meta.cat||"—"}</span></div>
                  <div className="col-span-1 text-right">{getOwnedCount(n)}</div>
                  <div className="col-span-2 text-right">{c.teach} / {c.total}</div>
                </div>
              )
            })}
            {!filtered.length && <div className="p-3 text-sm text-gray-500">No moves match.</div>}
          </div>
        </div>
      </Section>

      {selectedMove && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={()=>setSelectedMove(null)}>
          <div className="absolute right-0 top-0 bottom-0 w-full md:w-[520px] bg-white shadow-xl p-4 overflow-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Teachability — {selectedMove}</div>
              <div className="flex items-center gap-4">
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" className="scale-110" checked={showNotCompatible} onChange={e=>setShowNotCompatible(e.target.checked)} />
                  Show Not compatible
                </label>
                <button className="px-3 py-1 rounded border" onClick={()=>setSelectedMove(null)}>Close</button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-2">Click “Teach now” to add or replace a move on that Pokémon. Respects your TM consumption policy.</div>
            <div className="space-y-2">
              {
                owned.map(mon=>{
                  const low=(selectedMove||"").toLowerCase();
                  const knows = (monMoves[mon.id]||[]).some(x=>(x||"").toLowerCase()===low);
                  const can = (canByMon[mon.id] && canByMon[mon.id].has(low)) || false;
                  const show = can || knows || showNotCompatible;
                  if(!show) return null;
                  if(showTeachOnly && !(can && !knows)) return null;
                  return (
                    <div key={mon.id} className="flex items-center justify-between border rounded-xl p-2">
                      <div className="flex items-center gap-3">
                        <Thumb mon={mon} size={40}/>
                        <div>
                          <div className="font-medium">{mon.name}</div>
                          <div className="text-xs text-gray-600">{mon.types.join(" / ")}</div>
                        </div>
                      </div>
                      <div>
                        {
                          knows ? <span className="pill cursor-default">Already knows</span> :
                          can ? <button className="px-3 py-1 rounded border text-sm hover:bg-gray-50" onClick={()=>props.teachMove(mon, selectedMove)}>Teach now</button> :
                          <span className="pill cursor-default">Not compatible</span>
                        }
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;




function ensureController(ms = 10000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort('timeout'), ms);
  return { signal: ac.signal, clear: () => clearTimeout(t) };
}

/**
 * Load Scarlet/Violet TM move-name set.
 * - Uses localStorage cache first
 * - Falls back to PokeAPI with progress callbacks
 * - Then tries /tm_catalog_sv.json
 * - Finally tiny built-in fallback so dev "Add all TMs" always works
 *
 * @param {(next: any) => void=} report  optional setState updater for tmStatus
 * @returns {Promise<Set<string>>}
 */
async function ensureTMSet(report){
  const bump = (patch) => {
    try {
      if (typeof report === 'function') {
        // allow setState(function) and setState(object)
        if (typeof patch === 'function') report(patch);
        else report(patch);
      }
    } catch {}
  };

  // 1) localStorage cache
  try {
    const cachedStr = localStorage.getItem("tmMoveSet");
    if (cachedStr) {
      const cached = JSON.parse(cachedStr);
      if (Array.isArray(cached) && cached.length) {
        const set = new Set(cached.map(String));
        (window)._tmCatalog = set;
        bump({ ready:true, size: set.size, loading:false, scanned: set.size, pages: 0 });
        return set;
      }
    }
  } catch {}

  const norm = (s) => String(s).toLowerCase().trim();

  // 2) PokeAPI crawl with timeouts and progress
  try {
    const mvset = new Set();
    let next = "https://pokeapi.co/api/v2/machine?limit=500";
    let pages = 0, scanned = 0;
    const vgName = "scarlet-violet";

    while (next) {
      bump(s => ({ ...(s||{}), loading:true, pages: pages + 1 }));
      const pgCtrl = ensureController(12000);
      const page = await fetch(next, { signal: pgCtrl.signal }).then(r => r.json());
      pgCtrl.clear();

      pages++;
      const results = page?.results || [];
      scanned += results.length;
      bump(s => ({ ...(s||{}), loading:true, scanned, pages }));

      for (const r of results) {
        try {
          const mcCtrl = ensureController(8000);
          const mc = await fetch(r.url, { signal: mcCtrl.signal }).then(r => r.json());
          mcCtrl.clear();
          if (mc?.version_group?.name === vgName) {
            const nm = mc?.move?.name;
            if (nm) mvset.add(norm(nm));
          }
        } catch {}
      }
      next = page?.next;
    }

    const arr = Array.from(mvset);
    try { localStorage.setItem("tmMoveSet", JSON.stringify(arr)); } catch {}
    const set = new Set(arr);
    (window)._tmCatalog = set;
    bump({ ready:true, size: set.size, loading:false, scanned, pages });
    return set;
  } catch (e) {
    console.warn("TM crawl failed, using local fallback:", e);
  }

  // 3) Local JSON fallback
  try {
    const res = await fetch("/tm_catalog_sv.json");
    const arr = await res.json();
    const set = new Set(arr.map(norm));
    try { localStorage.setItem("tmMoveSet", JSON.stringify(Array.from(set))); } catch {}
    (window)._tmCatalog = set;
    bump({ ready:true, size: set.size, loading:false, scanned: set.size, pages: 0 });
    return set;
  } catch {}

  // 4) Emergency tiny fallback
  const devFallback = ["thunderbolt","flamethrower","ice beam","energy ball","shadow ball","earthquake"];
  const set = new Set(devFallback);
  try { localStorage.setItem("tmMoveSet", JSON.stringify(Array.from(set))); } catch {}
  (window)._tmCatalog = set;
  bump({ ready:true, size: set.size, loading:false, scanned: set.size, pages: 0 });
  return set;
}