(function(L){
  "use strict";

  L.GRAVITY=1850;
  L.MOVE_SPEED=315;
  L.JUMP_SPEED=680;
  L.PLAYER_W=34;
  L.PLAYER_H=46;

  L.lavaHeight=function(elapsed){
    const t=
      Math.max(
        0,
        Number(elapsed)||0
      );

    const base=
      -140+
      18*t+
      .03*t*t;

    const cycle=52;
    const surgeStart=38;
    const surgeDuration=7;
    const surgeExtraSpeed=32;

    const fullCycles=
      Math.floor(
        t/
        cycle
      );

    const remainder=
      t-
      fullCycles*
      cycle;

    const surgeSeconds=
      fullCycles*
      surgeDuration+
      Math.max(
        0,
        Math.min(
          surgeDuration,
          remainder-
          surgeStart
        )
      );

    return(
      base+
      surgeSeconds*
      surgeExtraSpeed
    );
  };

  L.currentEvent=function(
    seed,
    elapsed
  ){
    const t=
      Math.max(
        0,
        Number(elapsed)||0
      );

    const surgeCycle=52;
    const surgeLocal=
      t%
      surgeCycle;

    if(
      surgeLocal>=38&&
      surgeLocal<45
    ){
      return{
        id:
          `surge-${Math.floor(t/surgeCycle)}`,
        type:"surge",
        name:"ERUPÇÃO — A LAVA ACELEROU!",
        remaining:
          45-
          surgeLocal
      };
    }

    const windCycle=67;
    const windLocal=
      t%
      windCycle;

    if(
      windLocal>=50&&
      windLocal<58
    ){
      const index=
        Math.floor(
          t/
          windCycle
        );

      const rng=
        L.rngFor(
          seed,
          `wind:${index}`
        );

      const direction=
        rng()<.5
          ?-1
          :1;

      return{
        id:`wind-${index}`,
        type:"wind",
        direction,
        name:
          direction<0
            ?"VENTANIA ←"
            :"VENTANIA →",
        remaining:
          58-
          windLocal
      };
    }

    return null;
  };

  L.windVelocity=function(
    seed,
    elapsed
  ){
    const event=
      L.currentEvent(
        seed,
        elapsed
      );

    if(
      event?.type===
      "wind"
    ){
      return(
        event.direction*
        92
      );
    }

    return 0;
  };

  L.createPlayers=function(
    roster,
    offline=false
  ){
    const source=
      offline
        ?[
            {
              playerId:"offline-p1",
              slot:0,
              characterId:
                CharacterSystem.offlineCharacterId(0)
            },
            {
              playerId:"offline-p2",
              slot:1,
              characterId:
                CharacterSystem.offlineCharacterId(1)
            }
          ]
        :[
            ...(roster||[])
          ].sort(
            (a,b)=>
              (
                Number(a.slot)||0
              )-
              (
                Number(b.slot)||0
              )
          );

    const count=
      Math.max(
        1,
        source.length
      );

    return source.map(
      (
        info,
        index
      )=>{
        const x=
          140+
          (
            (
              index+.5
            )/
            count
          )*
          920-
          L.PLAYER_W/2;

        return{
          id:index+1,
          playerId:
            info.playerId,
          slot:
            Number(
              info.slot
            )||index,
          characterId:
            CharacterSystem.characterIdForPlayer(
              info.playerId,
              info.slot??index,
              info.characterId
            ),
          connected:true,
          alive:true,
          eliminatedReason:null,
          x,
          y:L.START_Y,
          w:L.PLAYER_W,
          h:L.PLAYER_H,
          vx:0,
          vy:0,
          onGround:true,
          jumpLock:false,
          groundPlatformId:
            "lava-start",
          maxY:L.START_Y
        };
      }
    );
  };

  L.playerRectHitsDeath=function(
    player,
    block
  ){
    if(
      block.kind!==
      "death"||
      block.active===
      false
    ){
      return false;
    }

    return(
      player.x<
        block.x+
        block.w&&
      player.x+
        player.w>
        block.x&&
      player.y<
        block.y+
        block.h&&
      player.y+
        player.h>
        block.y
    );
  };

  L.findGroundPlatform=function(
    world,
    id
  ){
    return world.platforms.find(
      platform=>
        platform.id===id
    )||null;
  };

  L.simulatePlayer=function(
    player,
    input,
    dt,
    state,
    world,
    elapsed
  ){
    if(
      !player||
      player.alive===
      false||
      state.finished
    ){
      return;
    }

    const previousElapsed=
      Math.max(
        0,
        elapsed-
        dt
      );

    if(
      player.onGround&&
      player.groundPlatformId
    ){
      const groundBase=
        L.findGroundPlatform(
          world,
          player.groundPlatformId
        );

      if(groundBase){
        const before=
          L.platformAtTime(
            groundBase,
            previousElapsed
          );

        const now=
          L.platformAtTime(
            groundBase,
            elapsed
          );

        if(
          now.active===
          false
        ){
          player.onGround=false;
          player.groundPlatformId=null;
        }else{
          player.x+=
            now.x-
            before.x;
        }
      }
    }

    let direction=0;

    if(input?.left)direction--;
    if(input?.right)direction++;

    const wind=
      L.windVelocity(
        state.seed,
        elapsed
      );

    player.vx=
      direction*
      L.MOVE_SPEED+
      wind;

    if(
      input?.jump&&
      player.onGround&&
      !player.jumpLock
    ){
      player.vy=
        L.JUMP_SPEED;

      player.onGround=false;
      player.groundPlatformId=null;
      player.jumpLock=true;
    }

    if(!input?.jump){
      player.jumpLock=false;
    }

    const oldY=
      player.y;

    player.vy-=
      L.GRAVITY*
      dt;

    player.x+=
      player.vx*
      dt;

    player.x=
      Math.max(
        4,
        Math.min(
          L.WIDTH-
          player.w-
          4,
          player.x
        )
      );

    player.y+=
      player.vy*
      dt;

    const minY=
      Math.min(
        oldY,
        player.y
      )-
      80;

    const maxY=
      Math.max(
        oldY+
        player.h,
        player.y+
        player.h
      )+
      80;

    const nearby=
      L.platformsInRange(
        world,
        elapsed,
        minY,
        maxY
      );

    /*
      Plataformas são pisos de uma direção:
      o jogador pode atravessar por baixo e pousa ao cair.
    */
    if(
      player.vy<=0
    ){
      let landing=null;

      for(
        const platform
        of nearby
      ){
        if(
          platform.kind===
          "death"||
          platform.active===
          false
        ){
          continue;
        }

        const horizontal=
          player.x+
          player.w>
          platform.x+
          4&&
          player.x<
          platform.x+
          platform.w-
          4;

        if(!horizontal){
          continue;
        }

        const crossed=
          oldY>=
          platform.y-
          3&&
          player.y<=
          platform.y+
          3;

        if(
          crossed&&
          (
            !landing||
            platform.y>
            landing.y
          )
        ){
          landing=platform;
        }
      }

      if(landing){
        player.y=
          landing.y;

        player.vy=0;
        player.onGround=true;
        player.groundPlatformId=
          landing.id;
      }else{
        player.onGround=false;
        player.groundPlatformId=null;
      }
    }

    player.maxY=
      Math.max(
        Number(
          player.maxY
        )||
        L.START_Y,
        player.y
      );
  };

  L.deathReason=function(
    player,
    state,
    world,
    elapsed
  ){
    if(
      !player||
      player.alive===
      false
    ){
      return null;
    }

    const lavaY=
      L.lavaHeight(
        elapsed
      );

    if(
      player.y<=
      lavaY+
      3
    ){
      return "foi alcançado pela lava";
    }

    const nearby=
      L.platformsInRange(
        world,
        elapsed,
        player.y-
        80,
        player.y+
        player.h+
        80
      );

    for(
      const block
      of nearby
    ){
      if(
        L.playerRectHitsDeath(
          player,
          block
        )
      ){
        return "tocou em um bloco azul mortal";
      }
    }

    return null;
  };

  L.sanitizePlayer=function(
    player
  ){
    return{
      x:Number(player.x)||0,
      y:Number(player.y)||0,
      vx:Number(player.vx)||0,
      vy:Number(player.vy)||0,
      onGround:!!player.onGround,
      jumpLock:!!player.jumpLock,
      groundPlatformId:
        player.groundPlatformId||
        null,
      maxY:Number(player.maxY)||0
    };
  };

})(window.LavaMode);
