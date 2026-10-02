import { App, PluginSettingTab, Setting, Notice, setIcon, SettingDefinitionItem, ToggleComponent } from 'obsidian';
import type EmilyPlugin from '../main';
import { getTranslation, getObsidianLanguage, getDefaultTargetLanguageName, getSourceLanguages, getSupportedLanguages, getLocalizedLanguageName, normalizeLanguageCode } from '../i18n';
import { TranslationStrings } from '../i18n/types';
import { getSystemContext } from '../utils/systemInfo';
import { TranslationScope, PreservationStrategy, TranslationTone, TranslationStyle } from '../types/translation';
import { DeviceKeyProfile, AIProviderConfig } from '../types/settings';
import { ProviderModal } from './providerModal';
import { ProviderModelModal } from './providerModelModal';
import {
  getDeviceHostname,
  getDeviceDisplayName,
  setActiveProfileId,
  getActiveProfile,
  getCandidateKeys,
  getCandidatePorts,
  isLocalEndpoint,
  getRegisteredProviders,
  getEffectiveProviderForDevice,
  setDeviceProviderBinding
} from '../utils/deviceKeyManager';

/**
 * Assistant Emily 환경 설정 탭 뷰 클래스
 * - 옵시디언 설정 화면에서 API 연결, 표시 언어, 교열 및 번역 기본 옵션을 구성
 */
export class EmilySettingTab extends PluginSettingTab {
  plugin: EmilyPlugin;
  private expandedProviderIds: Set<string> = new Set();

  private activeTab: 'providers' | 'translation' | 'proofreading' | 'general' = 'providers';
  private providerTestResults: Map<string, { success: boolean; latencyMs: number; time: number }> = new Map();

