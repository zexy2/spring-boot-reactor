const CLEAN_IMAGE = Object.freeze({ tag: 'shop/order:1.4.2', digest: 'sha256:7ac91e' })

export function createSecretConfigState() {
  return {
    mode: 'runtime',
    env: 'prod',
    secretVersion: 1,
    accessAllowed: true,
    deployments: { staging: null, prod: null },
    artifactHistory: [],
    revokedVersions: [],
    logs: [],
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

export function setSecretDeliveryMode(state, mode) {
  if (!['plain', 'masked', 'runtime'].includes(mode) || state.mode === mode) return state
  return record(state, { mode, blockedReason: null }, `Secret delivery mode → ${mode.toUpperCase()}.`)
}

export function setSecretEnvironment(state, env) {
  if (!['staging', 'prod'].includes(env) || state.env === env) return state
  return record(state, { env, blockedReason: null }, `Target environment → ${env.toUpperCase()}.`)
}

export function setSecretAccess(state, accessAllowed) {
  if (state.accessAllowed === accessAllowed) return state
  return record(state, { accessAllowed, blockedReason: null }, accessAllowed ? 'Secret access policy ALLOW.' : 'Secret access policy DENY.', accessAllowed ? 'ok' : 'warn')
}

function dbUrl(env) {
  return env === 'prod' ? 'jdbc:postgresql://prod-db/order' : 'jdbc:postgresql://staging-db/order'
}

function deploymentFor(state, imageDigest, source) {
  return {
    env: state.env,
    imageTag: CLEAN_IMAGE.tag,
    imageDigest,
    config: { dbUrl: dbUrl(state.env) },
    credentialVersion: state.secretVersion,
    credentialState: 'ACTIVE',
    secretSource: source,
  }
}

export function deploySecretConfig(state) {
  const version = state.secretVersion

  if (state.mode === 'plain') {
    const imageDigest = `sha256:leaky-v${version}`
    const artifact = { imageDigest, secretVersion: version, leaked: true }
    const deployment = deploymentFor(state, imageDigest, 'IMAGE_LAYER')
    return record(state, {
      deployments: { ...state.deployments, [state.env]: deployment },
      artifactHistory: [...state.artifactHistory, artifact],
      logs: [...state.logs, `docker build --build-arg PAYMENT_TOKEN=token_v${version}_EXPOSED`].slice(-10),
      blockedReason: null,
    }, `v${version} secret image layer/build history içine sızdı.`, 'error')
  }

  if (!state.accessAllowed) {
    return blocked(state, state.mode === 'masked'
      ? 'DEPLOY blocked: CI principal secret değerini okumaya yetkili değil.'
      : 'DEPLOY blocked: workload identity secret manager erişimine sahip değil.')
  }

  if (state.mode === 'masked') {
    const deployment = deploymentFor(state, CLEAN_IMAGE.digest, 'CI_MASKED_VARIABLE')
    return record(state, {
      deployments: { ...state.deployments, [state.env]: deployment },
      logs: [...state.logs, 'PAYMENT_TOKEN=********'].slice(-10),
      blockedReason: null,
    }, `CI secret v${version} logda maskelendi; CI principal yine plaintext değere erişti.`, 'warn')
  }

  const deployment = deploymentFor(state, CLEAN_IMAGE.digest, 'SECRET_MANAGER_RUNTIME')
  return record(state, {
    deployments: { ...state.deployments, [state.env]: deployment },
    logs: [...state.logs, `deploy ${state.env} · PAYMENT_TOKEN=[runtime secret ref v${version}]`].slice(-10),
    blockedReason: null,
  }, `Workload identity secret v${version} değerini runtime'da aldı.`, 'ok')
}

export function rotateSecret(state) {
  const revokedVersion = state.secretVersion
  const secretVersion = revokedVersion + 1
  const deployments = Object.fromEntries(Object.entries(state.deployments).map(([env, deployment]) => [
    env,
    deployment && deployment.credentialVersion === revokedVersion
      ? { ...deployment, credentialState: 'REVOKED' }
      : deployment,
  ]))
  return record(state, {
    secretVersion,
    revokedVersions: [...state.revokedVersions, revokedVersion],
    deployments,
    blockedReason: null,
  }, `Secret v${revokedVersion} revoke edildi; v${secretVersion} aktif. Eski runtime snapshot'ları yeniden deploy/restart ister.`, 'warn')
}

export function secretLeakVersions(state) {
  return [...new Set(state.artifactHistory.filter((item) => item.leaked).map((item) => item.secretVersion))]
}

export { CLEAN_IMAGE as SAFE_SECRET_IMAGE }
