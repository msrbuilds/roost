# implementation_plan.md - Commune Project (React/Vite)

Building a clean community platform using React, TypeScript, and Vite for internal use.

## User Review Required

> [!IMPORTANT]
> This project uses **React (Vite)**, **TypeScript**, **TailwindCSS**, **Supabase**, and **AWS S3**.
> Since SEO is not a requirement, we are opting for a Single Page Application (SPA) architecture for speed and simplicity.

## Proposed Changes

### 1. Frontend Core
- **React (Vite 6)**: Modern, lightweight frontend tooling.
- **TypeScript**: For robust, type-safe development.
- **TailwindCSS**: For rapid, consistent, and minimal styling.
- **Design System**: 
    - Colors: `bg-white`, `bg-[#f8f9fa]`, `border-gray-200`.
    - Spacing/Layout: Following Commune's spacing and minimalist look.

### 2. Layout Structure (Inspired by Image)
- **TopNav**: Horizontal bar with Logo, Search (centered), Navigation Tabs (**Community, Classroom, Calendar, Members, Map, Leaderboards, About**), and Profile/Notifications.
- **Main Layout**: 2-column grid.
    - **Left/Center Column (Feed)**: 
        - Community feed with filter buttons (All, General, YouTube, etc.).
        - "Write something" trigger box.
        - Post cards with: User info, rank/role, pins, title, content preview, media, and engagement stats (likes, comments).
    - **Right Column (Sidebar)**: 
        - **About Card**: Community description and statistics (Members, Online, Admins).
        - **Leaderboard Card (30-day)**: Top members with points and badges.

### 3. Backend & Auth (Supabase)
- **Auth**: Email/Password.
- **Database (PostgreSQL)**:
    - Tables: `profiles`, `groups`, `group_members`, `posts`, `comments`, `assets`, `sessions`, `messages`, `notifications`.

### 4. File Storage (AWS S3)
- Integration via `@aws-sdk/client-s3`.
- Public/Private bucket management for assets and media.

## Verification Plan

### Automated Tests
- `npm run dev`: Verify build and Tailwind configuration.
- Storage testing: Uploading/Retrieving files from S3.

### Manual Verification
- **Aesthetic Check**: Confirm UI matches the clean Commune look (white bg, subtle borders).
- **Embedded Content**: Test YouTube/Vimeo video embeds in the Video tab.
- **Real-time**: Verify Messaging and Feed updates instantly.
