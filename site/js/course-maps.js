function fnv1a(text){
  let h=0x811c9dc5;
  for(let i=0;i<text.length;i++){
    h^=text.charCodeAt(i);
    h=Math.imul(h,0x01000193);
  }
  return (h>>>0).toString(16).padStart(8,"0");
}

function seedToUint(seed){
  let h=2166136261>>>0;
  for(let i=0;i<seed.length;i++){
    h^=seed.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return h>>>0;
}

function mulberry32(a){
  return function(){
    a|=0;
    a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}

function makeSeed(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes=new Uint32Array(8);

  if(window.crypto&&crypto.getRandomValues){
    crypto.getRandomValues(bytes);
  }else{
    for(let i=0;i<bytes.length;i++){
      bytes[i]=Math.floor(Math.random()*0xffffffff);
    }
  }

  let seed="";
  for(let i=0;i<8;i++){
    seed+=chars[bytes[i]%chars.length];
  }
  return seed;
}

function clamp(v,min,max){
  return Math.max(min,Math.min(max,v));
}

/*
  Validação V2:
  Em vez de limitar todo salto a 65 px, calculamos a trajetória real.

  Movimento vertical:
      y(t) = y0 - JUMP_SPEED*t + 0.5*GRAVITY*t²

  A altura máxima teórica é ~125 px.
  O alcance horizontal no mesmo nível é ~231 px.
  Aplicamos margem de segurança de 78%, permitindo mapas bem mais difíceis
  sem trabalhar no limite absoluto da física.
*/
function transitionReachability(prev,next){
  const dy=next.y-prev.y;
  const discriminant=
    JUMP_SPEED*JUMP_SPEED+
    2*GRAVITY*dy;

  if(discriminant<0){
    return {
      ok:false,
      reason:"plataforma acima da altura máxima do salto"
    };
  }

  const landingTime=
    (JUMP_SPEED+Math.sqrt(discriminant))/
    GRAVITY;

  const theoreticalHorizontal=
    MOVE_SPEED*landingTime;

  const safeHorizontal=
    theoreticalHorizontal*0.86;

  let gap=0;

  if(next.x>prev.x+prev.w){
    gap=next.x-(prev.x+prev.w);
  }else if(prev.x>next.x+next.w){
    gap=prev.x-(next.x+next.w);
  }

  if(gap>safeHorizontal){
    return {
      ok:false,
      reason:`vão ${Math.round(gap)} > alcance seguro ${Math.round(safeHorizontal)}`
    };
  }

  return {
    ok:true,
    gap,
    landingTime,
    safeHorizontal
  };
}

function validateProceduralMap(map){
  if(!map||!Array.isArray(map.path)||map.path.length<3){
    return {ok:false,reason:"rota ausente"};
  }

  const path=map.path;
  const worldW=Number(map.world?.w)||1200;
  const worldH=Number(map.world?.h)||680;

  for(let i=0;i<path.length;i++){
    const p=path[i];

    if(
      p.x<20||
      p.x+p.w>worldW-20||
      p.y<100||
      p.y+p.h>worldH-20||
      p.w<50
    ){
      return {
        ok:false,
        reason:`plataforma ${i+1} fora dos limites`
      };
    }

    if(i===0)continue;

    const jump=
      transitionReachability(
        path[i-1],
        p
      );

    if(!jump.ok){
      return {
        ok:false,
        reason:`salto ${i}: ${jump.reason}`
      };
    }
  }

  const last=path[path.length-1];

  if(
    map.goal.x<last.x||
    map.goal.x+map.goal.w>last.x+last.w||
    Math.abs((map.goal.y+map.goal.h)-last.y)>2
  ){
    return {
      ok:false,
      reason:"saída não apoiada na plataforma final"
    };
  }

  return {
    ok:true,
    reason:"rota compatível com a trajetória física do salto"
  };
}

function randomInt(rand,min,max){
  return min+Math.floor(rand()*(max-min+1));
}

function rangesOverlap(a1,a2,b1,b2){
  return a1<b2&&a2>b1;
}

function candidateConflicts(candidate,path){
  for(const old of path){
    const horizontal=
      rangesOverlap(
        candidate.x-10,
        candidate.x+candidate.w+10,
        old.x,
        old.x+old.w
      );

    const vertical=
      rangesOverlap(
        candidate.y-45,
        candidate.y+candidate.h+45,
        old.y,
        old.y+old.h
      );

    if(horizontal&&vertical){
      return true;
    }
  }

  return false;
}

function featureSummary(features){
  const enabled=[];

  if(features?.moving)enabled.push("móveis");
  if(features?.blinking)enabled.push("temporárias");
  if(features?.obstacles)enabled.push("obstáculos");
  if(features?.death)enabled.push("azuis mortais");
  if(features?.zigzag)enabled.push("zigue-zague");

  return enabled.length
    ?enabled.join(", ")
    :"nenhum especial";
}

function chooseDistinct(rand,array,count){
  const copy=[...array];
  const result=[];

  while(copy.length&&result.length<count){
    const index=
      Math.floor(rand()*copy.length);

    result.push(
      copy.splice(index,1)[0]
    );
  }

  return result;
}

function generationPlayerCount(){
  if(
    gameMode==="online"&&
    gameType==="course"&&
    activeMatchRoster.length>=2
  ){
    return activeMatchRoster.length;
  }

  return 2;
}

function shuffledIndexes(rand,count){
  const result=Array.from(
    {length:count},
    (_,index)=>index
  );

  for(
    let i=result.length-1;
    i>0;
    i--
  ){
    const j=Math.floor(rand()*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }

  return result;
}

function balancedOwnerSequence(rand,playerCount,total){
  const result=[];
  let previous=null;

  while(result.length<total){
    let cycle=shuffledIndexes(
      rand,
      playerCount
    );

    if(
      previous!==null&&
      cycle.length>1&&
      cycle[0]===previous
    ){
      cycle.push(
        cycle.shift()
      );
    }

    for(const owner of cycle){
      if(result.length>=total)break;
      result.push(owner);
      previous=owner;
    }
  }

  return result;
}

function generatedBlockForOwner(block,ownerIndex,playerCount){
  if(playerCount===2){
    return {
      ...block,
      ownerIndex,
      type:
        ownerIndex===0
          ?"yellow"
          :"red"
    };
  }

  return {
    ...block,
    ownerIndex,
    type:"adaptive"
  };
}

function generateMapFromSeed(seed,requestedPlayerCount=2){
  const playerCount=Math.max(
    2,
    Math.floor(
      Number(requestedPlayerCount)||2
    )
  );

  const rand=mulberry32(
    seedToUint(
      `${seed}|v${GENERATOR_VERSION}|players:${playerCount}`
    )
  );

  const features={
    moving:rand()<0.58,
    blinking:rand()<0.52,
    obstacles:rand()<0.64,
    death:rand()<0.46,
    zigzag:rand()<0.70
  };

  /*
    Mais jogadores = mais pontos da rota.
    Não existe um teto fixo vinculado ao número de jogadores:
    o comprimento cresce de forma aproximadamente linear.
  */
  const minMiddle=Math.max(
    6,
    3+playerCount*2
  );

  const maxMiddle=Math.max(
    minMiddle+2,
    6+playerCount*3
  );

  const middleCount=randomInt(
    rand,
    minMiddle,
    maxMiddle
  );

  const startWidth=Math.max(
    240,
    105+playerCount*44
  );

  const finalWidth=Math.max(
    155,
    105+playerCount*25
  );

  const path=[];

  const start={
    id:"p0",
    x:60,
    y:585,
    w:startWidth,
    h:28,
    type:"shared",
    sharedPlatform:true,
    kind:"platform"
  };

  path.push(start);

  const owners=balancedOwnerSequence(
    rand,
    playerCount,
    middleCount
  );

  let previous=start;
  let lastWasBacktrack=false;
  let farthestRight=start.x+start.w;

  for(let i=0;i<middleCount;i++){
    let chosen=null;

    for(let attempt=0;attempt<180;attempt++){
      const width=randomInt(
        rand,
        52,
        102
      );

      const gap=randomInt(
        rand,
        42,
        122
      );

      const deltaY=randomInt(
        rand,
        -105,
        78
      );

      const canBacktrack=
        features.zigzag&&
        i>1&&
        !lastWasBacktrack&&
        previous.x>230;

      const backtrack=
        canBacktrack&&
        rand()<0.20;

      let x=backtrack
        ?previous.x-gap-width
        :previous.x+previous.w+gap;

      if(x<35){
        x=previous.x+previous.w+gap;
      }

      const candidate={
        id:`p${i+1}`,
        x,
        y:clamp(
          previous.y+deltaY,
          165,
          565
        ),
        w:width,
        h:24,
        type:"adaptive",
        ownerIndex:owners[i],
        kind:"platform"
      };

      if(
        candidateConflicts(
          candidate,
          path.slice(
            0,
            Math.max(
              0,
              path.length-2
            )
          )
        )
      ){
        continue;
      }

      const jump=transitionReachability(
        previous,
        candidate
      );

      if(jump.ok){
        chosen=candidate;
        lastWasBacktrack=
          candidate.x<previous.x;
        break;
      }
    }

    if(!chosen){
      const width=72;
      const gap=54;

      chosen={
        id:`p${i+1}`,
        x:
          previous.x+
          previous.w+
          gap,
        y:clamp(
          previous.y-38,
          180,
          555
        ),
        w:width,
        h:24,
        type:"adaptive",
        ownerIndex:owners[i],
        kind:"platform"
      };

      lastWasBacktrack=false;
    }

    path.push(chosen);
    previous=chosen;

    farthestRight=Math.max(
      farthestRight,
      chosen.x+chosen.w
    );
  }

  let finalPlatform=null;

  for(let attempt=0;attempt<120;attempt++){
    const gap=randomInt(
      rand,
      48,
      112
    );

    const candidate={
      id:`p${middleCount+1}`,
      x:
        previous.x+
        previous.w+
        gap,
      y:clamp(
        previous.y+
        randomInt(
          rand,
          -90,
          66
        ),
        150,
        550
      ),
      w:finalWidth,
      h:28,
      type:"shared",
      sharedPlatform:true,
      kind:"platform"
    };

    if(
      transitionReachability(
        previous,
        candidate
      ).ok
    ){
      finalPlatform=candidate;
      break;
    }
  }

  if(!finalPlatform){
    finalPlatform={
      id:`p${middleCount+1}`,
      x:
        previous.x+
        previous.w+
        52,
      y:clamp(
        previous.y-30,
        170,
        540
      ),
      w:finalWidth,
      h:28,
      type:"shared",
      sharedPlatform:true,
      kind:"platform"
    };
  }

  path.push(finalPlatform);

  farthestRight=Math.max(
    farthestRight,
    finalPlatform.x+
    finalPlatform.w
  );

  const worldWidth=Math.max(
    1200,
    Math.ceil(
      (farthestRight+170)/100
    )*100
  );

  const world={
    w:worldWidth,
    h:680
  };

  const eligibleIndices=[];

  for(
    let i=1;
    i<path.length-1;
    i++
  ){
    eligibleIndices.push(i);
  }

  const dynamicUsed=new Set();

  if(
    features.moving&&
    eligibleIndices.length
  ){
    const maxMoving=Math.min(
      eligibleIndices.length,
      Math.max(
        2,
        Math.ceil(playerCount/2)
      )
    );

    const count=randomInt(
      rand,
      1,
      maxMoving
    );

    for(
      const index
      of chooseDistinct(
        rand,
        eligibleIndices,
        count
      )
    ){
      dynamicUsed.add(index);

      path[index].behavior={
        type:"moving",
        axis:rand()<0.72?"x":"y",
        range:randomInt(rand,28,66),
        speed:randomInt(rand,35,60),
        phase:rand()
      };
    }
  }

  if(features.blinking){
    const candidates=eligibleIndices.filter(
      index=>
        !dynamicUsed.has(index)&&
        !dynamicUsed.has(index-1)&&
        !dynamicUsed.has(index+1)
    );

    const maxBlink=Math.min(
      candidates.length,
      Math.max(
        2,
        Math.ceil(playerCount/3)+1
      )
    );

    const count=maxBlink>0
      ?randomInt(rand,1,maxBlink)
      :0;

    for(
      const index
      of chooseDistinct(
        rand,
        candidates,
        count
      )
    ){
      dynamicUsed.add(index);

      path[index].behavior={
        type:"blink",
        period:10,
        visibleFor:5,
        phase:rand()*10
      };
    }
  }

  const generatedBlocks=[];

  for(let i=0;i<path.length;i++){
    const p=path[i];

    if(p.sharedPlatform){
      if(playerCount===2){
        generatedBlocks.push(
          {
            ...p,
            id:`${p.id}-y`,
            type:"yellow"
          },
          {
            ...p,
            id:`${p.id}-r`,
            type:"red"
          }
        );
      }else{
        generatedBlocks.push({
          ...p,
          id:`${p.id}-shared`,
          type:"shared",
          visibleToAll:true,
          sharedPlatform:true
        });
      }
    }else{
      generatedBlocks.push(
        generatedBlockForOwner(
          p,
          Number(p.ownerIndex)||0,
          playerCount
        )
      );
    }
  }

  if(features.obstacles){
    const obstacleCandidates=eligibleIndices.filter(
      index=>
        !path[index].behavior&&
        path[index].w>=72
    );

    const maxObstacles=Math.min(
      obstacleCandidates.length,
      Math.max(
        3,
        Math.ceil(playerCount*0.85)
      )
    );

    const obstacleCount=maxObstacles>0
      ?randomInt(rand,1,maxObstacles)
      :0;

    for(
      const index
      of chooseDistinct(
        rand,
        obstacleCandidates,
        obstacleCount
      )
    ){
      const parent=path[index];
      const w=randomInt(rand,16,25);
      const h=randomInt(rand,20,36);
      const leftSide=rand()<0.5;
      const ownerIndex=Number(parent.ownerIndex)||0;

      generatedBlocks.push(
        generatedBlockForOwner(
          {
            id:`obs-${index}`,
            x:leftSide
              ?parent.x+10
              :parent.x+parent.w-w-10,
            y:parent.y-h,
            w,
            h,
            kind:"obstacle"
          },
          ownerIndex,
          playerCount
        )
      );
    }
  }

  if(features.death){
    const deathCandidates=eligibleIndices.filter(
      index=>
        !path[index].behavior&&
        path[index].w>=78
    );

    const maxDeath=Math.min(
      deathCandidates.length,
      Math.max(
        2,
        Math.ceil(playerCount/3)+1
      )
    );

    const deathCount=maxDeath>0
      ?randomInt(rand,1,maxDeath)
      :0;

    for(
      const index
      of chooseDistinct(
        rand,
        deathCandidates,
        deathCount
      )
    ){
      const parent=path[index];
      const w=randomInt(rand,18,26);
      const h=16;
      const leftSide=rand()<0.5;

      generatedBlocks.push({
        id:`death-${index}`,
        x:leftSide
          ?parent.x+12
          :parent.x+parent.w-w-12,
        y:parent.y-h,
        w,
        h,
        type:"blue",
        kind:"death",
        visibleToAll:true
      });
    }
  }

  const generatedGoal={
    x:
      finalPlatform.x+
      Math.floor(
        (finalPlatform.w-70)/2
      ),
    y:finalPlatform.y-70,
    w:70,
    h:70
  };

  const map={
    seed,
    generatorVersion:GENERATOR_VERSION,
    playerCount,
    world,
    path,
    blocks:generatedBlocks,
    goal:generatedGoal,
    features
  };

  map.hash=fnv1a(
    JSON.stringify({
      generatorVersion:map.generatorVersion,
      playerCount:map.playerCount,
      world:map.world,
      path:map.path,
      blocks:map.blocks,
      goal:map.goal,
      features:map.features
    })
  );

  return map;
}

async function checkMapGlobal(map){
  const params=
    new URLSearchParams({
      hash:map.hash,
      seed:map.seed
    });

  return apiFetch(
    `/api/maps/check?${params}`
  );
}


function readOfflinePlayed(){return safeReadStorage(OFFLINE_PLAYED_STORAGE)}
function recordOfflineMapPlayed(map){if(!map?.hash)return;const played=readOfflinePlayed();if(!played.includes(map.hash)){played.push(map.hash);safeWriteStorage(OFFLINE_PLAYED_STORAGE,played.slice(-2000))}offlinePlayedCount=played.length;updatePhaseCounter()}
function generateValidNewMapOffline(){const rejected=safeReadStorage(STORAGE_REJECTED),rejectedHashes=new Set(rejected.map(item=>item.hash)),alreadyPlayed=new Set(readOfflinePlayed());for(let attempt=0;attempt<600;attempt++){const seed=makeSeed(),map=generateMapFromSeed(seed,2),validation=validateProceduralMap(map);if(!validation.ok||rejectedHashes.has(map.hash)||alreadyPlayed.has(map.hash))continue;map.autoValidation=validation;map.source="offline";return map}throw new Error("Não foi possível gerar um mapa offline inédito.")}
function loadNextOfflineMap(){const map=generateValidNewMapOffline();applyMap(map);state=newState();remoteState=newState();recordOfflineMapPlayed(map);hideEnd();setEndActions("none");return map}
function saveOfflineApprovedMap(){if(!currentMap||!mapWasCompleted){$("mapLocalStatus").textContent="Complete a fase antes de marcá-la como possível.";return}const approved=safeReadStorage(OFFLINE_APPROVED_STORAGE);if(!approved.some(item=>item.hash===currentMap.hash)){approved.push({seed:currentMap.seed,hash:currentMap.hash,generatorVersion:currentMap.generatorVersion,map:currentMap,approvedAt:new Date().toISOString()});safeWriteStorage(OFFLINE_APPROVED_STORAGE,approved.slice(-500))}$("mapLocalStatus").textContent="✓ Mapa aprovado e salvo neste dispositivo.";setEndActions("next")}
function rejectOfflineMap(){if(!currentMap)return;const rejected=safeReadStorage(STORAGE_REJECTED);if(!rejected.some(item=>item.hash===currentMap.hash)){rejected.push({seed:currentMap.seed,hash:currentMap.hash,generatorVersion:currentMap.generatorVersion,rejectedAt:new Date().toISOString()});safeWriteStorage(STORAGE_REJECTED,rejected.slice(-1000))}$("mapLocalStatus").textContent="✕ Mapa rejeitado localmente. Gerando outro...";loadNextOfflineMap()}
function cleanupConnectionForModeChange(){try{signal?.close()}catch{}signal=null;cleanupRTC()}
function startOfflineGame(type="course"){
  cleanupConnectionForModeChange();

  gameMode="offline";
  gameType=type;
  role="offline";
  gameStarted=true;

  document.body.className=
    type==="survival"
      ?"offline-mode survival-mode"
      :"offline-mode";

  offlinePlayedCount=
    readOfflinePlayed().length;

  if(type==="survival"){
    state=newSurvivalState(activeMatchRoster);
    remoteState=newSurvivalState(activeMatchRoster);
  }else{
    loadNextOfflineMap();
  }

  startGame();
}
async function generateValidNewMapGlobal(){
  const rejected=
    safeReadStorage(
      STORAGE_REJECTED
    );

  const rejectedHashes=
    new Set(
      rejected.map(
        item=>item.hash
      )
    );

  for(
    let attempt=0;
    attempt<300;
    attempt++
  ){
    const seed=
      makeSeed();

    const map=
      generateMapFromSeed(
        seed,
        generationPlayerCount()
      );

    const validation=
      validateProceduralMap(
        map
      );

    if(!validation.ok){
      continue;
    }

    if(
      rejectedHashes.has(
        map.hash
      )
    ){
      continue;
    }

    const globalStatus=
      await checkMapGlobal(
        map
      );

    if(
      globalStatus.known
    ){
      continue;
    }

    map.autoValidation=
      validation;

    map.source=
      "generated";

    return map;
  }

  throw new Error(
    "Não foi possível encontrar uma seed inédita e válida."
  );
}

function applyMap(map){
  currentMap={
    ...map
  };

  WORLD.w=Number(map.world?.w)||1200;
  WORLD.h=Number(map.world?.h)||680;

  blocks=
    map.blocks.map(
      b=>({...b})
    );

  if(
    gameMode==="online"&&
    gameType==="course"&&
    activeMatchRoster.length>=2
  ){
    blocks=decorateBlocksForMultiplayer(
      blocks,
      activeMatchRoster
    );
  }

  goal={
    ...map.goal
  };

  mapWasCompleted=
    false;

  $("mapSeed").textContent=
    map.seed||"---";

  const source=
    map.source||
    (
      map.databaseId
        ?"database"
        :"generated"
    );

  $("mapSource").textContent=
    source==="database"
      ?"BANCO D1"
      :source==="offline"
        ?"GERADO OFFLINE"
        :"GERADO AGORA";

  $("mapTargetPlayers").textContent=
    Number(map.playerCount)||2;

  $("mapWorldSize").textContent=
    `${WORLD.w} × ${WORLD.h}`;

  $("mapPlatformCount").textContent=
    Array.isArray(map.path)
      ?map.path.length
      :"---";

  $("mapFeatures").textContent=
    featureSummary(
      map.features
    );

  const validation=
    validateProceduralMap(
      map
    );

  $("autoValidation").textContent=
    validation.ok
      ?"APROVADO ✓"
      :"ATENÇÃO";

  $("autoValidation").className=
    validation.ok
      ?"ok"
      :"bad";

  if(gameMode==="offline"){
    $("mapLocalStatus").textContent="Couch Co-op: teste a fase e avalie localmente.";
    $("approveMapBtn").disabled=true;
    $("rejectMapBtn").disabled=false;
  }else if(role==="host"){
    if(source==="database"){
      $("mapLocalStatus").textContent=
        "Mapa aprovado da biblioteca. O grupo ainda possui jogadores que não haviam jogado este mapa.";

      $("approveMapBtn").disabled=
        true;

      $("rejectMapBtn").disabled=
        true;
    }else{
      $("mapLocalStatus").textContent=
        "Mapa novo. Teste a fase e informe se ela é realmente possível.";

      $("approveMapBtn").disabled=
        true;

      $("rejectMapBtn").disabled=
        false;
    }
  }else{
    $("mapLocalStatus").textContent=
      "Mapa sincronizado pelo Host.";
  }
}

async function loadNextMapForPair(){
  const playerIds=activeMatchPlayerIds();

  if(
    role!=="host"||
    mapLoadInProgress||
    playerIds.length<2
  ){
    return;
  }

  mapLoadInProgress=true;

  try{
    $("lobbyMessage").textContent=
      "Procurando um mapa ainda não jogado pelo grupo...";

    const response=await apiFetch(
      "/api/maps/next",
      {
        method:"POST",
        body:JSON.stringify({
          player_ids:playerIds,
          player_count:playerIds.length
        })
      }
    );

    let map;

    if(response.map){
      map={
        ...response.map,
        source:"database"
      };
    }else{
      $("lobbyMessage").textContent=
        "O grupo já percorreu a biblioteca disponível. Gerando um mapa novo...";

      map=await generateValidNewMapGlobal();
    }

    applyMap(map);

    sendGame({
      type:"map",
      map,
      roster:activeMatchRoster
    });

    if(map.databaseId){
      await markMapPlayed(
        map.databaseId,
        false
      );
    }

    state=newOnlineMultiplayerState(activeMatchRoster);
    remoteState=newOnlineMultiplayerState(activeMatchRoster);
    setCourseClockAnchor(0);
    distributedValidationByPlayer.clear();

    if(!gameStarted){
      gameStarted=true;
      matchStarting=false;
      startGame();
    }else{
      hideEnd();
      sendGame({type:"restart"});
    }

  }catch(error){
    console.error("Erro ao carregar mapa:",error);
    matchStarting=false;
    stopMatchStartWatch();

    if($("startLobbyGame")){
      $("startLobbyGame").disabled=false;
    }

    $("lobbyMessage").textContent=
      "Erro ao carregar a partida: "+error.message;
  }finally{
    mapLoadInProgress=false;
  }
}

async function markMapPlayed(mapId,completed){
  const playerIds=activeMatchPlayerIds();

  if(!mapId||playerIds.length===0){
    return;
  }

  try{
    await apiFetch(
      "/api/maps/played",
      {
        method:"POST",
        body:JSON.stringify({
          map_id:mapId,
          player_ids:playerIds,
          completed:!!completed
        })
      }
    );

    await refreshPlayerProgress();
  }catch(error){
    console.warn(
      "Não foi possível registrar histórico:",
      error
    );
  }
}

function mapForDatabase(map){
  return {
    seed:
      map.seed,

    generatorVersion:
      map.generatorVersion,

    playerCount:
      Number(map.playerCount)||2,

    world:
      map.world||{w:1200,h:680},

    hash:
      map.hash,

    path:
      map.path,

    blocks:
      map.blocks,

    goal:
      map.goal,

    features:
      map.features||{},

    autoValidation:
      map.autoValidation||
      validateProceduralMap(map)
  };
}

async function saveApprovedMap(){
  if(gameMode==="offline"){saveOfflineApprovedMap();return;}
  if(role!=="host"||!currentMap){return;}

  if(
    currentMap.source==="database"||
    currentMap.databaseId
  ){
    $("mapLocalStatus").textContent=
      "Este mapa já pertence à biblioteca.";
    return;
  }

  if(
    !mapWasCompleted
  ){
    $("mapLocalStatus").textContent=
      "Complete o mapa antes de marcá-lo como possível.";
    return;
  }

  $("approveMapBtn").disabled=
    true;

  $("rejectMapBtn").disabled=
    true;

  $("mapLocalStatus").textContent=
    "Salvando mapa no Cloudflare D1...";

  try{
    const response=
      await apiFetch(
        "/api/maps/approve",
        {
          method:"POST",
          body:
            JSON.stringify({
              seed:
                currentMap.seed,
              map_hash:
                currentMap.hash,
              generator_version:
                currentMap.generatorVersion,
              player_count:
                Number(currentMap.playerCount)||2,
              map:
                mapForDatabase(
                  currentMap
                )
            })
        }
      );

    currentMap.databaseId=
      response.id;

    currentMap.source=
      "database";

    $("mapSource").textContent=
      "BANCO D1";

    $("mapLocalStatus").textContent=
      "✓ Mapa aprovado e salvo globalmente no D1.";

    await markMapPlayed(
      currentMap.databaseId,
      true
    );

    setEndActions("next");
  }catch(error){
    console.error(error);

    $("mapLocalStatus").textContent=
      "Falha ao salvar no D1: "+
      error.message;

    $("approveMapBtn").disabled=
      false;

    $("rejectMapBtn").disabled=
      false;
  }
}

async function rejectCurrentMap(){
  if(gameMode==="offline"){rejectOfflineMap();return;}
  if(role!=="host"||!currentMap){return;}

  if(
    currentMap.source==="database"||
    currentMap.databaseId
  ){
    $("mapLocalStatus").textContent=
      "Mapas já aprovados não podem ser rejeitados nesta versão.";
    return;
  }

  $("approveMapBtn").disabled=true;
  $("rejectMapBtn").disabled=true;

  $("mapLocalStatus").textContent=
    "Registrando mapa impossível no D1...";

  const rejected=
    safeReadStorage(
      STORAGE_REJECTED
    );

  if(
    !rejected.some(
      item=>item.hash===currentMap.hash
    )
  ){
    rejected.push({
      seed:currentMap.seed,
      hash:currentMap.hash,
      rejectedAt:new Date().toISOString()
    });

    safeWriteStorage(
      STORAGE_REJECTED,
      rejected.slice(-500)
    );
  }

  try{
    await apiFetch(
      "/api/maps/reject",
      {
        method:"POST",
        body:JSON.stringify({
          seed:currentMap.seed,
          map_hash:currentMap.hash,
          generator_version:currentMap.generatorVersion,
          player_count:Number(currentMap.playerCount)||2,
          map:mapForDatabase(currentMap)
        })
      }
    );

    $("mapLocalStatus").textContent=
      "✕ Mapa rejeitado globalmente. Procurando a próxima fase...";

    setEndActions("none");
    hideEnd();

    await loadNextMapForPair();

  }catch(error){
    console.error(error);

    $("mapLocalStatus").textContent=
      "Falha ao registrar rejeição: "+
      error.message;

    $("rejectMapBtn").disabled=false;
  }
}

function updateMapPanelForRole(){
  if(!$("mapPanel"))return;

  $("mapPanel").classList.toggle(
    "hidden",
    gameType==="survival"
  );

  $("mapPanel").classList.toggle(
    "client",
    gameType!=="survival"&&
    gameMode==="online"&&
    role==="client"
  );
}
