# Pine Phase 6c: sandbox gate and runaway guards

The scheduler accepts only bots whose mode is literally `paper` or `testnet`.
A testnet bot runs synthetic paper fills unless its strategy has `allow_testnet=true`.
Live and unknown bot modes fail closed at loading, evaluation, and execution boundaries.
The final execution boundary re-reads bot eligibility before loading testnet credentials.
The existing webhook path retains its sandbox URL assertions and per-order safety limits.

The migration adds the three Phase 6c columns. Strategy storage still has `mode='paper'`.
Owners can edit the opt-in and a cap of 1–50 (default 5); the trip timestamp stays
server-owned. No hosted migration is applied by this implementation.

`claim_strategy_order` is service-role only and serializes reservations with a strategy
row lock. Each unique Pine attempt consumes one slot on its **UTC execution day**,
including orders whose exchange or persistence response fails. Duplicates do not consume
another slot. This deliberately bounds attempts rather than relying on a trade write
that might fail after an exchange accepted the order. Manual webhook claims do not
consume this budget unless their alert ID uses the reserved `pine:` namespace.
Reaching the cap trips the switch while allowing the final reserved attempt to complete.
The next reservation is refused, even from an overlapping tick with an older snapshot.

After a newly recorded losing close, the scheduler checks the latest three recorded
non-null close PnLs for the bot. Three negative closes trip the switch. A zero or winning
close breaks the streak. This uses the existing webhook path's stored PnL calculation;
it does not introduce exchange position reconciliation. A new losing close after an
owner reset can trip the guard again if the last three closes still show losses.

The dashboard exposes stopped status, the recorded reason, and an explicit clear action.
PATCH authenticates and verifies ownership before calling the service-only reset RPC
with the verified owner ID. Ordinary PUT saves and direct owner column writes cannot
clear the guard. Clearing re-enables, advances the cursor to now to avoid backlog replay,
and preserves all reservations. Clearing after exhausting today's cap therefore cannot
resume orders until the next UTC day. The scheduler never clears a trip automatically.

On `/strategy`, only a selected testnet bot shows sandbox controls. A successful preview
of the current source and a review acknowledgement are required before the sandbox box
can be checked; source, bot, or preview changes revoke the acknowledgement. The API
independently checks bot mode and acknowledgement. The merged schema typing from PR #28 is preserved and extended with Phase 6c's
columns and RPC types. Rule renderer work in open PR #29 remains separate.

Validation uses mocked exchange/order dependencies, PGlite migrations and role checks,
and local Supabase pgTAP. Phase 6d's manual exchange validation remains separate; no
exchange orders, including sandbox orders, are placed by these checks.
