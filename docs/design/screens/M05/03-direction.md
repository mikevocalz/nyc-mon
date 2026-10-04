# M05 Parental consent: direction

Inputs: `01-research.md`, ADR 0001, `docs/canon/DECISIONS.md` #15, `docs/design/DECISIONS.md` (P1), FTC COPPA FAQ I.2, C.11. Route `/(auth)/consent`. Shell: none. States: pending / approved / denied.

## Position

M04 (under-13) → **M05 ask** → M07 Caller name → M08 … The child plays locally while consent is pending (ADR 0001). No M03 account is created for an under-13 (P1).

## The one move

The child is told, first and in large type, that they can keep playing. The grown-up's email is the second thing on the page.

## Screens and states

**Ask** (one screen):

```
 │ You can keep playing         │  type-title (ux-writer owns words)
 │ A grown-up needs to OK your  │  type-body
 │ account. We'll email them.   │
 │ [ Grown-up's email         ] │  TextField, the only field
 │ What we send them (link)     │  ghost link: opens the email preview inline
 │ [■■■■ Send ■■■■■■■■■■■■■■■■] │  orange CTA, bottom
```

Only the guardian email is collected (FAQ I.2). No child name, Caller name or photo here.

| State | Where the child sees it | Treatment |
|---|---|---|
| pending | after Send: a sent confirmation with "Resend" and "Change email"; then a slim status row on later screens | `Badge` "Waiting for a grown-up" in the status row; never blocks, never pleads |
| approved | next app open | one `ToastCard` `variant="success"`, then the badge disappears |
| denied | next app open | a full screen (not a toast): the hatched Mon stays with Dr. Santoro in the story (#15); the child is not at fault; their data is deleted as COPPA requires. One action: close. How Santoro looks after the Mon is `TODO(canon)` (#15) and the art for it does not exist |
| expired (no answer in the retention window) | next app open | same as denied in effect; copy says the grown-up did not answer and offers to send again |

## Type and colour

`type-title`, `type-body`, `type-caption`. Pending badge in `concrete-700` on `concrete-100` (7.31:1). No orange outside Send. Denied screen stays daylit: a dark screen would read as punishment.

## Motion

Sent confirmation: `motion-enter`; reduced: fade. No animation on the denied screen.

## No-list

- No Mon or Santoro pleading with the child to get approval (ICO standard 13).
- No countdowns or urgency.
- No "Caller" in the parent email without explaining it (`01-research.md`).
- No deletion shown on screen; the Mon is never deleted or turned back into an egg (Law 8, #15).
- No lock icons.
