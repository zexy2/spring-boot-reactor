const STAGE_ORDER = ['lint', 'test', 'scan', 'package', 'deploy']

const DEFAULT_STAGES = Object.freeze({ lint: true, test: true, scan: true, package: true, deploy: true })

export function createPipelineAsCodeState() {
  return {
    trigger: 'pull_request',
    revision: 3,
    committedStages: { ...DEFAULT_STAGES },
    draftStages: { ...DEFAULT_STAGES },
    dirty: false,
    failureStage: null,
    runNumber: 0,
    lastRun: null,
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

export function setPipelineTrigger(state, trigger) {
  if (!['pull_request', 'tag'].includes(trigger) || state.trigger === trigger) return state
  return record(state, { trigger }, trigger === 'tag' ? 'Trigger tag:v1.4.2 olarak seçildi.' : 'Trigger pull_request olarak seçildi.')
}

export function setPipelineFailure(state, failureStage) {
  if (![null, 'test', 'scan'].includes(failureStage) || state.failureStage === failureStage) return state
  return record(state, { failureStage }, failureStage ? `${failureStage.toUpperCase()} job failure injection aktif.` : 'Failure injection kapatıldı.', failureStage ? 'warn' : 'ok')
}

export function togglePipelineDraftStage(state, stage) {
  if (!STAGE_ORDER.includes(stage)) return state
  const draftStages = { ...state.draftStages, [stage]: !state.draftStages[stage] }
  const dirty = STAGE_ORDER.some((key) => draftStages[key] !== state.committedStages[key])
  return record(state, { draftStages, dirty }, `${stage.toUpperCase()} draft workflow içinde ${draftStages[stage] ? 'enable' : 'disable'} edildi; henüz commit edilmedi.`, 'warn')
}

export function commitPipelineDefinition(state) {
  if (!state.dirty) return state
  const revision = state.revision + 1
  return record(state, {
    revision,
    committedStages: { ...state.draftStages },
    dirty: false,
  }, `Workflow r${revision} repository history'sine commit edildi.`, 'ok')
}

function buildRun(state) {
  const jobs = []
  let failed = false
  for (const stage of STAGE_ORDER) {
    const enabled = state.committedStages[stage]
    if (!enabled) {
      jobs.push({ stage, status: 'SKIP', detail: 'workflow stage disabled' })
      continue
    }

    if (stage === 'deploy') {
      if (failed) {
        jobs.push({ stage, status: 'BLOCKED', detail: 'upstream job failed' })
        continue
      }
      if (state.trigger === 'pull_request') {
        jobs.push({ stage, status: 'POLICY_SKIP', detail: 'PR cannot deploy production' })
        continue
      }
      const missingQualityGate = !state.committedStages.test || !state.committedStages.scan || !state.committedStages.package
      if (missingQualityGate) {
        jobs.push({ stage, status: 'POLICY_BLOCKED', detail: 'required test + scan + package gate missing' })
        continue
      }
      jobs.push({ stage, status: 'PASS', detail: 'tag policy allows production promotion' })
      continue
    }

    if (failed) {
      jobs.push({ stage, status: 'BLOCKED', detail: 'upstream job failed' })
      continue
    }

    if (state.failureStage === stage) {
      jobs.push({ stage, status: 'FAIL', detail: `${stage} command exited non-zero` })
      failed = true
      continue
    }

    jobs.push({ stage, status: 'PASS', detail: stage === 'package' ? 'artifact sha256:7ac91e produced' : `${stage} evidence green` })
  }

  const packageJob = jobs.find((job) => job.stage === 'package')
  const deployJob = jobs.find((job) => job.stage === 'deploy')
  return {
    revision: state.revision,
    trigger: state.trigger,
    jobs,
    artifact: packageJob?.status === 'PASS' ? { version: '1.4.2', checksum: 'sha256:7ac91e' } : null,
    productionPromoted: deployJob?.status === 'PASS',
    verdict: jobs.some((job) => job.status === 'FAIL')
      ? 'PIPELINE FAILED'
      : deployJob?.status === 'POLICY_BLOCKED'
        ? 'RELEASE POLICY BLOCKED'
        : state.trigger === 'pull_request'
          ? 'PR VERIFIED · NO DEPLOY'
          : deployJob?.status === 'PASS'
            ? 'TAG RELEASED'
            : 'TAG VERIFIED · DEPLOY SKIPPED',
  }
}

export function runPipelineDefinition(state) {
  const runNumber = state.runNumber + 1
  const lastRun = { ...buildRun(state), number: runNumber }
  const tone = lastRun.verdict === 'PIPELINE FAILED' || lastRun.verdict === 'RELEASE POLICY BLOCKED' ? 'error' : 'ok'
  return record(state, { runNumber, lastRun }, `Run #${runNumber} · workflow r${state.revision} · ${lastRun.verdict}.`, tone)
}

export { STAGE_ORDER as PIPELINE_AS_CODE_STAGES }
