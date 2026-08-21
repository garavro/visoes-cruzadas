const SIGNAL_SERVER="wss://visoes-cruzadas-server.gd91639.workers.dev";
const WORLD={w:1200,h:680},GRAVITY=1850,MOVE_SPEED=315,JUMP_SPEED=680,SNAPSHOT_RATE=30;
let blocks=[
{x:60,y:585,w:250,h:28,type:"yellow"},
{x:60,y:585,w:250,h:28,type:"red"}
],goal={x:1060,y:215,w:70,h:70};
const $=id=>document.getElementById(id),canvas=$("canvas"),ctx=canvas.getContext("2d"),offlineCanvasP1=$("offlineCanvasP1"),offlineCtxP1=offlineCanvasP1.getContext("2d"),offlineCanvasP2=$("offlineCanvasP2"),offlineCtxP2=offlineCanvasP2.getContext("2d");
let role=null,roomCode=null,signal=null,pc=null,channel=null,state=null,remoteState=null,keys={},touchInput={left:false,right:false,jump:false},remoteInput={left:false,right:false,jump:false},lastTime=performance.now(),accumulator=0,gameStarted=false;
let roomPlayers=[];
let myRoomSlot=null;
let activePeerId=null;
let activeMatchRoster=[];
let matchStarting=false;
let transportMode="websocket";
const hostPeerConnections=new Map();
const hostChannels=new Map();
const hostPendingIce=new Map();
let clientPendingIce=[];
const remoteInputsByPlayer=new Map();
const distributedValidationByPlayer=new Map();
let localDistributedPlayer=null;
let distributedStateSeq=0;
let distributedSendAccumulator=0;
let distributedLastCorrectionAt=0;
let courseClockAnchorElapsed=0;
let courseClockAnchorPerf=performance.now();

let localDistributedSurvivalPlayer=null;
let survivalDistributedSeq=0;
let survivalDistributedSendAccumulator=0;
const survivalValidationByPlayer=new Map();
let survivalClockAnchorElapsed=0;
let survivalClockAnchorPerf=performance.now();

let matchStartWatchTimer=null;
let currentMap=null;
let mapWasCompleted=false;
let remotePlayerId=null;
let mapLoadInProgress=false;
let playerPlayedCount=0;
let gameMode="online";
let gameType="course";
let offlinePlayedCount=0;
let survivalBestTime=Number(localStorage.getItem("vc_survival_best_v1")||0);
let offlineTouchInput1={left:false,right:false,jump:false};
let offlineTouchInput2={left:false,right:false,jump:false};
const OFFLINE_PLAYED_STORAGE="vc_offline_played_v1";
const OFFLINE_APPROVED_STORAGE="vc_offline_approved_v1";
const GENERATOR_VERSION=4;
const STORAGE_REJECTED="vc_rejected_maps_v4";
const API_BASE=SIGNAL_SERVER.replace(/^wss:/,"https:").replace(/^ws:/,"http:");
const PLAYER_ID=getOrCreatePlayerId();


function safeReadStorage(key){
  try{
    const raw=localStorage.getItem(key);
    return raw?JSON.parse(raw):[];
  }catch{
    return [];
  }
}

function safeWriteStorage(key,value){
  try{
    localStorage.setItem(key,JSON.stringify(value));
  }catch(error){
    console.warn("Falha no armazenamento local:",error);
  }
}

function getOrCreatePlayerId(){
  const key="vc_player_id_v1";
  try{
    let id=localStorage.getItem(key);
    if(id)return id;

    id=(crypto&&crypto.randomUUID)
      ?crypto.randomUUID()
      :"p-"+Date.now()+"-"+Math.random().toString(36).slice(2);

    localStorage.setItem(key,id);
    return id;
  }catch{
    return "temp-"+Date.now()+"-"+Math.random().toString(36).slice(2);
  }
}


function formatSurvivalTime(seconds){
  const value=Math.max(0,Number(seconds)||0);
  const minutes=Math.floor(value/60);
  const secs=Math.floor(value%60);
  const tenths=Math.floor((value-Math.floor(value))*10);

  return `${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")}.${tenths}`;
}

function updateSurvivalTimer(seconds){
  const timer=$("survivalTimer");
  if(!timer)return;

  timer.textContent=
    `Tempo: ${formatSurvivalTime(seconds)}`;
}

function updatePhaseCounter(){
  const counter=$("phaseCounter");
  if(!counter)return;

  if(gameType==="survival"){
    counter.textContent=
      `Recorde: ${formatSurvivalTime(survivalBestTime)}`;
    return;
  }

  counter.textContent=
    gameMode==="offline"
      ?`Fases offline: ${offlinePlayedCount}`
      :`Fases jogadas: ${playerPlayedCount}`;
}

async function refreshPlayerProgress(){
  if(gameType==="survival"){
    updatePhaseCounter();
    return;
  }

  if(gameMode==="offline"){
    updatePhaseCounter();
    return;
  }

  if(typeof ServerSecurity==="undefined"||!ServerSecurity.hasSession()){
    updatePhaseCounter();
    return;
  }

  try{
    const stats=await apiFetch("/api/player/stats");
    playerPlayedCount=Number(stats?.played||0);
    updatePhaseCounter();
  }catch(error){
    console.warn("Não foi possível carregar o contador de fases:",error);
    updatePhaseCounter();
  }
}

async function apiFetch(path,options={}){
  const token=typeof ServerSecurity!=="undefined"?ServerSecurity.token():null;
  if(!token){
    const error=new Error("Sessão segura não está ativa.");
    error.status=401;
    throw error;
  }

  const response=await fetch(API_BASE+path,{
    ...options,
    cache:"no-store",
    credentials:"omit",
    referrerPolicy:"no-referrer",
    headers:{
      "content-type":"application/json",
      "authorization":`Bearer ${token}`,
      ...(options.headers||{})
    }
  });

  let data=null;
  try{data=await response.json()}catch{data={error:await response.text().catch(()=>response.statusText)}}

  if(!response.ok){
    const error=new Error(data?.error||`HTTP ${response.status}`);
    error.status=response.status;
    throw error;
  }
  return data;
}
