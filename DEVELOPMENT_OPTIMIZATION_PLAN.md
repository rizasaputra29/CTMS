# CTMS Development Optimization & Cleanup Implementation Plan

**Version:** 2.0  
**Date:** 2026-05-16  
**Focus:** Development Workflow Optimization, Code Quality, Performance, Project Cleanup

---

## Executive Summary

This comprehensive implementation plan addresses four key areas:
1. **Project Cleanup** - Remove unused documentation and empty directories
2. **Frontend Optimization** - Next.js 16 + React 19 + Bun development workflow
3. **Backend Optimization** - Laravel 12 database performance and API structure
4. **React Best Practices** - Remove unnecessary effects, optimize performance

**Timeline:** 4 Weeks  
**Priority:** Development-focused improvements for faster iteration and better DX

---

## Phase 1: Project Cleanup (Week 1 - Days 1-2)

### 1.1 Remove Unused Documentation Files

**Files to Delete:**
```
/APP_ROUTER_IMPLEMENTATION_PLAN.md
/BACKEND_CODEBASE_SUMMARY.md
/CAPSTONE3_FINAL_IMPLEMENTATION_GUIDE.md
/DOCUMENTATION_CHECKLIST.md
/GROUP_FLOWS_DETAILED_ANALYSIS.md
/GROUP_FLOWS_EXECUTIVE_SUMMARY.md
/GROUP_FLOWS_QUICK_REFERENCE.md
/IMPLEMENTATION_COMPLETE.md
/README_GROUP_FLOWS.md
/STATUS_MAPPING_TABLE.md
/TYPE_ASSERTION_REFACTOR_SUMMARY.md
/USER_FLOW_BUSINESS_FLOW.md
/VERIFICATION_COMPLETE.md
/CTMS_Assessment_Flow_Documentation.txt
```

**Keep:**
- `/README.md` (will be updated)
- `/frontend/README.md`
- `/backend/README.md`

### 1.2 Organize Knowledge Base

**Create:** `/docs/knowledge-base/`

**Move:**
- `/frontend/docs/react-hook-form-guide.md` → `/docs/knowledge-base/react-hook-form-guide.md`

**Structure:**
```
/docs/
└── knowledge-base/
    └── react-hook-form-guide.md
```

### 1.3 Remove Empty Directories

**Directories to Remove:**
```
/.tmp/ (already cleaned)
/frontend/docs/ (after moving guide)
/backend/scripts/ (if not needed)
```

### 1.4 Update Root .gitignore

Add to prevent future clutter:
```gitignore
# OS Files
.DS_Store
Thumbs.db
*.swp
*.swo
*~

# Development
.tmp/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# Testing
test-results/
playwright-report/
coverage/

# IDE
.idea/
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
*.code-workspace

# Environment
.env
.env.local
.env.*.local

# Temporary
*.tmp
*.temp
```

---

## Phase 2: Frontend Development Optimization (Week 1-2)

### 2.1 Package.json Enhancement (Bun-Optimized)

**Current Issues:**
- Basic scripts (dev, build, start, lint)
- Missing development utilities
- No type-checking scripts

**New Structure:**
```json
{
  "name": "ctms-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --turbopack",
    "dev:debug": "NODE_OPTIONS='--inspect' next dev --turbopack",
    "dev:clean": "rm -rf .next && bun dev",
    "dev:https": "next dev --turbopack --experimental-https",
    
    "build": "next build",
    "build:analyze": "ANALYZE=true next build",
    "start": "next start",
    
    "lint": "eslint . --ext .ts,.tsx --report-unused-disable-directives",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "lint:cache": "eslint . --ext .ts,.tsx --cache",
    "type-check": "tsc --noEmit --pretty",
    "type-check:watch": "tsc --noEmit --watch --preserveWatchOutput",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "check": "bun run type-check && bun run lint && bun run format:check",
    "fix": "bun run lint:fix && bun run format",
    
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:headed": "playwright test --headed",
    
    "clean": "rm -rf .next node_modules bun.lock && bun install",
    "fresh": "bun run clean && bun dev",
    "bump": "bun update --latest",
    "shadcn:add": "bunx shadcn@latest add",
    "analyze": "bun run build:analyze"
  }
}
```

**Dependencies to Add:**
```bash
bun add -d prettier prettier-plugin-tailwindcss @next/bundle-analyzer
```

### 2.2 TypeScript Configuration Optimization

**Key Improvements:**
1. **Target ES2022** (modern JavaScript features)
2. **Strict mode enhancements** for better type safety
3. **Enhanced path mapping** for cleaner imports
4. **Better caching** for faster builds