  constructor(app: App, plugin: EmilyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Return empty array so Obsidian 1.13+ calls display() imperatively.
   * According to Obsidian 1.13+ API docs:
   * "display() is not called when getSettingDefinitions returns a non-empty array;
   * the tab is rendered declaratively from those definitions instead."
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

    // =========================================================================
    // 4-Subtab Navigation Bar
    // =========================================================================
    const navBar = containerEl.createDiv({ cls: 'emily-settings-tab-nav' });

    const tabs: Array<{ id: 'providers' | 'translation' | 'proofreading' | 'general'; icon: string; label: string }> = [
      { id: 'providers', icon: 'cpu', label: t.settings.tabProviders },
      { id: 'translation', icon: 'languages', label: t.settings.tabTranslation },
      { id: 'proofreading', icon: 'check-check', label: t.settings.tabProofreading },
      { id: 'general', icon: 'sliders', label: t.settings.tabGeneral }
    ];

    for (const tab of tabs) {
      const btn = navBar.createEl('button', {
        cls: `emily-settings-tab-btn ${this.activeTab === tab.id ? 'is-active' : ''}`
      });
      setIcon(btn, tab.icon);
      btn.createSpan({ text: tab.label });

      btn.addEventListener('click', () => {
        if (this.activeTab !== tab.id) {
          this.activeTab = tab.id;
          this.renderSettings(containerEl);
        }
      });
    }

    const tabContentEl = containerEl.createDiv({ cls: 'emily-provider-tab-panel' });

    // =========================================================================
    // Tab 1: AI 서비스 프로바이더 (AI Service Providers)
    // =========================================================================
    if (this.activeTab === 'providers') {
      const providerHeader = new Setting(tabContentEl)
        .setName(t.settings.providerSectionHeading)
        .setDesc(t.settings.providerSectionDesc)
        .setHeading();

      providerHeader.addButton((btn) => {
        btn
          .setButtonText(t.settings.addProviderBtn)
          .setCta()
          .onClick(() => {
            new ProviderModal(this.app, this.plugin, null, (saved) => {
              this.expandedProviderIds.add(saved.id);
              this.renderSettings(containerEl);
            }).open();
          });
        btn.buttonEl.addClass('emily-btn-green');
      });

      // AI 서비스 프로바이더 목록
      this.renderUnifiedProviderDashboard(tabContentEl, t);
    }

    // =========================================================================
    // Tab 2: 번역 기본 설정 (Translation Preferences)
    // =========================================================================
    if (this.activeTab === 'translation') {
      new Setting(tabContentEl)
        .setName(t.settings.translationSectionTitle)
        .setDesc(t.settings.translationSectionDesc)
        .setHeading();

      new Setting(tabContentEl)
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
      new Setting(tabContentEl)
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
      new Setting(tabContentEl)
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

      new Setting(tabContentEl)
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

      new Setting(tabContentEl)
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

      new Setting(tabContentEl)
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

      new Setting(tabContentEl)
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

      new Setting(tabContentEl)
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
    }

    // =========================================================================
    // Tab 3: 교열 및 서식 제거 기본 설정 (Proofreading & Formatting)
    // =========================================================================
    if (this.activeTab === 'proofreading') {
      new Setting(tabContentEl)
        .setName(t.settings.proofreadSectionTitle)
        .setDesc(t.settings.proofreadSectionDesc)
        .setHeading();

      new Setting(tabContentEl)
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

      new Setting(tabContentEl)
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

      new Setting(tabContentEl)
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

      // 서식 제거 기본 설정
      new Setting(tabContentEl)
        .setName(t.settings.editPreferencesHeader)
        .setHeading();

      new Setting(tabContentEl)
        .setName(t.settings.stripBoldTitle)
        .setDesc(t.settings.stripBoldDesc)
        .addToggle((toggle) =>
          toggle
            .setValue(Boolean(this.plugin.settings.defaultStripBold))
            .onChange(async (val) => {
              this.plugin.settings.defaultStripBold = val;
              await this.plugin.saveSettings();
              this.plugin.syncSidebarSettings();
            })
        );

      new Setting(tabContentEl)
        .setName(t.settings.stripItalicTitle)
        .setDesc(t.settings.stripItalicDesc)
        .addToggle((toggle) =>
          toggle
            .setValue(Boolean(this.plugin.settings.defaultStripItalic))
            .onChange(async (val) => {
              this.plugin.settings.defaultStripItalic = val;
              await this.plugin.saveSettings();
              this.plugin.syncSidebarSettings();
            })
        );

      new Setting(tabContentEl)
        .setName(t.settings.stripStrikethroughTitle)
        .setDesc(t.settings.stripStrikethroughDesc)
        .addToggle((toggle) =>
          toggle
            .setValue(Boolean(this.plugin.settings.defaultStripStrikethrough))
            .onChange(async (val) => {
              this.plugin.settings.defaultStripStrikethrough = val;
              await this.plugin.saveSettings();
              this.plugin.syncSidebarSettings();
            })
        );

      new Setting(tabContentEl)
        .setName(t.settings.stripHighlightTitle)
        .setDesc(t.settings.stripHighlightDesc)
        .addToggle((toggle) =>
          toggle
            .setValue(Boolean(this.plugin.settings.defaultStripHighlight))
            .onChange(async (val) => {
              this.plugin.settings.defaultStripHighlight = val;
              await this.plugin.saveSettings();
              this.plugin.syncSidebarSettings();
            })
        );
    }

    // =========================================================================
    // Tab 4: 일반 & 인터페이스 환경설정 (General & UI)
    // =========================================================================
    if (this.activeTab === 'general') {
      new Setting(tabContentEl)
        .setName(t.settings.editorPreferencesHeader)
        .setHeading();

      // Interface Display Language
      const detectedLangCode = getObsidianLanguage();
      const detectedLangName = detectedLangCode.startsWith('ko') ? '한국어 (Korean)' : 'English';
      const autoOptionLabel = `${t.settings.languageAuto} (${detectedLangName})`;

      new Setting(tabContentEl)
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

      new Setting(tabContentEl)
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

      new Setting(tabContentEl)
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
                    setActiveProfileId(matchedCandidate.profileId, this.plugin.settings);
                    await this.plugin.saveSettings();
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
      setActiveProfileId(newProf.id, this.plugin.settings);
    }
    await this.plugin.saveSettings();
    this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
  }

  private renderUnifiedProviderDashboard(containerEl: HTMLElement, t: TranslationStrings): void {
    const dashboard = containerEl.createDiv({ cls: 'emily-unified-provider-dashboard' });

    const providers = getRegisteredProviders(this.plugin.settings);
    const activeProv = getEffectiveProviderForDevice(this.plugin.settings);

    const providersListEl = dashboard.createDiv({ cls: 'emily-providers-list' });
    if (providers.length === 0) {
      const emptyBox = providersListEl.createDiv({ cls: 'emily-empty-profiles-box text-muted text-xs' });
      emptyBox.setText('등록된 프로바이더가 없습니다. 상단의 [+ Add provider] 버튼으로 프로바이더를 등록하세요.');
    } else {
      for (const prov of providers) {
        this.renderProviderAccordionCard(providersListEl, prov, activeProv?.id || '', t);
      }
    }
  }

