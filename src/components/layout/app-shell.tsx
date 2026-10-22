"use client";

import {
  ClipboardCheck,
  HardHat,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const navigation = [
  { href: "/trabalhadores", label: "Trabalhadores", icon: UsersRound },
  { href: "/frequencia", label: "Frequência", icon: ClipboardCheck },
  { href: "/horas-extras", label: "Horas extras", icon: WalletCards },
];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-20 items-center gap-3 border-b px-6">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HardHat aria-hidden="true" className="size-6" />
          </span>
          <div>
            <p className="font-semibold leading-tight">Controle de obra</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Frei Humberto I
            </p>
          </div>
        </div>
        <nav aria-label="Navegação principal" className="flex-1 space-y-2 p-4">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon aria-hidden="true" className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t px-6 py-4 text-xs text-muted-foreground">
          Sumaré · Controle de mão de obra
        </div>
      </aside>

      <div className="min-h-dvh lg:pl-72">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-10">
          <div>
            <p className="text-sm font-semibold">Controle de mão de obra</p>
            <p className="text-xs text-muted-foreground">
              Obra Frei Humberto I
            </p>
          </div>
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-10 lg:pb-10">
          {children}
        </main>
      </div>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-4px_18px_-14px_rgba(0,0,0,0.35)] backdrop-blur lg:hidden"
      >
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon aria-hidden="true" className="size-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