**File: `tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "tsBuildInfoFile": ".next/cache/tsconfig.tsbuildinfo",
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/app/*": ["./src/app/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/types/*": ["./src/types/*"],
      "@/context/*": ["./src/context/*"]
    },
    "baseUrl": ".",
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": false,
    "allowArbitraryExtensions": true,
    "verbatimModuleSyntax": true
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

### 2.3 Next.js Configuration (Turbopack + React Compiler)

**File: `next.config.ts`**
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack (Next.js 16+)
  turbopack: {
    resolveExtensions: [".tsx", ".ts", ".jsx", ".js"],
  },

  // React Compiler (React 19 feature)
  reactCompiler: true,

  // Development indicators
  devIndicators: {
    position: "bottom-right",
  },

  // Fast refresh optimization
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },

  // TypeScript strict mode
  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: "./tsconfig.json",
  },

  // ESLint
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ["src"],
  },

  // Images - unoptimized in dev for speed
  images: {
    unoptimized: process.env.NODE_ENV === "development",
  },

  // Experimental features
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "recharts",
      "date-fns",
    ],
  },

  // Logging for debugging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // Webpack customization (fallback when not using Turbopack)
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
    }
    return config;
  },
};

export default nextConfig;
```

### 2.4 ESLint Configuration Enhancement

**File: `.eslintrc.json`**
```json
{
  "extends": [
    "next/core-web-vitals",
    "next/typescript"
  ],
  "plugins": ["import", "jsx-a11y"],
  "rules": {
    "import/order": [
      "error",
      {
        "groups": [
          ["builtin", "external"],
          ["internal", "parent", "sibling", "index"]
        ],
        "newlines-between": "always",
        "alphabetize": {
          "order": "asc",
          "caseInsensitive": true
        }
      }
    ],
    "import/no-duplicates": "error",
    
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }
    ],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",
    
    "jsx-a11y/alt-text": "warn",
    "jsx-a11y/anchor-is-valid": "warn",
    
    "no-console": ["warn", { "allow": ["error", "warn", "info"] }],
    "prefer-const": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-template": "error"
  },
  "settings": {
    "import/resolver": {
      "typescript": {
        "alwaysTryTypes": true,
        "project": "./tsconfig.json"
      }
    }
  }
}
```

### 2.5 Prettier Configuration

**File: `.prettierrc`**
```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindFunctions": ["cn", "clsx", "twMerge"]
}
```

**File: `.prettierignore`**
```
node_modules
.next
out
*.lock
bun.lock
coverage
playwright-report
test-results
```

### 2.6 VS Code Settings for DX

**File: `.vscode/settings.json`**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.detectIndentation": false,
  "editor.rulers": [80, 120],
  "editor.bracketPairColorization.enabled": true,
  "editor.guides.bracketPairs": true,
  "editor.suggestSelection": "first",
  "editor.quickSuggestions": {
    "strings": true
  },
  "editor.snippetSuggestions": "top",
  
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  
  "files.exclude": {
    "**/.next": true,
    "**/node_modules": true,
    "**/*.log": true,
    "**/coverage": true,
    "**/playwright-report": true,
    "**/test-results": true
  },
  "files.associations": {
    "*.css": "tailwindcss"
  },
  
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },
  "tailwindCSS.classAttributes": ["class", "className", "tw"],
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  
  "eslint.workingDirectories": [{ "mode": "auto" }],
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  
  "search.exclude": {
    "**/.next": true,
    "**/node_modules": true,
    "**/bun.lock": true
  }
}
```

**File: `.vscode/extensions.json`**
```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "usernamehw.errorlens",
    "yoavbls.pretty-ts-errors",
    "antfu.iconify",
    "eamodio.gitlens",
    "wix.vscode-import-cost",
    "ms-playwright.playwright"
  ]
}
```

---

## Phase 3: React Best Practices Implementation (Week 2-3)

Based on "You Might Not Need an Effect" documentation and React Hook Form best practices.

### 3.1 Remove Unnecessary Effects

#### A. Transform Data During Rendering

**❌ Before:**
```typescript
const [filteredItems, setFilteredItems] = useState([]);
useEffect(() => {
  setFilteredItems(items.filter(item => item.active));
}, [items]);
```

**✅ After:**
```typescript
const filteredItems = items.filter(item => item.active);
```

#### B. Cache Expensive Calculations with useMemo

```typescript
import { useMemo } from 'react';

