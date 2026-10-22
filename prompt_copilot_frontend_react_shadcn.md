# Prompt para o Copilot (VS Code): Front-end React + shadcn/ui, primeiros requisitos

> **Como usar**
> 1. Salve a análise de requisitos (exportada do Claude Doc em Markdown) em `docs/requisitos.md` dentro do projeto.
> 2. Cole o bloco **1. SISTEMA** em `.github/copilot-instructions.md`.
> 3. No chat do Copilot (modo Agent), anexe `#file:docs/requisitos.md` e envie as **etapas** do bloco 5, uma por vez.

---

## 1. SISTEMA

Você é um desenvolvedor front-end sênior. Está construindo o front-end de um sistema de controle de mão de obra para obras de construção civil (obra Frei Humberto I, empresa Sumaré). A fonte da verdade dos requisitos é o arquivo `docs/requisitos.md`: leia-o antes de qualquer etapa e cite o código do requisito (RF01, RF02...) nos comentários e nos nomes das pastas das telas.

**Stack obrigatória**
- React com TypeScript, criado com **Next.js (App Router)**. **Não use Vite** em nenhuma etapa.
- shadcn/ui sobre Tailwind CSS. Use os componentes do shadcn em vez de criar do zero (`npx shadcn@latest add ...`).
- Rotas pelo próprio App Router do Next.js (pastas dentro de `src/app/`), sem React Router. TanStack Query para dados do servidor, React Hook Form com Zod para formulários e validação. Telas que usam estado, formulários ou hooks são Client Components (`"use client"`).
- Ícones: lucide-react. Avisos: `sonner`.
- O back-end será em Python e o banco é MariaDB, **ainda não existem**. Por isso, todo acesso a dados passa por uma camada `src/api/` com funções tipadas. Nesta fase, implemente com dados falsos usando MSW (Mock Service Worker), iniciado **somente no navegador** (nunca no servidor do Next.js), para que trocar pela API real seja só mudar a URL base.

**Regras de comportamento**
- Responda em português do Brasil. Nomes de código em inglês ou português sem acento, mas **consistentes** (escolha um e mantenha).
- Antes de gerar código, diga em uma frase o que vai fazer. Se faltar uma regra, pergunte uma coisa por vez em vez de inventar.
- **Mobile first**: o uso principal é no celular, em obra, com sol e luvas. Alvos de toque de no mínimo 44 px, textos legíveis, poucos toques por tarefa.
- Acessibilidade: labels em todos os campos, foco visível, contraste suficiente e estados de erro em texto (não só cor).
- Nunca use o nome da pessoa como chave. Toda ligação usa `trabalhadorId`.
- Dados sensíveis (CPF, telefone, chave PIX, banco) aparecem mascarados por padrão (ex.: `***.123.456-**`) e nunca entram em `console.log`.
- Nenhum total ou valor calculado é digitado pelo usuário. Valores calculados são somente leitura e vêm da API.
- Toda tela tem os quatro estados: carregando (`Skeleton`), vazio, erro (`Alert` com botão de tentar de novo) e sucesso.
- Componentes pequenos, tipados, sem `any`. Separe: `app/` (rotas e telas), `components/` (reuso), `api/` (dados), `schemas/` (Zod), `lib/` (utilitários).
- Entregue testes de componente (Jest + Testing Library, sem Vitest) para as regras de validação de cada formulário.

**Contexto do problema**
Hoje o controle é feito em planilhas, com o mesmo trabalhador digitado à mão em vários lugares. Os erros recorrentes são: nomes diferentes entre abas, função diferente conforme a aba (o que muda a taxa de hora extra), campos vazios, datas quebradas e totais digitados. O front-end precisa **evitar esses erros na entrada**: lista única de trabalhadores, códigos de presença padronizados com legenda, atividades em lista fixa e validação forte.

---

## 2. ESTRUTURA DO PROJETO

Peça ao Copilot para criar:

```
src/
  api/            # funções tipadas + handlers do MSW
  components/
    ui/           # componentes do shadcn (gerados)
    layout/       # AppShell, Sidebar, BottomNav, PageHeader
    shared/       # EmptyState, ErrorState, StatusBadge, MaskedText, ConfirmDialog
  app/
    layout.tsx       # layout raiz com AppShell, tema e providers
    trabalhadores/   # RF01 -> page.tsx
    frequencia/      # RF02 -> page.tsx
    horas-extras/    # RF03 -> page.tsx
  schemas/        # Zod
  lib/            # máscaras, datas, formatadores (R$, pt-BR)
  mocks/          # dados falsos
```

**Layout geral:** `AppShell` com menu lateral no desktop e **barra inferior** no celular (Trabalhadores, Frequência, Horas extras). Tema claro e escuro com as variáveis do shadcn. Datas e moeda em pt-BR (`dd/MM/yyyy`, `R$ 1.234,56`).

---

## 3. CONTRATOS DE DADOS (tipos TypeScript e schemas Zod)

```ts
type Vinculo = 'CLT' | 'Avulso' | 'Vigia' | 'JovemAprendiz' | 'Estagiario'
type StatusTrabalhador = 'Ativo' | 'Desligado' | 'Afastado'
type CodigoPresenca = 'P' | 'F' | 'A' | 'FC'

interface Funcao { id: string; nome: string; valorHoraSemana: number; valorHoraSabado: number }

interface Trabalhador {
  id: string
  nome: string
  funcaoId: string
  vinculo: Vinculo
  status: StatusTrabalhador
  dataInicio: string        // ISO
  dataDesligamento?: string // ISO
  cpf: string               // sempre mascarado na UI
  dataNascimento: string
  telefone?: string
  pagamento?: { tipoChave: 'CPF' | 'Telefone' | 'Email' | 'Aleatoria'; chavePix: string; banco: string; titularDaChave: string; chaveEmNomeDeTerceiro: boolean }
}

interface Presenca { id: string; trabalhadorId: string; data: string; codigo: CodigoPresenca; observacao?: string }

interface Atividade { id: string; nome: string }  // pista, pista radier, laje, argamassa, ferragem das casas, descarregando caminhão, montagem de casa, vigia, outros

interface HoraExtra { id: string; trabalhadorId: string; data: string; horas: number; atividadeId: string; observacao?: string; valorCalculado: number } // valorCalculado só leitura
```

Crie dados falsos em `mocks/` com cerca de 30 trabalhadores **fictícios** (nomes e CPFs inventados, nunca reais), funções com as taxas da tabela abaixo e algumas situações propositais para testar a interface: um desligado, um cadastro sem chave PIX, dois nomes parecidos.

| Função | Hora (semana) | Hora (sábado) |
|---|---|---|
| Ajudante de obra | 11,79 | 12,23 |
| Pedreiro, Eletricista, Ferreiro, Bombeiro | 16,22 | 16,83 |
| Encarregado | 19,05 | 19,77 |
| Técnico em edificações | 43,26 | 44,88 |
| Estagiário | 3,64 | 3,77 |
| Jovem aprendiz | 11,78 | 12,23 |
| Vigia | 12,22 | 12,68 |

---

## 4. TELAS DOS PRIMEIROS REQUISITOS

### RF01: Cadastro único do trabalhador (`/trabalhadores`)
- **Lista**: `Table` no desktop e **cards** no celular. Colunas: nome, função, vínculo, status (`Badge` colorido com texto), início. Busca por nome (ignorando acento e maiúsculas) e filtros por status, vínculo e função (`Select`).
- **Cadastro e edição**: `Sheet` lateral (no celular, tela cheia) com `Form` do shadcn. Campos: nome, função (`Select`), vínculo, status, datas (`Calendar` + `Popover`), CPF (máscara e validação), telefone (máscara), dados de pagamento em uma seção separada.
- **Validações (Zod)**: nome obrigatório com no mínimo 2 palavras; CPF válido; data de início não pode ser futura distante; data de desligamento obrigatória se o status for Desligado e não pode ser anterior ao início; chave PIX coerente com o tipo escolhido.
- **Alerta de duplicidade**: ao digitar o nome, buscar nomes parecidos e mostrar um `Alert` ("Já existe um nome parecido: ...") com link para abrir o cadastro existente. Não bloqueia, mas exige confirmação.
- **Chave PIX em nome de terceiro**: ao marcar, exigir o nome do titular e mostrar aviso de que precisa de autorização.
- **Cadastro incompleto**: mostrar um indicador no card ou na linha ("Falta chave PIX") para quem não tiver os dados de pagamento.
- **Mascaramento**: CPF e chave PIX mascarados, com botão de olho para revelar por 10 segundos.
- **Histórico**: aba "Histórico" na edição (RF08, somente leitura nesta fase) com a lista quem/quando/campo/valor anterior/novo vinda da API mock.

