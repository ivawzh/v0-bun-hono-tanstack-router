# JavaScript & TypeScript Rules

## Core

- Write typed, functional code without mutations or side effects when possible
- Prefer functions over classes; but avoid complex FP patterns like monads
- Create self-explanatory code with descriptive variable names (isLoading, hasError)
- Follow YAGNI (You Aren't Gonna Need It) to prevent speculatives
- Proactively address potential UX issues

## Functional Style

- Prefer `map`/`reduce` over loops
- Use ternary expressions over if/else when appropriate
- Use ts-pattern `match` over variable mutation
- Favor composition over duplication
- Avoid mutations and for loops

## Code Organization

- **Code Style**: Follow existing patterns in the codebase. Otherwise, as declarative as possible.
- **Documentation**: Update relevant documentation when making significant changes.
- **Security**: Never commit sensitive data or credentials
- **Files**: ~300 lines maximum
- **Action**: Proactively suggest refactoring when approaching these limits
- **Prefer native solutions** over third-party libraries when possible. Only suggest external dependencies if they provide significant value
- Place exported (public) functions and constants at the top of files
- Structure exported functions to orchestrate small, private helper functions:
  - Each private function handles one clear step
  - Exported functions represent the high-level flow
- Prefer named exports over default exports
- Import from source files directly (avoid index re-exports) for better tree-shakability
- Write comments only to explain logic, assumptions, edge cases, and trade-offs; never include progress/meta notes (e.g., "updated this", "now changed", "this is new code").

## Naming & Style

- Indent with 2 spaces
- Use single quotes
- Omit line-ending semicolons in JavaScript/TypeScript
- Declare functions with `function name()` instead of `const name = () =>`
- Add jsdoc header comments to big exported functions to explain what, how and why.

## TypeScript Specifics

- Use interfaces over types
- Use string unions instead of enums
- Type annotations: prefer `Array<T>` over `T[]`

## Avoiding Indirections

- "Rule of Three" - only abstract after seeing at least three concrete implementations
- Consolidate related functionality into cohesive modules
- Use composition over inheritance
- Eliminate abstractions that don't provide clear benefits
- Ensure newcomers can understand the system without learning numerous abstraction concepts
