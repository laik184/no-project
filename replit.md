# NURA X Deployer

## Overview

This repository contains the NURA X React frontend. The imported snapshot does not include the original backend entry point or server/API sources, and it is configured to run frontend-only with Vite.

## Running on Replit

- Workflow: `Start application`
- Command: `npm run dev`
- Build check: `npm run build`

The Home Page requests recent projects from `/api/projects`. Since this frontend-only version has no backend, the page intentionally shows its retryable project-loading error state rather than inventing project data.

## User preferences

- Preserve the existing dark visual identity and React/Vite structure.
- Keep Home Page changes isolated from other routes and backend APIs.