function GroupList({ groups, filter }) {
  const visibleGroups = useMemo(() => {
    return groups
      .filter(g => filter === 'all' || g.status === filter)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [groups, filter]);

  return <GroupTable data={visibleGroups} />;
}
```

#### C. Reset State with Keys

**❌ Before:**
```typescript
useEffect(() => {
  setFormData(defaultValues);
}, [id]);
```

**✅ After:**
```typescript
function EditFormWrapper({ itemId }) {
  return <EditForm key={itemId} itemId={itemId} />;
}
```

#### D. Share Logic Between Event Handlers

**❌ Before:**
```typescript
useEffect(() => {
  if (shouldNotify) {
    showNotification(message);
  }
}, [shouldNotify, message]);
```

**✅ After:**
```typescript
function handleAction() {
  performAction();
  showNotification(message);
}

function handleSubmit() {
  handleAction();
  router.push('/next');
}
```

#### E. API Calls in Event Handlers

**❌ Before:**
```typescript
const [submitData, setSubmitData] = useState(null);
useEffect(() => {
  if (submitData) {
    api.post('/submit', submitData);
  }
}, [submitData]);

function handleSubmit() {
  setSubmitData(formData);
}
```

**✅ After:**
```typescript
async function handleSubmit() {
  await api.post('/submit', formData);
  showSuccess();
}
```

#### F. Proper Data Fetching Pattern

```typescript
function DataComponent({ query }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    
    async function fetchData() {
      try {
        setLoading(true);
        const result = await api.get(`/search?q=${query}`);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [query]);

  return { data, loading, error };
}
```

### 3.2 React Hook Form Best Practices

```typescript
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";

const formSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(20).optional(),
  status: z.enum(["active", "inactive"]),
});

type FormData = z.infer<typeof formSchema>;

function MyForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      description: "",
      status: "active",
    },
  });

  async function onSubmit(data: FormData) {
    console.log(data);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Controller
        name="title"
        control={form.control}
        render={({ field, fieldState }) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Title</Label>
            <Input
              {...field}
              id={field.name}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.error ? `${field.name}-error` : undefined}
            />
            {fieldState.error && (
              <p id={`${field.name}-error`} className="text-sm text-red-500">
                {fieldState.error.message}
              </p>
            )}
          </div>
        )}
      />
    </form>
  );
}
```

---

## Phase 4: Backend Development Optimization (Week 3-4)

### 4.1 Laravel API Route Organization

**Current Issue:** Single `api.php` file with 489 lines

**New Structure:**
```
routes/
├── api.php              # Route registrar (imports only)
└── api/
    ├── auth.php         # Authentication routes
    ├── admin.php        # Admin-specific routes
    ├── dosen.php        # Dosen (lecturer) routes
    ├── mahasiswa.php    # Student routes
    ├── shared.php       # Shared routes
    └── groups.php       # Group management
```

**File: `routes/api.php`**
```php
<?php

require __DIR__ . '/api/auth.php';
require __DIR__ . '/api/shared.php';
require __DIR__ . '/api/admin.php';
require __DIR__ . '/api/dosen.php';
require __DIR__ . '/api/mahasiswa.php';
require __DIR__ . '/api/groups.php';
```

**File: `routes/api/auth.php`**
```php
<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', [AuthController::class, 'me']);
    Route::get('/user/roles', [RoleController::class, 'index']);
    Route::post('/user/active-role', [RoleController::class, 'setActiveRole']);
});
```

### 4.2 Database Query Optimization

#### A. Eager Loading (Fix N+1)

**❌ Before:**
```php
$groups = Group::all();
foreach ($groups as $group) {
    echo $group->members->count(); // Extra query per group!
}
```

**✅ After:**
```php
$groups = Group::with(['members', 'supervisor', 'period'])->get();
foreach ($groups as $group) {
    echo $group->members->count(); // Already loaded!
}
```

#### B. Query Caching

```php
use Illuminate\Support\Facades\Cache;

$periods = Cache::remember('active_periods', 3600, function () {
    return Period::where('is_active', true)->get();
});

// Clear cache when data changes
Period::updated(function ($period) {
    Cache::forget('active_periods');
});
```

#### C. Database Indexing

**Migration:**
```php
Schema::table('groups', function (Blueprint $table) {
    $table->index('period_id');
    $table->index(['status', 'period_id']);
    $table->index('supervisor_id');
});

