la2028-scheduler/
├── app/ # Routes (pages + API endpoints)
│ ├── layout.tsx # Root layout (html, body, providers, global nav)
│ ├── globals.css # Tailwind directives + global custom styles
│ ├── page.tsx # Landing page at "/"
│ ├── api/ # API route handlers
│ │ └── ... # (we'll build these route by route)
│ └── ... # (page routes, built incrementally)
│
├── components/ # Shared React components used across pages
│ └── ui/ # shadcn/ui components (auto-generated here)
│
├── lib/ # Shared server-side logic
│ ├── db/ # Drizzle schema, connection, query functions
│ ├── algorithm/ # Scoring, combos, conflicts, windows, runner
│ ├── validations/ # Zod schemas
│ ├── auth.ts # Auth helpers (getCurrentUser, etc.)
│ └── utils.ts # General utilities (cn() helper, etc.)
│
├── scripts/ # Data pipeline (not part of the app)
│ ├── raw/ # Source PDF, raw data files
│ ├── clean_sessions.py # Your existing cleaning scripts
│ ├── get_travel_times.py
│ └── output/ # Cleaned CSVs ready for seeding
│
├── drizzle/ # Generated migration files (drizzle-kit output)
│
├── tests/ # Test files mirroring lib/ structure
│
├── proxy.ts # Auth middleware (single file, project root)
├── drizzle.config.ts # Drizzle configuration
├── tailwind.config.ts # Tailwind configuration
├── next.config.ts # Next.js configuration
├── tsconfig.json # TypeScript configuration
├── package.json
└── .env.local # Environment variables (DB URL, Supabase keys)
