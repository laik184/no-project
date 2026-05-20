# Framework Pattern Engine

## Overview

This module enforces architecture correctness.

## Flow

`orchestrator.ts`
→ `pattern-detector.agent`
→ `anti-pattern-detector.agent`
→ `architecture-classifier.agent`
→ `layering-enforcer.agent`
→ `modularity-analyzer.agent`
→ `coupling-analyzer.agent`
→ `scalability-evaluator.agent`
→ `refactor-suggester.agent`

## Import Rules

- orchestrator → agents only
- agents → utils only
- utils → none

## Output Contract

`{ success, logs, result, error }`
