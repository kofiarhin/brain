# Brain OS Mobile --- First Slice Product Brief

## Vision

Brain OS Mobile is the lightweight companion app for Brain OS.

The mobile app helps the user quickly capture thoughts, check
priorities, complete tasks, and stay aligned with the active Day Plan
throughout the day.

The web app remains the primary workspace for deeper organization, while
mobile focuses on speed, execution, and daily awareness.

------------------------------------------------------------------------

## Core Principle

**Capture fast. Execute faster.**

Every important action should take as few taps as possible.

------------------------------------------------------------------------

## Goal

Ship a useful first mobile slice that lets the user:

-   View the active Day Plan
-   See today's priorities
-   Capture notes quickly
-   Create tasks quickly
-   Complete or reopen tasks
-   Browse notes
-   View active projects

------------------------------------------------------------------------

## Success Criteria

Within 30 seconds of opening the app, the user can answer:

-   What should I focus on?
-   What is left today?
-   What have I completed?

Within 5 seconds, the user can:

-   Create a note
-   Create a task
-   Mark a task complete

# MVP Features

## 1. Home

Displays:

-   Current Day Plan
-   Focus statement
-   Top 3 priorities
-   Must Do tasks
-   Completion progress
-   Completed tasks count
-   Current session window

Primary actions:

-   Add Note
-   Add Task
-   Complete Task
-   Refresh Day Plan

## 2. Quick Capture

Capture types:

-   Note
-   Task
-   Idea

Minimal forms with one-tap save.

## 3. Tasks

-   Must Do
-   Should Do
-   Nice To Have
-   Completed

Actions:

-   Create
-   Edit
-   Complete
-   Reopen
-   Archive
-   Search

## 4. Notes

-   Create
-   Edit
-   Delete
-   Search
-   Browse recent notes

## 5. Projects

-   Active projects
-   Summary
-   Related tasks

## 6. Settings

-   API Base URL
-   Sync status
-   Cache status
-   Theme
-   App version

# Navigation

Bottom Tabs:

-   Home
-   Tasks
-   Capture
-   Notes
-   Projects

# First Launch

1.  Enter Brain OS API URL
2.  Test connection
3.  Sync data
4.  Open Home

# Offline

Cache:

-   Day Plan
-   Tasks
-   Notes
-   Projects

Offline drafts:

-   Notes
-   Tasks

# Sync

REST endpoints:

-   GET /api/day-plans/latest
-   GET /api/tasks
-   POST /api/tasks
-   PATCH task actions
-   GET /api/notes
-   POST /api/notes
-   PATCH /api/notes/:id
-   DELETE /api/notes/:id
-   GET /api/projects

# Technical Stack

-   React Native
-   Expo
-   JavaScript (ES2023)
-   Expo Router
-   NativeWind
-   TanStack Query
-   Redux Toolkit
-   AsyncStorage
-   Axios
-   React Hook Form
-   ESLint
-   Prettier

# State Management

## TanStack Query

Server state:

-   Day Plans
-   Tasks
-   Notes
-   Projects
-   Ideas

## Redux Toolkit

Local app/UI state:

-   Theme
-   Filters
-   Navigation state
-   Capture drafts
-   Modal state
-   Toasts
-   Connection status
-   Offline sync metadata

## AsyncStorage

Persistence:

-   API URL
-   Theme
-   Cached queries
-   Drafts
-   Settings

# Suggested Folder Structure

``` text
app/
src/
  api/
  components/
  features/
  store/
  lib/
```

# Screens

-   Home
-   Capture
-   Tasks
-   Notes
-   Projects
-   Settings

# API Flow

``` text
Screen
→ Feature Hook
→ API Function
→ Axios Client
→ Brain OS API
```

# Out of Scope

-   Authentication
-   AI Chat
-   Push Notifications
-   Voice Capture
-   File Uploads
-   Calendar
-   Reviews
-   Goals
-   Deliverables
-   Knowledge Graph
-   Semantic Search
-   Multi-user
-   Billing

# Definition of Done

The user can:

-   Connect to Brain OS
-   View Day Plan
-   View priorities
-   Create notes
-   Create tasks
-   Complete/Reopen tasks
-   Browse notes
-   View projects
-   Work offline using cached data

# Win Condition

The mobile app becomes the fastest way to interact with Brain OS
throughout the day.
