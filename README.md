# 🤖 Commercial Copilot

Copiloto comercial inteligente para gerentes de carteira.

O sistema permite que gerentes façam perguntas em linguagem natural sobre sua carteira de clientes e recebam respostas em português, geradas com base em dados reais do banco de dados — sem precisar escrever SQL.

---

## 📐 Arquitetura proposta

O sistema foi desenhado para resolver os problemas do copiloto atual:

| Problema atual | Solução proposta |
|---|---|
| Processamento sequencial e lento | Fila de entrada (RabbitMQ) desacopla as etapas |
| Sem resiliência a falhas | Duas filas protegem entrada e saída |
| SQL executado sem validação | Query Validator bloqueia operações destrutivas |
| Sem observabilidade | UUID de correlação em todos os logs |
| Respostas chegam só no final | Streaming SSE — tokens chegam em tempo real |
| Cache inexistente | Cache semântico com Redis Vector Search + embeddings |

### Fluxo principal

```
Gerente faz pergunta (linguagem natural)
        ↓
API Gateway — autenticação e rate limit
        ↓
Fila de entrada (RabbitMQ)
        ↓
Modelo de Embedding — pergunta → vetor numérico
        ↓
Redis Vector Search — busca SQL similar (threshold 95%)
    ├── Cache hit  → injeta employeeId → Query Validator → Banco
    └── Cache miss → LLM Interpretador → gera SQL
        ↓
Query Validator — só SELECT, LIMIT obrigatório, whitelist de tabelas
        ↓
MySQL Northwind (AWS RDS) — user_read_only
        ↓
Fila de resultados (RabbitMQ) — protege o compositor
        ↓
Compositor LLM + Streaming SSE
        ↓
Resposta em português, token a token, em tempo real
```

### Por que duas filas?

A fila de entrada protege o sistema desde o início — se o LLM de interpretação falhar, a mensagem não se perde e é reprocessada. A fila de resultados protege o compositor — se ele falhar no meio do streaming, os dados do banco já estão salvos na mensagem e o reprocessamento começa só nessa etapa, não do zero.

### Por que cache semântico e não cache tradicional?

Cache tradicional compara strings exatas. *"Quais meus clientes em atraso?"* e *"Me mostra quem tá devendo"* são strings diferentes mas têm a mesma intenção. O cache semântico transforma a pergunta em um vetor numérico via modelo de embedding e compara a distância matemática entre vetores — perguntas com significado parecido geram vetores próximos e resultam em cache hit. O que é cacheado é o **SQL template**, não o resultado — os dados sempre vêm frescos do banco.

### Decisão sobre microsserviços

A arquitetura proposta prevê serviços independentes (Embedding, Interpreter, Composer, QueryValidator). Na implementação atual, cada serviço foi implementado como um **módulo NestJS isolado**, com interfaces bem definidas entre eles. Essa separação permite que cada módulo seja extraído como microsserviço independente quando a demanda justificar — sem alterar as interfaces. Esta é uma decisão deliberada de pragmatismo: microsserviços têm custo operacional real e não fazem sentido antes da necessidade.

---

## 🗂️ Estrutura do projeto

```
src/
├── common/
│   ├── database/           # Pool de conexão MySQL
│   ├── interceptors/       # Sentry interceptor
│   ├── monitoring/         # Configuração de monitoramento
│   └── pipes/              # ZodValidationPipe
│
└── modules/
    ├── interpreter/        # Geração de SQL via LLM
    │   ├── interpreter.dao.ts      # Busca DDL do banco (onModuleInit)
    │   └── interpreter.service.ts  # Prompt + chamada ao LLM
    │
    ├── query-validator/    # Validação do SQL gerado
    │   └── query-validator.service.ts
    │
    ├── composer/           # Composição da resposta com streaming
    │   └── composer.service.ts
    │
    ├── cache/              # Cache semântico (scaffolded)
    │   └── cache.service.ts
    │
    └── query/              # Orquestrador do fluxo principal
        ├── query.controller.ts     # SSE endpoint GET /query/question
        ├── query.service.ts        # Orquestra todos os módulos
        ├── query.dao.ts            # Executa SQL no banco
        └── dto/
            └── post-question.dto.ts
```

---

## ⚙️ Como rodar localmente

### Pré-requisitos

- Node.js 18+
- [LM Studio](https://lmstudio.ai/) com o modelo `qwen2.5-coder-14b` carregado
- Acesso ao banco Northwind (credenciais no `.env`)

### Instalação

```bash
git clone <repo-url>
cd commercial-copilot
npm install
```

### Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# LLM — aponta para o LM Studio local
LLM_BASE_URL=http://localhost:1234/v1
LLM_MODEL=qwen2.5-coder-14b

# Em produção, substitua pelas variáveis do Claude (Anthropic):
# LLM_BASE_URL=https://api.anthropic.com/v1
# LLM_MODEL=claude-sonnet-4-20250514

# Banco de dados Northwind
DB_HOST=seu_host
DB_PORT=sua_porta
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=seu_banco
```

### Rodando o projeto

```bash
# desenvolvimento
npm run start:dev

# produção
npm run build
npm run start:prod
```

### Testando via browser

Abra o arquivo `test.html` na raiz do projeto diretamente no navegador. Ele se conecta ao servidor via SSE e exibe a resposta em tempo real conforme os tokens chegam.

### Testando via curl

```bash
curl.exe -X GET "http://localhost:5510/query/question?question=Quais+são+os+últimos+pedidos+da+minha+carteira?&employeeId=1" -N
```

---

## 🔒 Segurança

O `QueryValidatorService` valida todo SQL gerado pelo LLM antes de executar no banco:

- Apenas `SELECT` é permitido — qualquer outra operação é bloqueada
- `LIMIT` é obrigatório em todas as queries
- Operações destrutivas são explicitamente bloqueadas: `DROP`, `DELETE`, `UPDATE`, `INSERT`, `TRUNCATE`, `ALTER`, `CREATE`, `REPLACE`
- A conexão com o banco usa usuário `read_only` — impossível escrever mesmo que o validator falhe

Isso resolve o principal risco de segurança identificado no sistema atual: SQL injection via LLM.

---

## 🚧 O que foi simplificado

**Cache semântico** — o módulo está scaffolded mas não implementado. Em produção seria Redis Vector Search com embeddings via `text-embedding-3-small` (OpenAI). O SQL template seria cacheado por similaridade semântica (threshold 95%), não por string exata — permitindo que *"quais meus clientes em atraso?"* e *"me mostra quem tá devendo"* resultem em cache hit.

**Fila assíncrona** — RabbitMQ foi omitido da implementação. O fluxo atual é síncrono dentro do request. Em produção, a fila seria fundamental para desacoplar o LLM do Gateway e garantir resiliência em caso de falha.

**Autenticação** — o endpoint não exige autenticação real. Em produção, o API Gateway validaria JWT e o `employeeId` seria extraído do token, não passado pelo cliente.

**Microsserviços** — implementado como módulos NestJS isolados. A separação de responsabilidades já está definida para extração futura.

---

## 🔭 Como evoluiria em produção

1. **Cache semântico** com Redis Vector Search + embeddings — elimina chamadas redundantes ao LLM
2. **RabbitMQ** para desacoplar entrada e processamento — resiliência e escalonamento independente
3. **Kubernetes** para orquestrar os containers — auto-scaling do LLM sob demanda
4. **Autenticação JWT** no Gateway — `employeeId` extraído do token, não do cliente
5. **LLM em produção** — substituir LM Studio pelo Claude Sonnet via Anthropic API, alterando apenas variáveis de ambiente
6. **Monitoramento** — Prometheus + Grafana para métricas de latência, taxa de cache hit e erros por etapa

---

## 🛠️ Stack

| Camada | Tecnologia |
|---|---|
| Framework | NestJS + TypeScript |
| LLM (local) | Qwen 2.5 Coder 14B via LM Studio |
| LLM (produção) | Claude Sonnet — Anthropic |
| Banco de dados | MySQL — Northwind (AWS RDS) |
| Streaming | SSE (Server-Sent Events) via RxJS |
| Validação | Zod |
| Cache (planejado) | Redis Vector Search |
| Mensageria (planejado) | RabbitMQ |
| Observabilidade (planejado) | Prometheus + Grafana |

---

## 👤 Autor

**Guilherme Souza Santos**
Backend Engineer — Node.js | TypeScript | NestJS

[LinkedIn](https://linkedin.com/in/guilherme-souza-414472219) · [Portfolio](https://guilhermedev.website)
