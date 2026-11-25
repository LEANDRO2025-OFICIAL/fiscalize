# RadarCompras - Módulo de Sinais de Risco

## O que é

O **RadarCompras** é um módulo de suporte à fiscalização pública que gera **sinais de risco estruturados e determinísticos** sobre contratos do órgão. Seu objetivo é **apoiar**, nunca substituir, o julgamento do fiscal ou controlador.

> **Princípio fundamental:** o sistema nunca emite juízo de valor sobre licitantes. Ele apenas fornece números calculados de forma determinística e auditável. Cabe à pessoa revisora decidir se há irregularidade.

---

## Como funciona

### Regras de negócio (determinísticas)

O RadarCompras aplica duas regras fixas sobre os dados já cadastrados no sistema:

| Regra | O que detecta | Como calcula | Limite |
|-------|---------------|--------------|--------|
| **Divergência de preço** | Item cujo preço unitário está acima da média de itens similares (mesma descrição e unidade de medida) no órgão | `desvio = (preço_item - média_dos_outros) / média_dos_outros × 100` | Acima de 20% |
| **Vínculo cadastral identificado** | Fornecedor de um contrato que também consta como organização vinculada ao órgão contratante | Compara `cnpj` do fornecedor do contrato com `cnpj` de organizações do tipo "empresa" e verifica existência na tabela `vinculo_fornecedor` | Qualquer vínculo existente |

### Fluxo de vida de um sinal

1. **Geração:** O usuário clica em "Recalcular sinais". O sistema apaga sinais anteriores e regenera do zero aplicando as regras determinísticas.
2. **Estado inicial:** Todo sinal nasce com status `aguarda_revisao`.
3. **Revisão humana:** Um administrador, controlador ou fiscal lê o sinal, analisa o contrato e registra um parecer (texto livre). O status passa para `revisado`.
4. **Dossiê:** Apenas sinais revisados podem ser incluídos em dossiê de exportação (funcionalidade prevista na Fatia 4 do projeto).

---

## Restrições de arquitetura (travas)

| Trava | Descrição |
|-------|-----------|
| **T1** | A IA não gera texto livre sobre o licitante. Preenche apenas campos estruturados (`regra_aplicada`, `valor_observado`, `valor_referencia`, `desvio_percentual`, `confianca`). O texto da tela é montado por template a partir desses campos, nunca por modelo. |
| **T2** | Vocabulário fechado. O sistema reconhece apenas "sinal para revisão", "divergência de preço" e "vínculo cadastral identificado". As palavras "irregular" e "fraude" **não existem** no dicionário do produto e não podem ser emitidas. |
| **T3** | Toda saída exige revisão humana registrada. Um sinal sem parecer humano anexado não pode ser incluído em dossiê exportado. O sistema nunca afirma nada sozinho — quem afirma é a pessoa que revisou e assinou o parecer. |

---

## Telas e ações

### Página principal (`/sinais-risco`)

| Elemento | Descrição |
|----------|-----------|
| **Indicadores** | Total de sinais, divergências de preço, vínculos cadastrais |
| **Filtros** | Por contrato, tipo de sinal e status de revisão |
| **Tabela** | Lista de sinais com contrato, tipo, regra, valores, desvio %, confiança, status da revisão e ação |
| **Botão Recalcular** | (Apenas administrador, controlador, fiscal) Regenera sinais do zero |
| **Botão Registrar parecer** | (Apenas em sinais "aguarda revisão humana") Abre campo de texto para o parecer |

### Ações disponíveis

| Ação | Quem pode | Quando |
|------|-----------|--------|
| Recalcular sinais | administrador, controlador, fiscal | Sempre |
| Registrar parecer | administrador, controlador, fiscal | Sinal em `aguarda_revisao` |
| Incluir sinal revisado em dossiê | administrador, controlador | Sinal com status `revisado` |

---

## Segurança

- **Isolamento por órgão (RLS):** Todo escopo é filtrado por `organizacao_id` no banco de dados. Um órgão não enxerga sinais de outro.
- **Sessão assinada:** O órgão vem de cookie HMAC-SHA256 assinado, não pode ser forjado pelo cliente.
- **RBAC por papel:** Apenas administrador, controlador e fiscal podem gerar/revisar sinais.
- **Auditoria encadeada:** Toda geração e revisão de sinal é registrada na trilha de auditoria com hash SHA-256 encadeado.

---

## Dados exibidos (não há número estático)

Todo número exibido na interface vem do banco de dados. Não há dados hardcoded ou de demonstração estática. Os dados de exemplo aparecem apenas porque o usuário clicou em "Recalcular sinais" sobre contratos reais cadastrados.

---

## Limitações atuais (Fatia 2)

- Não há IA de extração de documentos (a variável `AI_PROVIDER` existe, mas nenhum código a consome).
- Não há integração com PNCP.
- O dossiê de exportação de sinais está previsto para a Fatia 4 (Radar + dossiê).
- Não há anexação de evidências externas aos sinais.
