// site/modes/batalha/batalha.js

// Importa os mapas do modo course (ajuste o caminho exato do export no seu projeto)
import { mapasCourse } from '../course/mapas.js'; 

const TILE_PAREDE = 1;
const TILE_PORTA_SAIDA = 2;

function gerarMapaBatalha(nivel) {
    const mapaOriginal = mapasCourse[nivel];
    
    // Cria uma cópia profunda para não alterar o mapa original
    let mapaBatalha = JSON.parse(JSON.stringify(mapaOriginal));

    // Remove as portas de saída, transformando-as em paredes
    for (let y = 0; y < mapaBatalha.length; y++) {
        for (let x = 0; x < mapaBatalha[y].length; x++) {
            if (mapaBatalha[y][x] === TILE_PORTA_SAIDA) {
                mapaBatalha[y][x] = TILE_PAREDE; 
            }
        }
    }
    return mapaBatalha;
}

// Lógica de ataque sem restrição de cor ou invisibilidade
export function processarAtaque(jogador, mobs) {
    mobs.forEach(mob => {
        if (verificarColisao(jogador.caixaAtaque, mob.hitbox)) {
            // O mob recebe dano mesmo sendo de outra cor
            mob.receberDano(jogador.poderAtaque);
            if(typeof mob.revelarBrevemente === 'function') {
                mob.revelarBrevemente();
            }
        }
    });
}

// Botão de voltar
document.getElementById('btn-voltar')?.addEventListener('click', () => {
    window.location.href = '../../index.html'; 
});

function iniciarBatalha() {
    const mapaAtual = gerarMapaBatalha(1);
    console.log("Modo Batalha iniciado com mapa limpo.", mapaAtual);
    // Insira aqui a chamada para o loop do seu jogo (requestAnimationFrame)
}

iniciarBatalha();
