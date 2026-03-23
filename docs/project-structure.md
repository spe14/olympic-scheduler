la2028-scheduler/
├── app/ # Routes (pages + server actions)
│ ├── layout.tsx # Root layout (html, body, providers, global nav)
│ ├── globals.css # Tailwind directives + global custom styles
│ ├── page.tsx # Landing page at "/"
│ ├── (main)/ # Authenticated routes
│ │ ├── groups/
│ │ │ └── [groupId]/
│ │ │ ├── \_components/ # Shared group components (shell, header, modals)
│ │ │ ├── preferences/ # Preference wizard (buddies, sports, sessions)
│ │ │ ├── schedule/ # My Schedule page + purchase actions
│ │ │ ├── group-schedule/ # Group Schedule page
│ │ │ ├── purchase-tracker/ # Ticket Purchases page (Phase 2)
│ │ │ ├── actions.ts # Group-level server actions (generate, members, etc.)
│ │ │ └── page.tsx # Overview page
│ │ └── ...
│ └── ...
│
├── components/ # Shared React components used across pages
│ └── ui/ # shadcn/ui components (auto-generated here)
│
├── lib/ # Shared server-side logic
│ ├── db/ # Drizzle schema, connection
│ ├── algorithm/ # Scoring, combos, filter, travel, window-ranking, runner
│ ├── queries/ # Shared data queries (getGroupDetail, etc.)
│ ├── validations/ # Zod schemas
│ ├── constants.ts # App constants (MAX_GROUP_MEMBERS, avatar colors, etc.)
│ ├── auth.ts # Auth helpers (getCurrentUser, getMembership, etc.)
│ ├── types.ts # Shared TypeScript types (GroupDetail, ActionResult, etc.)
│ └── utils.ts # General utilities (cn() helper, etc.)
│
├── scripts/ # Data pipeline (not part of the app)
│ ├── raw/ # Source PDF, raw data files
│ ├── clean_sessions.py # Session data cleaning scripts
│ ├── get_travel_times.py
│ └── output/ # Cleaned CSVs ready for seeding
│
├── drizzle/ # Generated migration files (drizzle-kit output)
│
├── tests/ # Test files mirroring app/ structure
│
├── docs/ # Project documentation
│
├── proxy.ts # Next.js middleware entry (delegates to lib/supabase/proxy.ts)
├── drizzle.config.ts # Drizzle configuration
├── tailwind.config.ts # Tailwind configuration
├── next.config.ts # Next.js configuration
├── tsconfig.json # TypeScript configuration
├── package.json
└── .env.local # Environment variables (DB URL, Supabase keys)
