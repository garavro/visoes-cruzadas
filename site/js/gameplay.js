function startGame(){
  if($("transportText")){
    $("transportText").textContent=
      gameMode==="offline"
        ?"Local"
        :gameType==="course"
          ?"WebSocket · Física + mundo distribuídos"
          :gameType==="survival"
            ?"WebSocket · Física + obstáculos distribuídos"
            :transportMode==="websocket"
              ?"WebSocket · Sala Cloudflare"
              :"WebRTC P2P";
  }

  keys={};
  touchInput={
    left:false,
    right:false,
    jump:false
  };

  remoteInput={
    left:false,
    right:false,
    jump:false
  };

  hideEnd();
  setEndActions("none");

  if(gameType==="survival"){
    WORLD.w=1200;
    WORLD.h=680;

    if(
      !state||
      !Array.isArray(
        state.hazards
      )
    ){
      state=
        newSurvivalState(
          gameMode==="online"
            ?activeMatchRoster
            :undefined
        );
    }

    if(
      !remoteState||
      !Array.isArray(
        remoteState.hazards
      )
    ){
      remoteState=
        newSurvivalState(
          gameMode==="online"
            ?activeMatchRoster
            :undefined
        );
    }

    $("gameTitle").textContent=
      "VISÕES CRUZADAS — MODO 2";

    $("gameSubtitle").textContent=
      gameMode==="online"
        ?"Física distribuída: cada aparelho simula seu jogador e reconstrói os obstáculos pelo relógio compartilhado."
        :"Cada jogador pode ser eliminado individualmente. A equipe sobrevive enquanto pelo menos um jogador continuar vivo.";

    $("survivalTimer")
      .classList
      .remove("hidden");

    $("mapPanel")
      .classList
      .add("hidden");

    updateSurvivalTimer(0);
    updatePhaseCounter();

    if(gameMode==="offline"){
      $("roleText").textContent=
        "COUCH CO-OP · SOBREVIVÊNCIA";

      $("roleText").style.color=
        "#9fc6ff";

      $("controlText").innerHTML=
        "P1: <kbd>A</kbd>/<kbd>D</kbd>/<kbd>W</kbd> · P2: <kbd>←</kbd>/<kbd>→</kbd>/<kbd>↑</kbd>";

      $("netText").textContent=
        "OFFLINE";
    }else if(role==="host"){
      $("roleText").textContent=
        "JOGADOR 1 · HOST";

      $("roleText").style.color=
        "var(--yellow)";

      $("controlText").innerHTML=
        "<kbd>A</kbd>/<kbd>D</kbd> mover · <kbd>W</kbd> pular";

      $("netText").textContent=
        transportMode==="websocket"
          ?"Sala online"
          :"Conectado";
    }else{
      $("roleText").textContent=
        "JOGADOR 2";

      $("roleText").style.color=
        "var(--red)";

      $("controlText").innerHTML=
        "<kbd>←</kbd>/<kbd>→</kbd> mover · <kbd>↑</kbd> pular";

      $("netText").textContent=
        transportMode==="websocket"
          ?"Sala online"
          :"Conectado";
    }

    if(
      gameMode==="online"&&
      role==="client"
    ){
      initializeLocalDistributedSurvivalPlayer();
      setSurvivalClockAnchor(
        remoteState.elapsed||
        0
      );
    }

    $("gameMsg").textContent=
      "Modo 2: cada cor pertence a um jogador; o azul é visível para todos. Eliminados continuam como espectadores.";
  }else{
    if(gameMode==="online"&&activeMatchRoster.length>=2){
      if(
        !state||
        !Array.isArray(state.runtimeBlocks)||
        state.players?.length!==activeMatchRoster.length
      ){
        state=newOnlineMultiplayerState(activeMatchRoster);
      }

      if(
        !remoteState||
        !Array.isArray(remoteState.runtimeBlocks)||
        remoteState.players?.length!==activeMatchRoster.length
      ){
        remoteState=newOnlineMultiplayerState(activeMatchRoster);
      }

      if(role==="client"){
        initializeLocalDistributedPlayer();
      }
    }else{
      if(
        !state||
        !Array.isArray(state.runtimeBlocks)
      ){
        state=newState();
      }
      remoteState=newState();
    }

    $("gameTitle").textContent=
      "VISÕES CRUZADAS — PROCEDURAL";

    $("gameSubtitle").textContent=
      gameMode==="online"
        ?"Física distribuída: personagem e plataformas dinâmicas são calculados localmente com o relógio da sala."
        :"Rotas podem usar movimento, plataformas temporárias, obstáculos, blocos azuis e zigue-zague.";

    $("survivalTimer")
      .classList
      .add("hidden");

    updateMapPanelForRole();

    if(gameMode==="offline"){
      $("roleText").textContent=
        "COUCH CO-OP";

      $("roleText").style.color=
        "#9fc6ff";

      $("controlText").innerHTML=
        "P1: <kbd>A</kbd>/<kbd>D</kbd>/<kbd>W</kbd> · P2: <kbd>←</kbd>/<kbd>→</kbd>/<kbd>↑</kbd>";

      $("gameMsg").textContent=
        "Modo offline em tela dividida.";

      $("netText").textContent=
        "OFFLINE";
    }else{
      const me=activeMatchRoster.find(
        player=>player.playerId===PLAYER_ID
      );

      const slot=me?.slot??myRoomSlot??0;
      const number=(Number(slot)||0)+1;
      const color=playerColorForSlot(slot);

      $("roleText").textContent=
        `JOGADOR ${number}${role==="host"?" · HOST":""}`;

      $("roleText").style.color=color;

      $("controlText").innerHTML=
        role==="host"
          ?"<kbd>A</kbd>/<kbd>D</kbd> mover · <kbd>W</kbd> pular"
          :"<kbd>←</kbd>/<kbd>→</kbd> mover · <kbd>↑</kbd> pular";

      $("gameMsg").textContent=
        `Sua visão usa a sua cor. Você colide com todas as plataformas, inclusive as invisíveis.`;

      $("netText").textContent=
        `Conectado · ${activeMatchRoster.length} jogadores`;
    }
  }

  $("canvas")
    .classList
    .toggle(
      "hidden",
      gameMode==="offline"
    );

  $("offlineViews")
    .classList
    .toggle(
      "hidden",
      gameMode!=="offline"
    );

  setScreen("game");
  refreshPlayerProgress();

  lastTime=
    performance.now();

  accumulator=0;
}

