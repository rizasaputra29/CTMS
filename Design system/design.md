# SITKOM / SICATA Design System

> **Rules & Constraints**
>
> 1. **Backend-agnostic rule**: Do NOT change any logic, endpoint, database schema, migration, or anything that affects the backend system.
> 2. **UI-only focus**: ONLY focus on UI implementation (components, styling, layout, tokens, and frontend assets).
> 3. **System integrity**: After any UI implementation, the system must work normally — existing functionality, API contracts, and data flows must remain untouched.
> 4. **No breaking changes**: Do not modify existing backend controllers, services, models, routes, or middleware.
> 5. **Frontend scope**: Changes are limited to the `frontend/` directory: React components, Tailwind CSS classes, Shadcn UI theme tokens, and static assets.

---

## 1. Overview

This document is the single source of truth for the **SITKOM / SICATA** (Capstone / Tugas Akhir Management System) visual design system. It catalogs every design token, component specification, and layout pattern derived from the reference image assets in the `Design system/` folder.

### Project Identity
- **Primary Name**: SICATA (Sistem Informasi Capstone & TA)
- **Domain**: `sicata.com`
- **Year**: 2026

### Tech Stack Context
- **Frontend**: Next.js 16 (React 19), Tailwind CSS v4, Shadcn UI, Radix UI, TypeScript
- **Backend**: Laravel 12, PostgreSQL, Laravel Sanctum (API Authentication)
- **Architecture**: API-first with service layer pattern

### Design System Purpose
This style guide provides the stylistic foundation for the entire SITKOM frontend. All UI implementations must reference the tokens and patterns documented here to ensure visual consistency across the platform.

### File Reference Index

| Asset File | Category |
|---|---|
| `Colors.png` | Full color palette |
| `Primary.png` | Primary color scale (50–500) |
| `Greyscale.png` | Greyscale color scale (0–900) |
| `Typography.png` | Font, weights, heading & body scales |
| `Shadow.png` | Shadow elevation tokens |
| `Avatar.png` | Avatar sizes, types, and status indicators |
| `Badges.png` | Badge colors, styles, dot, dismissible |
| `Button.png` | Button variants, sizes, states, social buttons |
| `Forms.png` | Inputs, textareas, dropdowns, checkbox, radio, toggle |
| `Components.png` | Dashboard, sidebar, lists, tables, calendar, cards |
| `Native.png` | iOS status bar, keyboard, segmented control |
| `Logos & Cursor.png` | Brand logos and cursor types |

---

## 2. Color Tokens

### 2.1 Primary Palette
The primary brand color is a deep navy blue used for CTAs, active states, and key UI elements.

| Token | Hex | Usage |
|---|---|---|
| `primary-50` | `#E7E8F0` | Hover backgrounds, subtle tints |
| `primary-100` | `#CED4E0` | Light accents, disabled primary elements |
| `primary-200` | `#9FA6C1` | Secondary highlights |
| `primary-300` | `#6F7DA4` | Focus rings, active borders |
| `primary-400` | `#415086` | Interactive elements |
| `primary-500` | `#293C79` | **Primary CTA buttons**, links, active nav items |

### 2.2 Greyscale Palette
Used for text, borders, backgrounds, and structural UI.

| Token | Hex | Usage |
|---|---|---|
| `grey-0` | `#F8F9FB` | Page background |
| `grey-25` | `#F6F8FA` | Card background, input background |
| `grey-50` | `#ECEFF3` | Subtle borders, divider lines |
| `grey-100` | `#DFE1E6` | Borders, disabled backgrounds |
| `grey-200` | `#C1C7CF` | Placeholder text, inactive icons |
| `grey-300` | `#A4ABB8` | Secondary text, hint text |
| `grey-400` | `#808897` | Body text (medium emphasis) |
| `grey-500` | `#666D80` | Body text (high emphasis) |
| `grey-600` | `#353849` | Headings, primary text |
| `grey-700` | `#272835` | Dark backgrounds |
| `grey-800` | `#1A1B25` | Footer, dark sidebar |
| `grey-900` | `#0D0D12` | Deepest dark elements |

### 2.3 Additional / Sky Palette
Used for informational states and secondary accents.

| Token | Hex | Usage |
|---|---|---|
| `sky-0` | `#EFFFFF` | Light info backgrounds |
| `sky-25` | `#D1F0F9` | Info tint backgrounds |
| `sky-50` | `#7EDCF1` | Info badges, highlights |
| `sky-100` | `#33CFFF` | Info icons, active info states |
| `sky-200` | `#106A97` | Info text |
| `sky-300` | `#0C4D6E` | Deep info elements |

### 2.4 Alert / Success Palette
Used for positive feedback, active statuses, and success states.

