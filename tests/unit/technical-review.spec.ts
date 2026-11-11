import { test, expect } from '@playwright/test';
import {
  CONFIG,
  IDEA_QUESTIONS,
  SCOPE,
  buildPlan,
  contextFromAnswers,
  isShown,
  planQuestionIds,
  questionText,
  scoreRun,
  type Answers,
  type Plan,
} from '../../supabase/functions/technical-review/engine';

// Technical review (SPA-586) question engine — no network, no browser.
// Rules: marketing-site/docs/TECHNICAL_REVIEW_FLOW.md

const base = (overrides: Answers = {}): Answers => ({
  stage: 'building',
  scope_industry: 'saas',
  scope_users: ['small_business'],
  scope_scale: '100_10k',
  scope_region: ['other'],
  t2_features: ['none'],
  t2_ai_tools: ['none'],
  t3_code_control: 'in_house',
  t3_accounts_owned: 'yes',
  t3_takeover: 'yes',
  ...overrides,
});

const planFor = (answers: Answers, ai?: Parameters<typeof contextFromAnswers>[1]) =>
  buildPlan(contextFromAnswers(answers, ai));

const ids = (plan: Plan) => planQuestionIds(plan);
const moduleIds = (plan: Plan) => plan.sections.flatMap((s) => s.questions.filter((q) => q.module)).map((q) => q.id);

// Every planned question answered with `value`, plus the given overrides.
const answerAll = (answers: Answers, plan: Plan, value = 'yes', overrides: Answers = {}): Answers => {
  const out: Answers = { ...answers };
  for (const id of ids(plan)) out[id] = id === 'soc2' ? 'have_one' : value;
  return { ...out, ...overrides };
};

