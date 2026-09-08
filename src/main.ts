import { Plugin, WorkspaceLeaf, MarkdownView, Notice } from 'obsidian';
import { EmilySettings, DEFAULT_SETTINGS } from './types/settings';
import { EMILY_VIEW_TYPE, EMILY_ICON_NAME } from './constants';
import { EmilySettingTab } from './views/settingsTab';
import { EmilySidebarView } from './views/sidebarView';
import { LLMProxyClient } from './api/llmClient';
import { ProofreadingEngine } from './core/proofreadingEngine';
import { TranslationEngine } from './core/translationEngine';
import { ConsistencyEngine } from './core/consistencyEngine';
import { getTranslation } from './i18n';

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
  /** 볼트 내부 문서 간 상호 일관성 검증 엔진 */
  private consistencyEngine: ConsistencyEngine;

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
  private initServices() {
    this.llmClient = new LLMProxyClient(
      this.settings.apiBaseUrl,
      this.settings.apiKey,
      this.settings.modelName
    );
    this.proofreadingEngine = new ProofreadingEngine(this.llmClient, this.settings.language);
    this.translationEngine = new TranslationEngine(this.llmClient, this.app, this.settings.language);
    this.consistencyEngine = new ConsistencyEngine(this.llmClient, this.app);
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
        this.llmClient.updateConfig(
          this.settings.apiBaseUrl,
          this.settings.apiKey,
          this.settings.modelName
        );
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

  /** 볼트 일관성 검증 엔진 인스턴스 반환 */
  getConsistencyEngine(): ConsistencyEngine {
    return this.consistencyEngine;
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
