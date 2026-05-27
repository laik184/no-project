/**
 * tool-schema.ts
 * OpenAI function-calling tool definitions for the executor tool loop.
 * Add new tools here — tool-dispatcher.ts must have a matching handler.
 */

import type OpenAI from 'openai';

export type ToolName =
  | 'write_file'
  | 'read_file'
  | 'edit_file'
  | 'delete_file'
  | 'list_directory'
  | 'search_files'
  | 'run_command'
  | 'npm_install'
  | 'run_tests'
  | 'task_complete';

export const EXECUTOR_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write or overwrite a file in the project sandbox.',
      parameters: {
        type: 'object',
        properties: {
          path:    { type: 'string', description: 'Relative file path (e.g. src/App.tsx)' },
          content: { type: 'string', description: 'Full file content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the current content of a file in the project sandbox.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path to read' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Surgically replace an exact string in a file. old_string must match exactly.',
      parameters: {
        type: 'object',
        properties: {
          path:       { type: 'string', description: 'Relative file path to edit' },
          old_string: { type: 'string', description: 'Exact text to find and replace' },
          new_string: { type: 'string', description: 'Replacement text' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a file from the project sandbox.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path to delete' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List files and directories at a given path in the sandbox.',
      parameters: {
        type: 'object',
        properties: {
          path:      { type: 'string', description: 'Relative directory path (default: ".")' },
          recursive: { type: 'boolean', description: 'Include subdirectories recursively' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for text across all files in the sandbox.',
      parameters: {
        type: 'object',
        properties: {
          query:   { type: 'string', description: 'Text or pattern to search for' },
          base_dir: { type: 'string', description: 'Directory to search in (default: ".")' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a shell command in the project sandbox.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'npm_install',
      description: 'Install npm packages in the project sandbox.',
      parameters: {
        type: 'object',
        properties: {
          packages: {
            type: 'array',
            items: { type: 'string' },
            description: 'Package names to install (empty = install from package.json)',
          },
          dev: { type: 'boolean', description: 'Install as devDependency' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_tests',
      description: 'Run the project test suite.',
      parameters: {
        type: 'object',
        properties: {
          script: { type: 'string', description: 'npm script name to run (default: "test")' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_complete',
      description: 'Signal that the current task is fully completed.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Short summary of what was accomplished' },
        },
        required: ['summary'],
      },
    },
  },
];
