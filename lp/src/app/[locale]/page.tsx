import {
  ArrowLeftRight,
  Coffee,
  Columns2,
  Download,
  Feather,
  FileArchive,
  FolderOpen,
  Github,
  Hand,
  Keyboard,
  Monitor,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

const GITHUB_URL = "https://github.com/piro0919/mekuri";
const RELEASE_URL = "https://github.com/piro0919/mekuri/releases/latest";
const COFFEE_URL = "https://buymeacoffee.com/piro0919";

const FEATURES = [
  { key: "formats" as const, icon: FileArchive },
  { key: "spread" as const, icon: Columns2 },
  { key: "rtl" as const, icon: ArrowLeftRight },
  { key: "keyboard" as const, icon: Keyboard },
  { key: "privacy" as const, icon: ShieldCheck },
  { key: "lightweight" as const, icon: Feather },
];

const STEPS = [
  { key: "step1" as const, icon: FolderOpen, step: "01" },
  { key: "step2" as const, icon: SlidersHorizontal, step: "02" },
  { key: "step3" as const, icon: Hand, step: "03" },
];

export default function Page(): ReactNode {
  const t = useTranslations();

  return (
    <main className="min-h-dvh">
      {/* Hero */}
      <section className="relative px-6 pt-20 pb-28 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-[-200px] left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-accent/10 blur-[150px]" />
        </div>
        <div className="relative mx-auto max-w-2xl">
          <Image
            src="/icon.png"
            alt="Mekuri"
            width={160}
            height={160}
            className="mx-auto mb-8 rounded-[28px] shadow-2xl shadow-accent/20"
            priority
          />
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-accent">
            <Monitor size={16} strokeWidth={1.75} />
            {t("Hero.badge")}
          </div>
          <h1 className="mb-3 text-5xl font-bold tracking-tight text-text-1 sm:text-6xl">
            Mekuri
          </h1>
          <p className="mb-4 text-xl font-medium text-text-2 sm:text-2xl">
            {t("Hero.tagline")}
          </p>
          <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-text-3">
            {t("Hero.description")}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={RELEASE_URL}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:-translate-y-0.5 hover:bg-accent-dark hover:shadow-xl hover:shadow-accent/30"
            >
              <Download size={18} strokeWidth={2} />
              {t("Hero.download")}
            </a>
            <a
              href={GITHUB_URL}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-base font-semibold text-text-1 transition-all hover:-translate-y-0.5 hover:border-text-3 hover:shadow-md hover:shadow-black/20"
            >
              <Github size={18} strokeWidth={2} />
              {t("Hero.viewOnGithub")}
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative px-6 py-20">
        <div className="pointer-events-none absolute inset-0 bg-bg-elevated" />
        <div className="relative mx-auto max-w-4xl">
          <h2 className="mb-14 text-center text-sm font-semibold tracking-widest text-text-3 uppercase">
            {t("HowItWorks.title")}
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map(({ key, icon: Icon, step }) => (
              <div key={key} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                  <Icon size={24} strokeWidth={1.75} className="text-accent" />
                </div>
                <span className="mb-2 block font-mono text-xs font-bold tracking-wider text-text-3">
                  STEP {step}
                </span>
                <h3 className="mb-2 text-lg font-semibold text-text-1">
                  {t(`HowItWorks.${key}.title`)}
                </h3>
                <p className="text-sm leading-relaxed text-text-2">
                  {t(`HowItWorks.${key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-sm font-semibold tracking-widest text-text-3 uppercase">
            {t("Features.title")}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-text-3 hover:shadow-lg hover:shadow-black/20"
              >
                <div className="mb-4 inline-flex rounded-xl bg-accent/10 p-2.5">
                  <Icon size={20} strokeWidth={1.75} className="text-accent" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-text-1">
                  {t(`Features.${key}.title`)}
                </h3>
                <p className="text-sm leading-relaxed text-text-2">
                  {t(`Features.${key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 py-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute bottom-[-100px] left-1/2 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-accent/8 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-xl text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight text-text-1">
            {t("CTA.title")}
          </h2>
          <p className="mb-8 text-base text-text-2">{t("CTA.description")}</p>
          <a
            href={RELEASE_URL}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:-translate-y-0.5 hover:bg-accent-dark hover:shadow-xl hover:shadow-accent/30"
          >
            <Download size={18} strokeWidth={2} />
            {t("CTA.download")}
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <span className="text-sm text-text-3">
            {t("Footer.madeBy")}{" "}
            <a
              href={GITHUB_URL}
              className="font-medium text-text-2 transition-colors hover:text-accent"
            >
              piro0919
            </a>
          </span>
          <div className="flex items-center gap-5">
            <a
              href={GITHUB_URL}
              className="inline-flex items-center gap-1.5 text-sm text-text-3 transition-colors hover:text-accent"
            >
              <Github size={14} strokeWidth={1.75} />
              {t("Footer.openSource")}
            </a>
            <a
              href={COFFEE_URL}
              className="inline-flex items-center gap-1.5 text-sm text-text-3 transition-colors hover:text-accent"
            >
              <Coffee size={14} strokeWidth={1.75} />
              {t("Footer.buyMeACoffee")}
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
