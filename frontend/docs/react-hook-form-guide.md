# React Hook Form with Controller Pattern

This documentation explains how to use the Field components with React Hook Form's Controller pattern.

## Installation

Dependencies are already installed:
```bash
bun add react-hook-form @hookform/resolvers zod
bun add @radix-ui/react-radio-group  # for RadioGroup component
```

## Quick Start

### 1. Import the Components

```tsx
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

// Field components
import { Field } from "@/components/ui/field"
import { FieldLabel } from "@/components/ui/field-label"
import { FieldError } from "@/components/ui/field-error"
import { FieldDescription } from "@/components/ui/field-description"

// UI components
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

// Validation schemas (pre-created)
import { loginSchema, type LoginFormData } from "@/lib/validations/auth"
```

### 2. Define Your Schema

```tsx
const formSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type FormData = z.infer<typeof formSchema>
```

### 3. Set Up useForm

```tsx
function MyForm() {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur", // Validates on blur
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (data: FormData) => {
    console.log(data)
    // Submit to API
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Fields go here */}
      <button type="submit">Submit</button>
    </form>
  )
}
```

### 4. Use Controller with Field Components

#### Text Input

```tsx
<Controller
  name="email"
  control={control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
      <Input
        {...field}
        id={field.name}
        type="email"
        placeholder="Enter your email"
        aria-invalid={fieldState.invalid}
      />
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

#### Textarea

```tsx
<Controller
  name="description"
  control={control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={field.name}>Description</FieldLabel>
      <Textarea
        {...field}
        id={field.name}
        placeholder="Enter description"
        aria-invalid={fieldState.invalid}
        className="min-h-[120px]"
      />
      <FieldDescription>
        Provide a detailed description
      </FieldDescription>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

#### Select Dropdown

```tsx
<Controller
  name="supervisor"
  control={control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldContent>
        <FieldLabel htmlFor={field.name}>Supervisor</FieldLabel>
        <FieldDescription>Select your preferred supervisor</FieldDescription>
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </FieldContent>
      <Select
        name={field.name}
        value={field.value}
        onValueChange={field.onChange}
      >
        <SelectTrigger
          id={field.name}
          aria-invalid={fieldState.invalid}
        >
          <SelectValue placeholder="Select supervisor" />
        </SelectTrigger>
        <SelectContent>
          {lecturers.map((l) => (
            <SelectItem key={l.id} value={l.id.toString()}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )}
/>
```

#### Checkbox (Single)

```tsx
<Controller
  name="isActive"
  control={control}
  render={({ field, fieldState }) => (
    <Field orientation="horizontal" data-invalid={fieldState.invalid}>
      <FieldContent>
        <FieldLabel htmlFor={field.name}>Active Status</FieldLabel>
        <FieldDescription>Enable to activate this item</FieldDescription>
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </FieldContent>
      <Checkbox
        id={field.name}
        name={field.name}
        checked={field.value}
        onCheckedChange={field.onChange}
        aria-invalid={fieldState.invalid}
      />
    </Field>
  )}
/>
```

#### Checkbox (Array/Multiple)

```tsx
<Controller
  name="specializations"
  control={control}
  render={({ field, fieldState }) => (
    <FieldSet>
      <FieldLegend variant="label">Specializations</FieldLegend>
      <FieldDescription>Select all that apply</FieldDescription>
      <FieldGroup data-slot="checkbox-group">
        {specializations.map((spec) => (
          <Field
            key={spec.id}
            orientation="horizontal"
            data-invalid={fieldState.invalid}
          >
            <Checkbox
              id={`spec-${spec.id}`}
              name={field.name}
              checked={field.value?.includes(spec.id)}
              onCheckedChange={(checked) => {
                const newValue = checked
                  ? [...(field.value || []), spec.id]
                  : field.value?.filter((v: string) => v !== spec.id) || []
                field.onChange(newValue)
              }}
              aria-invalid={fieldState.invalid}
            />
            <FieldLabel htmlFor={`spec-${spec.id}`} className="font-normal">
              {spec.label}
            </FieldLabel>
          </Field>
        ))}
      </FieldGroup>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </FieldSet>
  )}
/>
```

#### Radio Group

```tsx
<Controller
  name="plan"
  control={control}
  render={({ field, fieldState }) => (
    <FieldSet>
      <FieldLegend>Plan</FieldLegend>
      <FieldDescription>Choose your plan</FieldDescription>
      <RadioGroup
        name={field.name}
        value={field.value}
        onValueChange={field.onChange}
      >
        {plans.map((plan) => (
          <FieldLabel key={plan.id} htmlFor={`plan-${plan.id}`}>
            <Field orientation="horizontal" data-invalid={fieldState.invalid}>
              <FieldContent>
                <FieldTitle>{plan.title}</FieldTitle>
                <FieldDescription>{plan.description}</FieldDescription>
              </FieldContent>
              <RadioGroupItem
                value={plan.id}
                id={`plan-${plan.id}`}
                aria-invalid={fieldState.invalid}
              />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </FieldSet>
  )}
/>
```

#### Switch

```tsx
<Controller
  name="twoFactor"
  control={control}
  render={({ field, fieldState }) => (
    <Field orientation="horizontal" data-invalid={fieldState.invalid}>
      <FieldContent>
        <FieldLabel htmlFor={field.name}>Two-Factor Auth</FieldLabel>
        <FieldDescription>Enable for extra security</FieldDescription>
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </FieldContent>
      <Switch
        id={field.name}
        name={field.name}
        checked={field.value}
        onCheckedChange={field.onChange}
        aria-invalid={fieldState.invalid}
      />
    </Field>
  )}
/>
```

## Field Component Variants

### Field Orientations

```tsx
// Vertical (default)
<Field>
  <FieldLabel>Label</FieldLabel>
  <Input />
</Field>

// Horizontal - Label on left, input on right
<Field orientation="horizontal">
  <FieldLabel>Label</FieldLabel>
  <Input />
</Field>

// Responsive - Horizontal on desktop, vertical on mobile
<Field orientation="responsive">
  <FieldLabel>Label</FieldLabel>
  <Input />
</Field>
```

## Form-Level Error Handling

```tsx
const onSubmit = async (data: FormData) => {
  try {
    await api.post('/endpoint', data)
    toast.success('Success!')
  } catch (err: unknown) {
    if (api.isAxiosError(err)) {
      // Set form-level error
      setError('root', {
        type: 'manual',
        message: err.response?.data?.message || 'An error occurred',
      })
    }
  }
}

// Display root error
{errors.root && (
  <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
    {errors.root.message}
  </div>
)}
```

## Available Validation Schemas

All forms have pre-created schemas in `/lib/validations/`:

- `auth.ts` - Login form
- `proposals.ts` - Title proposal form
- `bidding.ts` - Bid creation form
- `group.ts` - Group management forms
- `period.ts` - Period creation/editing form
- `evaluation.ts` - Evaluation scoring
- `assessment.ts` - Assessment templates
- `finalization.ts` - Supervisor assignment

## Validation Modes

| Mode | Description |
|------|-------------|
| `"onChange"` | Validates on every keystroke |
| `"onBlur"` | Validates when field loses focus (recommended) |
| `"onSubmit"` | Validates on form submission only |
| `"onTouched"` | Validates on first blur, then on every change |
| `"all"` | Validates on both blur and change |

**Recommended: `"onBlur"`** - Good balance between UX and validation feedback.

## Migration Checklist

When migrating existing forms:

1. [ ] Import React Hook Form dependencies
2. [ ] Import Field components
3. [ ] Import or create Zod schema
4. [ ] Replace `useState` with `useForm`
5. [ ] Replace manual inputs with `Controller` + `Field` pattern
6. [ ] Remove manual validation functions
7. [ ] Test all form functionality
8. [ ] Verify error messages display correctly
9. [ ] Check accessibility (aria-invalid, aria-describedby)

## Best Practices

1. **Always use `id={field.name}`** on inputs for accessibility
2. **Always set `aria-invalid={fieldState.invalid}`** on inputs
3. **Always set `data-invalid={fieldState.invalid}`** on Field wrapper
4. **Use `mode: "onBlur"`** for most forms
5. **Type your forms** with `z.infer<typeof schema>`
6. **Use FieldDescription** for helper text
7. **Keep validation messages clear and specific**
8. **Test error states** during development

## Troubleshooting

### Form not validating
- Check that `resolver: zodResolver(schema)` is set
- Verify schema has `.min()` or `.required()` for required fields
- Check that Controller `name` prop matches schema field name

### Errors not showing
- Ensure `fieldState.invalid` is being checked
- Verify FieldError is receiving `[fieldState.error]` array
- Check that `data-invalid` is being passed to Field

### Type errors
- Make sure `useForm<FormData>` matches your Zod schema type
- Use `z.infer<typeof schema>` to generate TypeScript types

## Example: Complete Form

See `/app/login/page.tsx` for a complete working example.
