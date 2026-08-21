function createRuntimeBlocks(){
  return blocks.map(
    (block,index)=>({
      ...block,
      id:
        block.id||
        `block-${index}`,
      baseX:block.x,
      baseY:block.y,
      active:true,
      dx:0,
      dy:0
    })
  );
}

function newState(){
  return{
    players:[
      {
        id:1,
        slot:0,
        characterId:
          CharacterSystem.offlineCharacterId(0),
        x:120,
        y:530,
        w:34,
        h:46,
        vx:0,
        vy:0,
        onGround:false,
        reached:false,
        jumpLock:false,
        groundBlockId:null
      },
      {
        id:2,
        slot:1,
        characterId:
          CharacterSystem.offlineCharacterId(1),
        x:200,
        y:530,
        w:34,
        h:46,
        vx:0,
        vy:0,
        onGround:false,
        reached:false,
        jumpLock:false,
        groundBlockId:null
      }
    ],
    runtimeBlocks:createRuntimeBlocks(),
    elapsed:0,
    finished:false,
    result:null
  };
}


function sortedMatchRoster(roster=activeMatchRoster){
  return [...(roster||[])].sort(
    (a,b)=>(a.slot??9999)-(b.slot??9999)
  );
}

function newOnlineMultiplayerState(roster=activeMatchRoster){
  const ordered=sortedMatchRoster(roster);

  const startPlatform=
    currentMap?.path?.[0]||{
      x:60,
      y:585,
      w:240
    };

  const playerWidth=30;
  const usableWidth=Math.max(
    playerWidth,
    startPlatform.w-24
  );

  const players=ordered.map((info,index)=>{
    const center=
      startPlatform.x+
      12+
      ((index+0.5)/Math.max(1,ordered.length))*
      usableWidth;

    return {
      id:index+1,
      playerId:info.playerId,
      slot:Number(info.slot)||0,
      characterId:
        CharacterSystem.characterIdForPlayer(
          info.playerId,
          info.slot,
          info.characterId
        ),
      x:clamp(
        center-playerWidth/2,
        startPlatform.x+5,
        startPlatform.x+startPlatform.w-playerWidth-5
      ),
      y:startPlatform.y-44,
      w:playerWidth,
      h:44,
      vx:0,
      vy:0,
      onGround:false,
      reached:false,
      alive:true,
      eliminatedReason:null,
      jumpLock:false,
      groundBlockId:null
    };
  });

  return{
    players,
    runtimeBlocks:createRuntimeBlocks(),
    elapsed:0,
    finished:false,
    result:null
  };
}

function runtimeVisibilityKey(block){
  const behavior=block.behavior
    ?JSON.stringify(block.behavior)
    :"";

  return [
    Math.round(block.x*10)/10,
    Math.round(block.y*10)/10,
    Math.round(block.w*10)/10,
    Math.round(block.h*10)/10,
    block.kind||"platform",
    behavior
  ].join("|");
}

function decorateBlocksForMultiplayer(blockList,roster=activeMatchRoster){
  const ordered=sortedMatchRoster(roster);
  const slots=ordered.map(player=>Number(player.slot)||0);

  if(slots.length<2){
    return blockList.map(block=>({...block}));
  }

  const groups=new Map();

  blockList.forEach((block,index)=>{
    if(block.kind==="death"||block.type==="blue")return;

    const key=runtimeVisibilityKey(block);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(index);
  });

  const sharedIndexes=new Set();

  for(const indexes of groups.values()){
    const types=new Set(
      indexes.map(index=>blockList[index].type)
    );

    if(indexes.length>=2&&types.has("yellow")&&types.has("red")){
      indexes.forEach(index=>sharedIndexes.add(index));
    }
  }

  let ownerCursor=0;

  return blockList.map((block,index)=>{
    const copy={...block};

    if(block.kind==="death"||block.type==="blue"){
      copy.visibleToAll=true;
      copy.displayColor="#3995ff";
      return copy;
    }

    if(
      block.sharedPlatform===true||
      block.type==="shared"
    ){
      copy.visibleToAll=true;
      copy.sharedPlatform=true;
      copy.displayColor="#9aa6b8";
      copy.displayStroke="#dce3ec";
      return copy;
    }

    if(Number.isInteger(block.ownerIndex)){
      const rosterPlayer=ordered[
        ((block.ownerIndex%ordered.length)+ordered.length)%ordered.length
      ];

      const ownerSlot=Number(rosterPlayer?.slot)||0;

      copy.ownerSlot=ownerSlot;
      copy.visibleSlots=[ownerSlot];
      copy.displayColor=playerColorForSlot(ownerSlot);
      copy.displayStroke=playerStrokeForSlot(ownerSlot);
      return copy;
    }

    if(sharedIndexes.has(index)){
      copy.visibleToAll=true;
      copy.sharedPlatform=true;
      copy.displayColor="#9aa6b8";
      return copy;
    }

    let ownerSlot;

    if(slots.length===2){
      ownerSlot=
        block.type==="red"
          ?slots[1]
          :slots[0];
    }else{
      ownerSlot=slots[ownerCursor%slots.length];
      ownerCursor++;
    }

    copy.ownerSlot=ownerSlot;
    copy.visibleSlots=[ownerSlot];
    copy.displayColor=playerColorForSlot(ownerSlot);
    copy.displayStroke=playerStrokeForSlot(ownerSlot);

    return copy;
  });
}

function activeMatchPlayerIds(){
  const ids=sortedMatchRoster()
    .map(player=>String(player.playerId||""))
    .filter(Boolean);

  return [...new Set(ids)];
}
