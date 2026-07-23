# NURA X Deployer

## Overview

This repository contains the NURA X React frontend. The imported snapshot currently includes the client UI but does not include the original backend entry point or server/API sources.

## Running on Replit

- Workflow: `Start application`
- Command: `npx vite --host 0.0.0.0 --port 5000`
- Build check: `npm run build`

The Home Page requests recent projects from `/api/projects`. Until the missing backend is restored, the page intentionally shows its retryable project-loading error state rather than inventing project data.

## User preferences

- Preserve the existing dark visual identity and React/Vite structure.
- Keep Home Page changes isolated from other routes and backend APIs.