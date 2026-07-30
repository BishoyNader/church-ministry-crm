# Design System Requirements — Church Ministry Platform

**Version:** 1.0  
**Stack:** Tailwind CSS 4 + shadcn/ui + next-intl (i18n) + Recharts (charts)

---

## 1. Visual Identity

### 1.1 Color Palette

**Primary — Blue/Teal (sacred, calm, trustworthy)**
| Token | Hex | Usage |
|-------|-----|-------|
| `--primary-50` | #EFF6FF | Background hover |
| `--primary-100` | #DBEAFE | Selected state |
| `--primary-200` | #BFDBFE | Border light |
| `--primary-300` | #93C5FD | |
| `--primary-400` | #60A5FA | |
| `--primary-500` | #3B82F6 | Main CTA, buttons |
| `--primary-600` | #2563EB | Button hover |
| `--primary-700` | #1D4ED8 | Active state |
| `--primary-800` | #1E3A8A | |
| `--primary-900` | #172554 | |

**Neutral — Warm gray**
| Token | Hex |
|-------|-----|
| `--neutral-50` | #FAFAF9 |
| `--neutral-100` | #F5F5F4 |
| `--neutral-200` | #E7E5E4 |
| `--neutral-300` | #D6D3D1 |
| `--neutral-400` | #A8A29E |
| `--neutral-500` | #78716C |
| `--neutral-600` | #57534E |
| `--neutral-700` | #44403C |
| `--neutral-800` | #292524 |
| `--neutral-900` | #1C1917 |

**Semantic**
| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | #10B981 | Present, completed |
| `--warning` | #F59E0B | Absent, overdue |
| `--danger` | #EF4444 | Deactivated, error |
| `--info` | #3B82F6 | Notification, info |

**Dark mode (future)**
- Same palette, inverted background/text
- Surface: `#1C1917` → `#292524`
- Text: `#FAFAF9` → `#E7E5E4`
- Not implemented in MVP, but design tokens must exist

### 1.2 Typography

**Font stack:**
- Arabic: `'Noto Sans Arabic', 'Tajawal', system-ui, sans-serif`
- English: `'Inter', system-ui, sans-serif`

