async function handleWebSocketGameMessage(
  message,
  fromPlayerId=null
){
  if(
    !message||
    typeof message!=="object"
  ){
    return;
  }

  const m=message;

  /*
    Character Plugin System.
    A escolha visual é sincronizada no lobby e depois via roster.
  */
  if(
    m.type==="character-roster"
  ){
    CharacterSystem.applyChoices(
      m.choices
    );

    if(
      typeof renderLobbyRoster===
      "function"
    ){
      renderLobbyRoster();
    }

    return;
  }

  if(
    m.type==="character-choice-sync"
  ){
    CharacterSystem.applyChoice(
      m.playerId,
      m.characterId
    );

    if(
      typeof renderLobbyRoster===
      "function"
    ){
      renderLobbyRoster();
    }

    return;
  }

  if(role==="host"){
    const peerId=
      String(
        fromPlayerId||
        ""
      );

    if(
      m.type==="character-choice"
    ){
      if(peerId){
        CharacterSystem.applyChoice(
          peerId,
          m.characterId
        );

        sendGame({
          type:
            "character-choice-sync",
          playerId:
            peerId,
          characterId:
            CharacterSystem.characterIdForPlayer(
              peerId,
              0,
              m.characterId
            )
        });

        if(
          typeof renderLobbyRoster===
          "function"
        ){
          renderLobbyRoster();
        }
      }

      return;
    }

    if(
      m.type==="mode-message"
    ){
      if(
        m.modeId!==gameType
      ){
        return;
      }

      ModeSystem.hostMessage(
        m.payload,
        peerId
      );

      return;
    }

    if(m.type==="hello"){
      if(peerId){
        remoteInputsByPlayer.set(
          peerId,
          {
            left:false,
            right:false,
            jump:false
          }
        );
      }

      return;
    }

    if(m.type==="player-state"){
      if(peerId){
        if(gameType==="course"){
          validateDistributedPlayerState(
            peerId,
            m.player,
            m.seq
          );
        }else if(
          gameType==="survival"
        ){
          validateDistributedSurvivalPlayerState(
            peerId,
            m.player,
            m.seq
          );
        }
      }

      return;
    }

    if(m.type==="input"){
      /*
        Mantido apenas para compatibilidade com clientes antigos.
        Na V8.6, o Modo Sobrevivência usa player-state distribuído.
      */
      if(peerId){
        remoteInputsByPlayer.set(
          peerId,
          m.input||{
            left:false,
            right:false,
            jump:false
          }
        );
      }

      return;
    }

    if(m.type==="restart_request"){
      if(gameType==="survival"){
        resetSurvival(true);
      }else{
        resetMatch(true);
      }

      return;
    }

    return;
  }

  /*
    CLIENTE
  */
  if(
    m.type==="mode-message"
  ){
    if(
      m.modeId!==gameType
    ){
      return;
    }

    ModeSystem.clientMessage(
      m.payload
    );

    return;
  }

  if(m.type==="session"){
    transportMode=
      m.transport||
      "websocket";

    gameType=
      m.gameType||
      "course";

    activeMatchRoster=
      Array.isArray(
        m.roster
      )
        ?m.roster
        :activeMatchRoster;

    CharacterSystem.applyRoster(
      activeMatchRoster
    );

    const me=
      activeMatchRoster.find(
        player=>
          player.playerId===
          PLAYER_ID
      );

    myRoomSlot=
      me?.slot??
      myRoomSlot;

    document.body.className=
      ModeSystem.bodyClassFor(
        gameType,
        role==="client"
          ?"role-client"
          :""
      );

    if(
      ModeSystem.clientSession(
        m
      )
    ){
      return;
    }

    if(
      gameType==="survival"&&
      !gameStarted
    ){
      state=
        newSurvivalState(
          activeMatchRoster
        );

      remoteState=
        newSurvivalState(
          activeMatchRoster
        );

      setSurvivalClockAnchor(0);
      initializeLocalDistributedSurvivalPlayer();

      gameStarted=true;

      startGame();
    }

    return;
  }

  if(m.type==="map"){
    transportMode="websocket";
    gameType="course";

    activeMatchRoster=
      Array.isArray(
        m.roster
      )
        ?m.roster
        :activeMatchRoster;

    CharacterSystem.applyRoster(
      activeMatchRoster
    );

    const me=
      activeMatchRoster.find(
        player=>
          player.playerId===
          PLAYER_ID
      );

    myRoomSlot=
      me?.slot??
      myRoomSlot;

    applyMap(
      m.map
    );

    state=
      newOnlineMultiplayerState(
        activeMatchRoster
      );

    remoteState=
      newOnlineMultiplayerState(
        activeMatchRoster
      );

    initializeLocalDistributedPlayer();
    setCourseClockAnchor(0);
    syncDeterministicCourseWorld(remoteState,0,[]);

    hideEnd();

    if(!gameStarted){
      gameStarted=true;
      startGame();
    }

    return;
  }

  if(m.type==="state"){
    if(
      !m.state||
      typeof m.state!=="object"
    ){
      return;
    }

    const previousRemoteState=
      remoteState;

    remoteState=
      m.state;

    /*
      V9.1.2:
      snapshots voltam a sincronizar apenas estados OFICIAIS
      (morte, vitória, game over e relógio).
      x/y/vx/vy do jogador local continuam livres.
    */
    if(gameType==="course"){
      syncLocalPlayerWithWorldSnapshot(
        previousRemoteState,
        remoteState
      );

      const officialElapsed=
        Number(
          remoteState.elapsed
        );

      if(
        Number.isFinite(
          officialElapsed
        )
      ){
        const drift=
          Math.abs(
            officialElapsed-
            currentCourseClock()
          );

        if(drift>.20){
          setCourseClockAnchor(
            officialElapsed
          );
        }
      }
    }else if(
      gameType==="survival"
    ){
      syncLocalSurvivalWithSnapshot(
        remoteState
      );

      const officialElapsed=
        Number(
          remoteState.elapsed
        );

      if(
        Number.isFinite(
          officialElapsed
        )
      ){
        const drift=
          Math.abs(
            officialElapsed-
            currentSurvivalClock()
          );

        if(drift>.20){
          setSurvivalClockAnchor(
            officialElapsed
          );
        }
      }
    }

    updateLocalSpectatorStatus();

    if(
      remoteState.finished&&
      remoteState.result
    ){
      showEnd(
        remoteState.result.title,
        remoteState.result.text
      );
    }

    return;
  }

  if(m.type==="player-correction"){
    // V9.1.1: nenhuma correção de movimento é aplicada.
    return;
  }

  if(m.type==="restart"){
    if(gameType==="survival"){
      remoteState=
        newSurvivalState(
          activeMatchRoster
        );

      state=
        newSurvivalState(
          activeMatchRoster
        );

      setSurvivalClockAnchor(0);
      initializeLocalDistributedSurvivalPlayer();

      updateSurvivalTimer(0);
    }else{
      remoteState=
        newOnlineMultiplayerState(
          activeMatchRoster
        );

      state=
        newOnlineMultiplayerState(
          activeMatchRoster
        );

      initializeLocalDistributedPlayer();
    }

    hideEnd();
    return;
  }
}

