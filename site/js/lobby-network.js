function roomColorSeed(){
  const text=String(roomCode||"LOCAL");
  let hash=2166136261;

  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }

  return Math.abs(hash)%360;
}

function playerHueForSlot(slot){
  const base=roomColorSeed();
  let hue=(base+(Number(slot)||0)*137.508)%360;

  /* Azul permanece reservado exclusivamente aos blocos mortais. */
  if(hue>=185&&hue<=255){
    hue=(hue+78)%360;
  }

  if(hue>=185&&hue<=255){
    hue=(hue+110)%360;
  }

  return hue;
}

function playerColorForSlot(slot){
  const hue=playerHueForSlot(slot);
  return `hsl(${hue.toFixed(1)} 82% 56%)`;
}

function playerStrokeForSlot(slot){
  const hue=playerHueForSlot(slot);
  return `hsl(${hue.toFixed(1)} 90% 76%)`;
}

function getRoomPlayer(playerId){
  return roomPlayers.find(
    player=>player.playerId===playerId
  )||null;
}

function renderLobbyRoster(){
  const list=$("playerList");
  const count=$("playerCountBadge");
  const start=$("startLobbyGame");

  if(!list||!count||!start)return;

  const ordered=[...roomPlayers].sort(
    (a,b)=>(a.slot??9999)-(b.slot??9999)
  );

  count.textContent=String(ordered.length);
  list.innerHTML="";

  for(const player of ordered){
    const card=document.createElement("div");
    card.className="playerLobbyCard";

    const dot=document.createElement("div");
    dot.className="playerColorDot";
    dot.style.background=playerColorForSlot(player.slot);

    const meta=document.createElement("div");
    meta.className="playerLobbyMeta";

    const name=document.createElement("div");
    name.className="playerLobbyName";

    const number=(Number(player.slot)||0)+1;
    const isMe=player.playerId===PLAYER_ID;

    name.textContent=
      `Jogador ${number}${player.role==="host"?" · HOST":""}${isMe?" · VOCÊ":""}`;

    const id=document.createElement("div");
    id.className="playerLobbyId";
    id.textContent=player.playerId;

    const character=document.createElement("div");
    character.className="playerCharacterName";

    const characterId=
      CharacterSystem.characterIdForPlayer(
        player.playerId,
        player.slot,
        player.characterId
      );

    character.textContent=
      `Personagem: ${CharacterSystem.nameFor(characterId)}`;

    meta.append(
      name,
      character,
      id
    );
    card.append(dot,meta);
    list.append(card);
  }

  const me=getRoomPlayer(PLAYER_ID);
  myRoomSlot=me?.slot??null;

  if(role==="host"){
    start.classList.remove("hidden");

    const clients=ordered.filter(
      player=>player.role==="client"
    );

    const modeCanStart=
      ModeSystem.canStart(
        gameType,
        ordered.length
      );

    start.disabled=
      !modeCanStart||
      matchStarting||
      gameStarted;

    if(ordered.length===1){
      const manifest=
        ModeSystem.currentManifest();

      $("lobbyMessage").textContent=
        `Sala de ${manifest?.name||gameType} criada. Compartilhe o código.`;
    }else{
      $("lobbyMessage").textContent=
        ModeSystem.startLabel(
          gameType,
          ordered.length
        );
    }
  }else{
    start.classList.add("hidden");
    $("lobbyMessage").textContent=
      `${ordered.length} jogador(es) na sala. Aguardando o Host iniciar.`;
  }
}

function resetRoster(){
  roomPlayers=[];
  myRoomSlot=null;
  activePeerId=null;
  activeMatchRoster=[];
  matchStarting=false;
  transportMode="websocket";
  stopMatchStartWatch();
  remoteInputsByPlayer.clear();

  if($("playerList")){
    $("playerList").innerHTML="";
  }

  if($("playerCountBadge")){
    $("playerCountBadge").textContent="0";
  }
}

function orderedCurrentRoster(){
  return [...roomPlayers].sort(
    (a,b)=>(a.slot??9999)-(b.slot??9999)
  );
}

function activeClientIds(){
  return activeMatchRoster
    .filter(player=>player.role==="client")
    .map(player=>player.playerId);
}

