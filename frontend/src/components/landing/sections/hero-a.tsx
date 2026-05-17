import { ArrowRight, Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Container } from "@/components/landing/chrome/container";
import { Dot } from "@/components/landing/chrome/dot";
import { MonoTag } from "@/components/landing/chrome/mono-tag";
import { Button } from "@/components/ui/button";
import { getAuthState } from "@/lib/auth/get-auth-state";

import { ProductDemo3Step } from "./hero/product-demo-3-step";

export async function HeroA() {
  const t = await getTranslations("Marketing.landing.hero");
  const { isAuthenticated } = await getAuthState();

  return (
    <section className="pt-32 pb-24" aria-labelledby="hero-heading">
      <Container>
        <div className="flex items-center gap-2.5 mb-8">
          <Dot color="var(--color-primary)" />
          <MonoTag className="text-[12px] tracking-[0.14em]">{t("eyebrow")}</MonoTag>
        </div>

        <h1 id="hero-heading" className="m-0 font-display font-bold text-[var(--color-foreground)] text-[clamp(40px,7.5vw,104px)] leading-[clamp(1,0.95+0.5vw,1.15)] tracking-[-0.045em] max-w-[1100px]">
          {t("headlineLine1")}
          <br />
          <span className="text-[var(--color-muted-fg)]">{t("headlineLine2")}</span>{" "}
          <span
            className="text-[var(--color-primary)] underline"
            style={{
              textDecorationThickness: "6px",
              textUnderlineOffset: "14px",
              textDecorationColor: "var(--color-primary-20)",
            }}
          >
            {t("headlineLine3")}
          </span>
        </h1>

        <div className="mt-9 grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
          <p className="m-0 max-w-[560px] font-body text-[18px] leading-[1.5] text-[var(--color-muted-fg)]">
            {t("paragraph")}
          </p>
          <div className="flex md:justify-end">
            <Button size="xl" asChild className="w-full sm:w-auto">
              <Link href={isAuthenticated ? "/dashboard" : "/auth/register"}>
                {isAuthenticated ? t("ctaPrimaryAuthed") : t("ctaPrimary")}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>

        <div id="demo" className="mt-16 scroll-mt-[88px]">
          <ProductDemo3Step
            frameLabel="lightrole.com/dashboard"
            sidebar={{
              dashboard: t("sidebarDashboard"),
              profile: t("sidebarProfile"),
              jobs: t("sidebarJobs"),
              resumes: t("sidebarResumes"),
              coverLetters: t("sidebarCoverLetters"),
              applications: t("sidebarApplications"),
              analytics: t("sidebarAnalytics"),
            }}
            step1={{
              title: t("step1Title"),
              stepLabel: t("step1Label"),
              jdTitle: t("step1JdTitle"),
              jdBody: t("step1JdBody"),
              jdReqs: t("step1JdReqs"),
              fieldKeyTitle: t("step1FieldKeyTitle"),
              fieldKeyCompany: t("step1FieldKeyCompany"),
              fieldKeyLevel: t("step1FieldKeyLevel"),
              fieldKeyStack: t("step1FieldKeyStack"),
              fieldKeySalary: t("step1FieldKeySalary"),
              fieldTitleVal: t("step1FieldTitleVal"),
              fieldCompanyVal: t("step1FieldCompanyVal"),
              fieldLevelVal: t("step1FieldLevelVal"),
              fieldStackVal: t("step1FieldStackVal"),
              fieldSalaryVal: t("step1FieldSalaryVal"),
            }}
            step2={{
              title: t("step2Title"),
              stepLabel: t("step2Label"),
              personName: t("step2PersonName"),
              personEmail: t("step2PersonEmail"),
              summaryLabel: t("step2SummaryLabel"),
              experienceLabel: t("step2ExperienceLabel"),
              experienceRole: t("step2ExperienceRole"),
              bullet1: t("step2Bullet1"),
              bullet2: t("step2Bullet2"),
              bullet3: t("step2Bullet3"),
              matchedLabel: t("step2MatchedLabel"),
              matchLabel: t("step2MatchLabel"),
              keyword1: t("step2Keyword1"),
              keyword2: t("step2Keyword2"),
              keyword3: t("step2Keyword3"),
              keyword4: t("step2Keyword4"),
              keyword5: t("step2Keyword5"),
              summaryPart1: t("step2SummaryPart1"),
              summaryPart2: t("step2SummaryPart2"),
              summaryPart3: t("step2SummaryPart3"),
              summaryPart4: t("step2SummaryPart4"),
              summaryPart5: t("step2SummaryPart5"),
              summaryPart6: t("step2SummaryPart6"),
            }}
            step3={{
              title: t("step3Title"),
              stepLabel: t("step3Label"),
              colSaved: t("step3ColSaved"),
              colApplied: t("step3ColApplied"),
              colInterview: t("step3ColInterview"),
              colOffer: t("step3ColOffer"),
              typingLabel: t("step3TypingLabel"),
              card1Role: t("step3Card1Role"),
              card2Role: t("step3Card2Role"),
              card3Role: t("step3Card3Role"),
              card4Role: t("step3Card4Role"),
              card5Role: t("step3Card5Role"),
              card6Role: t("step3Card6Role"),
              card7Role: t("step3Card7Role"),
              card8Role: t("step3Card8Role"),
            }}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between font-mono text-[12px] tracking-[0.08em] text-[var(--color-muted-fg)] uppercase">
          <span>{t("trustLine")}</span>
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5">
              <Check size={12} /> {t("trustTick1")}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={12} /> {t("trustTick2")}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={12} /> {t("trustTick4")}
            </span>
          </span>
        </div>
      </Container>
    </section>
  );
}
