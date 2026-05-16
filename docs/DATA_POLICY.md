# Notas de uso de dados publicos (RedM/FiveM)

Data: 2026-05-15

## Escopo

Este projeto foi estruturado para:
- consumir somente dados publicos de listagem de servidores;
- cachear resultados em JSON publico;
- limitar taxa/frequencia de coleta;
- evitar scraping agressivo e qualquer bypass tecnico.

## Praticas adotadas

- Coleta via workflow periodico (intervalo fixo).
- Limite de volume por execucao (`MAX_SERVERS`).
- Reuso de cache em `public/data`.
- Marcacao de confianca por campo:
  - detectada
  - estimada
  - nao confirmada

## Limites tecnicos

- Informacoes de RR/restart podem ser estimadas se nao houver exposicao publica direta.
- Lista detalhada de jogadores/resources depende do que o endpoint publico disponibiliza em cada ciclo.
- Score de bots e probabilistico e deve ser tratado como apoio investigativo.

## Referencias publicas

- Cfx/FiveM docs (server manual): https://docs.fivem.net/docs/server-manual/
- Cfx/FiveM featured server list: https://docs.fivem.net/docs/server-manual/featured-server-list/
- Cfx platform agreement (consultar versao vigente): https://runtime.fivem.net/fivem-service-agreement-4.pdf
- PLA (versao recente encontrada): https://static.cfx.re/platform-license-agreement-12-jan-2026.pdf

## Aviso

Nao e aconselhamento juridico. Antes de uso em producao, revisar termos e politicas vigentes da Cfx.re e regras da sua jurisdicao.