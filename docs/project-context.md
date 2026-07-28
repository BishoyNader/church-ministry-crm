Project: Church Ministry CRM

Stack:
- Next.js 16
- TypeScript
- Supabase
- React Query
- shadcn/ui
- Tailwind CSS
- next-intl

Database Facts:

roles:
- id
- church_id
- role_type
- name_ar
- name_en
- description_ar
- is_system

permissions:
- id
- code
- name_ar
- name_en
- module

role_permissions:
- role_id
- permission_id

user_roles:
- church_id
- user_id
- role_id

RBAC:
- permissions are assigned to roles
- roles are assigned to users
- user can have multiple roles
- church scoped

Important:
Never invent columns.
Always use existing migrations as source of truth.