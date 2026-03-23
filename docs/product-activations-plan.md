# Product Activation Request System - Implementation Plan

## Overview
A system allowing users to request product activations (Elementor, Bricks Builder, themes, etc.) by providing their website credentials. Admins/moderators perform the actual activation and update the status. Users receive email notifications on status updates.

---

## Workflow

1. **User submits request** with:
   - Product selection
   - Website URL
   - WordPress login credentials (username + password)
   - Optional notes

2. **Admin/Moderator processes** by:
   - Viewing pending requests
   - Logging into user's site and performing activation
   - Updating status (completed, rejected, in_progress)
   - Adding notes if needed

3. **User is notified** via:
   - In-app notification
   - Email with status update

---

## Database Schema

**New Migration: `migrations/021_product_activations.sql`**

### Tables

#### 1. `activation_products` - Admin-managed products
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Product name (e.g., "Elementor Pro") |
| slug | TEXT | URL-friendly identifier |
| description | TEXT | Product description |
| product_type | TEXT | Type: elementor, bricks, theme, plugin, other |
| monthly_limit | INTEGER | Max activations per user per month |
| is_active | BOOLEAN | Whether available for requests |
| icon_url | TEXT | Product icon (optional) |
| instructions | TEXT | Instructions for users |
| created_at, updated_at | TIMESTAMPTZ | Timestamps |

#### 2. `activation_requests` - User requests
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Requesting user (FK to profiles) |
| product_id | UUID | Requested product (FK to activation_products) |
| status | ENUM | pending, in_progress, completed, rejected |
| **website_url** | TEXT | User's website URL |
| **wp_username** | TEXT | WordPress admin username |
| **wp_password** | TEXT | WordPress admin password (encrypted) |
| notes | TEXT | User's notes/reason |
| admin_notes | TEXT | Admin notes (visible to user after completion) |
| processed_by | UUID | Admin/mod who processed |
| processed_at | TIMESTAMPTZ | When processed |
| created_at, updated_at | TIMESTAMPTZ | Timestamps |

#### 3. `activation_usage` - Monthly usage tracking
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | User (FK to profiles) |
| product_id | UUID | Product (FK to activation_products) |
| month_year | DATE | First day of month (e.g., 2026-02-01) |
| usage_count | INTEGER | Number of activations used |
| UNIQUE | constraint | (user_id, product_id, month_year) |

#### 4. Future Extension Tables (for Gumroad packages)
- `activation_packages` - Package definitions with Gumroad product linking
- `user_activation_packages` - User purchased packages

### Database Functions
- `get_remaining_activations(user_id, product_id)` - Returns remaining activations for current month
- `request_activation(user_id, product_id, website_url, wp_username, wp_password, notes)` - Creates request with limit validation
- `process_activation_request(request_id, processor_id, status, admin_notes)` - Admin/mod status update
- `get_activation_stats()` - Dashboard statistics

### RLS Policies
- **Products**: Authenticated users view active products; admins manage all
- **Requests**: Users view own requests (credentials masked); admins/mods view all; users create own
- **Usage**: Users view own usage; admins view all

### Security Note
WordPress credentials are sensitive. Consider:
- Encrypting `wp_password` at application level before storing
- Only displaying credentials to admins/mods processing the request
- Clearing credentials after activation is completed (optional)

---

## Files to Create

### 1. Service Layer
**File: `src/services/activation.ts`**

User functions:
- `getAvailableProducts(userId)` - Get products with remaining activations
- `getUserActivations(userId)` - Get user's activation history
- `requestActivation(userId, productId, domain?, notes?)` - Submit request

Admin functions:
- `getAdminProducts()` - Get all products (active/inactive)
- `createProduct(data)` - Create new product
- `updateProduct(id, data)` - Update product
- `deleteProduct(id)` - Delete product
- `getPendingRequests(options)` - Get requests with filters/pagination
- `processRequest(requestId, adminId, status, key?, notes?, validDays?)` - Approve/reject
- `getActivationStats()` - Dashboard stats

### 2. Admin Page
**File: `src/pages/admin/Activations.tsx`**

Two-tab interface (following Gumroad.tsx pattern):

**Products Tab:**
- Stats cards (total products, pending requests, completed this month)
- "Add Product" button opening inline form
- Products table: Name, Type, Monthly Limit, Status, Actions (edit/delete)
- Inline editing (following Categories.tsx pattern)

**Requests Tab:**
- Filter dropdown: Pending, In Progress, Completed, Rejected, All
- Search by user/website
- Requests table: User, Product, Website URL, Status, Date, Actions
- View Request modal showing:
  - User info and product requested
  - Website URL (clickable link)
  - WordPress credentials (username + password with show/hide toggle)
  - User notes
  - Status update dropdown (In Progress, Completed, Rejected)
  - Admin notes textarea
  - "Update Status" button (sends email notification to user)

