const ModeSystem=(()=>{
  const API_VERSION=1;
  const registry=new Map();
  const manifests=new Map();
  let loaded=false;
  let loadingPromise=null;

  function assertSafeId(id){
    if(
      typeof id!=="string"||
      !/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)
    ){
      throw new Error(`ID de modo inválido: ${id}`);
    }
  }

  function assertLocalPath(value,label){
    if(
      typeof value!=="string"||
      !value.startsWith("./")||
      value.includes("://")||
      value.includes("..")
    ){
      throw new Error(`${label} deve ser um caminho local relativo.`);
    }
  }

  function normalizeManifest(raw,manifestUrl){
    if(!raw||typeof raw!=="object"){
      throw new Error("Manifesto de modo inválido.");
    }

    const result={
      ...raw,
      id:String(raw.id||""),
      name:String(raw.name||raw.id||"Modo"),
      description:String(raw.description||""),
      apiVersion:Number(raw.apiVersion||1),
      order:Number(raw.order||100),
      enabled:raw.enabled!==false,
      online:raw.online!==false,
      offline:raw.offline!==false,
      minPlayers:Math.max(1,Number(raw.minPlayers||1)),
      maxPlayers:
        raw.maxPlayers===null||
        raw.maxPlayers===undefined
          ?null
          :Math.max(
              1,
              Number(raw.maxPlayers)
            ),
      entry:String(raw.entry||"./index.js"),
      scripts:Array.isArray(raw.scripts)
        ?raw.scripts.map(String)
        :[],
      styles:Array.isArray(raw.styles)
        ?raw.styles.map(String)
        :[],
      bodyClass:String(raw.bodyClass||""),
      accent:String(raw.accent||"secondary"),
      manifestUrl
    };

    assertSafeId(result.id);
    assertLocalPath(result.entry,"entry");

    for(
      const scriptPath
      of result.scripts
    ){
      assertLocalPath(
        scriptPath,
        "scripts[]"
      );
    }

    for(
      const stylePath
      of result.styles
    ){
      assertLocalPath(
        stylePath,
        "styles[]"
      );
    }

    if(result.apiVersion!==API_VERSION){
      throw new Error(
        `Modo ${result.id} exige Mode API ${result.apiVersion}; `+
        `o jogo suporta ${API_VERSION}.`
      );
    }

    return result;
  }

  function resolveRelative(baseUrl,relative){
    return new URL(
      relative,
      baseUrl
    ).href;
  }

  function loadStylesheet(url){
    return new Promise(
      (resolve,reject)=>{
        const existing=
          [...document.querySelectorAll("link[data-mode-style]")]
            .find(
              link=>
                link.href===url
            );

        if(existing){
          resolve();
          return;
        }

        const link=
          document.createElement("link");

        link.rel="stylesheet";
        link.href=url;
        link.dataset.modeStyle="true";

        link.onload=()=>resolve();
        link.onerror=()=>reject(
          new Error(
            `Não foi possível carregar ${url}`
          )
        );

        document.head.appendChild(
          link
        );
      }
    );
  }

  function loadClassicScript(url){
    return new Promise(
      (resolve,reject)=>{
        const script=
          document.createElement("script");

        script.src=url;
        script.async=false;

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

  function register(plugin){
    if(!plugin||typeof plugin!=="object"){
      throw new Error("Plugin de modo inválido.");
    }

    const id=String(plugin.id||"");
    assertSafeId(id);

    if(registry.has(id)){
      throw new Error(
        `Modo duplicado: ${id}`
      );
    }

    registry.set(
      id,
      Object.freeze({
        apiVersion:API_VERSION,
        ...plugin,
        id
      })
    );
  }

  function get(id){
    return registry.get(
      String(id||"")
    )||null;
  }

  function current(){
    return get(gameType);
  }

  function manifest(id){
    return manifests.get(
      String(id||"")
    )||null;
  }

  function currentManifest(){
    return manifest(gameType);
  }

  function list(){
    return [...manifests.values()]
      .filter(item=>item.enabled)
      .sort(
        (a,b)=>
          a.order-b.order||
          a.name.localeCompare(b.name)
      );
  }

  function context(extra={}){
    return{
      apiVersion:API_VERSION,
      get gameType(){return gameType},
      get gameMode(){return gameMode},
      get role(){return role},
      get roomCode(){return roomCode},
      get playerId(){return PLAYER_ID},
      get roster(){return activeMatchRoster},
      get roomPlayers(){return roomPlayers},
      get mySlot(){return myRoomSlot},
      get state(){return state},
      get remoteState(){return remoteState},
      setState(value){state=value},
      setRemoteState(value){remoteState=value},
      $,
      sendGame,
      sendMode(payload,targetId=null){
        sendGame({
          type:"mode-message",
          modeId:gameType,
          payload
        },targetId);
      },
      setScreen,
      hideEnd,
      showEnd,
      setEndActions,
      playerColorForSlot,
      ...extra
    };
  }

  function canStart(id,playerCount){
    const item=manifest(id);
    if(!item)return false;

    const count=
      Math.max(
        0,
        Number(playerCount)||0
      );

    if(count<item.minPlayers){
      return false;
    }

    if(
      item.maxPlayers!==null&&
      count>item.maxPlayers
    ){
      return false;
    }

    const plugin=get(id);

    if(
      typeof plugin?.canStart===
      "function"
    ){
      return plugin.canStart(
        context({
          playerCount:count
        })
      )!==false;
    }

    return true;
  }

  function startLabel(id,playerCount){
    const item=manifest(id);
    if(!item)return "Modo indisponível";

    if(playerCount<item.minPlayers){
      return `Aguardando ${item.minPlayers} jogadores.`;
    }

    if(
      item.maxPlayers!==null&&
      playerCount>item.maxPlayers
    ){
      return `Máximo: ${item.maxPlayers} jogadores.`;
    }

    const plugin=get(id);

    if(
      typeof plugin?.lobbyStatus===
      "function"
    ){
      const value=plugin.lobbyStatus(
        context({
          playerCount
        })
      );

      if(value)return String(value);
    }

    return `${playerCount} jogador(es) conectados. Pronto para iniciar.`;
  }

  async function loadAvailableModes(){
    if(loaded)return list();
    if(loadingPromise)return loadingPromise;

    loadingPromise=(async()=>{
      const registryResponse=
        await fetch(
          "./modes/registry.json",
          {
            cache:"no-store"
          }
        );

      if(!registryResponse.ok){
        throw new Error(
          `Falha ao carregar registry.json (${registryResponse.status}).`
        );
      }

      const index=
        await registryResponse.json();

      if(
        Number(index.schemaVersion)!==1||
        !Array.isArray(index.modes)
      ){
        throw new Error(
          "registry.json possui formato inválido."
        );
      }

      for(const item of index.modes){
        assertLocalPath(
          item.manifest,
          "manifest"
        );

        const manifestUrl=
          resolveRelative(
            registryResponse.url,
            item.manifest
          );

        const response=
          await fetch(
            manifestUrl,
            {
              cache:"no-store"
            }
          );

        if(!response.ok){
          throw new Error(
            `Falha ao carregar manifesto ${item.manifest}.`
          );
        }

        const raw=
          await response.json();

        const data=
          normalizeManifest(
            raw,
            response.url
          );

        if(!data.enabled){
          continue;
        }

        if(
          item.id&&
          item.id!==data.id
        ){
          throw new Error(
            `ID divergente no registro: ${item.id} / ${data.id}`
          );
        }

        manifests.set(
          data.id,
          data
        );

        for(
          const stylePath
          of data.styles
        ){
          await loadStylesheet(
            resolveRelative(
              response.url,
              stylePath
            )
          );
        }

        const scriptPaths=
          data.scripts.length
            ?data.scripts
            :[data.entry];

        for(
          const scriptPath
          of scriptPaths
        ){
          await loadClassicScript(
            resolveRelative(
              response.url,
              scriptPath
            )
          );
        }

        if(!registry.has(data.id)){
          throw new Error(
            `O entry de ${data.id} não chamou ModeSystem.register().`
          );
        }
      }

      loaded=true;
      renderModeMenus();
      return list();
    })();

    try{
      return await loadingPromise;
    }finally{
      loadingPromise=null;
    }
  }

  function buttonClass(item){
    if(item.accent==="yellow"){
      return "yellow";
    }

    if(item.accent==="red"){
      return "red";
    }

    return "secondary";
  }

  function makeModeButton(item,type){
    const button=
      document.createElement("button");

    button.className=
      `modePluginButton ${buttonClass(item)}`;

    const title=
      document.createElement("strong");

    title.textContent=item.name;

    const description=
      document.createElement("small");

    description.textContent=
      item.description||
      (
        type==="online"
          ?"Criar sala online."
          :"Jogar no mesmo dispositivo."
      );

    button.append(
      title,
      description
    );

    if(type==="online"){
      button.onclick=()=>
        createModeRoom(
          item.id
        );
    }else{
      button.onclick=()=>
        launchOfflineMode(
          item.id
        );
    }

    return button;
  }

  function renderModeMenus(){
    const online=
      $("onlineModeButtons");

    const offline=
      $("offlineModeButtons");

    if(online){
      online.innerHTML="";

      for(
        const item
        of list().filter(
          mode=>mode.online
        )
      ){
        online.appendChild(
          makeModeButton(
            item,
            "online"
          )
        );
      }

      if(!online.children.length){
        online.innerHTML=
          '<div class="modePluginError">Nenhum modo online instalado.</div>';
      }
    }

    if(offline){
      offline.innerHTML="";

      for(
        const item
        of list().filter(
          mode=>mode.offline
        )
      ){
        offline.appendChild(
          makeModeButton(
            item,
            "offline"
          )
        );
      }

      if(!offline.children.length){
        offline.innerHTML=
          '<div class="modePluginError">Nenhum modo offline instalado.</div>';
      }
    }

    if($("menuStatus")){
      const names=
        list().map(
          mode=>mode.name
        );

      $("menuStatus").textContent=
        names.length
          ?`Modos instalados: ${names.join(" · ")}`
          :"Nenhum modo foi encontrado.";
    }
  }

  async function hostStart(){
    const plugin=current();

    if(
      typeof plugin?.hostStart!==
      "function"
    ){
      throw new Error(
        `O modo ${gameType} não implementa hostStart().`
      );
    }

    return plugin.hostStart(
      context()
    );
  }

  function clientSession(message){
    const plugin=current();

    if(
      typeof plugin?.clientSession===
      "function"
    ){
      return plugin.clientSession(
        context({
          message
        })
      )===true;
    }

    return false;
  }

  function hostMessage(message,fromPlayerId){
    const plugin=current();

    if(
      typeof plugin?.hostMessage===
      "function"
    ){
      return plugin.hostMessage(
        context({
          message,
          fromPlayerId
        })
      )===true;
    }

    return false;
  }

  function clientMessage(message){
    const plugin=current();

    if(
      typeof plugin?.clientMessage===
      "function"
    ){
      return plugin.clientMessage(
        context({
          message
        })
      )===true;
    }

    return false;
  }

  function update(dt){
    const plugin=current();

    if(
      typeof plugin?.update===
      "function"
    ){
      return plugin.update(
        context({
          dt
        })
      )===true;
    }

    return false;
  }

  function render(){
    const plugin=current();

    if(
      typeof plugin?.render===
      "function"
    ){
      return plugin.render(
        context()
      )===true;
    }

    return false;
  }

  function offlineStart(id){
    const plugin=get(id);

    if(
      typeof plugin?.offlineStart!==
      "function"
    ){
      throw new Error(
        `O modo ${id} não oferece Couch Co-op.`
      );
    }

    return plugin.offlineStart(
      context({
        modeId:id
      })
    );
  }


  function restart(){
    const plugin=current();

    if(
      typeof plugin?.restart===
      "function"
    ){
      return plugin.restart(
        context()
      )===true;
    }

    return false;
  }

  function stop(){
    const plugin=current();

    if(
      typeof plugin?.stop===
      "function"
    ){
      try{
        plugin.stop(
          context()
        );
      }catch(error){
        console.error(
          "Erro ao encerrar modo:",
          error
        );
      }
    }
  }

  function playerLeft(playerId){
    const plugin=current();

    if(
      typeof plugin?.playerLeft===
      "function"
    ){
      return plugin.playerLeft(
        context({
          departedPlayerId:
            String(
              playerId||
              ""
            )
        })
      )===true;
    }

    return false;
  }

  function bodyClassFor(id,base=""){
    const item=manifest(id);
    const parts=[
      base,
      item?.bodyClass||""
    ].filter(Boolean);

    return parts.join(" ");
  }

  function defaultModeId(){
    return list()[0]?.id||
      "course";
  }

  return Object.freeze({
    API_VERSION,
    register,
    get,
    manifest,
    current,
    currentManifest,
    list,
    context,
    canStart,
    startLabel,
    loadAvailableModes,
    renderModeMenus,
    hostStart,
    clientSession,
    hostMessage,
    clientMessage,
    update,
    render,
    offlineStart,
    restart,
    stop,
    playerLeft,
    bodyClassFor,
    defaultModeId
  });
})();

globalThis.ModeSystem=ModeSystem;