function bindDataChannel(ch,peerId=null){
  if(role==="host"){
    hostChannels.set(peerId,ch);
  }else{
    channel=ch;
  }

  ch.onopen=()=>{
    if(role==="client"){
      sendGame({
        type:"hello",
        playerId:PLAYER_ID
      });
      $("lobbyMessage").textContent=
        "P2P conectado. Aguardando a configuração da partida...";
    }else{
      const opened=
        openMatchChannelIds();

      const total=
        activeClientIds().length;

      $("lobbyMessage").textContent=
        `Conexões P2P prontas: ${opened.length}/${total}.`;

      updateMatchStartProgress();
      maybeStartHostMatch();
    }
  };

  ch.onclose=()=>{
    if(role==="host"){
      hostChannels.delete(
        peerId
      );

      updateMatchStartProgress();
    }else{
      $("netText").textContent=
        "P2P desconectado";
    }
  };

  ch.onmessage=async e=>{
    let m;
    try{
      m=JSON.parse(e.data);
    }catch{
      return;
    }

    if(role==="host"){
      if(m.type==="hello"){
        remoteInputsByPlayer.set(peerId,{
          left:false,
          right:false,
          jump:false
        });

        sendGame({
          type:"session",
          gameType,
          roster:activeMatchRoster
        },peerId);

        await maybeStartHostMatch();
        return;
      }

      if(m.type==="input"){
        if(gameType==="survival"){
          remoteInput=m.input;
        }else{
          remoteInputsByPlayer.set(peerId,m.input);
        }
        return;
      }

      if(m.type==="restart_request"){
        if(gameType==="survival"){
          resetSurvival(true);
        }else{
          resetMatch(true);
        }
        return;
      }
    }else{
      if(m.type==="session"){
        gameType=m.gameType||"course";
        activeMatchRoster=Array.isArray(m.roster)?m.roster:activeMatchRoster;

        const me=activeMatchRoster.find(
          player=>player.playerId===PLAYER_ID
        );
        myRoomSlot=me?.slot??myRoomSlot;

        document.body.className=
          ModeSystem.bodyClassFor(
            gameType,
            "role-client"
          );

        if(
          ModeSystem.clientSession(
            m
          )
        ){
          return;
        }

        if(gameType==="survival"&&!gameStarted){
          state=newSurvivalState();
          remoteState=newSurvivalState();
          gameStarted=true;
          startGame();
        }
        return;
      }

      if(m.type==="map"){
        gameType="course";
        activeMatchRoster=Array.isArray(m.roster)?m.roster:activeMatchRoster;

        const me=activeMatchRoster.find(
          player=>player.playerId===PLAYER_ID
        );
        myRoomSlot=me?.slot??myRoomSlot;

        applyMap(m.map);
        state=newOnlineMultiplayerState(activeMatchRoster);
        remoteState=newOnlineMultiplayerState(activeMatchRoster);
        hideEnd();

        if(!gameStarted){
          gameStarted=true;
          startGame();
        }
        return;
      }

      if(m.type==="state"){
        remoteState=m.state;
        updateLocalSpectatorStatus();

        if(remoteState.finished&&remoteState.result){
          showEnd(
            remoteState.result.title,
            remoteState.result.text
          );
        }
        return;
      }

      if(m.type==="restart"){
        if(gameType==="survival"){
          remoteState=newSurvivalState(activeMatchRoster);
          state=newSurvivalState(activeMatchRoster);
          updateSurvivalTimer(0);
        }else{
          remoteState=newOnlineMultiplayerState(activeMatchRoster);
          state=newOnlineMultiplayerState(activeMatchRoster);
        }
        hideEnd();
        return;
      }
    }
  };
}