async function beginLobbyGame(){
  if(
    role!=="host"||
    matchStarting||
    gameStarted
  ){
    return;
  }

  const ordered=
    orderedCurrentRoster();

  const clients=
    ordered.filter(
      player=>
        player.role==="client"
    );

  if(
    !ModeSystem.canStart(
      gameType,
      ordered.length
    )
  ){
    $("lobbyMessage").textContent=
      ModeSystem.startLabel(
        gameType,
        ordered.length
      );
    return;
  }

  activeMatchRoster=
    ordered.map(
      player=>({
        playerId:
          player.playerId,
        role:
          player.role,
        slot:
          Number(
            player.slot
          )||0,
        characterId:
          CharacterSystem.characterIdForPlayer(
            player.playerId,
            player.slot,
            player.characterId
          )
      })
    );

  CharacterSystem.applyRoster(
    activeMatchRoster
  );

  matchStarting=true;
  transportMode="websocket";

  /*
    Cada cliente terá seu próprio estado de input,
    mas todos os pacotes trafegam pelo WebSocket da sala.
  */
  remoteInputsByPlayer.clear();

  for(
    const player
    of clients
  ){
    remoteInputsByPlayer.set(
      player.playerId,
      {
        left:false,
        right:false,
        jump:false
      }
    );
  }

  $("startLobbyGame").disabled=true;
  $("lobbyMessage").textContent=
    `Servidor da sala pronto. Iniciando ${ordered.length} jogadores...`;

  try{
    /*
      A sessão é enviada primeiro para que cada cliente conheça
      o roster e seu slot antes de receber o mapa.
    */
    sendGame({
      type:"session",
      gameType,
      roster:
        activeMatchRoster,
      transport:
        "websocket"
    });

    await ModeSystem.hostStart();

  }catch(error){
    console.error(
      "Falha ao iniciar partida via WebSocket:",
      error
    );

    matchStarting=false;

    $("startLobbyGame").disabled=
      false;

    $("lobbyMessage").textContent=
      "Falha ao iniciar a partida: "+
      error.message;
  }
}

function allMatchChannelsOpen(){
  const ids=
    activeClientIds();

  if(ids.length===0){
    return false;
  }

  return ids.every(
    playerId=>{
      const channel=
        hostChannels.get(
          playerId
        );

      return channel&&
        channel.readyState===
        "open";
    }
  );
}

async function maybeStartHostMatch(){
  if(
    role!=="host"||
    gameStarted||
    !matchStarting||
    !allMatchChannelsOpen()
  ){
    return;
  }

  stopMatchStartWatch();

  $("lobbyMessage").textContent=
    "Todas as conexões P2P estão prontas. Carregando a partida...";

  sendGame({
    type:"session",
    gameType,
    roster:activeMatchRoster
  });

  await ModeSystem.hostStart();
}

function randomRoom(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let o="";for(let i=0;i<6;i++)o+=c[Math.floor(Math.random()*c.length)];return o}
function setScreen(n){$("menu").classList.toggle("active",n==="menu");$("game").classList.toggle("active",n==="game");if(n==="game")requestAnimationFrame(resizeCanvas)}
function showLobby(){
  $("home").classList.add("hidden");
  $("lobby").classList.remove("hidden");
  $("roomCode").textContent=roomCode;
  $("lobbyTitle").textContent=role==="host"?"Sala multiplayer criada":"Entrando na sala multiplayer";
  $("lobbyMessage").textContent=role==="host"?"Compartilhe este código. A sala agora aceita vários jogadores.":"Conectando à sala...";
  resetRoster();
}
function resetPresence(){resetRoster()}
function createModeRoom(modeId){
  const manifest=
    ModeSystem.manifest(
      modeId
    );

  if(
    !manifest||
    !manifest.online
  ){
    $("menuStatus").textContent=
      "Este modo não oferece multiplayer online.";
    return;
  }

  gameMode="online";
  gameType=modeId;
  roomCode=randomRoom();
  role="host";

  document.body.className=
    ModeSystem.bodyClassFor(
      modeId,
      "role-host"
    );

  updateMapPanelForRole();
  showLobby();

  $("lobbyMessage").textContent=
    `${manifest.name}. Compartilhe o código da sala.`;

  connectSignal();
}

