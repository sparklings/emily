import { App, PluginSettingTab, Setting, Notice, setIcon, SettingDefinitionItem } from 'obsidian';
import type EmilyPlugin from '../main';
import { getTranslation, getObsidianLanguage, getDefaultTargetLanguageName, getSourceLanguages, getSupportedLanguages, getLocalizedLanguageName, normalizeLanguageCode } from '../i18n';
import { TranslationStrings } from '../i18n/types';
import { getSystemContext } from '../utils/systemInfo';
import { TranslationScope, PreservationStrategy, TranslationTone, TranslationStyle } from '../types/translation';
import { DeviceKeyProfile } from '../types/settings';
import {
  getDeviceHostname,
  getDeviceDisplayName,
  resolveEffectiveApiKey,
  resolveEffectiveEndpoint,
  applyPortOrUrl,
  getCandidateKeys,
  getCandidatePorts,
  isLocalEndpoint
} from '../utils/deviceKeyManager';

/**
 * Assistant Emily 환경 설정 탭 뷰 클래스
 * - 옵시디언 설정 화면에서 API 연결, 표시 언어, 교열 및 번역 기본 옵션을 구성
 */
export class EmilySettingTab extends PluginSettingTab {
  plugin: EmilyPlugin;
  private selectedProviderTab: 'default' | 'devices' = 'default';
  private editingProfileId: string | null = null;
  private switchTabFn: ((tab: 'default' | 'devices') => void) | null = null;

  constructor(app: App, plugin: EmilyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Declarative setting definitions for Obsidian 1.13+ settings search compatibility.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [];
  }

  /**
   * 설정 탭 화면 요소를 렌더링하고 사용자 입력 이벤트를 바인딩합니다.
   */
  display(): void {
    this.renderSettings(this.containerEl);
  }

  private renderSettings(containerEl: HTMLElement): void {
    containerEl.empty();
    const t = getTranslation(this.plugin.settings.language);

    new Setting(containerEl).setName(t.settings.title).setDesc(t.settings.description).setHeading();

    // Top Level: Interface Language Setting
    const detectedLangCode = getObsidianLanguage();
    const detectedLangName = detectedLangCode.startsWith('ko') ? '한국어 (Korean)' : 'English';
    const autoOptionLabel = `${t.settings.languageAuto} (${detectedLangName})`;

    new Setting(containerEl)
      .setName(t.settings.languageTitle)
      .setDesc(t.settings.languageDesc)
      .addDropdown((dropdown) => {
        dropdown.addOption('auto', autoOptionLabel);
        dropdown.addOption('en', t.settings.languageEn);
        dropdown.addOption('ko', t.settings.languageKo);
        dropdown
          .setValue(this.plugin.settings.language || 'auto')
          .onChange(async (val: string) => {
            this.plugin.settings.language = val as 'auto' | 'en' | 'ko';
            await this.plugin.saveSettings();
            this.renderSettings(containerEl);
            this.plugin.syncSidebarSettings();
            this.plugin.refreshFloatingControls();
          });
      });

    // =========================================================================
    // Section 1: AI 서비스 프로바이더 (AI Service Providers)
    // =========================================================================
    new Setting(containerEl).setName(t.settings.providerSectionHeading).setDesc(t.settings.providerSectionDesc).setHeading();

    // AI 서비스 프로바이더 설정 (Tab 네비게이션)
    this.renderProviderTabs(containerEl, t);

    // =========================================================================
    // Section 2: 교열 기본 설정 (Proofreading Preferences)
    // =========================================================================
    new Setting(containerEl).setName(t.settings.proofreadSectionTitle).setDesc(t.settings.proofreadSectionDesc).setHeading();

    new Setting(containerEl)
      .setName(t.settings.proofreadSpellingTitle)
      .setDesc(t.settings.proofreadSpellingDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.defaultProofreadSpelling)
          .onChange(async (val) => {
            this.plugin.settings.defaultProofreadSpelling = val;
            await this.plugin.saveSettings();
            this.plugin.syncSidebarSettings();
          })
      );