### 3. User Page
**File: `src/pages/Activations.tsx`**

Two-tab interface:

**Available Products Tab:**
- Grid of product cards showing:
  - Product icon/name
  - Type badge
  - Monthly limit display
  - Remaining activations this month
  - "Request Activation" button (disabled if limit reached or pending request)

**My Requests Tab:**
- List of user's requests with status badges:
  - **Pending**: Yellow badge, "Awaiting review" message
  - **In Progress**: Blue badge, "Being processed" message
  - **Completed**: Green badge with checkmark, admin notes shown
  - **Rejected**: Red badge, rejection reason shown
- Each request shows: Product, Website URL, Date submitted, Status

**Request Modal:**
- Product info display
- Website URL input (required)
- WordPress Username input (required)
- WordPress Password input (required, with show/hide toggle)
- Notes textarea (optional)
- Security notice: "Your credentials are securely stored and only visible to staff"
- Submit button

---

## Files to Modify

### 1. Routing
**File: `src/App.tsx`**

```typescript
// Add imports
const Activations = lazy(() => import('./pages/Activations'));
const AdminActivations = lazy(() => import('./pages/admin/Activations'));

// Add routes
// In protected routes (inside MainLayout):
<Route path="/activations" element={<Activations />} />

// In admin routes:
<Route path="activations" element={<AdminActivations />} />
```

### 2. Admin Navigation
**File: `src/layouts/AdminLayout.tsx`**

Add to navItems array:
```typescript
import { Key } from 'lucide-react';
// ...
{ path: '/admin/activations', label: 'Activations', icon: Key },
```

### 3. Sidebar Navigation
**File: `src/components/navigation/SideNav.tsx`** (or equivalent)

Add "Activations" link with Key icon to sidebar menu, accessible to all authenticated users.

### 4. Email Notifications
**File: `server/src/services/email.ts`**

Add new email templates:
- `sendActivationStatusEmail(userEmail, productName, status, adminNotes?)` - Sends when admin updates status

### 5. Type Definitions
**File: `src/types/database.ts`**

Add types for new tables (activation_products, activation_requests, activation_usage).

### 6. Service Exports
**File: `src/services/index.ts`**

Export activation service functions and types.

### 7. Backend API Route (for email notifications)
**File: `server/src/routes/activation-api.ts`**

Add endpoint for sending status update emails:
- `POST /api/activations/:id/status` - Update status and send email notification

---

## Implementation Sequence

1. **Database Migration** - Create tables, functions, RLS policies, indexes
2. **Type Definitions** - Add TypeScript types
3. **Backend API** - Email notification endpoint for status updates
4. **Service Layer** - Create activation.ts with all CRUD operations
5. **Admin Page** - Products management + request processing
6. **User Page** - View products, request activations, view history
7. **Navigation Updates** - Add routes and sidebar link

---

## Verification Plan

### Database
- [ ] Run migration in Supabase
- [ ] Verify tables created with correct columns
- [ ] Test RLS policies (user can only see own requests, admin sees all)
- [ ] Test `get_remaining_activations` returns correct count
- [ ] Test `request_activation` enforces monthly limit

### Admin Functionality
- [ ] Add a new product with monthly limit
- [ ] Edit product details
- [ ] Delete a product
- [ ] View pending requests with user credentials
- [ ] Mark request as "In Progress"
- [ ] Mark request as "Completed" with notes
- [ ] Reject request with reason
- [ ] Verify user receives email notification on status change
- [ ] Verify in-app notification is created

### User Functionality
- [ ] View available products with remaining activations
- [ ] Submit activation request with website credentials
- [ ] Cannot request if limit reached (button disabled)
- [ ] Cannot request if pending/in-progress request exists for same product
- [ ] View completed activations with admin notes
- [ ] View pending/in-progress/rejected requests
- [ ] Receive email when status changes

### Monthly Reset
- [ ] Verify new month starts fresh count (test by changing month_year)

---

## Future Extension: Gumroad Packages

The schema includes `activation_packages` and `user_activation_packages` tables for future Gumroad integration:

1. Create package linking Gumroad product to activation limits
2. Add webhook handler for package purchases
3. Modify `get_remaining_activations` to include package bonuses
4. Add package management UI in admin

---

## Critical Files Summary

| File | Purpose |
|------|---------|
| `migrations/021_product_activations.sql` | Database schema |
| `src/services/activation.ts` | Service layer |
| `src/pages/admin/Activations.tsx` | Admin management page |
| `src/pages/Activations.tsx` | User-facing page |
| `src/App.tsx` | Routing |
| `src/layouts/AdminLayout.tsx` | Admin nav |
| `src/components/navigation/SideNav.tsx` | User sidebar nav |
| `src/types/database.ts` | TypeScript types |
| `server/src/routes/activation-api.ts` | Backend API for emails |
| `server/src/services/email.ts` | Email templates |
