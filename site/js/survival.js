let survivalHostRenderStateRef=null;

function updateLocalSpectatorStatus(){
  if(gameMode!=="online")return;

  const drawState=
    role==="host"
      ?state
      :gameType==="course"
        ?distributedClientRenderState()
        :remoteState;

  const me=
    drawState.players?.find(
      player=>
        player.playerId===
        PLAYER_ID
    );

  if(
    me&&
    me.alive===false&&
    !drawState.finished
  ){
    $("gameMsg").textContent=
      gameType==="survival"
        ?"Você foi eliminado. Continue observando os obstáculos da sua cor e ajude os sobreviventes."
        :"Você foi eliminado. Modo espectador: continue ajudando a equipe com a sua visão.";
  }
}


const SURVIVAL_ARENA={
  platform:{
    x:110,
    y:570,
    w:980,
    h:30
  },
  ceilingY:38
};

function randomBetween(min,max){
  return min+Math.random()*(max-min);
}

function newSurvivalPlayer(
  id,
  x,
  info=null,
  width=34
){
  return{
    id,
    playerId:
      info?.playerId||
      null,
    slot:
      info?.slot??
      (id-1),
    characterId:
      CharacterSystem.characterIdForPlayer(
        info?.playerId,
        info?.slot??(id-1),
        info?.characterId
      ),
    connected:true,
    alive:true,
    eliminatedReason:null,
    x,
    y:
      SURVIVAL_ARENA.platform.y-
      46,
    w:width,
    h:46,
    vx:0,
    vy:0,
    onGround:true,
    jumpLock:false
  };
}

function survivalRoster(
  roster=activeMatchRoster
){
  if(
    gameMode==="online"&&
    Array.isArray(roster)&&
    roster.length
  ){
    return sortedMatchRoster(
      roster
    );
  }

  /*
    Couch Co-op continua com dois jogadores locais.
  */
  return[
    {
      playerId:null,
      role:"offline",
      slot:0,
      characterId:
        CharacterSystem.offlineCharacterId(0)
    },
    {
      playerId:null,
      role:"offline",
      slot:1,
      characterId:
        CharacterSystem.offlineCharacterId(1)
    }
  ];
}

function configureSurvivalArena(
  playerCount
){
  /*
    A arena cresce suavemente para grupos maiores.
    Mantemos um limite visual razoável para não tornar
    obstáculos distantes pequenos demais.
  */
  const count=
    Math.max(
      2,
      Number(playerCount)||2
    );

  WORLD.w=
    Math.min(
      2200,
      Math.max(
        1200,
        1200+
        Math.max(
          0,
          count-4
        )*70
      )
    );

  WORLD.h=680;

  SURVIVAL_ARENA.platform.x=70;
  SURVIVAL_ARENA.platform.w=
    WORLD.w-140;
  SURVIVAL_ARENA.platform.y=570;
  SURVIVAL_ARENA.platform.h=30;
  SURVIVAL_ARENA.ceilingY=38;
}

function newSurvivalState(
  roster=activeMatchRoster
){
  const ordered=
    survivalRoster(
      roster
    );

  configureSurvivalArena(
    ordered.length
  );

  /*
    O tamanho visual do personagem diminui levemente
    apenas em salas muito grandes.
  */
  const playerWidth=
    Math.max(
      20,
      Math.min(
        34,
        34-
        Math.max(
          0,
          ordered.length-10
        )*.7
      )
    );

  const platform=
    SURVIVAL_ARENA.platform;

  const margin=32;

  const players=
    ordered.map(
      (info,index)=>{
        const center=
          platform.x+
          margin+
          (
            (index+.5)/
            Math.max(
              1,
              ordered.length
            )
          )*
          Math.max(
            playerWidth,
            platform.w-
            margin*2
          );

        return newSurvivalPlayer(
          index+1,
          clamp(
            center-
            playerWidth/2,
            platform.x+4,
            platform.x+
            platform.w-
            playerWidth-
            4
          ),
          info,
          playerWidth
        );
      }
    );

  return{
    players,
    hazards:[],
    elapsed:0,
    spawnTimer:1.35,
    finished:false,
    result:null,
    nextHazardId:1
  };
}

function survivalConnectedSlots(
  gameState
){
  const slots=
    (gameState.players||[])
      .filter(
        player=>
          player.connected!==
          false
      )
      .map(
        player=>
          Number(
            player.slot
          )||0
      );

  return[
    ...new Set(
      slots
    )
  ];
}

