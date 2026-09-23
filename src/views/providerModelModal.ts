import { App, Modal, Notice, ToggleComponent } from 'obsidian';
import type EmilyPlugin from '../main';
import { ProviderModelConfig, AIProviderConfig } from '../types/settings';

/**
 * YOLO 스타일 프로바이더 모델 추가 및 편집 모달 (Compact Grid Layout)
 */
export class ProviderModelModal extends Modal {
  private plugin: EmilyPlugin;
  private provider: AIProviderConfig;
  private model: ProviderModelConfig | null;
  private onSaveCallback: (model: ProviderModelConfig) => void;

  constructor(
    app: App,
    plugin: EmilyPlugin,
    provider: AIProviderConfig,
    model: ProviderModelConfig | null,
    onSave: (model: ProviderModelConfig) => void
  ) {
    super(app);
    this.plugin = plugin;
    this.provider = provider;
    this.model = model;
    this.onSaveCallback = onSave;
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass('emily-model-modal');

    const isEdit = Boolean(this.model);

    let displayName = this.model ? this.model.displayName : '';
    let id = this.model ? this.model.id : '';
    let enabled = this.model ? this.model.enabled : true;

    // Header
    const headerEl = contentEl.createDiv({ cls: 'emily-modal-header' });
    headerEl.createEl('h3', {
      cls: 'emily-modal-title',
      text: isEdit ? `모델 수정: ${this.model?.displayName}` : `새 채팅 모델 추가 (${this.provider.name})`
    });

    const formEl = contentEl.createDiv({ cls: 'emily-compact-form' });

    // 1. Row 1: Display name & Model ID (2-Column Grid)
    const row1 = formEl.createDiv({ cls: 'emily-form-row-2col' });

    const nameGroup = row1.createDiv({ cls: 'emily-form-group' });
    nameGroup.createEl('label', { text: 'Display name *', cls: 'emily-form-label' });
    const nameInput = nameGroup.createEl('input', {
      type: 'text',
      cls: 'emily-form-input',
      value: displayName,
      attr: { placeholder: '예: Qwen 2.5 32B, Gemini Flash' }
    });
    nameInput.addEventListener('input', (e) => {
      displayName = (e.target as HTMLInputElement).value;
    });

    const idGroup = row1.createDiv({ cls: 'emily-form-group' });
    idGroup.createEl('label', { text: 'Model (calling ID) *', cls: 'emily-form-label' });
    const idInput = idGroup.createEl('input', {
      type: 'text',
      cls: 'emily-form-input font-mono',
      value: id,
      attr: { placeholder: '예: qwen2.5:32b, gemini-2.5-flash' }
    });
    idInput.addEventListener('input', (e) => {
      id = (e.target as HTMLInputElement).value.trim();
      if (!displayName) displayName = id;
    });

    // 2. Row 2: Enable Toggle (Inline)
    const enableRow = formEl.createDiv({ cls: 'emily-inline-toggle-row' });
    enableRow.createEl('label', { text: '모델 활성화 (Enable this model)', cls: 'text-xs font-semibold' });
    new ToggleComponent(enableRow)
      .setValue(enabled)
      .onChange((val) => {
        enabled = val;
      });

    // 3. Footer actions
    const footerEl = contentEl.createDiv({ cls: 'emily-modal-footer' });
    const cancelBtn = footerEl.createEl('button', {
      text: '취소',
      cls: 'emily-btn-secondary'
    });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = footerEl.createEl('button', {
      text: isEdit ? '💾 모델 변경 저장' : '+ 모델 추가',
      cls: 'emily-btn-cta'
    });
    saveBtn.addEventListener('click', () => {
      void (async () => {
        const cleanId = id.trim();
        const cleanName = displayName.trim() || cleanId;
        if (!cleanId) {
          new Notice('모델 식별자(calling ID)를 입력해 주세요.');
          idInput.focus();
          return;
        }

        const updatedModel: ProviderModelConfig = {
          id: cleanId,
          displayName: cleanName,
          enabled
        };

        if (!this.provider.models) {
          this.provider.models = [];
        }

        if (isEdit && this.model) {
          const idx = this.provider.models.findIndex((m) => m.id === this.model!.id);
          if (idx !== -1) {
            this.provider.models[idx] = updatedModel;
          } else {
            this.provider.models.push(updatedModel);
          }
        } else {
          const exists = this.provider.models.some((m) => m.id === cleanId);
          if (exists) {
            new Notice(`이미 존재하는 모델 ID입니다: ${cleanId}`);
            return;
          }
          this.provider.models.push(updatedModel);
        }

        await this.plugin.saveSettings();
        this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
        new Notice(`✓ 모델이 저장되었습니다: ${cleanName}`);
        this.onSaveCallback(updatedModel);
        this.close();
      })();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
