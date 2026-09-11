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
  private selectedProviderTab: 'primary' | 'secondary' | 'devices' = 'primary';
  private tab2ConfiguredDot: HTMLElement | null = null;
  private editingProfileId: string | null = null;
  private switchTabFn: ((tab: 'primary' | 'secondary' | 'devices') => void) | null = null;

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
    // Section 2: 다중 프로바이더 운영 정책 (Multi-Provider Policies)
    // =========================================================================
    new Setting(containerEl).setName(t.settings.multiProviderPolicyHeading).setDesc(t.settings.multiProviderPolicyDesc).setHeading();

    new Setting(containerEl)
      .setName(t.settings.activeProviderTitle)
      .setDesc(t.settings.activeProviderDesc)
      .addDropdown((dropdown) => {
        dropdown.addOption('auto', t.settings.activeProviderAuto);
        dropdown.addOption('primary', t.settings.activeProviderPrimary);
        dropdown.addOption('secondary', t.settings.activeProviderSecondary);
        dropdown
          .setValue(this.plugin.settings.activeProvider || 'auto')
          .onChange(async (val: 'auto' | 'primary' | 'secondary') => {
            this.plugin.settings.activeProvider = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(t.settings.enableFallbackTitle)
      .setDesc(t.settings.enableFallbackDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableFallback ?? true)
          .onChange(async (val) => {
            this.plugin.settings.enableFallback = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t.settings.enableChunkDistributionTitle)
      .setDesc(t.settings.enableChunkDistributionDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableChunkDistribution ?? true)
          .onChange(async (val) => {
            this.plugin.settings.enableChunkDistribution = val;
            await this.plugin.saveSettings();
          })
      );

    const allTestResultDiv = containerEl.createDiv({ cls: 'emily-test-result-box' });

    new Setting(containerEl)
      .setName(t.settings.testAllBtn)
      .setDesc(t.settings.testAllDesc)
      .addButton((btn) => {
        btn
          .setButtonText(t.settings.testAllBtn)
          .setCta()
          .onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText(t.settings.testAllTesting);
            allTestResultDiv.empty();

            try {
              const sysContext = getSystemContext();
              const client = this.plugin.getLLMClient();
              const summary = await client.testAllProviders(sysContext.languageName, sysContext.timePeriod);

              const p1Status = summary.primary.success
                ? t.settings.providerStatusConnected.replace('{latency}', String(summary.primary.latencyMs))
                : t.settings.providerStatusFailed;

              let p2Status = t.settings.providerStatusNotConfigured;
              if (summary.secondary) {
                p2Status = summary.secondary.success
                  ? t.settings.providerStatusConnected.replace('{latency}', String(summary.secondary.latencyMs))
                  : t.settings.providerStatusFailed;
              }

              const summaryText = t.settings.testAllSummary
                .replace('{p1}', p1Status)
                .replace('{p2}', p2Status);

              const badgeRow = allTestResultDiv.createDiv({ cls: 'emily-test-badge-row' });
              const badge = badgeRow.createSpan({ cls: 'emily-badge is-success' });
              badge.setText(summaryText);

              const recLabel = summary.recommended === 'primary' ? 'Provider 1' : 'Provider 2';
              const noticeMsg = t.settings.providerRecommendedNotice.replace('{provider}', recLabel);
              const infoBox = allTestResultDiv.createDiv({ cls: 'emily-test-msg-box' });
              infoBox.setText(`⚡ ${noticeMsg}`);

              if (this.plugin.settings.activeProvider === 'auto') {
                new Notice(noticeMsg);
              }
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : String(err);
              const errBox = allTestResultDiv.createDiv({ cls: 'emily-test-err-box' });
              errBox.setText(errMsg);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText(t.settings.testAllBtn);
            }
          });
      });

    containerEl.appendChild(allTestResultDiv);

    // =========================================================================
    // Section 3: 교열 기본 설정 (Proofreading Preferences)
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
    providerId?: 'primary' | 'secondary'
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
        urlBadge.setText(`🔌 [${result.profileName}] 포트 적용`);
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
      const isLocal = result.isLocalhost ?? (providerId ? isLocalEndpoint(providerId === 'secondary' ? this.plugin.settings.secondaryApiBaseUrl : this.plugin.settings.apiBaseUrl) : false);

      // 1. 로컬 프록시 연결 거부 (포트 닫힘 / 불일치) 시 포트 자동 탐색(Port Auto-Probe) 제안
      if (isConnRefused && providerId && isLocal) {
        const portBox = container.createDiv({ cls: 'emily-probe-action-box' });
        portBox.createSpan({ text: `🔌 ${t.settings.portProbeDesc}` });
        const probePortBtn = portBox.createEl('button', {
          text: `🔍 ${t.settings.portProbeBtn}`,
          cls: 'emily-btn-secondary'
        });
        probePortBtn.addEventListener('click', async () => {
          probePortBtn.disabled = true;
          probePortBtn.setText(t.settings.portProbeTesting);
          const targetUrl = providerId === 'secondary' ? this.plugin.settings.secondaryApiBaseUrl : this.plugin.settings.apiBaseUrl;
          const candidatePorts = getCandidatePorts(this.plugin.settings, targetUrl);
          const sysContext = getSystemContext();
          const probed = await this.plugin.getLLMClient().probeWorkingPort(providerId, sysContext.languageName, sysContext.timePeriod, candidatePorts);
          if (probed) {
            new Notice(t.settings.portProbeFoundNotice.replace('{port}', String(probed.workingPort)));
            const applyPortBtn = portBox.createEl('button', {
              text: `✓ ${t.settings.applyProbedPortBtn.replace('{port}', String(probed.workingPort))}`,
              cls: 'emily-btn-cta'
            });
            applyPortBtn.addEventListener('click', async () => {
              await this.saveProbeToCurrentProfile(
                providerId === 'primary' ? { provider1Url: String(probed.workingPort) } : { provider2Url: String(probed.workingPort) }
              );
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
      const targetUrl = providerId === 'secondary' ? this.plugin.settings.secondaryApiBaseUrl : this.plugin.settings.apiBaseUrl;
      if (is401 && providerId && isLocalEndpoint(targetUrl)) {
        const probeBox = container.createDiv({ cls: 'emily-probe-action-box' });
        probeBox.createSpan({ text: `💡 ${t.settings.autoProbeDesc}` });
        const probeBtn = probeBox.createEl('button', {
          text: `🔄 ${t.settings.autoProbeBtn}`,
          cls: 'emily-btn-secondary'
        });
        probeBtn.addEventListener('click', async () => {
          probeBtn.disabled = true;
          probeBtn.setText(t.settings.autoProbeTesting);
          const candidates = getCandidateKeys(this.plugin.settings, providerId).map((c) => c.key);
          const sysContext = getSystemContext();
          const probed = await this.plugin.getLLMClient().probeWorkingKey(providerId, sysContext.languageName, sysContext.timePeriod, candidates);
          if (probed) {
            new Notice(t.settings.autoProbeFoundNotice.replace('{label}', probed.workingKey.slice(0, 8) + '...'));
            const applyBtn = probeBox.createEl('button', {
              text: `✓ ${t.settings.applyProbedKeyBtn}`,
              cls: 'emily-btn-cta'
            });
            applyBtn.addEventListener('click', async () => {
              await this.saveProbeToCurrentProfile(
                providerId === 'primary' ? { provider1Key: probed.workingKey } : { provider2Key: probed.workingKey }
              );
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
      attr: { role: 'tablist', 'aria-label': 'AI Service Providers' }
    });

    const tabContentEl = containerEl.createDiv({ cls: 'emily-provider-tab-panel' });

    // Tab 1: Provider 1
    const btn1 = navEl.createEl('button', {
      cls: `emily-settings-tab-btn ${this.selectedProviderTab === 'primary' ? 'is-active' : ''}`,
      attr: {
        role: 'tab',
        'aria-selected': this.selectedProviderTab === 'primary' ? 'true' : 'false',
        tabindex: this.selectedProviderTab === 'primary' ? '0' : '-1'
      }
    });
    const icon1 = btn1.createSpan();
    setIcon(icon1, 'sparkles');
    btn1.createSpan({ text: t.settings.providerTab1 });

    // Tab 2: Provider 2
    const btn2 = navEl.createEl('button', {
      cls: `emily-settings-tab-btn ${this.selectedProviderTab === 'secondary' ? 'is-active' : ''}`,
      attr: {
        role: 'tab',
        'aria-selected': this.selectedProviderTab === 'secondary' ? 'true' : 'false',
        tabindex: this.selectedProviderTab === 'secondary' ? '0' : '-1'
      }
    });
    const icon2 = btn2.createSpan();
    setIcon(icon2, 'server');
    btn2.createSpan({ text: t.settings.providerTab2 });

    this.tab2ConfiguredDot = btn2.createSpan({
      cls: `emily-tab-configured-dot ${this.plugin.settings.secondaryApiBaseUrl?.trim() ? '' : 'is-hidden'}`
    });
    this.tab2ConfiguredDot.setAttribute('title', t.settings.providerConfiguredBadge);

    // Tab 3: Device Profiles
    const btn3 = navEl.createEl('button', {
      cls: `emily-settings-tab-btn ${this.selectedProviderTab === 'devices' ? 'is-active' : ''}`,
      attr: {
        role: 'tab',
        'aria-selected': this.selectedProviderTab === 'devices' ? 'true' : 'false',
        tabindex: this.selectedProviderTab === 'devices' ? '0' : '-1'
      }
    });
    const icon3 = btn3.createSpan();
    setIcon(icon3, 'laptop');
    btn3.createSpan({ text: t.settings.providerTabDevices });

    const tabs: Array<'primary' | 'secondary' | 'devices'> = ['primary', 'secondary', 'devices'];
    const buttons = [btn1, btn2, btn3];

    const switchTab = (tab: 'primary' | 'secondary' | 'devices') => {
      if (this.selectedProviderTab === tab) return;
      this.selectedProviderTab = tab;

      btn1.classList.toggle('is-active', tab === 'primary');
      btn1.setAttribute('aria-selected', tab === 'primary' ? 'true' : 'false');
      btn1.setAttribute('tabindex', tab === 'primary' ? '0' : '-1');

      btn2.classList.toggle('is-active', tab === 'secondary');
      btn2.setAttribute('aria-selected', tab === 'secondary' ? 'true' : 'false');
      btn2.setAttribute('tabindex', tab === 'secondary' ? '0' : '-1');

      btn3.classList.toggle('is-active', tab === 'devices');
      btn3.setAttribute('aria-selected', tab === 'devices' ? 'true' : 'false');
      btn3.setAttribute('tabindex', tab === 'devices' ? '0' : '-1');

      this.renderActiveTabContent(tabContentEl, t);
    };

    this.switchTabFn = switchTab;

    btn1.addEventListener('click', () => switchTab('primary'));
    btn2.addEventListener('click', () => switchTab('secondary'));
    btn3.addEventListener('click', () => switchTab('devices'));

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

  private updateTabConfiguredBadge(): void {
    if (!this.tab2ConfiguredDot) return;
    const isConfigured = Boolean(this.plugin.settings.secondaryApiBaseUrl?.trim());
    if (isConfigured) {
      this.tab2ConfiguredDot.removeClass('is-hidden');
    } else {
      this.tab2ConfiguredDot.addClass('is-hidden');
    }
  }

  private renderActiveTabContent(tabContentEl: HTMLElement, t: TranslationStrings): void {
    if (this.selectedProviderTab === 'devices') {
      this.renderDeviceProfilesTab(tabContentEl, t);
    } else if (this.selectedProviderTab === 'secondary') {
      this.renderProvider2Content(tabContentEl, t);
    } else {
      this.renderProvider1Content(tabContentEl, t);
    }
  }

  private renderProvider1Content(containerEl: HTMLElement, t: TranslationStrings): void {
    containerEl.empty();
    const infoBanner = containerEl.createDiv({ cls: 'emily-tab-info-banner' });
    infoBanner.createSpan({ cls: 'emily-tab-info-icon', text: '💡' });
    infoBanner.createSpan({ cls: 'emily-tab-info-text', text: t.settings.provider1Desc });

    // Compact device status banner
    this.renderCompactDeviceBanner(containerEl, 'primary', t);

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
            this.renderProvider1Content(containerEl, t);
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
            this.renderProvider1Content(containerEl, t);
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
            this.renderProvider1Content(containerEl, t);
          });
      });

    const p1ResultDiv = containerEl.createDiv({ cls: 'emily-test-result-box' });

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
            p1ResultDiv.empty();

            try {
              const sysContext = getSystemContext();
              const client = this.plugin.getLLMClient();
              const res = await client.testProvider('primary', sysContext.languageName, sysContext.timePeriod);
              this.renderTestResult(p1ResultDiv, res, t, 'primary');
              if (res.success) {
                new Notice(t.settings.sayHelloNoticeSuccess);
              } else {
                new Notice(`${t.settings.sayHelloNoticeFailed}${res.error}`);
              }
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : String(err);
              this.renderTestResult(p1ResultDiv, { success: false, message: '', latencyMs: 0, model: '', error: errMsg }, t, 'primary');
              new Notice(`${t.settings.sayHelloNoticeFailed}${errMsg}`);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText(t.settings.sayHelloBtn);
            }
          });
      });

    containerEl.appendChild(p1ResultDiv);
  }

  private renderProvider2Content(containerEl: HTMLElement, t: TranslationStrings): void {
    containerEl.empty();
    const infoBanner = containerEl.createDiv({ cls: 'emily-tab-info-banner' });
    infoBanner.createSpan({ cls: 'emily-tab-info-icon', text: '💡' });
    infoBanner.createSpan({ cls: 'emily-tab-info-text', text: t.settings.provider2Desc });

    // Compact device status banner
    this.renderCompactDeviceBanner(containerEl, 'secondary', t);

    new Setting(containerEl)
      .setName(t.settings.apiBaseUrlTitle)
      .setDesc(t.settings.secondaryApiBaseUrlDesc)
      .addText((text) =>
        text
          .setPlaceholder('https://api.groq.com/openai/v1')
          .setValue(this.plugin.settings.secondaryApiBaseUrl || '')
          .onChange(async (value) => {
            this.plugin.settings.secondaryApiBaseUrl = value.trim();
            await this.plugin.saveSettings();
            this.updateTabConfiguredBadge();
          })
      )
      .addExtraButton((btn) => {
        btn.setIcon('reset')
          .setTooltip(t.common.reset)
          .onClick(async () => {
            this.plugin.settings.secondaryApiBaseUrl = '';
            await this.plugin.saveSettings();
            this.renderProvider2Content(containerEl, t);
            this.updateTabConfiguredBadge();
          });
      });

    new Setting(containerEl)
      .setName(t.settings.apiKeyTitle)
      .setDesc(t.settings.apiKeyDesc)
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder(t.settings.apiKeyPlaceholder)
          .setValue(this.plugin.settings.secondaryApiKey || '')
          .onChange(async (value) => {
            this.plugin.settings.secondaryApiKey = value.trim();
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
            this.plugin.settings.secondaryApiKey = '';
            await this.plugin.saveSettings();
            this.renderProvider2Content(containerEl, t);
          });
      });

    new Setting(containerEl)
      .setName(t.settings.modelTitle)
      .setDesc(t.settings.modelDesc)
      .addText((text) =>
        text
          .setPlaceholder(t.settings.modelPlaceholder)
          .setValue(this.plugin.settings.secondaryModelName || 'auto')
          .onChange(async (val) => {
            this.plugin.settings.secondaryModelName = val.trim() || 'auto';
            await this.plugin.saveSettings();
          })
      )
      .addExtraButton((btn) => {
        btn.setIcon('reset')
          .setTooltip(t.settings.modelResetTooltip)
          .onClick(async () => {
            this.plugin.settings.secondaryModelName = 'auto';
            await this.plugin.saveSettings();
            this.renderProvider2Content(containerEl, t);
          });
      });

    const p2ResultDiv = containerEl.createDiv({ cls: 'emily-test-result-box' });

    new Setting(containerEl)
      .setName(t.settings.sayHelloTitle)
      .setDesc(t.settings.sayHelloDesc)
      .addButton((btn) => {
        btn
          .setButtonText(t.settings.sayHelloBtn)
          .onClick(async () => {
            if (!this.plugin.settings.secondaryApiBaseUrl) {
              new Notice('Provider 2 API Base URL is not configured.');
              return;
            }
            btn.setDisabled(true);
            btn.setButtonText(t.settings.sayHelloTesting);
            p2ResultDiv.empty();

            try {
              const sysContext = getSystemContext();
              const client = this.plugin.getLLMClient();
              const res = await client.testProvider('secondary', sysContext.languageName, sysContext.timePeriod);
              this.renderTestResult(p2ResultDiv, res, t, 'secondary');
              if (res.success) {
                new Notice(t.settings.sayHelloNoticeSuccess);
              } else {
                new Notice(`${t.settings.sayHelloNoticeFailed}${res.error}`);
              }
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : String(err);
              this.renderTestResult(p2ResultDiv, { success: false, message: '', latencyMs: 0, model: '', error: errMsg }, t, 'secondary');
              new Notice(`${t.settings.sayHelloNoticeFailed}${errMsg}`);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText(t.settings.sayHelloBtn);
            }
          });
      });

    containerEl.appendChild(p2ResultDiv);
  }

  /**
   * Provider 1 & 2 설정 상단에 노출되는 콤팩트한 현재 기기 매칭 상태 배너
   */
  private renderCompactDeviceBanner(
    containerEl: HTMLElement,
    provider: 'primary' | 'secondary',
    t: TranslationStrings
  ): void {
    const effectiveEndpoint = resolveEffectiveEndpoint(this.plugin.settings, provider);
    const effectiveKey = resolveEffectiveApiKey(this.plugin.settings, provider);
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

  /**
   * 다중 기기 프로필 통합 관리 전용 화면 (3번째 서브탭)
   */
  private renderDeviceProfilesTab(containerEl: HTMLElement, t: TranslationStrings): void {
    containerEl.empty();

    const infoBanner = containerEl.createDiv({ cls: 'emily-tab-info-banner' });
    infoBanner.createSpan({ cls: 'emily-tab-info-icon', text: '💻' });
    infoBanner.createSpan({ cls: 'emily-tab-info-text', text: t.settings.providerTabDevicesDesc });

    const profilesContainer = containerEl.createDiv({ cls: 'emily-device-profiles-container' });

    // 1. 현재 기기 정보 헤더 카드
    const currentHost = getDeviceHostname();
    const currentDisplayName = getDeviceDisplayName();
    const p1Effective = resolveEffectiveEndpoint(this.plugin.settings, 'primary');
    const p2Effective = resolveEffectiveEndpoint(this.plugin.settings, 'secondary');

    const headerCard = profilesContainer.createDiv({ cls: 'emily-device-card-header' });
    const titleCol = headerCard.createDiv({ cls: 'emily-device-card-title' });
    titleCol.createSpan({ text: '🖥️' });
    titleCol.createEl('span', { text: `${t.settings.currentDeviceBadge}: ${currentDisplayName}` });
    if (currentHost && currentHost !== currentDisplayName) {
      titleCol.createSpan({ text: `(${currentHost})`, cls: 'text-muted text-xs font-mono' });
    }

    const badgeCol = headerCard.createDiv({ cls: 'emily-status-left' });
    badgeCol.createSpan({
      text: `P1: ${p1Effective.url}`,
      cls: 'emily-badge emily-endpoint-badge'
    });
    if (this.plugin.settings.secondaryApiBaseUrl) {
      badgeCol.createSpan({
        text: `P2: ${p2Effective.url}`,
        cls: 'emily-badge emily-endpoint-badge'
      });
    }

    // 2. 등록된 기기 프로필 목록
    const listHeader = profilesContainer.createDiv({ cls: 'emily-profiles-header' });
    const profiles = this.plugin.settings.deviceProfiles || [];
    listHeader.createEl('span', { text: `📋 등록된 기기 프로필 (${profiles.length}개)` });

    const tableEl = profilesContainer.createDiv({ cls: 'emily-profiles-table' });
    if (profiles.length === 0) {
      tableEl.createDiv({
        cls: 'text-muted text-xs',
        text: '등록된 기기 프로필이 없습니다. 아래에서 집/회사 노트북 프로필을 추가하세요.'
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

    // 3. 새 기기 프로필 등록 폼 (수정 모드가 아닐 때만 노출)
    if (!this.editingProfileId) {
      const addSection = profilesContainer.createDiv();
      const addHeader = addSection.createDiv({ cls: 'emily-profiles-header' });
      addHeader.createEl('span', { text: `➕ ${t.settings.addProfileBtn}` });
      this.renderProfileFormCard(addSection, null, t, true);
    }
  }

  /**
   * 단일 기기 프로필 표시 카드
   */
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

    // Provider 1 Info
    const p1Item = detailsGrid.createDiv({ cls: 'emily-profile-detail-item' });
    const p1UrlDisplay = prof.provider1Url ? prof.provider1Url : '(기본)';
    const p1KeyDisplay = prof.provider1Key && prof.provider1Key.length > 0 ? `${prof.provider1Key.slice(0, 4)}••••` : '(미설정)';
    p1Item.createSpan({ text: `[P1] 포트: ${p1UrlDisplay} | 키: ${p1KeyDisplay}` });

    // Provider 2 Info
    const p2Item = detailsGrid.createDiv({ cls: 'emily-profile-detail-item' });
    const p2UrlDisplay = prof.provider2Url ? prof.provider2Url : '(기본)';
    const p2KeyDisplay = prof.provider2Key && prof.provider2Key.length > 0 ? `${prof.provider2Key.slice(0, 4)}••••` : '(미설정)';
    p2Item.createSpan({ text: `[P2] 포트: ${p2UrlDisplay} | 키: ${p2KeyDisplay}` });

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

  /**
   * 기기 프로필 통합 등록 / 수정 카드
   */
  private renderProfileFormCard(
    containerEl: HTMLElement,
    prof: DeviceKeyProfile | null,
    t: TranslationStrings,
    isAdd: boolean
  ): void {
    const card = containerEl.createDiv({ cls: 'emily-profile-form-card' });

    let name = prof ? prof.name : '';
    let hostname = prof ? (prof.hostname || '') : '';
    let p1Url = prof ? (prof.provider1Url || '') : '';
    let p1Key = prof ? (prof.provider1Key || '') : '';
    let p2Url = prof ? (prof.provider2Url || '') : '';
    let p2Key = prof ? (prof.provider2Key || '') : '';

    const titleEl = card.createDiv({ cls: 'form-section-title' });
    titleEl.setText(isAdd ? `➕ ${t.settings.addProfileBtn}` : `✏️ [${prof?.name}] 프로필 수정`);

    // 기기 기본 정보 (이름 & 호스트명)
    new Setting(card)
      .setName(t.settings.profileNameTitle)
      .addText((text) =>
        text
          .setPlaceholder('예: 집 노트북, 회사 노트북 1')
          .setValue(name)
          .onChange((v) => name = v.trim())
      );

    const hostSetting = new Setting(card)
      .setName(t.settings.profileHostnameTitle)
      .addText((text) => {
        text
          .setPlaceholder('예: G2300227, HOME-PC')
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

    // Provider 1 & 2 설정 그리드
    const grid = card.createDiv({ cls: 'emily-profile-form-grid' });

    // P1 Section
    const p1Col = grid.createDiv();
    p1Col.createEl('strong', { text: '✨ 프로바이더 1 설정', cls: 'text-xs text-muted' });
    new Setting(p1Col)
      .setName('P1 포트 / URL')
      .addText((text) =>
        text
          .setPlaceholder('예: 11434 또는 http://localhost:11434/v1')
          .setValue(p1Url)
          .onChange((v) => p1Url = v.trim())
      );
    new Setting(p1Col)
      .setName('P1 API 키')
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('Unified Key / API Key')
          .setValue(p1Key)
          .onChange((v) => p1Key = v.trim());
      });

    // P2 Section
    const p2Col = grid.createDiv();
    p2Col.createEl('strong', { text: '⚡ 프로바이더 2 설정 (선택)', cls: 'text-xs text-muted' });
    new Setting(p2Col)
      .setName('P2 포트 / URL')
      .addText((text) =>
        text
          .setPlaceholder('예: 8000 또는 http://localhost:8000/v1')
          .setValue(p2Url)
          .onChange((v) => p2Url = v.trim())
      );
    new Setting(p2Col)
      .setName('P2 API 키')
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('Unified Key / API Key')
          .setValue(p2Key)
          .onChange((v) => p2Key = v.trim());
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
          provider1Url: p1Url || undefined,
          provider1Key: p1Key || undefined,
          provider2Url: p2Url || undefined,
          provider2Key: p2Key || undefined
        };
        if (!this.plugin.settings.deviceProfiles) {
          this.plugin.settings.deviceProfiles = [];
        }
        this.plugin.settings.deviceProfiles.push(newProfile);
      } else if (prof) {
        prof.name = name;
        prof.hostname = hostname || undefined;
        prof.provider1Url = p1Url || undefined;
        prof.provider1Key = p1Key || undefined;
        prof.provider2Url = p2Url || undefined;
        prof.provider2Key = p2Key || undefined;
        this.editingProfileId = null;
      }

      await this.plugin.saveSettings();
      this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
      new Notice(t.settings.profileSaveSuccessNotice);
      this.renderActiveTabContent(this.containerEl.querySelector('.emily-provider-tab-panel') as HTMLElement, t);
    });
  }
}