**Type scale (Tailwind defaults):**
| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-xs` | 0.75rem | 1rem | Caption, metadata |
| `text-sm` | 0.875rem | 1.25rem | Helper, secondary |
| `text-base` | 1rem | 1.5rem | Body |
| `text-lg` | 1.125rem | 1.75rem | Large body |
| `text-xl` | 1.25rem | 1.75rem | Section heading |
| `text-2xl` | 1.5rem | 2rem | Page title |
| `text-3xl` | 1.875rem | 2.25rem | Hero heading |

**Font weight:**
| Token | Usage |
|-------|-------|
| `font-normal` (400) | Body |
| `font-medium` (500) | Buttons, labels |
| `font-semibold` (600) | Section headings |
| `font-bold` (700) | Page titles |

**RTL text alignment:**
- All text containers: `text-start` (not `text-left`) to auto-flip
- Headings: `text-start`
- Data tables: column alignment aware of locale

### 1.3 Spacing & Layout

| Token | Value | Usage |
|-------|-------|-------|
| `space-2` | 0.5rem | Icon + text gap |
| `space-3` | 0.75rem | Form field gap |
| `space-4` | 1rem | Card padding |
| `space-6` | 1.5rem | Section gap |
| `space-8` | 2rem | Page padding |
| `space-12` | 3rem | Large section gap |

**Grid:**
- Main content: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- Forms: `max-w-2xl`
- Data tables: full width within container
- Dashboard widgets: responsive grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

**Breakpoints:**
| Breakpoint | Width | Behavior |
|------------|-------|----------|
| `sm` | 640px | Stack layout → 2 columns |
| `md` | 768px | Sidebar visible, bottom nav hidden |
| `lg` | 1024px | 3+ column grids |
| `xl` | 1280px | Max container width |

---

## 2. Component Design (shadcn/ui overrides)

### 2.1 Button
- Variants: `default` (primary), `secondary`, `outline`, `ghost`, `destructive`
- Sizes: `sm`, `default`, `lg`
- States: hover, active, disabled, loading (spinner + disabled)
- Must support RTL (icon positioning flips)
- Icon button variant for actions (trash, edit, etc.)

### 2.2 Input
- Variants: `default`, `error` (red border)
- All inputs: RTL-aware (`dir="auto"` for mixed content)
- Floating labels: NOT used (too complex for RTL)
- Standard label above input, error below
- Character limit indicator for long text fields

### 2.3 Select
- Searchable variant required for:
  - Stage selector (may have 50+ stages)
  - Servant selector (may have 200+ servants)
  - Beneficiary selector
- Native select for simple options (status, role)
- RTL: dropdown opens on correct side

### 2.4 Date Picker
- Use shadcn/ui date picker (uses react-day-picker)
- Locale: next-intl locale passed to DatePicker
- Arabic locale support (Gregorian calendar with Arabic month names)
- Default: today

### 2.5 Data Table
- Sortable columns (click header → ASC → DESC → none)
- Pagination: "Showing 1–10 of 45" + prev/next
- Row count selector: 10, 25, 50
- Row actions: menu with Edit, Delete (with confirm), Deactivate
- Selected rows: checkbox + bulk action bar
- Empty state: illustration + message + "Create first" button
- Loading: skeleton rows (8 rows)
- Responsive: horizontal scroll on mobile, sticky first column

### 2.6 Card
- `rounded-lg`, `bg-white`, `border`, `p-4`
- Optional header with title + action button
- Optional footer with metadata or secondary actions
- Shadow: `shadow-sm` (subtle, not floating)
- Hover: NOT raised (no card lift effect)

### 2.7 Dialog / Modal
- Variants: confirm (with danger CTA), form (wide), info
- Backdrop: `bg-black/50`, click outside closes (except confirm)
- Confirm dialog: title, message, cancel + confirm buttons
- Form dialog: full form, submit button in footer
- Scrollable body if content exceeds viewport

### 2.8 Toast / Notification
- Position: `top-4 right-4` (LTR), `top-4 left-4` (RTL)
- Variants: success, error, warning, info
- Auto-dismiss: 5s (success), persistent (error)
- Stack: multiple toasts stack downward
- Action: undo button where applicable

### 2.9 Sidebar Navigation
- Collapsible (hamburger toggle)
- Active link: `bg-primary-50 text-primary-700 font-medium`
- Icons on left (LTR) / right (RTL)
- Section dividers with labels
- Bottom section: settings, logout
- Mobile: hidden, replaced by bottom nav

### 2.10 Bottom Navigation (Mobile)
- Visible below `md` breakpoint
- 5 icons: Dashboard, Servants, Beneficiaries, Attendance, More (menu)
- Active: primary color
- Fixed to bottom, safe area padding

---

## 3. form-field Component Specification

Create a `form-field` SFC (or reusable pattern) that all form pages use:

```
<form-field>
  <Label>  ← slot: label text (required)
  <Input / <Select / <DatePicker />  ← slot: field control
  <Error>  ← slot: error message (conditional)