function overlap(a,b){
  return(
    a.x<b.x+b.w&&
    a.x+a.w>b.x&&
    a.y<b.y+b.h&&
    a.y+a.h>b.y
  );
}

function solidRuntimeBlocks(gameState){
  return(
    gameState.runtimeBlocks||
    []
  ).filter(
    block=>
      block.active!==false&&
      block.kind!=="death"
  );
}

function deathRuntimeBlocks(gameState){
  return(
    gameState.runtimeBlocks||
    []
  ).filter(
    block=>
      block.active!==false&&
      block.kind==="death"
  );
}

function triangleWave(t){
  const normalized=
    ((t%1)+1)%1;

  return normalized<0.5
    ?-1+normalized*4
    :3-normalized*4;
}

function updateRuntimeBlocks(gameState,dt){
  gameState.elapsed=
    (gameState.elapsed||0)+dt;

  if(
    !Array.isArray(
      gameState.runtimeBlocks
    )
  ){
    gameState.runtimeBlocks=
      createRuntimeBlocks();
  }

  for(
    const block
    of gameState.runtimeBlocks
  ){
    const oldX=block.x;
    const oldY=block.y;

    block.active=true;
    block.x=block.baseX;
    block.y=block.baseY;

    const behavior=
      block.behavior;

    if(
      behavior?.type==="moving"
    ){
      const range=
        Math.max(
          1,
          Number(
            behavior.range||
            40
          )
        );

      const speed=
        Math.max(
          1,
          Number(
            behavior.speed||
            40
          )
        );

      /*
        Para ir de -range até +range e voltar,
        a plataforma percorre 4*range por ciclo.
      */
      const period=
        (4*range)/speed;

      const phase=
        Number(
          behavior.phase||
          0
        );

      const wave=
        triangleWave(
          gameState.elapsed/
          period+
          phase
        );

      const offset=
        wave*range;

      if(
        behavior.axis==="y"
      ){
        block.y=
          block.baseY+
          offset;
      }else{
        block.x=
          block.baseX+
          offset;
      }
    }

    if(
      behavior?.type==="blink"
    ){
      const period=
        Number(
          behavior.period||
          10
        );

      const visibleFor=
        Number(
          behavior.visibleFor||
          5
        );

      const phase=
        Number(
          behavior.phase||
          0
        );

      const time=
        (
          gameState.elapsed+
          phase
        )%period;

      block.active=
        time<
        visibleFor;

      block.timeToToggle=
        block.active
          ?visibleFor-time
          :period-time;
    }

    block.dx=
      block.x-oldX;

    block.dy=
      block.y-oldY;
  }

  /*
    Se o personagem estava sobre uma plataforma móvel,
    ele acompanha o deslocamento dela.
  */
  for(
    const player
    of gameState.players
  ){
    if(
      !player.groundBlockId
    ){
      continue;
    }

    const ground=
      gameState.runtimeBlocks.find(
        block=>
          block.id===
          player.groundBlockId
      );

    if(
      !ground||
      ground.active===false
    ){
      player.groundBlockId=null;
      player.onGround=false;
      continue;
    }

    player.x+=
      ground.dx||0;

    player.y+=
      ground.dy||0;
  }
}

