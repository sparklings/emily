import { App, PluginSettingTab, Setting, Notice, setIcon, SettingDefinitionItem } from 'obsidian';
import type EmilyPlugin from '../main';
import { getTranslation, getObsidianLanguage, getDefaultTargetLanguageName, getSourceLanguages, getSupportedLanguages, getLocalizedLanguageName, normalizeLanguageCode } from '../i18n';
import { TranslationStrings } from '../i18n/types';
import { getSystemContext } from '../utils/systemInfo';
import { TranslationScope, PreservationStrategy, TranslationTone, TranslationStyle } from '../types/translation';

/**
 * Assistant Emily 환경 설정 탭 뷰 클래스
 * - 옵시디언 설정 화면에서 API 연결, 표시 언어, 교열 및 번역 기본 옵션을 구성
 */
export class EmilySettingTab extends PluginSettingTab {
  plugin: EmilyPlugin;
  private selectedProviderTab: 'primary' | 'secondary' = 'primary';
  private tab2ConfiguredDot: HTMLElement | null = null;

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
    // Section 3: 번역 기본 설정 (Translation Preferences)
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
    // Section 4: 에디터 및 인터페이스 환경설정 (Editor Preferences)
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
    result: { success: boolean; message: string; latencyMs: number; model: string; error?: string },
    t: TranslationStrings
  ): void {
    container.empty();
    const badgeRow = container.createDiv({ cls: 'emily-test-badge-row' });
    if (result.success) {
      const successBadge = badgeRow.createSpan({ cls: 'emily-badge is-success' });
      successBadge.setText(`✓ ${t.settings.sayHelloSuccess} (${result.latencyMs}ms)`);
      const modelBadge = badgeRow.createSpan({ cls: 'emily-badge' });
      modelBadge.setText(result.model);

      const msgBox = container.createDiv({ cls: 'emily-test-msg-box' });
      msgBox.createSpan({ text: '💬 ' });
      msgBox.createEl('strong', { text: 'Assistant Emily: ' });
      msgBox.createSpan({ text: `"${result.message}"` });
    } else {
      const failBadge = badgeRow.createSpan({ cls: 'emily-badge is-warning' });
      failBadge.setText(`✗ ${t.settings.sayHelloFailed}`);
      const errBox = container.createDiv({ cls: 'emily-test-err-box' });
      errBox.setText(result.error || 'Connection failed');
    }
  }

  private renderProviderTabs(containerEl: HTMLElement, t: TranslationStrings): void {
    const navEl = containerEl.createDiv({
      cls: 'emily-settings-tab-nav',
      attr: { role: 'tablist', 'aria-label': 'AI Service Providers' }
    });

    const tabContentEl = containerEl.createDiv({ cls: 'emily-provider-tab-panel' });

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

    const switchTab = (tab: 'primary' | 'secondary') => {
      if (this.selectedProviderTab === tab) return;
      this.selectedProviderTab = tab;

      btn1.classList.toggle('is-active', tab === 'primary');
      btn1.setAttribute('aria-selected', tab === 'primary' ? 'true' : 'false');
      btn1.setAttribute('tabindex', tab === 'primary' ? '0' : '-1');

      btn2.classList.toggle('is-active', tab === 'secondary');
      btn2.setAttribute('aria-selected', tab === 'secondary' ? 'true' : 'false');
      btn2.setAttribute('tabindex', tab === 'secondary' ? '0' : '-1');

      this.renderActiveTabContent(tabContentEl, t);
    };

    btn1.addEventListener('click', () => switchTab('primary'));
    btn2.addEventListener('click', () => switchTab('secondary'));

    navEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        switchTab('secondary');
        btn2.focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        switchTab('primary');
        btn1.focus();
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
    if (this.selectedProviderTab === 'secondary') {
      this.renderProvider2Content(tabContentEl, t);
    } else {
      this.renderProvider1Content(tabContentEl, t);
    }
  }

  private renderProvider1Content(containerEl: HTMLElement, t: TranslationStrings): void {
    containerEl.empty();
    new Setting(containerEl).setName(t.settings.provider1Heading).setDesc(t.settings.provider1Desc).setHeading();

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
              this.renderTestResult(p1ResultDiv, res, t);
              if (res.success) {
                new Notice(t.settings.sayHelloNoticeSuccess);
              } else {
                new Notice(`${t.settings.sayHelloNoticeFailed}${res.error}`);
              }
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : String(err);
              this.renderTestResult(p1ResultDiv, { success: false, message: '', latencyMs: 0, model: '', error: errMsg }, t);
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
    new Setting(containerEl).setName(t.settings.provider2Heading).setDesc(t.settings.provider2Desc).setHeading();

    new Setting(containerEl)
      .setName(t.settings.secondaryApiBaseUrlTitle)
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
      .setName(t.settings.secondaryApiKeyTitle)
      .setDesc(t.settings.secondaryApiKeyDesc)
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
      .setName(t.settings.secondaryModelTitle)
      .setDesc(t.settings.secondaryModelDesc)
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
              this.renderTestResult(p2ResultDiv, res, t);
              if (res.success) {
                new Notice(t.settings.sayHelloNoticeSuccess);
              } else {
                new Notice(`${t.settings.sayHelloNoticeFailed}${res.error}`);
              }
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : String(err);
              this.renderTestResult(p2ResultDiv, { success: false, message: '', latencyMs: 0, model: '', error: errMsg }, t);
              new Notice(`${t.settings.sayHelloNoticeFailed}${errMsg}`);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText(t.settings.sayHelloBtn);
            }
          });
      });

    containerEl.appendChild(p2ResultDiv);
  }
}