function chooseSurvivalHazardOwner(
  gameState
){
  /*
    Azul é reservado para morte e aparece para todos.
    Os demais perigos pertencem visualmente a um slot.
  */
  if(Math.random()<0.20){
    return{
      color:"blue",
      ownerSlot:null
    };
  }

  const slots=
    survivalConnectedSlots(
      gameState
    );

  if(
    gameMode==="online"&&
    slots.length
  ){
    const ownerSlot=
      slots[
        Math.floor(
          Math.random()*
          slots.length
        )
      ];

    return{
      color:"player",
      ownerSlot
    };
  }

  /*
    Compatibilidade do Couch Co-op.
  */
  return Math.random()<0.5
    ?{
        color:"yellow",
        ownerSlot:0
      }
    :{
        color:"red",
        ownerSlot:1
      };
}

function createSurvivalHazard(gameState){
  const elapsed=
    gameState.elapsed||0;

  const difficulty=
    Math.min(
      1,
      elapsed/90
    );

  const speed=
    150+
    difficulty*155+
    randomBetween(-15,35);

  const directions=[
    "leftToRight",
    "rightToLeft",
    "topToBottom",
    "bottomToTop"
  ];

  const direction=
    directions[
      Math.floor(
        Math.random()*
        directions.length
      )
    ];

  const visual=
    chooseSurvivalHazardOwner(
      gameState
    );

  const color=
    visual.color;

  const ownerSlot=
    visual.ownerSlot;

  const platform=
    SURVIVAL_ARENA.platform;

  const isBlueDeath=
    color==="blue";

  let hazard={
    id:
      `survival-${gameState.nextHazardId++}`,
    direction,
    color,
    ownerSlot,
    displayColor:
      ownerSlot===null
        ?"#3995ff"
        :playerColorForSlot(
            ownerSlot
          ),
    displayStroke:
      ownerSlot===null
        ?"#a9d2ff"
        :playerStrokeForSlot(
            ownerSlot
          ),
    kind:"survival-hazard",
    age:0,
    vx:0,
    vy:0
  };

  if(
    direction==="leftToRight"||
    direction==="rightToLeft"
  ){
    const w=
      isBlueDeath
        ?randomBetween(34,62)
        :randomBetween(42,78);

    const h=
      isBlueDeath
        ?randomBetween(24,48)
        :randomBetween(28,58);

    hazard={
      ...hazard,
      w,
      h,
      x:
        direction==="leftToRight"
          ?-w-15
          :WORLD.w+15,
      y:
        platform.y-h,
      vx:
        direction==="leftToRight"
          ?(isBlueDeath?speed*1.12:speed)
          :-(isBlueDeath?speed*1.12:speed),
      vy:0
    };
  }

  if(direction==="topToBottom"){
    const w=
      isBlueDeath
        ?randomBetween(42,78)
        :randomBetween(55,100);

    const h=
      isBlueDeath
        ?randomBetween(60,105)
        :randomBetween(85,145);

    hazard={
      ...hazard,
      w,
      h,
      x:
        randomBetween(
          platform.x+25,
          platform.x+
          platform.w-
          w-
          25
        ),
      y:-h-15,
      vx:0,
      vy:(isBlueDeath?speed*0.92:speed*0.78)
    };
  }

  if(direction==="bottomToTop"){
    const w=
      isBlueDeath
        ?randomBetween(40,72)
        :randomBetween(52,95);

    const h=
      isBlueDeath
        ?randomBetween(58,98)
        :randomBetween(70,125);

    hazard={
      ...hazard,
      w,
      h,
      x:
        randomBetween(
          platform.x+25,
          platform.x+
          platform.w-
          w-
          25
        ),
      y:
        platform.y+
        platform.h+
        15,
      vx:0,
      vy:-(isBlueDeath?speed*0.9:speed*0.76)
    };
  }

  hazard.spawnTime=
    Number(elapsed)||0;

  hazard.startX=
    Number(hazard.x)||0;

  hazard.startY=
    Number(hazard.y)||0;

  return hazard;
}

function survivalInputForPlayer(
  player
){
  if(gameMode==="offline"){
    return player.id===1
      ?hostInput()
      :clientInput();
  }

  if(
    player.playerId===
    PLAYER_ID
  ){
    return hostInput();
  }

  return(
    remoteInputsByPlayer.get(
      player.playerId
    )||
    neutralInput()
  );
}


function setSurvivalClockAnchor(elapsed=0){
  survivalClockAnchorElapsed=
    Math.max(
      0,
      Number(elapsed)||0
    );

  survivalClockAnchorPerf=
    performance.now();
}

function currentSurvivalClock(){
  if(
    gameMode!=="online"||
    gameType!=="survival"
  ){
    return Number(
      state?.elapsed||
      0
    );
  }

  if(role==="host"){
    return Number(
      state?.elapsed||
      0
    );
  }

  return Math.max(
    0,
    survivalClockAnchorElapsed+
    (
      performance.now()-
      survivalClockAnchorPerf
    )/1000
  );
}

