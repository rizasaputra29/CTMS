# React Best Practices Examples

This directory contains examples demonstrating the transition from Client Component patterns to Server Component patterns.

## 📁 Structure

```
examples/
├── server-dashboard/
│   └── page.tsx          # Server Component dashboard example
└── README.md             # This file
```

## 🚀 Key Concepts Demonstrated

### 1. Server Components vs Client Components

**❌ Before (Client Component Pattern):**
```typescript
'use client';
import { useState, useEffect } from 'react';

export default function Page() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(data => {
        setData(data);
        setLoading(false);
      });
  }, []);
  
  if (loading) return <Loading />;
  return <Content data={data} />;
}
```

**✅ After (Server Component Pattern):**
```typescript
// No 'use client' directive!
import { getData } from '@/lib/server-data';

export default async function Page() {
  const data = await getData(); // Fetched on server!
  
  return <Content data={data} />;
}
```

### 2. Benefits of Server Components

1. **Zero JavaScript Bundle Size**: Server Components don't send JavaScript to the client
2. **Direct Backend Access**: Can access databases/files directly
3. **Automatic Caching**: Built-in Next.js caching with `fetch`
4. **Streaming**: Components can stream progressively
5. **Better SEO**: Full HTML rendered on server

### 3. When to Use Each

**Server Components:**
- Data fetching
- Accessing backend resources (databases, files)
- Static content
- SEO-critical content

**Client Components:**
- Interactivity (onClick, useState)
- Browser APIs (localStorage, window)
- Real-time updates
- Complex animations

### 4. Hybrid Pattern

```typescript
// Server Component (page.tsx)
import { getData } from '@/lib/server-data';
import { InteractiveComponent } from './client-component';

export default async function Page() {
  const data = await getData();
  
  return (
    <div>
      {/* Static content from server */}
      <h1>{data.title}</h1>
      
      {/* Interactive client component */}
      <InteractiveComponent initialData={data} />
    </div>
  );
}
```

```typescript
// Client Component (client-component.tsx)
'use client';

import { useState } from 'react';

export function InteractiveComponent({ initialData }) {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>
        Increment
      </button>
    </div>
  );
}
```

## 📊 Performance Comparison

| Metric | Client Component | Server Component |
|--------|-----------------|------------------|
| Initial JS Bundle | ~50KB+ | 0KB |
| Time to First Byte | Slower (JS download + execute) | Faster (HTML streamed) |
| SEO | Poor (no HTML initially) | Excellent |
| Loading State | Required | Optional |

## 🔧 Best Practices

1. **Start with Server Components**: Make components Server by default
2. **Mark Client Components Explicitly**: Only add `'use client'` when needed
3. **Pass Data Down**: Fetch in Server Components, pass to Client Components
4. **Use Suspense**: Wrap async components in `<Suspense>`
5. **Cache Appropriately**: Use `cache: 'force-cache'` for static data

## 📚 Additional Resources

- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [React Server Components](https://react.dev/blog/2020/12/21/data-fetching-with-react-server-components)
- [Streaming with Suspense](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)

## 🎯 Migration Strategy

1. **Phase 1**: Identify static data fetching in Client Components
2. **Phase 2**: Move data fetching to Server Components
3. **Phase 3**: Extract interactive parts to Client Components
4. **Phase 4**: Add caching and optimization

## 📈 Expected Improvements

- **40-60% reduction** in JavaScript bundle size
- **50% faster** Time to First Byte (TTFB)
- **Better SEO** with server-rendered HTML
- **Improved user experience** with progressive streaming
