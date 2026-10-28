---
created: 2026-10-25
last_updated: 2026-10-25
tags:
  - assistant-emily
  - freellmapi
  - llm-proxy
  - architecture
  - self-hosting
  - tutorial
aliases:
  - FreeLLMAPI Integration Technical Guide
  - FreeLLMAPI 연동 기술 가이드
type: technical-report
sources:
  - https://github.com/tashfeenahmed/freellmapi
  - https://freellmapi.co
---

# FreeLLMAPI Integration & Core Architecture Technical Guide

> 🧭 **위키 내비게이션**: [🏠 위키 홈](README.md) · [제1편: 빠른 시작](01-quick-start.md) · [제2편: 연동 설정](02-ai-providers-setup.md) · [제3편: 번역 & 단축키](03-translation-and-hotkeys.md) · [제4편: AI 교열 & 대조](04-proofreading-and-diff-review.md) · [제5편: 유튜브 자막](05-video-clipping-and-transcripts.md) · [제6편: 문법 보호](06-syntax-masking-and-safety.md) · [제7편: FAQ & 해결](07-troubleshooting.md) | [FreeLLMAPI 가이드](freellmapi-technical-guide.md) · [문법 마스킹 가이드](markdown-syntax-masking-pipeline-technical-guide.md)

### 무료 다중 LLM 프로바이더 집약 프록시 연동 및 엔지니어링 가이드

본 문서는 **Assistant Emily** 플러그인 사용자가 로컬 VRAM 제약이나 GPU 인프라의 한계를 극복하고, 34개 이상의 무료 LLM 프로바이더 자원을 무제한에 가깝게 단일 OpenAI 호환 엔드포인트로 통합 집약하는 **FreeLLMAPI** 프록시의 아키텍처와 단계별 셀프 호스팅 및 실전 연동 절차를 다룹니다.

---

## 1. 개요 및 기술 선정 배경 (Overview & Architectural Rationale)

### 1.1 로컬 LLM 환경의 이상과 현실적 한계
옵시디언과 같은 개인 지식 관리(PKM) 환경에서 가장 이상적인 AI 파트너십은 **Ollama** 나 **LM Studio** 를 이용한 완전한 온디바이스(On-device) 로컬 LLM 구동입니다. 데이터가 로컬 머신을 벗어나지 않으므로 프라이버시가 완벽하게 보장되기 때문입니다.