function touchedDeathBlock(
  player,
  gameState
){
  for(
    const hazard
    of deathRuntimeBlocks(
      gameState
    )
  ){
    if(
      overlap(
        player,
        hazard
      )
    ){
      return true;
    }
  }

  return false;
}

function simulatePlayer(
  player,
  input,
  dt,
  gameState
){
  let direction=0;

  if(input.left)direction--;
  if(input.right)direction++;

  player.vx=
    direction*
    MOVE_SPEED;

  if(
    input.jump&&
    player.onGround&&
    !player.jumpLock
  ){
    player.vy=
      -JUMP_SPEED;

    player.onGround=false;
    player.groundBlockId=null;
    player.jumpLock=true;

// >>> SOM DE PULO AQUI <<<
    if(window.gameAudio) window.gameAudio.playJump();
    
  }

  if(!input.jump){
    player.jumpLock=false;
  }

  player.vy+=
    GRAVITY*
    dt;

  const solids=
    solidRuntimeBlocks(
      gameState
    );

  /*
    Movimento horizontal.
  */
  player.x+=
    player.vx*
    dt;

  for(
    const block
    of solids
  ){
    if(
      overlap(
        player,
        block
      )
    ){
      if(
        player.vx>0
      ){
        player.x=
          block.x-
          player.w;
      }else if(
        player.vx<0
      ){
        player.x=
          block.x+
          block.w;
      }
    }
  }

  if(
    touchedDeathBlock(
      player,
      gameState
    )
  ){

    // >>> SOM DE EXPLOSÃO AQUI <<<
    if(window.gameAudio) window.gameAudio.playExplosion();
    
    finishMatch(
      "Fase perdida",
      `O Jogador ${player.id} tocou em um bloco azul mortal.`
    );

    return;
  }

  /*
    Movimento vertical.
  */
  player.onGround=false;
  player.groundBlockId=null;

  player.y+=
    player.vy*
    dt;

  for(
    const block
    of solids
  ){
    if(
      overlap(
        player,
        block
      )
    ){
      if(
        player.vy>0
      ){
        player.y=
          block.y-
          player.h;

        player.vy=0;
        player.onGround=true;
        player.groundBlockId=
          block.id;
      }else if(
        player.vy<0
      ){
        player.y=
          block.y+
          block.h;

        player.vy=0;
      }
    }
  }

  if(
    touchedDeathBlock(
      player,
      gameState
    )
  ){

// >>> SOM DE EXPLOSÃO AQUI <<<
    if(window.gameAudio) window.gameAudio.playExplosion();
    
    finishMatch(
      "Fase perdida",
      `O Jogador ${player.id} tocou em um bloco azul mortal.`
    );

    return;
  }

  const margin=8;

  if(
    player.x<=margin||
    player.x+player.w>=
      WORLD.w-margin||
    player.y<=margin||
    player.y+player.h>=
      WORLD.h-margin
  ){

// >>> SOM DE EXPLOSÃO AQUI <<<
    if(window.gameAudio) window.gameAudio.playExplosion();
    
    finishMatch(
      "Fase perdida",
      `O Jogador ${player.id} encostou na borda.`
    );

    return;
  }

  player.reached=
    overlap(
      player,
      goal
    );
}

