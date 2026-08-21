ModeSystem.register({
  id:"survival",

  lobbyStatus({playerCount}){
    return `${playerCount} jogadores conectados. O Host já pode iniciar a Sobrevivência.`;
  },

  hostStart(){
    state=
      newSurvivalState(
        activeMatchRoster
      );

    remoteState=
      newSurvivalState(
        activeMatchRoster
      );

    setSurvivalClockAnchor(0);
    survivalValidationByPlayer.clear();

    gameStarted=true;
    matchStarting=false;

    startGame();
    return true;
  },

  clientSession(){
    if(gameStarted){
      return true;
    }

    state=
      newSurvivalState(
        activeMatchRoster
      );

    remoteState=
      newSurvivalState(
        activeMatchRoster
      );

    setSurvivalClockAnchor(0);
    initializeLocalDistributedSurvivalPlayer();

    gameStarted=true;
    startGame();

    return true;
  },

  offlineStart(){
    startOfflineGame("survival");
    return true;
  }
});
