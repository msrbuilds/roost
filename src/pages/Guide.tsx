import { useState } from 'react';
import { APP_CONFIG } from '@/config/app';
import {
    BookOpen,
    Home,
    Users,
    MessageSquare,
    Calendar,
    Trophy,
    Settings,
    Bell,
    PenSquare,
    ChevronRight,
    CheckCircle,
    Sparkles,
    ZoomIn,
    X,
} from 'lucide-react';

// Step type with optional screenshot
interface GuideStep {
    title: string;
    description: string;
    tips: string[];
    screenshot?: {
        src: string;
        alt: string;
    };
}

interface GuideSection {
    id: string;
    title: string;
    icon: typeof Home;
    description: string;
    steps: GuideStep[];
}

// Guide section data with screenshots embedded in relevant steps
const guideSections: GuideSection[] = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        icon: Sparkles,
        description: 'Learn the basics of navigating and using the platform',
        steps: [
            {
                title: 'Set Up Your Profile',
                description: 'After signing in, click on your avatar in the top-right corner and select "Settings" to customize your profile. Add a profile picture, display name, bio, and location to help other members get to know you.',
                tips: ['Use a recognizable photo', 'Write a brief bio about your interests', 'Add your location to connect with nearby members'],
                screenshot: { src: '/guide-screenshots/settings.png', alt: 'Profile Settings Page' },
            },
            {
                title: 'Explore the Home Feed',
                description: 'The home feed shows all community posts. You can filter posts by category, see what\'s trending, and discover new content from fellow members.',
                tips: ['Use category filters to find relevant content', 'Check the sidebar for top contributors', 'Click on member avatars to view their profiles'],
                screenshot: { src: '/guide-screenshots/home-feed.png', alt: 'Home Feed' },
            },
            {
                title: 'Join Classrooms',
                description: 'Classrooms are specialized groups focused on specific topics. Browse available classrooms and join the ones that interest you to access exclusive content and discussions.',
                tips: ['Each classroom has its own feed and events', 'Some classrooms may require approval to join', 'You can leave a classroom anytime from its settings'],
                screenshot: { src: '/guide-screenshots/classrooms.png', alt: 'Classrooms Page' },
            },
        ],
    },
    {
        id: 'creating-posts',
        title: 'Creating Posts',
        icon: PenSquare,
        description: 'Share your thoughts, questions, and achievements with the community',
        steps: [
            {
                title: 'Start a New Post',
                description: 'Click the "Create Post" button or the post composer at the top of your feed. Give your post a descriptive title and select an appropriate category.',
                tips: ['Choose the right category for better visibility', 'Descriptive titles attract more engagement', 'You can post to the main feed or a specific classroom'],
                screenshot: { src: '/guide-screenshots/home-feed.png', alt: 'Post Composer on Home Feed' },
            },
            {
                title: 'Add Rich Content',
                description: 'Use the rich text editor to format your post with headings, lists, code blocks, and more. You can also embed images and videos to make your posts more engaging.',
                tips: ['Drag and drop images directly into the editor', 'YouTube and Vimeo links are automatically embedded', 'Use code blocks for sharing code snippets'],
            },
            {
                title: 'Engage with Comments',
                description: 'After posting, stay engaged by responding to comments. This builds relationships and encourages more discussion on your posts.',
                tips: ['Reply to comments to keep the conversation going', 'Use @mentions to notify specific members', 'Pin important comments as the post author'],
            },
        ],
    },
    {
        id: 'messaging',
        title: 'Direct Messaging',
        icon: MessageSquare,
        description: 'Connect privately with other community members',
        steps: [
            {
                title: 'Start a Conversation',
                description: 'Click the Messages icon in the navigation bar to access your inbox. Click "New Message" or click on a member\'s profile and select "Message" to start a conversation.',
                tips: ['Your recent conversations appear in the sidebar', 'Unread messages show a notification badge', 'You can send text, images, and files'],
                screenshot: { src: '/guide-screenshots/messages.png', alt: 'Messages Page' },
            },
            {
                title: 'Message Features',
                description: 'Messages support real-time delivery with read receipts. You can see when your message was delivered and when it was read by the recipient.',
                tips: ['Blue checkmarks indicate read messages', 'Press Enter to send, Shift+Enter for new line', 'Attach files using the paperclip icon'],
            },
        ],
    },
    {
        id: 'events-calendar',
        title: 'Events & Calendar',
        icon: Calendar,
        description: 'Discover and participate in community events',
        steps: [
            {
                title: 'Browse Events',
                description: 'Access the Calendar from the navigation bar to see all upcoming community events. Events can be community-wide or specific to a classroom you\'ve joined.',
                tips: ['Click on a date to see events for that day', 'Filter by classroom to see specific events', 'Upcoming events also appear in the sidebar'],
                screenshot: { src: '/guide-screenshots/calendar.png', alt: 'Calendar View' },
            },
            {
                title: 'RSVP to Events',
                description: 'Click on an event to see its details including time, location, description, and attendees. Click "RSVP" to confirm your attendance.',
                tips: ['You\'ll receive reminders for events you\'ve RSVP\'d to', 'See who else is attending', 'Add events to your personal calendar'],
            },
            {
                title: 'Create Events (Moderators)',
                description: 'If you\'re a classroom moderator or admin, you can create events for your community. Click on a calendar date or use the "Create Event" button.',
                tips: ['Set clear titles and descriptions', 'Include all relevant details like links or location', 'Events can be recurring or one-time'],
            },
        ],
    },
    {
        id: 'leaderboard',
        title: 'Leaderboard & Points',
        icon: Trophy,
        description: 'Track your contributions and compete with other members',
        steps: [
            {
                title: 'Earning Points',
                description: 'You earn points for various activities in the community. Points reflect your engagement and contribution to the community.',
                tips: ['Creating posts: 10 points', 'Comments: 5 points', 'Receiving reactions: 1-2 points', 'Hosting events: 15 points'],
            },
            {
                title: 'Climbing the Leaderboard',
                description: 'The leaderboard shows top contributors for the past 30 days. Consistent engagement helps you climb the ranks and gain recognition.',
                tips: ['Check your current rank on your profile', 'View the full leaderboard from the sidebar', 'Each classroom has its own leaderboard'],
                screenshot: { src: '/guide-screenshots/leaderboard.png', alt: 'Leaderboard Page' },
            },
        ],
    },
    {
        id: 'notifications',
        title: 'Notifications',
        icon: Bell,
        description: 'Stay updated on activity that matters to you',
        steps: [
            {
                title: 'Notification Types',
                description: 'You\'ll receive notifications for various activities including replies to your posts, mentions, new messages, event reminders, and more.',
                tips: ['Click the bell icon to see all notifications', 'Unread notifications show a red badge', 'Click a notification to go directly to the content'],
            },
            {
                title: 'Managing Notifications',
                description: 'Mark notifications as read individually or mark all as read. You can customize which notifications you receive in your settings.',
                tips: ['Swipe or click to mark as read', 'Use "Mark all read" to clear the badge', 'Adjust preferences in Settings > Notifications'],
                screenshot: { src: '/guide-screenshots/settings.png', alt: 'Settings Page for Notification Preferences' },
            },
        ],
    },
    {
        id: 'members',
        title: 'Member Directory',
        icon: Users,
        description: 'Discover and connect with community members',
        steps: [
            {
                title: 'Browse Members',
                description: 'Access the Members directory from the navigation bar. Browse through all community members with their profiles, and see who\'s currently online.',
                tips: ['Green dot indicates online members', 'Use search to find specific members', 'Filter by online status'],
                screenshot: { src: '/guide-screenshots/members.png', alt: 'Members Directory' },
            },
            {
                title: 'Member Profiles',
                description: 'Click on any member to view their full profile including their bio, posts, and activity. From there, you can send them a message or follow their content.',
                tips: ['See their recent posts and comments', 'View their points and rank', 'Quick actions for messaging'],
                screenshot: { src: '/guide-screenshots/profile.png', alt: 'Member Profile Page' },
            },
        ],
    },
];