function deterministicSurvivalHazardAtTime(
  hazard,
  elapsed
){
  const spawnTime=
    Number(
      hazard.spawnTime||
      0
    );

  const age=
    Math.max(
      0,
      Number(elapsed)-
      spawnTime
    );

  const startX=
    Number(
      hazard.startX??
      hazard.x
    )||0;

  const startY=
    Number(
      hazard.startY??
      hazard.y
    )||0;

  return{
    ...hazard,
    age,
    x:
      startX+
      (Number(hazard.vx)||0)*
      age,
    y:
      startY+
      (Number(hazard.vy)||0)*
      age
  };
}

function survivalHazardStillRelevant(
  hazard
){
  if(
    hazard.direction===
    "leftToRight"
  ){
    return hazard.x<
      WORLD.w+
      100;
  }

  if(
    hazard.direction===
    "rightToLeft"
  ){
    return hazard.x+
      hazard.w>
      -100;
  }

  if(
    hazard.direction===
    "topToBottom"
  ){
    return hazard.y<
      WORLD.h+
      120;
  }

  return hazard.y+
    hazard.h>
    -120;
}

function syncDeterministicSurvivalHazards(
  gameState,
  elapsed
){
  if(!gameState)return;

  gameState.elapsed=
    Number(elapsed)||0;

  gameState.hazards=
    (
      gameState.hazards||
      []
    )
    .map(
      hazard=>
        deterministicSurvivalHazardAtTime(
          hazard,
          gameState.elapsed
        )
    )
    .filter(
      survivalHazardStillRelevant
    );
}

function survivalStateForNetwork(){
  if(
    !state||
    gameType!=="survival"
  ){
    return state;
  }

  return{
    ...state,
    hazards:
      (
        state.hazards||
        []
      ).map(
        hazard=>({
          id:hazard.id,
          direction:hazard.direction,
          color:hazard.color,
          ownerSlot:hazard.ownerSlot,
          displayColor:hazard.displayColor,
          displayStroke:hazard.displayStroke,
          kind:hazard.kind,
          w:hazard.w,
          h:hazard.h,
          vx:hazard.vx,
          vy:hazard.vy,
          spawnTime:
            Number(
              hazard.spawnTime||
              0
            ),
          startX:
            Number(
              hazard.startX??
              hazard.x
            )||0,
          startY:
            Number(
              hazard.startY??
              hazard.y
            )||0
        })
      )
  };
}

function sanitizeDistributedSurvivalState(
  player
){
  return{
    x:Number(player.x)||0,
    y:Number(player.y)||0,
    vx:Number(player.vx)||0,
    vy:Number(player.vy)||0,
    onGround:!!player.onGround,
    jumpLock:!!player.jumpLock
  };
}

function initializeLocalDistributedSurvivalPlayer(){
  if(
    gameMode!=="online"||
    gameType!=="survival"||
    role!=="client"
  ){
    localDistributedSurvivalPlayer=null;
    return;
  }

  const source=
    remoteState.players?.find(
      player=>
        player.playerId===
        PLAYER_ID
    )||
    state.players?.find(
      player=>
        player.playerId===
        PLAYER_ID
    );

  if(!source){
    localDistributedSurvivalPlayer=null;
    return;
  }

  localDistributedSurvivalPlayer={
    ...source
  };

  survivalDistributedSeq=0;
  survivalDistributedSendAccumulator=0;

  NetSmoothing.clearCorrection(
    "survival-local"
  );

  NetSmoothing.clearScope(
    "survival"
  );
}

function applySurvivalAuthoritativeCorrection(
  player
){
  if(
    !player||
    !localDistributedSurvivalPlayer
  ){
    return;
  }

  if(player.alive===false){
    localDistributedSurvivalPlayer.alive=false;
  }
}

function syncLocalSurvivalWithSnapshot(
  nextState
){
  if(
    !localDistributedSurvivalPlayer||
    !nextState
  ){
    return;
  }

  const official=
    nextState.players?.find(
      player=>
        player.playerId===
        PLAYER_ID
    );

  // Snapshot do Host não reposiciona o jogador local.
  if(official?.alive===false){
    localDistributedSurvivalPlayer.alive=false;
  }
}

function distributedSurvivalRenderState(){
  if(
    !remoteState||
    !localDistributedSurvivalPlayer
  ){
    return remoteState;
  }

  const players=
    (
      remoteState.players||
      []
    ).map(
      player=>
        player.playerId===
        PLAYER_ID
          ?{
              ...localDistributedSurvivalPlayer
            }
          :player
    );

  return{
    ...remoteState,
    players:
      NetSmoothing.smoothRemotePlayers(
        "survival",
        players,
        PLAYER_ID
      )
  };
}