그러나 실무 환경에서는 다음과 같은 공학적 한계에 직면합니다:
1. **하드웨어 가속 한계**: 14B~70B 수준의 파라미터를 가진 고성능 모델을 원활하게 실행하려면 최소 16GB~24GB 이상의 전용 VRAM(NVIDIA RTX 4080/4090 이상 또는 Apple Silicon Unified Memory 36GB 이상)이 요구됩니다.
2. **긴 텍스트(Long-Context) 및 대용량 청킹 시 연산 지연**: 유튜브 영상 전체 스크립트(##Transcript)나 수십 페이지에 달하는 논문, 웹 클리핑 기사를 번역 및 교열할 때, 로컬 추론 속도가 급격히 저하되거나 OOM(Out Of Memory) 장애가 발생합니다.
3. **단일 상용 API 의존 시 비용 및 쿼터 제한**: OpenAI(GPT-4o)나 Anthropic(Claude 3.5 Sonnet) 유료 API를 직접 연결할 경우, 대량의 지식 노트를 처리할 때 API 과금 부담이 급증하며 단일 프로바이더의 레이트 리밋(Rate Limit)에 즉시 도달합니다.

### 1.2 왜 수많은 LLM 프록시 중 FreeLLMAPI인가?
오픈소스 생태계에는 다양한 LLM 게이트웨이(LiteLLM, One-API, Portkey 등)가 존재하지만, **Assistant Emily** 팀이 공식 권장 및 1순위 프록시 솔루션으로 **FreeLLMAPI** 를 선정한 이유는 명확합니다:

* **방대한 무료 자원의 극대화**: 전 세계 34개 AI 연구소 및 클라우드 기업(Google Gemini, Groq, Cerebras, Mistral, OpenRouter, Cloudflare, Cohere, Zhipu 등)이 제공하는 무료 티어를 하나로 결합하여 **월간 약 74억 토큰(7.4 Billion Tokens/month)**, **635개 이상의 무료 엔드포인트** 를 단 하나의 엔드포인트로 노출합니다.
* **OpenAI 완벽 호환 인터페이스**: 표준 `/v1/chat/completions`, `/v1/models` 규격을 준수하므로, Assistant Emily의 기존 커스텀 OpenAI 드라이버를 단 1줄의 코드 변경 없이 그대로 연결할 수 있습니다.
* **지능형 다중 장애 극복 (Smart Failover & Cooldown)**: 특정 프로바이더가 429(Too Many Requests) 또는 5xx 서버 에러를 반환하면, 사용자의 개입 없이 즉시 다음 우선순위 모델로 요청을 투명하게 재라우팅합니다.
* **로컬 우선 보안 아키텍처**: 모든 프로바이더 API 키는 로컬 SQLite 데이터베이스에 **AES-256-GCM** 으로 암호화되어 보관되며, 클라이언트 앱에는 오직 하나의 내부 통합 토큰(`freellmapi-...`)만 발급됩니다.
* **경량성 및 플랫폼 독립성**: Node.js 20+ 기반으로 유휴 메모리 사용량이 약 40MB에 불과하며, Windows 데스크톱 무설치 트레이 앱, Docker Compose, Linux 데몬 등 어떤 환경에서도 단 1분 만에 배포할 수 있습니다.

---

## 2. FreeLLMAPI 코어 아키텍처 (Core Architecture Specs)

FreeLLMAPI는 클라이언트와 외부 상용 LLM 무료 티어 프로바이더 사이에 위치하는 고성능 리버스 프록시 라우터입니다.

```mermaid
flowchart TD
    subgraph ObsidianClient ["옵시디언 클라이언트 (Obsidian Desktop)"]
        AE["Assistant Emily 플러그인"]
        Masker["무손실 문법 마스킹 엔진 (MarkdownMasker)"]
        Chunker["스마트 텍스트 청커 (Token/Regex Chunker)"]
        AE --> Masker
        Masker --> Chunker
    end

    subgraph FreeLLMAPIProxy ["FreeLLMAPI 프록시 서버 (Port: 3001)"]
        Endpoint["/v1/chat/completions"]
        AuthShield["AES-256-GCM 인증 검증기 (Unified Key)"]
        SmartRouter["지능형 라우터 (auto / auto:smart / auto:fast)"]
        RateTracker["RPM / RPD / TPM 쿼터 추적기"]
        FailoverEngine["자동 페일오버 및 쿨다운 관리자"]

        Endpoint --> AuthShield
        AuthShield --> SmartRouter
        SmartRouter --> RateTracker
        RateTracker --> SmartRouter
        SmartRouter --> FailoverEngine
    end

    subgraph ProvidersFleet ["34개 무료 LLM 프로바이더 풀 (~7.4B Tokens/Month)"]
        P_Google["Google Gemini (2.5 Flash / Pro)"]
        P_Groq["Groq (Llama 3.3 70B / Mixtral)"]
        P_Cerebras["Cerebras (Llama 3.1 8B/70B 초고속)"]
        P_Mistral["Mistral AI (Mistral Large / Codestral)"]
        P_OpenRouter["OpenRouter Free Tier"]
        P_Others["Cloudflare, Cohere, Zhipu, NVIDIA 외 26개사"]
    end

    Chunker -- "HTTP POST (Unified Bearer Token)" --> Endpoint
    FailoverEngine -- "(1) 1차 시도" --> P_Groq
    FailoverEngine -- "(2) 429 감지 시 즉각 우회" --> P_Google
    FailoverEngine -- "(3) 폴백 체인" --> P_Cerebras
    FailoverEngine -- "(4) 폴백 체인" --> P_Mistral
```

### 2.1 라우팅 전략 (Routing Strategies)
FreeLLMAPI는 모델 요청 파라미터(`model`)에 접미사를 붙여 라우팅 알고리즘을 실시간으로 지정할 수 있습니다:

| 라우팅 전략 | 동작 특성 및 추천 활용 시나리오 |
| :--- | :--- |
| `auto` | 사용자가 대시보드의 **Fallback Chain** 에 지정한 순서대로 순차 호출하며 장애 발생 시 다음 모델로 전환합니다. |
| `auto:smart` | 프로바이더 전체 풀 중 실시간 지능 지수(MMLU/코드 벤치마크)가 가장 높은 상위 모델을 선별하여 호출합니다. (복잡한 번역 및 심층 교열에 최적) |
| `auto:fast` | TTFT(첫 토큰 도달 시간) 및 토큰 처리 속도가 가장 빠른 초고속 추론 엔진(Groq, Cerebras 등)을 우선 호출합니다. (실시간 에디터 교열에 최적) |
| `auto:reliable` | 최근 24시간 동안 HTTP 200 성공률이 가장 높은 안정적인 프로바이더를 우선 호출합니다. |
| `auto:balanced` | 신뢰도, 속도, 모델 성능을 균형 있게 고려하는 표준 기본 알고리즘입니다. |
| `auto:<profile>` | 대시보드에서 생성한 커스텀 체인 프로필(예: `auto:coding`, `auto:korean`)을 호출합니다. |

---

## 3. 단계별 설치 및 셀프 호스팅 가이드 (Step-by-Step Deployment)

사용자의 운영 환경에 맞추어 다음 4가지 방법 중 가장 편리한 방식을 선택하여 배포할 수 있습니다.

### 방법 1: Docker Compose 기반 배포 (권장, 안정적인 상시 구동)

가장 권장되는 표준 배포 방식으로, 데이터베이스 볼륨이 안전하게 격리 보관됩니다.

#### [Windows PowerShell 배포 절차]
```powershell
# 1. 저장소 클론 및 이동
git clone https://github.com/tashfeenahmed/freellmapi.git
cd freellmapi

# 2. 32바이트 보안 암호화 키 생성 (AES-256-GCM용)
$Bytes = New-Object Byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($Bytes)
$ENCRYPTION_KEY = -join ($Bytes | ForEach-Object { "{0:x2}" -f $_ })

# 3. .env 환경 설정 파일 생성 (기본 포트 3001)
"ENCRYPTION_KEY=$ENCRYPTION_KEY`nPORT=3001" | Out-File -Encoding utf8 .env

# 4. 백그라운드 컨테이너 빌드 및 실행
docker compose up -d
```

#### [Linux / macOS Bash 배포 절차]
```bash
# 1. 저장소 클론 및 이동
git clone https://github.com/tashfeenahmed/freellmapi.git
cd freellmapi

# 2. OpenSSL을 활용한 64자리 Hex 암호화 키 생성 및 .env 저장
ENCRYPTION_KEY="$(openssl rand -hex 32)"
printf "ENCRYPTION_KEY=%s\nPORT=3001\n" "$ENCRYPTION_KEY" > .env

# 3. 컨테이너 백그라운드 구동
docker compose up -d
```

> [!TIP]
> **로컬 네트워크(LAN) 타 기기(태블릿, 모바일 등)에서 공유 접속하려는 경우:**  
> 기본 설정은 로컬 루프백(`127.0.0.1`)에만 바인딩됩니다. 가정 내 홈랩 서버나 라즈베리파이에서 구동하여 동일 Wi-Fi 대역의 다른 기기에서도 접근하려면 환경변수에 `HOST_BIND=0.0.0.0` 을 추가하여 구동하십시오:  
> `HOST_BIND=0.0.0.0 docker compose up -d`

---

### 방법 2: Docker 원라이너 자동 스크립트 배포

복잡한 설정 없이 단 한 줄의 명령어로 홈 디렉터리에 설치하고 실행합니다:

```bash
curl -fsSL https://freellmapi.co/install.sh | bash
```

* 스크립트가 자동으로 암호화 키 생성, 최신 컨테이너 이미지 풀, 자동 재시작 설정을 완료합니다.
* 기존 설치 상태에서 재실행해도 `.env` 암호화 키가 안전하게 보존되면서 최신 버전으로 업데이트됩니다.

---

### 방법 3: Windows 데스크톱 인스톨러 앱 활용 (가장 간편한 GUI 방식)

Docker 설치가 부담스럽거나 Windows 환경에서 가장 간단하게 실행하고 싶은 사용자를 위한 전용 데스크톱 앱입니다.

1. **[FreeLLMAPI GitHub 공식 릴리즈](https://github.com/tashfeenahmed/freellmapi/releases/latest)** 페이지에 접속합니다.
2. Windows용 인스톨러 파일(`FreeLLMAPI-Setup-x.x.x.exe`)을 다운로드하여 실행합니다.
3. 설치 완료 후 Windows 작업 표시줄 트레이(System Tray)에 FreeLLMAPI 아이콘이 상주합니다.
4. 트레이 아이콘을 클릭하면 미려한 글래스 팝오버 창이 나타나며, 현재 서비스 상태 확인 및 **통합 API 키(Unified API Key)** 복사가 즉시 가능합니다.

---

### 방법 4: Node.js 20+ 로컬 빌드 및 PM2 데몬 구동

개발자 또는 초경량 환경을 선호하는 경우 Node.js 환경에서 직접 구동할 수 있습니다:

```bash
# Node.js 20 이상 필요
git clone https://github.com/tashfeenahmed/freellmapi.git
cd freellmapi
npm install

# 암호화 키 생성 및 환경 파일 작성
ENCRYPTION_KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
printf "ENCRYPTION_KEY=%s\nPORT=3001\n" "$ENCRYPTION_KEY" > .env

# 프로덕션 빌드 및 PM2 데몬 실행
npm run build
npm install -g pm2
pm2 start dist/server/index.js --name freellmapi
pm2 save
```

---

## 4. 대시보드 설정 및 통합 API 키 발급 (Dashboard Setup)

배포가 완료되면 웹 브라우저를 열고 `http://localhost:3001` 에 접속합니다.

### 4.1 한국어 UI 전환
FreeLLMAPI 대시보드는 전 세계 60개 언어를 기본 지원합니다. 첫 접속 시 브라우저 언어를 자동 감지하며, 우측 상단 메뉴(⋯) ➔ **Settings** ➔ **Language** 에서 `한국어 (South Korea)` 를 선택하여 완전한 한국어 인터페이스로 전환할 수 있습니다.

### 4.2 무료 프로바이더 API 키 등록
좌측 네비게이션의 **키 관리(Keys)** 페이지로 이동하여 본인이 소유한 무료 API 키를 등록합니다. 키가 많을수록 풀이 확장되어 분당 요청 한도(RPM)를 완전히 무력화할 수 있습니다:

* **Google AI Studio**: Gemini 2.5 Flash / Gemini 1.5 Pro 무료 키 발급 ([aistudio.google.com](https://aistudio.google.com/))
* **Groq Cloud**: 초당 수백 토큰의 Llama 3.3 70B 무료 키 발급 ([console.groq.com](https://console.groq.com/))
* **Cerebras Cloud**: 고속 Llama 3.1 70B 추론 무료 키 발급 ([cloud.cerebras.ai](https://cloud.cerebras.ai/))
* **Mistral AI**: Codestral 및 Mistral Large 무료 키 발급 ([console.mistral.ai](https://console.mistral.ai/))
* **OpenRouter**: 다양한 오픈소스 모델 무료 엔드포인트 키 발급 ([openrouter.ai](https://openrouter.ai/))

> [!NOTE]
> 등록된 모든 외부 API 키는 서버 로컬의 SQLite에 **AES-256-GCM** 암호화되어 안전하게 기록되며, 외부 서버로 전송되지 않습니다.

### 4.3 통합 API 키(Unified API Key) 확인
**키 관리(Keys)** 페이지 상단 헤더에 표시된 `freellmapi-...` 형태의 마스터 키를 확인하고 **복사(Copy)** 버튼을 클릭합니다. 이 단 하나의 키가 Assistant Emily 플러그인과 통신하는 유일한 인증 수단이 됩니다.

---

## 5. Assistant Emily 플러그인과의 실전 연동 절차

이제 옵시디언의 **Assistant Emily** 플러그인에 방금 구축한 FreeLLMAPI 프록시를 연결합니다.

### 5.1 플러그인 설정 단계
1. 옵시디언 실행 ➔ 좌측 하단 **설정 (Settings, `Ctrl + ,`)** 아이콘 클릭.
2. 커뮤니티 플러그인 목록에서 **Assistant Emily** 설정 메뉴로 이동.
3. **AI 프로바이더 설정 (AI Provider Settings)** 섹션 탐색:
   * **API Provider**: `Custom OpenAI-compatible` (또는 `FreeLLMAPI`) 선택.
   * **API Base URL**: `http://localhost:3001/v1` 입력.
   * **API Key**: 대시보드에서 복사한 `freellmapi-...` 통합 키 입력.
   * **Model Name**: `auto` (또는 지능형 최상위 모델을 원할 경우 `auto:smart`, 고속 처리를 원할 경우 `auto:fast`).
4. **연결 테스트 (Test Connection)** 버튼 클릭:
   * 녹색 안내창과 함께 `"Connection successful! Available models verified."` 메시지가 출력되면 연동 완료.

```
+-----------------------------------------------------------------------+
|  Assistant Emily Settings                                             |
+-----------------------------------------------------------------------+
|  AI Provider:       [ Custom OpenAI-compatible                      v ]|
|  API Base URL:      [ http://localhost:3001/v1                       ]|
|  API Key:           [ freellmapi-9a8b7c6d5e4f3a2b1c... [Show]        ]|
|  Model Name:        [ auto                                           ]|
|                                                                       |
|  [ Test Connection ]  -->  [OK] Successfully connected via FreeLLMAPI |
+-----------------------------------------------------------------------+
```

### 5.2 대용량 유튜브 스크립트(##Transcript) 번역 및 교열 실증
유튜브 클리핑 노트의 대용량 텍스트 번역 시 Assistant Emily와 FreeLLMAPI의 결합 동작 방식:
1. 사용자가 `## Transcript` 블록을 지정하고 번역 명령 실행.
2. **Assistant Emily** 가 마크다운 문법(타임스탬프 `03:45`, 위키링크, 코드 블록)을 고유 UUID 토큰으로 무손실 마스킹.
3. 스마트 청커가 텍스트를 최적 토큰 크기로 분할하여 FreeLLMAPI의 `/v1/chat/completions` 로 동시 전송.
4. **FreeLLMAPI** 지능형 라우터가 등록된 34개 프로바이더 중 가장 여유롭고 빠른 모델(예: Groq 또는 Gemini 2.5 Flash)로 자동 분배.
5. 중간에 특정 프로바이더가 429 쿼터 초과를 일으켜도 즉각 다음 프로바이더(Cerebras 등)로 매끄럽게 페일오버.
6. 응답 텍스트를 수신한 Assistant Emily가 UUID 토큰을 본래 마크다운 구문으로 100% 무손실 복원하고 서식을 정규화.

---

## 6. 통신 검증 및 API 테스트 (Verification & Code Examples)

터미널이나 스크립트 환경에서 프록시 서버의 동작을 독립적으로 검증할 수 있습니다.

### 6.1 cURL 검증 요청
```bash
curl http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer freellmapi-your-unified-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [
      {"role": "system", "content": "You are Assistant Emily pairing engine."},
      {"role": "user", "content": "Respond with: FreeLLMAPI is online and operational."}
    ]
  }'
```

### 6.2 PowerShell 검증 요청
```powershell
$Headers = @{
    "Authorization" = "Bearer freellmapi-your-unified-key"
    "Content-Type"  = "application/json"
}
$Body = @{
    model = "auto:fast"
    messages = @(
        @{ role = "user"; content = "Hello FreeLLMAPI!" }
    )
} | ConvertTo-Json

$Response = Invoke-RestMethod -Uri "http://localhost:3001/v1/chat/completions" -Method Post -Headers $Headers -Body $Body
$Response.choices[0].message.content
```

### 6.3 응답 헤더 기반 실제 서빙 프로바이더 확인 (`X-Routed-Via`)
FreeLLMAPI는 모든 응답 헤더에 `X-Routed-Via` 값을 포함하여 실제 어떤 프로바이더와 모델이 요청을 처리했는지 투명하게 알려줍니다:
```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Routed-Via: groq/llama-3.3-70b-versatile
X-Fallback-Attempts: 0
X-Response-Time-Ms: 412
```

---

## 7. 운영 모범 사례 및 트러블슈팅 (Best Practices & Diagnostics)

### 7.1 주요 장애 상황 및 해결 지침

| 증상 / 오류 메시지 | 근본 원인 | 해결 절차 |
| :--- | :--- | :--- |
| `All providers exhausted (429)` | 등록된 프로바이더의 무료 일일/분당 쿼터가 일시 소진됨 | 대시보드에서 추가 프로바이더(Cerebras, Mistral, Google 등)의 무료 키를 2~3개 더 등록하여 풀을 확장하십시오. |
| `docker: connect ECONNREFUSED` | Docker 컨테이너가 정상 기동되지 않았거나 포트 충돌 | `docker compose ps` 명령어로 상태 확인 후, 이미 3001 포트를 사용하는 프로세스가 있다면 `.env` 에서 `PORT=3002` 로 변경하십시오. |
| `Invalid Bearer Token (401)` | Assistant Emily에 입력된 API 키가 마스터 키와 불일치 | 대시보드(http://localhost:3001)의 **Keys** 페이지 상단에서 `freellmapi-...` 키를 다시 복사하여 플러그인 설정에 붙여넣으십시오. |
| 호스트 로컬 VPN/프록시 환경에서 연결 실패 | Docker 컨테이너 격리로 호스트의 프록시를 찾지 못함 | `.env` 파일에 `PROXY_URL=socks5h://host.docker.internal:7890` 과 같이 호스트 게이트웨이 주소를 명시하십시오. |

### 7.2 안전한 데이터 백업
FreeLLMAPI의 모든 설정, 등록된 키, 통계 데이터는 SQLite 데이터베이스에 저장됩니다. 서버를 이전하거나 백업할 때는 다음 두 가지 요소를 반드시 함께 보관해야 합니다:
1. `.env` 파일에 저장된 `ENCRYPTION_KEY` (이 키가 없으면 저장된 API 키를 영구적으로 복호화할 수 없습니다.)
2. Docker 볼륨 또는 데이터 디렉터리 내의 `freellmapi.db` 파일.

---

## 8. 결론 (Conclusion)

**FreeLLMAPI** 는 로컬 VRAM의 물리적 한계로 고성능 대형 모델을 상시 구동하기 어려운 환경에서, 전 세계 무료 LLM 자원을 단 하나의 고신뢰성 엔드포인트로 묶어주는 가장 완벽한 대안 인프라입니다.

**Assistant Emily** 의 **무손실 마크다운 문법 마스킹 파이프라인(Syntax Masking Pipeline)** 과 **FreeLLMAPI** 의 **지능형 다중 프로바이더 자동 우회 라우팅** 을 결합함으로써, 사용자는 비용 걱정이나 레이트 리밋 중단 없이 옵시디언 노트의 대용량 번역, 교열, 서식 자가 치유를 최고 수준의 품질로 누릴 수 있습니다.

---

## 🧭 위키 내비게이션
| 이전 단계 | 현재 페이지 | 다음 단계 |
| :---: | :---: | :---: |
| [◀ 제7편: 장애 진단 & FAQ](07-troubleshooting.md) | **FreeLLMAPI 아키텍처 및 연동 가이드** | [OFM 무손실 문법 마스킹 가이드 ▶](markdown-syntax-masking-pipeline-technical-guide.md) |
