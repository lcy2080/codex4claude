# Claude Code Codex Harness

Claude Code TUI에서 Codex와 비슷한 작업 harness를 쓰기 위한 구성입니다. 목적은 Claude가 작업을 시작할 때 필요한 컨텍스트를 먼저 읽고, 작은 계획을 세우고, 범위를 좁혀 수정하고, 검증한 뒤, 완료 조건을 실제 증거로 감사하도록 만드는 것입니다.

이 저장소는 두 방식으로 사용할 수 있습니다.

1. 현재 프로젝트에 바로 적용되는 `.claude` 구성
2. 다른 프로젝트에 옮겨 로드할 수 있는 `codex-harness` 플러그인

## Quick Start

현재 저장소에서 바로 Claude Code를 실행하려면:

```bash
claude
```

Claude가 시작되면 output style을 선택합니다.

```text
/config
```

`Output style`에서 `Codex Harness`를 선택한 뒤 Claude Code를 재시작합니다. Output style은 세션 시작 시 적용됩니다.

플러그인으로 테스트하려면:

```bash
claude --plugin-dir ./plugins/codex-harness
```

시작 후 다음 명령으로 구성 요소가 보이는지 확인합니다.

```text
/reload-plugins
/help
/agents
```

## What This Harness Adds

이 harness는 Claude Code의 기본 기능 위에 다음 동작을 얹습니다.

- 작업 전 컨텍스트 triage
- 변경 전 계획과 가정 명시
- 작은 범위의 구현
- review와 verification 분리
- 완료 전 requirement-to-evidence 감사
- 복잡도에 따른 모델과 think level 선택
- 다른 프로젝트에 배포 가능한 plugin 패키징

## Daily Workflow

일반 작업은 다음 순서로 진행합니다.

1. 먼저 계획을 세웁니다.

```text
/plan add validation for invalid config files
```

2. 구현을 맡깁니다.

```text
/implement add validation for invalid config files
```

3. 변경을 리뷰합니다.

```text
/review recent changes
```

4. 완료 전 검증 감사를 실행합니다.

```text
/verify the config validation task
```

5. 작업을 넘겨야 하면 handoff를 남깁니다.

```text
/handoff current validation work
```

## Slash Commands

- `/plan <task>`: 작업 범위, 가정, 변경 후보, 검증 방법을 정리합니다. `opus`와 `xhigh` effort를 사용합니다.
- `/implement <task>`: 파일을 읽고 좁은 범위로 수정한 뒤 검증합니다. `sonnet`과 `medium` effort를 사용합니다.
- `/review <scope>`: 버그, 회귀, 보안 이슈, 누락된 테스트를 findings-first 형식으로 찾습니다. `opus`와 `high` effort를 사용합니다.
- `/verify <scope>`: 명시 요구사항을 실제 파일, 명령 출력, 테스트 결과에 매핑합니다. `opus`와 `xhigh` effort를 사용합니다.
- `/handoff <scope>`: 다음 세션이 이어받을 수 있는 간단한 상태 문서를 만듭니다. `haiku`와 `low` effort를 사용합니다.

플러그인으로 로드한 skills는 namespace가 붙습니다. 예를 들어 completion audit skill은 다음처럼 호출합니다.

```text
/codex-harness:completion-audit
```

## Agents

Claude Code의 `/agents` 화면에서 다음 subagent를 확인할 수 있습니다.

- `context-explorer`: 특정 코드베이스 질문에 답합니다. 읽기 전용이며 `haiku`와 `low` effort를 사용합니다.
- `implementation-worker`: 소유 범위가 분명한 구현 작업을 수행합니다. 편집 권한이 있으며 `sonnet`과 `medium` effort를 사용합니다.
- `code-reviewer`: 변경 후 버그, 회귀, 보안 문제, 테스트 누락을 찾습니다. `sonnet`과 `high` effort를 사용합니다.
- `verification-auditor`: 완료 전 요구사항과 증거를 대조합니다. `opus`와 `xhigh` effort를 사용합니다.
- `codex-main`: 플러그인 사용 시 main-thread agent로 동작합니다. 전체 harness 판단을 담당하므로 `opus`와 `high` effort를 사용합니다.

명시적으로 agent를 호출하려면 Claude Code에서 agent mention을 사용하거나 자연어로 요청합니다.

```text
Use the verification-auditor agent to audit this task before completion.
```

플러그인 agent를 세션 기본값으로 실행하려면:

```bash
claude --plugin-dir ./plugins/codex-harness --agent codex-harness:codex-main
```

## Skills

Harness에는 다음 reusable workflow가 포함됩니다.

- `context-triage`: 낯선 저장소에서 필요한 만큼만 읽고 변경 경계를 찾습니다.
- `surgical-editing`: read-before-write, 최소 diff, local style matching을 강제합니다.
- `completion-audit`: 완료 전 모든 요구사항을 실제 증거에 매핑합니다.
- `handoff-note`: 작업 중단 또는 세션 전환을 위한 짧은 handoff를 작성합니다.

## Model And Effort Policy

복잡도에 따라 모델과 think level을 함께 나눕니다.

- `haiku` + `low`: 단순 탐색, 요약, handoff
- `sonnet` + `medium`: 일반 구현, bounded worker, 기본 main-thread 작업
- `sonnet`/`opus` + `high`: 리뷰, 구조 영향이 있는 변경, 어려운 디버깅
- `opus` + `xhigh`: 복잡한 계획, 완료 감사, 요구사항 대조
- `max` 또는 `ultrathink`: 명시적으로 매우 깊은 1회성 reasoning이 필요할 때만 사용

주의: `CLAUDE_CODE_SUBAGENT_MODEL` 환경 변수가 설정되어 있으면 subagent frontmatter의 모델보다 우선합니다. 전체 subagent 모델이 예상과 다르게 동작하면 이 환경 변수를 먼저 확인합니다.
`CLAUDE_CODE_EFFORT_LEVEL` 환경 변수가 설정되어 있으면 frontmatter의 `effort`보다 우선합니다.

## Configuration Layout

- Project memory: `CLAUDE.md`
- Project settings and permissions: `.claude/settings.json`
- Output style: `.claude/output-styles/codex-harness.md`
- Slash commands: `.claude/commands`
- Project agents: `.claude/agents`
- Project skills: `.claude/skills`
- Portable plugin: `plugins/codex-harness`
- Verification script: `scripts/verify-harness.ps1`

## Verification

구성 파일을 수정한 뒤에는 검증 스크립트를 실행합니다.

```powershell
pwsh -File scripts/verify-harness.ps1
```

이 스크립트는 다음을 확인합니다.

- 필수 파일 존재 여부
- JSON 구성 파일 파싱 가능 여부
- Markdown frontmatter 존재 여부
- commands와 agents의 모델 할당 여부
- commands, agents, skills의 effort 할당 여부
- 프로젝트 기본 모델이 `sonnet`인지 여부
- 프로젝트 기본 effort가 `medium`인지 여부

성공하면 다음과 비슷한 출력이 나옵니다.

```text
Harness verification passed.
Checked 35 required files.
```

## Recommended Usage

단일 프로젝트에서만 쓸 때는 `.claude` 구성을 그대로 사용합니다. 여러 프로젝트에 같은 harness를 배포하거나 팀원에게 공유하려면 플러그인 방식을 사용합니다.

새 프로젝트에서 플러그인을 로드한 뒤에는 먼저 `/plan`으로 작업 범위와 검증 방법을 잡고, 구현이 끝나면 `/verify`를 완료 gate로 사용합니다. 완료 주장은 검증 출력이나 실제 파일 확인이 있을 때만 합니다.
