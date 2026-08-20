# Visões Cruzadas

Jogo cooperativo multiplayer em HTML.

## GitHub Pages

O frontend é estático e pode ser publicado diretamente com GitHub Pages.

1. Crie um repositório vazio.
2. Envie estes arquivos para a branch `main`.
3. Abra `Settings` → `Pages`.
4. Em `Source`, escolha `Deploy from a branch`.
5. Escolha `main` e `/(root)`.
6. Salve.

O backend multiplayer continua hospedado separadamente no Cloudflare Worker.

## Segurança

Antes de cada publicação execute:

```bash
bash pre-publish-check.sh
```

Não armazene tokens, senhas ou chaves de API no `index.html` ou no GitHub.
