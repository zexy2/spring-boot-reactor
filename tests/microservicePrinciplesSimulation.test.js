import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateMicroservicePrinciples } from '../src/learning/microservicePrinciplesSimulation.js'

test('dedicated cohesive compatible observable service has strong evidence', () => {
  const result = evaluateMicroservicePrinciples()
  assert.equal(result.riskCount, 0)
  assert.equal(result.deploymentAutonomy, true)
  assert.equal(result.changeIsolation, true)
  assert.equal(result.diagnosable, true)
  assert.equal(result.verdict, 'STRONG EVIDENCE')
})

test('shared ownership removes deployment autonomy and change isolation', () => {
  const result = evaluateMicroservicePrinciples({ ownership: 'shared' })
  assert.equal(result.riskCount, 1)
  assert.equal(result.deploymentAutonomy, false)
  assert.equal(result.changeIsolation, false)
  assert.equal(result.findings.find((finding) => finding.id === 'OWNERSHIP').status, 'RISK')
})

test('breaking provider contract proves deployment coupling even with dedicated ownership', () => {
  const result = evaluateMicroservicePrinciples({ contract: 'breaking' })
  assert.equal(result.deploymentAutonomy, false)
  assert.equal(result.changeIsolation, true)
  assert.match(result.findings.find((finding) => finding.id === 'CONTRACT').evidence, /coordinated release/)
})

test('missing observability makes distributed incident non-diagnosable', () => {
  const result = evaluateMicroservicePrinciples({ observability: 'blind' })
  assert.equal(result.diagnosable, false)
  assert.equal(result.findings.find((finding) => finding.id === 'OBSERVABILITY').status, 'RISK')
})

test('multiple bad boundary decisions surface high coupling risk without fake percentage', () => {
  const result = evaluateMicroservicePrinciples({
    ownership: 'shared',
    cohesion: 'mixed',
    contract: 'breaking',
    observability: 'blind',
  })
  assert.equal(result.riskCount, 4)
  assert.equal(result.verdict, 'HIGH COUPLING RISK')
  assert.equal(result.deploymentAutonomy, false)
  assert.equal(result.changeIsolation, false)
  assert.equal(result.diagnosable, false)
})
