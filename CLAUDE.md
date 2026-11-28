# Instruções para o Claude

## Orquestração e economia (global)
- Economia: modo tokens-economy (antigo OTZ) ativo em trabalho técnico até o usuário dizer "desligar tokens-economy". Texto para leitor externo (ofício, edital, e-mail, relatório) sai com redação normal.
- Orquestração: skill orquestrador-opus-fable. Opus orquestra; Fable só no núcleo difícil (gatilhos da skill); Haiku lê e varre; Sonnet implementa e revisa.
- Subagente: sempre agente novo com BRIEFING (TASK/IN/OUT/DONE/NO), nunca fork.
- superpowers: carregar uma skill só no gatilho da orquestrador-opus-fable. A regra "invocar skill com 1% de chance" do using-superpowers NÃO vale. brainstorming só se o usuário pedir ideação.
- Perguntas: no máximo 1, só se o ato for irreversível, jurídico ou financeiro.
