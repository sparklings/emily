import { App, PluginSettingTab, Setting, Notice, setIcon, SettingDefinitionItem } from 'obsidian';
import type EmilyPlugin from '../main';
import { getTranslation, getObsidianLanguage, getDefaultTargetLanguageName, getSourceLanguages, getSupportedLanguages, getLocalizedLanguageName, normalizeLanguageCode } from '../i18n';
import { TranslationStrings } from '../i18n/types';
import { getSystemContext } from '../utils/systemInfo';
import { TranslationScope, PreservationStrategy, TranslationTone, TranslationStyle } from '../types/translation';
import { DeviceKeyProfile } from '../types/settings';
import { DeviceProfileModal } from './deviceProfileModal';
import {
  getDeviceHostname,
  setDeviceHostname,
  getDeviceDisplayName,
  getActiveProfileId,
  setActiveProfileId,
  getActiveProfile,
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

    // AI 서비스 프로바이더 설정 (단일 통합 대시보드)
    this.renderUnifiedProviderDashboard(containerEl, t);

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
        probePortBtn.addEventListener('click', () => {
          void (async () => {
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
              applyPortBtn.addEventListener('click', () => {
                void (async () => {
                  await this.saveProbeToCurrentProfile({ url: String(probed.workingPort) });
                  new Notice(`포트 ${probed.workingPort}가 현재 기기 프로필에 저장되었습니다.`);
                  this.renderSettings(this.containerEl);
                })();
              });
            } else {
              new Notice(t.settings.portProbeNotFoundNotice);
            }
            probePortBtn.disabled = false;
            probePortBtn.setText(`🔍 ${t.settings.portProbeBtn}`);
          })();
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
        probeBtn.addEventListener('click', () => {
          void (async () => {
            probeBtn.disabled = true;
            probeBtn.setText(t.settings.autoProbeTesting);
            const candidates = getCandidateKeys(this.plugin.settings);
            const sysContext = getSystemContext();
            const probed = await this.plugin.getLLMClient().probeWorkingKey(candidates.map((c) => c.key), sysContext.languageName, sysContext.timePeriod);
            if (probed) {
              const matchedCandidate = candidates.find((c) => c.key === probed.workingKey);
              const label = matchedCandidate ? matchedCandidate.label : (probed.workingKey.slice(0, 8) + '...');
              new Notice(t.settings.autoProbeFoundNotice.replace('{label}', label));
              const applyBtn = probeBox.createEl('button', {
                text: `✓ ${t.settings.applyProbedKeyBtn}`,
                cls: 'emily-btn-cta'
              });
              applyBtn.addEventListener('click', () => {
                void (async () => {
                  if (matchedCandidate && matchedCandidate.profileId) {
                    setActiveProfileId(matchedCandidate.profileId);
                    this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
                    new Notice(t.settings.appliedToCurrentMachineNotice.replace('{name}', matchedCandidate.label));
                  } else {
                    await this.saveProbeToCurrentProfile({ apiKey: probed.workingKey });
                    new Notice('발견된 API 키가 현재 기기 프로필에 저장되었습니다.');
                  }
                  this.renderSettings(this.containerEl);
                })();
              });
            } else {
              new Notice(t.settings.autoProbeNotFoundNotice);
            }
            probeBtn.disabled = false;
            probeBtn.setText(`🔄 ${t.settings.autoProbeBtn}`);
          })();
        });
      }
    }
  }

  private async saveProbeToCurrentProfile(updates: Partial<DeviceKeyProfile>): Promise<void> {
    const activeProf = getActiveProfile(this.plugin.settings);
    if (activeProf) {
      Object.assign(activeProf, updates);
    } else {
      const newProf: DeviceKeyProfile = {
        id: `dev-${Date.now()}`,
        name: getDeviceDisplayName(this.plugin.settings),
        hostname: getDeviceHostname(this.plugin.settings) || undefined,
        ...updates
      };
      if (!this.plugin.settings.deviceProfiles) {
        this.plugin.settings.deviceProfiles = [];
      }
      this.plugin.settings.deviceProfiles.push(newProf);
      setActiveProfileId(newProf.id);
    }
    await this.plugin.saveSettings();
    this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
  }

  private renderProviderTabs(containerEl: HTMLElement, t: TranslationStrings): void {
    this.renderUnifiedProviderDashboard(containerEl, t);
  }

  private renderUnifiedProviderDashboard(containerEl: HTMLElement, t: TranslationStrings): void {
    const dashboard = containerEl.createDiv({ cls: 'emily-unified-provider-dashboard' });

    // 1. Notice banner for multi-machine isolated keys
    const noticeBanner = dashboard.createDiv({ cls: 'emily-tab-info-banner' });
    noticeBanner.createSpan({ cls: 'emily-tab-info-icon', text: '💡' });
    noticeBanner.createSpan({
      cls: 'emily-tab-info-text',
      text: `${t.settings.identicalPortNotice} ${t.settings.currentMachineProfileDesc}`
    });

    // 2. Top Card: Current PC Active Profile & Live Status
    const activeProf = getActiveProfile(this.plugin.settings);
    const activeId = getActiveProfileId();
    const effectiveEndpoint = resolveEffectiveEndpoint(this.plugin.settings);
    const effectiveKey = resolveEffectiveApiKey(this.plugin.settings);
    const profiles = this.plugin.settings.deviceProfiles || [];

    const activeCard = dashboard.createDiv({ cls: 'emily-active-device-panel' });
    const headerRow = activeCard.createDiv({ cls: 'emily-active-card-header' });
    const titleSpan = headerRow.createSpan({ cls: 'emily-active-card-title' });
    titleSpan.setText(`💻 ${t.settings.currentMachineProfileTitle}`);

    // Dropdown for Active Profile
    new Setting(activeCard)
      .setName(t.settings.currentMachineProfileTitle)
      .setDesc(t.settings.currentMachineProfileDesc)
      .addDropdown((dropdown) => {
        dropdown.addOption('__global__', t.settings.useGlobalDefaultOption);
        for (const p of profiles) {
          const u = p.url ? ` (${p.url})` : '';
          dropdown.addOption(p.id, `🏢 ${p.name}${u}`);
        }
        dropdown.setValue(activeId || (activeProf ? activeProf.id : '__global__'));
        dropdown.onChange(async (val) => {
          setActiveProfileId(val);
          this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
          const chosenName = val === '__global__'
            ? '전역 기본값'
            : (profiles.find((p) => p.id === val)?.name || val);
          new Notice(t.settings.appliedToCurrentMachineNotice.replace('{name}', chosenName));
          this.renderSettings(this.containerEl);
        });
      });

    // Live Effective Status Box
    const statusBox = activeCard.createDiv({ cls: 'emily-active-status-box' });
    const statusRow1 = statusBox.createDiv({ cls: 'emily-status-summary-row' });

    const badgeProfile = statusRow1.createSpan({
      cls: `emily-badge ${activeProf ? 'is-done font-bold' : ''}`
    });
    badgeProfile.setText(activeProf ? `🏢 ${activeProf.name}` : '🌐 전역 기본값');

    const badgeUrl = statusRow1.createSpan({ cls: 'emily-badge emily-endpoint-badge' });
    badgeUrl.setText(`URL: ${effectiveEndpoint.url}`);

    const badgeKey = statusRow1.createSpan({
      cls: `emily-badge ${effectiveKey.source === 'profile' ? 'is-done' : ''}`
    });
    const maskedKey = effectiveKey.key && effectiveKey.key.length > 0
      ? `${effectiveKey.key.slice(0, 4)}••••${effectiveKey.key.slice(-3)}`
      : '(API Key 없음)';
    badgeKey.setText(`Key: ${maskedKey} (${effectiveKey.source === 'profile' ? '기기 전용' : '공용'})`);

    // Test Connection Button & Result Box inside the Active Card
    const testResultDiv = activeCard.createDiv({ cls: 'emily-test-result-box' });

    new Setting(activeCard)
      .setName(t.settings.sayHelloTitle)
      .setDesc(t.settings.activeConnectionDesc)
      .addButton((btn) => {
        btn
          .setButtonText(t.settings.testActiveConnectionBtn || t.settings.sayHelloBtn)
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
              btn.setButtonText(t.settings.testActiveConnectionBtn || t.settings.sayHelloBtn);
            }
          });
      });

    activeCard.appendChild(testResultDiv);

    // 3. Section: Registered Device Profiles Pool (OneDrive Synced)
    const poolContainer = dashboard.createDiv({ cls: 'emily-profiles-section' });
    const poolHeader = new Setting(poolContainer)
      .setName(t.settings.profilePoolTitle)
      .setDesc(t.settings.profilePoolDesc)
      .setHeading();

    poolHeader.addButton((btn) => {
      btn
        .setButtonText(`➕ ${t.settings.addProfileBtn}`)
        .setCta()
        .onClick(() => {
          new DeviceProfileModal(this.app, this.plugin, null, () => {
            this.renderSettings(this.containerEl);
          }).open();
        });
    });

    const tableEl = poolContainer.createDiv({ cls: 'emily-profiles-table' });
    if (profiles.length === 0) {
      const emptyBox = tableEl.createDiv({ cls: 'emily-empty-profiles-box text-muted text-xs' });
      emptyBox.setText('등록된 기기 프로필이 없습니다. 상단의 [새 기기 프로필 추가] 버튼으로 PC 설정을 등록하세요.');
    } else {
      for (const prof of profiles) {
        this.renderProfileItemCard(tableEl, prof, activeProf?.id || '', t);
      }
    }

    // 4. Section: Global Synced Default Settings (Fallback)
    const globalSection = dashboard.createDiv({ cls: 'emily-global-fallback-section' });
    new Setting(globalSection)
      .setName('🌐 전역 기본 설정 (Global Synced Fallback)')
      .setDesc('기기 전용 프로필을 지정하지 않은 컴퓨터나 기기 분기를 껐을 때 공통으로 사용할 엔드포인트와 API Key입니다.')
      .setHeading();

    new Setting(globalSection)
      .setName(t.settings.apiBaseUrlTitle)
      .setDesc(t.settings.apiBaseUrlDesc)
      .addText((text) =>
        text
          .setPlaceholder('https://api.openai.com/v1')
          .setValue(this.plugin.settings.apiBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiBaseUrl = value.trim();
            await this.plugin.saveSettings();
            this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
          })
      )
      .addExtraButton((btn) => {
        btn.setIcon('reset')
          .setTooltip(t.common.reset)
          .onClick(async () => {
            this.plugin.settings.apiBaseUrl = 'https://api.openai.com/v1';
            await this.plugin.saveSettings();
            this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
            this.renderSettings(this.containerEl);
          });
      });

    new Setting(globalSection)
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
            this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
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
            this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
            this.renderSettings(this.containerEl);
          });
      });

    new Setting(globalSection)
      .setName(t.settings.modelTitle)
      .setDesc(t.settings.modelDesc)
      .addText((text) =>
        text
          .setPlaceholder(t.settings.modelPlaceholder)
          .setValue(this.plugin.settings.modelName || 'auto')
          .onChange(async (val) => {
            this.plugin.settings.modelName = val.trim() || 'auto';
            await this.plugin.saveSettings();
            this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
          })
      )
      .addExtraButton((btn) => {
        btn.setIcon('reset')
          .setTooltip(t.settings.modelResetTooltip)
          .onClick(async () => {
            this.plugin.settings.modelName = 'auto';
            await this.plugin.saveSettings();
            this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
            this.renderSettings(this.containerEl);
          });
      });

    new Setting(globalSection)
      .setName(t.settings.useDeviceOverrideTitle)
      .setDesc(t.settings.useDeviceOverrideDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useDeviceKeyOverride ?? true)
          .onChange(async (val) => {
            this.plugin.settings.useDeviceKeyOverride = val;
            await this.plugin.saveSettings();
            this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
            this.renderSettings(this.containerEl);
          })
      );
  }

  private renderProfileItemCard(
    containerEl: HTMLElement,
    prof: DeviceKeyProfile,
    activeProfileId: string,
    t: TranslationStrings
  ): void {
    const currentHost = getDeviceHostname(this.plugin.settings).toLowerCase();
    const isActiveOnThisPC = activeProfileId === prof.id || (
      !activeProfileId && Boolean(currentHost && prof.hostname && prof.hostname.trim().toLowerCase() === currentHost)
    );

    const row = containerEl.createDiv({
      cls: `emily-profile-item ${isActiveOnThisPC ? 'is-current-device' : ''}`
    });

    const info = row.createDiv({ cls: 'emily-profile-info' });
    const nameRow = info.createDiv({ cls: 'emily-profile-name-row' });
    nameRow.createEl('strong', { text: prof.name });
    if (prof.hostname) {
      nameRow.createSpan({ text: `(${prof.hostname})`, cls: 'text-muted text-xs font-mono' });
    }
    if (isActiveOnThisPC) {
      nameRow.createSpan({
        text: `✓ ${t.settings.activeOnCurrentMachineBadge}`,
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

    if (!isActiveOnThisPC) {
      const applyBtn = actCol.createEl('button', {
        text: `📍 ${t.settings.applyToCurrentMachineBtn}`,
        cls: 'emily-btn-cta text-xs'
      });
      applyBtn.addEventListener('click', () => {
        void (async () => {
          setActiveProfileId(prof.id);
          this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
          new Notice(t.settings.appliedToCurrentMachineNotice.replace('{name}', prof.name));
          this.renderSettings(this.containerEl);
        })();
      });
    }

    const editBtn = actCol.createEl('button', {
      text: `✏️ ${t.settings.editProfileBtn}`,
      cls: 'emily-btn-secondary text-xs'
    });
    editBtn.addEventListener('click', () => {
      new DeviceProfileModal(this.app, this.plugin, prof, () => {
        this.renderSettings(this.containerEl);
      }).open();
    });

    const delBtn = actCol.createEl('button', {
      text: '✕',
      cls: 'emily-icon-btn',
      attr: { title: t.common.delete }
    });
    delBtn.addEventListener('click', () => {
      void (async () => {
        this.plugin.settings.deviceProfiles = (this.plugin.settings.deviceProfiles || []).filter((p) => p.id !== prof.id);
        if (getActiveProfileId() === prof.id) {
          setActiveProfileId('');
        }
        await this.plugin.saveSettings();
        this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
        new Notice(t.settings.profileDeleteSuccessNotice);
        this.renderSettings(this.containerEl);
      })();
    });
  }
}