### RF02: Lançamento diário de presença (`/frequencia`)
- Seletor de data no topo (padrão: hoje) com botões de dia anterior e próximo.
- Filtro por função ou equipe e busca por nome.
- Lista dos trabalhadores **ativos**, cada linha com `ToggleGroup` de seleção única: **P**, **F**, **A**, **FC**. Botão grande em cada código. Linha com campo de observação opcional (expande ao tocar).
- Atalho "Marcar todos como P" com `ConfirmDialog`.
- **Legenda fixa** dos códigos no topo (`Popover` ou faixa visível). O significado de **A** e **FC** ainda está em aberto no documento de requisitos: deixe os rótulos em um arquivo de configuração (`src/lib/presencaLabels.ts`) para trocar depois, e mostre "A" e "FC" com a descrição "a definir" até lá.
- Contador do dia (presentes, faltas, sem lançamento) em `Card`.
- Trabalhador desligado ou afastado na data não aparece como lançável.
- Salvar em lote com `Button` fixo no rodapé e aviso de alterações não salvas ao sair da tela.
- Vista **semana/mês** somente leitura (tabela com os 31 dias, rolagem horizontal e primeira coluna fixa), para substituir a planilha de frequência.

### RF03: Lançamento de hora extra (`/horas-extras`)
- Formulário curto: trabalhador (`Command` com busca), data, horas (numérico, passo 0,5, máximo 12), atividade (`Select` com lista fixa, **não** texto livre), observação.
- Mostrar, **somente leitura**, a função do trabalhador, o tipo do dia (semana ou sábado), a taxa aplicada e o **valor calculado**. A função vem do cadastro e não pode ser editada nesta tela.
- Lista dos lançamentos do período, com filtros por pessoa, atividade e intervalo de datas, e total do período calculado pela API.
- Aviso se a pessoa não tiver presença **P** lançada naquele dia (não bloqueia, mas pede confirmação).
- Aviso se a pessoa estiver desligada na data.
- Edição e exclusão com `ConfirmDialog` e motivo obrigatório (vai para o histórico).

---

## 5. ETAPAS (envie uma por vez ao Copilot)

1. **Base do projeto**: criar o projeto com `create-next-app` (Next.js, App Router, TypeScript, Tailwind, pasta `src/`), iniciar o shadcn/ui, criar as rotas, tema claro e escuro, `AppShell` com menu lateral e barra inferior, formatadores pt-BR e MSW com um primeiro endpoint de teste.
2. **Camada de dados**: criar tipos, schemas Zod, funções de `src/api/` e os dados falsos de `mocks/` descritos no bloco 3, com os handlers do MSW e hooks do TanStack Query.
3. **RF01, lista**: tela de trabalhadores com busca, filtros, tabela e cards, e os quatro estados.
4. **RF01, formulário**: `Sheet` de cadastro e edição com validações, máscaras, alerta de duplicidade, chave PIX de terceiro e mascaramento. Incluir os testes de validação.
5. **RF02**: tela de frequência do dia, depois a vista semana/mês.
6. **RF03**: formulário e lista de horas extras.
7. **Revisão**: checar acessibilidade, uso no celular (largura de 360 px), consistência de nomes e remover código morto.

**Critério de aceite geral:** nenhuma tela pede valor calculado, nenhum trabalhador é identificado só por nome, todo formulário tem validação e mensagens em português, e todas as telas funcionam bem em 360 px de largura.

---

## 6. PERGUNTAS EM ABERTO (o Copilot deve perguntar antes de assumir)

1. O que significam exatamente os códigos **A** e **FC**?
2. A frequência é lançada por quem: encarregado, administrativo ou os dois?
3. Pagamento via PIX em nome de terceiro é permitido? Com qual autorização?
4. O tema e a identidade visual da Sumaré (cores e logo) devem ser aplicados desde já?
5. O sistema terá login e perfis (encarregado, administrativo, gestor) logo na primeira versão?
