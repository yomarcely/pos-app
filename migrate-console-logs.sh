#!/bin/bash

# Script pour remplacer les console.log par logger dans tous les fichiers server/

FILES=(
  "server/api/products/create.post.ts"
  "server/api/products/index.get.ts"
  "server/api/products/update-stock.post.ts"
  "server/api/products/[id].get.ts"
  "server/api/products/[id].put.ts"
  "server/api/products/stock-movements/[id].delete.ts"
  "server/api/products/stock-movements.get.ts"
  "server/api/products/[id]/delete.delete.ts"
  "server/api/products/[id]/stock-history.get.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."

    # Check if logger is already imported
    if ! grep -q "from '~/server/utils/logger'" "$file"; then
      # Add logger import after the last import
      sed -i.bak '/^import/h;//!H;$!d;x;s/\(.*\)/\1\nimport { logger } from '\''~\/server\/utils\/logger'\''/' "$file"
    fi
  fi
done

echo "Done! Review changes before committing."