function distributedSurvivalHostRenderState(){
  if(!state){
    return state;
  }

  if(
    survivalHostRenderStateRef!==
    state
  ){
    survivalHostRenderStateRef=
      state;

    NetSmoothing.clearScope(
      "survival-host"
    );
  }

  return{
    ...state,
    players:
      NetSmoothing.smoothRemotePlayers(
        "survival-host",
        state.players||
        [],
        PLAYER_ID
      )
  };
}

function simulateDistributedSurvivalLocalPlayer(
  player,
  input,
  dt,
  gameState
){
  if(
    !player||
    player.alive===false||
    gameState?.finished
  ){
    return;
  }

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
    player.jumpLock=true;
  }

  if(!input.jump){
    player.jumpLock=false;
  }

  player.vy+=
    GRAVITY*
    dt;

  player.x+=
    player.vx*
    dt;

  const previousBottom=
    player.y+
    player.h;

  player.y+=
    player.vy*
    dt;

  resolveSurvivalPlatform(
    player,
    previousBottom
  );

  /*
    As colisões são simuladas localmente para responsividade.
    Morte permanece uma decisão do Host.
  */
  for(
    const hazard
    of gameState.hazards||
    []
  ){
    if(
      !overlap(
        player,
        hazard
      )
    ){
      continue;
    }

    if(
      hazard.color===
      "blue"
    ){
      /*
        Mantemos o personagem em contato para que o Host
        valide a colisão no próximo player-state.
      */
      continue;
    }

    if(
      hazard.direction===
      "leftToRight"
    ){
      player.x=
        hazard.x+
        hazard.w+
        .5;

      player.vx=
        Math.max(
          player.vx,
          hazard.vx
        );

      continue;
    }

    if(
      hazard.direction===
      "rightToLeft"
    ){
      player.x=
        hazard.x-
        player.w-
        .5;

      player.vx=
        Math.min(
          player.vx,
          hazard.vx
        );

      continue;
    }

    if(
      hazard.direction===
      "topToBottom"
    ){
      player.y=
        hazard.y+
        hazard.h+
        .5;

      player.vy=
        Math.max(
          player.vy,
          hazard.vy
        );

      continue;
    }

    if(
      hazard.direction===
      "bottomToTop"
    ){
      player.y=
        hazard.y-
        player.h-
        .5;

      player.vy=
        Math.min(
          player.vy,
          hazard.vy
        );
    }
  }
}

function sendDistributedSurvivalPlayerState(){
  if(
    role!=="client"||
    gameMode!=="online"||
    gameType!=="survival"||
    !localDistributedSurvivalPlayer||
    remoteState.finished
  ){
    return;
  }

  survivalDistributedSeq++;

  sendGame({
    type:"player-state",
    seq:
      survivalDistributedSeq,
    player:
      sanitizeDistributedSurvivalState(
        localDistributedSurvivalPlayer
      )
  });
}

function clientUpdateDistributedSurvival(
  dt
){
  if(
    !localDistributedSurvivalPlayer||
    !remoteState||
    remoteState.finished
  ){
    return;
  }

  syncDeterministicSurvivalHazards(
    remoteState,
    currentSurvivalClock()
  );

  const official=
    remoteState.players?.find(
      player=>
        player.playerId===
        PLAYER_ID
    );

  if(
    official?.alive===
    false
  ){
    localDistributedSurvivalPlayer.alive=
      false;

    return;
  }

  simulateDistributedSurvivalLocalPlayer(
    localDistributedSurvivalPlayer,
    clientInput(),
    dt,
    remoteState
  );

  survivalDistributedSendAccumulator+=
    dt;

  if(
    survivalDistributedSendAccumulator>=
    1/30
  ){
    survivalDistributedSendAccumulator=0;

    sendDistributedSurvivalPlayerState();
  }
}

