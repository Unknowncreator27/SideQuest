# Side Quest — Project TODO

## Database & Backend
- [x] Design and migrate schema: users (XP, level), quests, submissions, notifications
- [x] Quest CRUD procedures (create, list, get, update, delete)
- [x] Submission procedures (create, list, get)
- [x] AI verification procedure (analyze image/video via LLM vision)
- [x] XP awarding procedure with level-up logic
- [x] Leaderboard procedure
- [x] Notification procedures (create, list, mark read)
- [x] Time-bound quest expiry logic (expiresAt field + status checks)
- [x] S3 upload endpoint for quest proof media

## Frontend — Global
- [x] Dark game-like theme with neon accents in index.css
- [x] Custom fonts (Rajdhani / Inter / Orbitron) via Google Fonts
- [x] Animated background / particle effect on landing
- [x] Global layout with top nav, user XP bar, notification bell
- [x] Smooth page transitions with framer-motion

## Frontend — Pages
- [x] Landing / Home page with hero, features, CTA
- [x] Quest Feed page (all quests, filter by difficulty/status/expiry)
- [x] Quest Detail page (description, XP reward, timer, submit proof)
- [x] User Dashboard (XP, level, completed quests, progress bar)
- [x] Leaderboard page (ranked by XP with avatars)
- [x] Quest Creation page (title, description, XP, difficulty, expiry)
- [x] Notifications panel / dropdown

## Features
- [x] User auth with XP and level tracking
- [x] XP progress bar with animated level-up effect
- [x] Difficulty badges (Easy / Medium / Hard / Legendary)
- [x] Quest status badges (Active / Expired / Completed)
- [x] Image & video upload with preview
- [] AI verification with confidence score display
- [x] Real-time XP gain toast notification
- [x] Level-up celebration animation
- [x] Quest expiry countdown timer
- [x] Notify quest creator on submission verified
- [x] Admin: seed default quests on first run

## Authentication & OAuth

- [x] **Create custom OAuth endpoint** (start here!)
  - [x] Build dedicated auth server or module
  - [x] Add login page UI (/app-auth)
  - [x] Add register page UI (/app-register)
  - [x] Implement user session token generation
  - [x] Implement password hashing (bcrypt)
  - [x] Add email verification (optional)
  - [x] Replace mock OAuth with real auth
- [x] Store/verify hashed passwords in database
- [x] Add forgot password flow
- [x] Add email verification endpoint
- [x] Add password reset endpoint

## Tests
- [x] XP level calculation tests (calculateLevel, xpForLevel, xpForNextLevel)
- [x] Auth logout test
- [x] Quest creation input validation tests
- [x] Notification auth guard tests
- [x] User profile auth guard test


## Quest Proposal System (NEW)
- [x] Add quest_proposals table to schema (title, description, xpReward, difficulty, proposedBy, status, createdAt)
- [x] Generate migration SQL and apply
- [x] Add proposalRouter with submitProposal, myProposals, pending procedures
- [x] Send notification to owner when proposal submitted
- [x] Update CreateQuest page to submit proposals instead of creating quests
- [x] Show success message to user after proposal submission
- [x] Test proposal submission flow


## Dashboard Proposals Section (NEW)
- [x] Add proposals section to Dashboard page
- [x] Display user's submitted proposals with title, description, difficulty, XP, and status
- [x] Add status badges (pending/approved/rejected) with appropriate colors
- [x] Show rejection reason if proposal was rejected
- [x] Add empty state when no proposals exist
- [x] Test dashboard proposals display


## Admin Proposal Management (NEW)
- [x] Add approve and reject procedures to proposalRouter with quest creation
- [x] Create AdminProposals page with pending proposals list
- [x] Add approve button with quest creation
- [x] Add reject button with reason input
- [x] Send notifications to users on approve/reject
- [x] Add admin-only route guard to AdminProposals page
- [x] Add admin route to App.tsx
- [x] Test full admin workflow


## Bulk Proposal Operations (NEW)
- [x] Add checkboxes to each proposal in AdminProposals page
- [x] Add select all/deselect all functionality
- [x] Create bulk action toolbar showing selected count
- [x] Add bulk approve button with confirmation
- [x] Add bulk reject button with reason input
- [x] Add bulk approve and reject procedures to backend
- [x] Test bulk approval workflow
- [x] Test bulk rejection workflow


## Admin Navbar Link with Badge (NEW)
- [x] Fetch pending proposals count in NavBar
- [x] Add "Manage Proposals" link visible only to admins
- [x] Display badge with pending count next to link
- [x] Style badge to match game aesthetic
- [x] Test navbar link visibility and badge updates


## Admin Stats Dashboard (NEW)
- [x] Add getProposalStats procedure to backend
- [x] Calculate approval rate, rejection rate, pending count
- [x] Calculate average review time for approved/rejected proposals
- [x] Calculate total proposals and difficulty distribution
- [x] Create stats cards with color-coded metrics
- [x] Build stats dashboard layout on AdminProposals page
- [x] Add color coding for each metric
- [x] Test stats calculations and display


## Proposal Filtering (NEW)
- [x] Add difficulty filter UI with multi-select checkboxes
- [x] Add date range picker for submission date filtering
- [x] Implement filter state management in AdminProposals
- [x] Apply filters to proposals list in real-time
- [x] Add clear filters button
- [x] Display filtered proposal count
- [x] Test difficulty filtering
- [x] Test date range filtering


