# CheetCode v2: Head of Agents Take-Home Challenge

## Context

CheetCode v1 was a useful recruiting funnel, but it over-indexed on speed and was still gameable in ways that reduced signal quality.

Your task is to build a stronger CheetCode v2 that better identifies candidates who can design, orchestrate, and ship agent systems.

You are free to reuse, modify, or replace any part of this codebase.

## Goal

Build a better CheetCode that:

1. Is harder for agents to game
2. Better measures real agent-orchestration ability
3. Works end-to-end as a deployed product

## What to submit

Submit all three items:

1. **Fork URL**: link to your public fork of this repository
2. **Deployed URL**: link to a live, working deployment
3. **Writeup**: add `APPROACH.md` in your fork with:
   - what you changed
   - what you kept
   - why you made those choices
   - tradeoffs and known limitations

## Timeline

- Deadline: **within 72 hours (1-3 days) of receiving this challenge**

## Scope and freedom

- Full freedom. You can redesign architecture, scoring, challenge format, and anti-gaming approach.
- Keep the spirit of CheetCode (agent-focused coding challenge), but improve selection signal.
- You can add any open-source tools/services needed, as long as setup is documented.

## Evaluation (high-level)

Submissions are evaluated via both:

1. **Code review** of your fork
2. **Live testing** against your deployed version

We will look for:

- A deep understanding of what it takes to effectively orchestrate and run agents -- and the creativity to figure out how to test that for that in others.
- Quality of anti-gaming design
- Quality of signal for identifying strong agent orchestrators
- Product and UX clarity
- Technical quality, reliability, and observability
- Practicality of your design, technical architecture and tradeoff decisions

## What happens to the winner

This is not just brownie points in the interview process.

The winning solution will be adopted and re-posted as **CheetCode v2 next week**.
The creator will be publicly credited and attributed when we publish it.

## Secrets and infrastructure

You must use your own infrastructure and credentials in your fork/deployment.

- Do not rely on the original repository owner's secrets, Vercel project, or Convex deployment.
- Configure your own environment variables (Convex URL/secret, auth secrets, and any API keys you choose to use).
- Do not commit secrets to source control.
- If you use LLM providers, use your own keys and document setup in your fork.

If you have a strong idea that requires more tokens or infrastructure spend than you can personally afford, reach out with a short justification. Support (credits, infra access, or reimbursed spend) may be provided at Caleb's discretion.

## Constraints

- Keep your solution legal and safe to run.
- Do not include private credentials in code or docs.
- Make setup and execution clear enough that another engineer can run it.

## Suggested structure for `APPROACH.md`

You can use this format:

1. Problem framing
2. Design goals
3. Architecture and data flow
4. Anti-gaming strategy
5. Scoring and evaluation strategy
6. What changed vs v1
7. Tradeoffs and future work

## How to run baseline locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.
