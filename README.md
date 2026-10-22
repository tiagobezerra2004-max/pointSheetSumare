# Controle de mão de obra

Base do sistema para a obra Frei Humberto I, criada com Next.js App Router,
TypeScript, Tailwind CSS e shadcn/ui.

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). No desenvolvimento, o MSW
é iniciado no navegador e intercepta `GET /api/health`, endpoint usado para
verificar a configuração inicial. As demais chamadas de rede seguem sem
interceptação.

Para acessar o servidor de desenvolvimento por outro dispositivo na rede
local, inclua o IP usado na URL em `allowedDevOrigins`, em `next.config.ts`, e
reinicie o servidor.

A URL base da API pode ser configurada pela variável `NEXT_PUBLIC_API_URL`.
Quando ela não estiver definida, as chamadas usam os endpoints locais
interceptados pelo MSW.

## Rotas iniciais

- `/trabalhadores` — lista e cadastro de trabalhadores (RF01).
- `/frequencia` — lançamento diário e consulta semanal/mensal (RF02).
- `/horas-extras` — lançamento, consulta, edição e exclusão de horas extras
  (RF03), com cálculo automático e filtros por trabalhador, atividade e período.

O layout inclui navegação lateral no desktop, navegação inferior em telas
pequenas e alternância entre os temas claro e escuro. Formatadores pt-BR ficam
em `src/lib/formatters.ts`.

## Verificações

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```
