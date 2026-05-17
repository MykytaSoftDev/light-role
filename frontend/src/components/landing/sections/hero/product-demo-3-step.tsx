"use client";

import { useEffect, useState } from "react";

import { BracketMark } from "@/components/landing/brand/bracket-mark";
import { Wordmark } from "@/components/landing/brand/wordmark";

import { DemoStep1 } from "./demo-step-1";
import { DemoStep2 } from "./demo-step-2";
import { DemoStep3 } from "./demo-step-3";
import { DesktopFrame } from "./desktop-frame";

interface ProductDemo3StepProps {
  frameLabel: string;
  sidebar: {
    dashboard: string;
    profile: string;
    jobs: string;
    resumes: string;
    coverLetters: string;
    applications: string;
    analytics: string;
  };
  step1: {
    title: string;
    stepLabel: string;
    jdTitle: string;
    jdBody: string;
    jdReqs: string;
    fieldKeyTitle: string;
    fieldKeyCompany: string;
    fieldKeyLevel: string;
    fieldKeyStack: string;
    fieldKeySalary: string;
    fieldTitleVal: string;
    fieldCompanyVal: string;
    fieldLevelVal: string;
    fieldStackVal: string;
    fieldSalaryVal: string;
  };
  step2: {
    title: string;
    stepLabel: string;
    personName: string;
    personEmail: string;
    summaryLabel: string;
    experienceLabel: string;
    experienceRole: string;
    bullet1: string;
    bullet2: string;
    bullet3: string;
    matchedLabel: string;
    matchLabel: string;
    keyword1: string;
    keyword2: string;
    keyword3: string;
    keyword4: string;
    keyword5: string;
    summaryPart1: string;
    summaryPart2: string;
    summaryPart3: string;
    summaryPart4: string;
    summaryPart5: string;
    summaryPart6: string;
  };
  step3: {
    title: string;
    stepLabel: string;
    colSaved: string;
    colApplied: string;
    colInterview: string;
    colOffer: string;
    typingLabel: string;
    card1Role: string;
    card2Role: string;
    card3Role: string;
    card4Role: string;
    card5Role: string;
    card6Role: string;
    card7Role: string;
    card8Role: string;
  };
}

