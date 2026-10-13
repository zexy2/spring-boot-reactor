const DIGESTS = [
  'sha256:71c2a8f6d901',
  'sha256:b4e8912cd773',
  'sha256:9f31d54aa620',
  'sha256:2ab784fc0e18',
]

export function createDockerContainerState() {
  return {
    sourceRevision: 1,
    tag: 'shop/order:1.0',
    builderImage: null,
    registryImage: null,
    runtimeImage: null,
    runtimeEnv: 'staging',
    containers: [],
    nextContainerId: 1,
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
    events: [...state.events, { id: state.nextEventId, message, tone }].slice(-18),
  }
}

function blocked(state, reason) {
  return record(state, { blockedReason: reason }, reason, 'error')
}

function imageFor(state) {
  return {
    tag: state.tag,
    digest: DIGESTS[(state.sourceRevision - 1) % DIGESTS.length],
    sourceRevision: state.sourceRevision,
    layers: ['eclipse-temurin:21-jre', 'app.jar', 'entrypoint'],
  }
}

export function changeDockerSource(state) {
  const sourceRevision = state.sourceRevision + 1
  return record(state, {
    sourceRevision,
    blockedReason: null,
  }, `Source r${sourceRevision}; mevcut image/container bytes değişmedi.`, 'info')
}

export function buildDockerImage(state) {
  const builderImage = imageFor(state)
  const tagMoved = state.builderImage && state.builderImage.tag === builderImage.tag && state.builderImage.digest !== builderImage.digest
  return record(state, {
    builderImage,
    blockedReason: null,
  }, `${builderImage.tag} build edildi → ${builderImage.digest}.${tagMoved ? ' Aynı tag yeni digest aldı.' : ''}`, tagMoved ? 'warn' : 'ok')
}

export function pushDockerImage(state) {
  if (!state.builderImage) return blocked(state, 'PUSH blocked: builder üzerinde image yok.')
  return record(state, {
    registryImage: { ...state.builderImage, layers: [...state.builderImage.layers] },
    blockedReason: null,
  }, `Registry ${state.builderImage.tag} → ${state.builderImage.digest} olarak güncellendi.`, 'ok')
}

export function pullDockerImage(state) {
  if (!state.registryImage) return blocked(state, 'PULL blocked: registry üzerinde yayınlanmış image yok.')
  return record(state, {
    runtimeImage: { ...state.registryImage, layers: [...state.registryImage.layers] },
    blockedReason: null,
  }, `Runtime host exact digest ${state.registryImage.digest} çekti.`, 'ok')
}

export function setDockerRuntimeEnv(state, runtimeEnv) {
  if (!['staging', 'prod'].includes(runtimeEnv) || state.runtimeEnv === runtimeEnv) return state
  return record(state, { runtimeEnv }, `Runtime config ${runtimeEnv.toUpperCase()} olarak seçildi; image bytes değişmedi.`)
}

function runtimeConfig(runtimeEnv) {
  return runtimeEnv === 'prod'
    ? { dbUrl: 'jdbc:postgresql://prod-db/order', secretRef: 'secret-manager/payment-token-prod' }
    : { dbUrl: 'jdbc:postgresql://staging-db/order', secretRef: 'secret-manager/payment-token-staging' }
}

export function runDockerContainer(state) {
  if (!state.runtimeImage) return blocked(state, 'RUN blocked: runtime host önce registry image digest’ini pull etmeli.')
  if (state.containers.length >= 3) return blocked(state, 'RUN blocked: bu lab aynı anda en fazla 3 container gösteriyor.')
  const config = runtimeConfig(state.runtimeEnv)
  const container = {
    id: `C${state.nextContainerId}`,
    imageTag: state.runtimeImage.tag,
    imageDigest: state.runtimeImage.digest,
    sourceRevision: state.runtimeImage.sourceRevision,
    env: state.runtimeEnv,
    dbUrl: config.dbUrl,
    secretRef: config.secretRef,
  }
  return record(state, {
    containers: [...state.containers, container],
    nextContainerId: state.nextContainerId + 1,
    blockedReason: null,
  }, `${container.id} başladı · ${container.imageDigest} · ENV=${container.env}.`, 'ok')
}

export function removeDockerContainer(state, id) {
  const container = state.containers.find((item) => item.id === id)
  if (!container) return state
  return record(state, {
    containers: state.containers.filter((item) => item.id !== id),
    blockedReason: null,
  }, `${id} silindi; image/registry digest ${container.imageDigest} korunuyor.`, 'info')
}