function evaluateDistributedSurvivalPlayer(
  player
){
  if(
    !player||
    player.alive===false||
    state.finished
  ){
    return;
  }

  syncDeterministicSurvivalHazards(
    state,
    state.elapsed||
    0
  );

  if(
    player.y<=
    SURVIVAL_ARENA.ceilingY
  ){
    eliminateSurvivalPlayer(
      player,
      "tocou no teto"
    );

    return;
  }

  if(
    player.y>
    WORLD.h+
    30
  ){
    eliminateSurvivalPlayer(
      player,
      "caiu da plataforma"
    );

    return;
  }

  for(
    const hazard
    of state.hazards||
    []
  ){
    if(
      !overlap(
        player,
        hazard
      )
    ){
      continue;
    }

    if(
      hazard.color===
      "blue"
    ){
      eliminateSurvivalPlayer(
        player,
        "tocou no bloco azul mortal"
      );

      return;
    }

    if(
      hazard.direction===
      "topToBottom"
    ){
      const pushedY=
        hazard.y+
        hazard.h+
        .5;

      if(
        playerOverPlatform(
          player
        )&&
        pushedY+
        player.h>=
        SURVIVAL_ARENA.platform.y-
        1
      ){
        eliminateSurvivalPlayer(
          player,
          "foi prensado contra a plataforma"
        );

        return;
      }
    }

    if(
      hazard.direction===
      "bottomToTop"
    ){
      const pushedY=
        hazard.y-
        player.h-
        .5;

      if(
        pushedY<=
        SURVIVAL_ARENA.ceilingY
      ){
        eliminateSurvivalPlayer(
          player,
          "foi prensado contra o teto"
        );

        return;
      }
    }
  }

  /*
    O cliente pode já ter sido empurrado para dentro do piso
    por um obstáculo descendente. Essa condição é fatal.
  */
  if(
    playerOverPlatform(
      player
    )&&
    player.y+
    player.h>
    SURVIVAL_ARENA.platform.y+
    1
  ){
    eliminateSurvivalPlayer(
      player,
      "foi prensado contra a plataforma"
    );
  }
}

function validateDistributedSurvivalPlayerState(
  playerId,
  payload,
  seq
){
  const player=
    authoritativePlayerForId(
      playerId
    );

  if(
    !player||
    player.alive===false||
    state.finished||
    !payload
  ){
    return false;
  }

  const values=[
    payload.x,
    payload.y,
    payload.vx,
    payload.vy
  ].map(Number);

  if(
    values.some(
      value=>
        !Number.isFinite(
          value
        )
    )
  ){
    return false;
  }

  const previous=
    survivalValidationByPlayer.get(
      playerId
    );

  const numericSeq=
    Number(seq);

  if(
    previous&&
    Number.isFinite(
      numericSeq
    )&&
    numericSeq<=
    Number(
      previous.seq
    )
  ){
    return false;
  }

  player.x=values[0];
  player.y=values[1];
  player.vx=values[2];
  player.vy=values[3];
  player.onGround=
    !!payload.onGround;
  player.jumpLock=
    !!payload.jumpLock;

  survivalValidationByPlayer.set(
    playerId,
    {
      seq:
        Number.isFinite(
          numericSeq
        )
          ?numericSeq
          :0
    }
  );

  evaluateDistributedSurvivalPlayer(
    player
  );

  return true;
}

function playerOverPlatform(player){
  const p=
    SURVIVAL_ARENA.platform;

  return(
    player.x+
    player.w>
    p.x&&
    player.x<
    p.x+p.w
  );
}

function resolveSurvivalPlatform(
  player,
  previousBottom
){
  const p=
    SURVIVAL_ARENA.platform;

  const nowBottom=
    player.y+
    player.h;

  if(
    playerOverPlatform(player)&&
    player.vy>=0&&
    previousBottom<=p.y+4&&
    nowBottom>=p.y
  ){
    player.y=
      p.y-
      player.h;

    player.vy=0;
    player.onGround=true;
    return;
  }

  player.onGround=false;
}

function recordSurvivalBest(
  survived
){
  const value=
    Number(survived)||0;

  if(
    value<=
    survivalBestTime
  ){
    return;
  }

  survivalBestTime=
    value;

  try{
    localStorage.setItem(
      "vc_survival_best_v1",
      String(
        survivalBestTime
      )
    );
  }catch{}

  updatePhaseCounter();
}

function finishSurvivalGameOver(
  reason
){
  if(state.finished)return;

  state.finished=true;

  const survived=
    state.elapsed||0;

  state.result={
    title:"Fim da sobrevivência",
    text:
      `${reason} Tempo da equipe: ${formatSurvivalTime(survived)}`
  };

  recordSurvivalBest(
    survived
  );

  showEnd(
    state.result.title,
    state.result.text
  );

  setEndActions("none");

  if(
    gameMode==="online"&&
    role==="host"
  ){
    sendGame({
      type:"state",
      state:
        survivalStateForNetwork()
    });
  }
}

function eliminateSurvivalPlayer(
  player,
  reason
){
  if(
    !player||
    player.alive===false||
    state.finished
  ){
    return;
  }

  player.alive=false;
  player.eliminatedReason=
    reason;

  player.vx=0;
  player.vy=0;
  player.onGround=false;

  if(
    player.playerId===
    PLAYER_ID||
    (
      gameMode==="offline"&&
      player.id===1
    )
  ){
    $("gameMsg").textContent=
      "Você foi eliminado. Continue observando sua cor e ajude os sobreviventes.";
  }

  const alive=
    (state.players||[])
      .filter(
        candidate=>
          candidate.alive!==
          false
      );

  if(alive.length===0){
    finishSurvivalGameOver(
      "Todos os jogadores foram eliminados."
    );
  }
}

