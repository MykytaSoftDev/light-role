import { getTranslations } from "next-intl/server";

import { Container } from "@/components/landing/chrome/container";
import { SectionHead } from "@/components/landing/chrome/section-head";
import { AnalyticsShot } from "@/components/landing/shots/analytics-shot";
import { CoverLetterShot } from "@/components/landing/shots/cover-letter-shot";
import { KanbanShot } from "@/components/landing/shots/kanban-shot";
import { TailorShot } from "@/components/landing/shots/tailor-shot";

import { FeatureCard } from "./feature-card";

export async function Features() {
  const t = await getTranslations("Marketing.landing.features");

  return (
    <section
      className="py-32 border-t border-[var(--color-border)] bg-[var(--color-card)]"
      aria-labelledby="features-heading"
    >
      <Container>
        <SectionHead
          num="2"
          kicker={t("sectionKicker")}
          title={t("sectionTitle")}
          sub={t("sectionSub")}
          headingId="features-heading"
        />
        <div className="mt-[72px] grid grid-cols-12 gap-6">
          <FeatureCard
            className="col-span-12 md:col-span-7"
            num="1"
            tone="primary"
            tag={t("card1Tag")}
            title={t("card1Title")}
            body={t("card1Body")}
            shot={
              <KanbanShot
                labelSaved={t("kanbanSaved")}
                labelApplied={t("kanbanApplied")}
                labelInterview={t("kanbanInterview")}
                labelOffer={t("kanbanOffer")}
              />
            }
          />
          <FeatureCard
            className="col-span-12 md:col-span-5"
            num="2"
            tag={t("card2Tag")}
            title={t("card2Title")}
            body={t("card2Body")}
            shot={
              <TailorShot
                personName={t("tailorPersonName")}
                personEmail={t("tailorPersonEmail")}
                experienceLabel={t("tailorExperience")}
                matchLabel={t("tailorMatch")}
                role1={t("tailorRole1")}
                role1KwA={t("tailorRole1KwA")}
                role1KwB={t("tailorRole1KwB")}
                role1KwC={t("tailorRole1KwC")}
                role2={t("tailorRole2")}
                role2KwA={t("tailorRole2KwA")}
                role2KwB={t("tailorRole2KwB")}
                role1Part1={t("tailorRole1Part1")}
                role1Part2={t("tailorRole1Part2")}
                role1Part3={t("tailorRole1Part3")}
                role1Part4={t("tailorRole1Part4")}
                role2Part1={t("tailorRole2Part1")}
                role2Part2={t("tailorRole2Part2")}
                role2Part3={t("tailorRole2Part3")}
              />
            }
          />
          <FeatureCard
            className="col-span-12 md:col-span-5"
            num="3"
            tag={t("card3Tag")}
            title={t("card3Title")}
            body={t("card3Body")}
            shot={
              <CoverLetterShot
                draftLabel={t("clDraftLabel")}
                greeting={t("clGreeting")}
                body1Pre={t("clBody1Pre")}
                body1Highlight={t("clBody1Highlight")}
                body1Post={t("clBody1Post")}
                body2Pre={t("clBody2Pre")}
                body2Highlight={t("clBody2Highlight")}
                body2Post={t("clBody2Post")}
                signoff={t("clSignoff")}
                name={t("clName")}
              />
            }
          />
          <FeatureCard
            className="col-span-12 md:col-span-7"
            num="4"
            tone="primary"
            tag={t("card4Tag")}
            title={t("card4Title")}
            body={t("card4Body")}
            shot={
              <AnalyticsShot
                statLabel1={t("analyticsStat1Label")}
                statValue1={t("analyticsStat1Value")}
                statDelta1={t("analyticsStat1Delta")}
                statLabel2={t("analyticsStat2Label")}
                statValue2={t("analyticsStat2Value")}
                statDelta2={t("analyticsStat2Delta")}
                statLabel3={t("analyticsStat3Label")}
                statValue3={t("analyticsStat3Value")}
                statDelta3={t("analyticsStat3Delta")}
              />
            }
          />
        </div>
      </Container>
    </section>
  );
}
