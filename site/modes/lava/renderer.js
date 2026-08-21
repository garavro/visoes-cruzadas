(function(L){
  "use strict";

  L.cameras=
    new Map();

  L.ensureUI=function(){
    let hud=
      document.getElementById(
        "lavaHud"
      );

    if(!hud){
      hud=
        document.createElement(
          "div"
        );

      hud.id="lavaHud";

      document
        .getElementById(
          "gameArea"
        )
        .appendChild(
          hud
        );
    }

    let banner=
      document.getElementById(
        "lavaEventBanner"
      );

    if(!banner){
      banner=
        document.createElement(
          "div"
        );

      banner.id=
        "lavaEventBanner";

      document
        .getElementById(
          "gameArea"
        )
        .appendChild(
          banner
        );
    }

    let ranking=
      document.getElementById(
        "lavaRanking"
      );

    if(!ranking){
      ranking=
        document.createElement(
          "div"
        );

      ranking.id=
        "lavaRanking";

      ranking.classList.add(
        "hidden"
      );

      const endText=
        document.getElementById(
          "endText"
        );

      endText.insertAdjacentElement(
        "afterend",
        ranking
      );
    }

    return{
      hud,
      banner,
      ranking
    };
  };

  L.hideUI=function(){
    const hud=
      document.getElementById(
        "lavaHud"
      );

    const banner=
      document.getElementById(
        "lavaEventBanner"
      );

    const ranking=
      document.getElementById(
        "lavaRanking"
      );

    if(hud)hud.remove();
    if(banner)banner.remove();

    if(ranking){
      ranking.classList.add(
        "hidden"
      );

      ranking.innerHTML="";
    }

    L.cameras.clear();
  };

  L.configureGameUI=function(){
    L.ensureUI();

    document.body.className=
      ModeSystem.bodyClassFor(
        "lava",
        gameMode==="offline"
          ?"offline-mode"
          :role==="host"
            ?"role-host"
            :"role-client"
      );

    document
      .getElementById(
        "gameTitle"
      )
      .textContent=
        "VISÕES CRUZADAS — LAVA";

    document
      .getElementById(
        "gameSubtitle"
      )
      .textContent=
        "Suba sem limite. A lava acelera, plataformas mudam e jogadores eliminados continuam ajudando como espectadores.";

    document
      .getElementById(
        "survivalTimer"
      )
      .classList
      .add(
        "hidden"
      );

    document
      .getElementById(
        "mapPanel"
      )
      .classList
      .add(
        "hidden"
      );

    document
      .getElementById(
        "generatedMapDecision"
      )
      .classList
      .add(
        "hidden"
      );

    document
      .getElementById(
        "nextMapBtn"
      )
      .classList
      .add(
        "hidden"
      );

    document
      .getElementById(
        "transportText"
      )
      .textContent=
        gameMode==="offline"
          ?"Local · geração infinita"
          :"WebSocket · física + chunks distribuídos";

    document
      .getElementById(
        "phaseCounter"
      )
      .textContent=
        "LAVA 0.3";

    document
      .getElementById(
        "canvas"
      )
      .classList
      .toggle(
        "hidden",
        gameMode==="offline"
      );

    document
      .getElementById(
        "offlineViews"
      )
      .classList
      .toggle(
        "hidden",
        gameMode!=="offline"
      );

    if(gameMode==="offline"){
      document
        .getElementById(
          "roleText"
        )
        .textContent=
          "COUCH CO-OP · LAVA";

      document
        .getElementById(
          "roleText"
        )
        .style.color=
          "#ffb06f";

      document
        .getElementById(
          "controlText"
        )
        .innerHTML=
          "P1: <kbd>A</kbd>/<kbd>D</kbd>/<kbd>W</kbd> · P2: <kbd>←</kbd>/<kbd>→</kbd>/<kbd>↑</kbd>";

      document
        .getElementById(
          "netText"
        )
        .textContent=
          "OFFLINE";
    }else{
      const number=
        (
          Number(
            myRoomSlot
          )||0
        )+
        1;

      document
        .getElementById(
          "roleText"
        )
        .textContent=
          `JOGADOR ${number}${role==="host"?" · HOST":""}`;

      document
        .getElementById(
          "roleText"
        )
        .style.color=
          playerColorForSlot(
            Number(
              myRoomSlot
            )||0
          );

      document
        .getElementById(
          "controlText"
        )
        .innerHTML=
          role==="host"
            ?"<kbd>A</kbd>/<kbd>D</kbd> mover · <kbd>W</kbd> pular"
            :"<kbd>←</kbd>/<kbd>→</kbd> mover · <kbd>↑</kbd> pular";

      document
        .getElementById(
          "netText"
        )
        .textContent=
          `Conectado · ${activeMatchRoster.length} jogadores`;
    }

    document
      .getElementById(
        "gameMsg"
      )
      .textContent=
        "Cada jogador enxerga as plataformas da própria cor, mas todos colidem com todas.";

    keys={};

    touchInput={
      left:false,
      right:false,
      jump:false
    };

    hideEnd();
    setEndActions(
      "none"
    );

    setScreen(
      "game"
    );

    lastTime=
      performance.now();

    accumulator=0;
  };

  L.playerForViewer=function(
    drawState,
    viewerSlot
  ){
    return(
      drawState.players||
      []
    ).find(
      player=>
        Number(
          player.slot
        )===
        Number(
          viewerSlot
        )
    )||null;
  };

  L.cameraBottomFor=function(
    drawState,
    viewerSlot,
    elapsed
  ){
    const key=
      `${gameMode}:${viewerSlot}`;

    const own=
      L.playerForViewer(
        drawState,
        viewerSlot
      );

    const alive=
      (
        drawState.players||
        []
      ).filter(
        player=>
          player.alive!==
          false
      );

    const follow=
      own?.alive!==
      false
        ?own
        :alive.sort(
            (a,b)=>
              b.y-
              a.y
          )[0]||
          own;

    const target=
      Math.max(
        L.lavaHeight(
          elapsed
        )-
        35,
        (
          follow?.y||
          L.START_Y
        )-
        390
      );

    const previous=
      L.cameras.get(
        key
      );

    const next=
      previous===undefined
        ?target
        :previous+
          (
            target-
            previous
          )*
          .10;

    L.cameras.set(
      key,
      next
    );

    return next;
  };

  L.screenY=function(
    worldY,
    cameraBottom
  ){
    return(
      620-
      (
        worldY-
        cameraBottom
      )
    );
  };

  L.drawPlatform=function(
    renderCtx,
    platform,
    viewerSlot,
    cameraBottom
  ){
    if(
      platform.active===
      false
    ){
      return;
    }

    const isDeath=
      platform.kind===
      "death";

    const visible=
      isDeath||
      platform.shared||
      platform.ownerSlot===
      null||
      Number(
        platform.ownerSlot
      )===
      Number(
        viewerSlot
      );

    if(!visible){
      return;
    }

    const x=
      platform.x;

    if(isDeath){
      const top=
        L.screenY(
          platform.y+
          platform.h,
          cameraBottom
        );

      renderCtx.fillStyle=
        "#3197ff";

      renderCtx.fillRect(
        x,
        top,
        platform.w,
        platform.h
      );

      renderCtx.strokeStyle=
        "#b9ddff";

      renderCtx.lineWidth=2;

      renderCtx.strokeRect(
        x,
        top,
        platform.w,
        platform.h
      );

      return;
    }

    const y=
      L.screenY(
        platform.y,
        cameraBottom
      );

    renderCtx.fillStyle=
      platform.shared
        ?"#c4cbd7"
        :playerColorForSlot(
            Number(
              platform.ownerSlot
            )||0
          );

    renderCtx.fillRect(
      x,
      y,
      platform.w,
      platform.h
    );

    renderCtx.fillStyle=
      "rgba(255,255,255,.16)";

    renderCtx.fillRect(
      x,
      y,
      platform.w,
      3
    );

    if(
      platform.behavior?.type===
      "moving"
    ){
      renderCtx.fillStyle=
        "rgba(255,255,255,.85)";

      renderCtx.font=
        "bold 12px Arial";

      renderCtx.fillText(
        "↔",
        x+
        platform.w/2-
        6,
        y+
        15
      );
    }

    if(
      platform.behavior?.type===
      "blink"
    ){
      renderCtx.fillStyle=
        "rgba(255,255,255,.85)";

      renderCtx.font=
        "bold 11px Arial";

      renderCtx.fillText(
        "◌",
        x+
        platform.w/2-
        5,
        y+
        14
      );
    }
  };

  L.drawPlayer=function(
    renderCtx,
    player,
    cameraBottom
  ){
    const y=
      L.screenY(
        player.y+
        player.h,
        cameraBottom
      );

    CharacterSystem.drawPlayer(
      renderCtx,
      player,
      {
        x:player.x,
        y,
        w:player.w,
        h:player.h,
        slot:
          Number(
            player.slot
          )||0,
        characterId:
          player.characterId,
        label:
          `P${(Number(player.slot)||0)+1}`
      }
    );
  };

  L.renderWorld=function(
    renderCtx,
    renderCanvas,
    drawState,
    viewerSlot,
    elapsed
  ){
    if(
      !drawState||
      !L.runtime.world
    ){
      return;
    }

    const sx=
      renderCanvas.width/
      L.WIDTH;

    const sy=
      renderCanvas.height/
      L.HEIGHT;

    renderCtx.setTransform(
      sx,
      0,
      0,
      sy,
      0,
      0
    );

    renderCtx.clearRect(
      0,
      0,
      L.WIDTH,
      L.HEIGHT
    );

    const gradient=
      renderCtx.createLinearGradient(
        0,
        0,
        0,
        L.HEIGHT
      );

    gradient.addColorStop(
      0,
      "#080d1a"
    );

    gradient.addColorStop(
      .68,
      "#161529"
    );

    gradient.addColorStop(
      1,
      "#35140d"
    );

    renderCtx.fillStyle=
      gradient;

    renderCtx.fillRect(
      0,
      0,
      L.WIDTH,
      L.HEIGHT
    );

    const cameraBottom=
      L.cameraBottomFor(
        drawState,
        viewerSlot,
        elapsed
      );

    const topWorld=
      cameraBottom+
      700;

    L.ensureWorld(
      L.runtime.world,
      topWorld+
      750
    );

    /*
      Marcadores de altitude.
    */
    const minMeters=
      Math.floor(
        L.altitudeMeters(
          cameraBottom
        )/
        250
      )*
      250;

    renderCtx.font=
      "11px Arial";

    for(
      let meters=
        Math.max(
          0,
          minMeters
        );
      meters<
        L.altitudeMeters(
          topWorld
        )+
        250;
      meters+=250
    ){
      const worldY=
        L.START_Y+
        meters/
        L.METERS_PER_PIXEL;

      const y=
        L.screenY(
          worldY,
          cameraBottom
        );

      renderCtx.strokeStyle=
        "rgba(255,255,255,.07)";

      renderCtx.beginPath();
      renderCtx.moveTo(
        0,
        y
      );
      renderCtx.lineTo(
        L.WIDTH,
        y
      );
      renderCtx.stroke();

      renderCtx.fillStyle=
        "rgba(255,255,255,.35)";

      renderCtx.fillText(
        `${meters} m`,
        10,
        y-5
      );
    }

    const visiblePlatforms=
      L.platformsInRange(
        L.runtime.world,
        elapsed,
        cameraBottom-
        100,
        topWorld+
        150
      );

    for(
      const platform
      of visiblePlatforms
    ){
      L.drawPlatform(
        renderCtx,
        platform,
        viewerSlot,
        cameraBottom
      );
    }

    /*
      Lava.
    */
    const lavaY=
      L.lavaHeight(
        elapsed
      );

    const lavaTop=
      L.screenY(
        lavaY,
        cameraBottom
      );

    renderCtx.fillStyle=
      "#e74620";

    renderCtx.fillRect(
      0,
      lavaTop,
      L.WIDTH,
      L.HEIGHT-
      lavaTop+
      100
    );

    renderCtx.fillStyle=
      "#ff9c36";

    renderCtx.beginPath();

    for(
      let x=0;
      x<=L.WIDTH;
      x+=24
    ){
      const wave=
        Math.sin(
          x*.035+
          elapsed*5
        )*
        5;

      if(x===0){
        renderCtx.moveTo(
          x,
          lavaTop+
          wave
        );
      }else{
        renderCtx.lineTo(
          x,
          lavaTop+
          wave
        );
      }
    }

    renderCtx.lineTo(
      L.WIDTH,
      lavaTop+14
    );

    renderCtx.lineTo(
      0,
      lavaTop+14
    );

    renderCtx.closePath();
    renderCtx.fill();

    /*
      Partículas simples determinísticas por tempo.
    */
    renderCtx.fillStyle=
      "rgba(255,177,81,.55)";

    for(
      let i=0;
      i<24;
      i++
    ){
      const px=
        (
          i*173+
          Math.floor(
            elapsed*23
          )
        )%
        L.WIDTH;

      const py=
        lavaTop-
        (
          (
            i*37+
            elapsed*31
          )%
          130
        );

      renderCtx.fillRect(
        px,
        py,
        3,
        3
      );
    }

    for(
      const player
      of drawState.players||
      []
    ){
      L.drawPlayer(
        renderCtx,
        player,
        cameraBottom
      );
    }

    const event=
      L.currentEvent(
        drawState.seed||
        L.runtime.seed,
        elapsed
      );

    if(
      event?.type===
      "wind"
    ){
      renderCtx.fillStyle=
        "rgba(220,230,255,.18)";

      for(
        let y=80;
        y<600;
        y+=70
      ){
        renderCtx.fillRect(
          event.direction>0
            ?70
            :930,
          y,
          190,
          2
        );
      }
    }

    renderCtx.setTransform(
      1,
      0,
      0,
      1,
      0,
      0
    );
  };

  L.updateHUD=function(
    drawState,
    elapsed
  ){
    const ui=
      L.ensureUI();

    const alive=
      (
        drawState.players||
        []
      ).filter(
        player=>
          player.alive!==
          false
      ).length;

    const total=
      (
        drawState.players||
        []
      ).length;

    const height=
      L.altitudeMeters(
        drawState.maxHeight||
        L.START_Y
      );

    const best=
      L.readBestHeight();

    ui.hud.innerHTML=
      `<strong>LAVA</strong><br>`+
      `Altura: <b>${height.toFixed(1)} m</b><br>`+
      `Tempo: <b>${formatSurvivalTime(elapsed)}</b><br>`+
      `Vivos: <b>${alive}/${total}</b><br>`+
      `Recorde local: <b>${best.toFixed(1)} m</b>`;

    const event=
      L.currentEvent(
        drawState.seed||
        L.runtime.seed,
        elapsed
      );

    if(event){
      ui.banner.textContent=
        `${event.name} · ${event.remaining.toFixed(1)}s`;

      ui.banner.classList.add(
        "active"
      );
    }else{
      ui.banner.classList.remove(
        "active"
      );
    }
  };

  L.render=function(){
    if(
      gameType!=="lava"||
      !document
        .getElementById(
          "game"
        )
        .classList
        .contains(
          "active"
        )||
      !L.runtime.started
    ){
      return false;
    }

    const elapsed=
      L.runtime.currentElapsed();

    const drawState=
      L.runtime.renderState();

    L.updateHUD(
      drawState,
      elapsed
    );

    if(gameMode==="offline"){
      L.renderWorld(
        offlineCtxP1,
        offlineCanvasP1,
        drawState,
        0,
        elapsed
      );

      L.renderWorld(
        offlineCtxP2,
        offlineCanvasP2,
        drawState,
        1,
        elapsed
      );
    }else{
      L.renderWorld(
        ctx,
        canvas,
        drawState,
        Number(
          myRoomSlot
        )||0,
        elapsed
      );
    }

    return true;
  };

})(window.LavaMode);