function launchOfflineMode(modeId){
  const manifest=
    ModeSystem.manifest(
      modeId
    );

  if(
    !manifest||
    !manifest.offline
  ){
    $("menuStatus").textContent=
      "Este modo não oferece Couch Co-op.";
    return;
  }

  ModeSystem.offlineStart(
    modeId
  );
}

$("joinRoom").onclick=()=>{
  gameMode="online";
  gameType="waiting";

  const c=
    $("roomInput")
      .value
      .toUpperCase()
      .replace(
        /[^A-Z0-9]/g,
        ""
      )
      .trim();

  if(c.length<4){
    $("menuStatus").textContent=
      "Digite um código válido.";
    return;
  }

  roomCode=c;
  role="client";
  document.body.className=
    "role-client";

  updateMapPanelForRole();
  showLobby();
  connectSignal();
};

$("startLobbyGame").onclick=()=>{beginLobbyGame()};
$("copyRoom").onclick=async()=>{try{await navigator.clipboard.writeText(roomCode)}catch{}};$("leaveLobby").onclick=returnToMenu;$("menuBtn").onclick=returnToMenu;
function returnToMenu(){
  ModeSystem.stop();
  gameStarted=false;
  cleanupConnectionForModeChange();
  gameMode="online";
  gameType=ModeSystem.defaultModeId();
  role=null;
  document.body.className="";
  $("lobby").classList.add("hidden");
  $("home").classList.remove("hidden");
  resetPresence();
  $("canvas").classList.remove("hidden");
  $("offlineViews").classList.add("hidden");
  $("survivalTimer").classList.add("hidden");
  $("mapPanel").classList.remove("hidden");
  setScreen("menu");
}
function connectSignal(){
  const url=
    `${SIGNAL_SERVER}/room/${roomCode}?role=${role}&player_id=${encodeURIComponent(PLAYER_ID)}`;

  console.log("Conectando ao WebSocket:",url);

  try{
    signal=new WebSocket(url);
  }catch(error){
    console.error("Erro ao criar WebSocket:",error);
    $("lobbyMessage").textContent="Não foi possível abrir o WebSocket.";
    return;
  }

  signal.onopen=()=>{
    console.log("WebSocket ABERTO:",signal.url);

    CharacterSystem.broadcastChoice();

    $("lobbyMessage").textContent=
      role==="host"
        ?"Sala criada. Aguardando jogadores..."
        :"Conectado à sala. Aguardando lista de jogadores...";
  };

  signal.onmessage=async e=>{
    if(e.data==="pong")return;

    let m;
    try{
      m=JSON.parse(e.data);
    }catch{
      return;
    }

    console.log("Sinal recebido:",m.type,m);

    if(m.type==="game-relay"){
      transportMode="websocket";

      await handleWebSocketGameMessage(
        m.payload,
        String(
          m.from||
          ""
        )
      );

      return;
    }

    if(m.type==="presence"||m.type==="roster"){
      if(m.type==="presence"&&!Array.isArray(m.players)){
        roomPlayers=[];
        $("playerCountBadge").textContent="—";
        $("playerList").innerHTML=
          '<div class="status" style="color:#ff9aa4">Worker antigo detectado. Publique o Worker V8.1.</div>';
        $("lobbyMessage").textContent=
          "Servidor antigo detectado: atualize o Cloudflare Worker.";
        return;
      }

      roomPlayers=Array.isArray(m.players)?m.players:[];

      CharacterSystem.onRosterUpdated(
        roomPlayers
      );

      renderLobbyRoster();
      return;
    }

    if(m.type==="offer"&&role==="client"){
      activePeerId=String(m.from||"");

      await createClientPeerConnection(
        activePeerId
      );

      await pc.setRemoteDescription(
        m.sdp
      );

      await flushClientIce();

      const answer=
        await pc.createAnswer();
      await pc.setLocalDescription(answer);

      signalSend({
        type:"answer",
        to:activePeerId,
        sdp:pc.localDescription
      });
      return;
    }

    if(m.type==="answer"&&role==="host"){
      const peerId=
        String(
          m.from||
          ""
        );

      const peerPc=
        hostPeerConnections.get(
          peerId
        );

      if(peerPc){
        try{
          await peerPc.setRemoteDescription(
            m.sdp
          );

          await flushHostIce(
            peerId
          );
        }catch(error){
          console.error(
            "Erro ao aplicar answer do cliente:",
            peerId,
            error
          );
        }
      }

      return;
    }

    if(m.type==="ice-candidate"&&m.candidate){
      if(role==="host"){
        const peerId=
          String(
            m.from||
            ""
          );

        const peerPc=
          hostPeerConnections.get(
            peerId
          );

        if(!peerPc){
          hostIceQueue(
            peerId
          ).push(
            m.candidate
          );

          return;
        }

        if(
          !peerPc.remoteDescription
        ){
          hostIceQueue(
            peerId
          ).push(
            m.candidate
          );

          return;
        }

        try{
          await peerPc.addIceCandidate(
            m.candidate
          );
        }catch(error){
          console.warn(
            "Erro ICE no Host:",
            peerId,
            error
          );
        }

        return;
      }

      /*
        Em WebRTC, o candidato pode chegar enquanto o callback da offer
        ainda está executando. Guardamos o candidato até
        setRemoteDescription() terminar.
      */
      if(
        !pc||
        !pc.remoteDescription
      ){
        clientPendingIce.push(
          m.candidate
        );

        return;
      }

      try{
        await pc.addIceCandidate(
          m.candidate
        );
      }catch(error){
        console.warn(
          "Erro ICE no Cliente:",
          error
        );
      }

      return;
    }

    if(m.type==="peer-left"){
      const departedId=String(m.playerId||"");

      if(role==="host"){
        closeHostPeer(departedId);

        const pluginHandled=
          gameStarted&&
          ModeSystem.playerLeft(
            departedId
          );

        if(
          gameStarted&&
          !pluginHandled
        ){
          const player=
            state.players?.find(
              p=>
                p.playerId===
                departedId
            );

          if(player){
            player.connected=false;

            if(
              player.alive!==
              false
            ){
              if(gameType==="survival"){
                eliminateSurvivalPlayer(
                  player,
                  "desconectou da sala"
                );
              }else if(gameType==="course"){
                eliminateMultiplayerPlayer(
                  player,
                  "desconectou da sala"
                );
              }
            }
          }
        }
      }else if(departedId===activePeerId){
        $("netText").textContent="Host desconectado";
        if(gameStarted){
          showEnd(
            "Conexão encerrada",
            "O Host saiu da sala."
          );
        }
        cleanupRTC();
      }

      return;
    }
  };

  signal.onerror=event=>{
    console.error("WebSocket ERROR:",event);
    $("lobbyMessage").textContent="Erro na conexão WebSocket. Veja o console.";
  };

  signal.onclose=event=>{
    console.log("WebSocket fechado:",{
      code:event.code,
      reason:event.reason,
      wasClean:event.wasClean
    });

    if(!gameStarted){
      $("lobbyMessage").textContent=
        `WebSocket fechado — código ${event.code}`+
        (event.reason?` — ${event.reason}`:"");
    }
  };
}

