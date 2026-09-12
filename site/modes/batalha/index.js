ModeSystem.register({
  // O ID agora fica dentro do objeto, exatamente como no template
  id: "batalha",

  lobbyStatus({ playerCount }) {
    return `${playerCount} jogador(es) prontos para a batalha.`;
  },

  async hostStart(ctx) {
    // 1. Inicializa o estado da Batalha
    window.batalhaState = {
      wave: 1,
      mobs: [],
      spawnTimer: 0
    };
    
    // 2. Remove a "porta de saída" da fase de corrida original
    if (typeof goal !== 'undefined') {
        goal = { x: -1000, y: -1000, w: 0, h: 0 }; 
    }

    // 3. Gera os primeiros slimes
    this.spawnWave(window.batalhaState.wave);

    // 4. Prepara o estado inicial nativo do jogo e muda a tela
    if (typeof resetMatch === 'function') resetMatch(false);
    gameStarted = true;
    if (typeof setScreen === 'function') setScreen("game");

    // 5. (Se for multiplayer online) Envia o estado inicial para os clientes
    ctx.sendMode({ type: "batalha_start", state: window.batalhaState });

    return true;
  },

  clientSession(ctx) {
    // Apenas confirma que o cliente recebeu a sessão
    return true;
  },

  hostMessage({ message, fromPlayerId }) {
    return false; // Não recebemos mensagens customizadas dos clientes ainda
  },

  clientMessage({ message }) {
    // Cliente recebe o sinal do Host para iniciar
    if (message.type === "batalha_start") {
      window.batalhaState = message.state;
      if (typeof goal !== 'undefined') goal = { x: -1000, y: -1000, w: 0, h: 0 };
      
      gameStarted = true;
      if (typeof setScreen === 'function') setScreen("game");
      return true;
    }
    
    // Cliente recebe as posições dos slimes sincronizadas pelo Host
    if (message.type === "batalha_sync" && window.batalhaState) {
        window.batalhaState.mobs = message.mobs;
        window.batalhaState.wave = message.wave;
        return true;
    }
    
    return false;
  },

  update({ dt }) {
    // Retornamos FALSE para que a física padrão do gameplay.js continue rodando.
    // (Afinal, colocamos a lógica de gravidade do slime direto lá!).
    
    // Sincronização Multiplayer BÁSICA: O Host envia a posição dos mobs pros clientes
    if (typeof role !== 'undefined' && role === "host" && window.batalhaState) {
        const ctx = ModeSystem.context();
        if (ctx && ctx.sendMode) {
            ctx.sendMode({ 
                type: "batalha_sync", 
                mobs: window.batalhaState.mobs, 
                wave: window.batalhaState.wave 
            });
        }
    }
    
    return false; 
  },

  render() {
    // Retornamos FALSE para que o render.js continue pintando a tela e
    // desenhe nossos slimes usando o código que você adicionou lá.
    return false;
  },

  // === FUNÇÕES AUXILIARES DO MODO ===
  spawnWave(waveNumber) {
    const numMobs = 2 + (waveNumber * 2);
    window.batalhaState.mobs = [];
    
    for(let i = 0; i < numMobs; i++) {
        window.batalhaState.mobs.push({
            id: `slime_${i}`,
            x: Math.random() * (1200 - 100) + 50, // Cai em locais aleatórios
            y: 50, 
            w: 40,
            h: 30,
            vx: (Math.random() > 0.5 ? 1 : -1) * (100 + (waveNumber * 10)), // Ficam mais rápidos a cada onda
            vy: 0,
            color: i % 2 === 0 ? "yellow" : "red", // Amarelo ou Vermelho
            onGround: false,
            animPhase: Math.random() * 100, // Cada um pula num tempo diferente
            morto: false
        });
    }
  }
});
