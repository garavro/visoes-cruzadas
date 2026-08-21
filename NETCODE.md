# NETCODE — V9.1.1

## Jogador local

A física é calculada localmente e o Host não reposiciona o cliente.

```text
input → física local → movimento imediato → envia estado
```

Snapshots do Host não substituem `x`, `y`, `vx` ou `vy` do jogador local.

## Outros jogadores

Continuam com interpolação visual, apenas para suavizar a apresentação.

## Validação restante

Não é anti-trapaça de movimento. O Host somente rejeita:

- estado ausente;
- NaN/Infinity;
- sequência antiga/duplicada.

O restante do movimento é aceito como enviado.

## Segurança

A V9.1 Server Security continua integralmente ativa no Worker/Durable Object/D1.
