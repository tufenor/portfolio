# moneyIA

Operação de serviços freelancer produzidos com IA, coordenada por Codex e DeepSeek. Primeiro marco: **um trabalho aceito, entregue e efetivamente recebido**. Receita confirmada inicial: **zero**.

- [Plano de execução](docs/PLANO.md)
- [Quadro de operação e rotina diária](docs/QUADRO-OPERACAO.md)
- [Estrutura da equipe MoneyIA](docs/EMPRESA-MONEYIA.md) — Aurora (COO), Caio (Produto), Maya (Comercial), Helena (Risco) e Nilo (QA)
- [Prompt implementável dos agentes de cadastro](docs/PROMPT-AGENTES-CADASTRO.md) — visão do MoneyIA, catálogo multi-site, Atlas/Orbe, integração com JARVIS e definição de pronto
- [Radar global com sessão segura](reports/2026-11-25-radar-global.md) — shards públicos, gates humanos, deduplicação e retomada
- [Case público do Radar no portfólio](https://tufenor.github.io/portfolio/case/moneyia-radar.html) — descoberta, fila visual e estados de evidência
- [Relatório de publicação e e-mail (26/11/2026)](reports/2026-11-26-radar-portfolio.md)
- [Operação e portfólio (26/11/2026)](reports/2026-11-26-moneyia-operacao.md)
- [Oportunidades globais revalidadas (26/11/2026)](reports/2026-11-26-global-opportunities.md)
- [Pesquisa Brasil/Bolívia](research/mercados-brl-bob.md)
- [Pesquisa em dólar](research/mercado-usd.md)
- [Modelo e experimento de sete dias](research/modelo-operacional.md)
- [Canal para DeepSeek](coordination/CODEX_TO_DEEPSEEK.md)
- [Respostas do DeepSeek](coordination/DEEPSEEK_TO_CODEX.md)
- [Painel local](dashboard/index.html) (gerado por `tools/build-dashboard.mjs`)
- [Mesa de aprovações](app/README.md) — aplicação local em `http://127.0.0.1:8899` e bot Telegram
- [Acesso remoto no Frequency](deploy/frequency/README.md) — pacote de publicação separado, com HTTPS/Caddy e Basic Auth
- [Prompt do JARVIS Control Center](docs/PROMPT-GEMINI-JARVIS-CONTROL-CENTER.md) — especificação para o front-end de alto nível
- [Política de publicação GitHub/LinkedIn](docs/POLITICA-PUBLICACAO-GITHUB-LINKEDIN.md) — checklist de sanitização e estados de evidência
- [Roteamento de skills MoneyIA](docs/ROTEAMENTO-SKILLS-MONEYIA.md) — seleção de ferramentas, QA e publicação permanente
- [Prioridade de plataformas](reports/2026-11-26-platform-priority.md) — Freelancer.com.br primeiro e mercados globais em seguida
- [Ciclo global de plataformas (26/11)](reports/2026-11-26-global-platforms-cycle.md) — Upwork, Guru, PeoplePerHour, Contra e Fiverr
- [Case público do radar global](https://tufenor.github.io/portfolio/case/moneyia-radar-global-2026-11-26.html)
- [Case público da ponte JARVIS](https://tufenor.github.io/portfolio/case/moneyia-jarvis-bridge-2026-11-26.html)
- [Rascunhos de listings globais](reports/2026-11-26-listings-global-drafts.md) — PeoplePerHour, Fiverr e Contra
- [Rotina de 30 oportunidades](docs/ROTINA-30-OPORTUNIDADES.md) — pipeline de captura até entrega e recebimento
- [Implantação da rotina única](reports/2026-11-24-rotina-30-oportunidades.md) — estado e integração Vercel
- [Integração da Mesa no tablet JARVIS](reports/2026-11-25-integracao-jarvis-tablet.md) — aprovações, tarefas e perguntas
- [Ponte direta da Mesa para IA](reports/2026-11-25-ponte-direta-ia.md) — ChatGPT preferido, fallback por cota e estados de entrega
- [Ponte local de continuidade](reports/2026-11-25-ponte-local.md) — fila persistente e fallback manual quando a IA parar
- [Leitura Gmail para propostas e respostas](reports/2026-11-25-gmail-intake.md) — alertas, aceites, cancelamentos e novas oportunidades
- O verificador somente leitura roda com `node tools/email-watch.mjs --interval=30`; o estado fica em `GET /api/emails/watch` e aparece na Mesa. Ele exige o Chrome autenticado no CDP 9333 e não altera mensagens.
- [Fila de aceites e despacho](reports/2026-11-25-fila-aceites-e-dispatch.md) — aprovações, tarefas do agente e evidência externa
- [Triagem completa de oportunidades](reports/2026-11-25-triagem-completa-oportunidades.md) — demos e aprovações APR-019 a APR-021
- [Radar Freelancer.com.br e fila de aprovação](reports/2026-11-25-freelancer-br-radar-e-fila-aprovacao.md) — 155 oportunidades, demos, preços e aprovação ordenada
- [Vitrine pública para publicar](site/index.html) e [demonstração antes/depois](site/demo/cafe-aurora.html)
- [Modalidades de receita além de freelancer](research/2026-11-17-modalidades-alem-freelancer.md)
- [O que paga agora — fóruns e canais de venda](research/2026-11-17-o-que-paga-agora.md)
- [Plano de receita em 30 dias](docs/plano-receita-30-dias.md) — trilha BRL (Menu Studio) e trilha USD (marketplace)
- [Perfil de Google para negócios de Cochabamba](docs/plano-google-cochabamba.md) — serviço atual: Bs 150
- [Créditos e camadas gratuitas](reports/2026-11-17-creditos-gratuitos-pf.md) — `node tools/creditos.mjs`
- [Custo de uso dos agentes](reports/2026-11-17-custo-tokens-agentes.md) e [roteamento por tarefa](docs/roteamento-e-custo.md)
- [Kit de perfil LinkedIn](docs/linkedin-perfil.md) e [publicações prontas](docs/linkedin-posts.md)
- [Panorama diário e integração com o JARVIS](docs/jarvis-panorama.md) — `node tools/panorama.mjs`

Os anúncios são evidências de demanda, não contratos. Conferir disponibilidade, uso de IA, rota de saque e escopo antes de candidatar. Vender diariamente e receber diariamente são metas diferentes.

Publicado: [vitrine](https://tufenor.github.io/portfolio/) · [perfil GitHub](https://github.com/tufenor/tufenor). Repositórios locais de publicação em `site/` e `portfolio/github/`; o script `tools/publish.ps1` só envia depois de passar por `tools/check-public-safe.mjs`.

Wise e conta internacional Inter foram declaradas pelo titular; a compatibilidade de cada fluxo ainda precisa ser verificada. Não há dados bancários neste repositório.
- [Case: operação com agentes](docs/linkedin-posts-projeto.md) — publicado em https://tufenor.github.io/portfolio/projeto/
- [Estado final](docs/estado-final-moneyia.md) · [Cadastro e envio](docs/cadastro-e-envio.md) · [Briefing do dia](coordination/chatgpt-brief-latest.md)
- [Recebimento em bolivianos](docs/recebimento-bob.md) — transferência e QR Simple
- [CHAT_LOG — o que os agentes fizeram](coordination/CHAT_LOG.md)

- [Onboarding de cliente](docs/estado-final-moneyia.md) — node tools/onboarding.mjs <id>
- [Como operar — uma página](docs/COMO-OPERAR.md)
- [Mensagens prontas — 16 negócios](docs/mensagens-prontas.txt)
- [Hospedagem na Bolívia — preços](docs/hospedagem-bolivia.md)
- [Fiação da placa ESP32](docs/jarvis-placa-fiacao.md)
