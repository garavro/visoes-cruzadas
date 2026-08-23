class ProceduralAudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Controles de volume
        this.bgmGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        
        this.bgmGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.ctx.destination);
        
        this.bgmGain.gain.value = 0.2; // Volume da música
        this.sfxGain.gain.value = 0.5; // Volume dos efeitos
        
        this.bgmInterval = null;
        
        // Gera um buffer de ruído branco via código (necessário para explosões)
        this.noiseBuffer = this._createNoiseBuffer();
    }

    async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    // --- GERADOR DE RUÍDO BRANCO ---
    _createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2; // 2 segundos
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1; // Valores entre -1 e 1
        }
        return buffer;
    }

    // --- EFEITOS SONOROS (SFX) ---

    playShoot() {
        // Onda quadrada com queda rápida de frequência (Laser/Pew)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = 'square';
        const now = this.ctx.currentTime;

        // Frequência cai de 880Hz para 110Hz
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);

        // Volume cai até silenciar
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    playJump() {
        // Onda quadrada com subida rápida de frequência
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = 'square';
        const now = this.ctx.currentTime;

        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    playExplosion() {
        // Usa o buffer de ruído e aplica um filtro LowPass (abafa o som)
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';

        const gain = this.ctx.createGain();

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        const now = this.ctx.currentTime;

        // O filtro "fecha", cortando os agudos progressivamente
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);

        // Volume cai rapidamente
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        noise.start(now);
        noise.stop(now + 0.3);
    }

    playHit() {
        // Onda dente de serra grave, curta e abrupta
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = 'sawtooth';
        const now = this.ctx.currentTime;

        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    playVictory() {
        // Sequência de notas para um acorde maior e triunfante (C4, E4, G4, C5)
        const notes = [261.63, 329.63, 392.00, 523.25];
        const now = this.ctx.currentTime;
        
        notes.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.type = 'square';
            
            const startTime = now + (index * 0.1);
            const stopTime = startTime + 0.15;
            
            osc.frequency.setValueAtTime(freq, startTime);
            
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
            
            // >>> CORREÇÃO: O start precisa vir ANTES do stop no código <<<
            osc.start(startTime);
            
            // Agora sim podemos agendar quando ele vai parar
            if (index === notes.length - 1) {
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.6);
                osc.stop(startTime + 0.6);
            } else {
                gain.gain.linearRampToValueAtTime(0, stopTime);
                osc.stop(stopTime);
            }
        });
    }
    
    // --- MÚSICA DE FUNDO PROCEDURAL (BGM) ---

    startProceduralBGM() {
        if (this.bgmInterval) return; // Evita múltiplas faixas sobrepostas

        // Frequências de uma escala pentatônica menor (típica de jogos de ação)
        const notes = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00];
        
        // Uma sequência simples de índices para criar uma melodia repetitiva
        const sequence = [0, 2, 1, 3, 2, 4, 3, 5];
        let step = 0;

        // Cria um sequenciador simples usando setInterval
        this.bgmInterval = setInterval(() => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.connect(gain);
            gain.connect(this.bgmGain);
            
            osc.type = 'triangle'; // Triângulo gera um som mais "doce", ideal para chiptune BGM
            
            const noteIndex = sequence[step % sequence.length];
            const frequency = notes[noteIndex];
            
            const now = this.ctx.currentTime;
            osc.frequency.setValueAtTime(frequency, now);
            
            // Envelope de volume (Attack-Decay)
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.3, now + 0.02); 
            gain.gain.linearRampToValueAtTime(0, now + 0.15);
            
            osc.start(now);
            osc.stop(now + 0.15);
            
            step++;
        }, 150); // Velocidade (150ms por nota = 400 BPM)
    }

    stopBGM() {
        if (this.bgmInterval) {
            clearInterval(this.bgmInterval);
            this.bgmInterval = null;
        }
    }
}

// Instância global
window.gameAudio = new ProceduralAudioManager();
