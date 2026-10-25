import { Plugin, WorkspaceLeaf, MarkdownView, Notice, Editor } from 'obsidian';
import { TranslationOptions } from './types/translation';
import { EmilySettings, DEFAULT_SETTINGS } from './types/settings';
import { EMILY_VIEW_TYPE, EMILY_ICON_NAME } from './constants';
import { EmilySettingTab } from './views/settingsTab';
import { EmilySidebarView, RollingSessionData, getISODateTimeString } from './views/sidebarView';
import { LLMProxyClient } from './api/llmClient';
import { ProofreadingEngine } from './core/proofreadingEngine';
import { TranslationEngine } from './core/translationEngine';
import { detectDocumentLanguage, isSameLanguage } from './core/languageDetector';
import { getTranslation, getDefaultTargetLanguageName, getLocalizedLanguageName, normalizeLanguageCode } from './i18n';
import { migrateDeviceProfiles, migrateLegacySettingsToProviders, getEffectiveProviderForDevice } from './utils/deviceKeyManager';

/**
 * Assistant Emily - 옵시디언 마크다운 지능형 교열 및 번역 전문 플러그인 메인 클래스
 */
export default class EmilyPlugin extends Plugin {
  /** 전역 플러그인 설정 인스턴스 */
  settings: EmilySettings;
  /** 가장 최근에 활성화되었던 마크다운 에디터 뷰 캐시 (사이드바 포커스 이동 시 타깃 유지용) */
  lastActiveMarkdownView: MarkdownView | null = null;
  /** OpenAI 호환 API 통신 클라이언트 */
  private llmClient: LLMProxyClient;
  /** 마크다운 맞춤법/문법 교열 및 이슈 파싱 엔진 */
  private proofreadingEngine: ProofreadingEngine;
  /** 대용량 청킹 및 1:1 대조 번역 엔진 */
  private translationEngine: TranslationEngine;
  /** 사이드바 및 단축키 실행 전체 작업 세션 히스토리 캐시 */
  private sessionHistory: RollingSessionData[] = [];
  private sessionCounter: number = 0;

  public getSessionHistory(): RollingSessionData[] {
    return this.sessionHistory;
  }

  public clearSessionHistory(): void {
    this.sessionHistory = [];
  }

  public getNextSessionId(): number {
    return ++this.sessionCounter;
  }

  public recordSessionFromSidebar(sessionData: RollingSessionData): void {
    if (!this.sessionHistory.some((s) => s.id === sessionData.id)) {
      this.sessionHistory.push(sessionData);
    }
    this.sessionCounter = Math.max(this.sessionCounter, sessionData.id);
  }

  public recordExternalSession(sessionData: RollingSessionData): void {
    if (!this.sessionHistory.some((s) => s.id === sessionData.id)) {
      this.sessionHistory.push(sessionData);
    }
    this.sessionCounter = Math.max(this.sessionCounter, sessionData.id);

    const leaves = this.app.workspace.getLeavesOfType(EMILY_VIEW_TYPE);
    for (const leaf of leaves) {
      if (leaf.view instanceof EmilySidebarView) {
        leaf.view.recordCompletedSession(sessionData);
      }
    }
  }

