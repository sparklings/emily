import obsidianmd from 'eslint-plugin-obsidianmd';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...obsidianmd.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      'obsidianmd/ui/sentence-case': ['warn', {
        brands: [
          'Obsidian', 'OpenAI', 'Ollama', 'LM Studio', 'OpenRouter',
          'Gemini', 'DeepSeek', 'Groq', 'vLLM', 'Anthropic',
          'Assistant Emily', 'Emily', 'Stainless', 'SDK', 'HOME',
          'Add', 'Chat', 'Model', 'Provider', 'goodus-primary', 'qwen2.5'
        ],
        acronyms: [
          'API', 'URL', 'LLM', 'SSE', 'ID', 'DOM', 'CSV', 'PDU',
          'YAML', 'LaTeX', 'UI', 'UX', 'IME', 'HTTP', 'HTTPS', 'PC', 'X-Title', 'HTTP'
        ]
      }],
      // settingsTab renders custom 4-tab layout and modals via display()
      'obsidianmd/prefer-setting-definitions': 'off',
    },
  }
);