function hostInput(){
  return{
    left:!!keys.KeyA||(gameMode==="offline"?offlineTouchInput1.left:touchInput.left),
    right:!!keys.KeyD||(gameMode==="offline"?offlineTouchInput1.right:touchInput.right),
    jump:!!keys.KeyW||(gameMode==="offline"?offlineTouchInput1.jump:touchInput.jump)
  };
}

function clientInput(){
  return{
    left:!!keys.ArrowLeft||(gameMode==="offline"?offlineTouchInput2.left:touchInput.left),
    right:!!keys.ArrowRight||(gameMode==="offline"?offlineTouchInput2.right:touchInput.right),
    jump:!!keys.ArrowUp||(gameMode==="offline"?offlineTouchInput2.jump:touchInput.jump)
  };
}


function neutralInput(){
  return{
    left:false,
    right:false,
    jump:false
  };
}

function eliminateMultiplayerPlayer(player,reason){
  if(!player||player.alive===false||state.finished){
    return;
  }

  // >>> SOM DE EXPLOSÃO AQUI <<<
  if(window.gameAudio) window.gameAudio.playExplosion();

  player.alive=false;
  player.eliminatedReason=reason;
  player.vx=0;
  player.vy=0;
  player.onGround=false;
  player.groundBlockId=null;

  if(player.playerId===PLAYER_ID){
    $("gameMsg").textContent=
      "Você foi eliminado. A partida continua enquanto houver alguém vivo.";
  }

  const alive=state.players.filter(
    candidate=>candidate.alive!==false
  );

  if(alive.length===0){
    finishMatch(
      "Game over",
      "Todos os jogadores foram eliminados.",
      "gameover"
    );
  }
}

function simulateMultiplayerPlayer(
  player,
  input,
  dt,
  gameState
){
  if(player.alive===false||gameState.finished){
    return;
  }

  let direction=0;
  if(input.left)direction--;
  if(input.right)direction++;

  player.vx=direction*MOVE_SPEED;

  if(input.jump&&player.onGround&&!player.jumpLock){
    player.vy=-JUMP_SPEED;
    player.onGround=false;
    player.groundBlockId=null;
    player.jumpLock=true;

    // >>> SOM DE PULO AQUI <<<
    if(window.gameAudio) window.gameAudio.playJump();
    
  }

  if(!input.jump){
    player.jumpLock=false;
  }

  player.vy+=GRAVITY*dt;

  const solids=solidRuntimeBlocks(gameState);

  player.x+=player.vx*dt;

  for(const block of solids){
    if(overlap(player,block)){
      if(player.vx>0){
        player.x=block.x-player.w;
      }else if(player.vx<0){
        player.x=block.x+block.w;
      }
    }
  }

  if(touchedDeathBlock(player,gameState)){
    eliminateMultiplayerPlayer(
      player,
      "tocou em um bloco azul mortal"
    );
    return;
  }

  player.onGround=false;
  player.groundBlockId=null;
  player.y+=player.vy*dt;

  for(const block of solids){
    if(overlap(player,block)){
      if(player.vy>0){
        player.y=block.y-player.h;
        player.vy=0;
        player.onGround=true;
        player.groundBlockId=block.id;
      }else if(player.vy<0){
        player.y=block.y+block.h;
        player.vy=0;
      }
    }
  }

  if(touchedDeathBlock(player,gameState)){
    eliminateMultiplayerPlayer(
      player,
      "tocou em um bloco azul mortal"
    );
    return;
  }

  const margin=8;

  if(
    player.x<=margin||
    player.x+player.w>=WORLD.w-margin||
    player.y<=margin||
    player.y+player.h>=WORLD.h-margin
  ){
    eliminateMultiplayerPlayer(
      player,
      "encostou na borda do mundo"
    );
    return;
  }

  player.reached=overlap(player,goal);

  if(player.reached){
    finishMatch(
      "Equipe venceu!",
      `O Jogador ${(Number(player.slot)||0)+1} chegou à saída. Todos venceram.`,
      "victory"
    );
  }
}

