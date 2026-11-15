// Checked against the linked official sources on 2026-11-15.
// Keep pricing qualifiers beside the figures whenever this data is displayed.
export const comparisonDate = 'November 15, 2026';
export const comparisonSources = [
  { label: 'Skool pricing', href: 'https://www.skool.com/pricing' },
  { label: 'Skool feature documentation', href: 'https://help.skool.com/' },
  { label: 'Skool live calls', href: 'https://help.skool.com/article/210-how-to-go-live-on-skool' },
  { label: 'Circle pricing & features', href: 'https://circle.so/pricing' },
];

export const ownershipRows = [
  { feature: 'Software / platform price', roost: '$0 license fee', skool: '$9/mo Hobby · $99/mo Pro', circle: '$89/mo, billed annually' },
  { feature: 'Hosting & maintenance', roost: 'You choose and operate the stack', skool: 'Managed by Skool', circle: 'Managed by Circle' },
  { feature: 'Source code', roost: 'MIT licensed · fork and modify', skool: 'Proprietary service', circle: 'Proprietary service' },
  { feature: 'Database & file storage', roost: 'Your database and storage providers', skool: 'Vendor-managed infrastructure', circle: 'Vendor-managed infrastructure' },
  { feature: 'Customization', roost: 'Brand settings + full source access', skool: 'Platform settings', circle: 'Brand settings + custom CSS / JS' },
];

export const featureRows = [
  { feature: 'Community discussions', roost: 'Posts, comments & reactions', skool: 'Included', circle: 'Included' },
  { feature: 'Courses & learning', roost: 'Classrooms, modules & lessons', skool: 'Included', circle: 'Included' },
  { feature: 'Events & calendar', roost: 'Calendar views & RSVPs', skool: 'Included', circle: 'Included' },
  { feature: 'Direct messaging', roost: 'One-to-one messages & images', skool: 'Included', circle: 'Included' },
  { feature: 'Community recognition', roost: 'Points & leaderboards', skool: 'Points, levels & leaderboards', circle: 'Gamification' },
  { feature: 'Admin & moderation', roost: 'Roles, bans & content tools', skool: 'Included', circle: 'Included' },
  { feature: 'Live video', roost: 'External video embed + live chat', skool: 'Native live calls', circle: 'Native streams & live rooms' },
  { feature: 'Paid memberships', roost: 'Optional Stripe integration*', skool: 'Built-in payments', circle: 'Built-in payments' },
];
