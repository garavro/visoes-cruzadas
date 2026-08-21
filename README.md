# Visões Cruzadas — V9.1 Server Security

A V9.1 preserva Percurso, Sobrevivência, LAVA, personagens procedurais e o netcode V9.0.1. A mudança é a fronteira de segurança entre o frontend público e Cloudflare/D1.

## Principais proteções

- Worker cria a sala do Host;
- ticket WebSocket aleatório, curto e de uso único;
- `role`/`player_id` deixam de ser identidade na URL;
- API usa token de sessão HMAC assinado por `SESSION_SECRET`;
- `ADMIN_SECRET` é separado e nunca é enviado ao navegador;
- Durable Object determina role, slot e remetente real;
- API deriva a lista de jogadores do roster ativo;
- `/api/maps/approve` e `/api/maps/reject` públicos foram desativados;
- mapas novos entram numa fila de revisão;
- rate limiting por IP para APIs e por conexão para WebSocket;
- limite de 32 jogadores e 128 KB por mensagem;
- allowlist de tipos de mensagens por Host/cliente;
- validação de estrutura, física e hash de mapas enviados;
- CSP e `no-referrer` no GitHub Pages;
- auditoria estática no GitHub Actions.

## Atualização obrigatória

Diferente da V9.0.1, esta versão exige **três passos**, nesta ordem:

1. configurar os segredos no Cloudflare e aplicar `server/migrations/0003_security_review_queue.sql`;
2. publicar `server/src/index.js` como Worker V9.1;
3. publicar o frontend V9.1 no GitHub Pages.

Leia primeiro: `server/SECURITY_SETUP.md`.

Nenhum segredo real está incluído neste pacote.
