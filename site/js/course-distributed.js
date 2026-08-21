let courseHostRenderStateRef=null;

function setCourseClockAnchor(elapsed=0){
  courseClockAnchorElapsed=Math.max(0,Number(elapsed)||0);
  courseClockAnchorPerf=performance.now();
}

function currentCourseClock(){
  if(gameMode!=="online"||gameType!=="course"){
    return Number(state?.elapsed||0);
  }

  if(role==="host"){
    return Number(state?.elapsed||0);
  }

  return Math.max(
    0,
    courseClockAnchorElapsed+
    (performance.now()-courseClockAnchorPerf)/1000
  );
}

function ensureRuntimeBlocks(gameState){
  if(!gameState)return[];

  if(
    !Array.isArray(gameState.runtimeBlocks)||
    gameState.runtimeBlocks.length!==blocks.length
  ){
    gameState.runtimeBlocks=createRuntimeBlocks();
  }

  return gameState.runtimeBlocks;
}

function deterministicBlockAtTime(block,elapsed){
  const next={
    ...block,
    x:Number(block.baseX??block.x)||0,
    y:Number(block.baseY??block.y)||0,
    active:true,
    timeToToggle:null
  };

  const behavior=block.behavior;

  if(behavior?.type==="moving"){
    const range=Math.max(1,Number(behavior.range||40));
    const speed=Math.max(1,Number(behavior.speed||40));
    const period=(4*range)/speed;
    const phase=Number(behavior.phase||0);
    const wave=triangleWave(elapsed/period+phase);
    const offset=wave*range;

    if(behavior.axis==="y"){
      next.y+=offset;
    }else{
      next.x+=offset;
    }
  }

  if(behavior?.type==="blink"){
    const period=Math.max(.1,Number(behavior.period||10));
    const visibleFor=clamp(
      Number(behavior.visibleFor||5),
      0,
      period
    );
    const phase=Number(behavior.phase||0);
    const time=(elapsed+phase)%period;

    next.active=time<visibleFor;
    next.timeToToggle=next.active
      ?visibleFor-time
      :period-time;
  }

  return next;
}

function syncDeterministicCourseWorld(
  gameState,
  elapsed,
  carriedPlayers=[]
){
  if(!gameState)return;

  const runtime=ensureRuntimeBlocks(gameState);
  const byId=new Map();

  for(let index=0;index<runtime.length;index++){
    const oldBlock=runtime[index];
    const base={
      ...oldBlock,
      baseX:Number(
        oldBlock.baseX??
        blocks[index]?.x??
        oldBlock.x
      )||0,
      baseY:Number(
        oldBlock.baseY??
        blocks[index]?.y??
        oldBlock.y
      )||0
    };

    const next=deterministicBlockAtTime(base,elapsed);

    next.id=
      oldBlock.id||
      base.id||
      `block-${index}`;

    next.dx=Number(next.x-oldBlock.x)||0;
    next.dy=Number(next.y-oldBlock.y)||0;

    runtime[index]=next;
    byId.set(next.id,next);
  }

  for(const player of carriedPlayers||[]){
    if(
      !player||
      player.alive===false||
      !player.groundBlockId
    ){
      continue;
    }

    const ground=byId.get(player.groundBlockId);

    if(!ground||ground.active===false){
      player.groundBlockId=null;
      player.onGround=false;
      continue;
    }

    player.x+=ground.dx||0;
    player.y+=ground.dy||0;
  }

  gameState.elapsed=Number(elapsed)||0;
}

function courseStateForNetwork(){
  if(
    gameMode==="online"&&
    gameType==="course"&&
    state
  ){
    const {runtimeBlocks,...snapshot}=state;
    return snapshot;
  }

  return state;
}

function sanitizeDistributedPlayerState(player){
  return{
    x:Number(player.x)||0,
    y:Number(player.y)||0,
    vx:Number(player.vx)||0,
    vy:Number(player.vy)||0,
    onGround:!!player.onGround,
    groundBlockId:
      typeof player.groundBlockId==="string"
        ?player.groundBlockId
        :null,
    jumpLock:!!player.jumpLock
  };
}

function authoritativePlayerForId(playerId){
  return state.players?.find(
    player=>player.playerId===playerId
  )||null;
}

function initializeLocalDistributedPlayer(){
  if(
    gameMode!=="online"||
    gameType!=="course"||
    role!=="client"
  ){
    localDistributedPlayer=null;
    return;
  }

  const source=
    remoteState.players?.find(
      player=>player.playerId===PLAYER_ID
    )||
    state.players?.find(
      player=>player.playerId===PLAYER_ID
    );

  if(!source){
    localDistributedPlayer=null;
    return;
  }

  localDistributedPlayer={
    ...source
  };

  distributedStateSeq=0;
  distributedSendAccumulator=0;

  NetSmoothing.clearCorrection(
    "course-local"
  );

  NetSmoothing.clearScope(
    "course"
  );
}

function applyAuthoritativeCorrection(
  player
){
  if(
    !player||
    !localDistributedPlayer
  ){
    return;
  }

  // V9.1.1: somente a eliminação oficial é aplicada.
  if(player.alive===false){
    localDistributedPlayer.alive=false;
  }
}