  /**
   * 옵시디언 플러그인 로드 시 호출되는 라이프사이클 메서드
   * - 설정 로드 및 서비스 인스턴스 초기화
   * - 사이드바 뷰, 리본 아이콘, 전역 명령어, 설정 탭 등록
   * - 에디터 및 레이아웃 상태 변경 이벤트 리스너 등록
   */
  async onload() {
    // 1. 환경 설정 로드 (신규 설치 시 data.json 자동 생성 보장)
    await this.loadSettings();

    const t = getTranslation(this.settings.language);

    // 2. 코어 서비스 인스턴스 초기화
    this.initServices();

    // 3. 전용 사이드바 뷰 등록
    this.registerView(
      EMILY_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new EmilySidebarView(leaf, this)
    );

    // 4. 리본 아이콘 등록 (클릭 시 사이드바 즉시 열기)
    this.addRibbonIcon(EMILY_ICON_NAME, t.commands.ribbonTooltip, () => {
      void this.activateView();
    });

    // 5. 옵시디언 커맨드 팔레트 명령어 등록
    this.addCommand({
      id: 'open-emily-sidebar',
      name: t.commands.openSidebar,
      callback: () => {
        void this.activateView();
      }
    });

    this.addCommand({
      id: 'emily-quick-proofread',
      name: t.commands.quickProofread,
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking) {
            void this.activateView();
          }
          return true;
        }
        return false;
      }
    });

    // DeepL 스타일 빠른 선택 영역 번역 후 바로 아래에 덧붙이기 단축키 커맨드
    this.addCommand({
      id: 'emily-quick-translate-selection-append',
      name: t.commands.quickTranslateSelectionAppend,
      icon: 'languages',
      hotkeys: [
        {
          modifiers: ['Mod', 'Alt'],
          key: 'T'
        }
      ],
      editorCallback: (editor: Editor, view: MarkdownView) => {
        void this.handleQuickTranslateSelectionAppend(editor, view);
      }
    });

    // 6. 옵시디언 환경 설정 탭 등록
    this.addSettingTab(new EmilySettingTab(this.app, this));

    // 7. 레이아웃 준비 완료 시 현재 활성 에디터 동기화
    this.app.workspace.onLayoutReady(() => {
      const current = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (current) this.lastActiveMarkdownView = current;
      this.notifySidebarViewsDocChange();
    });

    // 8. 활성 탭 전환 시 작업 대상 문서 갱신
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (leaf?.view instanceof MarkdownView && leaf.view.file) {
          this.lastActiveMarkdownView = leaf.view;
        }
        this.notifySidebarViewsDocChange();
      })
    );

    // 9. 파일 열기 시 작업 대상 문서 갱신
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file) {
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (view && view.file) {
            this.lastActiveMarkdownView = view;
          }
        }
        this.notifySidebarViewsDocChange();
      })
    );

    // 10. 에디터 내용 변경 시 실시간 반영
    this.registerEvent(
      this.app.workspace.on('editor-change', (_editor, view) => {
        if (view instanceof MarkdownView && view.file) {
          this.lastActiveMarkdownView = view;
          this.notifySidebarViewsDocChange();
        }
      })
    );

    // 11. 레이아웃 변경 시 사이드바 상태 알림
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.notifySidebarViewsDocChange();
      })
    );

    // 12. 에디터 우클릭 컨텍스트 메뉴 등록 (선택 영역 번역 - 옵시디언 표준)
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor, view) => {
        if (!(view instanceof MarkdownView) || !view.file) return;
        const selection = editor.getSelection();
        if (!selection || selection.trim().length === 0) return;

        menu.addItem((item) => {
          item
            .setTitle(`Assistant Emily: ${t.commands.quickTranslateSelectionAppend}`)
            .setIcon('languages')
            .onClick(() => {
              void this.handleQuickTranslateSelectionAppend(editor, view);
            });
        });
      })
    );
  }

  /**
   * 활성화된 모든 에밀리 사이드바 뷰에 타깃 문서 변경 사항을 통보합니다.
   */
  notifySidebarViewsDocChange() {
    const leaves = this.app.workspace.getLeavesOfType(EMILY_VIEW_TYPE);
    for (const leaf of leaves) {
      if (leaf.view instanceof EmilySidebarView) {
        leaf.view.updateTargetDocument();
      }
    }
  }

  /**
   * 설정 변경 시 사이드바 내부의 플로팅 스크롤 버튼 표시 여부를 즉각 반영합니다.
   */
  refreshFloatingControls() {
    const leaves = this.app.workspace.getLeavesOfType(EMILY_VIEW_TYPE);
    for (const leaf of leaves) {
      if (leaf.view instanceof EmilySidebarView) {
        leaf.view.updateNavigatorVisibility();
      }
    }
  }

  /**
   * 설정 탭에서 변경된 기본 옵션(문체, 스타일, 주석 번역 등)을 열려있는 사이드바 폼과 동기화합니다.
   */
  syncSidebarSettings() {
    const leaves = this.app.workspace.getLeavesOfType(EMILY_VIEW_TYPE);
    for (const leaf of leaves) {
      if (leaf.view instanceof EmilySidebarView) {
        leaf.view.syncWithOptionsFromSettings();
      }
    }
  }

  /**
   * 플러그인 언로드 시 리소스 해제
   */
  onunload() {
  }

  /**
   * 코어 백엔드 서비스(LLM 클라이언트, 교열 엔진, 번역 엔진, 일관성 엔진)를 초기화합니다.
   */
  public initServices() {
    const activeProv = getEffectiveProviderForDevice(this.settings);
    const effectiveUrl = activeProv?.baseUrl || this.settings.apiBaseUrl;
    const effectiveKey = activeProv?.apiKey || this.settings.apiKey;
    const effectiveModel = activeProv?.models?.[0]?.id || this.settings.modelName;

    this.llmClient = new LLMProxyClient(
      effectiveUrl,
      effectiveKey,
      effectiveModel
    );
    this.llmClient.updateMultiConfig(this.settings);
    this.proofreadingEngine = new ProofreadingEngine(this.llmClient, this.settings.language);
    this.translationEngine = new TranslationEngine(this.llmClient, this.app, this.settings.language);
  }

  /**
   * 플러그인 환경 설정을 파일(data.json)로부터 불러옵니다.
   * - 파일이 존재하지 않는 신규 설치 환경에서는 DEFAULT_SETTINGS로 초기화 후 data.json을 즉시 생성합니다.
   * - 파일 손상이나 예외 발생 시 안전하게 기본값을 적용하여 플러그인 충돌을 방지합니다.
   */
  async loadSettings() {
    try {
      const loadedData = (await this.loadData()) as Partial<EmilySettings> | null;
      if (!loadedData) {
        // 최초 설치 시 data.json 안전 생성
        this.settings = Object.assign({}, DEFAULT_SETTINGS);
        await this.saveData(this.settings);
      } else {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
      }

      // 하위 호환성 보정 (구버전 '언어 감지' 텍스트를 표준 코드 'auto'로 정규화)
      if (this.settings.defaultTranslationSource === '언어 감지') {
        this.settings.defaultTranslationSource = 'auto';
      }

      // 기기 프로필 레거시(provider1Url/Key) 자동 1회성 마이그레이션
      if (migrateDeviceProfiles(this.settings)) {
        await this.saveData(this.settings);
      }

      // YOLO 스타일 프로바이더 및 기기 독립 매핑 자동 마이그레이션
      if (migrateLegacySettingsToProviders(this.settings)) {
        await this.saveData(this.settings);
      }
    } catch (err) {
      console.error('[Assistant Emily] 설정 파일 로드 실패 (기본값 적용):', err);
      this.settings = Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  /**
   * 현재 플러그인 환경 설정을 파일(data.json)에 영구 저장하고 하위 엔진들에 변경사항을 즉시 전파합니다.
   * - LLM 클라이언트(엔드포인트, API Key, 모델명) 실시간 갱신
   * - 교열 엔진 및 번역 엔진의 표시 언어 동기화
   * - 저장 실패 시 콘솔 에러 및 사용자 알림 토스트 출력
   */
  async saveSettings() {
    try {
      await this.saveData(this.settings);
      if (this.llmClient) {
        this.llmClient.updateMultiConfig(this.settings);
      }
      if (this.proofreadingEngine) {
        this.proofreadingEngine.setDisplayLanguage(this.settings.language);
      }
      if (this.translationEngine) {
        this.translationEngine.setDisplayLanguage(this.settings.language);
      }
    } catch (err) {
      console.error('[Assistant Emily] 설정 저장 실패:', err);
      new Notice('Assistant Emily: 설정 저장 중 오류가 발생했습니다. (Failed to save settings)');
    }
  }

  /**
   * DeepL 스타일 빠른 선택 영역 번역 후 바로 아래에 덧붙이기 핸들러
   * - 에디터에서 선택된 텍스트를 감지하여 번역 후 원문 바로 아래에 빈 줄 하나를 두고 덧붙입니다.
   * - 기본 단축키: Ctrl+Alt+T (Mac: Cmd+Option+T)
   */
  public async handleQuickTranslateSelectionAppend(
    editor: Editor,
    view: MarkdownView
  ): Promise<void> {
    const t = getTranslation(this.settings.language);
    const selectedText = editor.getSelection();

    if (!selectedText || selectedText.trim().length === 0) {
      new Notice(t.commands.quickTranslateNoSelection);
      return;
    }

    if (!view.file) {
      new Notice('활성 마크다운 파일이 없습니다.');
      return;
    }

    // API 프로바이더 및 엔드포인트 유효성 검사
    const activeProv = getEffectiveProviderForDevice(this.settings);
    const baseUrl = (activeProv?.baseUrl || this.settings.apiBaseUrl || '').trim();
    const apiKey = (activeProv?.apiKey || this.settings.apiKey || '').trim();
    if (!baseUrl && !apiKey) {
      new Notice('Assistant Emily: AI 프로바이더 또는 API 설정이 구성되지 않았습니다.');
      return;
    }

    const targetLangName = this.settings.defaultTranslationTarget || getDefaultTargetLanguageName(t);
    const targetLang = getLocalizedLanguageName(targetLangName, t);
    const rawSrc = this.settings.defaultTranslationSource || 'auto';
    const isAutoSrc = !rawSrc || normalizeLanguageCode(rawSrc) === 'auto';
    const sourceLang = getLocalizedLanguageName(rawSrc, t) || t.languages.auto;

    const detected = detectDocumentLanguage(selectedText, this.settings.language);
    const effectiveSrc = isAutoSrc ? detected.name : sourceLang;
    const isSameLangEdit = isSameLanguage(effectiveSrc, targetLang);

    const options: TranslationOptions = {
      enabled: true,
      sourceLanguage: effectiveSrc,
      targetLanguage: targetLangName,
      scope: 'selection',
      preservation: 'append',
      isSameLangEdit,
      tone: this.settings.defaultTranslationTone || 'academic',
      style: this.settings.defaultTranslationStyle || 'balanced',
      translateCodeComments: Boolean(this.settings.defaultTranslateCodeComments)
    };

    // 1. 선택 영역 바로 아래에 인라인 상태 블록 삽입 (에디터 내 실시간 시각적 상태 피드백)
    const cleanSelected = selectedText.trimEnd();
    const statusTemplate = t.commands.quickTranslateInlineStatus || '⏳ **[Assistant Emily] {lang} 번역 진행 중...** ';
    const inlineStatusText = statusTemplate.replace('{lang}', targetLang);
    const placeholderToken = `<!-- emily-translating-${Date.now()} -->`;
    const placeholderBlock = `\n\n> ${inlineStatusText}\n${placeholderToken}`;

    // 에디터의 현재 선택 영역을 [원문 + 인라인 상태 안내]로 즉각 치환
    editor.replaceSelection(`${cleanSelected}${placeholderBlock}`);

    // 상단 플로팅 Notice 알림도 함께 제공
    const notice = new Notice(`${t.commands.quickTranslateTranslating} (${targetLang})`, 0);

    // 사이드바가 닫혀있다면 사이드바를 백그라운드 활성화하고 에디터 포커스 유지
    void this.activateView().then(() => {
      editor.focus();
    });

    try {
      this.llmClient.updateMultiConfig(this.settings);
      const res = await this.translationEngine.runTranslation(
        view.file,
        selectedText,
        options
      );

      notice.hide();

      const cleanTranslated = res.result.translatedMarkdown.trim();

      // 2. 인라인 상태 블록을 완료된 번역문으로 정밀 교체
      const currentDoc = editor.getValue();
      const tokenIndex = currentDoc.indexOf(placeholderToken);
      if (tokenIndex !== -1) {
        const blockStartIndex = currentDoc.lastIndexOf('\n\n> ', tokenIndex);
        const startOffset = blockStartIndex !== -1 ? blockStartIndex : tokenIndex;
        const endOffset = tokenIndex + placeholderToken.length;
        const fromPos = editor.offsetToPos(startOffset);
        const toPos = editor.offsetToPos(endOffset);
        editor.replaceRange(`\n\n${cleanTranslated}`, fromPos, toPos);
      } else {
        editor.replaceSelection(`\n\n${cleanTranslated}`);
      }

      // 3. 우측 사이드바 Rolling History 세션 카드 생성 및 동기화 (작업 이력 보존 & 대조 검토 지원)
      const recordedTransOptions: TranslationOptions = {
        ...options,
        sourceLanguage: isAutoSrc
          ? `${t.sidebar.autoDetectLabel} (${effectiveSrc})`
          : sourceLang
      };

      const sessionData: RollingSessionData = {
        id: this.getNextSessionId(),
        timestamp: getISODateTimeString(),
        fileName: view.file.name,
        filePath: view.file.path,
        sessionType: 'translation',
        proofreadScope: 'selection',
        status: 'completed',
        isSameLangEdit,
        promptText: '',
        model: res.model,
        totalTimeMs: res.totalTimeMs,
        tokensPerSec: res.tokensPerSec,
        usage: res.usage,
        responseId: res.id,
        finishReason: res.finish_reason,
        systemFingerprint: res.system_fingerprint,
        createdTimestamp: res.created,
        providerUsed: res.providerUsed,
        failedOver: res.failedOver,
        itemsCount: 0,
        items: [],
        originalMarkdown: cleanSelected,
        translatedMarkdown: cleanTranslated,
        proofreadOptions: {
          checkSpelling: false,
          checkGrammar: false,
          removeTimestamps: false,
          improveExpression: false,
          checkConsistency: false,
          searchCitation: false,
          scope: 'selection'
        },
        translationOptions: recordedTransOptions
      };

      this.recordExternalSession(sessionData);

      new Notice(`${t.commands.quickTranslateDone} (${(res.totalTimeMs / 1000).toFixed(1)}s)`);
    } catch (err: unknown) {
      notice.hide();
      console.error('[Assistant Emily] Quick selection translation failed:', err);
      const errMsg = err instanceof Error ? err.message : String(err);

      // 번역 실패 시 에디터 인라인 블록에 에러 상태 표시
      const currentDoc = editor.getValue();
      const tokenIndex = currentDoc.indexOf(placeholderToken);
      if (tokenIndex !== -1) {
        const blockStartIndex = currentDoc.lastIndexOf('\n\n> ', tokenIndex);
        const startOffset = blockStartIndex !== -1 ? blockStartIndex : tokenIndex;
        const endOffset = tokenIndex + placeholderToken.length;
        const fromPos = editor.offsetToPos(startOffset);
        const toPos = editor.offsetToPos(endOffset);
        const errorTemplate = t.commands.quickTranslateInlineError || '❌ **[Assistant Emily] 번역 실패: {error}** ';
        const inlineErrorText = errorTemplate.replace('{error}', errMsg);
        editor.replaceRange(`\n\n> ${inlineErrorText}`, fromPos, toPos);
      }

      new Notice(`❌ 번역 실패: ${errMsg}`);
    }
  }

  /** LLM 클라이언트 인스턴스 반환 */
  getLLMClient(): LLMProxyClient {
    return this.llmClient;
  }

  /** 마크다운 교열 엔진 인스턴스 반환 */
  getProofreadingEngine(): ProofreadingEngine {
    return this.proofreadingEngine;
  }

  /** 마크다운 번역 엔진 인스턴스 반환 */
  getTranslationEngine(): TranslationEngine {
    return this.translationEngine;
  }

  /**
   * 우측 사이드바 리프에 에밀리 전용 뷰를 표시하거나 포커스합니다.
   */
  async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(EMILY_VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: EMILY_VIEW_TYPE, active: true });
      }
    }

    if (leaf) {
      void workspace.revealLeaf(leaf);
    }
  }

  /**
   * 현재 작업 대상이 될 최적의 마크다운 에디터 뷰(MarkdownView)를 탐색합니다.
   * 1. 현재 커서가 위치한 활성 뷰
   * 2. 직전에 포커스되었던 뷰 캐시
   * 3. 열려있는 마크다운 뷰 중 첫 번째 뷰
   * @returns 대상 MarkdownView 또는 null
   */
  getTargetMarkdownView(): MarkdownView | null {
    // 1. 현재 포커스된 마크다운 뷰 (커서가 위치한 뷰)
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && activeView.file) {
      this.lastActiveMarkdownView = activeView;
      return activeView;
    }

    // 2. 가장 최근에 사용자가 작업/커서를 둔 마크다운 뷰
    if (this.lastActiveMarkdownView && this.lastActiveMarkdownView.file && this.lastActiveMarkdownView.containerEl.isConnected) {
      return this.lastActiveMarkdownView;
    }

    // 3. 다중 Pane 환경에서 열려있는 모든 Leaf 중 첫 번째 마크다운 뷰
    const leaves = this.app.workspace.getLeavesOfType('markdown');
    for (const leaf of leaves) {
      if (leaf.view instanceof MarkdownView && leaf.view.file) {
        this.lastActiveMarkdownView = leaf.view;
        return leaf.view;
      }
    }

    return null;
  }
}