test.describe('question plan', () => {
  test('the same answers always produce the same questions', () => {
    const answers = base({ stage: 'mvp', scope_industry: 'healthcare', scope_region: ['us', 'eu_uk'], t2_features: ['payments'] });
    expect(planFor(answers)).toEqual(planFor(structuredClone(answers)));
  });

  test('feature-conditional checks only appear when the feature was picked', () => {
    const plain = ids(planFor(base()));
    for (const id of ['tenant_isolation', 'idempotency', 'upload_security', 'pci_scope', 'ai_prompt_injection']) {
      expect(plain).not.toContain(id);
    }
    const rich = ids(planFor(base({ t2_features: ['payments', 'uploads', 'multi_tenant', 'ai_features'] })));
    for (const id of ['tenant_isolation', 'idempotency', 'upload_security', 'pci_scope', 'ai_prompt_injection', 'ai_token_quota']) {
      expect(rich).toContain(id);
    }
  });

  test('each stage asks its own checks, with stage wording', () => {
    const building = planFor(base());
    const scaling = planFor(base({ stage: 'scaling' }));
    expect(ids(building)).toContain('backups');
    expect(ids(building)).not.toContain('pentest');
    expect(ids(scaling)).toContain('pentest');
    expect(ids(scaling)).not.toContain('auth_provider');
    const staging = building.sections.flatMap((s) => s.questions).find((q) => q.id === 'staging');
    expect(staging?.text).toContain('the one users will use');
  });

  test('internal team only hides consumer questions; under 100 hides scale ones too', () => {
    const internal = base({ stage: 'mvp', scope_users: ['internal'], scope_scale: 'under_100' });
    const plan = planFor(internal);
    expect(ids(plan)).not.toContain('consent');
    expect(ids(plan)).not.toContain('product_analytics');
    expect(plan.hidden).toEqual(expect.arrayContaining(['consent', 'product_analytics']));

    // Assumption #6: also Scaling's core load testing / auto-scaling.
    const scaling = planFor({ ...internal, stage: 'scaling' });
    expect(ids(scaling)).not.toContain('load_testing');
    expect(ids(scaling)).not.toContain('autoscaling');
  });

  test('data residency is hidden without EU / UK users unless enterprise or government', () => {
    expect(ids(planFor(base({ stage: 'scaling' })))).not.toContain('data_residency');
    expect(ids(planFor(base({ stage: 'scaling', scope_region: ['eu_uk'] })))).toContain('data_residency');
    expect(ids(planFor(base({ stage: 'scaling', scope_users: ['enterprise'] })))).toContain('data_residency');
  });

  test('a module question already asked by the stage is asked once and not counted', () => {
    const plan = planFor(base({ stage: 'scaling', scope_scale: '100k_plus' }));
    expect(ids(plan).filter((id) => id === 'load_testing')).toHaveLength(1);
    expect(moduleIds(plan)).toEqual(['cdn']); // the only scale question Scaling doesn't already ask
  });

  test('large user base pulls scale questions forward into Building and MVP', () => {
    const plan = planFor(base({ stage: 'mvp', scope_scale: '100k_plus' }));
    expect(moduleIds(plan)).toEqual(
      expect.arrayContaining(['load_testing', 'autoscaling', 'db_performance', 'cdn', 'background_jobs', 'no_spof', 'incident_runbook']),
    );
  });

  test(`module questions are capped at ${CONFIG.moduleQuestionCap}, highest risk first, the rest overflow`, () => {
    const plan = planFor(base({
      stage: 'mvp',
      scope_industry: 'healthcare',
      scope_users: ['public', 'enterprise'],
      scope_region: ['us', 'eu_uk', 'canada'],
      scope_scale: '100k_plus',
      scope_children: 'yes',
    }));
    const added = moduleIds(plan);
    expect(added).toHaveLength(CONFIG.moduleQuestionCap);
    // Filled by priority: all of healthcare (5), children (2), then enterprise.
    // (Shown grouped by area, so the display order differs.)
    expect([...added].sort()).toEqual(
      ['hc_hipaa_scope', 'hc_baa', 'hc_phi_min', 'hc_audit_log', 'hc_gdpr_art9', 'edu_parental_consent', 'edu_age_check', 'ent_sso'].sort(),
    );
    const cut = new Set(plan.overflow.map((o) => o.module));
    expect([...cut]).toEqual(['enterprise', 'region', 'public', 'scale']);
    expect(plan.complianceAsked).toBe(true);
  });

  test('module questions sit in the area they belong to', () => {
    const mvp = planFor(base({ stage: 'mvp', scope_industry: 'healthcare' }));
    expect(mvp.sections.find((s) => s.area === 'privacy')?.questions.map((q) => q.id)).toContain('hc_hipaa_scope');
    const building = planFor(base({ scope_industry: 'healthcare' }));
    expect(building.sections.find((s) => s.area === 'launch')?.questions.map((q) => q.id)).toContain('hc_hipaa_scope');
  });

  test('AI can add a detectable module and the plan says why; it cannot add others', () => {
    const plan = planFor(base({ scope_industry: 'other' }), [
      { id: 'healthcare', reason: 'The description mentions patient records' },
      { id: 'scale', reason: 'not detectable' },
    ]);
    expect(plan.modules).toContainEqual({ id: 'healthcare', label: 'Healthcare / wellness', source: 'ai', reason: 'The description mentions patient records' });
    expect(plan.modules.map((m) => m.id)).not.toContain('scale');
    expect(ids(plan)).toContain('hc_hipaa_scope');
  });

  test('children questions follow who uses it', () => {
    const children = SCOPE.find((q) => q.id === 'scope_children')!;
    expect(isShown(children, { scope_users: ['small_business', 'internal'] })).toBe(false);
    expect(isShown(children, { scope_users: ['public'] })).toBe(true);

    expect(ids(planFor(base({ scope_users: ['public'], scope_children: 'not_sure' })))).toContain('edu_parental_consent');
    expect(ids(planFor(base({ scope_users: ['public'], scope_children: 'no' })))).not.toContain('edu_parental_consent');
  });

  test('an idea stage is not a technical plan', () => {
    expect(() => contextFromAnswers({ stage: 'idea' })).toThrow();
  });
});

