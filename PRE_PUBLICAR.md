# Checklist antes de publicar

Execute:

```bash
bash pre-publish-check.sh
```

Depois confira manualmente:

```bash
git status
git diff --cached
git log -1 --format=fuller
```

Não publique:
- `.env`, `.dev.vars`;
- tokens de GitHub ou Cloudflare;
- chaves SSH (`id_rsa`, `id_ed25519`, `.pem`, `.key`);
- `~/.config/.wrangler`;
- `~/.ssh`;
- `~/.git-credentials`;
- histórico do terminal;
- backups contendo credenciais;
- documentos pessoais.

O endereço público de um Worker não é uma credencial. Tokens/chaves usados
para administrar a Cloudflare são credenciais e nunca devem ir ao frontend.
