---
name: feature-builder
description: Systematically implement complete application features across the existing codebase, including requirements analysis, architecture inspection, implementation, tests, validation, and documentation. Use when the user asks to add, build, implement, or extend a product feature.
---

# Feature Builder

Implement complete, production-quality features while respecting the existing architecture, conventions, and behaviour of the repository.

## Core principles

1. Understand before editing.
2. Reuse existing patterns before introducing new abstractions.
3. Make the smallest coherent change that fully satisfies the requirement.
4. Do not invent business rules, APIs, database fields, or user behaviour without evidence.
5. Do not silently change unrelated functionality.
6. Validate the implementation with tests, static analysis, and relevant build commands.
7. Never claim that a command passed unless it was actually executed successfully.

## Workflow

### 1. Understand the request

Extract:

- User goal
- Actors and permissions
- Main workflow
- Inputs and outputs
- Business rules
- Edge cases
- Acceptance criteria
- Explicit non-goals

When details are missing:

- Inspect the codebase for established behaviour.
- Prefer conventions already used in neighbouring features.
- Make conservative assumptions.
- Clearly record important assumptions before implementation.
- Ask a question only when proceeding would create substantial product, security, or data-model risk.

Create a concise internal checklist of acceptance criteria.

### 2. Inspect the codebase

Before modifying files, identify:

- Application entry points
- Relevant modules and directories
- Existing implementations of similar features
- Data models and database relationships
- API routes, controllers, serializers, schemas, or services
- Frontend pages, components, hooks, and state management
- Authentication and authorisation mechanisms
- Validation and error-handling conventions
- Test structure and test commands
- Formatting, linting, type-checking, and build commands
- Relevant repository rules and documentation

Search for analogous features and follow their patterns.

Do not create a parallel architecture when an existing architecture can support the feature.

### 3. Assess impact

Determine whether the feature requires changes to:

- Database schema
- Backend domain logic
- Public or internal APIs
- Permissions
- Frontend UI
- Shared types
- Background jobs
- Notifications
- Caching
- Search or filtering
- Analytics
- Configuration or environment variables
- Documentation
- Tests

Identify compatibility and migration risks.

### 4. Produce an implementation plan

Before editing, present a concise plan containing:

1. Files or modules likely to change
2. Data-flow changes
3. API or schema changes
4. UI changes
5. Permission and security considerations
6. Test strategy
7. Relevant assumptions

For a small feature, keep the plan brief.

For a broad or risky feature, divide the implementation into independently verifiable stages.

### 5. Implement backend changes

When backend work is required:

- Keep business logic out of controllers or views when the project uses a service/domain layer.
- Validate all external input.
- Enforce permissions server-side.
- Avoid trusting client-supplied ownership, role, price, status, or identity fields.
- Preserve backward compatibility unless explicitly told otherwise.
- Use transactions for multi-step writes that must succeed atomically.
- Prevent duplicate creation where retries are possible.
- Avoid N+1 queries and unbounded data loading.
- Return errors using the repository's existing format.
- Add database indexes only when justified by query patterns.
- Create migrations using the framework's normal tooling.
- Never edit an already-deployed migration unless the repository explicitly permits it.

### 6. Implement frontend changes

When frontend work is required:

- Reuse the existing design system and components.
- Keep API access in the project's established data-access layer.
- Use existing state-management patterns.
- Provide appropriate:
  - Loading state
  - Empty state
  - Error state
  - Success feedback
  - Disabled/submitting state
- Prevent duplicate submissions.
- Validate user input, while treating backend validation as authoritative.
- Maintain keyboard accessibility and semantic HTML.
- Preserve responsive behaviour.
- Avoid unrelated visual redesigns.
- Do not hard-code backend URLs, secrets, IDs, or environment-specific values.

### 7. Add tests

Add or update tests that cover:

- Main success path
- Validation failures
- Permission failures
- Important edge cases
- Regression risks
- Relevant API contracts
- Relevant frontend interactions

Prefer behavioural tests over tests that duplicate implementation details.

For bug-related features, first add a test that reproduces the defect when practical.

Do not weaken or delete valid existing tests merely to make the suite pass.

### 8. Validate

Run the repository's relevant commands, such as:

- Targeted tests
- Full test suite when practical
- Formatter
- Linter
- Type checker
- Build
- Migration validation
- Framework-specific system checks

Start with targeted checks, then run broader checks.

When a command fails:

1. Determine whether the failure was introduced by the feature.
2. Fix feature-related failures.
3. Report unrelated pre-existing failures separately.
4. Include the exact failed command and a concise explanation.

Review the final diff for:

- Accidental unrelated changes
- Debug code
- Temporary files
- Commented-out code
- Secrets
- Missing error handling
- Missing permission checks
- Inconsistent names
- Breaking API changes
- Missing tests

### 9. Report completion

Finish with this structure:

## Implemented

- What was added
- Main technical decisions

## Changed files

- `path/to/file`: purpose of change

## Validation

- `command`: passed
- `command`: passed
- `command`: failed — reason

## Assumptions or limitations

- Important assumptions
- Remaining limitations
- Manual steps, configuration, or migrations required

Do not provide a long narrative when a concise summary is sufficient.

## Safety boundaries

Stop and clearly flag the issue before proceeding when the requested change would:

- Expose secrets or personal data
- Bypass authentication or authorisation
- Remove important validation
- Cause destructive data loss
- Introduce an undocumented breaking API change
- Modify production infrastructure without adequate context
- Depend on an unclear business rule with major financial, legal, or security consequences

## Definition of done

A feature is complete only when:

- Acceptance criteria are satisfied
- Code follows repository conventions
- Permissions are enforced
- Input is validated
- Important states and edge cases are handled
- Tests are added or updated
- Relevant checks have been executed
- No unrelated changes remain
- Required setup or migration steps are documented
