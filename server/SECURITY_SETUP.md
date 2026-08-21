# V9.1 — instalação segura do Worker

Esta versão **exige atualizar o Worker e o D1 antes do frontend**.

## 1. Backup do D1

Na pasta `server/`:

```bash
npx wrangler@latest d1 export visoes-cruzadas-maps --remote --output=backup-antes-v9.1.sql
```

Guarde esse arquivo fora do repositório se ele contiver dados que você não quer publicar.

## 2. Configure a origem exata do site

Em `server/wrangler.jsonc`, troque:

```json
"ALLOWED_ORIGINS": ""
```

por sua origem GitHub Pages, por exemplo:

```json
"ALLOWED_ORIGINS": "https://SEU-USUARIO.github.io"
```

Se estiver vazio, V9.1 aceita qualquer origem HTTPS terminada em `.github.io` para facilitar o primeiro teste. Para divulgação, prefira a origem exata.

## 3. Crie SESSION_SECRET

```bash
openssl rand -hex 32
```

Copie o valor e execute:

```bash
npx wrangler@latest secret put SESSION_SECRET
```

Cole o valor no prompt do Wrangler. Não salve o segredo no código.

## 4. Crie ADMIN_SECRET

Gere **outro** valor:

```bash
openssl rand -hex 32
```

Depois:

```bash
npx wrangler@latest secret put ADMIN_SECRET
```

Os dois segredos devem ser diferentes.

## 5. Crie as tabelas de revisão

Este pacote contém somente a nova alteração V9.1, portanto aplique diretamente o arquivo:

```bash
npx wrangler@latest d1 execute visoes-cruzadas-maps --remote --file=migrations/0003_security_review_queue.sql
```

Ela cria `map_submissions` e `map_submission_votes` e não apaga a biblioteca atual.

## 6. Publique o Worker

```bash
npx wrangler@latest deploy
```

Teste:

```bash
curl https://visoes-cruzadas-server.gd91639.workers.dev/
```

A resposta deve conter:

```json
{"ok":true,"service":"Visoes Cruzadas Server","version":"9.1.0","security":"session-ticket-v1"}
```

## 7. Só então publique o frontend V9.1

O frontend V9.1 usa o protocolo novo. A URL WebSocket deixa de usar `role` e `player_id` como identidade e passa a usar um ticket de uso único.

## Revisão de mapas pendentes

Nunca coloque `ADMIN_SECRET` no GitHub Pages.

No terminal, use uma leitura silenciosa para evitar gravar o valor no histórico:

```bash
export VC_WORKER_URL="https://visoes-cruzadas-server.gd91639.workers.dev"
read -s -p "ADMIN_SECRET: " VC_ADMIN_SECRET; echo
export VC_ADMIN_SECRET
```

Listar pendentes:

```bash
node server/tools/review-maps.mjs list
```

Aprovar:

```bash
node server/tools/review-maps.mjs approve HASH
```

Rejeitar:

```bash
node server/tools/review-maps.mjs reject HASH
```

Ao terminar:

```bash
unset VC_ADMIN_SECRET
```

## Rotação

Se suspeitar de vazamento, gere outro valor e repita `wrangler secret put`. Trocar `SESSION_SECRET` invalida tokens de jogo existentes; jogadores precisarão entrar de novo.