function syncLocalPlayerWithWorldSnapshot(
  previousState,
  nextState
){
  if(
    !localDistributedPlayer||
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

  // Snapshot do Host não altera x/y/vx/vy do jogador local.
  if(official?.alive===false){
    localDistributedPlayer.alive=false;
  }
}

function distributedClientRenderState(){
  if(
    !remoteState||
    !localDistributedPlayer
  ){
    return remoteState;
  }

  const players=
    (remoteState.players||[]).map(
      player=>
        player.playerId===PLAYER_ID
          ?{...localDistributedPlayer}
          :player
    );

  return{
    ...remoteState,
    players:
      NetSmoothing.smoothRemotePlayers(
        "course",
        players,
        PLAYER_ID
      )
  };
}

function distributedHostRenderState(){
  if(!state){
    return state;
  }

  if(
    courseHostRenderStateRef!==
    state
  ){
    courseHostRenderStateRef=
      state;

    NetSmoothing.clearScope(
      "course-host"
    );
  }

  return{
    ...state,
    players:
      NetSmoothing.smoothRemotePlayers(
        "course-host",
        state.players||
        [],
        PLAYER_ID
      )
  };
}

function distributedCourseLocalDeathReason(
  player,
  gameState
){
  if(
    !player||
    player.alive===false
  ){
    return null;
  }

  if(
    touchedDeathBlock(
      player,
      gameState
    )
  ){
    return "tocou em um bloco azul mortal";
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
    return "encostou na borda do mundo";
  }

  return null;
}

function simulateDistributedCourseLocalPlayer(
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

  player.vx=direction*MOVE_SPEED;

  if(
    input.jump&&
    player.onGround&&
    !player.jumpLock
  ){
    player.vy=-JUMP_SPEED;
    player.onGround=false;
    player.groundBlockId=null;
    player.jumpLock=true;
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
}

function sendDistributedPlayerState(){
  if(
    role!=="client"||
    gameMode!=="online"||
    gameType!=="course"||
    !localDistributedPlayer||
    remoteState.finished
  ){
    return;
  }

  distributedStateSeq++;

  sendGame({
    type:"player-state",
    seq:distributedStateSeq,
    player:sanitizeDistributedPlayerState(
      localDistributedPlayer
    )
  });
}

function clientUpdateDistributedCourse(dt){
  if(
    !localDistributedPlayer||
    !remoteState||
    remoteState.finished
  ){
    return;
  }

  const official=
    remoteState.players?.find(
      player=>player.playerId===PLAYER_ID
    );

  syncDeterministicCourseWorld(
    remoteState,
    currentCourseClock(),
    [localDistributedPlayer]
  );

  if(official?.alive===false){
    localDistributedPlayer.alive=false;
    return;
  }

  simulateDistributedCourseLocalPlayer(
    localDistributedPlayer,
    clientInput(),
    dt,
    remoteState
  );

  const localDeathReason=
    distributedCourseLocalDeathReason(
      localDistributedPlayer,
      remoteState
    );

  if(localDeathReason){
    /*
      Enviamos a posição final ao Host antes de congelar localmente.
      WebSocket é confiável e o Host continua oficializando a morte.
    */
    sendDistributedPlayerState();

    localDistributedPlayer.alive=
      false;

    localDistributedPlayer.eliminatedReason=
      localDeathReason;

    localDistributedPlayer.vx=0;
    localDistributedPlayer.vy=0;
    localDistributedPlayer.onGround=false;
    localDistributedPlayer.groundBlockId=null;

    $("gameMsg").textContent=
      "Você foi eliminado. Modo espectador: continue ajudando a equipe com a sua visão.";

    return;
  }

  distributedSendAccumulator+=dt;

  if(
    distributedSendAccumulator>=
    1/30
  ){
    distributedSendAccumulator=0;
    sendDistributedPlayerState();
  }
}

function validateDistributedPlayerState(
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

  // Integridade mínima: impede NaN/Infinity de quebrar a simulação.
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
    distributedValidationByPlayer.get(
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

  // Sem limites de velocidade, distância ou aceleração.
  player.x=values[0];
  player.y=values[1];
  player.vx=values[2];
  player.vy=values[3];
  player.onGround=
    !!payload.onGround;
  player.groundBlockId=
    typeof payload.groundBlockId===
    "string"
      ?payload.groundBlockId
      :null;
  player.jumpLock=
    !!payload.jumpLock;

  distributedValidationByPlayer.set(
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

  evaluateDistributedCoursePlayer(
    player
  );

  return true;
}

function evaluateDistributedCoursePlayer(player){
  if(
    !player||
    player.alive===false||
    state.finished
  ){
    return;
  }

  if(touchedDeathBlock(player,state)){
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

  player.reached=overlap(
    player,
    goal
  );

  if(player.reached){
    finishMatch(
      "Equipe venceu!",
      `O Jogador ${(Number(player.slot)||0)+1} chegou à saída. Todos venceram.`,
      "victory"
    );
  }
}