</form-field>
```

**Props:**
- `name`: string — maps to form field name
- `label`: string — visible label
- `required`: boolean — shows `*` indicator
- `error`: string | null — validation error message
- `dir`: 'ltr' | 'rtl' | 'auto' — text direction override

Layout:
- Label above field (not floating, not left-aligned)
- Error below field (red text)
- Required indicator: red `*` next to label
- Width: `w-full` by default

---

## 4. Empty State

Every list page must handle empty state:

```
┌─────────────────────────────────────┐
│              [illustration]          │
│       No {entity} yet                │
│  {description of what to do}         │
│  ┌─────────────────────┐             │
│  │  Create first {entity} │          │
│  └─────────────────────┘             │
└─────────────────────────────────────┘
```

- Illustration: simple SVG icon (48x48 or 64x64), `text-neutral-400`
- Title: `text-lg font-semibold text-neutral-600`
- Description: `text-sm text-neutral-500`
- CTA button: `primary` variant
- Position: centered in the content area

---

## 5. Loading Skeleton

Every page must show skeleton during loading:

```
┌─────────────────────────────────────┐
│  ┌───────────┐  ┌──────────────────┐│
│  │           │  │  h-4 w-48        ││
│  │  h-8 w-8  │  │  h-4 w-32        ││
│  │           │  │  h-4 w-56        ││
│  └───────────┘  └──────────────────┘│
│  ┌──────────────────────────────────┐│
│  │  h-12 ─────────────────────     ││
│  │  h-12 ─────────────────────     ││
│  │  h-12 ─────────────────────     ││
│  └──────────────────────────────────┘│
└─────────────────────────────────────┘
```

- Use `animate-pulse bg-neutral-200 rounded`
- Match the layout structure of the actual page
- Data tables: 8 skeleton rows
- Cards: skeleton card matching card dimensions
- Dashboard widgets: skeleton card with colored header bar

---

## 6. RTL-Direction Mapping Table

| Component | LTR | RTL |
|-----------|-----|-----|
| Sidebar | Left | Right |
| Chevron in breadcrumb | `→` | `←` |
| Arrow icon in nav | `→` | `←` |
| Notification bell | Right | Left |
| User menu | Right | Left |
| Search icon in input | Left | Right |
| Submit button icon | Right | Left |
| Pagination prev/next | prev← →next | →prev next← |
| Dialog close X | Top right | Top left |
| Form labels | Left-aligned | Right-aligned |
| Table header text | Left | Right |
| Table numeric columns | Right | Right (no change) |

---

## 7. Accessibility

- All interactive elements must have `focus-visible` ring
- Color contrast: all text meets WCAG AA (4.5:1)
- Form fields: associated `<label>` elements
- Error messages: `aria-invalid` on input, `aria-describedby` linking to error
- Icons: `aria-hidden="true"` with `sr-only` text
- Navigation: `aria-current="page"` on active link
- Skip to content link (first focusable element)
- Toast notifications: `role="alert"`
- Modals: focus trap, `role="dialog"`, `aria-labelledby` for title

---

## 8. Dark Mode Preparation (not MVP)

- All colors referenced via CSS variables (not hardcoded hex)
- `class="dark"` toggle on `<html>`
- Dark variant tokens ready:
  - `dark:bg-neutral-900` for surfaces
  - `dark:text-neutral-100` for text
  - `dark:border-neutral-700` for borders
- NOT implemented in MVP but must be easy to add later

---

## 9. Icon Set

- Use `lucide-react` (shadcn/ui default)
- Required icons:
  - Layout: `LayoutDashboard`, `Users`, `UserPlus`, `Church`, `CalendarCheck`, `ClipboardList`, `BookOpen`, `Bell`, `Settings`
  - Actions: `Plus`, `Edit`, `Trash2`, `Search`, `Filter`, `ChevronDown`, `ChevronLeft`, `ChevronRight`, `ArrowUpDown`, `Check`, `X`, `Download`, `Upload`
  - Status: `CheckCircle2`, `AlertCircle`, `AlertTriangle`, `Info`, `XCircle`, `Clock`
  - Navigation: `Menu`, `Home`, `MoreHorizontal`, `LogOut`, `ChevronLeft`, `ChevronRight`
  - Data: `FileSpreadsheet`, `FileText`, `Download`, `Upload`

---

## 10. Animation Guidelines

- Page transitions: no transition (instant SSR)
- Dropdowns: `animate-in fade-in slide-in-from-top-2 duration-200`
- Modals: `animate-in fade-in zoom-in-95 duration-200`
- Toasts: `animate-in slide-in-from-right duration-300`
- Sidebar collapse: CSS transition 200ms ease
- Skeleton: `animate-pulse` (Tailwind built-in)
- Charts: `animation-duration: 1000ms` (Recharts default)
- Never: bounce, jello, flashy animations. Only subtle, functional.

---

## 11. Implementation Rules

1. **No custom CSS** — all styling via Tailwind utility classes
2. **No RTL library** — handle RTL via Tailwind `rtl:` variants and `dir="auto"`
3. **shadcn/ui components** — customize via `tailwind.config` or component variants
4. **All colors via CSS variables** — never hardcode hex in components
5. **All spacing via Tailwind tokens** — never `px-13` or arbitrary values
6. **Layout components are RSCs** — wrappers don't need interactivity
7. **Client components only where needed** — interactive islands
8. **`next-intl` navigation** — use `Link`, `useRouter`, `usePathname` from `next-intl`
9. **No `useState` for visibility** — prefer URL search params for list filters
10. **Forms use Server Actions** — `useActionState` for pending state on submit
