/*
  TEMPLATE V8.8

  1. Copie a pasta _template para:
       site/modes/nome-do-modo/

  2. Edite mode.json:
       id, name, enabled:true

  3. Implemente os hooks abaixo.

  4. Execute:
       node tools/build-mode-registry.mjs

  O GitHub Action faz a etapa 4 automaticamente no deploy.
*/

ModeSystem.register({
  id:"meu-modo",

  lobbyStatus({playerCount}){
    return `${playerCount} jogador(es) prontos.`;
  },

  async hostStart(ctx){
    /*
      Crie o estado inicial e depois:
      ctx.sendMode({type:"start", state:{...}});
      gameStarted=true;
      setScreen("game");
    */
    console.log("Implemente hostStart do novo modo.",ctx);
    return true;
  },

  clientSession(ctx){
    /*
      Chamado quando o cliente recebe a sessão.
      Retorne true se o plugin tratou a inicialização.
    */
    return true;
  },

  hostMessage({message,fromPlayerId}){
    /*
      Mensagens genéricas enviadas com:
      ModeSystem.context().sendMode(payload)
    */
    return false;
  },

  clientMessage({message}){
    return false;
  },

  update({dt}){
    /*
      Se retornar true, o loop principal considera
      que este plugin executou a atualização do frame.
    */
    return true;
  },

  render(){
    /*
      Se retornar true, o renderizador legado não é usado.
    */
    return true;
  }
});
