import Image from "next/image";
import {
  ArrowLeftRight,
  Coffee,
  Columns2,
  Download,
  Feather,
  FileArchive,
  FolderOpen,
  Hand,
  Keyboard,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { GithubMark } from "@/components/GithubMark";
import { Link } from "@/i18n/navigation";

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

type PageProps = { params: Promise<{ locale: string }> };

export default async function Page({ params }: PageProps): Promise<ReactNode> {
  const { locale } = await params;

  setRequestLocale(locale);

  const t = await getTranslations();

  return (
    <main className="min-h-dvh">
      {/* Hero */}
      <section className="overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pt-16 pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8 lg:pt-24 lg:pb-28">
          <div className="min-w-0">
            <div className="mb-8 flex flex-wrap items-center gap-2">
              {["CBZ", "CBR", t("Hero.chipFolder")].map((chip) => (
                <span
                  className="border border-rule px-3 py-1 font-mono text-xs tracking-wider text-text-1 uppercase"
                  key={chip}
                >
                  {chip}
                </span>
              ))}
            </div>
            <h1 className="font-display text-6xl leading-[0.9] font-bold tracking-[-0.03em] text-text-1 sm:text-7xl lg:text-8xl">
              Mekuri
            </h1>
            <p className="mt-4 font-mono text-base tracking-[0.5em] text-accent">
              {t("Hero.kana")}
            </p>
            <p className="mt-8 max-w-md font-display text-2xl leading-snug font-medium text-text-1">
              {t("Hero.tagline")}
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-text-2">
              {t("Hero.description")}
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex items-center justify-center gap-2 bg-rule px-6 py-3.5 text-base font-semibold text-bg transition-colors hover:bg-accent"
                href={RELEASE_URL}
              >
                <Download size={18} strokeWidth={2} />
                {t("Hero.download")}
              </a>
              <a
                className="inline-flex items-center justify-center gap-2 border border-rule px-6 py-3.5 text-base font-semibold text-text-1 transition-colors hover:bg-bg-elevated"
                href={GITHUB_URL}
              >
                <GithubMark size={18} />
                {t("Hero.viewOnGithub")}
              </a>
            </div>
            <p className="mt-6 font-mono text-xs tracking-wider text-text-3">
              {t("Hero.badge")}
            </p>
          </div>

          {/* 実際の見開き。同種の漫画リーダーはどれも本物のコマを見せていて、
              描き起こした絵より実物のほうが強い */}
          <div className="min-w-0">
            <Image
              alt={t("screens.spread")}
              className="w-full"
              height={1600}
              priority={true}
              src="/screenshot-spread.png"
              width={2400}
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-b border-border px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 font-mono text-xs font-semibold tracking-wider text-accent">
            {t("HowItWorks.title")}
          </h2>
          <div className="grid gap-10 sm:grid-cols-3 sm:gap-0">
            {STEPS.map(({ key, icon: Icon, step }) => (
              <div
                className="sm:border-l sm:border-border sm:px-7 sm:first:border-l-0 sm:first:pl-0"
                key={key}
              >
                <div className="mb-5 flex items-baseline gap-3">
                  <span className="font-mono text-4xl font-bold text-accent">
                    {step}
                  </span>
                  <Icon
                    className="text-text-3"
                    size={20}
                    strokeWidth={1.75}
                  />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold text-text-1">
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
          <h2 className="mb-12 font-mono text-xs font-semibold tracking-wider text-accent">
            {t("Features.title")}
          </h2>
          <dl className="grid border-t border-border sm:grid-cols-2">
            {FEATURES.map(({ key, icon: Icon }) => (
              <div
                className="border-b border-border py-7 sm:odd:border-r sm:odd:pr-8 sm:even:pl-8"
                key={key}
              >
                <dt className="mb-2 flex items-center gap-2.5 text-base font-semibold text-text-1">
                  <Icon
                    className="text-accent"
                    size={18}
                    strokeWidth={1.75}
                  />
                  {t(`Features.${key}.title`)}
                </dt>
                <dd className="text-sm leading-relaxed text-text-2">
                  {t(`Features.${key}.description`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-rule px-6 py-24 text-bg">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-display text-4xl leading-tight font-bold tracking-tight">
            {t("CTA.title")}
          </h2>
          <p className="mt-4 text-base text-bg/70">{t("CTA.description")}</p>
          <a
            className="mt-9 inline-flex items-center gap-2 bg-bg px-6 py-3.5 text-base font-semibold text-text-1 transition-colors hover:bg-accent hover:text-bg"
            href={RELEASE_URL}
          >
            <Download size={18} strokeWidth={2} />
            {t("CTA.download")}
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <span className="text-sm text-text-3">
            {t("Footer.madeBy")}{" "}
            <a
              className="font-medium text-text-2 transition-colors hover:text-accent"
              href={GITHUB_URL}
            >
              piro0919
            </a>
          </span>
          <div className="flex items-center gap-5">
            <a
              className="inline-flex items-center gap-1.5 text-sm text-text-3 transition-colors hover:text-accent"
              href={GITHUB_URL}
            >
              <GithubMark size={14} />
              {t("Footer.openSource")}
            </a>
            <a
              className="inline-flex items-center gap-1.5 text-sm text-text-3 transition-colors hover:text-accent"
              href={COFFEE_URL}
            >
              <Coffee size={14} strokeWidth={1.75} />
              {t("Footer.buyMeACoffee")}
            </a>
            <Link
              className="inline-flex items-center gap-1.5 text-sm text-text-3 transition-colors hover:text-accent"
              href="/privacy"
            >
              <Shield size={14} strokeWidth={1.75} />
              {t("Footer.privacy")}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
