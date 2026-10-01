import { App, Modal, Notice, setIcon, ToggleComponent } from 'obsidian';
import type EmilyPlugin from '../main';
import { AIProviderConfig } from '../types/settings';
import { getTranslation } from '../i18n';

/**
 * YOLO 스타일 AI 프로바이더 추가 및 편집 모달 (Compact 2-Column Grid + Collapsible Advanced Layout)
 */
export class ProviderModal extends Modal {
  private plugin: EmilyPlugin;
  private provider: AIProviderConfig | null;
  private onSaveCallback: (provider: AIProviderConfig) => void;
  private isAdvancedOpen: boolean = false;

  constructor(
    app: App,
    plugin: EmilyPlugin,
    provider: AIProviderConfig | null,
    onSave: (provider: AIProviderConfig) => void
  ) {
    super(app);
    this.plugin = plugin;
    this.provider = provider;
    this.onSaveCallback = onSave;
    // 기존에 커스텀 헤더가 있거나 기본값이 아닌 고급 설정이 있으면 기본 펼침
    if (provider && (
      (provider.customHeaders && Object.keys(provider.customHeaders).length > 0) ||
      provider.noStainlessHeaders ||
      provider.requestMethod === 'fetch' ||
      provider.streamingMode === 'chunk'
    )) {
      this.isAdvancedOpen = true;
    }
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass('emily-provider-modal');

    const isEdit = Boolean(this.provider);
    const t = getTranslation(this.plugin.settings.language);

    // Initial values
    let id = this.provider ? this.provider.id : '';
    let name = this.provider ? (
      (this.provider.name && !/^[ㄱ-ㅣ]$/.test(this.provider.name.trim()))
        ? this.provider.name
        : (this.provider.id || '')
    ) : '';
    let preset = this.provider ? this.provider.preset : 'custom';
    let apiType = this.provider ? this.provider.apiType : 'OpenAI-compatible';
    let apiKey = this.provider ? (this.provider.apiKey || '') : '';
    let baseUrl = this.provider ? this.provider.baseUrl : 'https://api.openai.com/v1';
    let noStainlessHeaders = Boolean(this.provider?.noStainlessHeaders);
    let requestMethod: 'requestUrl' | 'fetch' = this.provider?.requestMethod || 'requestUrl';
    let streamingMode: 'sse' | 'chunk' = this.provider?.streamingMode || 'sse';
    const customHeaders: Array<{ key: string; value: string }> = [];

    if (this.provider?.customHeaders) {
      for (const [k, v] of Object.entries(this.provider.customHeaders)) {
        customHeaders.push({ key: k, value: v });
      }
    }

    // 1. Header (Compact)
    const headerEl = contentEl.createDiv({ cls: 'emily-modal-header' });
    headerEl.createEl('h3', {
      cls: 'emily-modal-title',
      text: isEdit ? `프로바이더 수정: ${name || id}` : 'Add custom provider'
    });

    const formEl = contentEl.createDiv({ cls: 'emily-compact-form' });

    // 2. Row 1: ID * & Display Name * (2-Column Grid)
    const row1 = formEl.createDiv({ cls: 'emily-form-row-2col' });

    // ID Field
    const idGroup = row1.createDiv({ cls: 'emily-form-group' });
    idGroup.createEl('label', { text: 'ID *', cls: 'emily-form-label' });
    const idInput = idGroup.createEl('input', {
      type: 'text',
      cls: 'emily-form-input font-mono',
      value: id,
      attr: { placeholder: '예: goodus-primary, HOME, Gemini' }
    });

    // Display Name Field
    const nameGroup = row1.createDiv({ cls: 'emily-form-group' });
    nameGroup.createEl('label', { text: 'Display name (표시 이름) *', cls: 'emily-form-label' });
    const nameInput = nameGroup.createEl('input', {
      type: 'text',
      cls: 'emily-form-input',
      value: name,
      attr: { placeholder: '예: HOME, 집 서재 PC, Gemini' }
    });

    let isNameManuallyEdited = isEdit && Boolean(name && name !== id);

    if (isEdit) {
      idInput.disabled = true;
      idInput.addClass('is-disabled');
    } else {
      idInput.addEventListener('input', (e) => {
        id = (e.target as HTMLInputElement).value.trim();
        if (!isNameManuallyEdited) {
          name = (e.target as HTMLInputElement).value;
          nameInput.value = name;
        }
      });
    }

    nameInput.addEventListener('input', (e) => {
      name = (e.target as HTMLInputElement).value;
      isNameManuallyEdited = true;
    });

    // 3. Row 2: Provider Preset * & API Type * (2-Column Grid)
    const row2 = formEl.createDiv({ cls: 'emily-form-row-2col' });

    // Preset metadata definitions for 1-click auto-fill
    const PRESET_CONFIGS: Record<string, {
      defaultId: string;
      defaultName: string;
      baseUrl: string;
      apiType: string;
      keyPlaceholder: string;
      defaultModels: Array<{ id: string; displayName: string; enabled: boolean }>;
    }> = {
      ollama: {
        defaultId: 'ollama-local',
        defaultName: 'Ollama (Local)',
        baseUrl: 'http://localhost:11434/v1',
        apiType: 'OpenAI-compatible',
        keyPlaceholder: '로컬 구동이므로 공백 허용 (선택 사항)',
        defaultModels: [
          { id: 'llama3.2', displayName: 'Llama 3.2', enabled: true },
          { id: 'qwen2.5:32b', displayName: 'Qwen 2.5 32B', enabled: true },
          { id: 'mistral', displayName: 'Mistral', enabled: true }
        ]
      },
      lmstudio: {
        defaultId: 'lmstudio-local',
        defaultName: 'LM Studio (Local)',
        baseUrl: 'http://localhost:1234/v1',
        apiType: 'OpenAI-compatible',
        keyPlaceholder: '로컬 구동이므로 공백 허용 (선택 사항)',
        defaultModels: [
          { id: 'local-model', displayName: 'Loaded Local Model', enabled: true }
        ]
      },
      openai: {
        defaultId: 'openai-official',
        defaultName: 'OpenAI Official',
        baseUrl: 'https://api.openai.com/v1',
        apiType: 'OpenAI-compatible',
        keyPlaceholder: 'sk-proj-...',
        defaultModels: [
          { id: 'gpt-4o', displayName: 'GPT-4o', enabled: true },
          { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', enabled: true }
        ]
      },
      gemini: {
        defaultId: 'gemini-google',
        defaultName: 'Google Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        apiType: 'OpenAI-compatible',
        keyPlaceholder: 'AIzaSy...',
        defaultModels: [
          { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', enabled: true },
          { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', enabled: true }
        ]
      },
      openrouter: {
        defaultId: 'openrouter',
        defaultName: 'OpenRouter AI',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiType: 'OpenAI-compatible',
        keyPlaceholder: 'sk-or-v1-...',
        defaultModels: [
          { id: 'anthropic/claude-3.5-sonnet', displayName: 'Claude 3.5 Sonnet', enabled: true },
          { id: 'deepseek/deepseek-chat', displayName: 'DeepSeek V3', enabled: true }
        ]
      },
      deepseek: {
        defaultId: 'deepseek-official',
        defaultName: 'DeepSeek Official',
        baseUrl: 'https://api.deepseek.com/v1',
        apiType: 'OpenAI-compatible',
        keyPlaceholder: 'sk-...',
        defaultModels: [
          { id: 'deepseek-chat', displayName: 'DeepSeek-V3', enabled: true },
          { id: 'deepseek-reasoner', displayName: 'DeepSeek-R1 (Reasoner)', enabled: true }
        ]
      },
      groq: {
        defaultId: 'groq-cloud',
        defaultName: 'Groq Cloud',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiType: 'OpenAI-compatible',
        keyPlaceholder: 'gsk_...',
        defaultModels: [
          { id: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B', enabled: true }
        ]
      },
      vllm: {
        defaultId: 'vllm-proxy',
        defaultName: 'vLLM Local Proxy',
        baseUrl: 'http://localhost:8000/v1',
        apiType: 'OpenAI-compatible',
        keyPlaceholder: '로컬 환경 키 (선택 사항)',
        defaultModels: [
          { id: 'default', displayName: 'Default vLLM Model', enabled: true }
        ]
      },
      anthropic: {
        defaultId: 'anthropic-proxy',
        defaultName: 'Anthropic Proxy',
        baseUrl: 'https://api.anthropic.com/v1',
        apiType: 'OpenAI-compatible',
        keyPlaceholder: 'sk-ant-...',
        defaultModels: [
          { id: 'claude-3-5-sonnet-latest', displayName: 'Claude 3.5 Sonnet', enabled: true }
        ]
      }
    };

    // Preset Field
    const presetGroup = row2.createDiv({ cls: 'emily-form-group' });
    presetGroup.createEl('label', { text: 'Provider preset (원클릭 자동완성) *', cls: 'emily-form-label' });
    const presetSelect = presetGroup.createEl('select', { cls: 'emily-form-select dropdown' });
    const presetOptions = [
      { val: 'custom', label: 'Custom (직접 설정)' },
      { val: 'ollama', label: '⚡ Ollama (Localhost:11434)' },
      { val: 'lmstudio', label: '⚡ LM Studio (Localhost:1234)' },
      { val: 'openai', label: '🌐 OpenAI (Official)' },
      { val: 'gemini', label: '🌐 Google Gemini' },
      { val: 'openrouter', label: '🌐 OpenRouter (Multi-Model)' },
      { val: 'deepseek', label: '🌐 DeepSeek' },
      { val: 'groq', label: '⚡ Groq (Ultra Fast)' },
      { val: 'vllm', label: '💻 vLLM / Local Server' },
      { val: 'anthropic', label: '🌐 Anthropic Proxy' }
    ];
    for (const opt of presetOptions) {
      const optionEl = presetSelect.createEl('option', { value: opt.val, text: opt.label });
      if (opt.val === preset) optionEl.selected = true;
    }
    presetSelect.addEventListener('change', (e) => {
      preset = (e.target as HTMLSelectElement).value;
      const cfg = PRESET_CONFIGS[preset];
      if (cfg) {
        baseUrl = cfg.baseUrl;
        baseUrlInput.value = baseUrl;
        apiType = cfg.apiType;
        typeInput.value = apiType;
        keyInput.placeholder = cfg.keyPlaceholder;

        if (!isEdit) {
          if (!id || id === 'new-provider' || Object.values(PRESET_CONFIGS).some(c => c.defaultId === id)) {
            id = cfg.defaultId;
            idInput.value = id;
          }
          if (!name || Object.values(PRESET_CONFIGS).some(c => c.defaultName === name)) {
            name = cfg.defaultName;
            nameInput.value = name;
          }
        }
      }
    });

    // API Type
    const typeGroup = row2.createDiv({ cls: 'emily-form-group' });
    typeGroup.createEl('label', { text: 'API type *', cls: 'emily-form-label' });
    const typeInput = typeGroup.createEl('input', {
      type: 'text',
      cls: 'emily-form-input font-mono',
      value: apiType,
      attr: { placeholder: 'OpenAI-compatible' }
    });
    typeInput.addEventListener('input', (e) => {
      apiType = (e.target as HTMLInputElement).value.trim();
    });

    // 4. Row 3: Base URL * (Full Width)
    const urlGroup = formEl.createDiv({ cls: 'emily-form-group' });
    urlGroup.createEl('label', { text: 'Base URL *', cls: 'emily-form-label' });
    const baseUrlInput = urlGroup.createEl('input', {
      type: 'text',
      cls: 'emily-form-input font-mono',
      value: baseUrl,
      attr: { placeholder: 'http://localhost:11434/v1' }
    });
    baseUrlInput.addEventListener('input', (e) => {
      baseUrl = (e.target as HTMLInputElement).value.trim();
    });

    // 4. Row 3: API Key (Full Width with compact eye toggle)
    const keyGroup = formEl.createDiv({ cls: 'emily-form-group' });
    const keyLabelRow = keyGroup.createDiv({ cls: 'emily-form-label' });
    keyLabelRow.createSpan({ text: 'API key' });
    keyLabelRow.createSpan({ text: '로컬 Ollama/vLLM인 경우 공백 허용', cls: 'emily-form-label-hint' });

    const keyWrapper = keyGroup.createDiv({ cls: 'emily-input-with-action' });
    const keyInput = keyWrapper.createEl('input', {
      type: 'password',
      cls: 'emily-form-input font-mono',
      value: apiKey,
      attr: { placeholder: 'Enter API key (선택 사항)' }
    });
    keyInput.addEventListener('input', (e) => {
      apiKey = (e.target as HTMLInputElement).value.trim();
    });

    const toggleEyeBtn = keyWrapper.createEl('button', {
      cls: 'emily-input-action-btn emily-icon-btn',
      attr: { title: 'Toggle visibility' }
    });
    setIcon(toggleEyeBtn, 'eye');
    toggleEyeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        setIcon(toggleEyeBtn, 'eye-off');
      } else {
        keyInput.type = 'password';
        setIcon(toggleEyeBtn, 'eye');
      }
    });

    // 5. Collapsible Section: ⚙️ 고급 네트워크 및 헤더 옵션 (Advanced Options)
    const advToggleBar = formEl.createDiv({ cls: 'emily-advanced-toggle-bar' });
    const advToggleLeft = advToggleBar.createSpan({ cls: 'emily-advanced-toggle-title' });

    const advPanel = formEl.createDiv({
      cls: `emily-advanced-panel ${this.isAdvancedOpen ? '' : 'is-hidden'}`
    });

    const updateAdvVisibility = () => {
      advToggleLeft.setText(
        this.isAdvancedOpen
          ? '▼ 고급 옵션 접기 (Request method, Streaming, Headers)'
          : '▶ 고급 옵션 펼치기 (Request method, Streaming, Headers)'
      );
      if (this.isAdvancedOpen) {
        advToggleBar.addClass('is-open');
        advPanel.removeClass('is-hidden');
      } else {
        advToggleBar.removeClass('is-open');
        advPanel.addClass('is-hidden');
      }
    };
    updateAdvVisibility();

    advToggleBar.addEventListener('click', () => {
      this.isAdvancedOpen = !this.isAdvancedOpen;
      updateAdvVisibility();
    });

    // Advanced Row 1: Network Request Method & Streaming Mode (2-Column Grid)
    const advRow1 = advPanel.createDiv({ cls: 'emily-form-row-2col' });

    const methodGroup = advRow1.createDiv({ cls: 'emily-form-group' });
    methodGroup.createEl('label', { text: 'Network request method', cls: 'emily-form-label' });
    const methodSelect = methodGroup.createEl('select', { cls: 'emily-form-select dropdown text-xs' });
    const methodOpts = [
      { val: 'requestUrl', label: 'Obsidian requestUrl (권장, CORS 우회)' },
      { val: 'fetch', label: 'Native fetch' }
    ];
    for (const opt of methodOpts) {
      const optionEl = methodSelect.createEl('option', { value: opt.val, text: opt.label });
      if (opt.val === requestMethod) optionEl.selected = true;
    }
    methodSelect.addEventListener('change', (e) => {
      requestMethod = (e.target as HTMLSelectElement).value as 'requestUrl' | 'fetch';
    });

    const streamGroup = advRow1.createDiv({ cls: 'emily-form-group' });
    streamGroup.createEl('label', { text: 'Response streaming mode', cls: 'emily-form-label' });
    const streamSelect = streamGroup.createEl('select', { cls: 'emily-form-select dropdown text-xs' });
    const streamOpts = [
      { val: 'sse', label: 'Server-Sent Events (SSE)' },
      { val: 'chunk', label: 'Chunk Stream' }
    ];
    for (const opt of streamOpts) {
      const optionEl = streamSelect.createEl('option', { value: opt.val, text: opt.label });
      if (opt.val === streamingMode) optionEl.selected = true;
    }
    streamSelect.addEventListener('change', (e) => {
      streamingMode = (e.target as HTMLSelectElement).value as 'sse' | 'chunk';
    });

    // Advanced Row 2: No stainless headers inline toggle
    const stainlessRow = advPanel.createDiv({ cls: 'emily-inline-toggle-row' });
    stainlessRow.createEl('label', {
      text: 'No stainless headers (Stainless SDK 메타 헤더 억제)',
      cls: 'text-xs'
    });
    new ToggleComponent(stainlessRow)
      .setValue(noStainlessHeaders)
      .onChange((val) => {
        noStainlessHeaders = val;
      });

    // Advanced Row 3: Custom Headers (Compact)
    const customHeaderSection = advPanel.createDiv({ cls: 'emily-custom-headers-section' });
    const headerTitleRow = customHeaderSection.createDiv({ cls: 'emily-custom-headers-title-row' });
    headerTitleRow.createEl('label', { text: t.settings.customHeadersTitle, cls: 'emily-form-label' });

    const addHeaderBtn = headerTitleRow.createEl('button', {
      text: t.settings.addHeaderBtn,
      cls: 'emily-btn-secondary text-xs'
    });

    const headersListContainer = customHeaderSection.createDiv({ cls: 'emily-headers-list' });

    const renderHeaderRows = () => {
      headersListContainer.empty();
      if (customHeaders.length === 0) {
        headersListContainer.createDiv({ cls: 'text-muted text-xs', text: '설정된 사용자 정의 헤더가 없습니다.' });
      } else {
        customHeaders.forEach((item, idx) => {
          const row = headersListContainer.createDiv({ cls: 'emily-header-row' });
          const kInput = row.createEl('input', {
            type: 'text',
            cls: 'emily-form-input font-mono text-xs',
            value: item.key,
            attr: { placeholder: 'Header Key (예: X-Title)' }
          });
          kInput.addEventListener('input', (e) => {
            item.key = (e.target as HTMLInputElement).value;
          });

          const vInput = row.createEl('input', {
            type: 'text',
            cls: 'emily-form-input font-mono text-xs',
            value: item.value,
            attr: { placeholder: 'Header Value' }
          });
          vInput.addEventListener('input', (e) => {
            item.value = (e.target as HTMLInputElement).value;
          });

          const delBtn = row.createEl('button', { cls: 'emily-icon-btn', attr: { title: 'Delete' } });
          setIcon(delBtn, 'trash');
          delBtn.addEventListener('click', (e) => {
            e.preventDefault();
            customHeaders.splice(idx, 1);
            renderHeaderRows();
          });
        });
      }
    };

    renderHeaderRows();

    addHeaderBtn.addEventListener('click', (e) => {
      e.preventDefault();
      customHeaders.push({ key: '', value: '' });
      renderHeaderRows();
    });

    // 6. Modal Footer Actions (Compact)
    const footerEl = contentEl.createDiv({ cls: 'emily-modal-footer' });
    const cancelBtn = footerEl.createEl('button', {
      text: '취소',
      cls: 'emily-btn-secondary'
    });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = footerEl.createEl('button', {
      text: isEdit ? '💾 변경 저장' : '✓ 프로바이더 등록',
      cls: 'emily-btn-cta'
    });
    saveBtn.addEventListener('click', () => {
      void (async () => {
        const cleanId = id.trim();
        if (!cleanId) {
          new Notice('프로바이더 ID를 입력해 주세요.');
          idInput.focus();
          return;
        }

        const cleanBaseUrl = baseUrl.trim();
        if (!cleanBaseUrl) {
          new Notice('Base URL을 입력해 주세요.');
          baseUrlInput.focus();
          return;
        }

        const headersObj: Record<string, string> = {};
        for (const h of customHeaders) {
          if (h.key.trim()) {
            headersObj[h.key.trim()] = h.value;
          }
        }

        const initialModels = this.provider?.models || (
          PRESET_CONFIGS[preset]?.defaultModels?.length
            ? PRESET_CONFIGS[preset].defaultModels
            : [{ id: 'auto', displayName: 'Default Auto', enabled: true }]
        );

        const updatedProvider: AIProviderConfig = {
          id: cleanId,
          name: name.trim() || cleanId,
          preset,
          apiType: apiType || 'OpenAI-compatible',
          baseUrl: cleanBaseUrl,
          apiKey: apiKey.trim() || undefined,
          models: initialModels,
          customHeaders: Object.keys(headersObj).length > 0 ? headersObj : undefined,
          noStainlessHeaders,
          requestMethod,
          streamingMode
        };

        if (!this.plugin.settings.providers) {
          this.plugin.settings.providers = [];
        }

        if (isEdit) {
          const idx = this.plugin.settings.providers.findIndex((p) => p.id === cleanId);
          if (idx !== -1) {
            this.plugin.settings.providers[idx] = updatedProvider;
          } else {
            this.plugin.settings.providers.push(updatedProvider);
          }
        } else {
          // 중복 ID 방지
          const exists = this.plugin.settings.providers.some((p) => p.id === cleanId);
          if (exists) {
            new Notice(`이미 존재하는 프로바이더 ID입니다: ${cleanId}`);
            return;
          }
          this.plugin.settings.providers.push(updatedProvider);

          // 첫 번째 프로바이더인 경우 자동 기본값 설정
          if (!this.plugin.settings.defaultProviderId) {
            this.plugin.settings.defaultProviderId = updatedProvider.id;
          }
        }

        await this.plugin.saveSettings();
        this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
        new Notice(`✓ 프로바이더가 안전하게 저장되었습니다: ${updatedProvider.name}`);
        this.onSaveCallback(updatedProvider);
        this.close();
      })();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