function cleanupRTC(){
  try{channel?.close()}catch{}
  try{pc?.close()}catch{}
  channel=null;
  pc=null;

  for(const peerId of [...hostPeerConnections.keys()]){
    closeHostPeer(peerId);
  }

  hostPeerConnections.clear();
  hostChannels.clear();
  hostPendingIce.clear();
  clientPendingIce=[];
  remoteInputsByPlayer.clear();
  distributedValidationByPlayer.clear();
  localDistributedPlayer=null;
  distributedStateSeq=0;
  distributedSendAccumulator=0;

  survivalValidationByPlayer.clear();
  localDistributedSurvivalPlayer=null;
  survivalDistributedSeq=0;
  survivalDistributedSendAccumulator=0;
  matchStarting=false;
  stopMatchStartWatch();
}

function sendGame(o,targetId=null){
  /*
    V8.1.2:
    Todo multiplayer online usa o WebSocket da sala como transporte
    autoritativo. WebRTC permanece no arquivo apenas para compatibilidade
    e testes futuros, mas não é necessário para iniciar a partida.
  */
  if(
    gameMode==="online"&&
    transportMode==="websocket"
  ){
    const packet={
      type:"game-relay",
      payload:o
    };

    if(targetId){
      packet.to=
        targetId;
    }

    signalSend(
      packet
    );

    return;
  }

  /*
    Caminho legado WebRTC.
  */
  const payload=
    JSON.stringify(o);

  if(role==="host"){
    if(targetId){
      const ch=
        hostChannels.get(
          targetId
        );

      if(
        ch?.readyState===
        "open"
      ){
        ch.send(
          payload
        );
      }

      return;
    }

    for(
      const ch
      of hostChannels.values()
    ){
      if(
        ch.readyState===
        "open"
      ){
        ch.send(
          payload
        );
      }
    }

    return;
  }

  if(
    channel&&
    channel.readyState===
    "open"
  ){
    channel.send(
      payload
    );
  }
}
