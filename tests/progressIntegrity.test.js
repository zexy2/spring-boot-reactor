import test from 'node:test'
import assert from 'node:assert/strict'

import { validatedCompletedLessonIds } from '../src/learning/progressIntegrity.js'

const plainLesson = { id: 'plain', codeNotes: [] }
const codeLesson = { id: 'annotations', codeNotes: [] }

test('legacy completion cannot bypass a newly required code workout', () => {
  const completed = validatedCompletedLessonIds(
    ['plain', 'annotations', 'missing'],
    { annotations: { codePassed: false } },
    [plainLesson, codeLesson],
  )

  assert.deepEqual(completed, ['plain'])
})

test('code-gated completion is preserved after code workout evidence exists', () => {
  const completed = validatedCompletedLessonIds(
    ['plain', 'annotations'],
    { annotations: { codePassed: true } },
    [plainLesson, codeLesson],
  )

  assert.deepEqual(completed, ['plain', 'annotations'])
})

test('new-format plain completion requires persisted checkpoint evidence', () => {
  const completed = validatedCompletedLessonIds(
    ['plain'],
    {
      plain: {
        completionEvidenceVersion: 2,
        masteredAt: 123,
        masteryCheckpoint: { masteredConceptIds: [] },
      },
    },
    [plainLesson],
  )

  assert.deepEqual(completed, [])
})

test('new-format plain completion is preserved with checkpoint evidence', () => {
  const completed = validatedCompletedLessonIds(
    ['plain'],
    {
      plain: {
        completionEvidenceVersion: 2,
        masteredAt: 123,
        masteryCheckpoint: { masteredConceptIds: ['plain-main'] },
      },
    },
    [plainLesson],
  )

  assert.deepEqual(completed, ['plain'])
})
