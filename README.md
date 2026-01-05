# Pulse

A modern, cross-device task manager with Dashboard, Projects, and Covey Matrix views. Built with Next.js 14+, Supabase, and a clean blue-accented UI.

## Features

### Core Features (v1)
- **Authentication**: Email/password + Google OAuth (configure-ready)
- **Dashboard Views**: Daily, Weekly, and Monthly views with filters
- **Projects**: Organize tasks by project with drag-and-drop reordering
- **Covey Matrix**: 2x2 urgent/important prioritization with drag-and-drop
- **Task Pages**: Notion-style rich editor with image uploads
- **Cloud Sync**: All data persists across devices via Supabase

### Task Properties
- Title (required)
- Due date (required)
- Duration estimate (e.g., "15m", "1h", "2h30m")
- Priority (high/medium/low)
- Status (open/in_progress/blocked/completed/archived)
- Urgent/Important flags for Covey Matrix
- Rich notes with TipTap editor

### Coming Soon (v2)
- Google Calendar integration
- SMS reminders

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Database**: Supabase (PostgreSQL + RLS)
- **Storage**: Supabase Storage for attachments
- **Auth**: Supabase Auth
- **Editor**: TipTap
- **Drag & Drop**: dnd-kit
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### 1. Clone and Install

```bash
cd pulse
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API to get your credentials
3. Create `.env.local` from the template:

```bash
cp .env.local.example .env.local
```

4. Fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Run Database Migrations

1. Open the Supabase SQL Editor
2. Run the migration files in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_storage_bucket.sql`

3. Create the storage bucket manually:
   - Go to Storage in Supabase Dashboard
   - Click "New Bucket"
   - Name it `task-attachments`
   - Keep it as a private bucket

### 4. Configure Authentication (Optional)

For Google OAuth:

1. Go to Supabase Authentication > Providers
2. Enable Google
3. Add your Google OAuth credentials
4. Set redirect URL to `http://localhost:3000/callback` for development

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── (app)/              # Authenticated routes
│   │   ├── dashboard/      # Main dashboard with views
│   │   ├── projects/       # Projects view
│   │   ├── matrix/         # Covey Matrix view
│   │   ├── tasks/[id]/     # Task detail page
│   │   └── settings/       # User settings
│   ├── (auth)/             # Auth routes
│   │   ├── login/
│   │   ├── signup/
│   │   └── callback/
│   └── actions/            # Server actions
│       ├── projects.ts
│       └── tasks.ts
├── components/
│   ├── layout/             # Navbar, etc.
│   ├── tasks/              # Task components
│   ├── projects/           # Project components
│   ├── matrix/             # Covey Matrix components
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── supabase/           # Supabase clients
│   ├── utils.ts            # Utilities
│   └── validations.ts      # Zod schemas
└── types/
    └── database.ts         # TypeScript types
```

## Database Schema

### Tables

- **profiles**: User timezone preferences
- **projects**: Task groupings with colors
- **tasks**: Task data with due dates, priorities, status
- **task_events**: (v2) External calendar sync

### Row Level Security

All tables have RLS enabled. Users can only access their own data via `auth.uid()`.

## Definition of Done

- [x] User can sign up / log in (email + password)
- [x] User can create, edit, delete projects
- [x] User can create, edit, delete, complete tasks
- [x] Dashboard shows daily/weekly/monthly views
- [x] Tasks can be filtered by project and status
- [x] Projects view shows task counts and progress
- [x] Drag-and-drop reordering works in all views
- [x] Covey Matrix shows 2x2 quadrants
- [x] Tasks can be dragged between quadrants
- [x] Task detail page has rich text editor
- [x] Images can be uploaded to task notes
- [x] Data syncs across devices
- [x] Responsive on mobile and desktop

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Environment Variables for Production

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Update Supabase Auth redirect URLs for your production domain.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT
