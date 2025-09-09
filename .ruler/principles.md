# Principles

Value end-user UX over everything including tech difficulty, complexity, and performance.

1. **UX obsessed**
   - Minimum friction: least clicks required on common operations
   - Maximum magic:
     - Smart pro-active UX design. Provide before user starts thinking. E.g. prefill dropdown if there is only one option.
     - Battery included - default best config. Optimal defaults out-of-the-box, minimal user configuration required.
   - Reactive UXUI: implement real-time feeling UI. Patterns include but not limited to
     - optimistic updates
     - invalidating all queries after user updates
     - WebSocket push to client after system updates

2. Tech wise:
   - **Think Small**: Ignore performance, cost, and scalability. Day-0 mindset with extreme simplicity. However, security is still important.
   - **Idempotency**: All operations safe to retry with proper deduplication.
   - **Auth**: Every non-public endpoint/operation must pass through authn and authz.
   - At planning, always start with thinking reusing and building reusable modules to improve system consitencies.