| Token | Hex | Usage |
|---|---|---|
| `success-0` | `#E6FFF5` | Light success backgrounds |
| `success-25` | `#DDF2EE` | Success tint |
| `success-50` | `#9DE0D3` | Success badges (light) |
| `success-100` | `#40C4AA` | Success icons, active success |
| `success-200` | `#287F6E` | Success text |
| `success-300` | `#174E43` | Deep success elements |

### 2.5 Alert / Warning Palette
Used for cautionary feedback and pending states.

| Token | Hex | Usage |
|---|---|---|
| `warning-0` | `#FFF9F0` | Light warning backgrounds |
| `warning-25` | `#F9ECCB` | Warning tint |
| `warning-50` | `#FBD982` | Warning badges (light) |
| `warning-100` | `#FFBD4C` | Warning icons, active warning |
| `warning-200` | `#956321` | Warning text |
| `warning-300` | `#5B3D1E` | Deep warning elements |

### 2.6 Alert / Error Palette
Used for negative feedback, validation errors, and destructive actions.

| Token | Hex | Usage |
|---|---|---|
| `error-0` | `#FEEFF2` | Light error backgrounds |
| `error-25` | `#FADAE1` | Error tint |
| `error-50` | `#ED8296` | Error badges (light) |
| `error-100` | `#DF1C41` | Error icons, validation errors |
| `error-200` | `#95122B` | Error text |
| `error-300` | `#710E21` | Deep error elements |

### 2.7 Semantic Color Mapping

| Semantic Role | Token | Hex |
|---|---|---|
| **Primary CTA** | `primary-500` | `#293C79` |
| **Primary Hover** | `primary-400` | `#415086` |
| **Page Background** | `grey-0` | `#F8F9FB` |
| **Card Background** | `grey-25` / white | `#F6F8FA` / `#FFFFFF` |
| **Border** | `grey-100` | `#DFE1E6` |
| **Placeholder Text** | `grey-200` | `#C1C7CF` |
| **Hint Text** | `grey-300` | `#A4ABB8` |
| **Body Text** | `grey-500` | `#666D80` |
| **Heading Text** | `grey-600` | `#353849` |
| **Success / Active** | `success-100` | `#40C4AA` |
| **Warning / Pending** | `warning-100` | `#FFBD4C` |
| **Error / Danger** | `error-100` | `#DF1C41` |
| **Info / Sky** | `sky-100` | `#33CFFF` |

---

## 3. Typography

### 3.1 Font Family
- **Primary Font**: `Inter Tight`
- **Source**: Google Fonts — `https://fonts.google.com/specimen/Inter+Tight`
- **Fallback**: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

### 3.2 Font Weights

| Weight | Name | Usage |
|---|---|---|
| 400 | Regular | Body text, descriptions, labels |
| 500 | Medium | Subheadings, emphasized body, input values |
| 600 | Semibold | Headings, button text, active nav items, bold labels |

### 3.3 Heading Scale
All headings use **Inter Tight Semibold (600)** unless specified.

| Token | Size | Line Height | Usage |
|---|---|---|---|
| `heading-1` | 48px | 1.2 | Page titles, hero text |
| `heading-2` | 40px | 1.2 | Section headers |
| `heading-3` | 32px | 1.3 | Card titles, modal headers |
| `heading-4` | 24px | 1.3 | Sub-section titles |
| `heading-5` | 20px | 1.4 | Widget titles, panel headers |
| `heading-6` | 18px | 1.4 | Small headers, table section titles |

### 3.4 Body Scale
Body text uses three weights: **Semibold (600)**, **Medium (500)**, and **Regular (400)**.

| Token | Size | Line Height | Weight Usage |
|---|---|---|---|
| `body-large` | 18px | 1.5 | Semibold for labels, Medium for emphasized text, Regular for descriptions |
| `body-medium` | 16px | 1.5 | Default body text size |
| `body-small` | 14px | 1.5 | Secondary text, metadata, captions |
| `body-xsmall` | 12px | 1.5 | Fine print, timestamps, helper text |

