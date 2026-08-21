window.LavaMode=
  window.LavaMode||
  {};

(function(L){
  "use strict";

  L.VERSION="0.3.0";
  L.WIDTH=1200;
  L.HEIGHT=680;
  L.START_Y=70;
  L.METERS_PER_PIXEL=.25;
  L.CHUNK_HEIGHT=520;

  L.hashString=function(text){
    let hash=2166136261>>>0;

    for(
      let i=0;
      i<String(text).length;
      i++
    ){
      hash^=
        String(text)
          .charCodeAt(i);

      hash=
        Math.imul(
          hash,
          16777619
        )>>>0;
    }

    return hash>>>0;
  };

  L.mulberry32=function(seed){
    let a=seed>>>0;

    return function(){
      a|=0;
      a=
        a+
        0x6D2B79F5|
        0;

      let t=
        Math.imul(
          a^
          a>>>15,
          1|a
        );

      t=
        t+
        Math.imul(
          t^
          t>>>7,
          61|t
        )^t;

      return(
        (
          t^
          t>>>14
        )>>>0
      )/
      4294967296;
    };
  };

  L.rngFor=function(seed,key){
    return L.mulberry32(
      L.hashString(
        `${seed}:${key}`
      )
    );
  };

  L.rand=function(rng,min,max){
    return(
      min+
      (
        max-min
      )*
      rng()
    );
  };

  L.pick=function(rng,array){
    return array[
      Math.floor(
        rng()*
        array.length
      )%
      array.length
    ];
  };

  L.shuffle=function(rng,array){
    const result=[
      ...array
    ];

    for(
      let i=
        result.length-1;
      i>0;
      i--
    ){
      const j=
        Math.floor(
          rng()*
          (
            i+1
          )
        );

      [
        result[i],
        result[j]
      ]=[
        result[j],
        result[i]
      ];
    }

    return result;
  };

  L.altitudeMeters=function(y){
    return Math.max(
      0,
      (
        Number(y)-
        L.START_Y
      )*
      L.METERS_PER_PIXEL
    );
  };

  L.difficulty=function(y){
    const meters=
      L.altitudeMeters(
        y
      );

    return Math.min(
      1,
      meters/
      1600
    );
  };

  L.createWorld=function(
    seed,
    playerCount
  ){
    const count=
      Math.max(
        2,
        Number(
          playerCount
        )||2
      );

    const start={
      id:"lava-start",
      kind:"platform",
      shared:true,
      ownerSlot:null,
      x:80,
      y:L.START_Y,
      w:1040,
      h:26,
      behavior:null,
      chunk:-1
    };

    return{
      seed,
      playerCount:count,
      platforms:[start],
      chunks:[],
      nextChunk:0,
      generatedTop:
        L.START_Y,
      anchorX:600,
      anchorY:
        L.START_Y,
      nextPlatformId:1
    };
  };

  L.makePlatform=function(
    world,
    values
  ){
    return{
      id:
        `lava-p-${world.nextPlatformId++}`,
      kind:"platform",
      shared:false,
      ownerSlot:0,
      x:0,
      y:0,
      w:160,
      h:20,
      behavior:null,
      ...values
    };
  };

  L.generateChunk=function(
    world,
    chunkIndex
  ){
    const rng=
      L.rngFor(
        world.seed,
        `chunk:${chunkIndex}`
      );

    const startY=
      world.anchorY;

    const chunkTop=
      Math.max(
        (
          chunkIndex+1
        )*
        L.CHUNK_HEIGHT+
        L.START_Y,
        startY+
        430
      );

    const platforms=[];
    let x=
      world.anchorX;
    let y=
      startY;

    const baseDifficulty=
      L.difficulty(
        startY
      );

    const routeCount=
      5+
      Math.floor(
        rng()*3
      );

    let slots=
      L.shuffle(
        rng,
        Array.from(
          {
            length:
              world.playerCount
          },
          (_,index)=>index
        )
      );

    let slotCursor=0;

    for(
      let step=0;
      (
        y<
        chunkTop-
        35
      )||
      step<
      routeCount;
      step++
    ){
      const difficulty=
        L.difficulty(
          y
        );

      const gap=
        L.rand(
          rng,
          68+
          difficulty*10,
          92+
          difficulty*14
        );

      y+=gap;

      const width=
        L.rand(
          rng,
          205-
          difficulty*65,
          250-
          difficulty*72
        );

      const maxShift=
        125+
        difficulty*38;

      x=
        Math.max(
          55,
          Math.min(
            L.WIDTH-
            width-
            55,
            x+
            L.rand(
              rng,
              -maxShift,
              maxShift
            )
          )
        );

      if(
        slotCursor>=
        slots.length
      ){
        slots=
          L.shuffle(
            rng,
            slots
          );

        slotCursor=0;
      }

      const ownerSlot=
        slots[
          slotCursor++
        ];

      let behavior=null;

      const movingChance=
        y>900
          ?.08+
            difficulty*.18
          :.03;

      const blinkChance=
        y>1900
          ?.025+
            difficulty*.10
          :0;

      const behaviorRoll=
        rng();

      if(
        behaviorRoll<
        movingChance
      ){
        behavior={
          type:"moving",
          axis:"x",
          range:
            L.rand(
              rng,
              30,
              78+
              difficulty*32
            ),
          speed:
            L.rand(
              rng,
              24,
              42+
              difficulty*16
            ),
          phase:rng()
        };
      }else if(
        behaviorRoll<
        movingChance+
        blinkChance&&
        step%3!==0
      ){
        behavior={
          type:"blink",
          period:
            L.rand(
              rng,
              7.5,
              10.5
            ),
          visibleFor:
            L.rand(
              rng,
              4.3,
              5.8
            ),
          phase:
            L.rand(
              rng,
              0,
              5
            )
        };
      }

      const platform=
        L.makePlatform(
          world,
          {
            x,
            y,
            w:width,
            h:20,
            ownerSlot,
            behavior,
            chunk:chunkIndex,
            route:true
          }
        );

      platforms.push(
        platform
      );

      /*
        Plataformas auxiliares aumentam opções,
        mas não fazem parte da rota garantida.
      */
      const extras=
        rng()<
        .55+
        difficulty*.18
          ?1
          :0;

      for(
        let extra=0;
        extra<extras;
        extra++
      ){
        const extraW=
          L.rand(
            rng,
            105,
            175
          );

        const side=
          rng()<.5
            ?-1
            :1;

        const extraX=
          Math.max(
            45,
            Math.min(
              L.WIDTH-
              extraW-
              45,
              x+
              side*
              L.rand(
                rng,
                190,
                330
              )
            )
          );

        platforms.push(
          L.makePlatform(
            world,
            {
              x:extraX,
              y:
                y+
                L.rand(
                  rng,
                  -22,
                  28
                ),
              w:extraW,
              h:18,
              ownerSlot:
                Math.floor(
                  rng()*
                  world.playerCount
                ),
              behavior:
                rng()<
                .12+
                difficulty*.13
                  ?{
                      type:"moving",
                      axis:"x",
                      range:
                        L.rand(
                          rng,
                          24,
                          70
                        ),
                      speed:
                        L.rand(
                          rng,
                          22,
                          48
                        ),
                      phase:rng()
                    }
                  :null,
              chunk:chunkIndex,
              route:false
            }
          )
        );
      }

      /*
        Blocos azuis aparecem só mais acima e nunca
        são colocados sobre a linha central da rota.
      */
      if(
        y>1500&&
        rng()<
        .035+
        difficulty*.055
      ){
        const blueW=
          L.rand(
            rng,
            34,
            58
          );

        const side=
          rng()<.5
            ?-1
            :1;

        const deathX=
          Math.max(
            28,
            Math.min(
              L.WIDTH-
              blueW-
              28,
              x+
              side*
              L.rand(
                rng,
                width+
                55,
                width+
                180
              )
            )
          );

        platforms.push(
          {
            id:
              `lava-d-${world.nextPlatformId++}`,
            kind:"death",
            shared:true,
            ownerSlot:null,
            x:deathX,
            y:
              y+
              L.rand(
                rng,
                18,
                70
              ),
            w:blueW,
            h:
              L.rand(
                rng,
                34,
                62
              ),
            behavior:null,
            chunk:chunkIndex,
            route:false
          }
        );
      }

      if(step>9){
        break;
      }
    }

    world.platforms.push(
      ...platforms
    );

    world.chunks.push({
      index:chunkIndex,
      minY:startY,
      maxY:y,
      platformIds:
        platforms.map(
          item=>item.id
        )
    });

    world.nextChunk=
      chunkIndex+1;

    world.generatedTop=y;
    world.anchorX=x;
    world.anchorY=y;

    return world.chunks[
      world.chunks.length-1
    ];
  };

  L.ensureWorld=function(
    world,
    targetY
  ){
    const target=
      Math.max(
        L.START_Y+
        L.CHUNK_HEIGHT,
        Number(targetY)||0
      );

    let guard=0;

    while(
      world.generatedTop<
      target&&
      guard<100
    ){
      L.generateChunk(
        world,
        world.nextChunk
      );

      guard++;
    }
  };

  L.triangleWave=function(t){
    const n=
      (
        (
          t%1
        )+
        1
      )%1;

    return n<.5
      ?-1+
        n*4
      :3-
        n*4;
  };

  L.platformAtTime=function(
    platform,
    elapsed
  ){
    const item={
      ...platform,
      active:true
    };

    const behavior=
      platform.behavior;

    if(
      behavior?.type===
      "moving"
    ){
      const range=
        Math.max(
          1,
          Number(
            behavior.range
          )||40
        );

      const speed=
        Math.max(
          1,
          Number(
            behavior.speed
          )||30
        );

      const period=
        (
          4*
          range
        )/
        speed;

      const offset=
        L.triangleWave(
          elapsed/
          period+
          Number(
            behavior.phase||
            0
          )
        )*
        range;

      item.x=
        platform.x+
        offset;
    }

    if(
      behavior?.type===
      "blink"
    ){
      const period=
        Math.max(
          .1,
          Number(
            behavior.period
          )||10
        );

      const visibleFor=
        Math.max(
          0,
          Math.min(
            period,
            Number(
              behavior.visibleFor
            )||5
          )
        );

      const phase=
        Number(
          behavior.phase||
          0
        );

      const local=
        (
          elapsed+
          phase
        )%
        period;

      item.active=
        local<
        visibleFor;
    }

    return item;
  };

  L.platformsInRange=function(
    world,
    elapsed,
    minY,
    maxY
  ){
    return world.platforms
      .filter(
        platform=>
          platform.y>=
          minY-
          100&&
          platform.y<=
          maxY+
          100
      )
      .map(
        platform=>
          L.platformAtTime(
            platform,
            elapsed
          )
      );
  };

  L.trimWorld=function(
    world,
    lavaY
  ){
    const cutoff=
      Number(lavaY)-
      520;

    if(cutoff<400){
      return;
    }

    world.platforms=
      world.platforms.filter(
        platform=>
          platform.y>=
          cutoff||
          platform.id===
          "lava-start"
      );

    world.chunks=
      world.chunks.filter(
        chunk=>
          chunk.maxY>=
          cutoff
      );
  };

})(window.LavaMode);
