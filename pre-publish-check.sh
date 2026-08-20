#!/usr/bin/env bash
set -u

echo "== Verificando nomes de arquivos sensíveis =="
find . -type f \
  \( -name '.env' -o -name '.env.*' -o -name '.dev.vars' -o -name '.dev.vars.*' \
     -o -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '*.pfx' \
     -o -name '*.log' \) \
  -not -path './.git/*' -print

echo
echo "== Procurando padrões potencialmente sensíveis =="
grep -RInE \
  --exclude-dir=.git \
  --exclude='pre-publish-check.sh' \
  '(BEGIN (RSA|OPENSSH|EC|PRIVATE)|CLOUDFLARE_API_TOKEN|GITHUB_TOKEN|API[_-]?KEY[[:space:]]*=|SECRET[[:space:]]*=|PASSWORD[[:space:]]*=|BEARER[[:space:]]+[A-Za-z0-9._-]+|/home/[^/]+|/Users/[^/]+|[A-Za-z0-9._%+-]+@(gmail|outlook|hotmail|yahoo)\.[A-Za-z]{2,})' \
  . || true

echo
echo "== Arquivos que entrarão no Git =="
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git status --short
else
  find . -maxdepth 2 -type f -print | sort
fi

echo
echo "Revise qualquer resultado antes de fazer git push."
