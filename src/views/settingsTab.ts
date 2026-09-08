import { App, PluginSettingTab, Setting, Notice, setIcon } from 'obsidian';
import type EmilyPlugin from '../main';
import { getTranslation, getObsidianLanguage, getDefaultTargetLanguageName, getSourceLanguages, getSupportedLanguages, getLocalizedLanguageName, normalizeLanguageCode } from '../i18n';
import { getSystemContext } from '../utils/systemInfo';
import { TranslationScope, PreservationStrategy } from '../types/translation';

/**
 * Assistant Emily 환경 설정 탭 뷰 클래스
 * - 옵시디언 설정 화면에서 API 연결, 표시 언어, 교열 및 번역 기본 옵션을 구성
 */
export class EmilySettingTab extends PluginSettingTab {
  plugin: EmilyPlugin;

  constructor(app: App, plugin: EmilyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * 설정 탭 화면 요소를 렌더링하고 사용자 입력 이벤트를 바인딩합니다.
   */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const t = getTranslation(this.plugin.settings.language);

    containerEl.createEl('h2', { text: t.settings.title });
    containerEl.createEl('p', { text: t.settings.description, cls: 'setting-item-description' });

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
          .onChange(async (val: any) => {
            this.plugin.settings.language = val;
            await this.plugin.saveSettings();
            this.display();
            this.plugin.syncSidebarSettings();
            this.plugin.refreshFloatingControls();
          });
      });

    // Section 1: API / LLM Proxy Config
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
            this.display();
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

        // Visibility Toggle Button
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
            this.display();
          });
      });

    // Model Name Text Input
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
            this.display();
          });
      });

    // Say Hello Connectivity Test
    const helloResultDiv = containerEl.createDiv({ cls: 'emily-say-hello-result-panel' });
    helloResultDiv.style.margin = '0 0 14px 0';
    helloResultDiv.style.width = '100%';

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
            helloResultDiv.empty();

            try {
              const sysContext = getSystemContext();
              const client = this.plugin.getLLMClient();
              const res = await client.testSayHello(sysContext.languageName, sysContext.timePeriod);

              helloResultDiv.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; padding-top:4px;">
                  <span class="emily-badge is-success">✓ ${t.settings.sayHelloSuccess} (${res.latencyMs}ms)</span>
                  <span class="emily-badge">${res.model}</span>
                </div>
                <div style="color:var(--text-normal); font-size:13px; line-height:1.5; background:var(--background-secondary); padding:10px 14px; border-radius:6px; border-left:3px solid var(--interactive-accent);">
                  💬 <strong>Assistant Emily:</strong> "${res.message}"
                </div>
              `;
              new Notice(t.settings.sayHelloNoticeSuccess);
            } catch (err: any) {
              helloResultDiv.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; padding-top:4px;">
                  <span class="emily-badge is-warning">✗ ${t.settings.sayHelloFailed}</span>
                </div>
                <div style="color:var(--text-error); font-size:12px; background:var(--background-secondary); padding:8px 12px; border-radius:4px;">
                  ${err.message || err}
                </div>
              `;
              new Notice(`${t.settings.sayHelloNoticeFailed}${err.message || err}`);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText(t.settings.sayHelloBtn);
            }
          });
      });

    containerEl.appendChild(helloResultDiv);

    // =========================================================================
    // Section 2: 교열 기본 설정 (Proofreading Preferences)
    // =========================================================================
    containerEl.createEl('h3', { text: t.settings.proofreadSectionTitle });
    containerEl.createEl('p', {
      text: t.settings.proofreadSectionDesc,
      cls: 'setting-item-description'
    });

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
    containerEl.createEl('h3', { text: t.settings.translationSectionTitle });
    containerEl.createEl('p', {
      text: t.settings.translationSectionDesc,
      cls: 'setting-item-description'
    });

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
          .onChange(async (val: any) => {
            this.plugin.settings.defaultTranslationTone = val;
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
          .onChange(async (val: any) => {
            this.plugin.settings.defaultTranslationStyle = val;
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
    containerEl.createEl('h3', { text: t.settings.editorPreferencesHeader });

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
}

