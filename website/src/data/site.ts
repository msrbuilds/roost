export const repository = "https://github.com/msrbuilds/roost";
export const version = "0.0.2";

export const guides = [
  {
    id: "self-hosted-setup",
    title: "Getting started",
    group: "Start here",
    description:
      "Choose your stack, install Roost, and create your first admin.",
  },
  {
    id: "install-script",
    title: "Interactive installer",
    group: "Start here",
    description: "Walk through configuration with the included setup script.",
  },
  {
    id: "docker-vps",
    title: "Docker on a VPS",
    group: "Deployment",
    description: "Run the frontend and API with automatic HTTPS.",
  },
  {
    id: "dockploy-vps",
    title: "Dokploy · full stack",
    group: "Deployment",
    description:
      "Self-host Roost, Supabase, and private file storage together.",
  },
  {
    id: "supabase-cloud",
    title: "Supabase Cloud",
    group: "Database",
    description: "Use managed Postgres and authentication.",
  },
  {
    id: "supabase-selfhosted",
    title: "Self-hosted Supabase",
    group: "Database",
    description:
      "Keep the database and authentication on your own infrastructure.",
  },
  {
    id: "brevo",
    title: "Transactional email",
    group: "Operations",
    description: "Deliver confirmations and password resets through Brevo.",
  },
  {
    id: "backups",
    title: "Backups & recovery",
    group: "Operations",
    description: "Keep a private offsite copy and verify it can be restored.",
  },
  {
    id: "staging-tests",
    title: "Installation tests",
    group: "Operations",
    description: "Verify permissions, email, realtime, and backup recovery.",
  },
  {
    id: "dockploy-vps-troubleshooting",
    title: "Troubleshooting",
    group: "Operations",
    description: "Diagnose installation and service startup failures.",
  },
  {
    id: "vercel",
    title: "Vercel frontend",
    group: "Other options",
    description: "Deploy the frontend separately from the backend.",
  },
  {
    id: "netlify",
    title: "Netlify frontend",
    group: "Other options",
    description: "Publish the static frontend with a separately hosted API.",
  },
  {
    id: "docker-dokploy",
    title: "Deployment guide index",
    group: "Other options",
    description: "Find the right VPS deployment guide.",
  },
] as const;

export const guideGroups = [...new Set(guides.map((guide) => guide.group))];

export const features = [
  {
    icon: "feed",
    eyebrow: "Conversation",
    title: "Give good ideas a place to land.",
    text: "Posts, comments, reactions, and rich text. A shared feed that keeps your community in the conversation.",
    items: [
      "Rich text and media",
      "Comments and reactions",
      "Member notifications",
    ],
  },
  {
    icon: "learn",
    eyebrow: "Learning",
    title: "Turn what you know into what they can do.",
    text: "Organize your knowledge into groups, classrooms, modules, and lessons that members can work through.",
    items: [
      "Public and private groups",
      "Course modules and lessons",
      "Progress tracking",
    ],
  },
  {
    icon: "people",
    eyebrow: "Connection",
    title: "Make it feel like people, not profiles.",
    text: "Help members find each other, share their work, and keep the connection going beyond the feed.",
    items: [
      "Member directory",
      "Direct messages and files",
      "Events and RSVPs",
    ],
  },
  {
    icon: "spark",
    eyebrow: "Participation",
    title: "Give your community something to build.",
    text: "Showcase projects, collect feature requests, and recognize the members who keep showing up.",
    items: [
      "Project showcases and reviews",
      "Feature requests and voting",
      "Engagement leaderboards",
    ],
  },
  {
    icon: "shield",
    eyebrow: "Control",
    title: "Your space. Your ground rules.",
    text: "Manage roles and moderation, protect private content, and make the community look like your own.",
    items: [
      "Admin and moderator roles",
      "Native two-factor authentication",
      "Community branding and settings",
    ],
  },
  {
    icon: "server",
    eyebrow: "Ownership",
    title: "A platform you can make your own.",
    text: "Read the code, change it, and run it on infrastructure you control. Roost is available under the MIT license.",
    items: [
      "React and TypeScript",
      "Supabase Cloud or self-hosted",
      "S3-compatible file storage",
    ],
  },
] as const;
