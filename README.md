# Visões Cruzadas — V9.0.1

Atualização focada exclusivamente no multiplayer: **anti-trapaça tolerante +
suavização de rede**.

## O que mudou

- o Host não trata pequenas divergências como trapaça;
- tolerância considera intervalo real entre pacotes e sequências perdidas;
- correções moderadas são limitadas e enviadas como `soft`;
- `soft correction` é aplicada em vários frames, evitando teleporte;
- `hard correction` ficou reservada para estados não finitos ou saltos absurdos;
- snapshots ignoram pequenas diferenças normais da previsão do cliente;
- jogadores remotos recebem interpolação visual;
- Percurso, Sobrevivência e LAVA usam a mesma política;
- plataformas móveis, obstáculos e a Ventania do LAVA têm tolerâncias maiores;
- HUD mostra Ping, Ajustes e Bloqueios para diagnóstico.

## Como interpretar o HUD

Exemplo:

```text
Ping 74ms · Ajustes 2 · Bloqueios 0
```

- `Ajustes`: reconciliações suaves. Alguns são normais.
- `Bloqueios`: correções rígidas por movimento muito fora do plausível.
- Se `Bloqueios` crescer rapidamente durante jogo normal, o validador ainda
  está agressivo demais.

No Host, os números representam decisões do validador. Nos clientes,
representam correções recebidas.

## Anti-trapaça centralizado

Arquivo:

```text
site/js/netcode-smoothing.js
```

No começo dele existe:

```javascript
guardMode: "tolerant"
```

A API também oferece:

```javascript
NetSmoothing.setGuardMode("off");
```

`off` deve ser usado somente para diagnóstico. Nesse modo o validador ainda
recusa valores não finitos pela camada de chamada, mas deixa de aplicar os
limites normais de movimento.

## Teste recomendado

Teste primeiro com 2 jogadores online:

1. Host parado e cliente correndo/pulando.
2. Cliente usando plataformas móveis no Percurso.
3. Sobrevivência com vários obstáculos empurrando o cliente.
4. LAVA durante Ventania e ERUPÇÃO.
5. Observe `Ajustes` e principalmente `Bloqueios`.

Depois teste com 3–4 jogadores.

## Backend

Não é necessário alterar Worker, Durable Object ou D1.
