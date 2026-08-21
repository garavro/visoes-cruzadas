# Character API 1 — V9.0

Os personagens são procedurais: não usam PNG nem spritesheet.

## Estrutura

```text
site/characters/
├── registry.json
├── classic/
│   ├── character.json
│   └── renderer.js
├── robot/
├── ninja/
├── alien/
└── _template/
```

## character.json

```json
{
  "id": "robot",
  "name": "Robô",
  "description": "Robô mecânico.",
  "version": "1.0.0",
  "apiVersion": 1,
  "entry": "./renderer.js",
  "enabled": true,
  "order": 20,
  "type": "procedural"
}
```

O `id` precisa ser igual ao nome da pasta.

## renderer.js

```javascript
CharacterSystem.register({
  id: "robot",

  render(ctx, info) {
    const {
      w,
      h,
      color,
      stroke,
      animation,
      time
    } = info;

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
  }
});
```

O renderer desenha em coordenadas locais de `0..w` e `0..h`.

## Estados de animação

O núcleo escolhe automaticamente:

```text
idle
walk
jump
fall
death
```

`info.animation` informa o estado atual.

`info.time` é um relógio em segundos e pode ser usado com `Math.sin()` para
movimentos procedurais.

## Cor

Nunca fixe a cor principal do personagem.

Use:

```javascript
info.color
info.stroke
```

Esses valores vêm do slot do jogador e preservam a mecânica de visão por cor.

## Física

Personagens não alteram:

- velocidade;
- gravidade;
- força do salto;
- hitbox;
- colisões.

A escolha é visual.

## Adicionar personagem

Copie:

```bash
cp -r site/characters/_template site/characters/dragao
```

Edite `character.json` e `renderer.js`.

Depois:

```bash
node tools/build-character-registry.mjs
node tools/validate-characters.mjs
```

No GitHub Actions essas duas etapas são automáticas.

## Multiplayer

Cada jogador envia apenas seu `characterId` durante o lobby. O Host inclui
essa informação no roster inicial da partida.

A escolha não é transmitida em cada frame.