  /**
   * YOLO 스타일 프로바이더 아코디언 카드 렌더링
   */
  private renderProviderAccordionCard(
    containerEl: HTMLElement,
    prov: AIProviderConfig,
    activeProviderId: string,
    t: TranslationStrings
  ): void {
    const isExpanded = this.expandedProviderIds.has(prov.id);
    const isActiveOnThisPC = activeProviderId === prov.id;

    const card = containerEl.createDiv({
      cls: `emily-provider-card ${isActiveOnThisPC ? 'is-active-provider' : ''}`
    });

    // 1. Accordion Header
    const header = card.createDiv({ cls: 'emily-provider-header' });

    // Left: Toggle arrow
    const chevron = header.createSpan({ cls: 'emily-accordion-chevron' });
    chevron.setText(isExpanded ? '▾' : '▸');

    // Name & URL
    const titleCol = header.createDiv({ cls: 'emily-provider-title-col' });
    titleCol.createEl('strong', { text: prov.name, cls: 'emily-provider-name' });
    titleCol.createSpan({ text: prov.baseUrl, cls: 'emily-provider-url text-muted font-mono text-xs' });

    // Click anywhere on header to toggle expansion
    const toggleExpansion = () => {
      if (this.expandedProviderIds.has(prov.id)) {
        this.expandedProviderIds.delete(prov.id);
      } else {
        this.expandedProviderIds.add(prov.id);
      }
      this.renderSettings(this.containerEl);
    };

    header.addEventListener('click', toggleExpansion);

    // Badges & Action Buttons (Right)
    const rightCol = header.createDiv({ cls: 'emily-provider-header-right' });

    // Status badge (Health check result)
    const testResult = this.providerTestResults.get(prov.id);
    const statusBadge = rightCol.createSpan({ cls: 'emily-badge' });
    if (testResult) {
      if (testResult.success) {
        statusBadge.addClass('is-success');
        statusBadge.setText(t.settings.providerStatusOnline.replace('{latency}', String(testResult.latencyMs)));
      } else {
        statusBadge.addClass('is-error');
        statusBadge.setText(t.settings.providerStatusOffline);
      }
    } else {
      statusBadge.setText(t.settings.providerStatusUntested);
    }

    // Models count badge
    const modelCountBadge = rightCol.createSpan({ cls: 'emily-badge' });
    modelCountBadge.setText(t.settings.modelsCountBadge.replace('{count}', String(prov.models?.length || 0)));

    // Active Badge or Apply Button
    if (isActiveOnThisPC) {
      const activeBadge = rightCol.createSpan({ cls: 'emily-badge is-done font-bold' });
      activeBadge.setText('✓ 현재 기기 적용 중');
    } else {
      const applyBtn = rightCol.createEl('button', {
        text: '📍 이 기기에 적용',
        cls: 'emily-btn-cta text-xs'
      });
      applyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        void (async () => {
          setDeviceProviderBinding(this.plugin.settings, prov.id);
          this.plugin.settings.defaultProviderId = prov.id;
          await this.plugin.saveSettings();
          this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
          new Notice(t.settings.appliedToCurrentMachineNotice.replace('{name}', prov.name));
          this.renderSettings(this.containerEl);
        })();
      });
    }

    // ⚙️ Edit Provider (Gear)
    const editBtn = rightCol.createEl('button', {
      cls: 'emily-icon-btn',
      attr: { title: t.settings.editProviderBtn }
    });
    setIcon(editBtn, 'settings');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      new ProviderModal(this.app, this.plugin, prov, () => {
        this.renderSettings(this.containerEl);
      }).open();
    });

    // 🗑️ Delete Provider (Trash)
    const delBtn = rightCol.createEl('button', {
      cls: 'emily-icon-btn',
      attr: { title: t.settings.deleteProviderBtn }
    });
    setIcon(delBtn, 'trash');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      void (async () => {
        this.plugin.settings.providers = (this.plugin.settings.providers || []).filter((p) => p.id !== prov.id);
        this.expandedProviderIds.delete(prov.id);

        const remaining = this.plugin.settings.providers[0];
        if (this.plugin.settings.defaultProviderId === prov.id) {
          this.plugin.settings.defaultProviderId = remaining ? remaining.id : '';
        }

        if (this.plugin.settings.deviceMappings) {
          for (const key of Object.keys(this.plugin.settings.deviceMappings)) {
            if (this.plugin.settings.deviceMappings[key]?.providerId === prov.id) {
              if (remaining) {
                this.plugin.settings.deviceMappings[key].providerId = remaining.id;
              } else {
                delete this.plugin.settings.deviceMappings[key];
              }
            }
          }
        }

        await this.plugin.saveSettings();
        this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
        new Notice(`프로바이더가 삭제되었습니다: ${prov.name}`);
        this.renderSettings(this.containerEl);
      })();
    });

    // 2. Accordion Body (Expanded view)
    if (isExpanded) {
      const body = card.createDiv({ cls: 'emily-provider-accordion-body' });

      // Actions row: [Connectivity Test] & [+ Add chat model]
      const actionRow = body.createDiv({ cls: 'emily-provider-action-row' });

      const testBtn = actionRow.createEl('button', {
        text: t.settings.connectivityTestBtn,
        cls: 'emily-btn-secondary text-xs'
      });

      const addModelBtn = actionRow.createEl('button', {
        text: t.settings.addChatModelBtn,
        cls: 'emily-btn-cta text-xs'
      });
      addModelBtn.addEventListener('click', () => {
        new ProviderModelModal(this.app, this.plugin, prov, null, () => {
          this.renderSettings(this.containerEl);
        }).open();
      });

      // Inline test result box
      const testResultEl = body.createDiv({ cls: 'emily-test-result-box' });

      testBtn.addEventListener('click', () => {
        void (async () => {
          testBtn.disabled = true;
          testBtn.setText(t.settings.connectivityTesting);
          testResultEl.empty();

          try {
            const sysContext = getSystemContext();
            const client = this.plugin.getLLMClient();
            const res = await client.testProvider(
              sysContext.languageName,
              sysContext.timePeriod,
              prov.apiKey || '',
              prov.baseUrl
            );
            this.providerTestResults.set(prov.id, {
              success: res.success,
              latencyMs: res.latencyMs,
              time: Date.now()
            });
            if (res.success) {
              statusBadge.className = 'emily-badge is-success';
              statusBadge.setText(t.settings.providerStatusOnline.replace('{latency}', String(res.latencyMs)));
            } else {
              statusBadge.className = 'emily-badge is-error';
              statusBadge.setText(t.settings.providerStatusOffline);
            }
            this.renderTestResult(testResultEl, res, t);
            if (res.success) {
              new Notice(t.settings.connectivitySuccessNotice.replace('{name}', prov.name).replace('{latency}', String(res.latencyMs)));
            } else {
              new Notice(`${t.settings.connectivityFailedNotice}${res.error}`);
            }
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this.providerTestResults.set(prov.id, {
              success: false,
              latencyMs: 0,
              time: Date.now()
            });
            statusBadge.className = 'emily-badge is-error';
            statusBadge.setText(t.settings.providerStatusOffline);
            this.renderTestResult(testResultEl, { success: false, message: '', latencyMs: 0, model: '', error: errMsg }, t);
            new Notice(`${t.settings.connectivityFailedNotice}${errMsg}`);
          } finally {
            testBtn.disabled = false;
            testBtn.setText(t.settings.connectivityTestBtn);
          }
        })();
      });

      // Chat models table
      const tableWrapper = body.createDiv({ cls: 'emily-models-table-wrapper' });
      const table = tableWrapper.createEl('table', { cls: 'emily-models-table' });
      const thead = table.createEl('thead');
      const headerTr = thead.createEl('tr');
      headerTr.createEl('th', { text: t.settings.colDisplayName });
      headerTr.createEl('th', { text: t.settings.colModelId });
      headerTr.createEl('th', { text: t.settings.colEnable });
      headerTr.createEl('th', { text: t.settings.colActions });

      const tbody = table.createEl('tbody');
      const models = prov.models || [];

      if (models.length === 0) {
        const emptyTr = tbody.createEl('tr');
        const emptyTd = emptyTr.createEl('td', { attr: { colspan: '4' }, cls: 'text-muted text-xs' });
        emptyTd.setText('등록된 모델이 없습니다. [+ Add chat model] 버튼으로 모델을 등록하세요.');
      } else {
        for (const m of models) {
          const tr = tbody.createEl('tr');

          // Display name
          tr.createEl('td', { text: m.displayName, cls: 'font-semibold' });

          // Model (calling ID)
          const idTd = tr.createEl('td');
          idTd.createEl('code', { text: m.id, cls: 'font-mono text-xs' });

          // Enable toggle
          const enableTd = tr.createEl('td', { cls: 'emily-model-enable-td' });
          new ToggleComponent(enableTd)
            .setValue(m.enabled)
            .onChange(async (val) => {
              m.enabled = val;
              await this.plugin.saveSettings();
              this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
            });

          // Actions: Edit / Delete
          const actionsTd = tr.createEl('td', { cls: 'emily-model-actions-td' });
          const editModelBtn = actionsTd.createEl('button', { cls: 'emily-icon-btn', attr: { title: t.settings.editChatModelBtn } });
          setIcon(editModelBtn, 'settings');
          editModelBtn.addEventListener('click', () => {
            new ProviderModelModal(this.app, this.plugin, prov, m, () => {
              this.renderSettings(this.containerEl);
            }).open();
          });

          const delModelBtn = actionsTd.createEl('button', { cls: 'emily-icon-btn', attr: { title: t.settings.deleteChatModelBtn } });
          setIcon(delModelBtn, 'trash');
          delModelBtn.addEventListener('click', () => {
            void (async () => {
              prov.models = prov.models.filter((item) => item.id !== m.id);
              await this.plugin.saveSettings();
              this.plugin.getLLMClient().updateMultiConfig(this.plugin.settings);
              new Notice(`모델이 삭제되었습니다: ${m.displayName}`);
              this.renderSettings(this.containerEl);
            })();
          });
        }
      }
    }
  }
}