function applySurvivalHazardPush(
  player,
  hazard
){
  if(
    !overlap(
      player,
      hazard
    )
  ){
    return;
  }

  const platform=
    SURVIVAL_ARENA.platform;

  if(hazard.color==="blue"){
    eliminateSurvivalPlayer(
      player,
      "tocou no bloco azul mortal"
    );

    return;
  }

  if(hazard.direction==="leftToRight"){
    player.x=
      hazard.x+
      hazard.w+
      0.5;

    player.vx=
      Math.max(
        player.vx,
        hazard.vx
      );

    return;
  }

  if(hazard.direction==="rightToLeft"){
    player.x=
      hazard.x-
      player.w-
      0.5;

    player.vx=
      Math.min(
        player.vx,
        hazard.vx
      );

    return;
  }

  if(hazard.direction==="topToBottom"){
    const pushedY=
      hazard.y+
      hazard.h+
      0.5;

    /*
      Se não há espaço entre o obstáculo e a plataforma,
      o jogador foi prensado.
    */
    if(
      playerOverPlatform(player)&&
      pushedY+
      player.h>=
      platform.y-
      1
    ){
      eliminateSurvivalPlayer(
        player,
        "foi prensado contra a plataforma"
      );

      return;
    }

    player.y=
      pushedY;

    player.vy=
      Math.max(
        player.vy,
        hazard.vy
      );

    return;
  }

  if(hazard.direction==="bottomToTop"){
    player.y=
      hazard.y-
      player.h-
      0.5;

    player.vy=
      Math.min(
        player.vy,
        hazard.vy
      );

    if(
      player.y<=
      SURVIVAL_ARENA.ceilingY
    ){
      eliminateSurvivalPlayer(
        player,
        "foi prensado contra o teto"
      );
    }
  }
}

function updateSurvivalPlayer(
  player,
  input,
  dt
){
  if(
    player.alive===false||
    state.finished
  ){
    return;
  }

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
    player.jumpLock=true;
  }

  if(!input.jump){
    player.jumpLock=false;
  }

  player.vy+=
    GRAVITY*
    dt;

  player.x+=
    player.vx*
    dt;

  const previousBottom=
    player.y+
    player.h;

  player.y+=
    player.vy*
    dt;

  resolveSurvivalPlatform(
    player,
    previousBottom
  );

  if(
    player.y<=
    SURVIVAL_ARENA.ceilingY
  ){
    eliminateSurvivalPlayer(
      player,
      "tocou no teto"
    );

    return;
  }

  for(
    const hazard
    of state.hazards
  ){
    applySurvivalHazardPush(
      player,
      hazard
    );

    if(state.finished)return;
  }

  /*
    Após ser empurrado para baixo, verificamos novamente
    a relação com a plataforma para detectar esmagamento.
  */
  if(
    playerOverPlatform(player)&&
    player.y+
    player.h>
    SURVIVAL_ARENA.platform.y+
    1
  ){
    eliminateSurvivalPlayer(
      player,
      "foi prensado contra a plataforma"
    );

    return;
  }

  if(
    player.y>
    WORLD.h+
    30
  ){
    eliminateSurvivalPlayer(
      player,
      "caiu da plataforma"
    );

    return;
  }

  /*
    Se saiu horizontalmente da plataforma, não há piso.
    A gravidade fará a queda normalmente.
  */
}

function updateSurvivalHazards(dt){
  for(
    const hazard
    of state.hazards
  ){
    hazard.age+=dt;
    hazard.x+=hazard.vx*dt;
    hazard.y+=hazard.vy*dt;
  }

  state.hazards=
    state.hazards.filter(
      hazard=>{
        if(
          hazard.direction==="leftToRight"
        ){
          return hazard.x<
            WORLD.w+
            100;
        }

        if(
          hazard.direction==="rightToLeft"
        ){
          return hazard.x+
            hazard.w>
            -100;
        }

        if(
          hazard.direction==="topToBottom"
        ){
          return hazard.y<
            WORLD.h+
            120;
        }

        return hazard.y+
          hazard.h>
          -120;
      }
    );
}

