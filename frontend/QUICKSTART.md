# CTMS Frontend Quick Start

## Installation

```bash
# Install dependencies
bun install

# Copy environment file
cp .env.example .env.local
```

## Development

```bash
# Start dev server with Turbopack
bun dev

# Dev server with debugging
bun dev:debug

# Clean restart (fix HMR issues)
bun dev:clean
```

## Code Quality

```bash
# Run all checks (types + lint + format)
bun run check

# Auto-fix all issues
bun run fix

# Type checking only
bun run type-check

# Lint only
bun run lint

# Format only
bun run format
```

## Testing

```bash
# Run unit tests (Bun built-in)
bun test

# Watch mode
bun test --watch

# Run E2E tests (Playwright)
bun run test:e2e

# E2E with UI mode
bun run test:e2e:ui
```

## Build

```bash
# Production build
bun run build

# Analyze bundle size
bun run build:analyze
```

## Troubleshooting

```bash
# Nuclear option: clean everything
bun run fresh

# Update all dependencies
bun run bump

# Add shadcn component
bun run shadcn:add button
```

## Project Structure

- `src/app/` - Next.js App Router
- `src/components/` - React components
  - `ui/` - shadcn/ui components
  - `common/` - Shared components
  - `features/` - Feature-specific components
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utilities, API, validations
- `src/types/` - TypeScript types

## Import Conventions

```typescript
// UI components
import { Button, Card, Dialog } from "@/components/ui";

// Utils
import { cn, formatDate } from "@/lib";

// Hooks
import { useAuth } from "@/hooks/use-auth";

// Types
import type { Title, Group } from "@/types";
```

## Environment Variables

All env vars must be defined in `.env.example` and validated in `src/lib/env.ts`.

## VS Code Extensions

Recommended extensions are listed in `.vscode/extensions.json`. VS Code will prompt you to install them.

## Learn More

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [Turbopack](https://nextjs.org/docs/app/building-your-application/optimizing/turbopack)
- [Bun Documentation](https://bun.sh/docs)
- [Tailwind CSS v4](https://tailwindcss.com/docs/v4-beta)
