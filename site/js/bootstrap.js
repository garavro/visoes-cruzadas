/*
  V8.7 bootstrap.
  O estado é criado aqui porque newState() está em state.js.
*/
function loop(now){
  const dt=
    Math.min(
      (now-lastTime)/1000,
      .033
    );

  lastTime=now;

  if(
    $("game")
      .classList
      .contains("active")
  ){
    const pluginHandled=
      ModeSystem.update(
        dt
      );

    if(
      !pluginHandled&&
      gameType==="survival"
    ){
      if(gameMode==="offline"){
        /*
          Couch Co-op continua inteiramente local.
        */
        survivalHostUpdate(dt);
      }else if(role==="host"){
        /*
          V8.6: Host calcula somente o próprio personagem,
          mantém o relógio e cria os descriptors dos obstáculos.
        */
        survivalHostUpdateDistributed(
          dt
        );

        accumulator+=dt;

        if(
          accumulator>=
          1/SNAPSHOT_RATE
        ){
          accumulator=0;

          sendGame({
            type:"state",
            state:
              survivalStateForNetwork()
          });
        }
      }else{
        /*
          Cliente calcula o próprio personagem e obstáculos.
        */
        clientUpdateDistributedSurvival(
          dt
        );
      }
    }else if(
      !pluginHandled
    ){
      if(gameMode==="offline"){
        hostUpdate(dt);
      }else if(role==="host"){
        hostUpdate(dt);

        accumulator+=dt;

        if(
          accumulator>=
          1/SNAPSHOT_RATE
        ){
          accumulator=0;

          sendGame({
            type:"state",
            state:
              courseStateForNetwork()
          });
        }
      }else{
        clientUpdateDistributedCourse(
          dt
        );
      }
    }

    draw();
    NetSmoothing.updateHud();
  }

  requestAnimationFrame(loop);
}
setInterval(
  ()=>{
    if(
      signal&&
      signal.readyState===
      WebSocket.OPEN
    ){
      NetSmoothing.markPing();
      signal.send("ping");
    }
  },
  25000
);

async function bootstrapGame(){
  try{
    await CharacterSystem.loadAvailableCharacters();
    await ModeSystem.loadAvailableModes();

    gameType=
      ModeSystem.defaultModeId();

    state=newState();
    remoteState=newState();

    updateMapPanelForRole();
    updatePhaseCounter();
    refreshPlayerProgress();

    document.documentElement.dataset.vcReady=
      "true";

    document.documentElement.dataset.modeCount=
      String(
        ModeSystem.list().length
      );

    document.documentElement.dataset.characterCount=
      String(
        CharacterSystem.list().length
      );

    requestAnimationFrame(
      loop
    );
  }catch(error){
    console.error(
      "Falha ao carregar modos:",
      error
    );

    if($("menuStatus")){
      $("menuStatus").innerHTML=
        `<span class="modePluginError">Falha ao carregar modos: ${String(error.message||error)}</span>`;
    }

    document.documentElement.dataset.vcReady=
      "error";
  }
}

bootstrapGame();
