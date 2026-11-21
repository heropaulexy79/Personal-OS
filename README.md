# PERSONAL OS

**PERSONAL OS** is an AI-powered Personal Execution and Growth System designed around one philosophy:

> *"Your daily activities should be an expression of your long-term vision, not a distraction from it."*

## Tech Stack
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Recharts
- **Backend & Persistence:** Firebase Authentication, Cloud Firestore (with strict per-user `firestore.rules`), Next.js Server-Side API Routes
- **AI Engine:** **Groq API** (`llama-3.3-70b-versatile` default, configurable) with automatic, clearly labeled data-grounded Mock AI fallback when `GROQ_API_KEY` is not yet configured.

## Core Modules
1. **Overview Dashboard** — Personalized greeting, Today's Focus card, transparent & configurable Daily Execution Score, Groq AI Daily Insight, interactive schedule/task/habit/goal widgets.
2. **My Vision** — North Star statement, long-form Life Vision narrative, Core Values, and customizable Life Areas.
3. **Goals & Goal Detail** — Progress visualization, milestones, associated projects & tasks, and **AI Goal Breakdown** with explicit Review & Approve before saving.
4. **Daily Planner** — Date navigation, time-blocked schedule & list views, daily intention, and **"Plan My Day with AI"** (non-overlapping blocks, breaks, fixed-commitment preservation, deferred-task recommendations, and explicit approval).
5. **Tasks** — List, drag-and-drop Kanban, and Calendar views; smart filters (Today, Upcoming, Overdue, Completed); bulk actions; subtasks; and Global **⌘K Quick Capture** with AI parsing and ambiguity confirmation.
6. **Habits & Routines** — 7-day & 28-day interactive completion matrices, consistency metrics, pause/archive, and **"Resume Your Rhythm"** gentle restart flow.
7. **Focus** — Minimal distraction-free Pomodoro & custom focus timer, Zen Mode, task-linked sessions, automatic persistence, and daily focus targets.
8. **AI Assistant** — Full-page and contextual slide-over copilot grounded in live workspace data with explicit Approve/Dismiss action cards.
9. **Journal & Reflection** — Guided 6-prompt Daily Reflections, data-grounded **AI Weekly Review** generator (editable before saving), and free-form journal/lessons/ideas archive.
10. **Analytics** — Real-time Recharts visualizations calculated from stored data (execution score trends, daily focus hours, life-area time allocation, priority completion, goal progression, habit consistency).
11. **Settings** — Profile, working hours, workload caps, execution score weights, Light/Dark/System theme, Groq model selection, JSON export, and data deletion.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables by copying `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   - Add `GROQ_API_KEY` from [console.groq.com/keys](https://console.groq.com/keys) for live Groq AI.
   - Add `NEXT_PUBLIC_FIREBASE_*` values from your Firebase project settings for Cloud Auth & Firestore.

3. Deploy Firestore security rules (`firestore.rules`) to your Firebase project so every collection is strictly scoped to `request.auth.uid`.

4. Start the development server:
   ```bash
   npm run dev
   ```

> **Interactive Demo Mode:** You can launch the isolated Demo Workspace directly from the sign-in screen without configuring Firebase or Groq keys. Demo data is stored locally and never contaminates authenticated Firebase accounts.

