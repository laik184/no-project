import type { ChatFeatureContext, GeneratedModule } from '../types.js';
import { createId } from '../utils/id-generator.util.js';

export function generateChatUiModule(context: ChatFeatureContext): GeneratedModule {
  const moduleId = createId('chat-ui');

  return Object.freeze({
    name: `chat-ui.${moduleId}`,
    layer: 'L2',
    runtime: 'frontend',
    code: `// generated at ${context.nowIso}
export function renderChatUi(root) {
  root.innerHTML = [
    '<section class="chat-shell">',
    '  <header>Realtime Chat</header>',
    '  <main id="chat-messages"></main>',
    '  <footer>',
    '    <input id="chat-input" placeholder="Type a message" />',
    '    <button id="chat-send">Send</button>',
    '  </footer>',
    '</section>'
  ].join('');
}`,
  });
}
