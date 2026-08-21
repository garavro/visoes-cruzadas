# Visões Cruzadas — V9.0 Character Plugin System

A V9.0 adiciona personagens procedurais, animados e extensíveis sem PNG.

## Personagens incluídos

- Clássico
- Robô
- Ninja
- Alien

Todos usam a cor do slot do jogador.

## Animações

O Character System identifica automaticamente:

- `idle`
- `walk`
- `jump`
- `fall`
- `death`

As animações são desenhadas matematicamente no Canvas.

## Funciona em todos os modos

- Percurso
- Sobrevivência
- LAVA
- futuros modos que chamem `CharacterSystem.drawPlayer(...)`

## Couch Co-op

O menu possui escolha separada:

- personagem do jogador principal/P1;
- personagem do P2 offline.

## Multiplayer

A escolha é sincronizada no lobby e incluída em `activeMatchRoster`.

Não é necessário enviar o personagem a cada snapshot.

## Estrutura

```text
site/
├── characters/
│   ├── registry.json
│   ├── classic/
│   ├── robot/
│   ├── ninja/
│   ├── alien/
│   └── _template/
│
└── js/
    └── character-system.js
```

## Criar personagem novo

```bash
cp -r site/characters/_template site/characters/dragao
```

Depois edite:

```text
site/characters/dragao/character.json
site/characters/dragao/renderer.js
```

Execute:

```bash
node tools/build-character-registry.mjs
node tools/validate-characters.mjs
```

## Testar

```bash
node tools/build-character-registry.mjs
node tools/validate-characters.mjs
node tools/build-mode-registry.mjs
node tools/validate-modes.mjs
cd site
python3 -m http.server 8080
```

## GitHub Pages

O workflow agora gera tanto:

```text
modes/registry.json
characters/registry.json
```

antes do deploy.

## Cloudflare / D1

A V9.0 não exige migration e não exige atualização do Worker. A sincronização
da escolha usa o `game-relay` já existente.
