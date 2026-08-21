# LAVA 0.3

Plugin de modo para Visões Cruzadas V8.9.2.

## Arquivos

- `generator.js`: chunks, seed, plataformas e dificuldade.
- `physics.js`: movimento, lava, eventos e colisões.
- `renderer.js`: câmera, desenho e HUD.
- `index.js`: lifecycle, rede, ranking e integração Mode API.
- `style.css`: interface específica.

## Coordenadas

O eixo vertical é altitude: valores maiores significam mais alto.

A lava e as plataformas são calculadas com o mesmo `elapsed` compartilhado
pela sala.

## Eventos

- `ERUPÇÃO`: aceleração adicional da lava por 7 segundos.
- `VENTANIA`: empurra horizontalmente todos os jogadores por 8 segundos.