function hostUpdateMultiplayer(dt){
  if(state.finished)return;

  state.elapsed=
    (Number(state.elapsed)||0)+dt;

  const localPlayer=
    state.players.find(
      player=>
        player.playerId===
        PLAYER_ID
    );

  syncDeterministicCourseWorld(
    state,
    state.elapsed,
    localPlayer?[localPlayer]:[]
  );

  if(localPlayer){
    simulateMultiplayerPlayer(
      localPlayer,
      hostInput(),
      dt,
      state
    );
  }

  /*
    Os demais personagens são simulados nos próprios aparelhos.
    O Host mantém o relógio oficial e faz validação.
  */
}

function hostUpdate(dt){
  if(
    gameMode==="online"&&
    gameType==="course"&&
    activeMatchRoster.length>=2
  ){
    hostUpdateMultiplayer(dt);
    return;
  }

  if(state.finished)return;

  updateRuntimeBlocks(state,dt);

  simulatePlayer(
    state.players[0],
    hostInput(),
    dt,
    state
  );

  if(state.finished)return;

  simulatePlayer(
    state.players[1],
    gameMode==="offline"?clientInput():remoteInput,
    dt,
    state
  );

  if(
    state.players[0].reached&&
    state.players[1].reached
  ){
    finishMatch(
      "Vocês venceram!",
      "Os dois jogadores chegaram à saída.",
      "victory"
    );
  }
}

function setEndActions(mode){
  const decision=$("generatedMapDecision");
  const next=$("nextMapBtn");

  decision.classList.add("hidden");
  next.classList.add("hidden");

  if(mode==="generated-win"){
    decision.classList.remove("hidden");
  }

  if(mode==="next"){
    next.classList.remove("hidden");
  }
}

async function goToNextMap(){
  if(gameMode==="offline"){
    setEndActions("none");hideEnd();loadNextOfflineMap();return;
  }
  if(role!=="host")return;
  setEndActions("none");hideEnd();await loadNextMapForPair();
}

function finishMatch(t,x,kind=null){
  if(state.finished)return;

  state.finished=true;
  state.result={
    title:t,
    text:x,
    kind:kind||null
  };

  setEndActions("none");

  if(kind==="victory"||t==="Vocês venceram!"||t==="Equipe venceu!"){

    // >>> TOCA O SOM DE VITÓRIA AQUI <<<
    if(window.gameAudio) {
        window.gameAudio.stopBGM();     // Para a música de tensão
        window.gameAudio.playVictory(); // Toca a musiquinha de sucesso
    }
    
    mapWasCompleted=true;

    if(
      currentMap&&
      currentMap.databaseId
    ){
      markMapPlayed(
        currentMap.databaseId,
        true
      );
    }

    if((gameMode==="offline"||role==="host")&&currentMap){
      if(gameMode==="offline"){
        $("approveMapBtn").disabled=false;
        $("rejectMapBtn").disabled=false;
        $("mapLocalStatus").textContent="Mapa offline concluído. Avalie a fase.";
        setEndActions("generated-win");
      }else if(
        currentMap.source!=="database"&&
        !currentMap.databaseId
      ){
        $("approveMapBtn").disabled=false;
        $("rejectMapBtn").disabled=false;

        $("mapLocalStatus").textContent=
          "Mapa concluído. Confirme se ele deve entrar na biblioteca.";

        setEndActions("generated-win");
      }else{
        $("mapLocalStatus").textContent=
          "✓ Mapa da biblioteca concluído.";

        setEndActions("next");
      }
    }
  }

  showEnd(t,x);

  sendGame({
    type:"state",
    state:courseStateForNetwork()
  });
}

