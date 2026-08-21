# Visões Cruzadas — V9.1.1 sem anti-trapaça de movimento

A V9.1.1 mantém a segurança de backend da V9.1 e remove o sistema que limitava
ou corrigia posição e velocidade dos jogadores remotos.

## Removido

- limites de velocidade/deslocamento/aceleração;
- correções suaves de posição;
- hard corrections / snaps;
- reconciliação x/y/vx/vy do jogador local com snapshots do Host;
- envio/aceitação de `player-correction` no Worker;
- correções do modo LAVA.

## Mantido

- física local imediata;
- estados de movimento enviados pela rede;
- interpolação visual dos OUTROS jogadores;
- Host ainda decide morte, vitória e game over;
- rejeição de NaN/Infinity;
- descarte de pacotes fora de ordem;
- sessões HMAC, tickets WebSocket, permissões, rate limiting e proteção do D1.

## Consequência

Um navegador modificado pode mentir sobre a própria posição/velocidade com mais
facilidade. Isso reduz a resistência a cheats de movimento, mas NÃO concede
acesso administrativo ao Worker ou D1.

## HUD

```text
Ping 65ms · Movimento livre
```

Não existe migration D1 nova.
