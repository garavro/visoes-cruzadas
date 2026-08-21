function drawWorld(renderCtx,renderCanvas,drawState,viewer){
  const useCamera=
    gameType==="course"&&
    WORLD.w>1400;

  const viewportW=useCamera
    ?1200
    :WORLD.w;

  const onlineCourse=
    gameMode==="online"&&
    gameType==="course"&&
    activeMatchRoster.length>=2;

  const focusPlayer=
    (drawState.players||[]).find(
      player=>
        Number(player.slot)===
        Number(viewer)
    )||
    (drawState.players||[]).find(
      player=>
        player.alive!==false
    );

  let focusX=
    focusPlayer
      ?focusPlayer.x+
        focusPlayer.w/2
      :viewportW/2;

  /*
    Na visão do Host, quando a equipe ainda cabe confortavelmente na câmera,
    centralizamos suavemente entre os jogadores vivos.
  */
  if(
    useCamera&&
    onlineCourse&&
    role==="host"
  ){
    const alivePlayers=
      (drawState.players||[])
        .filter(
          player=>
            player.alive!==false
        );

    if(alivePlayers.length>=2){
      const centers=
        alivePlayers.map(
          player=>
            player.x+
            player.w/2
        );

      const minX=
        Math.min(
          ...centers
        );

      const maxX=
        Math.max(
          ...centers
        );

      if(
        maxX-minX<=
        viewportW*.70
      ){
        focusX=
          (minX+maxX)/2;
      }
    }
  }

  const cameraX=useCamera
    ?clamp(
        focusX-
        viewportW*.42,
        0,
        Math.max(
          0,
          WORLD.w-
          viewportW
        )
      )
    :0;

  const scale=Math.min(
    renderCanvas.width/viewportW,
    renderCanvas.height/WORLD.h
  );

  const ox=(renderCanvas.width-viewportW*scale)/2;
  const oy=(renderCanvas.height-WORLD.h*scale)/2;

  renderCtx.clearRect(0,0,renderCanvas.width,renderCanvas.height);
  renderCtx.save();
  renderCtx.translate(
    ox-cameraX*scale,
    oy
  );
  renderCtx.scale(scale,scale);

  renderCtx.fillStyle="#161e2b";
  renderCtx.fillRect(0,0,WORLD.w,WORLD.h);

  renderCtx.strokeStyle="rgba(255,255,255,.035)";
  for(let x=0;x<=WORLD.w;x+=50){
    renderCtx.beginPath();
    renderCtx.moveTo(x,0);
    renderCtx.lineTo(x,WORLD.h);
    renderCtx.stroke();
  }
  for(let y=0;y<=WORLD.h;y+=50){
    renderCtx.beginPath();
    renderCtx.moveTo(0,y);
    renderCtx.lineTo(WORLD.w,y);
    renderCtx.stroke();
  }

  renderCtx.strokeStyle="#fff";
  renderCtx.lineWidth=10;
  renderCtx.strokeRect(5,5,WORLD.w-10,WORLD.h-10);

  renderCtx.strokeStyle="rgba(255,80,90,.5)";
  renderCtx.lineWidth=2;
  renderCtx.setLineDash([14,10]);
  renderCtx.strokeRect(18,18,WORLD.w-36,WORLD.h-36);
  renderCtx.setLineDash([]);

  renderCtx.fillStyle="rgba(85,220,136,.22)";
  renderCtx.fillRect(goal.x,goal.y,goal.w,goal.h);
  renderCtx.strokeStyle="#55dc88";
  renderCtx.lineWidth=4;
  renderCtx.strokeRect(goal.x,goal.y,goal.w,goal.h);
  renderCtx.fillStyle="#a3f0bf";
  renderCtx.font="bold 18px Arial";
  renderCtx.fillText("SAÍDA",goal.x+6,goal.y-10);

  if(useCamera){
    const progressWidth=220;
    const progressX=cameraX+18;
    const progressY=62;
    const progress=clamp(
      focusX/Math.max(1,WORLD.w),
      0,
      1
    );

    renderCtx.fillStyle="rgba(0,0,0,.48)";
    renderCtx.fillRect(
      progressX,
      progressY,
      progressWidth,
      12
    );

    renderCtx.fillStyle="#55dc88";
    renderCtx.fillRect(
      progressX,
      progressY,
      progressWidth*progress,
      12
    );
  }

  const renderBlocks=Array.isArray(drawState.runtimeBlocks)
    ?drawState.runtimeBlocks
    :blocks;

  const multiplayerVision=
    onlineCourse;

  for(const block of renderBlocks){
    if(block.active===false)continue;

    if(block.kind==="death"||block.type==="blue"){
      renderCtx.fillStyle="#3995ff";
      renderCtx.fillRect(block.x,block.y,block.w,block.h);
      renderCtx.strokeStyle="#a9d2ff";
      renderCtx.lineWidth=3;
      renderCtx.strokeRect(block.x,block.y,block.w,block.h);
      renderCtx.fillStyle="#e7f4ff";
      renderCtx.font="bold 13px Arial";
      renderCtx.fillText("✕",block.x+block.w/2-4,block.y+block.h-3);
      continue;
    }

    let visible;
    let fill;
    let stroke;

    if(multiplayerVision){
      visible=
        block.visibleToAll===true||
        block.visibleSlots?.includes(Number(viewer));

      fill=block.displayColor||"#9aa6b8";
      stroke=block.displayStroke||"#dce3ec";
    }else{
      visible=
        (viewer===1&&block.type==="yellow")||
        (viewer===2&&block.type==="red");

      fill=block.kind==="obstacle"
        ?(block.type==="yellow"?"#d8a92c":"#be3e49")
        :(block.type==="yellow"?"#f2ca3c":"#e8515e");

      stroke=block.type==="yellow"?"#fff0a0":"#ff9aa4";
    }

    if(!visible)continue;

    renderCtx.fillStyle=fill;
    renderCtx.fillRect(block.x,block.y,block.w,block.h);
    renderCtx.strokeStyle=stroke;
    renderCtx.lineWidth=3;

    if(block.behavior?.type==="blink"){
      renderCtx.setLineDash([8,6]);
    }

    renderCtx.strokeRect(block.x,block.y,block.w,block.h);
    renderCtx.setLineDash([]);

    if(block.behavior?.type==="moving"){
      renderCtx.fillStyle="rgba(0,0,0,.55)";
      renderCtx.font="bold 14px Arial";
      renderCtx.fillText(
        block.behavior.axis==="y"?"↕":"↔",
        block.x+block.w/2-7,
        block.y+17
      );
    }
  }

  for(const player of drawState.players||[]){
    const onlineDynamic=
      multiplayerVision&&
      player.slot!==undefined;

    const slot=
      onlineDynamic
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
          `P${slot+1}`,
        reached:
          player.reached
      }
    );
  }

  /*
    Se um convidado estiver fora da câmera do Host, mostramos um marcador
    na borda. Assim ele não "desaparece" simplesmente em mapas longos.
  */
  if(
    multiplayerVision&&
    useCamera&&
    role==="host"
  ){
    const left=
      cameraX;

    const right=
      cameraX+
      viewportW;

    for(
      const player
      of drawState.players||
      []
    ){
      if(
        player.alive===false||
        player.playerId===
        PLAYER_ID
      ){
        continue;
      }

      const centerX=
        player.x+
        player.w/2;

      if(
        centerX>=left+20&&
        centerX<=right-20
      ){
        continue;
      }

      const slot=
        Number(
          player.slot
        )||0;

      const markerX=
        centerX<left
          ?left+24
          :right-24;

      const markerY=
        clamp(
          player.y+
          player.h/2,
          55,
          WORLD.h-45
        );

      renderCtx.save();

      renderCtx.fillStyle=
        playerColorForSlot(
          slot
        );

      renderCtx.strokeStyle=
        playerStrokeForSlot(
          slot
        );

      renderCtx.lineWidth=3;
      renderCtx.beginPath();

      if(centerX<left){
        renderCtx.moveTo(
          markerX-12,
          markerY
        );
        renderCtx.lineTo(
          markerX+8,
          markerY-12
        );
        renderCtx.lineTo(
          markerX+8,
          markerY+12
        );
      }else{
        renderCtx.moveTo(
          markerX+12,
          markerY
        );
        renderCtx.lineTo(
          markerX-8,
          markerY-12
        );
        renderCtx.lineTo(
          markerX-8,
          markerY+12
        );
      }

      renderCtx.closePath();
      renderCtx.fill();
      renderCtx.stroke();

      renderCtx.fillStyle=
        "#ffffff";

      renderCtx.font=
        "bold 13px Arial";

      renderCtx.textAlign=
        "center";

      renderCtx.fillText(
        `P${slot+1}`,
        markerX,
        markerY-17
      );

      renderCtx.restore();
    }
  }

  renderCtx.restore();
}

function draw(){
  if(
    ModeSystem.render()
  ){
    return;
  }

  if(
    !$("game")
      .classList
      .contains("active")
  ){
    return;
  }

  if(
    gameMode==="online"&&
    gameType==="course"&&
    role==="client"&&
    remoteState
  ){
    syncDeterministicCourseWorld(
      remoteState,
      currentCourseClock(),
      []
    );
  }

  if(gameType==="survival"){
    drawSurvival();
    return;
  }

  if(gameMode==="offline"){
    drawWorld(
      offlineCtxP1,
      offlineCanvasP1,
      state,
      1
    );

    drawWorld(
      offlineCtxP2,
      offlineCanvasP2,
      state,
      2
    );

    return;
  }

  const drawState=
    role==="host"
      ?distributedHostRenderState()
      :distributedClientRenderState();

  const viewer=
    gameMode==="online"&&activeMatchRoster.length>=2
      ?Number(myRoomSlot??0)
      :(role==="host"?1:2);

  drawWorld(
    ctx,
    canvas,
    drawState,
    viewer
  );
}