// Feature card component
function FeatureCard({ icon: Icon, title, description }: { icon: typeof Home; title: string; description: string }) {
    return (
        <div className="bg-white dark:bg-surface-800 rounded-xl p-6 border border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-2">{title}</h3>
            <p className="text-sm text-surface-600 dark:text-surface-400">{description}</p>
        </div>
    );
}

// Screenshot lightbox state manager
function useScreenshotLightbox() {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    return { selectedImage, setSelectedImage };
}

// Inline screenshot component
function InlineScreenshot({
    screenshot,
    onZoom
}: {
    screenshot: { src: string; alt: string };
    onZoom: (src: string) => void;
}) {
    return (
        <button
            onClick={() => onZoom(screenshot.src)}
            className="group relative w-full mt-4 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all hover:shadow-lg"
        >
            <img
                src={screenshot.src}
                alt={screenshot.alt}
                className="w-full h-auto"
                loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-surface-800 rounded-full p-3 shadow-lg">
                    <ZoomIn className="w-5 h-5 text-surface-700 dark:text-surface-300" />
                </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="text-white text-sm font-medium">{screenshot.alt}</p>
            </div>
        </button>
    );
}

// Step card component with integrated screenshot
function StepCard({
    step,
    index,
    onZoom
}: {
    step: GuideStep;
    index: number;
    onZoom: (src: string) => void;
}) {
    return (
        <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl p-6 border border-surface-200 dark:border-surface-700">
            <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-sm">{index + 1}</span>
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold text-surface-900 dark:text-surface-100 mb-2">{step.title}</h4>
                    <p className="text-surface-600 dark:text-surface-400 text-sm mb-4">{step.description}</p>
                    <div className="space-y-2">
                        {step.tips.map((tip, tipIndex) => (
                            <div key={tipIndex} className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-surface-600 dark:text-surface-400">{tip}</span>
                            </div>
                        ))}
                    </div>

                    {/* Inline screenshot for this step */}
                    {step.screenshot && (
                        <InlineScreenshot screenshot={step.screenshot} onZoom={onZoom} />
                    )}
                </div>
            </div>
        </div>
    );
}