export function ProductDemo3Step(props: ProductDemo3StepProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % 3);
    }, 3600);
    return () => window.clearInterval(id);
  }, []);

  const step1Fields = [
    { key: props.step1.fieldKeyTitle, value: props.step1.fieldTitleVal, done: true },
    { key: props.step1.fieldKeyCompany, value: props.step1.fieldCompanyVal, done: true },
    { key: props.step1.fieldKeyLevel, value: props.step1.fieldLevelVal, done: true },
    { key: props.step1.fieldKeyStack, value: props.step1.fieldStackVal, done: true },
    { key: props.step1.fieldKeySalary, value: props.step1.fieldSalaryVal, done: false },
  ];

  const step2Keywords: { label: string; colorId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 }[] = [
    { label: props.step2.keyword1, colorId: 1 },
    { label: props.step2.keyword2, colorId: 3 },
    { label: props.step2.keyword3, colorId: 4 },
    { label: props.step2.keyword4, colorId: 5 },
    { label: props.step2.keyword5, colorId: 1 },
  ];

  const step3Cols = [
    {
      name: props.step3.colSaved,
      count: 7,
      isOffer: false,
      cards: [
        { company: "Linear", role: props.step3.card1Role },
        { company: "Vercel", role: props.step3.card2Role },
        { company: "Cursor", role: props.step3.card3Role },
      ],
    },
    {
      name: props.step3.colApplied,
      count: 5,
      isOffer: false,
      cards: [
        { company: "Notion", role: props.step3.card4Role },
        { company: "Figma", role: props.step3.card5Role },
      ],
    },
    {
      name: props.step3.colInterview,
      count: 2,
      isOffer: false,
      cards: [
        { company: "Stripe", role: props.step3.card6Role },
        { company: "Ramp", role: props.step3.card7Role },
      ],
    },
    {
      name: props.step3.colOffer,
      count: 1,
      isOffer: true,
      cards: [{ company: "Anthropic", role: props.step3.card8Role }],
    },
  ];

  const sidebarItems: { label: string; on: boolean }[] = [
    { label: props.sidebar.dashboard, on: false },
    { label: props.sidebar.profile, on: false },
    { label: props.sidebar.jobs, on: step === 0 },
    { label: props.sidebar.resumes, on: step === 1 },
    { label: props.sidebar.coverLetters, on: false },
    { label: props.sidebar.applications, on: step === 2 },
    { label: props.sidebar.analytics, on: false },
  ];

  const stepPanes = (
    <>
      <DemoStep1
        active={step === 0}
        title={props.step1.title}
        stepLabel={props.step1.stepLabel}
        jdTitle={props.step1.jdTitle}
        jdBody={props.step1.jdBody}
        jdReqs={props.step1.jdReqs}
        fields={step1Fields}
      />
      <DemoStep2
        active={step === 1}
        title={props.step2.title}
        stepLabel={props.step2.stepLabel}
        personName={props.step2.personName}
        personEmail={props.step2.personEmail}
        summaryLabel={props.step2.summaryLabel}
        experienceLabel={props.step2.experienceLabel}
        experienceRole={props.step2.experienceRole}
        bullets={[props.step2.bullet1, props.step2.bullet2, props.step2.bullet3]}
        matchedLabel={props.step2.matchedLabel}
        matchLabel={props.step2.matchLabel}
        keywords={step2Keywords}
        summaryParts={[
          props.step2.summaryPart1,
          props.step2.summaryPart2,
          props.step2.summaryPart3,
          props.step2.summaryPart4,
          props.step2.summaryPart5,
          props.step2.summaryPart6,
        ]}
      />
      <DemoStep3
        active={step === 2}
        title={props.step3.title}
        stepLabel={props.step3.stepLabel}
        cols={step3Cols}
        typingLabel={props.step3.typingLabel}
      />
    </>
  );

  const pipItems = [0, 1, 2].map((i) => (
    <span
      key={i}
      aria-hidden="true"
      className="h-[6px] rounded-full transition-[width] duration-300"
      style={{
        width: i === step ? "22px" : "6px",
        background: i === step ? "var(--color-primary)" : "var(--color-border)",
        border: i === step ? "none" : "1px solid var(--color-border)",
      }}
    />
  ));

  return (
    <>
      <div className="hidden md:block">
        <DesktopFrame label={props.frameLabel} height={520}>
          <div className="w-full h-full grid grid-cols-[180px_1fr] bg-[var(--color-background)]">
            <aside className="border-r border-[var(--color-border)] px-3.5 py-[18px] flex flex-col gap-3 bg-[var(--color-sidebar)]">
              <div className="flex items-center gap-2" role="img" aria-label="Light Role">
                <BracketMark size={20} />
                <Wordmark size={13} />
              </div>
              <div className="h-px bg-[var(--color-border)] -mx-3.5 my-2" />
              {sidebarItems.map(({ label, on }) => (
                <div
                  key={label}
                  className={`px-2 py-1.5 rounded-md font-display text-[12.5px] transition-all duration-300 ${
                    on
                      ? "font-semibold text-[var(--color-primary)] bg-[var(--color-primary-10)]"
                      : "font-medium text-[var(--color-foreground)]"
                  }`}
                >
                  {label}
                </div>
              ))}
            </aside>
            <div className="relative overflow-hidden">
              {stepPanes}
              <div className="absolute bottom-3.5 right-4 flex gap-1.5 items-center">
                {pipItems}
              </div>
            </div>
          </div>
        </DesktopFrame>
      </div>
      <div className="md:hidden">
        <DesktopFrame label={props.frameLabel} height={380}>
          <div className="w-full h-full relative bg-[var(--color-background)]">
            {stepPanes}
            <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex gap-1.5 items-center">
              {pipItems}
            </div>
          </div>
        </DesktopFrame>
      </div>
    </>
  );
}