## Filter Presets (NEW)
- [x] Add filter_presets table to schema with name, difficulties, dateFrom, dateTo, userId
- [x] Generate migration SQL and apply
- [x] Add backend procedures: saveFilterPreset, getFilterPresets, deleteFilterPreset
- [x] Add preset UI with save button, preset dropdown, and delete buttons
- [x] Implement preset loading logic to restore filters
- [x] Add preset name input dialog
- [x] Test saving and loading presets
- [x] Test deleting presets


## Quest Requirements - Team vs Individual (NEW)
- [x] Add requirementType enum (individual/team) to quests table
- [x] Update CreateQuest form with team/individual selector
- [x] Update QuestDetail to display requirement type
- [x] Add team submission logic (multiple users can submit for same quest)
- [x] Test team vs individual quest flows

## Time-Bound Quests Implementation (NEW)
- [x] Add expiresAt field to quests table (already exists)
- [x] Add duration selector to CreateQuest (1h, 6h, 24h, 7d, 30d)
- [x] Calculate expiry time based on quest creation + duration
- [x] Display remaining time on quest cards and detail page
- [x] Add expired quest status and filtering
- [x] Test expiry logic and time display

## Multi-Media Upload Support (NEW)
- [x] Add requiredMediaCount field to quests table
- [x] Update CreateQuest form with media count input (1-5)
- [x] Update submissions table to support multiple media files
- [x] Implement multi-file upload UI in QuestDetail
- [x] Add media count validation before submission
- [x] Display uploaded media count progress
- [x] Test multi-media upload flows


## Quest Display with Requirements (COMPLETE)
- [x] Display requirement type badge on quest cards (Individual/Team)
- [x] Display required media count on quest cards
- [x] Show requirement type and media count on QuestDetail page
- [x] Add visual indicators for team quests vs individual quests

## Multi-Media Submission UI (COMPLETE)
- [x] Update QuestDetail submission form to accept multiple files
- [x] Add file upload input that accepts images and videos
- [x] Show uploaded file count progress (e.g., "2 of 3 files")
- [x] Add file preview thumbnails before submission
- [x] Validate file count matches quest requirement
- [x] Show validation error if wrong number of files
- [x] Add remove button for each uploaded file

## Team Submission Logic (IN PROGRESS)
- [x] Update submissions table to support team member IDs
- [x] Implement backend logic to award XP to all team members
- [x] Add team member selection UI in QuestDetail
- [x] Validate team member count for team quests
- [x] Send notifications to all team members on verification
- [x] Display team members on submission details


## Team Quest Features (IN PROGRESS)
- [x] Allow team members to be added when creating team quests
- [x] Add member search/selection UI in CreateQuest for team quests
- [x] Send invitations to selected team members
- [x] Allow team members to accept/decline quest invitations
- [x] Archive accepted and declined invitations into a history section
- [x] Award XP to all team members on quest completion

## Game Monetization (PLANNED)
- [ ] Add game integration (Steam, PlayStation, Xbox, etc.)
- [ ] Create quests tied to game achievements/levels
- [ ] Reward XP for reaching certain levels in games
- [ ] Add game profile verification system
- [ ] Display game progress on user dashboard

## Incentives & Unlockables (PLANNED)
- [ ] Design unlock system (badges, cosmetics, titles)
- [ ] Create milestone rewards at each level
- [ ] Add cosmetic shop with XP-purchasable items
- [ ] Display unlocked badges on user profile
- [ ] Add achievement tracking and display

## Home Screen Updates (PLANNED)
- [ ] Add quest feed to home screen showing recent completions
- [ ] Implement user consent for photo sharing
- [ ] Add AI-powered image quality assessment
- [ ] Create social feed showing top quest completions
- [ ] Add user-generated content moderation

## AI-Generated Quests (PLANNED)
- [ ] Add AI quest generation endpoint
- [ ] Create admin approval flow for AI-generated quests
- [ ] Add AI generation parameters (difficulty, category, etc.)
- [ ] Implement daily/weekly AI quest rotation
- [ ] Track AI-generated quest popularity

## User-Based Quests (PLANNED)
- [ ] Add user_quests table for private quests
- [ ] Create UI for creating quests for specific users
- [ ] Add quest invitation system
- [ ] Implement private quest visibility rules
- [ ] Add quest acceptance/rejection flow

## SQL Server Setup (PLANNED)
- [ ] Document SQL Server connection setup
- [ ] Create migration scripts for SQL Server
- [ ] Add SQL Server connection guide
- [ ] Set up local development SQL Server instance

## Quest Management (PLANNED)
- [ ] Add quest deletion functionality
- [ ] Implement soft delete for quest history
- [x] Add quest edit capability
- [ ] Create quest archive feature
- [ ] Add quest activity logs

## Completed Quest Display (IN PROGRESS)
- [x] Add completed quests section to Dashboard
- [x] Show completion date and XP earned
- [ ] Add quest replay option for repeatable quests
- [ ] Display completion badges/medals
- [ ] Show completion statistics

## AI Site Management (FUTURE)
- [ ] Allow AI to manage quest approvals
- [ ] Implement AI-powered content moderation
- [ ] Add AI-driven site updates and improvements
- [ ] Create AI analytics dashboard
- [ ] Implement AI-based user support


## Team Member Selection & Invitations (IN PROGRESS)
- [ ] Add team_members table to schema
- [ ] Add quest_team_invitations table to schema
- [ ] Generate and apply migrations
- [ ] Add backend procedures for user search, team invites, and invite management
- [ ] Build team member search UI in CreateQuest
- [ ] Add invite button and team member list display
- [ ] Display team invitations in Dashboard
- [ ] Implement accept/decline invitation flow
- [ ] Award XP to all team members on quest completion
- [ ] Test team collaboration workflow
