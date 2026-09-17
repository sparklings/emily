import { App, Modal, Notice, setIcon } from 'obsidian';
import type EmilyPlugin from '../main';
import { DeviceKeyProfile } from '../types/settings';
import { getTranslation } from '../i18n';
import { setActiveProfileId, getActiveProfileId } from '../utils/deviceKeyManager';

/**
 * 기기 프로필 추가/수정 모달 클래스
 * - 설정 탭 본문의 대형 인라인 폼을 대체하여 컴팩트한 팝업 모달 형태로 제공
 */
export class DeviceProfileModal extends Modal {
  private plugin: EmilyPlugin;
  private profile: DeviceKeyProfile | null;
  private onSaveCallback: (savedProfile: DeviceKeyProfile) => void;

  constructor(
    app: App,
    plugin: EmilyPlugin,
    profile: DeviceKeyProfile | null,
    onSave: (savedProfile: DeviceKeyProfile) => void
  ) {
    super(app);
    this.plugin = plugin;
    this.profile = profile;
    this.onSaveCallback = onSave;
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass('emily-device-modal');

    const t = getTranslation(this.plugin.settings.language);
    const isEdit = Boolean(this.profile);

    let name = this.profile ? this.profile.name : '';
    let url = this.profile ? (this.profile.url || this.profile.provider1Url || '') : '';
    let apiKey = this.profile ? (this.profile.apiKey || this.profile.provider1Key || '') : '';

    // 1. Header: Title
    const headerEl = contentEl.createDiv({ cls: 'emily-modal-header' });
    headerEl.createEl('h3', {
      cls: 'emily-modal-title',
      text: isEdit ? `기기 프로필 수정 (${this.profile?.name})` : '새 기기 프로필 추가'
    });

    // 2. Form Container
    const formEl = contentEl.createDiv({ cls: 'emily-modal-form' });

    // Row 1: 기기 이름 (Label) & 포트/URL
    const row1 = formEl.createDiv({ cls: 'emily-modal-row-2col' });

    const nameGroup = row1.createDiv({ cls: 'emily-modal-field' });
    nameGroup.createEl('label', { text: '기기 이름', cls: 'emily-modal-label' });
    const nameInput = nameGroup.createEl('input', {
      type: 'text',
      cls: 'emily-modal-input',
      value: name,
      attr: { placeholder: '예: 회사 노트북 1, 집 노트북' }
    });
    nameInput.addEventListener('input', (e) => {
      name = (e.target as HTMLInputElement).value;
    });

    const urlGroup = row1.createDiv({ cls: 'emily-modal-field' });
    urlGroup.createEl('label', { text: '포트 또는 엔드포인트 URL', cls: 'emily-modal-label' });
    const urlInput = urlGroup.createEl('input', {
      type: 'text',
      cls: 'emily-modal-input font-mono',
      value: url,
      attr: { placeholder: '예: 11434 또는 http://127.0.0.1:11434/v1' }
    });
    urlInput.addEventListener('input', (e) => {
      url = (e.target as HTMLInputElement).value;
    });

    // Row 2: API Key
    const keyGroup = formEl.createDiv({ cls: 'emily-modal-field' });
    const keyHeader = keyGroup.createDiv({ cls: 'emily-modal-label-row' });
    keyHeader.createEl('label', { text: 'API Key', cls: 'emily-modal-label' });
    keyHeader.createSpan({ text: '미입력 시 전역 공용 키 사용', cls: 'emily-modal-hint' });

    const keyWrapper = keyGroup.createDiv({ cls: 'emily-modal-input-wrapper' });
    const keyInput = keyWrapper.createEl('input', {
      type: 'password',
      cls: 'emily-modal-input font-mono',
      value: apiKey,
      attr: { placeholder: 'paste key here' }
    });
    keyInput.addEventListener('input', (e) => {
      apiKey = (e.target as HTMLInputElement).value;
    });

    const toggleEyeBtn = keyWrapper.createEl('button', { cls: 'emily-icon-btn', attr: { title: 'Toggle Visibility' } });
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

    // 3. Footer actions
    const footerEl = contentEl.createDiv({ cls: 'emily-modal-footer' });
    const cancelBtn = footerEl.createEl('button', {
      text: '취소',
      cls: 'emily-btn-secondary'
    });
    cancelBtn.addEventListener('click', () => this.close());

    const submitBtn = footerEl.createEl('button', {
      text: isEdit ? '💾 변경 저장' : '➕ 기기 프로필 추가',
      cls: 'emily-btn-cta'
    });
    submitBtn.addEventListener('click', () => {
      void (async () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
          new Notice('기기 이름을 입력해 주세요.');
          nameInput.focus();
          return;
        }

        if (isEdit && this.profile) {
          this.profile.name = trimmedName;
          this.profile.url = url.trim() || undefined;
          this.profile.apiKey = apiKey.trim() || undefined;
          await this.plugin.saveSettings();
          this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
          this.onSaveCallback(this.profile);
        } else {
          const newProfile: DeviceKeyProfile = {
            id: `dev-${Date.now()}`,
            name: trimmedName,
            url: url.trim() || undefined,
            apiKey: apiKey.trim() || undefined
          };
          if (!this.plugin.settings.deviceProfiles) {
            this.plugin.settings.deviceProfiles = [];
          }
          this.plugin.settings.deviceProfiles.push(newProfile);

          // If no active profile was bound, auto-bind this one
          const curActive = getActiveProfileId();
          if (!curActive || curActive === '__global__') {
            setActiveProfileId(newProfile.id);
          }

          await this.plugin.saveSettings();
          this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
          this.onSaveCallback(newProfile);
        }

        new Notice(t.settings.profileSaveSuccessNotice);
        this.close();
      })();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
