# Commercial Copilot
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-3-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-5-FF4438?logo=redis&logoColor=white)](https://redis.io/)
[![Sentry](https://img.shields.io/badge/Sentry-10-362D59?logo=sentry&logoColor=white)](https://sentry.io/)
[![Jest](https://img.shields.io/badge/Jest-30-C21325?logo=jest&logoColor=white)](https://jestjs.io/)
[![Zod](https://img.shields.io/badge/Zod-4-3E67B1?logo=zod&logoColor=white)](https://zod.dev/)

Copiloto comercial para gerentes de carteira que transforma perguntas em linguagem natural em respostas em português baseadas em dados reais do banco.

Construído para explorar uma arquitetura modular, segura e observável para o fluxo NL2SQL + composição de resposta com streaming — com foco em decisões que fariam sentido em um ambiente de produção real.

## Visão Geral E Contexto

Problema de negócio:
1. Dependência de SQL manual para análises operacionais.
2. Baixa velocidade para responder perguntas comerciais ad hoc.
3. Risco de segurança ao permitir que um LLM gere consultas livres.

Solução implementada nesta entrega:
1. Endpoint SSE que recebe pergunta + employeeId.
2. Cache semântico de SQL template com Redis Vector Search.
3. Geração de SQL com LLM quando não há cache hit.
4. Validação defensiva de SQL antes de executar no MySQL.
5. Composição da resposta final em português com streaming token a token.

## Arquitetura Implementada

O sistema está implementado como módulos NestJS com responsabilidades claras e interfaces separadas, permitindo evolução incremental.

### Núcleo de negócio

1. query
        Controlador SSE e orquestração do fluxo principal.
2. interpreter
        Geração de SQL via LLM a partir da pergunta e schema carregado na inicialização.
3. query-validator
        Regras de segurança para bloquear SQL destrutivo e impor LIMIT.
4. cache
        Cache semântico com embedding + busca vetorial KNN no Redis.
5. composer
        Composição da resposta em português e streaming SSE.

### Infra e cross-cutting

1. common/database
        Pool MySQL global, configuração de timeout/pool e encerramento controlado.
2. common/interceptors
        Logging de request, logging estruturado de erro, captura para Sentry.
3. common/metrics
        Métricas de estágio em arquivo (latência e eventos por requestId).
4. common/errors
        PipelineError com stage e causeDetails para diagnóstico por etapa.
5. common/pipes
        Validação de entrada com Zod.

## Fluxo Completo De Requisição

Fluxo implementado hoje para GET /query/question:

1. Entrada e validação
        QueryController recebe question e employeeId e valida com ZodValidationPipe.
2. Correlação
        RequestLoggingInterceptor gera requestId UUID e injeta na requisição.
3. Cache lookup semântico
        QueryService chama CacheService.get com embedding da pergunta e FT.SEARCH KNN por employeeId.
        Se Redis indisponível, cache lookup retorna null e o fluxo segue direto para geração via LLM sem interrupção.
4. Cache hit
        Se similaridade >= 0.95: valida SQL cacheado, executa no banco e compõe resposta.
5. Cache miss
        InterpreterService gera SQL via LLM; QueryService valida SQL; CacheService.set grava SQL template no Redis.
6. Execução de dados
        QueryDao executa SQL no MySQL.
7. Composição
        ComposerService chama LLM com stream true e emite tokens em Observable.
8. Resposta SSE
        QueryController transforma tokens em MessageEvent e envia em tempo real.

## Estratégia De Cache

### Exato vs semântico

1. Cache exato por string não é o mecanismo central nesta implementação.
2. O cache ativo é semântico, baseado em embedding + distância vetorial.

### Como funciona

1. Pergunta é convertida em vetor numérico via endpoint /embeddings.
2. Redis FT.SEARCH usa KNN 1 em índice vetorial sql_cache.
3. Similaridade é calculada como 1 - score.
4. Hit quando similaridade >= 0.95.
5. O que é cacheado é SQL template por employeeId, não resultado de dados.

### Comportamento de hit e miss

1. Hit
        Pula geração de SQL, mantém validação defensiva e executa consulta.
2. Miss
        Gera SQL com InterpreterService, valida, grava no cache e segue fluxo.

### Resiliência de cache

1. Startup non-blocking
        Redis conecta em background, sem bloquear subida da aplicação.
2. Reconnect strategy
        Backoff progressivo até 30s.
3. Degradação graciosa
        Se Redis indisponível, get retorna null e set é ignorado, mantendo pipeline funcional.

## Segurança

### Regras de validação SQL

QueryValidatorService aplica:
1. SQL deve iniciar com SELECT.
2. LIMIT é obrigatório.
3. Bloqueio explícito de DROP, DELETE, UPDATE, INSERT, TRUNCATE, ALTER, CREATE, REPLACE.
4. Comentários de linha e bloco são removidos antes da validação.

### Decisões adicionais

1. Validação dupla
        SQL é validado tanto em cache hit quanto após geração em cache miss.
2. Banco com proteção adicional
        multipleStatements false no pool MySQL para reduzir superfície de abuso.
3. Sanitização de logs
        ErrorLoggingInterceptor mascara campos sensíveis como password, token, authorization, question, sql e results.

## Observabilidade

### Correlação

1. Cada request recebe requestId UUID.
2. requestId é reutilizado em métricas e no fluxo principal.

### Logs estruturados em arquivo

Diretório logs:
1. request_log_YYYY-MM-DD.log (somente requests não-SSE)
2. error_log_YYYY-MM-DD.log
3. metrics_YYYY-MM-DD.log

Observação importante:
1. O endpoint principal /query/question usa SSE e é intencionalmente ignorado no RequestLoggingInterceptor para evitar ruído de logging por token de stream.

### Erros por estágio

PipelineError permite registrar etapa de falha.

Stages usados atualmente no pipeline:
1. cache_read
2. sql_generation
3. sql_validation
4. cache_write
5. database_execution
6. llm_composition

### Métricas de estágio

QueryService e ComposerService registram eventos como:
1. cache_hit e cache_miss
2. sql_generation
3. cache_write
4. sql_execution e cached_sql_execution
5. composition_response_received e composition_completed

### Sentry

1. MonitoringModule registra SentryInterceptor globalmente.
2. Erros não-HTTP são enviados via captureError.
3. A integração está preparada, mas para envio efetivo é necessário inicializar o SDK com initSentry no bootstrap e configurar SENTRY_DSN.
4. Existem variáveis de configuração para sample rate e traces.

## Stack De LLM

Implementação atual:
1. LLM_BASE_URL para endpoint de chat completions e embeddings.
2. LLM_MODEL para Interpreter e Composer.
3. EMBEDDING_MODEL para geração de embeddings.

Ambiente local:
1. LM Studio com modelo local reduz dependência externa durante avaliação.
2. Reproduzibilidade de testes técnicos sem custo de API de produção.

Troca para produção:
1. Ajustar LLM_BASE_URL.
2. Ajustar LLM_MODEL e EMBEDDING_MODEL.
3. Sem necessidade de reestruturar os módulos de negócio.

### Encerrando o servidor

O servidor fecha conexões MySQL e Redis de forma controlada ao receber SIGTERM:
- Pool MySQL encerra conexões ativas
- Cliente Redis desconecta limpo

## Como Rodar Localmente

### Pré-requisitos

1. Node.js 18+.
2. MySQL acessível com schema Northwind.
3. Redis 7+ com RediSearch habilitado.
4. LM Studio rodando com modelo de chat e modelo de embedding disponíveis.

### Instalação

```bash
npm install
```

### Redis local via Docker

Exemplo simples para desenvolvimento:

```bash
docker run --name commercial-redis -p 6379:6379 -d redis/redis-stack:latest
```

### Arquivo .env

Crie .env na raiz usando .env.example como base.

```env
PORT=3000

MYSQL_POOL_MAX=10
MYSQL_CONNECTION_TIMEOUT_MS=5000
MYSQL_IDLE_TIMEOUT_MS=30000

DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=seu_usuario
DB_PASSWORD=sua_senha
DB_DATABASE=seu_banco

LLM_BASE_URL=http://localhost:1234/v1
LLM_MODEL=qwen2.5-coder-14b
EMBEDDING_MODEL=text-embedding-model

REDIS_URL=redis://localhost:6379

NODE_ENV=development

SENTRY_DSN=
SENTRY_ENVIRONMENT=development
SENTRY_SAMPLE_RATE=1.0
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Executar

```bash
npm run start:dev
```

### Testes

```bash
npm run test
npm run test:cov
```

### Teste manual de endpoint

```bash
curl.exe -X GET "http://localhost:3000/query/question?question=Quais+sao+os+ultimos+pedidos+da+minha+carteira&employeeId=1" -N
```

### Demo visual do streaming

Abra o arquivo `test.html` na raiz do projeto diretamente no navegador.
Não requer instalação adicional — conecta via SSE e exibe tokens em tempo real.

## Cobertura De Testes Atual

Testes implementados hoje:

1. PipelineError
        Verifica stage, mensagem e detalhes de causa.
2. MetricsService
        Verifica timer e escrita de logs.
3. QueryValidatorService
        Verifica cenários positivos e bloqueios de comandos proibidos.

Escopo atual de testes:
1. Cobertura focada em componentes fundamentais de segurança e observabilidade.
2. Expansão para fluxo de integração end-to-end está planejada como próximo passo.

## Simplificações Deliberadas De Escopo

Para manter o escopo objetivo e o código auditável, alguns recortes foram feitos conscientemente:

1. Mensageria assíncrona
        O fluxo atual é síncrono no request; RabbitMQ não foi incluído nesta versão.
2. Autenticação e autorização
        employeeId entra por query string; validação de identidade e ACL ficaram para etapa seguinte.
3. Evolução operacional
        Observabilidade está em logs locais e métricas em arquivo; pipeline de observabilidade centralizada é próximo passo.

Essas decisões foram tomadas para priorizar núcleo funcional, segurança de SQL e rastreabilidade técnica do pipeline.

## Evolução Planejada Para Produção

1. Mensageria
        Introduzir fila para desacoplar etapas de geração/execução/composição.
2. Segurança de acesso
        Integrar JWT e ACL para vincular employeeId ao usuário autenticado.
3. Observabilidade centralizada
        Exportar métricas para Prometheus/Grafana e consolidar logs.
4. Hardening de LLM
        Timeouts, retries, fallback e políticas de custo/latência.
5. Testes
        Expandir integração e contratos para QueryService, cache, interpreter e composer.

## Variáveis De Ambiente

Tabela consolidada das variáveis usadas no projeto e no setup recomendado.

| Variável | Obrigatória | Descrição | Default quando aplicável |
|---|---|---|---|
| PORT | Não | Porta HTTP da aplicação | 3000 |
| NODE_ENV | Não | Ambiente de execução | development |
| DB_HOST | Sim | Host do MySQL | - |
| DB_PORT | Não | Porta do MySQL | 3306 |
| DB_USERNAME | Sim | Usuário do MySQL | - |
| DB_PASSWORD | Sim | Senha do MySQL | - |
| DB_DATABASE | Sim | Nome do banco | - |
| MYSQL_POOL_MAX | Não | Limite de conexões do pool | 10 |
| MYSQL_CONNECTION_TIMEOUT_MS | Não | Timeout para abrir conexão MySQL | 5000 |
| MYSQL_IDLE_TIMEOUT_MS | Não | Timeout para conexão ociosa no pool | 30000 |
| REDIS_URL | Sim para cache semântico | URL do Redis | - |
| LLM_BASE_URL | Sim | Base URL do provedor de LLM | - |
| LLM_MODEL | Sim | Modelo para interpretação SQL e composição de resposta | - |
| EMBEDDING_MODEL | Sim para embeddings | Modelo de embedding usado no cache semântico | - |
| SENTRY_DSN | Não | DSN do Sentry para monitoramento externo | vazio desabilita |
| SENTRY_ENVIRONMENT | Não | Ambiente reportado ao Sentry | NODE_ENV |
| SENTRY_SAMPLE_RATE | Não | Taxa de amostragem de erros no Sentry | 1.0 |
| SENTRY_TRACES_SAMPLE_RATE | Não | Taxa de amostragem de traces no Sentry | 0.1 |

Observação:
1. .env.example atual já cobre as variáveis principais de execução local.
2. As variáveis de Sentry devem ser adicionadas no .env quando o monitoramento externo for habilitado.

## Autor

Guilherme Souza Santos  
Backend Engineer - Node.js | TypeScript | NestJS

[LinkedIn](https://linkedin.com/in/guilherme-souza-414472219) · [Portfolio](https://guilhermedev.com)