### 3.5 Label Style
- **Size**: 14px
- **Weight**: 500 (Medium)
- **Color**: `grey-600` (#353849)
- **Required Indicator**: Red asterisk `*` after label text

### 3.6 Hint / Helper Text
- **Size**: 12px
- **Weight**: 400 (Regular)
- **Color**: `grey-300` (#A4ABB8)
- **Placement**: Below input fields

---

## 4. Shadow System

Shadows provide depth and hierarchy. Six elevation levels are defined.

| Token | Name | Usage |
|---|---|---|
| `shadow-xsmall` | XSmall | Subtle elevation, inline elements, small badges |
| `shadow-small` | Small | Cards, dropdowns, popovers, tooltips |
| `shadow-medium` | Medium | Modals, floating panels, expanded sidebar items, dropdown menus |
| `shadow-large` | Large | Drawer overlays, large floating cards |
| `shadow-xlarge` | XLarge | Full-screen overlays, bottom sheets (mobile) |
| `shadow-xxlarge` | XXLarge | Maximum elevation, critical modals, toast notifications |

### Shadow Application Rules
- **Cards** in content areas: `shadow-small` to `shadow-medium`
- **Dropdown menus** and **popovers**: `shadow-medium`
- **Modals** and **drawers**: `shadow-large` to `shadow-xlarge`
- **Toast** / **notification banners**: `shadow-xxlarge`
- **Buttons** (elevated style): `shadow-xsmall` to `shadow-small`

---

## 5. Spacing & Layout

### 5.1 Grid & Spacing Scale
Use an 8px base grid system. Standard spacing tokens:

| Token | Value |
|---|---|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |

### 5.2 Page Layout

#### Dashboard Layout (Primary)
- **Sidebar**: ~240px width, fixed left, full height
- **Content Area**: Fluid, fills remaining viewport width
- **Header Area** (within content): Breadcrumb + Page Title + Actions (top-right)
- **Page Padding**: 24px (`space-6`) on all sides of the content area
- **Card Gap**: 16px (`space-4`) between cards
- **Card Padding**: 20px–24px (`space-5` to `space-6`)

#### Auth Layout (Login / Register)
- **Background**: Patterned texture (light grey dots on white/grey background)
- **Card**: Centered, fixed width (~480px), white background, `shadow-medium`
- **Card Padding**: 32px–40px (`space-8` to `space-10`)
- **Logo**: Centered above card

### 5.3 Sidebar
- **Width**: 240px (expanded), 64px (collapsed)
- **Background**: White or `grey-0` (#F8F9FB)
- **Border**: 1px right border `grey-100` (#DFE1E6)
- **Logo Area**: Top, padding 16px
- **Menu Item Height**: 40px
- **Menu Item Padding**: 12px 16px
- **Active Item**: Left border 3px `primary-500`, background `primary-50` (#E7E8F0), text `grey-600` Semibold
- **Inactive Item**: Text `grey-400` (#808897), Regular weight
- **Parent Menu**: Chevron down/up icon on right
- **Submenu Indent**: 16px additional left padding
- **Logout Item**: Bottom of menu, text `error-100` (#DF1C41), with logout icon

### 5.4 Header (Top Bar)
- **Height**: 64px
- **Background**: White or transparent
- **Border Bottom**: 1px `grey-100` (optional)
- **Left**: Breadcrumb navigation (`grey-400`, 14px)
- **Center/Right**: Search, Notifications (bell icon), User Profile (avatar + name + role)
- **Notification Badge**: Red dot on bell icon when unread

---

## 6. Component Specs

### 6.1 Avatar

#### Sizes
7 sizes are defined, ranging from the largest to the smallest:

| Size | Dimensions | Usage |
|---|---|---|
| `avatar-xl` | 64px | Profile headers, user detail pages |
| `avatar-lg` | 48px | User cards, team lists |
| `avatar-md` | 40px | Table rows, dropdown items |
| `avatar-sm` | 32px | Compact lists, inline mentions |
| `avatar-xs` | 24px | Small UI elements |
| `avatar-2xs` | 20px | Tiny inline avatars |
| `avatar-3xs` | 16px | Micro avatars, dense tables |

#### Types
1. **Image Avatar**: Circular crop of user photo. Falls back to initials or icon if no image.
2. **Initials Avatar**: Circular background with 2-letter initials (e.g., "UG"). Background color auto-generated from user name hash.
3. **Icon Avatar**: Generic user icon silhouette inside a circle. Used for guests or system users.

#### Status Indicator
- **Online / Active**: 8px–12px green dot (`success-100`), positioned bottom-right with a white ring
- **Offline / Away**: 8px–12px grey dot (`grey-300`), positioned bottom-right with a white ring
- **Indicator scales proportionally** with avatar size

---

### 6.2 Badge

#### Colors
| Color | Hex | Semantic Meaning |
|---|---|---|
| Grey | `grey-200` | Default, neutral, draft |
| Navy | `primary-500` | Primary, featured, important |
| Teal | `success-100` | Active, success, online, "Dosen" role |
| Yellow | `warning-100` | Pending, warning, "Mahasiswa" role |
| Red | `error-100` | Error, danger, admin, critical |

#### Styles
1. **Filled (Soft)**: Colored background with matching text color (e.g., light red bg + red text)
2. **Outlined**: White/transparent background with colored border and colored text
3. **Dot**: Small colored circle (6px–8px) preceding the label text

#### Variants
- **Standard Badge**: Text only (e.g., "Label")
- **Dot Badge**: Colored dot + text (e.g., "● Aktif")
- **Dismissible Badge**: Text + X close icon. Used for tags, filters, multi-select chips.

#### Usage in System
| Badge | Color + Style | Usage |
|---|---|---|
| `Aktif` | Teal dot badge | Active period, active user, active component |
| `Nonaktif` | Grey dot badge | Inactive period, inactive record |
| `Admin` | Red filled badge | Admin role indicator |
| `Mahasiswa` | Yellow/Orange filled badge | Student role indicator |
| `Dosen` | Teal filled badge | Lecturer role indicator |
| `Alumni` | Yellow/Orange filled badge | Alumni role indicator |
| `50%` | Red filled badge | Weight/value indicators in evaluation tables |
| `25%` | Yellow filled badge | Weight/value indicators |
| `10%` | Teal filled badge | Weight/value indicators |
| `100%` | Teal filled badge | Total weight completion |

---

### 6.3 Button

#### Variants
| Variant | Background | Text | Border | Usage |
|---|---|---|---|---|
| **Primary** | `primary-500` (#293C79) | White | None | Main CTAs: "Login", "Simpan", "Tambah User" |
| **Secondary** | `grey-25` (#F6F8FA) | `grey-600` (#353849) | 1px `grey-100` | Secondary actions: "Kembali", "Import Users" |
| **Outlined** | Transparent | `grey-600` | 1px `grey-100` | Low-priority actions, filters |
| **Ghost** | Transparent | `primary-500` | None | Link-style buttons, tertiary actions |
| **Danger** | `error-100` (#DF1C41) | White | None | Destructive: "Hapus", "Logout" |
| **Danger Outlined** | `error-0` (#FEEFF2) | `error-100` | 1px `error-100` | Soft destructive actions |

#### Sizes
| Size | Height | Padding | Font | Border Radius |
|---|---|---|---|---|
| **XL** | 48px | 16px 24px | 16px Medium | 8px |
| **L** | 40px | 12px 20px | 14px Medium | 6px |
| **M** | 36px | 10px 16px | 14px Medium | 6px |
| **S** | 32px | 8px 12px | 12px Medium | 4px |

#### States
- **Default**: As per variant
- **Hover**: Slightly darker background (10% darken), subtle `shadow-xsmall`
- **Active/Pressed**: 15% darker background
- **Disabled**: `grey-100` background, `grey-300` text, no shadow, `cursor: not-allowed`
- **Loading**: Spinner replaces left icon (if any), text remains

#### Icon Buttons
Circular buttons in 4 sizes (same as above but square/circular):
- With icon only
- With icon + text (icon left or right)
- Common icons: arrow left/right, plus, filter, sort, search, eye (password visibility)

#### Social Buttons
- **Google**: White bg, "Sign in with Google" text, Google "G" icon
- **Facebook**: `#1877F2` bg, white text, Facebook "f" icon
- **Twitter/X**: `#1DA1F2` bg, white text, bird icon
- **Apple**: Black bg, white text, Apple logo icon

---

### 6.4 Forms

#### Basic Input Field
- **Height**: 40px (standard), 48px (large)
- **Padding**: 12px horizontal
- **Border**: 1px `grey-100` (#DFE1E6)
- **Border Radius**: 6px
- **Background**: White or `grey-25`
- **Placeholder Color**: `grey-200` (#C1C7CF), 14px Regular
- **Value Color**: `grey-600` (#353849), 14px Medium
- **Label**: 14px Medium, `grey-600`, positioned above input with 8px bottom margin
- **Hint Text**: 12px Regular, `grey-300`, 4px top margin

#### Input States
| State | Border | Background | Notes |
|---|---|---|---|
| **Default** | `grey-100` | White | — |
| **Focused** | `primary-300` (#6F7DA4) | White | 1px, subtle outer glow `primary-50` |
| **Filled** | `grey-100` | `grey-25` | User has entered value |
| **Disabled** | `grey-100` | `grey-0` | `grey-300` text, `cursor: not-allowed` |
| **Error** | `error-100` (#DF1C41) | `error-0` (#FEEFF2) | Hint text turns `error-100`, error icon may appear |
| **Success** | `success-100` (#40C4AA) | `success-0` | Checkmark icon appears right |

#### Input Types
- **Text**: Standard single-line input
- **Password**: Right-side eye icon to toggle visibility
- **Phone**: Left-side country flag + code dropdown (e.g., `🇺🇸 +1`), then number input
- **Search**: Left-side magnifying glass icon, placeholder "Search", clear button when filled
- **Select / Dropdown**: Right-side chevron down, opens dropdown panel below

#### Text Area
- **Min Height**: 80px
- **Max Height**: 200px (with scroll)
- **Character Counter**: "0/200" in bottom-right, `grey-300` text
- **Resizable**: Vertical only (CSS `resize: vertical`)
- **Tag Mode**: Selected items appear as inline chips inside the textarea (e.g., "Dashboard ✕", "Mobile ✕")

#### Dropdown / Select
- **Single Select**: One value shown, chevron down, list opens below
- **Multi Select**: Multiple values as chips inside trigger, checkboxes in list items
- **Searchable**: Search input at top of dropdown panel
- **Dropdown Panel**: `shadow-medium`, white bg, border `grey-100`, border-radius 8px, max-height 240px with scroll
- **Item Height**: 40px
- **Item Padding**: 12px 16px
- **Item Hover**: `grey-0` background
- **Item Selected**: `primary-50` background, checkmark icon on right

#### Checkbox
- **Size**: 16px × 16px
- **Border**: 1px `grey-200`, radius 4px
- **Checked**: `primary-500` fill with white checkmark
- **Indeterminate**: `primary-500` fill with white horizontal line
- **Disabled**: `grey-100` fill, `grey-300` checkmark

#### Radio Button
- **Size**: 16px × 16px
- **Border**: 1px `grey-200`, circular
- **Selected**: Outer ring `primary-500` with inner `primary-500` dot (6px)
- **Disabled**: `grey-100` outer ring

#### Toggle (Switch)
- **Track Size**: 40px × 20px
- **Track Off**: `grey-200` background
- **Track On**: `primary-500` background
- **Thumb**: 16px white circle, shadow-small
- **Transition**: 200ms ease

---

### 6.5 Table

#### Table Structure
- **Container**: White card background, `shadow-small`, border-radius 8px
- **Toolbar** (top of table): Title left, Search + Filter + Sort buttons right
- **Header Row**: `grey-0` background, text `grey-400` 12px Medium, uppercase, letter-spacing 0.5px
- **Header Height**: 40px
- **Row Height**: 56px
- **Row Padding**: 12px 16px
- **Row Border**: 1px bottom border `grey-50`
- **Row Hover**: `grey-0` background
- **Row Selected**: `primary-50` background

#### Selection
- **Checkbox Column**: First column, 40px width, header has master checkbox
- **Row Checkbox**: 16px, left-aligned with 16px left padding

#### Columns
- **Sortable Header**: Click to sort, arrow icon appears (▲ ▼)
- **Column Width**: Flexible, min-width 120px
- **Text Alignment**: Left for text, right for numbers/dates, center for status/action

#### Action Column
- **Width**: 48px–64px
- **Content**: Three-dot menu icon (`⋯`) — vertical ellipsis
- **Menu**: Opens dropdown on click with actions (Edit, View, Delete, etc.)

#### Status Column
- **Content**: Dot badge or filled badge
- **Alignment**: Center or left

#### Pagination (Bottom of Table)
- **Left Side**: "Per page" dropdown (10 / 25 / 50 / 100) + "Showing X to Y of Z results" text (`grey-400`, 12px)
- **Right Side**: Page number buttons
  - Previous / Next: Chevron icons in outlined buttons
  - Page numbers: Outlined buttons, active page has `primary-500` filled background with white text
  - Ellipsis: `...` for skipped page ranges

#### Empty State
- **Icon**: Large illustration or icon (64px), `grey-200` color
- **Title**: 16px Semibold, `grey-600`
- **Description**: 14px Regular, `grey-400`
- **CTA**: Primary button to create first item (if applicable)

---

### 6.6 Card

#### Standard Card
- **Background**: White
- **Border**: 1px `grey-100` (optional, for flat look)
- **Border Radius**: 8px–12px
- **Padding**: 20px–24px
- **Shadow**: `shadow-small` (when elevated), none (when flat on grey background)

#### Stat Card / KPI Card
- **Layout**: Icon (top-left or left), Label (top), Value (large number), Trend (bottom)
- **Value Style**: 32px–48px Semibold, `grey-600`
- **Trend**: Green up-arrow + percentage for positive, Red down-arrow for negative
- **Example**: "Total Employee 649 +25.5% to last month"

#### Task / Project Card
- **Header**: Status badge top-right (e.g., "Completed"), title below
- **Meta**: Subtitle, task count, due date
- **Progress Bar**: Horizontal bar, colored track, percentage text
- **Avatars**: Overlapping avatar stack (max 3 visible, +N indicator)

---

### 6.7 Breadcrumb

- **Format**: `Module / Page Name` or `Home / Dashboard / Page`
- **Style**: 14px Regular, `grey-400`
- **Separator**: `/` or `>` character, `grey-200`
- **Active/Current**: `grey-600`, no link
- **Previous Items**: Clickable, `grey-400`, hover `primary-500`
- **Placement**: Top of content area, below header bar

---

### 6.8 Notifications

- **Bell Icon**: Top-right header, `grey-400`, 20px
- **Badge**: Red dot (8px) positioned top-right of bell when unread
- **Dropdown Panel**: `shadow-medium`, white bg, max-width 360px
- **Notification Item**: Icon + Title + Description + Timestamp, border-bottom `grey-50`
- **Unread**: Left blue border indicator (`primary-500`)
- **Read**: No left border

---

## 7. Implementation Conclusions

This section documents the **actual UI patterns** observed across the implemented screens in `Contoh implementasi/`. These are the real-world applications of the design system tokens and components.

### 7.1 Layout Patterns

#### Pattern A: Auth Layout (Login / Empty State)
- **Background**: Full-page light grey with dot pattern texture (`grey-0` base)
- **Logo**: SITKOM logo + "Sistem Informasi Teknik Komputer" centered at top
- **Card**: Centered, ~480px max-width, white bg, `shadow-medium`, border-radius 12px
- **Card Header**: Icon in circular container (e.g., user icon in `primary-50` circle), title (Heading 3), description (Body Small, `grey-400`)
- **Form**: Stacked inputs with labels, hint text below
- **Footer Links**: "Forgot Password?" right-aligned, "Don't have an account? Register" centered below button
- **Bottom Text**: Copyright "© 2026 SITKOM. All right reserved." centered at page bottom, 12px `grey-300`

#### Pattern B: Dashboard Layout (All Admin/Logged-in Screens)
- **Sidebar**: Fixed left, white bg, border-right `grey-100`
- **Content Area**: Fluid, padding 24px, `grey-0` or white background
- **Page Header Area**: Inside content area, no card
  - Breadcrumb (top)
  - Page Title (Heading 3, `grey-600`)
  - Page Description (Body Small, `grey-400`)
  - **Period Dropdown** (top-right, when applicable): Semester selector, e.g., "Semester Genap 2025/2026" dropdown
  - **Primary CTA** (top-right): "+ Tambah Penilaian", "+ Periode Baru", "Tambah User"
- **Content Card**: White card, `shadow-small`, contains the table or form

### 7.2 Table Patterns (Dominant Content Pattern)

Tables are the primary content container across **8 of 10** implementation screens.

#### Standard CRUD Table
- **Card Title**: "Tabel Komponen", "Period Table", "Tabel Dokumen", "User Table" — Heading 5 style
- **Toolbar**:
  - Left: Card title
  - Right: Search input (with magnifying glass) + Filter button (outlined) + Sort by button (outlined)
- **Columns**: Checkbox (40px) + Data columns + Status column + Action column (48px)
- **Rows**: 56px height, alternating subtle hover state
- **Status Column**: Dot badges ("Aktif" = green, "Nonaktif" = grey)
- **Action Column**: Three-dot menu `⋯`
- **Pagination**: Standard pagination bar at bottom

#### Expandable Row Table (Periode Screen)
- **Expand Icon**: Chevron right `›` (collapsed) / Chevron down `⌄` (expanded)
- **Expanded Content**: Inner card with detailed metadata (Tanggal Fase, Konfigurasi Group) in 2-column layout
- **Expanded Background**: `grey-0` (#F8F9FB) to visually nest the detail

#### Two-Panel Table (Edit Tipe Penilaian)
- **Left Panel**: Summary card
  - Title: "Ringkasan"
  - Stats: Total Komponen (number), Total Bobot (badge)
  - Selected items list: Small table with Kode + Bobot badge
- **Right Panel**: Component picker table
  - Same standard table pattern but with checkboxes for selection
  - Selected rows have checkmark in checkbox
- **Sticky Action**: "Simpan" primary button fixed top-right of page

### 7.3 Badge Semantics (Observed in Production)

The system applies strict color-to-meaning mapping:

| Badge Text | Color | Style | Meaning |
|---|---|---|---|
| `Aktif` | Teal (`success-100`) | Dot badge | Active record, active period |
| `Nonaktif` | Grey (`grey-300`) | Dot badge | Inactive record, disabled period |
| `Admin` | Red (`error-100`) | Filled badge | Administrator role |
| `Dosen` | Teal (`success-100`) | Filled badge | Lecturer role |
| `Mahasiswa` | Yellow/Orange (`warning-100`) | Filled badge | Student role |
| `Alumni` | Yellow/Orange (`warning-100`) | Filled badge | Alumni role |
| `50%`, `25%`, `10%` | Red / Yellow / Teal | Filled badge | Evaluation weight values |
| `100%` | Teal (`success-100`) | Filled badge | Total weight complete |

### 7.4 Button Hierarchy (Observed in Production)

#### Primary CTA Placement
- **Always top-right** of the content area or inside the card header
- **Color**: Primary dark blue (`primary-500`) filled button
- **Icon**: Plus `+` icon left of text for creation actions
- **Examples**: "+ Tambah Penilaian", "+ Periode Baru", "+ Tambah User", "Simpan"

#### Secondary Actions
- **Placement**: Left of primary CTA or below page title
- **Style**: Outlined or ghost button
- **Examples**: "Import Users" (outlined, with upload icon), "Kembali" (outlined, with left arrow)

#### Special Actions
- **"Gunakan konfigurasi bawaan"**: Primary button with gear icon, used for applying default configs
- **"Salin Penilaian"**: Dropdown field to copy configuration from another period

### 7.5 Form Patterns (Observed in Production)

#### Standard Form
- **Label + Input + Hint** vertical stack
- **Required fields**: Red asterisk `*` after label
- **Error state**: Red border + red hint text (observed in Login validation)
- **Password field**: Eye icon on right for visibility toggle

#### Filter / Config Form
- **Dropdown selectors** for period/semester selection
- **Hint text below**: "Salin seluruh konfigurasi penilaian dari periode lain." — 12px `grey-300`

### 7.6 Page Header Pattern

Every dashboard page follows this header structure (from top to bottom):
1. **Breadcrumb**: "SICATA / Bank Asesmen" — 14px Regular, `grey-400`
2. **Page Title**: "Bank Asesmen" — Heading 3 (32px Semibold), `grey-600`
3. **Page Description**: "Kelola template master komponen penilaian (CPMK/CPL) yang dapat digunakan di berbagai periode." — 14px Regular, `grey-400`
4. **Actions Row** (right-aligned, same line as title):
   - Period dropdown (if applicable)
   - Primary CTA button

### 7.7 Sidebar Navigation Pattern

#### Menu Groups
- **Main Menu**: Dashboard
- **Admin**: Master Data (expandable), Evaluation Setup (expandable)
- **Management**: Finalisasi, Schedule, Expo, Sidang TA
- **Analytics**: Reports, Grade Check, Grade Config, Peer Review
- **System**: Settings, Help & Center, Logout

#### Visual States
- **Active Parent**: Left border `primary-500`, background `primary-50`, text `grey-600` Semibold
- **Active Child**: Same as parent, indented 16px
- **Inactive**: Text `grey-400`, Regular weight, no border
- **Hover (Inactive)**: Background `grey-0`, text `grey-500`
- **Logout**: Bottom item, text `error-100`, icon left

### 7.8 User Profile Header
- **Avatar**: 32px–40px circular image or initials
- **Name**: "Robert Johnson" / "Super Admin" — 14px Semibold, `grey-600`
- **Role**: "Super Admin" — 12px Regular, `grey-400`
- **Placement**: Top-right of header bar

---

## 8. Patterns & Rules

### 8.1 Shadow Usage Rules
| Context | Shadow Token |
|---|---|
| Inline badges, small chips | `shadow-xsmall` |
| Cards, buttons (elevated), inputs (focused) | `shadow-small` |
| Dropdown menus, popovers, date pickers, tooltips | `shadow-medium` |
| Modals, confirmation dialogs, image previews | `shadow-large` |
| Drawers (slide-in panels), mobile bottom sheets | `shadow-xlarge` |
| Toast notifications, critical alerts, blocking overlays | `shadow-xxlarge` |

### 8.2 Button Hierarchy Rules
1. **Only one primary CTA** per page/section.
2. Secondary actions use outlined or ghost style.
3. Danger actions (delete, remove) use red variant, placed away from primary CTA.
4. Icon buttons are used for compact toolbars (table actions, filter bar).

### 8.3 Badge Color-to-Meaning Rules
- **Green/Teal**: Active, success, online, "Dosen", completed
- **Yellow/Orange**: Warning, pending, "Mahasiswa", "Alumni", partial completion
- **Red**: Error, danger, admin, destructive, high-priority alert
- **Grey**: Inactive, offline, draft, default, disabled
- **Navy**: Primary highlight, featured, important tag

### 8.4 Table Empty-State Rules
- Show illustration + title + description when zero rows.
- Provide a primary CTA to create the first item if user has permission.
- Do not show pagination when empty.

### 8.5 Form Validation Rules
- Validate on **blur** for individual fields.
- Validate on **submit** for the entire form.
- Error message: 12px Regular, `error-100`, placed directly below the input.
- Input border turns `error-100` with `error-0` background.
- Success state (optional): Checkmark icon inside input right side.

### 8.6 Spacing Consistency Rules
- Page padding: 24px minimum on all sides.
- Card internal padding: 20px–24px.
- Gap between cards: 16px.
- Gap between form fields: 16px–20px.
- Gap between label and input: 8px.
- Gap between input and hint/error: 4px.

---

## 9. Responsive & Native

### 9.1 iOS Status Bar
- **Light Mode**: Black text on white background, shows time (9:41), signal, Wi-Fi, battery
- **Dark Mode**: White text on black background
- **Height**: 44px (iPhone with notch), 20px (legacy)

### 9.2 Home Indicator
- **Light Mode**: Black horizontal bar centered at bottom
- **Dark Mode**: White horizontal bar centered at bottom
- **Height Area**: 34px safe area at bottom

### 9.3 Keyboards
- **QWERTY Keyboard**: Light and dark variants, standard iOS layout
  - Key background: `grey-25` (light) / `grey-700` (dark)
  - Key text: `grey-600` (light) / white (dark)
  - Special keys (shift, delete, go): `grey-0` or `primary-500` accent
- **Numeric Keyboard**: Light and dark variants, standard iOS dial pad layout
- **Autocomplete Bar**: Shows suggestions above keyboard (e.g., "Design", "Designed", "Designer")

### 9.4 Segmented Control
- **Background**: `grey-100` rounded container
- **Active Segment**: White background, `grey-600` text, `shadow-xsmall`
- **Inactive Segment**: Transparent background, `grey-400` text
- **Border Radius**: 8px for container, 6px for individual segments
- **Usage**: Switching between 2–4 views (e.g., light/dark mode, list/grid)

### 9.5 Responsive Breakpoints
| Breakpoint | Width | Layout Change |
|---|---|---|
| **Mobile** | < 640px | Sidebar collapses to hamburger menu, cards stack vertically, tables become horizontal scroll |
| **Tablet** | 640px–1024px | Sidebar collapsible (icon-only mode), 2-column grids |
| **Desktop** | > 1024px | Full sidebar expanded, multi-column layouts, full table view |

---

## 10. Asset Index

### Design System Reference Assets

| # | File Name | Category | Description |
|---|---|---|---|
| 1 | `Colors.png` | Tokens | Complete color palette: Primary, Greyscale, Sky, Success, Warning, Error |
| 2 | `Primary.png` | Tokens | Primary color scale (50–500) with exact hex values |
| 3 | `Greyscale.png` | Tokens | Greyscale color scale (0–900) with exact hex values |
| 4 | `Typography.png` | Tokens | Inter Tight font, weights, heading sizes, body sizes |
| 5 | `Shadow.png` | Tokens | Shadow elevation tokens: XSmall through XXLarge |
| 6 | `Avatar.png` | Components | Avatar base (28 portraits), 7 sizes, 3 types, status indicators |
| 7 | `Badges.png` | Components | Badge colors (5), styles (filled/outlined), dot and dismissible variants |
| 8 | `Button.png` | Components | Button variants (5), sizes (4), states, icon buttons, social buttons |
| 9 | `Forms.png` | Components | Inputs, textareas, dropdowns, checkbox, radio, toggle |
| 10 | `Components.png` | Patterns | Dashboard, sidebar, lists, table headers, calendar, cards, stat cards |
| 11 | `Native.png` | Native | iOS status bar, home indicator, keyboards, segmented control |
| 12 | `Logos & Cursor.png` | Assets | Brand logos grid, cursor types |

### Implementation Example Assets (`Contoh implementasi/`)

| # | File Name | Screen | Key Patterns Observed |
|---|---|---|---|
| 1 | `1. Login - Empty State.png` | Login | Auth layout, centered card, patterned bg, form validation |
| 2 | `Bank Asesmen.png` | CRUD Table | Standard table with CPL items, status badges, pagination, toolbar |
| 3 | `Periode - Detail dropdown.png` | Expandable Table | Expandable rows with phase details, status Aktif/Nonaktif |
| 4 | `Periode.png` | Table List | Collapsed rows, standard table layout |
| 5 | `Persyaratan Dokumen.png` | CRUD Table | Document requirements table, default config CTA |
| 6 | `Tipe Penilaian-1.png` | Edit Form | Two-panel layout: summary + component picker table |
| 7 | `Tipe Penilaian-2.png` | Edit Form | Peer Review variant of two-panel layout |
| 8 | `Tipe Penilaian-3.png` | Edit Form | Another variant of component selection |
| 9 | `Tipe Penilaian.png` | List Table | Evaluation type list with component count |
| 10 | `User Management.png` | User Table | Avatar + name + email + role badges + date |

---

## 11. Quick Reference for Developers

### Tailwind CSS Mapping (Frontend Context)
The frontend uses **Tailwind CSS v4** and **Shadcn UI**. Use the tokens below as CSS custom properties or Tailwind config extensions.

```css
/* Example CSS Variables */
:root {
  --primary-500: #293C79;
  --grey-600: #353849;
  --success-100: #40C4AA;
  --error-100: #DF1C41;
  --warning-100: #FFBD4C;
  --sky-100: #33CFFF;
  --shadow-small: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-medium: 0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);
}
```

### Shadcn UI Theme Variables
Map the color tokens to Shadcn's CSS variables in `globals.css`:
- `--primary` → `primary-500`
- `--muted` → `grey-100`
- `--accent` → `primary-50`
- `--destructive` → `error-100`
- `--success` → `success-100`
- `--warning` → `warning-100`
- `--border` → `grey-100`
- `--input` → `grey-100`
- `--ring` → `primary-300`

---

*Document generated from analysis of all design system assets and implementation screenshots in the `Design system/` folder.*

*Last updated: June 2026*
