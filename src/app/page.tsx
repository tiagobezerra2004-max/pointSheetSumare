import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, UsersRound, WalletCards } from "lucide-react";
import { MockApiStatus } from "@/components/shared/mock-api-status";
import { PageHeader } from "@/components/layout/page-header";

const sections = [
  {
    href: "/trabalhadores",
    title: "Trabalhadores",
    description: "Acesse o cadastro único da equipe da obra.",
    icon: UsersRound,
  },
  {
    href: "/frequencia",
    title: "Frequência",
    description: "Prepare os lançamentos diários de presença.",
    icon: ClipboardCheck,
  },
  {
    href: "/horas-extras",
    title: "Horas extras",
    description: "Consulte e registre horas extras da equipe.",
    icon: WalletCards,
  },
];

export default function Home() {
  return (
    <>
      <PageHeader
        title="Visão geral"
        description="A base do controle de mão de obra da obra Frei Humberto I está pronta para receber as próximas etapas."
      />

      <section
        aria-label="Áreas do sistema"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Link
              key={section.href}
              href={section.href}
              className="group flex min-h-40 flex-col justify-between rounded-xl border bg-card p-5 text-card-foreground transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </div>
              <div className="mt-6">
                <h2 className="font-semibold">{section.title}</h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {section.description}
                </p>
              </div>
            </Link>
          );
        })}
      </section>

      {process.env.NODE_ENV === "development" ? (
        <section className="mt-8 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Conexão de desenvolvimento</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">
            Verificação inicial do endpoint interceptado pelo MSW no navegador.
          </p>
          <MockApiStatus />
        </section>
      ) : null}
    </>
  );
}
