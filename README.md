# FiveCheck

Dashboard web para pesquisa de servidores RedM/FiveM com base em dados publicos.

## Funcionalidades

- Lista de servidores com filtros por players e upvotes.
- Pagina de detalhe por servidor com:
  - resources detectados;
  - janela de RR/restart (quando estimavel);
  - lista de jogadores (quando disponivel publicamente);
  - score heuristico de suspeita de bots.
- Busca global por resource/script (ex.: `ylx-memenu`).
- Historico de deteccao de resources (primeira/ultima deteccao e status).

## Arquitetura

- Frontend: GitHub Pages (React + Vite)
- Coleta/indexacao: GitHub Actions
- Base publica/cache: arquivos JSON em `public/data`

## Rodar local

1. `npm install`
2. `npm run dev`

## Atualizar base publica

- Manual: `npm run index:data`
- Automatico: workflow `index-public-data` (a cada 6h)

## Regras de confianca

- `detectada`: dado observado diretamente em endpoint publico.
- `estimada`: inferida por padrao/heuristica.
- `nao confirmada`: sem dado publico suficiente no ciclo atual.

## Limites e conformidade

- Consumir apenas dados publicos dos servidores/Cfx.
- Evitar scraping agressivo (limite de volume + cache + intervalo fixo).
- Nao tentar burlar autenticacao/protecao de endpoint.
- Score de bots e probabilistico e nao substitui revisao humana.

## Aviso

Este projeto nao e aconselhamento juridico. Revise os termos/politicas atuais da Cfx.re antes de operar em producao.