test.describe('scoring, flags and offer', () => {
  test('all good answers: full score, no flags, consult first in Building', () => {
    const answers = base();
    const plan = planFor(answers);
    const result = scoreRun(contextFromAnswers(answers), plan, answerAll(answers, plan));
    expect(result.overall).toBe(100);
    expect(result.flags).toEqual([]);
    expect(result.areas.every((a) => a.status === 'good')).toBe(true);
    expect(result.offer).toEqual({ primary: 'free_consult', secondary: ['prelaunch_repo_review'] });
  });

  test('Yes 2 · Unsure 1 · No 0, and 2+ Unsure in an area make a blind spot', () => {
    const answers = base();
    const plan = planFor(answers);
    const result = scoreRun(
      contextFromAnswers(answers),
      plan,
      answerAll(answers, plan, 'yes', { data_model: 'unsure', backups: 'yes', staging: 'unsure', cross_browser: 'unsure' }),
    );
    expect(result.areas.find((a) => a.area === 'data')?.score).toBe(50);
    expect(result.areas.find((a) => a.area === 'launch')?.status).toBe('blind_spot');
    expect(result.blindSpots).toEqual(['launch']);
  });

  test('hidden and "not yet asked" answers are excluded, not scored as zero', () => {
    const answers = base({ stage: 'scaling', scope_users: ['enterprise'] });
    const plan = planFor(answers);
    const ctx = contextFromAnswers(answers);
    const full = scoreRun(ctx, plan, answerAll(answers, plan));
    const notAsked = scoreRun(ctx, plan, answerAll(answers, plan, 'yes', { soc2: 'not_asked', consent: 'no' }));
    expect(notAsked.overall).toBe(full.overall);
  });

  test('critical flags override and route Building to the pre-launch repo review', () => {
    const answers = base({ t2_ai_tools: ['lovable'], t2_features: ['payments'], t3_code_control: 'ai_platform_only' });
    const plan = planFor(answers);
    const result = scoreRun(
      contextFromAnswers(answers),
      plan,
      answerAll(answers, plan, 'yes', { access_control: 'unsure', secrets_audit: 'no', backups: 'no', idempotency: 'unsure' }),
    );
    expect(result.flags.map((f) => f.id)).toEqual(['data_isolation', 'exposed_secrets', 'backups', 'ownership', 'double_charge']);
    expect(result.offer.primary).toBe('prelaunch_repo_review');
  });

  test('MVP: no two-step login is a flag, and 2+ blind spots also mean a review', () => {
    const answers = base({ stage: 'mvp' });
    const plan = planFor(answers);
    const ctx = contextFromAnswers(answers);
    expect(scoreRun(ctx, plan, answerAll(answers, plan, 'yes', { mfa_infra: 'no' })).flags.map((f) => f.id)).toEqual(['no_mfa']);

    const blind = scoreRun(ctx, plan, answerAll(answers, plan, 'yes', {
      uptime: 'unsure', rollback: 'unsure', code_review: 'unsure', e2e_tests: 'unsure',
    }));
    expect(blind.flags).toEqual([]);
    expect(blind.blindSpots).toEqual(['reliability', 'quality']);
    expect(blind.offer.primary).toBe('repo_review');
  });

  test('Scaling: high score is congratulated; a middling one gets a consult (assumption #12)', () => {
    const answers = base({ stage: 'scaling' });
    const plan = planFor(answers);
    const ctx = contextFromAnswers(answers);
    expect(scoreRun(ctx, plan, answerAll(answers, plan)).offer.primary).toBe('next_stage_consult');

    const middling = answerAll(answers, plan, 'yes', {
      pentest: 'no', audit_trail: 'no', least_privilege: 'no', incident_runbook: 'no', retries: 'no',
      load_testing: 'no', autoscaling: 'no', feature_flags: 'no', vendor_sbom: 'no', log_retention: 'no',
    });
    const result = scoreRun(ctx, plan, middling);
    expect(result.flags).toEqual([]);
    expect(result.overall).toBeLessThan(CONFIG.scalingHighScore);
    expect(result.offer.primary).toBe('free_consult');
  });

  test('payments or personal data make security, backups and privacy count more', () => {
    const answers = base({ t2_features: ['personal_data'] });
    const plan = planFor(answers);
    const ctx = contextFromAnswers(answers);
    const plain = scoreRun(contextFromAnswers(base()), planFor(base()), answerAll(base(), planFor(base()), 'yes', { access_control: 'no' }));
    const weighted = scoreRun(ctx, plan, answerAll(answers, plan, 'yes', { access_control: 'no' }));
    expect(weighted.overall).toBeLessThan(plain.overall);
  });
});

test.describe('idea branch', () => {
  const all = IDEA_QUESTIONS.flatMap((g) => g.questions);
  const q = (id: string) => all.find((x) => x.id === id)!;

  test('follow-ups only show for the answers that call for them', () => {
    expect(isShown(q('i1_needs'), { i1_talked: 'not_yet' })).toBe(false);
    expect(isShown(q('i1_needs'), { i1_talked: 'a_few' })).toBe(true);
    expect(isShown(q('i2_missing'), { i2_looked: 'partly_fit' })).toBe(true);
    expect(isShown(q('i5_other'), { i5_blockers: ['time', 'other'] })).toBe(true);
  });

  test('the adoption plan question switches wording for internal tools', () => {
    expect(questionText(q('i3_plan'), { i3_who: 'external' })).toContain('go-to-market');
    expect(questionText(q('i3_plan'), { i3_who: 'both' })).toContain('go-to-market');
    expect(questionText(q('i3_plan'), { i3_who: 'internal' })).toContain('rollout');
  });
});
