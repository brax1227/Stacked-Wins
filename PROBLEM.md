# The Problem We're Solving

> "I be having a lot to do but when I think about it junk just get overwhelming
> so I don't do much of anything. I just need to physically see what I need to
> do instead of thinking about it."

That's it. That's the whole problem. Everything in this product exists to
serve that sentence.

---

## What's actually happening

Break the sentence into its three moves:

**1. "I be having a lot to do"** — The load is real. This isn't a motivation
problem or a discipline problem. There genuinely is a lot.

**2. "when I think about it junk just get overwhelming"** — The load is being
held in working memory. Nothing is written down, so the only way to check
what's left is to re-imagine the entire pile at once. And the pile has no
edges when it lives in your head: you can't count it, you can't see the end
of it, and every time you look at it, it costs the same as looking at all of
it. That's the overwhelm. The overwhelm is not caused by the work — it's
caused by *holding* the work.

**3. "so I don't do much of anything"** — Freeze. Not laziness. When looking
at the list costs as much as doing a task, the cheapest move your brain has
is to stop looking. So nothing gets picked, so nothing gets done, so the pile
grows, so the next look costs more.

**4. "I just need to physically see what I need to do instead of thinking
about it"** — The user has already diagnosed it and prescribed the fix. Get
it out of the head and onto a surface. Stop making them *think* to know.

---

## The two jobs

The problem splits cleanly into two jobs, and both have to be done or neither
works:

### Job 1 — Get it out of the head
Everything you're carrying goes onto a surface outside your skull, as fast as
you can type it, with zero structure required. No categories, no due dates,
no priorities, no estimating. Structure is a tax charged at the exact moment
the user has the least to give. The only thing that matters here is speed and
completeness: if it's in your head, it goes in the box.

The relief is not organizational. The relief is that you're allowed to stop
holding it.

### Job 2 — Only ever show one thing
Here's the trap: a full list, shown all at once, recreates the exact overwhelm
we just removed. Seeing 34 things is the visual version of thinking about 34
things.

So the app holds all of it and shows exactly one. One card, on screen, big.
That's the entire home screen. No list, no count of what's behind it, no
badges, no other columns. The user never has to choose what to work on,
because choosing is thinking, and thinking is the thing that breaks them.

The full list still exists and is always one tap away — it's their data and
hiding it would be a lie. But it is never the default view, and you never
land on it.

---

## What "physically see" means in practice

- The thing you need to do is **on the screen, at rest, without you asking**.
- It is **large** — it should read from arm's length, like a sticky note on a
  door, not a row in a table.
- Looking at it requires **no decision**. It is not "here are your options."
  It is "here's the one."
- There are **at most four things you can do to it**, and every one of them
  is a single tap that ends with the next card appearing.

---

## The four moves on a card

Every card can only ever be resolved four ways. This is deliberate — more
options means deciding, and deciding is the failure mode.

| Move | What it means | What happens |
|---|---|---|
| **Done** | Finished it | Card clears. It becomes a win. Next card appears. |
| **Not now** | Can't do this one this second | Card goes to the back of the stack. Next card appears. |
| **Not today** | Real, but not today | Card sleeps until tomorrow. Next card appears. |
| **Too big** | This is why I froze | Card splits into smaller pieces you type, and the first piece becomes the next card. |

"Too big" is the most important one. A card that keeps getting pushed isn't
being avoided out of laziness — it's usually a card that's secretly five
tasks wearing a trench coat. The app should notice repeated pushes and offer
to break it down before the user has to ask.

---

## What this is not

- **Not a to-do app.** To-do apps optimize for capture and organization. Their
  home screen is a list. The list is our failure state.
- **Not a project manager.** No dependencies, no assignees, no gantt anything.
- **Not a productivity system.** No methodology to learn. Nothing to maintain.
  If using it requires upkeep, it becomes another thing on the pile.
- **Not gamified.** No streaks-as-pressure, no punishment for a bad day. The
  user is already carrying enough.

---

## How this changes Stacked Wins

The name still fits — arguably it fits better now.

**Before:** an identity/wellness growth OS. Deep onboarding assessment → AI
generates a growth plan → daily micro-wins reinforce identity over 30 days.

**After:** you dump your stack, the app hands you the top card, you clear it,
that's a win. Wins stack. Same brand, same "small wins build strong
foundations" thesis — but the entry point is the pile that's already crushing
you, not a 6–10 minute assessment about your values.

The old direction asked "who do you want to become?" before it gave you
anything. Someone frozen under a pile can't answer that, and shouldn't have
to. **Answer the pile first. Identity is a thing you earn on the way out.**

The growth-plan layer isn't deleted — it becomes Layer 2, something offered
to a user who is already unfrozen and asking "okay, but where is this all
going?" It is no longer the front door.

---

## How we know it worked

Not DAU. Not session length — a *long* session on this app is a bug.

1. **Time from opening the app to knowing what to do next.** Target: under two
   seconds, because the card is already there. This is the whole product.
2. **Cards cleared per session.** Did the freeze break?
3. **Return after a bad day.** Someone who dropped off for three days and
   comes back and clears one card is the success case, not the failure case.
4. **Dump size on second and third use.** If people keep coming back to empty
   their head into it, the surface is trusted.

---

## The one-line version

**Stop making him think about it. Show him one thing.**
