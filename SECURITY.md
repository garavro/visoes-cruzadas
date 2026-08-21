# Arquitetura de segurança — V9.1

```text
GitHub Pages (público)
       |
       | POST /api/session
       v
Cloudflare Worker
       |
       |-- API token HMAC (sessão de jogo)
       |-- ticket WebSocket de uso único
       v
Durable Object da sala
       |
       |-- role/slot/identidade da conexão
       |-- allowlist e rate limit de mensagens
       |
       +------> D1
                |-- maps: biblioteca revisada
                |-- player_maps: histórico
                |-- map_submissions: pendentes
                +-- map_submission_votes
```

## Princípio central

O navegador é considerado não confiável. Código JavaScript, URL do Worker e IDs públicos podem ser vistos por qualquer pessoa; nenhum deles concede permissão administrativa.

## O servidor não confia mais no cliente para

- declarar que é Host apenas por parâmetro de URL;
- escolher o próprio slot;
- indicar o remetente de uma mensagem WebSocket;
- enviar uma lista arbitrária de `player_ids` para alterar histórico;
- aprovar/rejeitar globalmente mapas;
- enviar tipos/tamanhos ilimitados de mensagens.

## Host não significa administrador

Qualquer pessoa pode criar uma partida. Por isso Host controla **a sala**, mas não a biblioteca global. Novos mapas entram em fila pendente e a promoção para `approved/rejected` exige `ADMIN_SECRET`, que nunca vai para o frontend.

## Limitações intencionais

Ainda não existem contas de usuário. `PLAYER_ID` é uma identidade anônima persistente do navegador, não uma credencial forte. A V9.1 protege o backend administrativo e a identidade das conexões, mas não transforma um jogador anônimo em uma identidade verificada por e-mail.

O anti-trapaça V9.0.1 continua sendo a proteção de movimento da partida.
