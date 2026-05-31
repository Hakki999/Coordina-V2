CONTROLE DE MATERIAIS/
│
├── src/                    # Código-fonte da aplicação
│   ├── config/             # Configurações (ex: banco de dados, variáveis de ambiente)
│   ├── controllers/        # Lógica de recebimento de requisições e envio de respostas
│   ├── models/             # Esquemas de dados e comunicação com o banco de dados
│   ├── routes/             # Definição dos endpoints (URLs) do site/API
│   ├── middlewares/        # Funções intermediárias (ex: autenticação, tratamento de erros)
│   ├── public/             # Arquivos estáticos acessíveis publicamente (CSS, JS do front, imagens)
│   ├── views/              # Arquivos HTML ou de templates (EJS, Handlebars) caso renderize páginas
│   └── app.js              # Inicialização do Express e middlewares globais
│
├── .env                    # Variáveis de ambiente (senhas, portas)
├── .gitignore              # Arquivos/pastas ignorados pelo Git
├── package.json            # Dependências e scripts do projeto
└── server.js               # Ponto de entrada que levanta o servidor (escuta a porta)
"# Coordina-V2" 
