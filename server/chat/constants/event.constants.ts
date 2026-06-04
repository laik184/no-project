export const CHAT_EVENT = {
  MESSAGE_CREATED:     'chat.message.created',
  MESSAGE_UPDATED:     'chat.message.updated',
  STREAM_STARTED:      'chat.stream.started',
  STREAM_TOKEN:        'chat.stream.token',
  STREAM_ENDED:        'chat.stream.ended',
  RUN_STARTED:         'chat.run.started',
  RUN_COMPLETED:       'chat.run.completed',
  RUN_FAILED:          'chat.run.failed',
  RUN_CANCELLED:       'chat.run.cancelled',
  QUESTION_ASKED:      'chat.question.asked',
  QUESTION_ANSWERED:   'chat.question.answered',
  ATTACHMENT_UPLOADED: 'chat.attachment.uploaded',
  TIMELINE_EVENT:      'chat.timeline.event',
  TURN_STARTED:        'chat.turn.started',
  TURN_COMPLETED:      'chat.turn.completed',
  CHECKPOINT_CREATED:  'checkpoint.created',
  CHECKPOINT_UPDATED:  'checkpoint.updated',
  CHECKPOINT_ROLLBACK: 'checkpoint.rollback',
} as const;

export const BUS_EVENT = {
  AGENT_EVENT:   'agent.event',
  RUN_LIFECYCLE: 'run.lifecycle',
  CHECKPOINT:    'checkpoint',
} as const;

export const CHAT_TOPIC = {
  AGENT:      'agent',
  LIFECYCLE:  'lifecycle',
  CHECKPOINT: 'checkpoint',
} as const;
