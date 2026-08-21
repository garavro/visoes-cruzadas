const CharacterSystem=(()=>{
  "use strict";

  const API_VERSION=1;
  const DEFAULT_ID="classic";
  const LOCAL_KEY="vc_character_v1";
  const OFFLINE_P2_KEY="vc_character_p2_v1";

  const renderers=new Map();
  const manifests=new Map();
  const choices=new Map();
  const animationTracks=new Map();

  let loaded=false;
  let loadingPromise=null;

  function assertSafeId(id){
    if(
      typeof id!=="string"||
      !/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)
    ){
      throw new Error(
        `ID de personagem inválido: ${id}`
      );
    }
  }

  function assertLocalPath(value,label){
    if(
      typeof value!=="string"||
      !value.startsWith("./")||
      value.includes("://")||
      value.includes("..")
    ){
      throw new Error(
        `${label} precisa ser um caminho local relativo.`
      );
    }
  }

  function resolveRelative(base,relative){
    return new URL(
      relative,
      base
    ).href;
  }

  function loadClassicScript(url){
    return new Promise(
      (resolve,reject)=>{
        const script=
          document.createElement(
            "script"
          );

        script.src=url;
        script.async=false;
        script.dataset.characterScript=
          "true";

        script.onload=()=>resolve();
        script.onerror=()=>reject(
          new Error(
            `Não foi possível carregar ${url}`
          )
        );

        document.head.appendChild(
          script
        );
      }
    );
  }

  function normalizeManifest(raw,url){
    if(!raw||typeof raw!=="object"){
      throw new Error(
        "Manifesto de personagem inválido."
      );
    }

    const result={
      ...raw,
      id:String(raw.id||""),
      name:String(
        raw.name||
        raw.id||
        "Personagem"
      ),
      description:String(
        raw.description||
        ""
      ),
      apiVersion:Number(
        raw.apiVersion||
        1
      ),
      order:Number(
        raw.order||
        100
      ),
      enabled:
        raw.enabled!==
        false,
      entry:String(
        raw.entry||
        "./renderer.js"
      ),
      manifestUrl:url
    };

    assertSafeId(
      result.id
    );

    assertLocalPath(
      result.entry,
      "entry"
    );

    if(
      result.apiVersion!==
      API_VERSION
    ){
      throw new Error(
        `${result.id} exige Character API ${result.apiVersion}; `+
        `o jogo suporta ${API_VERSION}.`
      );
    }

    return result;
  }

  function register(renderer){
    if(
      !renderer||
      typeof renderer!=="object"
    ){
      throw new Error(
        "Renderer de personagem inválido."
      );
    }

    const id=
      String(
        renderer.id||
        ""
      );

    assertSafeId(id);

    if(
      typeof renderer.render!==
      "function"
    ){
      throw new Error(
        `${id} precisa implementar render().`
      );
    }

    if(renderers.has(id)){
      throw new Error(
        `Personagem duplicado: ${id}`
      );
    }

    renderers.set(
      id,
      Object.freeze({
        ...renderer,
        id
      })
    );
  }

  function get(id){
    return renderers.get(
      String(id||"")
    )||null;
  }

  function manifest(id){
    return manifests.get(
      String(id||"")
    )||null;
  }

  function list(){
    return[
      ...manifests.values()
    ]
    .filter(
      item=>
        item.enabled
    )
    .sort(
      (a,b)=>
        a.order-
        b.order||
        a.name.localeCompare(
          b.name
        )
    );
  }

  function safeStored(
    key,
    fallback
  ){
    try{
      const value=
        localStorage.getItem(
          key
        );

      return value||
        fallback;
    }catch{
      return fallback;
    }
  }

  function selectedId(
    offlineSlot=0
  ){
    const key=
      Number(offlineSlot)===1
        ?OFFLINE_P2_KEY
        :LOCAL_KEY;

    const id=
      safeStored(
        key,
        DEFAULT_ID
      );

    return manifests.has(id)
      ?id
      :DEFAULT_ID;
  }

  function setSelected(
    id,
    offlineSlot=0
  ){
    const value=
      manifests.has(id)
        ?id
        :DEFAULT_ID;

    const key=
      Number(offlineSlot)===1
        ?OFFLINE_P2_KEY
        :LOCAL_KEY;

    try{
      localStorage.setItem(
        key,
        value
      );
    }catch{}

    if(
      Number(
        offlineSlot
      )===0
    ){
      choices.set(
        PLAYER_ID,
        value
      );

      broadcastChoice();
    }

    renderSelectors();

    if(
      typeof renderLobbyRoster===
      "function"&&
      Array.isArray(
        roomPlayers
      )&&
      roomPlayers.length
    ){
      renderLobbyRoster();
    }

    return value;
  }

  function localChoice(){
    return selectedId(0);
  }

  function offlineCharacterId(slot){
    return selectedId(
      Number(slot)===1
        ?1
        :0
    );
  }

  function validId(id){
    return manifests.has(
      String(id||"")
    )
      ?String(id)
      :DEFAULT_ID;
  }

  function applyChoice(
    playerId,
    characterId
  ){
    const pid=
      String(
        playerId||
        ""
      );

    if(!pid)return;

    choices.set(
      pid,
      validId(
        characterId
      )
    );
  }

  function applyChoices(
    array
  ){
    for(
      const item
      of array||
      []
    ){
      applyChoice(
        item.playerId,
        item.characterId
      );
    }
  }

  function applyRoster(
    roster
  ){
    for(
      const player
      of roster||
      []
    ){
      if(
        player?.playerId&&
        player?.characterId
      ){
        applyChoice(
          player.playerId,
          player.characterId
        );
      }
    }
  }

  function characterIdForPlayer(
    playerId,
    fallbackSlot=0,
    explicit=null
  ){
    if(
      explicit&&
      manifests.has(
        explicit
      )
    ){
      return explicit;
    }

    const pid=
      String(
        playerId||
        ""
      );

    if(
      pid&&
      choices.has(pid)
    ){
      return validId(
        choices.get(pid)
      );
    }

    if(
      pid&&
      typeof PLAYER_ID!==
      "undefined"&&
      pid===PLAYER_ID
    ){
      return localChoice();
    }

    if(
      !pid&&
      (
        Number(fallbackSlot)===0||
        Number(fallbackSlot)===1
      )
    ){
      return offlineCharacterId(
        fallbackSlot
      );
    }

    return DEFAULT_ID;
  }

  function nameFor(
    id
  ){
    return(
      manifest(
        validId(id)
      )?.name||
      "Clássico"
    );
  }

  function attachRosterCharacters(
    roster
  ){
    return(
      roster||
      []
    ).map(
      player=>({
        ...player,
        characterId:
          characterIdForPlayer(
            player.playerId,
            player.slot,
            player.characterId
          )
      })
    );
  }

  function exportChoices(
    roster
  ){
    return(
      roster||
      []
    )
    .filter(
      player=>
        player?.playerId
    )
    .map(
      player=>({
        playerId:
          player.playerId,
        characterId:
          characterIdForPlayer(
            player.playerId,
            player.slot,
            player.characterId
          )
      })
    );
  }

  function canSend(){
    return(
      typeof signal!==
      "undefined"&&
      signal&&
      signal.readyState===
      WebSocket.OPEN&&
      typeof sendGame===
      "function"
    );
  }

  function broadcastChoice(){
    if(
      !canSend()||
      typeof role===
      "undefined"||
      !role
    ){
      return;
    }

    const characterId=
      localChoice();

    choices.set(
      PLAYER_ID,
      characterId
    );

    if(role==="host"){
      sendGame({
        type:
          "character-choice-sync",
        playerId:
          PLAYER_ID,
        characterId
      });
    }else if(
      role==="client"
    ){
      sendGame({
        type:
          "character-choice",
        characterId
      });
    }
  }

  function broadcastRoster(
    roster
  ){
    if(
      !canSend()||
      role!=="host"
    ){
      return;
    }

    sendGame({
      type:"character-roster",
      choices:
        exportChoices(
          roster
        )
    });
  }

  function onRosterUpdated(
    roster
  ){
    choices.set(
      PLAYER_ID,
      localChoice()
    );

    if(role==="host"){
      broadcastRoster(
        roster
      );

      /*
        O Host também anuncia sua escolha explicitamente
        para clientes recém-chegados.
      */
      sendGame({
        type:
          "character-choice-sync",
        playerId:
          PLAYER_ID,
        characterId:
          localChoice()
      });
    }else if(
      role==="client"
    ){
      broadcastChoice();
    }
  }

  function trackKey(
    player,
    slot
  ){
    return String(
      player?.playerId||
      `slot-${slot}-${player?.id||0}`
    );
  }

  function animationFor(
    player,
    slot
  ){
    const key=
      trackKey(
        player,
        slot
      );

    const now=
      performance.now()/
      1000;

    const previous=
      animationTracks.get(
        key
      )||{
        facing:1,
        deathAt:null
      };

    const vx=
      Number(
        player?.vx
      )||0;

    if(Math.abs(vx)>5){
      previous.facing=
        vx<0
          ?-1
          :1;
    }

    if(
      player?.alive===
      false
    ){
      if(
        previous.deathAt===
        null
      ){
        previous.deathAt=
          now;
      }
    }else{
      previous.deathAt=
        null;
    }

    animationTracks.set(
      key,
      previous
    );

    let animation=
      "idle";

    const vy=
      Number(
        player?.vy
      )||0;

    if(
      player?.alive===
      false
    ){
      animation="death";
    }else if(
      !player?.onGround
    ){
      if(
        typeof gameType!==
        "undefined"&&
        gameType==="lava"
      ){
        animation=
          vy>25
            ?"jump"
            :vy<-25
              ?"fall"
              :"jump";
      }else{
        animation=
          vy<-25
            ?"jump"
            :vy>25
              ?"fall"
              :"jump";
      }
    }else if(
      Math.abs(vx)>25
    ){
      animation="walk";
    }

    return{
      name:animation,
      time:now,
      facing:
        previous.facing,
      deathAge:
        previous.deathAt===
        null
          ?0
          :Math.max(
              0,
              now-
              previous.deathAt
            )
    };
  }

  function fallbackRender(
    renderCtx,
    info
  ){
    const{
      w,
      h,
      color,
      stroke,
      animation,
      time
    }=info;

    const bob=
      animation==="idle"
        ?Math.sin(
            time*3
          )*.8
        :0;

    renderCtx.fillStyle=
      color;

    renderCtx.strokeStyle=
      stroke;

    renderCtx.lineWidth=2;

    renderCtx.beginPath();
    renderCtx.roundRect(
      2,
      2+bob,
      w-4,
      h-4,
      6
    );
    renderCtx.fill();
    renderCtx.stroke();

    renderCtx.fillStyle=
      "#0d1420";

    renderCtx.fillRect(
      w*.28,
      h*.24+bob,
      4,
      5
    );

    renderCtx.fillRect(
      w*.64,
      h*.24+bob,
      4,
      5
    );
  }

  function drawPlayer(
    renderCtx,
    player,
    options={}
  ){
    if(
      !renderCtx||
      !player
    ){
      return;
    }

    const x=
      Number(
        options.x??
        player.x
      )||0;

    const y=
      Number(
        options.y??
        player.y
      )||0;

    const w=
      Math.max(
        10,
        Number(
          options.w??
          player.w??
          34
        )||34
      );

    const h=
      Math.max(
        12,
        Number(
          options.h??
          player.h??
          46
        )||46
      );

    const slot=
      Number(
        options.slot??
        player.slot??
        (
          Number(
            player.id
          )-
          1
        )??
        0
      )||0;

    const characterId=
      characterIdForPlayer(
        player.playerId,
        slot,
        options.characterId||
        player.characterId
      );

    const color=
      options.color||
      (
        typeof playerColorForSlot===
        "function"
          ?playerColorForSlot(
              slot
            )
          :"#ffd84a"
      );

    const stroke=
      options.stroke||
      (
        typeof playerStrokeForSlot===
        "function"
          ?playerStrokeForSlot(
              slot
            )
          :"#fff0a0"
      );

    const animation=
      animationFor(
        player,
        slot
      );

    const renderer=
      get(characterId);

    renderCtx.save();

    const deathProgress=
      Math.min(
        1,
        animation.deathAge/
        .55
      );

    if(
      player.alive===
      false
    ){
      renderCtx.globalAlpha=
        .38;

      renderCtx.translate(
        x+
        w/2,
        y+
        h/2
      );

      renderCtx.rotate(
        animation.facing*
        deathProgress*
        .72
      );

      const deathScale=
        Math.max(
          .72,
          1-
          deathProgress*
          .18
        );

      renderCtx.scale(
        animation.facing*
        deathScale,
        deathScale
      );

      renderCtx.translate(
        -w/2,
        -h/2
      );
    }else{
      renderCtx.translate(
        x+
        (
          animation.facing<0
            ?w
            :0
        ),
        y
      );

      renderCtx.scale(
        animation.facing,
        1
      );
    }

    const info={
      x:0,
      y:0,
      w,
      h,
      slot,
      color,
      stroke,
      animation:
        animation.name,
      time:
        animation.time,
      deathAge:
        animation.deathAge,
      player,
      characterId
    };

    try{
      if(renderer){
        renderer.render(
          renderCtx,
          info
        );
      }else{
        fallbackRender(
          renderCtx,
          info
        );
      }
    }catch(error){
      console.error(
        `Falha ao desenhar personagem ${characterId}:`,
        error
      );

      fallbackRender(
        renderCtx,
        info
      );
    }

    renderCtx.restore();

    if(
      options.reached||
      player.reached
    ){
      renderCtx.save();
      renderCtx.strokeStyle=
        "#55dc88";
      renderCtx.lineWidth=3;
      renderCtx.strokeRect(
        x-4,
        y-4,
        w+8,
        h+8
      );
      renderCtx.restore();
    }

    if(
      options.showLabel!==
      false
    ){
      renderCtx.save();
      renderCtx.fillStyle=
        "#fff";
      renderCtx.font=
        "bold 12px Arial";

      const label=
        options.label||
        `P${slot+1}`;

      renderCtx.fillText(
        label,
        x+3,
        y-7
      );

      if(
        player.alive===
        false
      ){
        renderCtx.font=
          "bold 16px Arial";

        renderCtx.fillText(
          "☠",
          x+
          w/2-
          6,
          y+
          h/2+
          5
        );
      }

      renderCtx.restore();
    }
  }

  function renderPreview(
    canvas,
    id,
    slot
  ){
    if(!canvas)return;

    const renderCtx=
      canvas.getContext(
        "2d"
      );

    const width=
      canvas.width;

    const height=
      canvas.height;

    renderCtx.clearRect(
      0,
      0,
      width,
      height
    );

    renderCtx.fillStyle=
      "rgba(255,255,255,.035)";

    renderCtx.fillRect(
      0,
      0,
      width,
      height
    );

    const player={
      id:slot+1,
      playerId:
        `preview-${slot}`,
      slot,
      characterId:id,
      x:
        width/2-
        19,
      y:17,
      w:38,
      h:52,
      vx:0,
      vy:0,
      onGround:true,
      alive:true
    };

    drawPlayer(
      renderCtx,
      player,
      {
        x:player.x,
        y:player.y,
        w:player.w,
        h:player.h,
        characterId:id,
        slot,
        showLabel:false
      }
    );

    renderCtx.strokeStyle=
      "rgba(255,255,255,.15)";

    renderCtx.beginPath();
    renderCtx.moveTo(
      15,
      74
    );
    renderCtx.lineTo(
      width-15,
      74
    );
    renderCtx.stroke();
  }

  function createCard(
    item,
    slot
  ){
    const button=
      document.createElement(
        "button"
      );

    button.type="button";
    button.className=
      "characterCard";

    const selected=
      selectedId(slot);

    button.classList.toggle(
      "selected",
      item.id===selected
    );

    const canvas=
      document.createElement(
        "canvas"
      );

    canvas.width=92;
    canvas.height=84;
    canvas.className=
      "characterPreview";

    const title=
      document.createElement(
        "strong"
      );

    title.textContent=
      item.name;

    const description=
      document.createElement(
        "small"
      );

    description.textContent=
      item.description||
      "Personagem procedural.";

    button.append(
      canvas,
      title,
      description
    );

    button.onclick=()=>{
      setSelected(
        item.id,
        slot
      );
    };

    requestAnimationFrame(
      ()=>
        renderPreview(
          canvas,
          item.id,
          slot
        )
    );

    return button;
  }

  function renderSelectors(){
    const main=
      document.getElementById(
        "characterCards"
      );

    const p2=
      document.getElementById(
        "characterCardsP2"
      );

    const current=
      document.getElementById(
        "currentCharacterName"
      );

    const currentP2=
      document.getElementById(
        "currentCharacterNameP2"
      );

    if(current){
      current.textContent=
        nameFor(
          selectedId(0)
        );
    }

    if(currentP2){
      currentP2.textContent=
        nameFor(
          selectedId(1)
        );
    }

    if(main){
      main.innerHTML="";

      for(
        const item
        of list()
      ){
        main.appendChild(
          createCard(
            item,
            0
          )
        );
      }
    }

    if(p2){
      p2.innerHTML="";

      for(
        const item
        of list()
      ){
        p2.appendChild(
          createCard(
            item,
            1
          )
        );
      }
    }
  }

  async function loadAvailableCharacters(){
    if(loaded){
      return list();
    }

    if(loadingPromise){
      return loadingPromise;
    }

    loadingPromise=(async()=>{
      const response=
        await fetch(
          "./characters/registry.json",
          {
            cache:"no-store"
          }
        );

      if(!response.ok){
        throw new Error(
          `Falha ao carregar characters/registry.json (${response.status}).`
        );
      }

      const registry=
        await response.json();

      if(
        Number(
          registry.schemaVersion
        )!==1||
        !Array.isArray(
          registry.characters
        )
      ){
        throw new Error(
          "characters/registry.json inválido."
        );
      }

      for(
        const item
        of registry.characters
      ){
        assertLocalPath(
          item.manifest,
          "manifest"
        );

        const manifestUrl=
          resolveRelative(
            response.url,
            item.manifest
          );

        const manifestResponse=
          await fetch(
            manifestUrl,
            {
              cache:"no-store"
            }
          );

        if(
          !manifestResponse.ok
        ){
          throw new Error(
            `Falha ao carregar ${item.manifest}.`
          );
        }

        const data=
          normalizeManifest(
            await manifestResponse.json(),
            manifestResponse.url
          );

        if(!data.enabled){
          continue;
        }

        if(
          item.id&&
          item.id!==data.id
        ){
          throw new Error(
            `ID divergente no registro de personagens: ${item.id}/${data.id}`
          );
        }

        manifests.set(
          data.id,
          data
        );

        await loadClassicScript(
          resolveRelative(
            manifestResponse.url,
            data.entry
          )
        );

        if(
          !renderers.has(
            data.id
          )
        ){
          throw new Error(
            `${data.id} não chamou CharacterSystem.register().`
          );
        }
      }

      if(
        !manifests.has(
          DEFAULT_ID
        )
      ){
        throw new Error(
          `O personagem obrigatório "${DEFAULT_ID}" não está instalado.`
        );
      }

      choices.set(
        PLAYER_ID,
        selectedId(0)
      );

      loaded=true;
      renderSelectors();

      return list();
    })();

    try{
      return await loadingPromise;
    }finally{
      loadingPromise=null;
    }
  }

  return Object.freeze({
    API_VERSION,
    DEFAULT_ID,
    register,
    get,
    manifest,
    list,
    selectedId,
    setSelected,
    localChoice,
    offlineCharacterId,
    characterIdForPlayer,
    nameFor,
    applyChoice,
    applyChoices,
    applyRoster,
    attachRosterCharacters,
    exportChoices,
    broadcastChoice,
    broadcastRoster,
    onRosterUpdated,
    drawPlayer,
    renderPreview,
    renderSelectors,
    loadAvailableCharacters
  });
})();
