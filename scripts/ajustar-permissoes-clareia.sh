#!/usr/bin/env bash
set -euo pipefail

SITE="/www/wwwroot/clareia"
OWNER="www"
GROUP="www"

if [[ ! -d "$SITE" ]]; then
  echo "ERRO: diretório não encontrado: $SITE" >&2
  exit 1
fi

echo "==> Caminho real"
realpath "$SITE"

echo "==> Situação atual"
ls -ld "$SITE"

echo "==> Ajustando proprietário para ${OWNER}:${GROUP} (exceto .git)"
find "$SITE" -path "$SITE/.git" -prune -o -exec chown "$OWNER:$GROUP" {} +

echo "==> Ajustando diretórios para 755 (exceto .git)"
find "$SITE" -path "$SITE/.git" -prune -o -type d -exec chmod 755 {} +

echo "==> Ajustando arquivos não executáveis para 644 (exceto .git)"
find "$SITE" -path "$SITE/.git" -prune -o -type f ! -perm /111 -exec chmod 644 {} +

echo "==> Preservando arquivos executáveis como 755 (exceto .git)"
find "$SITE" -path "$SITE/.git" -prune -o -type f -perm /111 -exec chmod 755 {} +

echo "==> Situação final"
ls -ld "$SITE"

echo "Concluído."
