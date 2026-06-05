# Sistema Cancelamento/Reenvio - v5 rápido

## O que mudou

- Cache local compartilhado entre Cadastro, Dashboard e Registros.
- Dashboard carrega dados salvos imediatamente e atualiza manualmente pelo botão.
- Cálculo de Fretes/Estornos corrigido para valores brasileiros como `24,90`, `108,94` e `1.234,56`.
- Gráficos mais compactos.
- Registros usam o mesmo cache para abrir mais rápido.

## Como atualizar no GitHub

Substitua os arquivos no repositório atual e rode:

```bash
git add .
git commit -m "V5 rapida com cache e calculo corrigido"
git push
```

## Apps Script

Se seu Apps Script já está salvando/listando corretamente, não precisa trocar.
Se quiser garantir, cole o arquivo `apps-script.js` no Google Apps Script e implante uma nova versão.


## V5.1 Grid corrigido

Esta versão ajusta o grid para deixar dashboard, cadastro e registros menos esticados e mais responsivos.