function resetMatch(b=false){
  if(
    gameMode==="online"&&
    gameType==="course"&&
    activeMatchRoster.length>=2
  ){
    state=newOnlineMultiplayerState(activeMatchRoster);
    remoteState=newOnlineMultiplayerState(activeMatchRoster);
    setCourseClockAnchor(0);
    distributedValidationByPlayer.clear();

    if(role==="client"){
      initializeLocalDistributedPlayer();
    }
  }else{
    state=newState();
    remoteState=newState();
  }

  hideEnd();

  if(b){
    sendGame({type:"restart"});
  }
}

function showEnd(t,x){
  $("endTitle").textContent=t;
  $("endText").textContent=x;
  $("overlay").style.display="grid";
}

function hideEnd(){
  $("overlay").style.display="none";
}

$("restartBtn").onclick=()=>{
  if(
    ModeSystem.restart()
  ){
    return;
  }

  if(gameType==="survival"){
    if(gameMode==="offline"){
      resetSurvival(false);
    }else if(role==="host"){
      resetSurvival(true);
    }else{
      sendGame({
        type:"restart_request"
      });
    }

    return;
  }

  if(gameMode==="offline"){
    resetMatch(false);
  }else if(role==="host"){
    resetMatch(true);
  }else{
    sendGame({
      type:"restart_request"
    });
  }
};

$("approveMapBtn").onclick=()=>{
  saveApprovedMap();
};

$("rejectMapBtn").onclick=()=>{
  rejectCurrentMap();
};

$("overlayApproveBtn").onclick=async()=>{
  await saveApprovedMap();
};

$("overlayRejectBtn").onclick=async()=>{
  await rejectCurrentMap();
};

$("nextMapBtn").onclick=async()=>{
  await goToNextMap();
};
addEventListener("keydown",e=>{if(["ArrowUp","ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault();keys[e.code]=true;if(role==="client"&&gameType==="survival"&&transportMode!=="websocket")sendClientInput()});addEventListener("keyup",e=>{keys[e.code]=false;if(role==="client"&&gameType==="survival"&&transportMode!=="websocket")sendClientInput()});
function bindTouch(id,k){const b=$(id),down=e=>{e.preventDefault();touchInput[k]=true;b.classList.add("active");try{b.setPointerCapture(e.pointerId)}catch{}if(role==="client"&&gameType==="survival"&&transportMode!=="websocket")sendClientInput()},up=e=>{e.preventDefault();touchInput[k]=false;b.classList.remove("active");if(role==="client"&&gameType==="survival"&&transportMode!=="websocket")sendClientInput()};b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up);b.addEventListener("lostpointercapture",up)}bindTouch("btnLeft","left");bindTouch("btnRight","right");bindTouch("btnJump","jump");function sendClientInput(){sendGame({type:"input",input:clientInput()})}

function bindOfflineTouch(id,inputObject,key){const button=$(id),down=event=>{event.preventDefault();inputObject[key]=true;button.classList.add("active");try{button.setPointerCapture(event.pointerId)}catch{}},up=event=>{event.preventDefault();inputObject[key]=false;button.classList.remove("active")};button.addEventListener("pointerdown",down);button.addEventListener("pointerup",up);button.addEventListener("pointercancel",up);button.addEventListener("lostpointercapture",up);button.addEventListener("contextmenu",event=>event.preventDefault())}
bindOfflineTouch("offlineP1Left",offlineTouchInput1,"left");bindOfflineTouch("offlineP1Right",offlineTouchInput1,"right");bindOfflineTouch("offlineP1Jump",offlineTouchInput1,"jump");bindOfflineTouch("offlineP2Left",offlineTouchInput2,"left");bindOfflineTouch("offlineP2Right",offlineTouchInput2,"right");bindOfflineTouch("offlineP2Jump",offlineTouchInput2,"jump");

function resizeOneCanvas(target){const r=target.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);target.width=Math.max(1,Math.floor(r.width*d));target.height=Math.max(1,Math.floor(r.height*d))}function resizeCanvas(){resizeOneCanvas(canvas);resizeOneCanvas(offlineCanvasP1);resizeOneCanvas(offlineCanvasP2)}addEventListener("resize",resizeCanvas);