function signalSend(o){
  if(signal&&signal.readyState===WebSocket.OPEN){
    signal.send(JSON.stringify(o));
  }
}


function openMatchChannelIds(){
  return activeClientIds().filter(
    playerId=>
      hostChannels.get(playerId)?.readyState==="open"
  );
}

function updateMatchStartProgress(){
  if(
    role!=="host"||
    !matchStarting||
    gameStarted
  ){
    return;
  }

  const ids=
    activeClientIds();

  const opened=
    openMatchChannelIds();

  $("lobbyMessage").textContent=
    `Preparando conexões P2P: ${opened.length}/${ids.length} prontas.`;
}

function stopMatchStartWatch(){
  if(matchStartWatchTimer){
    clearInterval(
      matchStartWatchTimer
    );

    matchStartWatchTimer=null;
  }
}

function startMatchStartWatch(){
  stopMatchStartWatch();

  const startedAt=
    performance.now();

  matchStartWatchTimer=
    setInterval(
      async()=>{
        if(
          !matchStarting||
          gameStarted||
          role!=="host"
        ){
          stopMatchStartWatch();
          return;
        }

        updateMatchStartProgress();

        await maybeStartHostMatch();

        if(
          performance.now()-
          startedAt>
          20000
        ){
          const ids=
            activeClientIds();

          const opened=
            openMatchChannelIds();

          const missing=
            ids.filter(
              id=>
                !opened.includes(id)
            );

          console.warn(
            "Timeout preparando a partida.",
            {
              opened,
              missing
            }
          );

          matchStarting=false;
          stopMatchStartWatch();

          $("startLobbyGame").disabled=
            false;

          $("lobbyMessage").textContent=
            `Não foi possível abrir todas as conexões P2P (${opened.length}/${ids.length}). Clique em Iniciar partida para tentar novamente.`;
        }
      },
      400
    );
}