function survivalHostUpdate(dt){
  if(state.finished)return;

  state.elapsed+=dt;
  state.spawnTimer-=dt;

  const playerCount=
    Math.max(
      2,
      state.players?.length||
      2
    );

  if(
    state.spawnTimer<=0
  ){
    /*
      Mais jogadores permitem mais ameaças simultâneas,
      porém o crescimento é controlado.
    */
    const maxHazards=
      3+
      Math.min(
        7,
        Math.ceil(
          playerCount*.55
        )
      )+
      Math.min(
        4,
        Math.floor(
          state.elapsed/30
        )
      );

    if(
      state.hazards.length<
      maxHazards
    ){
      state.hazards.push(
        createSurvivalHazard(
          state
        )
      );
    }

    const difficulty=
      Math.min(
        1,
        state.elapsed/110
      );

    const groupPressure=
      Math.min(
        .28,
        Math.max(
          0,
          playerCount-2
        )*.018
      );

    state.spawnTimer=
      randomBetween(
        Math.max(
          .65,
          1.45-
          difficulty*.38-
          groupPressure
        ),
        Math.max(
          1.05,
          2.25-
          difficulty*.62-
          groupPressure
        )
      );
  }

  updateSurvivalHazards(
    dt
  );

  for(
    const player
    of state.players||[]
  ){
    if(state.finished)break;

    updateSurvivalPlayer(
      player,
      survivalInputForPlayer(
        player
      ),
      dt
    );
  }

  updateSurvivalTimer(
    state.elapsed
  );
}


function survivalHostUpdateDistributed(
  dt
){
  if(state.finished)return;

  state.elapsed+=dt;
  state.spawnTimer-=dt;

  const playerCount=
    Math.max(
      2,
      state.players?.length||
      2
    );

  syncDeterministicSurvivalHazards(
    state,
    state.elapsed
  );

  if(
    state.spawnTimer<=0
  ){
    const maxHazards=
      3+
      Math.min(
        7,
        Math.ceil(
          playerCount*.55
        )
      )+
      Math.min(
        4,
        Math.floor(
          state.elapsed/30
        )
      );

    if(
      state.hazards.length<
      maxHazards
    ){
      state.hazards.push(
        createSurvivalHazard(
          state
        )
      );

      syncDeterministicSurvivalHazards(
        state,
        state.elapsed
      );
    }

    const difficulty=
      Math.min(
        1,
        state.elapsed/110
      );

    const groupPressure=
      Math.min(
        .28,
        Math.max(
          0,
          playerCount-2
        )*.018
      );

    state.spawnTimer=
      randomBetween(
        Math.max(
          .65,
          1.45-
          difficulty*.38-
          groupPressure
        ),
        Math.max(
          1.05,
          2.25-
          difficulty*.62-
          groupPressure
        )
      );
  }

  /*
    O Host simula somente o próprio personagem.
  */
  const localPlayer=
    state.players?.find(
      player=>
        player.playerId===
        PLAYER_ID
    );

  if(
    localPlayer&&
    localPlayer.alive!==
    false
  ){
    updateSurvivalPlayer(
      localPlayer,
      hostInput(),
      dt
    );
  }

  updateSurvivalTimer(
    state.elapsed
  );
}

function resetSurvival(
  broadcast=false
){
  state=
    newSurvivalState(
      gameMode==="online"
        ?activeMatchRoster
        :undefined
    );

  remoteState=
    newSurvivalState(
      gameMode==="online"
        ?activeMatchRoster
        :undefined
    );

  setSurvivalClockAnchor(0);
  survivalValidationByPlayer.clear();
  survivalDistributedSeq=0;
  survivalDistributedSendAccumulator=0;

  if(
    gameMode==="online"&&
    role==="client"
  ){
    initializeLocalDistributedSurvivalPlayer();
  }

  hideEnd();
  setEndActions("none");
  updateSurvivalTimer(0);

  if(
    broadcast&&
    gameMode==="online"
  ){
    sendGame({
      type:"restart"
    });
  }
}

