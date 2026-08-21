ModeSystem.register({
  id:"course",

  lobbyStatus({playerCount}){
    return `${playerCount} jogadores conectados. O Host já pode iniciar o Percurso.`;
  },

  async hostStart(){
    await loadNextMapForPair();
    return true;
  },

  offlineStart(){
    startOfflineGame("course");
    return true;
  }

  /*
    update/render/network continuam usando o adaptador legado da V8.7.
    Novos modos podem implementar esses hooks diretamente.
  */
});
