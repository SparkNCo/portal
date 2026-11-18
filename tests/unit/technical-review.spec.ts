import { test, expect } from '@playwright/test';
import {
  CONFIG,
  IDEA_QUESTIONS,
  agentsMd,
  SCOPE,
  buildPlan,
  contextFromAnswers,
  findingsFor,
  ideaInvite,
  ideaPlayback,
  isShown,
  planQuestionIds,
  questionText,
  ruleBasedIdeaGaps,
  sanitizeAnswers,
  scoreCompleted,
  scoreRun,
  technicalInvite,
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

  test('compliance questions (e.g. HIPAA) sit in the privacy area in every stage', () => {
    // /assessment shows the privacy area inside its Data privacy module.
    for (const stage of ['building', 'mvp', 'scaling']) {
      const plan = planFor(base({ stage, scope_industry: 'healthcare', scope_region: ['us'] }));
      const privacy = plan.sections.find((s) => s.area === 'privacy')?.questions.map((q) => q.id) ?? [];
      expect(privacy).toContain('hc_hipaa_scope');
      expect(privacy).toContain('hc_baa');
      for (const s of plan.sections.filter((x) => x.area !== 'privacy')) {
        expect(s.questions.map((q) => q.id)).not.toContain('hc_hipaa_scope');
      }
    }
  });

  test('without compliance questions, Building and Scaling get no privacy area', () => {
    for (const stage of ['building', 'scaling']) {
      expect(planFor(base({ stage })).sections.some((s) => s.area === 'privacy')).toBe(false);
    }
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

test.describe('answers from the browser', () => {
  test('only catalog questions and listed options are kept', () => {
    const clean = sanitizeAnswers({
      stage: 'mvp',
      scope_users: ['public', 'hacker', 42, 'public'],
      access_control: 'maybe',
      secrets_audit: 'yes',
      soc2: 'have_one',
      about_product: 'x'.repeat(5000),
      __proto__: 'nope',
      unknown_field: 'drop me',
      intro_email: 'not here',
    });
    expect(clean).toEqual({
      stage: 'mvp',
      scope_users: ['public'],
      secrets_audit: 'yes',
      soc2: 'have_one',
      about_product: 'x'.repeat(2000),
    });
  });

  test('anything that is not an object gives no answers', () => {
    expect(sanitizeAnswers(null)).toEqual({});
    expect(sanitizeAnswers(['stage'])).toEqual({});
    expect(sanitizeAnswers('stage=mvp')).toEqual({});
  });
});

test.describe('findings and invite', () => {
  test('risk-library entries come first, then the plain gaps', () => {
    const answers = base({ t2_ai_tools: ['lovable'], t2_stack: ['supabase'] });
    const plan = planFor(answers);
    const all = answerAll(answers, plan, 'yes', { access_control: 'unsure', staging: 'no', backups: 'unsure' });
    const findings = findingsFor(contextFromAnswers(all), plan, all);
    expect(findings.map((f) => f.id)).toEqual(['ai_builder_supabase_rls', 'gap_staging', 'gap_access_control', 'gap_backups']);
    expect(findings.every((f) => f.fixPrompt.length > 20)).toBe(true);
    expect(findings.find((f) => f.id === 'gap_backups')?.diy).toBe(false);
  });

  test('at most 5 findings', () => {
    const answers = base({ stage: 'scaling' });
    const plan = planFor(answers);
    const all = answerAll(answers, plan, 'no');
    expect(findingsFor(contextFromAnswers(all), plan, all)).toHaveLength(5);
  });

  test('the invite names the blind spots, or the critical issues', () => {
    const answers = base({ stage: 'mvp' });
    const plan = planFor(answers);
    const ctx = contextFromAnswers(answers);
    const blind = scoreRun(ctx, plan, answerAll(answers, plan, 'yes', {
      uptime: 'unsure', rollback: 'unsure', code_review: 'unsure', e2e_tests: 'unsure',
    }));
    expect(technicalInvite(blind)).toBe(
      "You weren't sure about reliability & recovery and releasing & quality — that's exactly what a 30-minute repo review covers.",
    );
    const flagged = scoreRun(ctx, plan, answerAll(answers, plan, 'yes', { mfa_infra: 'no' }));
    expect(technicalInvite(flagged)).toContain('1 critical issue to look at');
  });
});

test.describe('idea results without AI', () => {
  const idea: Answers = {
    stage: 'idea',
    about_audience: 'independent physiotherapists',
    scope_industry: 'healthcare',
    i1_talked: 'not_yet',
    i2_looked: 'partly_fit',
    i2_missing: 'no SMS reminders',
    i3_who: 'external',
    i3_plan: 'yes',
    i5_blockers: ['time', 'how_to_build'],
    i6_must: 'booking\nreminders\npayments',
    i7_build: ['ai_tools'],
  };

  test('always 3 gaps, referring to their own answers', () => {
    const gaps = ruleBasedIdeaGaps(idea);
    expect(gaps).toHaveLength(3);
    expect(gaps[0]?.explanation).toContain('independent physiotherapists');
    expect(gaps[1]?.explanation).toContain('no SMS reminders');
    expect(ruleBasedIdeaGaps({ stage: 'idea' })).toHaveLength(3);
  });

  test('a must-have list longer than 7 is flagged', () => {
    const many = { ...idea, i1_talked: 'yes_10', i2_looked: 'none_fit', i6_must: 'a, b, c, d, e, f, g, h, i' };
    expect(ruleBasedIdeaGaps(many).map((g) => g.title)).toContain('Must-have list too long for a first version');
  });

  test('playback uses option labels and skips hidden follow-ups', () => {
    const playback = ideaPlayback({ ...idea, i1_needs: 'should not show' });
    expect(playback).toContainEqual({ label: 'Have you talked to your target users about this problem?', value: 'Not yet' });
    expect(playback.map((p) => p.label)).not.toContain('What did they say they needed most?');
  });

  test('the invite names their blockers', () => {
    expect(ideaInvite(idea)).toBe(
      'You said time and not sure how to build it have held you back so far. A free 30-minute consult is a quick way to get past that.',
    );
  });
});

test.describe('questionnaire for the site', () => {
  test('fixed pages carry every shared question, with Idea-only required text', async () => {
    const { questionnaire } = await import('../../supabase/functions/technical-review/engine');
    const q = questionnaire();
    const ids = (qs: { id: string }[]) => qs.map((x) => x.id);
    expect(ids(q.intro.questions)).toEqual(['intro_email', 'intro_name', 'intro_company', 'intro_role']);
    expect(ids(q.intake.flatMap((p) => p.questions))).toEqual([
      't1_team', 't2_ai_tools', 't2_hosting', 't2_stack', 't2_features', 't3_code_control', 't3_accounts_owned', 't3_takeover',
    ]);
    expect(q.about.questions.idea.every((x) => x.required)).toBe(true);
    expect(q.about.questions.technical.some((x) => x.required)).toBe(false);
    expect(q.idea).toHaveLength(7);
  });
});

test.describe('idea product card', () => {
  test('scope as tags, answers as rows marked good / worth a look', async () => {
    const { ideaProfile } = await import('../../supabase/functions/technical-review/engine');
    const profile = ideaProfile({
      about_product: 'Physio booking with SMS reminders',
      about_audience: 'independent physiotherapists',
      scope_industry: 'healthcare',
      scope_users: ['public'],
      scope_scale: '100_10k',
      scope_region: ['us'],
      i1_talked: 'not_yet',
      i1_needs: 'hidden because not_yet',
      i2_looked: 'none_fit',
      i3_who: 'internal',
      i3_plan: 'yes',
      i4_depends: 'yes',
      i4_names: 'Google Calendar',
      i5_blockers: ['how_to_build'],
      i6_must: 'a\nb\nc',
      i7_build: ['ai_tools'],
    });
    expect(profile.tags).toEqual(['Healthcare / wellness', 'The public (consumers)', '100–10,000 users', 'US']);
    const tone = Object.fromEntries(profile.rows.map((r) => [r.id, r.tone]));
    expect(tone).toMatchObject({ i1_talked: 'warn', i2_looked: 'good', i3_plan: 'good', i6_must: 'good', i7_build: 'warn' });
    expect(profile.rows.map((r) => r.id)).not.toContain('i1_needs');
    expect(profile.rows.find((r) => r.id === 'i3_plan')?.label).toBe('Rollout plan');
    expect(profile.rows.find((r) => r.id === 'i4_depends')?.value).toBe('Yes — Google Calendar');
  });
});

test.describe('assessment checklist (/assessment)', () => {
  test('the running score only counts finished sections', () => {
    const answers = base({ stage: 'mvp' });
    const plan = planFor(answers);
    const first = plan.sections[0]!;
    const second = plan.sections[1]!;
    // First section all Yes, second all No (not finished yet).
    const all: Answers = { ...answers };
    for (const q of first.questions) all[q.id] = 'yes';
    for (const q of second.questions) all[q.id] = 'no';
    const ctx = contextFromAnswers(all);

    const qids = (s: { questions: { id: string }[] }) => s.questions.map((q) => q.id);
    const governance = ['t1_team', 't3_code_control', 't3_accounts_owned', 't3_takeover'];

    const afterFirst = scoreCompleted(ctx, plan, all, qids(first));
    expect(afterFirst.overall).toBe(100);
    expect(afterFirst.areas.map((a) => a.area)).toEqual([first.area]);

    const afterGovernance = scoreCompleted(ctx, plan, all, [...qids(first), ...governance]);
    expect(afterGovernance.areas.map((a) => a.area).sort()).toEqual(['ownership', first.area].sort());

    const afterAll = scoreCompleted(ctx, plan, all, [...qids(first), ...qids(second), ...governance]);
    expect(afterAll.overall).toBeLessThan(100);
    expect(afterAll.overall).toBe(scoreRun(ctx, plan, all).overall);
  });

  test('"Who controls your code?" is asked but not scored', () => {
    const answers = base({ stage: 'mvp' });
    const plan = planFor(answers);
    const ctx = contextFromAnswers(answers);
    const good = answerAll(answers, plan, 'yes', { t3_code_control: 'in_house' });
    const bad = answerAll(answers, plan, 'yes', { t3_code_control: 'ai_platform_only' });
    expect(scoreRun(ctx, plan, bad).overall).toBe(scoreRun(ctx, plan, good).overall);
    // Still a critical flag: it's a real ownership risk.
    expect(scoreRun(ctx, plan, bad).flags.map((f) => f.id)).toContain('ownership');
  });

  test('checklist modules hold the old intake questions', async () => {
    const { questionnaire } = await import('../../supabase/functions/technical-review/engine');
    const { checklist } = questionnaire();
    const ids = (qs: { id: string }[]) => qs.map((x) => x.id);
    expect(ids(checklist.intro.questions)).toEqual(['intro_email', 'intro_name', 'intro_company', 'intro_role', 'stage']);
    expect(ids(checklist.productScope.questions.technical)).toEqual([
      'about_company', 'about_product', 'about_audience', 'scope_industry', 'scope_users', 'scope_scale',
      't2_ai_tools', 't2_hosting', 't2_stack', 't2_features',
    ]);
    expect(ids(checklist.productScope.questions.idea)).toEqual([
      'about_company', 'about_product', 'about_audience', 'scope_industry', 'scope_users', 'scope_scale',
    ]);
    expect(ids(checklist.governance.questions)).toEqual(['t1_team', 't3_code_control', 't3_accounts_owned', 't3_takeover']);
    expect(ids(checklist.dataPrivacy.questions)).toEqual(['scope_region', 'scope_children']);
  });

  test('AGENTS.md carries the context, the rules for its features and the gaps', () => {
    const answers = base({
      stage: 'mvp',
      about_product: 'Clinics manage bookings.',
      t2_features: ['payments'],
      t2_stack: ['react_next', 'supabase'],
    });
    const plan = planFor(answers);
    const all = answerAll(answers, plan, 'yes', { secrets_audit: 'no', backup_restore: 'unsure' });
    const ctx = contextFromAnswers(all);
    const md = agentsMd({ answers: all, ctx, plan });

    expect(md.startsWith('# AGENTS.md')).toBe(true);
    expect(md).toContain('**Product:** Clinics manage bookings.');
    expect(md).toContain('React / Next.js, Supabase');
    expect(md).toMatch(/idempotent/);
    expect(md).toContain('## Known gaps');
    expect(md).toContain('## Not verified yet');
    expect(md).toBe(agentsMd({ answers: structuredClone(all), ctx, plan }));
  });

  test('Idea AGENTS.md lists the open questions instead of gaps', () => {
    const answers: Answers = { stage: 'idea', about_product: 'A booking app', scope_industry: 'healthcare' };
    const md = agentsMd({ answers, ideaGaps: ruleBasedIdeaGaps(answers) });
    expect(md).toContain('## Before you build');
    expect(md).not.toContain('## Known gaps');
    expect(md).toMatch(/BAA/);
  });
});
