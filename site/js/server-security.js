/*
  V9.1 — sessão segura do servidor.

  O token da API fica apenas em memória. O WebSocket usa um ticket aleatório,
  de uso único e curta duração. role/playerId deixam de ser identidade na URL.
*/
const ServerSecurity=(()=>{
  let apiToken=null;
  let wsTicket=null;
  let expiresAt=0;

  function hasSession(){
    return typeof apiToken==="string"&&apiToken.length>20&&Date.now()<expiresAt;
  }

  function token(){return hasSession()?apiToken:null}

  function takeWsTicket(){
    const value=wsTicket;
    wsTicket=null;
    return value;
  }

  function clear(){
    apiToken=null;
    wsTicket=null;
    expiresAt=0;
  }

  async function createSession({requestedRole,requestedRoomCode=null}){
    const body={
      role:String(requestedRole||""),
      player_id:PLAYER_ID,
      character_id:
        typeof CharacterSystem!=="undefined"
          ?CharacterSystem.localChoice()
          :"classic"
    };

    if(requestedRoomCode){
      body.room_code=String(requestedRoomCode)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g,"")
        .slice(0,8);
    }

    const response=await fetch(API_BASE+"/api/session",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(body),
      cache:"no-store",
      credentials:"omit",
      referrerPolicy:"no-referrer"
    });

    let data=null;
    try{data=await response.json()}catch{data={error:"Resposta inválida do servidor."}}

    if(!response.ok){
      const error=new Error(data?.error||`HTTP ${response.status}`);
      error.status=response.status;
      throw error;
    }

    if(!data?.api_token||!data?.ws_ticket||!data?.room_code){
      throw new Error("Servidor não retornou uma sessão válida.");
    }

    apiToken=String(data.api_token);
    wsTicket=String(data.ws_ticket);
    expiresAt=Number(data.expires_at)||(Date.now()+60*60*1000);

    return{
      roomCode:String(data.room_code),
      role:String(data.role||requestedRole),
      expiresAt
    };
  }

  return Object.freeze({hasSession,token,takeWsTicket,clear,createSession});
})();
