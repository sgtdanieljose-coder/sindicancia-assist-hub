# Sindicância Inteligente

Crie uma aplicação web em formato de Dashboard e Assistente de Gestão de Sindicâncias para Oficiais e Praças Encarregados no âmbito do Exército Brasileiro, integrada com o Google Workspace (Google Sheets e Google Docs). 



O app deve garantir rigor doutrinário conforme a Portaria C Ex nº 2.394/2024 (EB10-IG-09.001) e as normas de redação oficial da EB10-IG-01.001.



### INTEGRAÇÃO DE DADOS E EDITOR (GOOGLE WORKSPACE):

- Banco de Dados (Google Sheets): Use o conector de Google Sheets para salvar, ler e atualizar os dados cadastrais das sindicâncias (NUP, Posto/Graduação, Nomes de Guerra, Prazos, Status e Lista de Peças Geradas).

- Editor e Armazenamento (Google Docs / Drive): Permita que, ao gerar uma minuta ou peça (Abertura, Inquirição, Relatório), a aplicação crie um arquivo no Google Docs via API do Google Drive e incorpore a visualização/edição desse Google Doc na própria interface do app através de um iframe (ou forneça o link direto para abertura em nova aba).



### REQUISITOS DE DESIGN E UI/UX:

- Interface sóbria e limpa, inspirada em sistemas institucionais militares.

- Esquema de cores em tons escuros e neutros (cinza-chumbo, verde-oliva velado, azul-marinho institucional).

- Layout responsivo com navegação lateral (Sidebar) e painel principal.



### MÓDULOS PRINCIPAIS DA APLICAÇÃO:



1. **Dashboard & Gestor do Processo:**

   - Formulário de Cadastro conectado à Planilha Google (NUP/NUD, Número/Data da Portaria, OM, Autoridade Instauradora, Sindicante e Sindicado).

   - Cronômetro de Prazos: Contador de 30 dias corridos com alerta aos 20 dias corridos (sugerindo geração do Pedido de Prorrogação de Prazo).

   - Checklist de Etapas do processo.



2. **Gerador Dinâmico de Peças Jurídico-Administrativas:**

   - Formulário onde o usuário preenche os dados e o app gera o texto pré-formatado nos padrões das EB10-IG-01.001.

   - Peças suportadas:

     a) Termo de Abertura dos Trabalhos.

     b) Notificação Prévia do Sindicado.

     c) Termos de Inquirição de Testemunhas e Depoimento do Sindicado.

     d) Ofícios / Mandados de Intimação.

     e) Termos de Juntada de Documentos.

     f) Termo de Encerramento da Instrução e Notificação para Alegações Finais.

     g) Solicitante de Prorrogação de Prazo.

   - Botão "Exportar para Google Docs" que gera o documento na conta Google conectada.



3. **Gerador e Estruturador de Relatório do Sindicante:**

   - Assistente para montagem do Relatório Final estruturado nas 4 partes obrigatórias:

     1. INTRODUÇÃO

     2. DILIGÊNCIAS REALIZADAS

     3. ANÁLISE DOS FATOS

     4. CONCLUSÃO

4** pasta de anexos e base de dados inicial:

https://drive.google.com/drive/folders/1zcQGM4T6-PAiEttCAdK6aqNBrUnQ-u6G

https://docs.google.com/spreadsheets/d/1Fy-JSNpRJXKE89Wm--zo0cFPJwU1Daf_ygUg78-s1jI/edit?usp=drivesdk

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sindicancia-assist-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fb1595ee-ea11-4aa3-b01f-0d6082bd9da4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
