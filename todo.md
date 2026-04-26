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
- [ ] AI verification with confidence score display
- [x] Real-time XP gain toast notification
- [x] Level-up celebration animation
- [x] Quest expiry countdown timer
- [x] Notify quest creator on submission verified
- [x] Admin: seed default quests on first run

## Authentication & OAuth
- [x] **Create custom OAuth endpoint**
- [x] Store/verify hashed passwords in database
- [x] Add forgot password flow
- [x] Add email verification endpoint
- [x] Add password reset endpoint

## Tests
- [x] XP level calculation tests
- [x] Auth logout test
- [x] Quest creation input validation tests
- [x] Notification auth guard tests
- [x] User profile auth guard test

## Quest Proposal System (COMPLETE)
- [x] Add quest_proposals table to schema
- [x] Add proposalRouter with submitProposal, myProposals, pending procedures
- [x] Send notification to owner when proposal submitted
- [x] Update CreateQuest page to submit proposals
- [x] Admin proposal management (approve/reject)
- [x] Bulk proposal operations
- [x] Admin stats dashboard & filtering

## Team Quest Features (COMPLETE)
- [x] Add requirementType (individual/team) to quests
- [x] Update CreateQuest and QuestDetail for team quests
- [x] Team member search and invitations
- [x] Accept/decline invitation flow
- [x] Award XP to all team members on completion

## Incentives & Unlockables (IN PROGRESS)
- [x] Design unlock system (badges, cosmetics, titles)
- [x] Create milestone rewards at each level
- [x] Add milestone progress cards for quest completions and levels
- [x] Add streak tracking and streak bonus rewards
- [x] Add social activity / feed for completed quests and unlocks
- [ ] Add cosmetic shop with XP-purchasable items
- [ ] Add unlockable effects: titles, boosts, cosmetic rewards

## Home Screen Updates (COMPLETE)
- [x] Create social feed showing top quest completions
- [x] Add media-rich "Instagram-style" global activity feed
- [x] Implement user consent for photo sharing (isPublic toggle)
- [ ] Add AI-powered image quality assessment

## Future Roadmap
- [ ] Game Monetization (Steam/PlayStation integration)
- [ ] AI-Generated Quests & rotation
- [ ] User-Based Private Quests
- [ ] UI Shop Unlockables (Themes, Fonts, Backgrounds)

## Settings & Organization (COMPLETE)
- [x] Create dedicated Settings page for account management
- [x] Move logout function from Unlockables to Settings
- [x] Clean up Unlockables page