function hostIceQueue(peerId){
  if(
    !hostPendingIce.has(peerId)
  ){
    hostPendingIce.set(
      peerId,
      []
    );
  }

  return hostPendingIce.get(
    peerId
  );
}

async function flushHostIce(peerId){
  const peerPc=
    hostPeerConnections.get(
      peerId
    );

  if(
    !peerPc||
    !peerPc.remoteDescription
  ){
    return;
  }

  const queue=
    hostIceQueue(
      peerId
    );

  while(queue.length){
    const candidate=
      queue.shift();

    try{
      await peerPc.addIceCandidate(
        candidate
      );
    }catch(error){
      console.warn(
        "Falha ao aplicar ICE do cliente:",
        peerId,
        error
      );
    }
  }
}

async function flushClientIce(){
  if(
    !pc||
    !pc.remoteDescription
  ){
    return;
  }

  while(
    clientPendingIce.length
  ){
    const candidate=
      clientPendingIce.shift();

    try{
      await pc.addIceCandidate(
        candidate
      );
    }catch(error){
      console.warn(
        "Falha ao aplicar ICE do Host:",
        error
      );
    }
  }
}

function rtcConfig(){
  return{
    iceServers:[
      {urls:"stun:stun.l.google.com:19302"},
      {urls:"stun:stun1.l.google.com:19302"}
    ]
  };
}

async function createHostPeerConnection(peerId){
  closeHostPeer(peerId);

  hostPendingIce.set(
    peerId,
    []
  );

  const peerPc=
    new RTCPeerConnection(
      rtcConfig()
    );

  hostPeerConnections.set(
    peerId,
    peerPc
  );

  peerPc.onicecandidate=e=>{
    if(e.candidate){
      signalSend({
        type:"ice-candidate",
        to:peerId,
        candidate:e.candidate
      });
    }
  };

  peerPc.onconnectionstatechange=()=>{
    const s=
      peerPc.connectionState;

    console.log(
      "P2P Host ->",
      peerId,
      s
    );

    if(
      s==="failed"||
      s==="disconnected"
    ){
      $("netText").textContent=
        "Uma conexão está instável";
    }

    if(s==="connected"){
      updateMatchStartProgress();
      maybeStartHostMatch();
    }

    if(s==="closed"){
      closeHostPeer(
        peerId,
        false
      );
    }
  };

  const ch=peerPc.createDataChannel(
    "game",
    {ordered:true}
  );

  bindDataChannel(ch,peerId);

  const offer=await peerPc.createOffer();
  await peerPc.setLocalDescription(offer);

  signalSend({
    type:"offer",
    to:peerId,
    sdp:peerPc.localDescription
  });

  return peerPc;
}

async function createClientPeerConnection(hostId){
  try{
    channel?.close();
  }catch{}

  try{
    pc?.close();
  }catch{}

  channel=null;
  clientPendingIce=[];

  pc=
    new RTCPeerConnection(
      rtcConfig()
    );

  activePeerId=
    hostId;

  pc.onicecandidate=e=>{
    if(e.candidate){
      signalSend({
        type:"ice-candidate",
        to:activePeerId,
        candidate:e.candidate
      });
    }
  };

  pc.onconnectionstatechange=()=>{
    const s=pc.connectionState;

    if(s==="failed"||s==="disconnected"){
      $("netText").textContent="Conexão instável";
    }

    if(s==="connected"){
      $("netText").textContent="Conectado";
    }
  };

  pc.ondatachannel=e=>
    bindDataChannel(e.channel,hostId);

  return pc;
}

function closeHostPeer(peerId,closePc=true){
  const ch=hostChannels.get(peerId);
  const peerPc=hostPeerConnections.get(peerId);

  if(closePc){
    try{ch?.close()}catch{}
    try{peerPc?.close()}catch{}
  }

  hostChannels.delete(peerId);
  hostPeerConnections.delete(peerId);
  hostPendingIce.delete(peerId);
  remoteInputsByPlayer.delete(peerId);
}
