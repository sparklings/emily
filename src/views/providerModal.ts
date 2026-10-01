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

    // Preset Field
    const presetGroup = row2.createDiv({ cls: 'emily-form-group' });
    presetGroup.createEl('label', { text: 'Provider preset *', cls: 'emily-form-label' });
    const presetSelect = presetGroup.createEl('select', { cls: 'emily-form-select dropdown' });
    const presetOptions = [
      { val: 'custom', label: 'Custom' },
      { val: 'openai', label: 'OpenAI' },
      { val: 'gemini', label: 'Google Gemini' },
      { val: 'ollama', label: 'Ollama (Localhost)' },
      { val: 'vllm', label: 'vLLM / Local Proxy' },
      { val: 'anthropic', label: 'Anthropic Claude' }
    ];
    for (const opt of presetOptions) {
      const optionEl = presetSelect.createEl('option', { value: opt.val, text: opt.label });
      if (opt.val === preset) optionEl.selected = true;
    }
    presetSelect.addEventListener('change', (e) => {
      preset = (e.target as HTMLSelectElement).value;
      if (!isEdit) {
        if (preset === 'gemini') {
          baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/';
        } else if (preset === 'ollama') {
          baseUrl = 'http://localhost:11434/v1';
        } else if (preset === 'vllm') {
          baseUrl = 'http://localhost:8000/v1';
        } else if (preset === 'openai') {
          baseUrl = 'https://api.openai.com/v1';
        }
        baseUrlInput.value = baseUrl;
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

        const updatedProvider: AIProviderConfig = {
          id: cleanId,
          name: name.trim() || cleanId,
          preset,
          apiType: apiType || 'OpenAI-compatible',
          baseUrl: cleanBaseUrl,
          apiKey: apiKey.trim() || undefined,
          models: this.provider?.models || [
            { id: 'auto', displayName: 'Default Auto', enabled: true }
          ],
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
