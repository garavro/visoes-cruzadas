/*
  V9.0.1 — Netcode Smoothing

  Objetivos:
  - impedir falsos positivos causados por jitter / queda de FPS;
  - reservar hard correction para movimentos realmente absurdos;
  - suavizar correções do Host;
  - interpolar jogadores remotos;
  - deixar o anti-cheat centralizado e fácil de desligar em testes.

  Modos aceitos:
    "tolerant" -> proteção atual
    "off"      -> aceita todo estado finito (apenas para diagnóstico)
*/
const NetSmoothing=(()=>{
  const CONFIG={
    guardMode:"tolerant",
    expectedPacketInterval:.05,
    maxPacketGap:1.25,
    correctionLifeMs:520,
    localHardDistance:720,
    remoteHardDistance:900
  };

  const correctionTargets=new Map();
  const remoteVisuals=new Map();

  const stats={
    softCorrections:0,
    hardCorrections:0,
    hostSoftAdjustments:0,
    hostHardBlocks:0,
    invalidStates:0,
    pingMs:null,
    lastReason:""
  };

  let pingSentAt=0;
  let lastHudAt=0;

  const finite=value=>
    Number.isFinite(
      Number(value)
    );

  const clampNumber=(
    value,
    min,
    max
  )=>
    Math.max(
      min,
      Math.min(
        max,
        Number(value)||0
      )
    );

  function guardEnabled(){
    return CONFIG.guardMode!=="off";
  }

  function setGuardMode(mode){
    CONFIG.guardMode=
      mode==="off"
        ?"off"
        :"tolerant";

    console.info(
      `[Netcode] guardMode=${CONFIG.guardMode}`
    );
  }

  function effectiveElapsed(
    previous,
    seq,
    now
  ){
    const wall=
      clampNumber(
        (
          now-
          Number(previous.time||now)
        )/
        1000,
        .016,
        CONFIG.maxPacketGap
      );

    const previousSeq=
      Number(
        previous.seq
      );

    const currentSeq=
      Number(seq);

    const seqGap=
      Number.isFinite(
        previousSeq
      )&&
      Number.isFinite(
        currentSeq
      )
        ?Math.max(
            1,
            currentSeq-
            previousSeq
          )
        :1;

    const bySequence=
      Math.min(
        CONFIG.maxPacketGap,
        seqGap*
        CONFIG.expectedPacketInterval
      );

    /*
      Se pacotes ficaram presos na rede, o intervalo real ou o número de
      sequências perdidas aumenta automaticamente a tolerância.
    */
    return Math.max(
      wall,
      bySequence
    );
  }

  function movementVerdict({
    previous,
    values,
    seq,
    now=performance.now(),
    horizontalSpeed,
    verticalSpeed,
    gravity=0,
    paddingX=160,
    paddingY=200,
    maxVx,
    maxVy,
    hardDistanceX=800,
    hardDistanceY=950
  }){
    if(
      !Array.isArray(values)||
      values.length<4||
      values.some(
        value=>!finite(value)
      )
    ){
      return{
        kind:"invalid",
        reason:"estado não finito"
      };
    }

    const elapsed=
      effectiveElapsed(
        previous,
        seq,
        now
      );

    if(!guardEnabled()){
      return{
        kind:"normal",
        elapsed,
        values:[
          ...values
        ]
      };
    }

    const dx=
      Math.abs(
        Number(values[0])-
        Number(previous.x||0)
      );

    const dy=
      Math.abs(
        Number(values[1])-
        Number(previous.y||0)
      );

    const vx=
      Math.abs(
        Number(values[2])
      );

    const vy=
      Math.abs(
        Number(values[3])
      );

    /*
      Tolerância deliberadamente larga.
      O anti-cheat deve bloquear teleporte grosseiro, não jitter.
    */
    const allowedX=
      Math.max(
        80,
        Number(horizontalSpeed||0)*
        elapsed+
        Number(paddingX||0)+
        Math.min(
          220,
          elapsed*
          240
        )
      );

    const verticalBase=
      Math.max(
        Number(verticalSpeed||0),
        Math.abs(
          Number(previous.vy)||0
        ),
        vy
      );

    const allowedY=
      Math.max(
        110,
        verticalBase*
        elapsed+
        .5*
        Math.max(
          0,
          Number(gravity)||0
        )*
        elapsed*
        elapsed+
        Number(paddingY||0)
      );

    const hardX=
      Math.max(
        Number(hardDistanceX)||800,
        allowedX*4
      );

    const hardY=
      Math.max(
        Number(hardDistanceY)||950,
        allowedY*4
      );

    const velocityHardX=
      Math.max(
        1200,
        Number(maxVx||horizontalSpeed||0)*
        2.8
      );

    const velocityHardY=
      Math.max(
        2200,
        Number(maxVy||verticalSpeed||0)*
        2.2
      );

    if(
      dx>hardX||
      dy>hardY||
      vx>velocityHardX||
      vy>velocityHardY
    ){
      return{
        kind:"hard",
        reason:"movimento fisicamente impossível",
        elapsed,
        dx,
        dy,
        allowedX,
        allowedY,
        hardX,
        hardY
      };
    }

    const velocitySoftX=
      Math.max(
        Number(maxVx||horizontalSpeed||0),
        Number(horizontalSpeed||0)*
        1.55
      );

    const velocitySoftY=
      Math.max(
        Number(maxVy||verticalSpeed||0),
        Number(verticalSpeed||0)*
        1.8
      );

    if(
      dx>allowedX||
      dy>allowedY||
      vx>velocitySoftX||
      vy>velocitySoftY
    ){
      const x=
        Number(previous.x||0)+
        clampNumber(
          Number(values[0])-
          Number(previous.x||0),
          -allowedX,
          allowedX
        );

      const y=
        Number(previous.y||0)+
        clampNumber(
          Number(values[1])-
          Number(previous.y||0),
          -allowedY,
          allowedY
        );

      return{
        kind:"soft",
        reason:"ajuste de sincronização",
        elapsed,
        dx,
        dy,
        allowedX,
        allowedY,
        values:[
          x,
          y,
          clampNumber(
            values[2],
            -velocitySoftX,
            velocitySoftX
          ),
          clampNumber(
            values[3],
            -velocitySoftY,
            velocitySoftY
          )
        ]
      };
    }

    return{
      kind:"normal",
      elapsed,
      dx,
      dy,
      allowedX,
      allowedY,
      values:[
        ...values
      ]
    };
  }

  function noteHostVerdict(
    verdict
  ){
    if(!verdict)return;

    if(
      verdict.kind===
      "soft"
    ){
      stats.hostSoftAdjustments++;
      stats.lastReason=
        verdict.reason||
        "ajuste suave";
    }

    if(
      verdict.kind===
      "hard"||
      verdict.kind===
      "invalid"
    ){
      stats.hostHardBlocks++;

      if(
        verdict.kind===
        "invalid"
      ){
        stats.invalidStates++;
      }

      stats.lastReason=
        verdict.reason||
        "bloqueio";
    }
  }

  function receiveCorrection(
    key,
    localPlayer,
    officialPlayer,
    {
      severity="soft",
      reason="ajuste do Host",
      hardDistance=
        CONFIG.localHardDistance
    }={}
  ){
    if(
      !localPlayer||
      !officialPlayer
    ){
      return;
    }

    const dx=
      Number(officialPlayer.x||0)-
      Number(localPlayer.x||0);

    const dy=
      Number(officialPlayer.y||0)-
      Number(localPlayer.y||0);

    const distance=
      Math.hypot(
        dx,
        dy
      );

    const invalid=
      !finite(
        localPlayer.x
      )||
      !finite(
        localPlayer.y
      )||
      !finite(
        officialPlayer.x
      )||
      !finite(
        officialPlayer.y
      );

    if(
      severity==="hard"||
      invalid||
      distance>
      hardDistance
    ){
      Object.assign(
        localPlayer,
        officialPlayer
      );

      correctionTargets.delete(
        key
      );

      stats.hardCorrections++;
      stats.lastReason=
        reason||
        "hard correction";

      return;
    }

    correctionTargets.set(
      key,
      {
        player:{
          ...officialPlayer
        },
        createdAt:
          performance.now(),
        reason
      }
    );

    stats.softCorrections++;
    stats.lastReason=
      reason||
      "soft correction";
  }

  function stepCorrection(
    key,
    localPlayer,
    dt
  ){
    const target=
      correctionTargets.get(
        key
      );

    if(
      !target||
      !localPlayer
    ){
      return;
    }

    const age=
      performance.now()-
      target.createdAt;

    if(
      age>
      CONFIG.correctionLifeMs
    ){
      correctionTargets.delete(
        key
      );

      return;
    }

    const official=
      target.player;

    const dx=
      Number(official.x||0)-
      Number(localPlayer.x||0);

    const dy=
      Number(official.y||0)-
      Number(localPlayer.y||0);

    const distance=
      Math.hypot(
        dx,
        dy
      );

    if(
      distance>
      CONFIG.localHardDistance
    ){
      Object.assign(
        localPlayer,
        official
      );

      correctionTargets.delete(
        key
      );

      stats.hardCorrections++;
      return;
    }

    /*
      Exponencial: independente de FPS.
      A correção ocorre em vários frames, não em um teleporte.
    */
    const alpha=
      1-
      Math.exp(
        -8.5*
        Math.max(
          0,
          Number(dt)||0
        )
      );

    localPlayer.x+=
      dx*
      alpha;

    localPlayer.y+=
      dy*
      alpha;

    if(finite(official.vx)){
      localPlayer.vx+=
        (
          Number(official.vx)-
          Number(localPlayer.vx||0)
        )*
        Math.min(
          .18,
          alpha
        );
    }

    if(finite(official.vy)){
      localPlayer.vy+=
        (
          Number(official.vy)-
          Number(localPlayer.vy||0)
        )*
        Math.min(
          .14,
          alpha
        );
    }

    if(
      distance<3
    ){
      localPlayer.onGround=
        !!official.onGround;

      if(
        "groundBlockId"
        in official
      ){
        localPlayer.groundBlockId=
          official.groundBlockId||
          null;
      }

      if(
        "groundPlatformId"
        in official
      ){
        localPlayer.groundPlatformId=
          official.groundPlatformId||
          null;
      }

      correctionTargets.delete(
        key
      );
    }
  }

  function reconcileSnapshot(
    key,
    localPlayer,
    officialPlayer,
    {
      ignoreDistance=65,
      mediumDistance=260,
      hardDistance=
        CONFIG.localHardDistance
    }={}
  ){
    if(
      !localPlayer||
      !officialPlayer
    ){
      return;
    }

    if(
      officialPlayer.alive===
      false
    ){
      Object.assign(
        localPlayer,
        officialPlayer
      );

      correctionTargets.delete(
        key
      );

      return;
    }

    const dx=
      Number(officialPlayer.x||0)-
      Number(localPlayer.x||0);

    const dy=
      Number(officialPlayer.y||0)-
      Number(localPlayer.y||0);

    const distance=
      Math.hypot(
        dx,
        dy
      );

    /*
      Pequena diferença é esperada porque o cliente está prevendo o futuro.
      Não puxamos o jogador para trás em todo snapshot.
    */
    if(
      distance<=
      ignoreDistance
    ){
      return;
    }

    if(
      distance>
      hardDistance
    ){
      Object.assign(
        localPlayer,
        officialPlayer
      );

      stats.hardCorrections++;
      stats.lastReason=
        "snapshot muito divergente";

      return;
    }

    const factor=
      distance>
      mediumDistance
        ?.14
        :.055;

    localPlayer.x+=
      dx*
      factor;

    localPlayer.y+=
      dy*
      factor;
  }

  function smoothRemotePlayers(
    scope,
    players,
    localPlayerId
  ){
    const now=
      performance.now();

    return(
      players||
      []
    ).map(
      player=>{
        if(
          !player||
          player.playerId===
          localPlayerId
        ){
          return player;
        }

        const key=
          `${scope}:${player.playerId??player.id}`;

        const existing=
          remoteVisuals.get(
            key
          );

        if(
          !existing||
          player.alive===
          false&&
          existing.alive!==
          false
        ){
          const visual={
            ...player,
            _netTime:now
          };

          remoteVisuals.set(
            key,
            visual
          );

          return{
            ...visual
          };
        }

        const dt=
          clampNumber(
            (
              now-
              Number(
                existing._netTime||
                now
              )
            )/
            1000,
            .001,
            .10
          );

        existing._netTime=now;

        const dx=
          Number(player.x||0)-
          Number(existing.x||0);

        const dy=
          Number(player.y||0)-
          Number(existing.y||0);

        const distance=
          Math.hypot(
            dx,
            dy
          );

        if(
          distance>
          CONFIG.remoteHardDistance
        ){
          Object.assign(
            existing,
            player
          );

          existing._netTime=now;
        }else{
          const alpha=
            1-
            Math.exp(
              -13*
              dt
            );

          existing.x+=
            dx*
            alpha;

          existing.y+=
            dy*
            alpha;

          /*
            Copia os demais estados imediatamente.
            Somente posição recebe interpolação visual.
          */
          for(
            const [
              field,
              value
            ]
            of Object.entries(
              player
            )
          ){
            if(
              field!=="x"&&
              field!=="y"
            ){
              existing[field]=value;
            }
          }
        }

        return{
          ...existing
        };
      }
    );
  }

  function clearCorrection(
    key
  ){
    correctionTargets.delete(
      key
    );
  }

  function clearScope(
    scope
  ){
    for(
      const key
      of remoteVisuals.keys()
    ){
      if(
        key.startsWith(
          `${scope}:`
        )
      ){
        remoteVisuals.delete(
          key
        );
      }
    }
  }

  function markPing(){
    pingSentAt=
      performance.now();
  }

  function markPong(){
    if(!pingSentAt)return;

    const rtt=
      performance.now()-
      pingSentAt;

    if(
      rtt>=0&&
      rtt<10000
    ){
      stats.pingMs=
        stats.pingMs===null
          ?rtt
          :stats.pingMs*
            .7+
            rtt*
            .3;
    }

    pingSentAt=0;
  }

  function ensureHud(){
    let element=
      document.getElementById(
        "netDiag"
      );

    if(element)return element;

    const transport=
      document.getElementById(
        "transportText"
      );

    if(!transport)return null;

    element=
      document.createElement(
        "span"
      );

    element.id=
      "netDiag";

    element.className=
      "muted";

    element.style.fontSize=
      "10px";

    element.style.opacity=
      ".78";

    transport.insertAdjacentElement(
      "afterend",
      element
    );

    element.insertAdjacentHTML(
      "afterend",
      "<br>"
    );

    return element;
  }

  function updateHud(){
    if(
      performance.now()-
      lastHudAt<
      250
    ){
      return;
    }

    lastHudAt=
      performance.now();

    const element=
      ensureHud();

    if(!element)return;

    if(
      gameMode!==
      "online"
    ){
      element.textContent=
        "SYNC local";

      return;
    }

    const ping=
      stats.pingMs===null
        ?"—"
        :`${Math.round(stats.pingMs)}ms`;

    const soft=
      role==="host"
        ?stats.hostSoftAdjustments
        :stats.softCorrections;

    const hard=
      role==="host"
        ?stats.hostHardBlocks
        :stats.hardCorrections;

    element.textContent=
      ` · Ping ${ping} · Ajustes ${soft} · Bloqueios ${hard}`;

    element.title=
      stats.lastReason||
      "Sem correções recentes";
  }

  return Object.freeze({
    CONFIG,
    stats,
    setGuardMode,
    movementVerdict,
    noteHostVerdict,
    receiveCorrection,
    stepCorrection,
    reconcileSnapshot,
    smoothRemotePlayers,
    clearCorrection,
    clearScope,
    markPing,
    markPong,
    updateHud
  });
})();
