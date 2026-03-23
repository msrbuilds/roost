# Phase 10: Membership Tiers Specification

## 1. Overview
The Membership Tiers system extends the platform to support two distinct membership types:
- **Free**: Users register via the signup form with limited access
- **Premium**: Users purchase via Gumroad with full platform access

This enables community growth through free signups while maintaining premium value for paying members.

## 2. Membership Types

### Free Membership
| Feature | Access |
|---------|--------|
| Community Feed | Full access (create posts, comments, reactions) |
| Public Groups | Can join and participate |
| Premium Groups | No access (redirects to upgrade page) |
| Direct Messaging | No access (shows locked indicator) |
| Calendar | No access (premium only) |
| Activations | No access (premium only) |
| Leaderboard | Full participation |
| Profile | Full access |

### Premium Membership
| Feature | Access |
|---------|--------|
| All Free features | Yes |
| Premium Groups | Full access |
| Direct Messaging | Full access |
| Calendar | Full access |
| Activations | Full access |
| Priority Support | Yes |
| Exclusive Content | Yes |

### Admin/Moderator Override
Platform admins and moderators automatically receive premium access regardless of their `membership_type` setting.

## 3. Database Schema (Migration 029)

### Profiles Table Extension
```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS membership_type TEXT DEFAULT 'free'
  CHECK (membership_type IN ('free', 'premium'));
```

### Groups Table Extension
```sql
ALTER TABLE groups
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
```

### Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_profiles_membership_type ON profiles(membership_type);
CREATE INDEX IF NOT EXISTS idx_groups_is_premium ON groups(is_premium);
```

## 4. Database Functions

### `has_premium_access(p_user_id UUID)`
Returns boolean indicating if user has premium access.

**Logic:**
1. Check if `membership_type = 'premium'` in profiles
2. Check if user has active Gumroad subscription (via `has_active_subscription`)
3. Returns true if either condition is met

```sql
CREATE OR REPLACE FUNCTION has_premium_access(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = p_user_id AND membership_type = 'premium'
  ) OR has_active_subscription(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### `can_access_group(p_group_id UUID, p_user_id UUID)`
Returns boolean indicating if user can access a specific group.

**Logic:**
1. Check if group exists
2. If group is not premium, return true
3. If group is premium, check if user has premium access

```sql
CREATE OR REPLACE FUNCTION can_access_group(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_premium BOOLEAN;
BEGIN
  SELECT is_premium INTO v_is_premium FROM groups WHERE id = p_group_id;
  IF v_is_premium IS NULL THEN RETURN FALSE; END IF;
  IF NOT v_is_premium THEN RETURN TRUE; END IF;
  RETURN has_premium_access(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 5. Authentication Context

### AuthContext Extensions
**File:** `src/contexts/AuthContext.tsx`

**New Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `membershipType` | `'free' \| 'premium' \| null` | User's membership type from profile |
| `isPremium` | `boolean` | Computed premium access status |
| `isPremiumLoading` | `boolean` | Loading state for premium check |

**Premium Calculation:**
```typescript
const isPremium =
  membershipType === 'premium' ||
  hasActiveSubscription ||
  isPlatformAdmin ||
  isPlatformModerator;
```

### SignUp Result Type
```typescript
interface SignUpResult {
  requiresEmailConfirmation: boolean;
  email: string;
}
```

## 6. Free Signup Flow

### Signup Page
**File:** `src/pages/auth/Signup.tsx`

**Features:**
- Email/password registration form
- Username with real-time availability check (500ms debounce)
- Display name field
- Password strength indicator (5 levels: Too weak → Strong)
- Confirm password validation
- Email confirmation handling
- Premium upgrade CTA sidebar

**Username Validation:**
- Minimum 3 characters
- Only letters, numbers, underscores, hyphens
- Real-time availability check via `isUsernameAvailable()`

**Password Strength Scoring:**
| Criteria | Points |
|----------|--------|
| Length ≥ 6 | +1 |
| Length ≥ 10 | +1 |
| Mixed case | +1 |
| Contains number | +1 |
| Contains special char | +1 |

**Strength Levels:**
| Score | Label | Color |
|-------|-------|-------|
| 0 | Too weak | Red |
| 1 | Weak | Orange |
| 2 | Fair | Yellow |
| 3 | Good | Lime |
| 4 | Strong | Green |

### Email Confirmation
When Supabase email confirmation is enabled:
1. After signup, check if `data.user` exists but `data.session` is null
2. Display confirmation screen with:
   - Email sent notification
   - Next steps instructions
   - "Try again" option
   - Link back to login

## 7. Protected Routes

### ProtectedRoute Component
**File:** `src/components/auth/ProtectedRoute.tsx`

**New Props:**
```typescript
interface ProtectedRouteProps {
  redirectTo?: string;
  requireSubscription?: boolean;
  requirePremium?: boolean;  // NEW
}
```

**Logic:**
- If `requirePremium` and `!isPremium` → redirect to `/upgrade`

### Route Configuration
**File:** `src/App.tsx`

```typescript
{/* Protected routes - all authenticated users */}
<Route element={<ProtectedRoute />}>
  <Route element={<MainLayout />}>
    <Route path="/" element={<Home />} />
    <Route path="/classrooms" element={<Classrooms />} />
    {/* ... other free routes */}
  </Route>
</Route>

{/* Premium-only routes */}
<Route element={<ProtectedRoute requirePremium />}>
  <Route element={<MainLayout />}>
    <Route path="/messages" element={<Messages />} />
    <Route path="/messages/:userId" element={<Messages />} />
    <Route path="/calendar" element={<Calendar />} />
    <Route path="/activations" element={<Activations />} />
  </Route>
</Route>
```

## 8. Navigation Gating

### SideNav Component
**File:** `src/components/navigation/SideNav.tsx`

**Premium-gated Items:**
```typescript
const navItems = [
  { name: 'Messages', href: '/messages', icon: MessageSquare, premiumOnly: true },
  { name: 'Calendar', href: '/calendar', icon: Calendar, premiumOnly: true },
  { name: 'Activations', href: '/activations', icon: Key, premiumOnly: true },
];
```

**Rendering Logic:**
- If `premiumOnly && !isPremium`:
  - Show Crown icon instead of regular icon
  - Show locked styling
  - Click redirects to `/upgrade`
- If `premiumOnly && isPremium`:
  - Normal navigation behavior

### TopNav Component
**File:** `src/components/navigation/TopNav.tsx`

Same gating logic applied to mobile navigation tabs.

## 9. Group Access Control

### GroupCard Component
**File:** `src/components/groups/GroupCard.tsx`

**Props:**
```typescript
interface GroupCardProps {
  group: GroupWithDetails;
  onJoin?: (groupId: string) => Promise<void>;
  onLeave?: (groupId: string) => Promise<void>;
  userIsPremium?: boolean;
}
```

**Premium Group Display:**
- Show Crown badge for premium groups
- If user is not premium:
  - Show lock overlay
  - Disable join button
  - Click shows upgrade prompt

### CreateGroupModal Component
**File:** `src/components/groups/CreateGroupModal.tsx`

**New Field:**
```typescript
const [isPremiumGroup, setIsPremiumGroup] = useState(false);
```

**Access Type Toggle:**
- Free Access: All members can join
- Premium Only: Only premium members can access

### GroupSettings Page
**File:** `src/pages/GroupSettings.tsx`

**New Section: Access Type**
- Toggle between Free and Premium access
- Visual feedback with checkmarks
- Immediate save on change

### Groups Page
**File:** `src/pages/Groups.tsx`

**Changes:**
- Pass `userIsPremium` prop to GroupCard
- Premium groups show appropriate access indicators

### GroupDetail Page
**File:** `src/pages/GroupDetail.tsx`

**Access Check:**
```typescript
if (group.is_premium && !isPremium) {
  return <Navigate to="/upgrade" replace />;
}
```

## 10. Upgrade Page

### Component
**File:** `src/pages/Upgrade.tsx`

**Layout:**
- Crown icon header
- Premium benefits list
- Gumroad purchase CTA
- Back to home link

**Benefits Displayed:**
- Everything in Free tier
- Direct messaging with members
- Access to premium groups
- Calendar and events
- Activations access
- Priority support
- Exclusive content

## 11. Gumroad Webhook Updates

### handleNewPurchase Function
**File:** `server/src/routes/gumroad-webhook.ts`

**Change:**
After creating user account, set `membership_type = 'premium'`:
```typescript
await supabase
  .from('profiles')
  .update({ membership_type: 'premium' })
  .eq('id', userId);
```

### handleRefund Function
Optional: Can downgrade to 'free' or retain 'premium' based on business logic.

## 12. TypeScript Types

### Database Types
**File:** `src/types/database.ts`

```typescript
// Profiles Row
membership_type: 'free' | 'premium' | null;

// Groups Row
is_premium: boolean | null;
```

### MembershipType Export
```typescript
export type MembershipType = 'free' | 'premium';
```

## 13. Migration Strategy

### Existing Users
All existing users (created via Gumroad) are migrated to premium:
```sql
UPDATE profiles
SET membership_type = 'premium'
WHERE membership_type IS NULL OR membership_type = 'free';
```

### New Free Users
New users registering via signup form default to `membership_type = 'free'`.

## 14. File Structure

```
src/
├── contexts/
│   └── AuthContext.tsx          # isPremium, membershipType
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.tsx   # requirePremium prop
│   ├── groups/
│   │   ├── GroupCard.tsx        # Premium badges, lock overlay
│   │   └── CreateGroupModal.tsx # Access type toggle
│   └── navigation/
│       ├── SideNav.tsx          # Premium nav gating
│       └── TopNav.tsx           # Premium nav gating
├── pages/
│   ├── auth/
│   │   └── Signup.tsx           # Free registration form
│   ├── Groups.tsx               # Premium group filtering
│   ├── GroupDetail.tsx          # Premium access check
│   ├── GroupSettings.tsx        # Access type settings
│   └── Upgrade.tsx              # Premium upgrade page
└── services/
    └── supabase.ts              # Auth methods

migrations/
└── 029_membership_tiers.sql     # Schema changes
```

## 15. Testing Checklist

### Free Signup Flow
- [ ] Register new account via `/signup`
- [ ] Verify `membership_type = 'free'` in database
- [ ] Confirm email confirmation flow (if enabled)
- [ ] Verify can create posts, comments, reactions
- [ ] Verify can access public groups

### Premium Restrictions
- [ ] Free user sees locked Messages in nav
- [ ] Free user sees locked Calendar in nav
- [ ] Free user sees locked Activations in nav
- [ ] Clicking locked nav item redirects to `/upgrade`
- [ ] Free user cannot access premium groups
- [ ] Premium groups show Crown badge

### Admin/Mod Override
- [ ] Admin user has full premium access
- [ ] Moderator user has full premium access
- [ ] Override works regardless of membership_type

### Gumroad Integration
- [ ] New purchase sets `membership_type = 'premium'`
- [ ] Premium user has full access
- [ ] Existing users retain premium status

### Group Management
- [ ] Can create free access group
- [ ] Can create premium only group
- [ ] Can toggle access type in settings
- [ ] Premium badge shows on premium groups
