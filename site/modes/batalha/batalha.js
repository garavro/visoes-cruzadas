// Ficheiro: site/modes/batalha/batalha.js

// Exemplo de como importar os mapas (descomente e ajuste o caminho quando tiver o ficheiro do percurso)
// import { mapasPercurso } from '../percurso/mapas.js'; 

console.log("Modo Batalha Inicializado com sucesso!");

// --- FUNÇÃO PARA GERAR O MAPA DA BATALHA (Sem Portas) ---
function gerarMapaBatalha(nivel) {
    console.log("Gerando mapa da batalha...");
    
    // Simulação do carregamento do mapa. 
    // Na prática, você usaria o JSON.parse() na variável 'mapasPercurso[nivel]'
    
    /* 
    let mapaBatalha = JSON.parse(JSON.stringify(mapasPercurso[nivel]));
    for (let y = 0; y < mapaBatalha.length; y++) {
        for (let x = 0; x < mapaBatalha[y].length; x++) {
            if (mapaBatalha[y][x] === 2) { // 2 = ID da porta
                mapaBatalha[y][x] = 1; // 1 = ID da Parede (tranca a porta)
            }
        }
    }
    return mapaBatalha;
    */
}

// --- LÓGICA DO BOTÃO VOLTAR ---
document.getElementById('btn-voltar').addEventListener('click', () => {
    // Redireciona de volta para a pasta raiz (ajuste conforme o nome do seu menu principal)
    window.location.href = '../../index.html'; 
});

// Inicialização básica ao carregar a tela
function iniciarBatalha() {
    // Chama as configurações de cenário
    gerarMapaBatalha(1);
    
    // Aqui entrará o seu loop de jogo (requestAnimationFrame)
}

iniciarBatalha();
