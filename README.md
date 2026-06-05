# Sistema de Cancelamento / Reenvio

Projeto pronto para publicar no GitHub Pages e gravar os dados diretamente na sua Google Sheets.

## O que mudou nesta versão

- WhatsApp ficou separado de Número do Pedido.
- Novo Código de Rastreio virou um campo próprio.
- Dashboard ganhou gráficos:
  - registros por tipo;
  - top lojas;
  - top motivos.
- As abas da planilha passam a usar estas colunas:

```txt
Criado em
Tipo
Loja
Data Pedido
Motivo
Fretes / Estorno
Número Pedido
WhatsApp
Novo Código Rastreio
Data Reenvio
```

## Planilha usada

ID configurado no Apps Script:

```txt
15azriRqbIZiT09aou6MA4nfoQlUioUR4bAaMzF9DX1A
```

O sistema grava em duas abas:

```txt
Cancelamento
Reenvio
```



Você pode trocar a senha gerando um novo SHA-256 e substituindo `PASSWORD_SHA256` no arquivo `config.js`.

## Token de segurança inicial

```txt
L4BRZxALPI3G8txFktdNYNy3RxV3p3QqnzuCLT7PKwc
```

Esse token já está no `config.js`. Também precisa ser cadastrado nas Propriedades do Script do Google Apps Script.

## Como instalar

### 1. Criar o Apps Script

1. Abra sua planilha.
2. Vá em `Extensões > Apps Script`.
3. Apague o código padrão.
4. Cole o conteúdo do arquivo `apps-script.js`.
5. Salve.

### 2. Configurar a propriedade secreta

No Apps Script:

1. Clique em `Configurações do projeto`.
2. Vá em `Propriedades do script`.
3. Adicione:

```txt
FORM_TOKEN = L4BRZxALPI3G8txFktdNYNy3RxV3p3QqnzuCLT7PKwc
```

### 3. Criar/atualizar as abas

No editor do Apps Script, execute a função:

```txt
setupSheets
```

Autorize o acesso quando o Google pedir.

Atenção: se suas abas já tinham dados da versão anterior, o cabeçalho será atualizado para o novo formato. Para evitar mistura de colunas antigas, recomendo fazer uma cópia da planilha antes.

### 4. Publicar o Apps Script

1. Clique em `Implantar > Nova implantação`.
2. Em `Selecionar tipo`, escolha `App da Web`.
3. Em `Executar como`, escolha `Eu`.
4. Em `Quem pode acessar`, escolha `Qualquer pessoa`.
5. Clique em `Implantar`.
6. Autorize o acesso.
7. Copie a URL do Web App. Ela normalmente termina com `/exec`.

### 5. Configurar a URL no arquivo config.js

Abra o arquivo `config.js`.

Você verá isto:

```js
const CONFIG = {
  WEB_APP_URL: "COLE_AQUI_A_URL_DO_GOOGLE_APPS_SCRIPT",
  FORM_TOKEN: "L4BRZxALPI3G8txFktdNYNy3RxV3p3QqnzuCLT7PKwc",
  PASSWORD_SHA256: "6bfed3fecf913bda7932eeeedcac6ff1e7e4927e7039fab4266d7dc9c74e0d34",
  SESSION_KEY: "cancelamento_reenvio_auth_v1"
};
```

Substitua somente esta parte:

```txt
COLE_AQUI_A_URL_DO_GOOGLE_APPS_SCRIPT
```

pela URL copiada no deploy do Apps Script.

Exemplo:

```js
const CONFIG = {
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycbx_EXEMPLO_DE_URL/exec",
  FORM_TOKEN: "L4BRZxALPI3G8txFktdNYNy3RxV3p3QqnzuCLT7PKwc",
  PASSWORD_SHA256: "6bfed3fecf913bda7932eeeedcac6ff1e7e4927e7039fab4266d7dc9c74e0d34",
  SESSION_KEY: "cancelamento_reenvio_auth_v1"
};
```

Importante:

- mantenha as aspas;
- mantenha a vírgula no final da linha;
- use a URL que termina com `/exec`, não a URL que termina com `/dev`;
- toda vez que alterar o Apps Script, faça uma nova versão/deploy ou atualize a implantação.

### 6. Publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie estes arquivos para o repositório:
   - `index.html`
   - `style.css`
   - `script.js`
   - `config.js`
3. Vá em `Settings > Pages`.
4. Em `Build and deployment`, selecione branch `main` e pasta `/root`.
5. Abra a URL gerada pelo GitHub Pages.

## Segurança aplicada

- Tela de senha no site.
- Token validado no Google Apps Script.
- Planilha permanece privada.
- Validação de campos obrigatórios.
- Separação automática entre abas `Cancelamento` e `Reenvio`.
- Honeypot anti-bot.
- Rate limit simples contra múltiplos envios rápidos.

## Observação importante

GitHub Pages é hospedagem estática. Isso significa que não existe backend privado dentro dele. A segurança real do envio fica no Google Apps Script, que valida o token antes de aceitar gravações.

Para segurança mais forte, use repositório privado quando disponível, Cloudflare Access, Netlify com proteção por senha, ou autenticação Google.