Schema::table('titles', function (Blueprint $table) {
    $table->index('user_id');
    $table->index(['status', 'period_id']);
});
```

### 4.3 API Response Optimization

#### A. API Resources

**File: `app/Http/Resources/GroupResource.php`**
```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GroupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'status' => $this->status,
            'members_count' => $this->whenCounted('members'),
            'supervisor' => new UserResource($this->whenLoaded('supervisor')),
            'period' => new PeriodResource($this->whenLoaded('period')),
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
```

#### B. Form Request Validation

**File: `app/Http/Requests/StoreGroupRequest.php`**
```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create-groups');
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'period_id' => 'required|exists:periods,id',
            'description' => 'nullable|string|max:1000',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Group name is required',
            'period_id.exists' => 'Selected period does not exist',
        ];
    }
}
```

### 4.4 Development Database Configuration

**`.env.development`:**
```bash
DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite

# Query logging (dev only)
DB_DEBUG=true
```

**Enable query logging:**
```php
// In AppServiceProvider boot method
if (config('app.debug')) {
    DB::listen(function ($query) {
        Log::info($query->sql, $query->bindings, $query->time);
    });
}
```

### 4.5 API Documentation Setup

**Install Scribe:**
```bash
composer require knuckleswtf/scribe
php artisan vendor:publish --tag=scribe-config
```

**Generate docs:**
```bash
php artisan scribe:generate
```

---

## Phase 5: Environment Management

### 5.1 Frontend Environment

**File: `.env.example`**
```bash
NEXT_PUBLIC_APP_NAME="CTMS"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:8000/api"
API_TIMEOUT=30000
NEXT_PUBLIC_ENABLE_MOCK_API=false
NEXT_PUBLIC_DEBUG=false
```

**File: `src/lib/env.ts`**
```typescript
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("CTMS"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: z.string().url(),
  API_TIMEOUT: z.coerce.number().default(30000),
  NEXT_PUBLIC_ENABLE_MOCK_API: z.coerce.boolean().default(false),
  NEXT_PUBLIC_DEBUG: z.coerce.boolean().default(false),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  API_TIMEOUT: process.env.API_TIMEOUT,
  NEXT_PUBLIC_ENABLE_MOCK_API: process.env.NEXT_PUBLIC_ENABLE_MOCK_API,
  NEXT_PUBLIC_DEBUG: process.env.NEXT_PUBLIC_DEBUG,
});
```

---

## Implementation Timeline

### Week 1: Cleanup & Frontend Foundation

**Day 1-2: Cleanup**
- Remove unused documentation files (14 files)
- Create docs/knowledge-base/ folder
- Move react-hook-form-guide.md
- Remove empty directories
- Update root .gitignore
- Commit cleanup

**Day 3-5: Frontend Configuration**
- Update package.json with Bun-optimized scripts
- Install dependencies: `bun add -d prettier prettier-plugin-tailwindcss @next/bundle-analyzer`
- Update tsconfig.json
- Update next.config.ts with Turbopack + React Compiler
- Create .eslintrc.json
- Create .prettierrc
- Test dev server with `bun dev`

### Week 2: VS Code & React Best Practices

**Day 1-3: VS Code & DX**
- Create .vscode/settings.json
- Create .vscode/extensions.json
- Test formatting on save

**Day 4-5: React Best Practices Audit**
- Audit components for unnecessary useEffect
- Refactor to calculate during render
- Add useMemo where needed
- Optimize React Hook Form usage

### Week 3: Backend Structure & Database

**Day 1-3: Backend Route Organization**
- Split routes/api.php into multiple files
- Create routes/api/*.php structure
- Test all endpoints still work

**Day 4-5: Database Optimization**
- Add eager loading to controllers
- Create migration for database indexes
- Implement query caching
- Create API Resources
- Create Form Request validation classes

### Week 4: Documentation & Final Testing

**Day 1-2: API Documentation**
- Install Scribe
- Add docblocks to key controllers
- Generate API documentation

**Day 3-5: Comprehensive README & Testing**
- Update README.md with complete guide
- Run all checks: `bun run check`
- Run E2E tests: `bun run test:e2e`
- Test backend: `php artisan test`
- Final review and commit

---

## Benefits Summary

### Development Speed
- **Turbopack**: 10-20x faster dev builds
- **Bun**: 4x faster package installation
- **React Compiler**: Automatic memoization
- **Strict TypeScript**: Catch errors early

### Code Quality
- Consistent code style (ESLint + Prettier)
- Type safety throughout
- React best practices enforced
- Laravel eager loading (no N+1)

### Developer Experience
- Format on save
- Auto-organize imports
- Background type checking
- Clear project structure
- Comprehensive documentation

---

## Next Steps

1. ✅ Review this plan
2. Start Phase 1: Cleanup (remove files, organize knowledge base)
3. Continue through each phase systematically
4. Test after each major change
5. Commit frequently with descriptive messages

**Ready to implement?** Let's start with Phase 1 (Cleanup)!
