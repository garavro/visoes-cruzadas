(function(L){
  "use strict";

  const STORAGE_BEST=
    "vc_lava_best_height_v1";

  const STORAGE_RANKING=
    "vc_lava_ranking_v1";

  L.runtime={
    started:false,
    seed:null,
    world:null,
    localPlayer:null,
    state:null,
    clockElapsed:0,
    clockPerf:performance.now(),
    seq:0,
    sendAccumulator:0,
    snapshotAccumulator:0,
    validation:new Map(),
    resultRecorded:false,

    currentElapsed(){
      if(
        gameMode==="offline"||
        role==="host"
      ){
        return Number(
          this.state?.elapsed||
          0
        );
      }

      return Math.max(
        0,
        this.clockElapsed+
        (
          performance.now()-
          this.clockPerf
        )/
        1000
      );
    },

    setClock(elapsed){
      this.clockElapsed=
        Math.max(
          0,
          Number(elapsed)||0
        );

      this.clockPerf=
        performance.now();
    },

    renderState(){
      if(
        gameMode!=="online"||
        role==="host"
      ){
        return this.state;
      }

      if(
        !this.state||
        !this.localPlayer
      ){
        return this.state;
      }

      return{
        ...this.state,
        players:
          (
            this.state.players||
            []
          ).map(
            player=>
              player.playerId===
              PLAYER_ID
                ?{
                    ...this.localPlayer
                  }
                :player
          )
      };
    }
  };

  L.makeSeed=function(){
    return(
      "LAVA-"+
      Date.now()
        .toString(36)
        .toUpperCase()+
      "-"+
      Math.random()
        .toString(36)
        .slice(2,8)
        .toUpperCase()
    );
  };

  L.createState=function(
    seed,
    roster,
    offline=false
  ){
    const players=
      L.createPlayers(
        roster,
        offline
      );

    return{
      mode:"lava",
      version:L.VERSION,
      seed,
      elapsed:0,
      players,
      maxHeight:L.START_Y,
      finished:false,
      result:null,
      playerCount:
        players.length
    };
  };

  L.readRanking=function(){
    try{
      const parsed=
        JSON.parse(
          localStorage.getItem(
            STORAGE_RANKING
          )||
          "[]"
        );

      return Array.isArray(
        parsed
      )
        ?parsed
        :[];
    }catch{
      return[];
    }
  };

  L.readBestHeight=function(){
    const ranking=
      L.readRanking();

    return Math.max(
      Number(
        localStorage.getItem(
          STORAGE_BEST
        )
      )||0,
      ...ranking.map(
        item=>
          Number(
            item.height
          )||0
      ),
      0
    );
  };

  L.recordResult=function(
    finalState
  ){
    if(
      L.runtime.resultRecorded||
      !finalState
    ){
      return;
    }

    L.runtime.resultRecorded=true;

    const height=
      L.altitudeMeters(
        finalState.maxHeight||
        L.START_Y
      );

    const result={
      height:
        Number(
          height.toFixed(2)
        ),
      time:
        Number(
          finalState.elapsed||
          0
        ),
      players:
        Number(
          finalState.playerCount||
          finalState.players?.length||
          2
        ),
      date:
        new Date()
          .toISOString()
    };

    const ranking=
      L.readRanking();

    ranking.push(
      result
    );

    ranking.sort(
      (a,b)=>
        b.height-
        a.height||
        b.time-
        a.time
    );

    const top=
      ranking.slice(
        0,
        10
      );

    try{
      localStorage.setItem(
        STORAGE_RANKING,
        JSON.stringify(
          top
        )
      );

      localStorage.setItem(
        STORAGE_BEST,
        String(
          Math.max(
            height,
            L.readBestHeight()
          )
        )
      );
    }catch{}
  };

  L.showRanking=function(
    finalState
  ){
    const ui=
      L.ensureUI();

    const ranking=
      L.readRanking()
        .slice(
          0,
          5
        );

    ui.ranking.classList.remove(
      "hidden"
    );

    ui.ranking.innerHTML=
      "<b>Ranking local — Top 5</b><br>"+
      (
        ranking.length
          ?ranking.map(
              (
                item,
                index
              )=>
                `${index+1}. ${Number(item.height).toFixed(1)} m · ${formatSurvivalTime(item.time)} · ${item.players} jogador(es)`
            ).join(
              "<br>"
            )
          :"Nenhum recorde salvo."
      );
  };

  L.hideRanking=function(){
    const ranking=
      document.getElementById(
        "lavaRanking"
      );

    if(ranking){
      ranking.classList.add(
        "hidden"
      );

      ranking.innerHTML="";
    }
  };

  L.startRuntime=function(
    {
      seed,
      roster,
      offline=false,
      client=false
    }
  ){
    L.runtime.seed=seed;

    L.runtime.world=
      L.createWorld(
        seed,
        offline
          ?2
          :roster.length
      );

    L.ensureWorld(
      L.runtime.world,
      1600
    );

    L.runtime.state=
      L.createState(
        seed,
        roster,
        offline
      );

    state=
      L.runtime.state;

    remoteState=
      L.runtime.state;

    L.runtime.validation.clear();
    L.runtime.seq=0;
    L.runtime.sendAccumulator=0;
    L.runtime.snapshotAccumulator=0;
    L.runtime.resultRecorded=false;
    L.runtime.setClock(0);

    if(client){
      L.runtime.localPlayer={
        ...L.runtime.state.players.find(
          player=>
            player.playerId===
            PLAYER_ID
        )
      };
    }else{
      L.runtime.localPlayer=null;
    }

    L.runtime.started=true;
    gameStarted=true;

    L.hideRanking();
    L.configureGameUI();
  };

  L.snapshot=function(){
    return{
      type:"snapshot",
      version:L.VERSION,
      seed:
        L.runtime.state.seed,
      elapsed:
        L.runtime.state.elapsed,
      maxHeight:
        L.runtime.state.maxHeight,
      playerCount:
        L.runtime.state.playerCount,
      finished:
        L.runtime.state.finished,
      result:
        L.runtime.state.result,
      players:
        L.runtime.state.players.map(
          player=>({
            id:player.id,
            playerId:
              player.playerId,
            slot:player.slot,
            characterId:
              player.characterId||
              CharacterSystem.characterIdForPlayer(
                player.playerId,
                player.slot
              ),
            connected:
              player.connected!==
              false,
            alive:
              player.alive!==
              false,
            eliminatedReason:
              player.eliminatedReason||
              null,
            x:player.x,
            y:player.y,
            w:player.w,
            h:player.h,
            vx:player.vx,
            vy:player.vy,
            onGround:
              !!player.onGround,
            jumpLock:
              !!player.jumpLock,
            groundPlatformId:
              player.groundPlatformId||
              null,
            maxY:
              player.maxY||
              L.START_Y
          })
        )
    };
  };

  L.broadcastSnapshot=function(){
    if(
      role!=="host"||
      gameMode!=="online"
    ){
      return;
    }

    ModeSystem
      .context()
      .sendMode(
        L.snapshot()
      );
  };

  L.findPlayer=function(
    playerId
  ){
    return L.runtime.state?.players?.find(
      player=>
        player.playerId===
        playerId
    )||null;
  };

  L.eliminate=function(
    player,
    reason
  ){
    if(
      !player||
      player.alive===
      false||
      L.runtime.state.finished
    ){
      return;
    }

    player.alive=false;
    player.eliminatedReason=
      reason;

    player.vx=0;
    player.vy=0;
    player.onGround=false;
    player.groundPlatformId=null;

    if(
      player.playerId===
      PLAYER_ID
    ){
      document
        .getElementById(
          "gameMsg"
        )
        .textContent=
          "Você caiu na lava. Continue observando as plataformas da sua cor e ajude a equipe.";
    }

    L.finishIfAllDead();
  };

  L.finishIfAllDead=function(){
    const s=
      L.runtime.state;

    if(
      !s||
      s.finished
    ){
      return false;
    }

    const alive=
      s.players.filter(
        player=>
          player.alive!==
          false
      );

    if(alive.length){
      return false;
    }

    s.finished=true;

    const height=
      L.altitudeMeters(
        s.maxHeight
      );

    s.result={
      title:"LAVA — Fim da subida",
      text:
        `A equipe alcançou ${height.toFixed(1)} m em ${formatSurvivalTime(s.elapsed)}.`
    };

    L.recordResult(
      s
    );

    showEnd(
      s.result.title,
      s.result.text
    );

    setEndActions(
      "none"
    );

    L.showRanking(
      s
    );

    if(
      gameMode==="online"&&
      role==="host"
    ){
      L.broadcastSnapshot();
    }

    return true;
  };

  L.updateTeamHeight=function(){
    const s=
      L.runtime.state;

    for(
      const player
      of s.players
    ){
      player.maxY=
        Math.max(
          Number(
            player.maxY
          )||
          L.START_Y,
          Number(
            player.y
          )||
          L.START_Y
        );

      s.maxHeight=
        Math.max(
          Number(
            s.maxHeight
          )||
          L.START_Y,
          player.maxY
        );
    }
  };

  L.checkDeaths=function(
    elapsed
  ){
    const s=
      L.runtime.state;

    for(
      const player
      of s.players
    ){
      if(
        player.alive===
        false
      ){
        continue;
      }

      const reason=
        L.deathReason(
          player,
          s,
          L.runtime.world,
          elapsed
        );

      if(reason){
        L.eliminate(
          player,
          reason
        );
      }
    }
  };

  L.hostInputForLocal=function(){
    return hostInput();
  };

  L.clientInputForLocal=function(){
    return clientInput();
  };

  L.offlineInputFor=function(
    slot
  ){
    return slot===0
      ?hostInput()
      :clientInput();
  };

  L.hostUpdate=function(
    dt
  ){
    const s=
      L.runtime.state;

    if(
      !s||
      s.finished
    ){
      return;
    }

    s.elapsed+=dt;

    const highest=
      Math.max(
        s.maxHeight,
        ...s.players.map(
          player=>player.y
        )
      );

    L.ensureWorld(
      L.runtime.world,
      highest+
      1250
    );

    const local=
      s.players.find(
        player=>
          player.playerId===
          PLAYER_ID
      );

    if(
      local&&
      local.alive!==
      false
    ){
      L.simulatePlayer(
        local,
        L.hostInputForLocal(),
        dt,
        s,
        L.runtime.world,
        s.elapsed
      );
    }

    L.updateTeamHeight();
    L.checkDeaths(
      s.elapsed
    );

    L.trimWorld(
      L.runtime.world,
      L.lavaHeight(
        s.elapsed
      )
    );

    L.runtime.snapshotAccumulator+=
      dt;

    if(
      L.runtime.snapshotAccumulator>=
      .10
    ){
      L.runtime.snapshotAccumulator=0;
      L.broadcastSnapshot();
    }
  };

  L.clientUpdate=function(
    dt
  ){
    const s=
      L.runtime.state;

    if(
      !s||
      s.finished||
      !L.runtime.localPlayer
    ){
      return;
    }

    const elapsed=
      L.runtime.currentElapsed();

    const official=
      s.players.find(
        player=>
          player.playerId===
          PLAYER_ID
      );

    if(
      official?.alive===
      false
    ){
      L.runtime.localPlayer.alive=
        false;

      return;
    }

    const highest=
      Math.max(
        s.maxHeight,
        L.runtime.localPlayer.y
      );

    L.ensureWorld(
      L.runtime.world,
      highest+
      1250
    );

    L.simulatePlayer(
      L.runtime.localPlayer,
      L.clientInputForLocal(),
      dt,
      s,
      L.runtime.world,
      elapsed
    );

    /*
      A morte local é apenas uma previsão visual.
      O Host ainda decide oficialmente.
    */
    if(
      L.deathReason(
        L.runtime.localPlayer,
        s,
        L.runtime.world,
        elapsed
      )
    ){
      L.runtime.localPlayer.alive=
        false;
    }

    L.runtime.sendAccumulator+=
      dt;

    if(
      L.runtime.sendAccumulator>=
      .05
    ){
      L.runtime.sendAccumulator=0;
      L.runtime.seq++;

      ModeSystem
        .context()
        .sendMode({
          type:"player-state",
          seq:L.runtime.seq,
          player:
            L.sanitizePlayer(
              L.runtime.localPlayer
            )
        });
    }
  };

  L.offlineUpdate=function(
    dt
  ){
    const s=
      L.runtime.state;

    if(
      !s||
      s.finished
    ){
      return;
    }

    s.elapsed+=dt;

    const highest=
      Math.max(
        s.maxHeight,
        ...s.players.map(
          player=>player.y
        )
      );

    L.ensureWorld(
      L.runtime.world,
      highest+
      1250
    );

    for(
      const player
      of s.players
    ){
      if(
        player.alive===
        false
      ){
        continue;
      }

      L.simulatePlayer(
        player,
        L.offlineInputFor(
          Number(
            player.slot
          )||0
        ),
        dt,
        s,
        L.runtime.world,
        s.elapsed
      );
    }

    L.updateTeamHeight();
    L.checkDeaths(
      s.elapsed
    );

    L.trimWorld(
      L.runtime.world,
      L.lavaHeight(
        s.elapsed
      )
    );
  };

  L.validateRemoteState=function(
    playerId,
    message
  ){
    const s=
      L.runtime.state;

    const player=
      L.findPlayer(
        playerId
      );

    if(
      !player||
      player.alive===
      false||
      s.finished||
      !message?.player
    ){
      return false;
    }

    const payload=
      message.player;

    const values=[
      payload.x,
      payload.y,
      payload.vx,
      payload.vy
    ].map(
      Number
    );

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

    const now=
      performance.now();

    const previous=
      L.runtime.validation.get(
        playerId
      )||{
        x:player.x,
        y:player.y,
        time:now-70,
        seq:-1
      };

    const seq=
      Number(
        message.seq
      )||0;

    if(
      seq<=
      previous.seq
    ){
      return false;
    }

    const seconds=
      Math.max(
        .016,
        Math.min(
          .35,
          (
            now-
            previous.time
          )/
          1000
        )
      );

    const dx=
      Math.abs(
        values[0]-
        previous.x
      );

    const dy=
      Math.abs(
        values[1]-
        previous.y
      );

    const maxDx=
      (
        L.MOVE_SPEED+
        120
      )*
      seconds+
      95;

    const maxDy=
      Math.max(
        L.JUMP_SPEED+
        180,
        Math.abs(
          Number(
            player.vy
          )||0
        )+
        L.GRAVITY*
        seconds
      )*
      seconds+
      120;

    if(
      dx>maxDx||
      dy>maxDy||
      Math.abs(
        values[2]
      )>
      720||
      Math.abs(
        values[3]
      )>
      1250
    ){
      ModeSystem
        .context()
        .sendMode(
          {
            type:"correction",
            player:{
              ...player
            }
          },
          playerId
        );

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
    player.groundPlatformId=
      payload.groundPlatformId||
      null;
    player.maxY=
      Math.max(
        player.maxY||
        L.START_Y,
        Number(
          payload.maxY
        )||
        player.y,
        player.y
      );

    L.runtime.validation.set(
      playerId,
      {
        x:player.x,
        y:player.y,
        time:now,
        seq
      }
    );

    L.ensureWorld(
      L.runtime.world,
      player.y+
      1250
    );

    L.updateTeamHeight();

    const reason=
      L.deathReason(
        player,
        s,
        L.runtime.world,
        s.elapsed
      );

    if(reason){
      L.eliminate(
        player,
        reason
      );
    }

    return true;
  };

  L.applySnapshot=function(
    message
  ){
    if(
      !message||
      message.type!==
      "snapshot"
    ){
      return;
    }

    const previousLocal=
      L.runtime.localPlayer;

    L.runtime.state={
      ...L.runtime.state,
      seed:message.seed,
      elapsed:
        Number(
          message.elapsed
        )||0,
      maxHeight:
        Number(
          message.maxHeight
        )||
        L.START_Y,
      playerCount:
        Number(
          message.playerCount
        )||
        message.players?.length||
        2,
      finished:
        !!message.finished,
      result:
        message.result||
        null,
      players:
        (
          message.players||
          []
        ).map(
          player=>({
            ...player
          })
        )
    };

    state=
      L.runtime.state;

    remoteState=
      L.runtime.state;

    L.runtime.setClock(
      message.elapsed||
      0
    );

    L.ensureWorld(
      L.runtime.world,
      L.runtime.state.maxHeight+
      1250
    );

    const official=
      L.runtime.state.players.find(
        player=>
          player.playerId===
          PLAYER_ID
      );

    if(
      previousLocal&&
      official
    ){
      if(
        official.alive===
        false
      ){
        L.runtime.localPlayer={
          ...official
        };
      }else{
        const dx=
          official.x-
          previousLocal.x;

        const dy=
          official.y-
          previousLocal.y;

        const distance=
          Math.hypot(
            dx,
            dy
          );

        if(distance>150){
          L.runtime.localPlayer={
            ...official
          };
        }else{
          previousLocal.x+=
            dx*.16;

          previousLocal.y+=
            dy*.16;

          previousLocal.alive=true;
          previousLocal.maxY=
            Math.max(
              previousLocal.maxY||
              L.START_Y,
              official.maxY||
              official.y
            );

          L.runtime.localPlayer=
            previousLocal;
        }
      }
    }else if(official){
      L.runtime.localPlayer={
        ...official
      };
    }

    if(
      L.runtime.state.finished
    ){
      L.recordResult(
        L.runtime.state
      );

      showEnd(
        L.runtime.state.result?.title||
        "LAVA — Fim da subida",
        L.runtime.state.result?.text||
        "Todos foram eliminados."
      );

      L.showRanking(
        L.runtime.state
      );
    }
  };

  L.resetHost=function(){
    if(
      role!=="host"
    ){
      return;
    }

    const seed=
      L.makeSeed();

    L.startRuntime({
      seed,
      roster:
        activeMatchRoster,
      offline:false,
      client:false
    });

    ModeSystem
      .context()
      .sendMode({
        type:"init",
        seed,
        roster:
          activeMatchRoster,
        version:L.VERSION
      });

    L.broadcastSnapshot();
  };

  L.resetOffline=function(){
    const seed=
      L.makeSeed();

    L.startRuntime({
      seed,
      roster:[],
      offline:true,
      client:false
    });
  };

  L.startClientFromInit=function(
    message
  ){
    const roster=
      Array.isArray(
        message.roster
      )
        ?message.roster
        :activeMatchRoster;

    activeMatchRoster=
      roster;

    const me=
      roster.find(
        player=>
          player.playerId===
          PLAYER_ID
      );

    myRoomSlot=
      me?.slot??
      myRoomSlot;

    L.startRuntime({
      seed:
        message.seed,
      roster,
      offline:false,
      client:true
    });
  };

  ModeSystem.register({
    id:"lava",

    lobbyStatus({
      playerCount
    }){
      return(
        `${playerCount} jogadores conectados. `+
        "Subam o máximo possível antes que a lava alcance todos."
      );
    },

    hostStart(){
      const seed=
        L.makeSeed();

      L.startRuntime({
        seed,
        roster:
          activeMatchRoster,
        offline:false,
        client:false
      });

      matchStarting=false;

      ModeSystem
        .context()
        .sendMode({
          type:"init",
          seed,
          roster:
            activeMatchRoster,
          version:L.VERSION
        });

      L.broadcastSnapshot();

      return true;
    },

    clientSession(){
      /*
        A sessão informa apenas qual plugin usar.
        O estado LAVA chega logo depois em mode-message:init.
      */
      document
        .getElementById(
          "lobbyMessage"
        )
        .textContent=
          "Modo LAVA selecionado. Aguardando a seed da partida...";

      return true;
    },

    hostMessage({
      message,
      fromPlayerId
    }){
      if(
        message?.type===
        "player-state"
      ){
        L.validateRemoteState(
          fromPlayerId,
          message
        );

        return true;
      }

      if(
        message?.type===
        "restart-request"
      ){
        L.resetHost();
        return true;
      }

      return false;
    },

    clientMessage({
      message
    }){
      if(
        message?.type===
        "init"
      ){
        L.startClientFromInit(
          message
        );

        return true;
      }

      if(
        message?.type===
        "snapshot"
      ){
        L.applySnapshot(
          message
        );

        return true;
      }

      if(
        message?.type===
        "correction"&&
        message.player
      ){
        L.runtime.localPlayer={
          ...message.player
        };

        return true;
      }

      return false;
    },

    offlineStart(){
      cleanupConnectionForModeChange();

      gameMode="offline";
      gameType="lava";
      role="offline";

      L.resetOffline();

      return true;
    },

    update({
      dt
    }){
      if(
        gameType!=="lava"||
        !L.runtime.started
      ){
        return false;
      }

      if(gameMode==="offline"){
        L.offlineUpdate(
          dt
        );
      }else if(role==="host"){
        L.hostUpdate(
          dt
        );
      }else{
        L.clientUpdate(
          dt
        );
      }

      return true;
    },

    render(){
      return L.render();
    },

    restart(){
      if(
        gameType!=="lava"
      ){
        return false;
      }

      hideEnd();
      L.hideRanking();

      if(gameMode==="offline"){
        L.resetOffline();
      }else if(role==="host"){
        L.resetHost();
      }else{
        ModeSystem
          .context()
          .sendMode({
            type:"restart-request"
          });
      }

      return true;
    },

    playerLeft({
      departedPlayerId
    }){
      if(
        gameType!=="lava"||
        role!=="host"||
        !L.runtime.started
      ){
        return false;
      }

      const player=
        L.findPlayer(
          departedPlayerId
        );

      if(!player){
        return false;
      }

      player.connected=false;

      if(
        player.alive!==
        false
      ){
        L.eliminate(
          player,
          "desconectou da sala"
        );
      }

      L.broadcastSnapshot();

      return true;
    },

    stop(){
      if(
        gameType!=="lava"
      ){
        return;
      }

      L.runtime.started=false;
      L.runtime.state=null;
      L.runtime.localPlayer=null;
      L.runtime.world=null;
      L.runtime.validation.clear();
      L.hideUI();
    }
  });

})(window.LavaMode);