function drawSurvivalWorld(
  renderCtx,
  renderCanvas,
  drawState,
  viewer
){
  const scale=
    Math.min(
      renderCanvas.width/WORLD.w,
      renderCanvas.height/WORLD.h
    );

  const ox=
    (
      renderCanvas.width-
      WORLD.w*scale
    )/2;

  const oy=
    (
      renderCanvas.height-
      WORLD.h*scale
    )/2;

  renderCtx.clearRect(
    0,
    0,
    renderCanvas.width,
    renderCanvas.height
  );

  renderCtx.save();
  renderCtx.translate(ox,oy);
  renderCtx.scale(scale,scale);

  renderCtx.fillStyle="#161e2b";
  renderCtx.fillRect(
    0,0,
    WORLD.w,
    WORLD.h
  );

  renderCtx.strokeStyle=
    "rgba(255,255,255,.035)";

  for(
    let x=0;
    x<=WORLD.w;
    x+=50
  ){
    renderCtx.beginPath();
    renderCtx.moveTo(x,0);
    renderCtx.lineTo(x,WORLD.h);
    renderCtx.stroke();
  }

  /*
    Teto mortal.
  */
  renderCtx.fillStyle=
    "rgba(255,80,90,.22)";

  renderCtx.fillRect(
    0,
    0,
    WORLD.w,
    SURVIVAL_ARENA.ceilingY
  );

  renderCtx.strokeStyle="#ff5b68";
  renderCtx.lineWidth=5;

  renderCtx.beginPath();
  renderCtx.moveTo(
    0,
    SURVIVAL_ARENA.ceilingY
  );
  renderCtx.lineTo(
    WORLD.w,
    SURVIVAL_ARENA.ceilingY
  );
  renderCtx.stroke();

  /*
    Plataforma neutra compartilhada.
  */
  const platform=
    SURVIVAL_ARENA.platform;

  renderCtx.fillStyle="#8b96a8";

  renderCtx.fillRect(
    platform.x,
    platform.y,
    platform.w,
    platform.h
  );

  renderCtx.strokeStyle="#d9e0ea";
  renderCtx.lineWidth=4;

  renderCtx.strokeRect(
    platform.x,
    platform.y,
    platform.w,
    platform.h
  );

  for(
    const hazard
    of (
      drawState.hazards||
      []
    )
  ){
    const dynamicVision=
      gameMode==="online"&&
      activeMatchRoster.length>=2;

    const visible=
      hazard.color==="blue"||
      (
        dynamicVision&&
        Number(
          hazard.ownerSlot
        )===
        Number(
          viewer
        )
      )||
      (
        !dynamicVision&&
        viewer===1&&
        hazard.color==="yellow"
      )||
      (
        !dynamicVision&&
        viewer===2&&
        hazard.color==="red"
      );

    if(!visible){
      continue;
    }

    renderCtx.fillStyle=
      hazard.color==="blue"
        ?"#3995ff"
        :dynamicVision
          ?(
              hazard.displayColor||
              playerColorForSlot(
                hazard.ownerSlot
              )
            )
          :hazard.color==="yellow"
            ?"#f2ca3c"
            :"#e8515e";

    renderCtx.fillRect(
      hazard.x,
      hazard.y,
      hazard.w,
      hazard.h
    );

    renderCtx.strokeStyle=
      hazard.color==="blue"
        ?"#a9d2ff"
        :dynamicVision
          ?(
              hazard.displayStroke||
              playerStrokeForSlot(
                hazard.ownerSlot
              )
            )
          :hazard.color==="yellow"
            ?"#fff0a0"
            :"#ff9aa4";

    renderCtx.lineWidth=3;

    renderCtx.strokeRect(
      hazard.x,
      hazard.y,
      hazard.w,
      hazard.h
    );

    renderCtx.fillStyle=
      hazard.color==="blue"
        ?"#e7f4ff"
        :"rgba(0,0,0,.6)";

    renderCtx.font=
      "bold 18px Arial";

    const arrow=
      hazard.color==="blue"
        ?"✕"
        :hazard.direction==="leftToRight"
          ?"→"
          :hazard.direction==="rightToLeft"
            ?"←"
            :hazard.direction==="topToBottom"
              ?"↓"
              :"↑";

    renderCtx.fillText(
      arrow,
      hazard.x+
      hazard.w/2-
      6,
      hazard.y+
      Math.min(
        hazard.h-8,
        24
      )
    );
  }

  for(
    const player
    of (
      drawState.players||
      []
    )
  ){
    const slot=
      gameMode==="online"
        ?Number(
            player.slot
          )||0
        :Math.max(
            0,
            (
              Number(
                player.id
              )||1
            )-
            1
          );

    CharacterSystem.drawPlayer(
      renderCtx,
      player,
      {
        slot,
        characterId:
          player.characterId,
        label:
          `P${slot+1}`
      }
    );
  }

  renderCtx.restore();
}

function drawSurvival(){
  let drawState;

  if(
    gameMode==="offline"
  ){
    drawState=state;
  }else if(
    role==="host"
  ){
    syncDeterministicSurvivalHazards(
      state,
      state.elapsed||
      0
    );

    drawState=
      distributedSurvivalHostRenderState();
  }else{
    syncDeterministicSurvivalHazards(
      remoteState,
      currentSurvivalClock()
    );

    drawState=
      distributedSurvivalRenderState();
  }

  const elapsed=
    gameMode==="online"&&
    role==="client"
      ?currentSurvivalClock()
      :drawState?.elapsed||
        0;

  updateSurvivalTimer(
    elapsed
  );

  if(
    gameMode==="offline"
  ){
    drawSurvivalWorld(
      offlineCtxP1,
      offlineCanvasP1,
      drawState,
      1
    );

    drawSurvivalWorld(
      offlineCtxP2,
      offlineCanvasP2,
      drawState,
      2
    );

    return;
  }

  drawSurvivalWorld(
    ctx,
    canvas,
    drawState,
    Number(
      myRoomSlot??
      0
    )
  );
}