    new Setting(containerEl)
      .setName(t.settings.proofreadGrammarTitle)
      .setDesc(t.settings.proofreadGrammarDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.defaultProofreadGrammar)
          .onChange(async (val) => {
            this.plugin.settings.defaultProofreadGrammar = val;
            await this.plugin.saveSettings();
            this.plugin.syncSidebarSettings();
          })
      );

    new Setting(containerEl)
      .setName(t.settings.proofreadTimestampTitle)
      .setDesc(t.settings.proofreadTimestampDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.defaultProofreadTimestamp)
          .onChange(async (val) => {
            this.plugin.settings.defaultProofreadTimestamp = val;
            await this.plugin.saveSettings();
            this.plugin.syncSidebarSettings();
          })
      );

    // =========================================================================
    // Section 4: 번역 기본 설정 (Translation Preferences)
    // =========================================================================
    new Setting(containerEl).setName(t.settings.translationSectionTitle).setDesc(t.settings.translationSectionDesc).setHeading();

    new Setting(containerEl)
      .setName(t.settings.transEnabledTitle)
      .setDesc(t.settings.transEnabledDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.defaultTranslationEnabled)
          .onChange(async (val) => {
            this.plugin.settings.defaultTranslationEnabled = val;
            await this.plugin.saveSettings();
            this.plugin.syncSidebarSettings();
          })
      );

    const srcLanguages = getSourceLanguages(t);
    new Setting(containerEl)
      .setName(t.settings.transSourceTitle)
      .setDesc(t.settings.transSourceDesc)
      .addDropdown((dropdown) => {
        srcLanguages.forEach((lang) => {
          dropdown.addOption(lang.name, lang.name);
        });
        const currentSrc = this.plugin.settings.defaultTranslationSource;
        const currentSrcLocalized = getLocalizedLanguageName(currentSrc, t);
        const currentSrcCode = normalizeLanguageCode(currentSrc);
        const matchedSrc = srcLanguages.find(l =>
          l.name === currentSrcLocalized ||
          l.name === currentSrc ||
          l.code === currentSrcCode ||
          (currentSrcCode === 'auto' && l.code === 'auto')
        );
        dropdown
          .setValue(matchedSrc ? matchedSrc.name : t.languages.auto)
          .onChange(async (val) => {
            this.plugin.settings.defaultTranslationSource = val;
            await this.plugin.saveSettings();
            this.plugin.syncSidebarSettings();
          });
      });

    const tgtLanguages = getSupportedLanguages(t);
    const defaultTgtLang = this.plugin.settings.defaultTranslationTarget || getDefaultTargetLanguageName(t);
    new Setting(containerEl)
      .setName(t.settings.transTargetTitle)
      .setDesc(t.settings.transTargetDesc)
      .addDropdown((dropdown) => {
        tgtLanguages.forEach((lang) => {
          dropdown.addOption(lang.name, lang.name);
        });
        const currentTgtLocalized = getLocalizedLanguageName(defaultTgtLang, t);
        const currentTgtCode = normalizeLanguageCode(defaultTgtLang);
        const matchedTgt = tgtLanguages.find(l =>
          l.name === currentTgtLocalized ||
          l.name === defaultTgtLang ||
          l.code === currentTgtCode
        );
        dropdown
          .setValue(matchedTgt ? matchedTgt.name : (tgtLanguages[0]?.name || defaultTgtLang))
          .onChange(async (val) => {
            this.plugin.settings.defaultTranslationTarget = val;
            await this.plugin.saveSettings();
            this.plugin.syncSidebarSettings();
          });
      });

    new Setting(containerEl)
      .setName(t.settings.transScopeTitle)
      .setDesc(t.settings.transScopeDesc)
      .addDropdown((dropdown) => {
        dropdown.addOption('selection', t.scopes.selection);
        dropdown.addOption('all', t.scopes.all);
        dropdown.addOption('paragraph_bilingual', t.scopes.paragraphBilingual);
        dropdown
          .setValue(this.plugin.settings.defaultTranslationScope || 'selection')
          .onChange(async (val: TranslationScope) => {
            this.plugin.settings.defaultTranslationScope = val;
            await this.plugin.saveSettings();
            this.plugin.syncSidebarSettings();
          });
      });

    new Setting(containerEl)
      .setName(t.settings.transPreserveTitle)
      .setDesc(t.settings.transPreserveDesc)
      .addDropdown((dropdown) => {
        dropdown.addOption('new_file', t.preservation.newFile);
        dropdown.addOption('append', t.preservation.append);
        dropdown.addOption('overwrite', t.preservation.overwrite);
        dropdown
          .setValue(this.plugin.settings.defaultPreservationStrategy || 'new_file')
          .onChange(async (val: PreservationStrategy) => {
            this.plugin.settings.defaultPreservationStrategy = val;
            await this.plugin.saveSettings();
            this.plugin.syncSidebarSettings();
          });
      });

    new Setting(containerEl)
      .setName(t.settings.transToneTitle)
      .setDesc(t.settings.transToneDesc)
      .addDropdown((dropdown) => {
        dropdown.addOption('academic', t.tones.academic);
        dropdown.addOption('polite', t.tones.polite);
        dropdown.addOption('casual', t.tones.casual);
        dropdown
          .setValue(this.plugin.settings.defaultTranslationTone || 'academic')
          .onChange(async (val: string) => {
            this.plugin.settings.defaultTranslationTone = val as TranslationTone;
            await this.plugin.saveSettings();
            this.plugin.syncSidebarSettings();
          });
      });

    new Setting(containerEl)
      .setName(t.settings.transStyleTitle)
      .setDesc(t.settings.transStyleDesc)
      .addDropdown((dropdown) => {
        dropdown.addOption('balanced', t.styles.balanced);
        dropdown.addOption('literal', t.styles.literal);
        dropdown.addOption('natural', t.styles.natural);
        dropdown
          .setValue(this.plugin.settings.defaultTranslationStyle || 'balanced')
          .onChange(async (val: string) => {
            this.plugin.settings.defaultTranslationStyle = val as TranslationStyle;
            await this.plugin.saveSettings();
            this.plugin.syncSidebarSettings();
          });
      });

    new Setting(containerEl)
      .setName(t.settings.transCodeCommentsTitle)
      .setDesc(t.settings.transCodeCommentsDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.defaultTranslateCodeComments || false)
          .onChange(async (val) => {
            this.plugin.settings.defaultTranslateCodeComments = val;
            await this.plugin.saveSettings();
            this.plugin.syncSidebarSettings();
          })
      );

    // =========================================================================
    // Section 5: 에디터 및 인터페이스 환경설정 (Editor Preferences)
    // =========================================================================
    new Setting(containerEl).setName(t.settings.editorPreferencesHeader).setHeading();

    new Setting(containerEl)
      .setName(t.settings.koreanBoldTitle)
      .setDesc(t.settings.koreanBoldDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoProofreadKoreanBold)
          .onChange(async (val) => {
            this.plugin.settings.autoProofreadKoreanBold = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t.settings.floatingScrollTitle)
      .setDesc(t.settings.floatingScrollDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showFloatingScrollButtons)
          .onChange(async (val) => {
            this.plugin.settings.showFloatingScrollButtons = val;
            await this.plugin.saveSettings();
            this.plugin.refreshFloatingControls();
          })
      );
  }

  private renderTestResult(
    container: HTMLElement,
    result: {
      success: boolean;
      message: string;
      latencyMs: number;
      model: string;
      error?: string;
      keySource?: 'local' | 'profile' | 'global';
      urlSource?: 'local' | 'profile' | 'global';
      profileName?: string;
      testedKey?: string;
      testedUrl?: string;
      isLocalhost?: boolean;
    },
    t: TranslationStrings,
    _providerId?: 'primary' | 'secondary'
  ): void {
    container.empty();
    const badgeRow = container.createDiv({ cls: 'emily-test-badge-row' });
    if (result.success) {
      const successBadge = badgeRow.createSpan({ cls: 'emily-badge is-success' });
      successBadge.setText(`✓ ${t.settings.sayHelloSuccess} (${result.latencyMs}ms)`);
      const modelBadge = badgeRow.createSpan({ cls: 'emily-badge' });
      modelBadge.setText(result.model);

      if (result.urlSource === 'profile' && result.profileName) {
        const urlBadge = badgeRow.createSpan({ cls: 'emily-badge is-done' });
        urlBadge.setText(`🔌 [${result.profileName}] 포트/URL 적용`);
      }

      if (result.keySource === 'profile' && result.profileName) {
        const keyBadge = badgeRow.createSpan({ cls: 'emily-badge is-done' });
        keyBadge.setText(`🏢 ${t.settings.profileKeyActiveBadge.replace('{name}', result.profileName)}`);
      } else {
        const keyBadge = badgeRow.createSpan({ cls: 'emily-badge' });
        keyBadge.setText(`🌐 ${t.settings.globalKeyActiveBadge}`);
      }

      const msgBox = container.createDiv({ cls: 'emily-test-msg-box' });
      msgBox.createSpan({ text: '💬 ' });
      msgBox.createEl('strong', { text: 'Assistant Emily: ' });
      msgBox.createSpan({ text: `"${result.message}"` });
    } else {
      const failBadge = badgeRow.createSpan({ cls: 'emily-badge is-warning' });
      failBadge.setText(`✗ ${t.settings.sayHelloFailed}`);
      const errBox = container.createDiv({ cls: 'emily-test-err-box' });
      errBox.setText(result.error || 'Connection failed');

      const errLower = (result.error || '').toLowerCase();
      const isConnRefused = errLower.includes('refused') || errLower.includes('failed to fetch') || errLower.includes('connect') || errLower.includes('network');
      const isLocal = result.isLocalhost ?? isLocalEndpoint(this.plugin.settings.apiBaseUrl);

      // 1. 로컬 프록시 연결 거부 (포트 닫힘 / 불일치) 시 포트 자동 탐색(Port Auto-Probe) 제안
      if (isConnRefused && isLocal) {
        const portBox = container.createDiv({ cls: 'emily-probe-action-box' });
        portBox.createSpan({ text: `🔌 ${t.settings.portProbeDesc}` });
        const probePortBtn = portBox.createEl('button', {
          text: `🔍 ${t.settings.portProbeBtn}`,
          cls: 'emily-btn-secondary'
        });
        probePortBtn.addEventListener('click', async () => {
          probePortBtn.disabled = true;
          probePortBtn.setText(t.settings.portProbeTesting);
          const targetUrl = this.plugin.settings.apiBaseUrl;
          const candidatePorts = getCandidatePorts(this.plugin.settings, targetUrl);
          const sysContext = getSystemContext();
          const probed = await this.plugin.getLLMClient().probeWorkingPort(candidatePorts, sysContext.languageName, sysContext.timePeriod);
          if (probed) {
            new Notice(t.settings.portProbeFoundNotice.replace('{port}', String(probed.workingPort)));
            const applyPortBtn = portBox.createEl('button', {
              text: `✓ ${t.settings.applyProbedPortBtn.replace('{port}', String(probed.workingPort))}`,
              cls: 'emily-btn-cta'
            });
            applyPortBtn.addEventListener('click', async () => {
              await this.saveProbeToCurrentProfile({ url: String(probed.workingPort) });
              new Notice(`포트 ${probed.workingPort}가 현재 기기 프로필에 저장되었습니다.`);
              this.renderActiveTabContent(this.containerEl.querySelector('.emily-provider-tab-panel') as HTMLElement, t);
            });
          } else {
            new Notice(t.settings.portProbeNotFoundNotice);
          }
          probePortBtn.disabled = false;
          probePortBtn.setText(`🔍 ${t.settings.portProbeBtn}`);
        });
      }

      // 2. 401 인증 실패 및 로컬 프록시 환경인 경우 후보 키 자동 진단(Auto-Probe) 제안
      const is401 = errLower.includes('401') || errLower.includes('unauthorized');
      if (is401 && isLocalEndpoint(this.plugin.settings.apiBaseUrl)) {
        const probeBox = container.createDiv({ cls: 'emily-probe-action-box' });
        probeBox.createSpan({ text: `💡 ${t.settings.autoProbeDesc}` });
        const probeBtn = probeBox.createEl('button', {
          text: `🔄 ${t.settings.autoProbeBtn}`,
          cls: 'emily-btn-secondary'
        });
        probeBtn.addEventListener('click', async () => {
          probeBtn.disabled = true;
          probeBtn.setText(t.settings.autoProbeTesting);
          const candidates = getCandidateKeys(this.plugin.settings).map((c) => c.key);
          const sysContext = getSystemContext();
          const probed = await this.plugin.getLLMClient().probeWorkingKey(candidates, sysContext.languageName, sysContext.timePeriod);
          if (probed) {
            new Notice(t.settings.autoProbeFoundNotice.replace('{label}', probed.workingKey.slice(0, 8) + '...'));
            const applyBtn = probeBox.createEl('button', {
              text: `✓ ${t.settings.applyProbedKeyBtn}`,
              cls: 'emily-btn-cta'
            });
            applyBtn.addEventListener('click', async () => {
              await this.saveProbeToCurrentProfile({ apiKey: probed.workingKey });
              new Notice('발견된 API 키가 현재 기기 프로필에 저장되었습니다.');
              this.renderActiveTabContent(this.containerEl.querySelector('.emily-provider-tab-panel') as HTMLElement, t);
            });
          } else {
            new Notice(t.settings.autoProbeNotFoundNotice);
          }
          probeBtn.disabled = false;
          probeBtn.setText(`🔄 ${t.settings.autoProbeBtn}`);
        });
      }
    }
  }

  private async saveProbeToCurrentProfile(updates: Partial<DeviceKeyProfile>): Promise<void> {
    const host = getDeviceHostname().toLowerCase();
    if (!this.plugin.settings.deviceProfiles) {
      this.plugin.settings.deviceProfiles = [];
    }
    const prof = this.plugin.settings.deviceProfiles.find(
      (p) => (p.hostname || '').toLowerCase().trim() === host
    );
    if (prof) {
      Object.assign(prof, updates);
    } else {
      const newProf: DeviceKeyProfile = {
        id: `dev-${Date.now()}`,
        name: getDeviceDisplayName(),
        hostname: getDeviceHostname() || undefined,
        ...updates
      };
      this.plugin.settings.deviceProfiles.push(newProf);
    }
    await this.plugin.saveSettings();
    this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
  }

  private renderProviderTabs(containerEl: HTMLElement, t: TranslationStrings): void {
    const navEl = containerEl.createDiv({
      cls: 'emily-settings-tab-nav',
      attr: { role: 'tablist', 'aria-label': 'AI Service Provider' }
    });

    const tabContentEl = containerEl.createDiv({ cls: 'emily-provider-tab-panel' });

    // Tab 1: Default Endpoint
    const btn1 = navEl.createEl('button', {
      cls: `emily-settings-tab-btn ${this.selectedProviderTab === 'default' ? 'is-active' : ''}`,
      attr: {
        role: 'tab',
        'aria-selected': this.selectedProviderTab === 'default' ? 'true' : 'false',
        tabindex: this.selectedProviderTab === 'default' ? '0' : '-1'
      }
    });
    const icon1 = btn1.createSpan();
    setIcon(icon1, 'sparkles');
    btn1.createSpan({ text: t.settings.providerTabDefault || '기본 설정' });

    // Tab 2: Device Profiles
    const btn2 = navEl.createEl('button', {
      cls: `emily-settings-tab-btn ${this.selectedProviderTab === 'devices' ? 'is-active' : ''}`,
      attr: {
        role: 'tab',
        'aria-selected': this.selectedProviderTab === 'devices' ? 'true' : 'false',
        tabindex: this.selectedProviderTab === 'devices' ? '0' : '-1'
      }
    });
    const icon2 = btn2.createSpan();
    setIcon(icon2, 'laptop');
    btn2.createSpan({ text: t.settings.providerTabDevices });

    const tabs: Array<'default' | 'devices'> = ['default', 'devices'];
    const buttons = [btn1, btn2];

    const switchTab = (tab: 'default' | 'devices') => {
      if (this.selectedProviderTab === tab) return;
      this.selectedProviderTab = tab;

      btn1.classList.toggle('is-active', tab === 'default');
      btn1.setAttribute('aria-selected', tab === 'default' ? 'true' : 'false');
      btn1.setAttribute('tabindex', tab === 'default' ? '0' : '-1');

      btn2.classList.toggle('is-active', tab === 'devices');
      btn2.setAttribute('aria-selected', tab === 'devices' ? 'true' : 'false');
      btn2.setAttribute('tabindex', tab === 'devices' ? '0' : '-1');

      this.renderActiveTabContent(tabContentEl, t);
    };

    this.switchTabFn = switchTab;

    btn1.addEventListener('click', () => switchTab('default'));
    btn2.addEventListener('click', () => switchTab('devices'));

    navEl.addEventListener('keydown', (e: KeyboardEvent) => {
      const currentIndex = tabs.indexOf(this.selectedProviderTab);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        switchTab(tabs[nextIndex]);
        buttons[nextIndex].focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        switchTab(tabs[prevIndex]);
        buttons[prevIndex].focus();
      }
    });

    this.renderActiveTabContent(tabContentEl, t);
  }

  private renderActiveTabContent(tabContentEl: HTMLElement, t: TranslationStrings): void {
    if (this.selectedProviderTab === 'devices') {
      this.renderDeviceProfilesTab(tabContentEl, t);
    } else {
      this.renderDefaultContent(tabContentEl, t);
    }
  }

  private renderDefaultContent(containerEl: HTMLElement, t: TranslationStrings): void {
    containerEl.empty();
    const infoBanner = containerEl.createDiv({ cls: 'emily-tab-info-banner' });
    infoBanner.createSpan({ cls: 'emily-tab-info-icon', text: '💡' });
    infoBanner.createSpan({ cls: 'emily-tab-info-text', text: t.settings.defaultEndpointDesc || t.settings.providerSectionDesc });

    // Compact device status banner
    this.renderCompactDeviceBanner(containerEl, t);

    new Setting(containerEl)
      .setName(t.settings.apiBaseUrlTitle)
      .setDesc(t.settings.apiBaseUrlDesc)
      .addText((text) =>
        text
          .setPlaceholder('https://api.openai.com/v1')
          .setValue(this.plugin.settings.apiBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiBaseUrl = value.trim();
            await this.plugin.saveSettings();
          })
      )
      .addExtraButton((btn) => {
        btn.setIcon('reset')
          .setTooltip(t.common.reset)
          .onClick(async () => {
            this.plugin.settings.apiBaseUrl = 'https://api.openai.com/v1';
            await this.plugin.saveSettings();
            this.renderDefaultContent(containerEl, t);
          });
      });

    new Setting(containerEl)
      .setName(t.settings.apiKeyTitle)
      .setDesc(t.settings.apiKeyDesc)
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder(t.settings.apiKeyPlaceholder)
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          });

        const toggleBtn = text.inputEl.parentElement?.createEl('button', {
          cls: 'emily-icon-btn',
          attr: { title: 'Password' }
        });
        if (toggleBtn) {
          setIcon(toggleBtn, 'eye');
          toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (text.inputEl.type === 'password') {
              text.inputEl.type = 'text';
              setIcon(toggleBtn, 'eye-off');
            } else {
              text.inputEl.type = 'password';
              setIcon(toggleBtn, 'eye');
            }
          });
        }
      })
      .addExtraButton((btn) => {
        btn.setIcon('trash')
          .setTooltip(t.common.delete)
          .onClick(async () => {
            this.plugin.settings.apiKey = '';
            await this.plugin.saveSettings();
            this.renderDefaultContent(containerEl, t);
          });
      });

    new Setting(containerEl)
      .setName(t.settings.modelTitle)
      .setDesc(t.settings.modelDesc)
      .addText((text) =>
        text
          .setPlaceholder(t.settings.modelPlaceholder)
          .setValue(this.plugin.settings.modelName || 'auto')
          .onChange(async (val) => {
            this.plugin.settings.modelName = val.trim() || 'auto';
            await this.plugin.saveSettings();
          })
      )
      .addExtraButton((btn) => {
        btn.setIcon('reset')
          .setTooltip(t.settings.modelResetTooltip)
          .onClick(async () => {
            this.plugin.settings.modelName = 'auto';
            await this.plugin.saveSettings();
            this.renderDefaultContent(containerEl, t);
          });
      });

    const testResultDiv = containerEl.createDiv({ cls: 'emily-test-result-box' });

    new Setting(containerEl)
      .setName(t.settings.sayHelloTitle)
      .setDesc(t.settings.sayHelloDesc)
      .addButton((btn) => {
        btn
          .setButtonText(t.settings.sayHelloBtn)
          .setCta()
          .onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText(t.settings.sayHelloTesting);
            testResultDiv.empty();

            try {
              const sysContext = getSystemContext();
              const client = this.plugin.getLLMClient();
              const res = await client.testProvider(sysContext.languageName, sysContext.timePeriod);
              this.renderTestResult(testResultDiv, res, t);
              if (res.success) {
                new Notice(t.settings.sayHelloNoticeSuccess);
              } else {
                new Notice(`${t.settings.sayHelloNoticeFailed}${res.error}`);
              }
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : String(err);
              this.renderTestResult(testResultDiv, { success: false, message: '', latencyMs: 0, model: '', error: errMsg }, t);
              new Notice(`${t.settings.sayHelloNoticeFailed}${errMsg}`);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText(t.settings.sayHelloBtn);
            }
          });
      });

    containerEl.appendChild(testResultDiv);
  }

  private renderCompactDeviceBanner(containerEl: HTMLElement, t: TranslationStrings): void {
    const effectiveEndpoint = resolveEffectiveEndpoint(this.plugin.settings);
    const effectiveKey = resolveEffectiveApiKey(this.plugin.settings);
    const isProfile = effectiveEndpoint.source === 'profile' || effectiveKey.source === 'profile';
    const profileName = effectiveEndpoint.profileName || effectiveKey.profileName;

    const banner = containerEl.createDiv({
      cls: `emily-compact-status-banner ${isProfile ? 'is-matched' : ''}`
    });

    const left = banner.createDiv({ cls: 'emily-status-left' });
    if (isProfile && profileName) {
      left.createSpan({ cls: 'emily-badge is-done', text: `🏢 ${profileName}` });
      const descText = t.settings.profileActiveCompact
        .replace('{profile}', profileName)
        .replace('{port}', effectiveEndpoint.url);
      left.createSpan({ text: descText, cls: 'text-muted text-xs' });
    } else {
      left.createSpan({ cls: 'emily-badge', text: '🌐 전역 기본값' });
      left.createSpan({ text: t.settings.globalDefaultCompact, cls: 'text-muted text-xs' });
    }

    const linkBtn = banner.createEl('button', {
      cls: 'emily-status-link-btn',
      text: t.settings.manageDevicesLink
    });
    linkBtn.addEventListener('click', () => {
      this.switchTabFn?.('devices');
    });
  }

  private renderDeviceProfilesTab(containerEl: HTMLElement, t: TranslationStrings): void {
    containerEl.empty();

    const infoBanner = containerEl.createDiv({ cls: 'emily-tab-info-banner' });
    infoBanner.createSpan({ cls: 'emily-tab-info-icon', text: '💻' });
    infoBanner.createSpan({ cls: 'emily-tab-info-text', text: t.settings.providerTabDevicesDesc });

    // Global toggle options
    new Setting(containerEl)
      .setName(t.settings.useDeviceOverrideTitle)
      .setDesc(t.settings.useDeviceOverrideDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useDeviceKeyOverride ?? true)
          .onChange(async (val) => {
            this.plugin.settings.useDeviceKeyOverride = val;
            await this.plugin.saveSettings();
            this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
            this.renderDeviceProfilesTab(containerEl, t);
          })
      );

    new Setting(containerEl)
      .setName(t.settings.autoProbeCandidateKeysTitle)
      .setDesc(t.settings.autoProbeCandidateKeysDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoProbeCandidateKeys ?? true)
          .onChange(async (val) => {
            this.plugin.settings.autoProbeCandidateKeys = val;
            await this.plugin.saveSettings();
          })
      );

    const profilesContainer = containerEl.createDiv({ cls: 'emily-device-profiles-container' });

    // 1. Current Device Header Card
    const currentHost = getDeviceHostname();
    const currentDisplayName = getDeviceDisplayName();
    const effectiveEndpoint = resolveEffectiveEndpoint(this.plugin.settings);
    const effectiveKey = resolveEffectiveApiKey(this.plugin.settings);

    const headerCard = profilesContainer.createDiv({ cls: 'emily-device-card-header' });
    const titleCol = headerCard.createDiv({ cls: 'emily-device-card-title' });
    titleCol.createSpan({ text: '🖥️' });
    titleCol.createEl('span', { text: `${t.settings.currentDeviceBadge}: ${currentDisplayName}` });
    if (currentHost && currentHost !== currentDisplayName) {
      titleCol.createSpan({ text: `(${currentHost})`, cls: 'text-muted text-xs font-mono' });
    }

    const badgeCol = headerCard.createDiv({ cls: 'emily-status-left' });
    badgeCol.createSpan({
      text: `URL: ${effectiveEndpoint.url}`,
      cls: 'emily-badge emily-endpoint-badge'
    });
    badgeCol.createSpan({
      text: effectiveKey.source === 'profile' ? `Key: ${effectiveKey.profileName} (전용)` : 'Key: 전역 공용',
      cls: `emily-badge ${effectiveKey.source === 'profile' ? 'is-done' : ''}`
    });

    // 2. Registered Profiles List
    const listHeader = profilesContainer.createDiv({ cls: 'emily-profiles-header' });
    const profiles = this.plugin.settings.deviceProfiles || [];
    listHeader.createEl('span', { text: `📋 등록된 기기 프로필 (${profiles.length}개)` });

    const tableEl = profilesContainer.createDiv({ cls: 'emily-profiles-table' });
    if (profiles.length === 0) {
      tableEl.createDiv({
        cls: 'text-muted text-xs',
        text: '등록된 기기 프로필이 없습니다. 아래에서 PC(1호 노트북, 2호 PC, 3호 데스크톱 등) 프로필을 추가하세요.'
      });
    } else {
      for (const prof of profiles) {
        if (this.editingProfileId === prof.id) {
          this.renderProfileFormCard(tableEl, prof, t, false);
        } else {
          this.renderProfileItemCard(tableEl, prof, currentHost, t);
        }
      }
    }

    // 3. New Profile Form Card
    if (!this.editingProfileId) {
      const addSection = profilesContainer.createDiv();
      const addHeader = addSection.createDiv({ cls: 'emily-profiles-header' });
      addHeader.createEl('span', { text: `➕ ${t.settings.addProfileBtn}` });
      this.renderProfileFormCard(addSection, null, t, true);
    }
  }

  private renderProfileItemCard(
    containerEl: HTMLElement,
    prof: DeviceKeyProfile,
    currentHost: string,
    t: TranslationStrings
  ): void {
    const isMatched = Boolean(currentHost && prof.hostname && prof.hostname.trim().toLowerCase() === currentHost.trim().toLowerCase());
    const row = containerEl.createDiv({
      cls: `emily-profile-item ${isMatched ? 'is-current-device' : ''}`
    });

    const info = row.createDiv({ cls: 'emily-profile-info' });
    const nameRow = info.createDiv({ cls: 'emily-profile-name-row' });
    nameRow.createEl('strong', { text: prof.name });
    if (prof.hostname) {
      nameRow.createSpan({ text: `(${prof.hostname})`, cls: 'text-muted text-xs font-mono' });
    }
    if (isMatched) {
      nameRow.createSpan({
        text: '★ 현재 기기 매칭됨 (자동 적용 중)',
        cls: 'emily-badge is-active font-bold'
      });
    }

    const detailsGrid = info.createDiv({ cls: 'emily-profile-grid-details' });
    const item = detailsGrid.createDiv({ cls: 'emily-profile-detail-item' });
    const effectiveUrl = prof.url || prof.provider1Url || '(전역 기본)';
    const keyVal = prof.apiKey || prof.provider1Key;
    const keyDisplay = keyVal && keyVal.length > 0 ? `${keyVal.slice(0, 4)}••••` : '(전역 공용)';
    item.createSpan({ text: `포트/URL: ${effectiveUrl} | API 키: ${keyDisplay}` });

    // Action buttons
    const actCol = row.createDiv({ cls: 'emily-profile-actions' });
    const editBtn = actCol.createEl('button', {
      text: `✏️ ${t.settings.editProfileBtn}`,
      cls: 'emily-btn-secondary text-xs'
    });
    editBtn.addEventListener('click', () => {
      this.editingProfileId = prof.id;
      this.renderActiveTabContent(this.containerEl.querySelector('.emily-provider-tab-panel') as HTMLElement, t);
    });

    const delBtn = actCol.createEl('button', {
      text: '✕',
      cls: 'emily-icon-btn',
      attr: { title: t.common.delete }
    });
    delBtn.addEventListener('click', async () => {
      this.plugin.settings.deviceProfiles = (this.plugin.settings.deviceProfiles || []).filter((p) => p.id !== prof.id);
      await this.plugin.saveSettings();
      this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
      new Notice(t.settings.profileDeleteSuccessNotice);
      this.renderActiveTabContent(this.containerEl.querySelector('.emily-provider-tab-panel') as HTMLElement, t);
    });
  }

  private renderProfileFormCard(
    containerEl: HTMLElement,
    prof: DeviceKeyProfile | null,
    t: TranslationStrings,
    isAdd: boolean
  ): void {
    const card = containerEl.createDiv({ cls: 'emily-profile-form-card' });

    let name = prof ? prof.name : '';
    let hostname = prof ? (prof.hostname || '') : '';
    let url = prof ? (prof.url || prof.provider1Url || '') : '';
    let apiKey = prof ? (prof.apiKey || prof.provider1Key || '') : '';

    const titleEl = card.createDiv({ cls: 'form-section-title' });
    titleEl.setText(isAdd ? `➕ ${t.settings.addProfileBtn}` : `✏️ [${prof?.name}] 프로필 수정`);

    new Setting(card)
      .setName(t.settings.profileNameTitle)
      .addText((text) =>
        text
          .setPlaceholder('예: 서재 PC 3, 거실 노트북 4, 작업실 PC')
          .setValue(name)
          .onChange((v) => name = v.trim())
      );

    const hostSetting = new Setting(card)
      .setName(t.settings.profileHostnameTitle)
      .addText((text) => {
        text
          .setPlaceholder('예: G2300227, HOME-PC, DESKTOP-STUDY')
          .setValue(hostname)
          .onChange((v) => hostname = v.trim());
      })
      .addExtraButton((btn) => {
        btn.setIcon('laptop')
          .setTooltip(t.settings.autoDetectCurrentDevice)
          .onClick(() => {
            const h = getDeviceHostname();
            if (h) {
              const inputEl = hostSetting.controlEl.querySelector('input') as HTMLInputElement;
              if (inputEl) {
                inputEl.value = h;
                hostname = h;
              }
            }
          });
      });

    new Setting(card)
      .setName('기기 전용 포트 또는 URL')
      .setDesc('기기별로 다른 포트 번호(예: 11434, 31416) 또는 전체 URL을 지정합니다. (미입력 시 전역 기본 URL 사용)')
      .addText((text) =>
        text
          .setPlaceholder('예: 11434 또는 http://127.0.0.1:11434/v1')
          .setValue(url)
          .onChange((v) => url = v.trim())
      );

    new Setting(card)
      .setName('기기 전용 API 키')
      .setDesc('해당 기기에서만 유효한 로컬 프록시 API 키를 지정합니다. (미입력 시 전역 공용 키 사용)')
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('기기 전용 로컬 API Key')
          .setValue(apiKey)
          .onChange((v) => apiKey = v.trim());

        const toggleBtn = text.inputEl.parentElement?.createEl('button', {
          cls: 'emily-icon-btn',
          attr: { title: 'Password' }
        });
        if (toggleBtn) {
          setIcon(toggleBtn, 'eye');
          toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (text.inputEl.type === 'password') {
              text.inputEl.type = 'text';
              setIcon(toggleBtn, 'eye-off');
            } else {
              text.inputEl.type = 'password';
              setIcon(toggleBtn, 'eye');
            }
          });
        }
      });

    // Action Buttons Row
    const btnRow = card.createDiv({ cls: 'emily-profile-add-btn-row' });
    if (!isAdd) {
      const cancelBtn = btnRow.createEl('button', { text: '✕ 취소', cls: 'emily-btn-secondary' });
      cancelBtn.addEventListener('click', () => {
        this.editingProfileId = null;
        this.renderActiveTabContent(this.containerEl.querySelector('.emily-provider-tab-panel') as HTMLElement, t);
      });
    }

    const saveBtn = btnRow.createEl('button', {
      text: isAdd ? `➕ ${t.settings.addProfileBtn}` : '💾 저장',
      cls: 'emily-btn-cta'
    });
    saveBtn.addEventListener('click', async () => {
      if (!name) {
        new Notice('기기 이름을 입력해 주세요.');
        return;
      }

      if (isAdd) {
        const newProfile: DeviceKeyProfile = {
          id: `dev-${Date.now()}`,
          name,
          hostname: hostname || undefined,
          url: url || undefined,
          apiKey: apiKey || undefined
        };
        if (!this.plugin.settings.deviceProfiles) {
          this.plugin.settings.deviceProfiles = [];
        }
        this.plugin.settings.deviceProfiles.push(newProfile);
      } else if (prof) {
        prof.name = name;
        prof.hostname = hostname || undefined;
        prof.url = url || undefined;
        prof.apiKey = apiKey || undefined;
        this.editingProfileId = null;
      }

      await this.plugin.saveSettings();
      this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
      new Notice(t.settings.profileSaveSuccessNotice);
      this.renderActiveTabContent(this.containerEl.querySelector('.emily-provider-tab-panel') as HTMLElement, t);
    });
  }
}




