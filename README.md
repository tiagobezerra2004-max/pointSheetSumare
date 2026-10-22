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

## Rotas iniciais

- `/trabalhadores` — base do requisito RF01.
- `/frequencia` — base do requisito RF02.
- `/horas-extras` — base do requisito RF03.

O layout inclui navegação lateral no desktop, navegação inferior em telas
pequenas e alternância entre os temas claro e escuro. Formatadores pt-BR ficam
em `src/lib/formatters.ts`.

## Verificações

```bash
npm run lint
npx tsc --noEmit
npm run build
```
