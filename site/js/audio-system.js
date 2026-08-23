// site/js/audio-system.js
class AudioManager {
    constructor() {
        // Inicializa o contexto de áudio
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.buffers = {};
        
        // Nós de ganho para controle de volume independente
        this.bgmGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        
        this.bgmGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.ctx.destination);
        
        this.bgmGain.gain.value = 0.4; // 40% de volume para BGM
        this.sfxGain.gain.value = 0.8; // 80% de volume para SFX
        
        this.currentBGM = null;
    }

    // OBRIGATÓRIO: Chame isso no primeiro clique/interação do usuário
    async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    // --- CARREGAMENTO DE ARQUIVOS (BGM ou Efeitos Complexos) ---
    async loadSound(name, url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.buffers[name] = audioBuffer;
    }

    playBGM(name) {
        if (this.currentBGM) this.currentBGM.stop();
        if (!this.buffers[name]) return;

        this.currentBGM = this.ctx.createBufferSource();
        this.currentBGM.buffer = this.buffers[name];
        this.currentBGM.loop = true; // Música de fundo em loop
        this.currentBGM.connect(this.bgmGain);
        this.currentBGM.start();
    }

    playSFX(name) {
        if (!this.buffers[name]) return;
        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers[name];
        source.connect(this.sfxGain);
        source.start();
    }

    // --- SÍNTESE PROCEDURAL (Efeitos 8-bit feitos puramente via código) ---
    playJumpSynth() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = 'square'; // Onda quadrada para som de videogame antigo
        
        // Desliza a frequência de 150Hz para 300Hz rapidamente (som de pulo)
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.1);

        // Fade out rápido
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }
}

// Exporta uma instância global para uso em outros arquivos
window.gameAudio = new AudioManager();
