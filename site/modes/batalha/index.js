ModeSystem.registerMode("batalha", {
    onStart: () => {
        // Inicializa o estado do modo Batalha
        window.batalhaState = {
            wave: 1,
            mobs: [],
            spawnTimer: 0
        };
        
        // Substitui a meta do modo corrida por sobrevivência a ondas
        goal = { x: -1000, y: -1000, w: 0, h: 0 }; 
        
        spawnWave(window.batalhaState.wave);
    },
    onStop: () => {
        window.batalhaState = null;
    }
});

function spawnWave(waveNumber) {
    const numMobs = 2 + (waveNumber * 2); // Aumenta a dificuldade a cada onda
    window.batalhaState.mobs = [];
    
    for(let i = 0; i < numMobs; i++) {
        window.batalhaState.mobs.push({
            id: `slime_${i}`,
            x: Math.random() * (WORLD.w - 100) + 50,
            y: 50, // Caem do teto
            w: 40,
            h: 30,
            vx: (Math.random() > 0.5 ? 1 : -1) * (100 + (waveNumber * 10)),
            vy: 0,
            // Metade vermelho (P2), metade amarelo (P1)
            color: i % 2 === 0 ? "yellow" : "red", 
            onGround: false,
            animPhase: Math.random() * 100
        });
    }
}