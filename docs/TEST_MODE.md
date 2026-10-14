# Test Mode

> Run supported portal flows end to end without their side effects: no real emails, no rows written.
> Code: `supabase/functions/lib/testMode.ts` · Tests: `tests/e2e/test-mode.spec.ts`

---

## What it does

In test mode a flow still runs for real: it validates the input, reads real data and runs every check (for example "is this email already taken?"). But at each point where it would **send an email** or **write something** (a table row, an Auth account, a call that triggers another function), it records that action instead of doing it.

The response returns the flow's normal result plus everything it held back:

```json
{
  "testMode": true,
  "result": { "id": "…", "email": "new@example.com", "role": "stakeholder" },
  "emails": [{ "to": "new@example.com", "subject": "You've been invited to the portal", "html": "…" }],
  "writes": [
    { "target": "auth.users", "op": "invite", "data": { "id": "…", "email": "new@example.com" } },
    { "target": "portal.users", "op": "upsert", "data": { "email": "new@example.com", "role": "stakeholder" } }
  ]
}
```

A test checks that this result is correct (who the email goes to, its subject and link, which rows would be written) and that nothing new appeared in the database.

---

## How to turn it on

Test mode needs two things.

**1. Secrets on the edge functions** (Supabase Dashboard → Edge Functions → Secrets, or the CLI):

```bash
npx supabase secrets set ALLOW_TEST_MODE=true TEST_MODE_TOKEN=<token>
```

Generate the token with `openssl rand -hex 32`. It must be at least 32 characters long.

**2. A header on the request:**

```
x-test-mode: <TEST_MODE_TOKEN>
```

Only the test suite sends this header. It calls the edge functions directly from Node and reads the token from `supabase/functions/.env`, which is git-ignored. The app never sends the header, so real users always get the normal flow.

### Running the tests

```bash
npx playwright test --project=test-mode
```

If `TEST_MODE_TOKEN` is missing from `supabase/functions/.env`, the tests are skipped.

---

## Safeguards

| Situation | Result |
|---|---|
| No `x-test-mode` header | The normal flow runs, exactly as before. Production is unchanged. |
| Header present, but `ALLOW_TEST_MODE` isn't `true` | **403**: nothing runs |
| Header present, but `TEST_MODE_TOKEN` is missing or shorter than 32 characters | **403**: nothing runs |
| Header present with the wrong token | **403**: nothing runs |
| Valid header on a request that test mode doesn't cover | **400** "Test mode isn't supported for this request": nothing runs |
| Valid header on a covered request | Runs in test mode |

- A request that carries the header is **never** run as a normal request. If test mode can't be honoured, the request is refused.
- The header isn't in the CORS allow-list, so a browser can't send it.
- The token is compared in constant time, so it can't be guessed by measuring response times.
- The test-mode state (`TestRun`) is passed explicitly as a parameter to each step that sends or writes, not kept in a global. A step that doesn't receive it behaves normally, which is why only the flows listed below are covered.

---

## Covered flows

| Flow | Request | What's held back |
|---|---|---|
| Create developer | `POST /functions/v1/users?type=developer` | Auth account (invite), `portal.users` row, `portal.developers` row, invite email |
| Create stakeholder | `POST /functions/v1/users?type=stakeholder` | Auth account (invite), `portal.users` row, invite email |

Any other request to `users` that carries the header gets a 400, including `type=customer`. Functions that don't use test mode yet ignore the header and run normally, so don't send it to them expecting protection.

### Not covered yet

These flows also send emails or write data and could be added with the same pattern:

- Create customer (`users?type=customer`): Auth account, `customers`, `users`, invite email, triggers `issueMetrics`
- Resend account email (`users?type=resend-account-email`)
- Reset password (`reset-password`)
- Project request (`project-requests`), developer request (`developer-requests`)
- Feature request → admin notification email (`features`)
- Stakeholder added → admin email (`stakeholder-notifications`)
- Payment link (`stripe`), lead welcome email (`update-lead`)

---

## What it does and doesn't guarantee

**Guarantees** (for the covered flows):
- No email is sent, through Resend or SMTP. The email is built in full and returned instead, including emails to `@example.com`.
- No Auth account or table row is created.
- The same validations as production run against real data.

**Doesn't guarantee:**
- **That the final step succeeds.** It doesn't check that Resend accepts the email or that Postgres accepts the row (constraints, triggers), because those steps are skipped. A failure that happens only there won't show up in test mode.
- **Real ids or links.** The user id is a random UUID and the invite link is `…/set-password#test-mode`.
- **That reads are free.** Reads do happen, against the real database. They don't change anything.

---

## Adding a flow

1. In the function's `index.ts`, add the request to its list of supported test-mode requests. The `users` function shows the pattern: it calls `resolveTestMode(req)`, refuses unsupported requests and answers with `testModeBody(testRun, result)`.
2. Pass `testRun` down to every step that sends or writes:
   - **Emails:** pass it to `sendEmail(args, testRun)`.
   - **Writes:** when `testRun` is set, skip the write and record it with `testRun.writes.push({ target, op, data })`.
3. Add tests to `tests/e2e/test-mode.spec.ts`: the expected result, the captured emails, no new rows, and that the flow still behaves the same without the header.
4. Add the flow to the **Covered flows** table above.
