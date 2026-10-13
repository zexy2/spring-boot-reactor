const PHASES = ['resolve', 'compile', 'test', 'package']

const COMMITS = ['c91e2a1', 'b72fd10', 'e04ac77', 'f31d9b4']

export function createMavenArtifactState() {
  return {
    revision: 2,
    sourceCommit: COMMITS[0],
    testShouldFail: false,
    dependenciesResolved: false,
    compiled: false,
    tests: 'NOT_RUN',
    artifact: null,
    repositoryArtifact: null,
    stagingArtifact: null,
    productionArtifact: { version: '1.4.1', name: 'shop-service-1.4.1.jar', checksum: 'sha256:previous' },
    evidence: {},
    blockedReason: null,
    nextEventId: 1,
    events: [],
  }
}

function record(state, updates, message, tone = 'info') {
  return {
    ...state,
    ...updates,
    nextEventId: state.nextEventId + 1,
    events: [...state.events, { id: state.nextEventId, message, tone }].slice(-16),
  }
}

function blocked(state, reason) {
  return record(state, { blockedReason: reason }, reason, 'error')
}

function buildArtifact(state) {
  const version = `1.4.${state.revision}`
  return {
    version,
    name: `shop-service-${version}.jar`,
    checksum: `sha256:${state.sourceCommit}${state.revision}f4d`,
    sourceCommit: state.sourceCommit,
  }
}

export function setMavenTestFailure(state, testShouldFail) {
  if (state.testShouldFail === testShouldFail) return state
  return record(state, {
    testShouldFail,
    tests: state.compiled ? 'NOT_RUN' : state.tests,
    artifact: null,
    evidence: { ...state.evidence, test: undefined, package: undefined },
    blockedReason: null,
  }, testShouldFail ? 'Test fixture regression üretecek şekilde değiştirildi.' : 'Test fixture tekrar green senaryoya döndü.', testShouldFail ? 'warn' : 'ok')
}

export function changeMavenSource(state) {
  const revision = state.revision + 1
  const sourceCommit = COMMITS[(revision - 2) % COMMITS.length]
  return record(state, {
    revision,
    sourceCommit,
    compiled: false,
    tests: 'NOT_RUN',
    artifact: null,
    evidence: state.dependenciesResolved ? { resolve: state.evidence.resolve } : {},
    blockedReason: null,
  }, `Yeni source commit ${sourceCommit}; compile/test/package kanıtı geçersizleşti.`, 'info')
}

export function runMavenPhase(state, phase) {
  if (!PHASES.includes(phase)) return state

  if (phase === 'resolve') {
    return record(state, {
      dependenciesResolved: true,
      evidence: { ...state.evidence, resolve: '14 dependency · Maven Central/cache' },
      blockedReason: null,
    }, 'pom.xml dependency graph çözüldü.', 'ok')
  }

  if (phase === 'compile') {
    if (!state.dependenciesResolved) return blocked(state, 'COMPILE blocked: önce dependency graph çözülmeli.')
    return record(state, {
      compiled: true,
      tests: 'NOT_RUN',
      artifact: null,
      evidence: { ...state.evidence, compile: `27 class · source ${state.sourceCommit}`, test: undefined, package: undefined },
      blockedReason: null,
    }, `${state.sourceCommit} bytecode'a compile edildi.`, 'ok')
  }

  if (phase === 'test') {
    if (!state.compiled) return blocked(state, 'TEST blocked: önce compile çıktısı gerekli.')
    if (state.testShouldFail) {
      return record(state, {
        tests: 'FAILED',
        artifact: null,
        evidence: { ...state.evidence, test: '63 passed · 1 failed', package: undefined },
        blockedReason: 'TEST failed: package artifact üretemez.',
      }, 'Surefire test gate kırmızı; package ilerleyemez.', 'error')
    }
    return record(state, {
      tests: 'PASSED',
      evidence: { ...state.evidence, test: '64 passed · 0 failed' },
      blockedReason: null,
    }, 'Test gate green: 64/64 geçti.', 'ok')
  }

  if (state.tests !== 'PASSED') return blocked(state, 'PACKAGE blocked: başarılı test kanıtı yok.')
  const artifact = buildArtifact(state)
  return record(state, {
    artifact,
    evidence: { ...state.evidence, package: `${artifact.name} · ${artifact.checksum}` },
    blockedReason: null,
  }, `${artifact.name} target/ altında üretildi.`, 'ok')
}

export function publishMavenArtifact(state) {
  if (!state.artifact) return blocked(state, 'REPOSITORY publish blocked: package edilmiş artifact yok.')
  return record(state, {
    repositoryArtifact: { ...state.artifact },
    blockedReason: null,
  }, `${state.artifact.name} artifact repository'ye immutable sürüm olarak yayınlandı.`, 'ok')
}

export function promoteMavenArtifact(state, environment) {
  if (!['staging', 'production'].includes(environment)) return state
  if (!state.repositoryArtifact) return blocked(state, `${environment.toUpperCase()} promotion blocked: repository artifact yok.`)

  if (environment === 'production') {
    if (!state.stagingArtifact || state.stagingArtifact.checksum !== state.repositoryArtifact.checksum) {
      return blocked(state, 'PRODUCTION promotion blocked: exact repository artifact staging üzerinde doğrulanmadı.')
    }
    return record(state, {
      productionArtifact: { ...state.repositoryArtifact },
      blockedReason: null,
    }, `${state.repositoryArtifact.checksum} staging'den production'a promote edildi.`, 'ok')
  }

  return record(state, {
    stagingArtifact: { ...state.repositoryArtifact },
    blockedReason: null,
  }, `${state.repositoryArtifact.checksum} staging'e promote edildi.`, 'ok')
}

export { PHASES as MAVEN_PHASES }
