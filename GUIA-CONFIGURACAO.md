# FREIVORA · guia de configuração (uso pessoal)

Feito para ser seguido pelo celular. Faça as partes na ordem.

## Parte 1 · Colocar o app no ar (PWA)

O app precisa ficar em um endereço https para instalar na tela inicial e para o login funcionar direito.

**Opção A · Cloudflare Pages (grátis)**
1. Crie uma conta em dash.cloudflare.com
2. Workers e Pages > Create > Pages > **Upload assets** (envio direto)
3. Dê um nome ao projeto e envie o arquivo `freivora-pwa.zip` (ou os arquivos de dentro dele)
4. Toque em Deploy e guarde o endereço, algo como `https://freivora.pages.dev`

**Opção B · GitHub Pages (grátis)**
1. Descompacte o zip no celular (app Arquivos)
2. Crie um repositório público no github.com > Add file > Upload files, e envie todos os arquivos
3. Settings > Pages > Deploy from a branch > `main` / root
4. O endereço fica `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`

> Não testei o envio pelo celular nessas duas opções. Se uma travar, tente a outra.

**Instalar**
- iPhone (Safari): Compartilhar > **Adicionar à Tela de Início**
- Android (Chrome): menu ⋮ > **Instalar app** ou **Adicionar à tela inicial**

**Atenção:** os dados ficam salvos dentro do navegador do aparelho. Se você limpar os dados do navegador ou desinstalar, eles se perdem. Use sempre o mesmo aparelho.

## Parte 2 · Chaves de investimentos

No app: ⚙️ > **Investimentos: APIs**.

- **Bolsa brasileira (brapi):** crie conta grátis em brapi.dev, copie o token e cole no campo "Token"
- **Ações dos EUA (Alpha Vantage):** peça a chave grátis em alphavantage.co e cole no campo "Chave". Ela tem limite diário de consultas
- **Moedas e cripto:** não precisam de chave

## Parte 3 · Open Finance (Meu Pluggy)

O app não fala direto com o Pluggy, porque a senha (Client Secret) não pode ficar dentro do app. Por isso você cria um servidor pequeno e grátis, que guarda as credenciais.

**3.1 · Conectar seus bancos**
1. Crie sua conta no Meu Pluggy (meu.pluggy.ai) e conecte PicPay e Itaú. Confira se os dois aparecem na lista de bancos
2. Entre no Pluggy Dashboard (dashboard.pluggy.ai) com a **mesma conta**
3. Adicione o conector **MeuPluggy** (não o conector do próprio banco)
4. Copie o **itemId** de cada banco conectado
5. Em Applications, copie o **Client ID** e o **Client Secret**

O passo a passo oficial está na página "Personal use: read your own data with Meu Pluggy", em docs.pluggy.ai. Os nomes dos menus podem mudar.

**3.2 · Criar o servidor (Cloudflare Worker)**
1. Em dash.cloudflare.com: Workers e Pages > Create > **Worker** > Hello World > Deploy
2. Toque em **Edit code**, apague tudo e cole o conteúdo do arquivo `worker-open-finance.js`. Toque em Deploy
3. Em Settings > Variables and Secrets, crie estes **Secrets**:
   - `PLUGGY_CLIENT_ID` = o Client ID
   - `PLUGGY_CLIENT_SECRET` = o Client Secret
   - `ITEMS` = `PicPay=ID_DO_ITEM;Itaú=ID_DO_ITEM` (troque pelos seus itemIds, separados por ponto e vírgula)
   - `APP_TOKEN` = uma senha longa inventada por você, com 30 caracteres ou mais
   - `ALLOW_ORIGIN` = o endereço do seu app (opcional, mas recomendado)
4. Guarde o endereço do Worker, algo como `https://nome.conta.workers.dev`

**3.3 · Ligar o app ao servidor**
1. No app: ⚙️ > **Open Finance**
2. Cole o endereço do Worker e a mesma senha do `APP_TOKEN` em "Chave de acesso do servidor"
3. Toque em **Sincronizar agora**

As compras do cartão de crédito dos últimos 90 dias aparecem na aba **Cartões**, separadas por banco. A cada sincronização o app substitui as compras que vieram do Open Finance.

## Segurança
- Nunca coloque o Client Secret dentro do app
- Não compartilhe o `APP_TOKEN`. Quem tiver o endereço do Worker **e** essa senha consegue ler suas compras
- Se desconfiar de vazamento, troque o `APP_TOKEN` no Cloudflare e no app
- O app é para uso pessoal. Para outras pessoas usarem, o caminho legal e técnico é outro (LGPD e contrato de Open Finance)
