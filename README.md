# Sistema Cancelamento/Reenvio — v6

## O que mudou nesta versão

- **Design refinado**: dark theme mais limpo, sem gradientes pesados, mais fácil de ler em uso prolongado.
- **Sidebar com ícones SVG** inline em todas as páginas — sem dependências externas.
- **Botões de ação** na sidebar com fundo e borda corrigidos (`secondary`).
- **Tabela de registros** sem padding externo, header sticky na rolagem.
- **Responsividade** revisada para tablets e celulares.
- Toda a lógica JS permanece igual (config.js, shared.js, app.js, dashboard.js, registros.js).

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `style.css` | Reescrito — mesmas variáveis, mais legível |
| `index.html` | Ícones SVG na nav |
| `dashboard.html` | Ícones SVG na nav |
| `registros.html` | Ícones SVG na nav + card sem padding |

## Arquivos inalterados

`config.js`, `shared.js`, `app.js`, `dashboard.js`, `registros.js`, `apps-script.js`

## Como atualizar no GitHub

```bash
git add .
git commit -m "v6 design refinado com icones e dark theme limpo"
git push
```

## Apps Script

Nenhuma alteração necessária. Se precisar reimplantar, use o arquivo `apps-script.js`.