// Lightbox component
function Lightbox({
    selectedImage,
    onClose
}: {
    selectedImage: string | null;
    onClose: () => void;
}) {
    if (!selectedImage) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
                <X className="w-6 h-6 text-white" />
            </button>
            <img
                src={selectedImage}
                alt="Screenshot preview"
                className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
}

// Navigation sidebar for guide sections
function GuideSidebar({
    sections,
    activeSection,
    onSectionClick
}: {
    sections: GuideSection[];
    activeSection: string;
    onSectionClick: (id: string) => void;
}) {
    return (
        <nav className="space-y-1">
            {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                    <button
                        key={section.id}
                        onClick={() => onSectionClick(section.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                            isActive
                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                                : 'hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300'
                        }`}
                    >
                        <Icon className={`w-5 h-5 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400'}`} />
                        <span className="font-medium">{section.title}</span>
                        <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${isActive ? 'rotate-90' : ''}`} />
                    </button>
                );
            })}
        </nav>
    );
}

export default function Guide() {
    const [activeSection, setActiveSection] = useState('getting-started');
    const { selectedImage, setSelectedImage } = useScreenshotLightbox();

    const currentSection = guideSections.find((s) => s.id === activeSection) || guideSections[0];
    const Icon = currentSection.icon;

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        // Scroll to top of content on mobile
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl mb-4">
                    <BookOpen className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                </div>
                <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100 mb-3">
                    Platform Guide
                </h1>
                <p className="text-lg text-surface-600 dark:text-surface-400 max-w-2xl mx-auto">
                    Everything you need to know to get the most out of {APP_CONFIG.name}.
                    Learn how to connect, share, and grow with our community.
                </p>
            </div>

            {/* Quick Features Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                <FeatureCard
                    icon={Home}
                    title="Community Feed"
                    description="Share and discover posts from members"
                />
                <FeatureCard
                    icon={Users}
                    title="Classrooms"
                    description="Join topic-focused groups"
                />
                <FeatureCard
                    icon={MessageSquare}
                    title="Direct Messages"
                    description="Private conversations with members"
                />
                <FeatureCard
                    icon={Calendar}
                    title="Events"
                    description="Discover and join community events"
                />
            </div>

            {/* Main Content with Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Navigation */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24">
                        <h2 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4 px-4">
                            Guide Sections
                        </h2>
                        <GuideSidebar
                            sections={guideSections}
                            activeSection={activeSection}
                            onSectionClick={scrollToSection}
                        />
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-3">
                    <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden">
                        {/* Section Header */}
                        <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-8 text-white">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Icon className="w-7 h-7" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">{currentSection.title}</h2>
                                    <p className="text-primary-100 mt-1">{currentSection.description}</p>
                                </div>
                            </div>
                        </div>

                        {/* Steps with inline screenshots */}
                        <div className="p-8 space-y-6">
                            {currentSection.steps.map((step, index) => (
                                <StepCard
                                    key={index}
                                    step={step}
                                    index={index}
                                    onZoom={setSelectedImage}
                                />
                            ))}
                        </div>

                        {/* Navigation Footer */}
                        <div className="border-t border-surface-200 dark:border-surface-700 p-6 flex justify-between">
                            {guideSections.findIndex((s) => s.id === activeSection) > 0 ? (
                                <button
                                    onClick={() => {
                                        const currentIndex = guideSections.findIndex((s) => s.id === activeSection);
                                        if (currentIndex > 0) {
                                            scrollToSection(guideSections[currentIndex - 1].id);
                                        }
                                    }}
                                    className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4 rotate-180" />
                                    Previous Section
                                </button>
                            ) : (
                                <div />
                            )}
                            {guideSections.findIndex((s) => s.id === activeSection) < guideSections.length - 1 ? (
                                <button
                                    onClick={() => {
                                        const currentIndex = guideSections.findIndex((s) => s.id === activeSection);
                                        if (currentIndex < guideSections.length - 1) {
                                            scrollToSection(guideSections[currentIndex + 1].id);
                                        }
                                    }}
                                    className="flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors font-medium"
                                >
                                    Next Section
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <div />
                            )}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-8 bg-gradient-to-r from-surface-100 to-surface-50 dark:from-surface-800 dark:to-surface-900 rounded-2xl p-8 border border-surface-200 dark:border-surface-700">
                        <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
                            Quick Actions
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <a
                                href="/"
                                className="flex items-center gap-3 p-4 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                            >
                                <Home className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                <span className="font-medium text-surface-900 dark:text-surface-100">Go to Feed</span>
                            </a>
                            <a
                                href="/classrooms"
                                className="flex items-center gap-3 p-4 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                            >
                                <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                <span className="font-medium text-surface-900 dark:text-surface-100">Browse Classrooms</span>
                            </a>
                            <a
                                href="/settings"
                                className="flex items-center gap-3 p-4 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                            >
                                <Settings className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                <span className="font-medium text-surface-900 dark:text-surface-100">Edit Settings</span>
                            </a>
                        </div>
                    </div>

                    {/* Need Help */}
                    <div className="mt-6 text-center">
                        <p className="text-surface-500 dark:text-surface-400">
                            Still have questions?{' '}
                            <a href="/messages" className="text-primary-600 dark:text-primary-400 hover:underline">
                                Send us a message
                            </a>{' '}
                            and we'll be happy to help!
                        </p>
                    </div>
                </div>
            </div>

            {/* Lightbox for zoomed screenshots */}
            <Lightbox selectedImage={selectedImage} onClose={() => setSelectedImage(null)} />
        </div>
    );
}
