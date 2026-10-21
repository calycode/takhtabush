export type DocEntry = {
   section: string;
   /** URL path under /docs/. The overview uses an empty path. */
   path: string;
   /** Fallback title; the generator prefers the first markdown heading. */
   title: string;
   /** Markdown file relative to docs/. */
   file: string;
   order: number;
   /** Sidebar nesting. The current site is flat, but the field keeps the door open. */
   segments: string[];
};

export type DocLink = {
   section: string;
   title: string;
   href: string;
};

export const DOC_ENTRIES: DocEntry[] = [
   {
      section: 'Overview',
      path: '',
      title: 'Takhtabush documentation',
      file: 'README.md',
      order: 0,
      segments: [],
   },

   // User guide
   {
      section: 'User guide',
      path: 'user/',
      title: 'User guide',
      file: 'user/README.md',
      order: 10,
      segments: ['user'],
   },
   {
      section: 'User guide',
      path: 'user/getting-started',
      title: 'Getting started',
      file: 'user/getting-started.md',
      order: 11,
      segments: ['user', 'getting-started'],
   },
   {
      section: 'User guide',
      path: 'user/decks-and-cards',
      title: 'Decks and cards',
      file: 'user/decks-and-cards.md',
      order: 12,
      segments: ['user', 'decks-and-cards'],
   },
   {
      section: 'User guide',
      path: 'user/studying',
      title: 'Studying',
      file: 'user/studying.md',
      order: 13,
      segments: ['user', 'studying'],
   },
   {
      section: 'User guide',
      path: 'user/progress',
      title: 'Progress',
      file: 'user/progress.md',
      order: 14,
      segments: ['user', 'progress'],
   },
   {
      section: 'User guide',
      path: 'user/import-export',
      title: 'Import and export',
      file: 'user/import-export.md',
      order: 15,
      segments: ['user', 'import-export'],
   },
   {
      section: 'User guide',
      path: 'user/account',
      title: 'Account and sessions',
      file: 'user/account.md',
      order: 16,
      segments: ['user', 'account'],
   },
   {
      section: 'User guide',
      path: 'user/ai-assistant',
      title: 'Use an AI assistant',
      file: 'user/ai-assistant.md',
      order: 17,
      segments: ['user', 'ai-assistant'],
   },
   {
      section: 'User guide',
      path: 'user/faq',
      title: 'FAQ',
      file: 'user/faq.md',
      order: 18,
      segments: ['user', 'faq'],
   },

   // Developer guide
   {
      section: 'Developer guide',
      path: 'developer/',
      title: 'Developer guide',
      file: 'developer/README.md',
      order: 30,
      segments: ['developer'],
   },
   {
      section: 'Developer guide',
      path: 'developer/self-hosting',
      title: 'Self-hosting',
      file: 'developer/self-hosting.md',
      order: 31,
      segments: ['developer', 'self-hosting'],
   },
   {
      section: 'Developer guide',
      path: 'developer/architecture',
      title: 'Architecture',
      file: 'developer/architecture.md',
      order: 32,
      segments: ['developer', 'architecture'],
   },
   {
      section: 'Developer guide',
      path: 'developer/configuration',
      title: 'Configuration',
      file: 'developer/configuration.md',
      order: 33,
      segments: ['developer', 'configuration'],
   },
   {
      section: 'Developer guide',
      path: 'developer/security',
      title: 'Security',
      file: 'developer/security.md',
      order: 34,
      segments: ['developer', 'security'],
   },
   {
      section: 'Developer guide',
      path: 'developer/mcp',
      title: 'MCP internals',
      file: 'developer/mcp.md',
      order: 35,
      segments: ['developer', 'mcp'],
   },
   {
      section: 'Developer guide',
      path: 'developer/scheduler',
      title: 'Scheduler',
      file: 'developer/scheduler.md',
      order: 36,
      segments: ['developer', 'scheduler'],
   },
   {
      section: 'Developer guide',
      path: 'developer/frontend',
      title: 'Frontend stack',
      file: 'developer/frontend.md',
      order: 37,
      segments: ['developer', 'frontend'],
   },
   {
      section: 'Developer guide',
      path: 'developer/theming',
      title: 'Theming',
      file: 'developer/theming.md',
      order: 38,
      segments: ['developer', 'theming'],
   },
   {
      section: 'Developer guide',
      path: 'developer/clef',
      title: 'Clef and AI Gateway',
      file: 'developer/clef.md',
      order: 39,
      segments: ['developer', 'clef'],
   },
   {
      section: 'Developer guide',
      path: 'developer/contributing',
      title: 'Contributing',
      file: 'developer/contributing.md',
      order: 40,
      segments: ['developer', 'contributing'],
   },
   {
      section: 'Developer guide',
      path: 'developer/agent-feedback',
      title: 'Agent feedback (Agentation)',
      file: 'developer/agent-feedback.md',
      order: 41,
      segments: ['developer', 'agent-feedback'],
   },

   // Reference
   {
      section: 'Reference',
      path: 'developer/reference/mcp-tools',
      title: 'MCP tools',
      file: 'developer/reference/mcp-tools.md',
      order: 60,
      segments: ['developer', 'reference', 'mcp-tools'],
   },
   {
      section: 'Reference',
      path: 'developer/reference/api',
      title: 'HTTP API',
      file: 'developer/reference/api.md',
      order: 61,
      segments: ['developer', 'reference', 'api'],
   },
];

export const DOC_LINKS: DocLink[] = [
   {
      section: 'Project',
      title: 'GitHub',
      href: 'https://github.com/calycode/takhtabush',
   },
   {
      section: 'Project',
      title: 'Design specification',
      href: 'https://github.com/calycode/takhtabush/blob/main/SPEC.md',
   },
   {
      section: 'Project',
      title: 'Contributing',
      href: 'https://github.com/calycode/takhtabush/blob/main/CONTRIBUTING.md',
   },
   {
      section: 'Project',
      title: 'Security policy',
      href: 'https://github.com/calycode/takhtabush/blob/main/SECURITY.md',
   },
   {
      section: 'Project',
      title: 'MIT license',
      href: 'https://github.com/calycode/takhtabush/blob/main/LICENSE',
   },
];
