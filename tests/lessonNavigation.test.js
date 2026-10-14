import test from 'node:test'
import assert from 'node:assert/strict'

import { isLessonShortcut, lessonIdFromUrl, lessonUrl, shouldHandleLessonLinkClick } from '../src/learning/lessonNavigation.js'

const ids = ['java-core', 'spring-web', 'ddd-services']

test('lesson deep links resolve only known lessons, including on GitHub Pages', () => {
  assert.equal(lessonIdFromUrl('https://example.com/spring-boot-reactor/?lesson=ddd-services', ids), 'ddd-services')
  assert.equal(lessonIdFromUrl('https://example.com/?lesson=not-a-lesson', ids), null)
  assert.equal(lessonIdFromUrl('https://example.com/?lesson=', ids), null)
  assert.equal(lessonIdFromUrl('not a url', ids), null)
})

test('lesson URLs preserve deployment path, other query values, and fragments', () => {
  assert.equal(
    lessonUrl('https://example.com/spring-boot-reactor/?utm_source=friend#intro', 'spring-web'),
    'https://example.com/spring-boot-reactor/?utm_source=friend&lesson=spring-web#intro',
  )
  assert.equal(lessonIdFromUrl(lessonUrl('https://example.com/', 'spring-web'), ids), 'spring-web')
})

test('lesson shortcuts only activate for plain j or k outside interactive elements', () => {
  const target = (selector) => ({ closest: () => selector ? {} : null })
  assert.equal(isLessonShortcut({ key: 'j', target: target(false) }), true)
  assert.equal(isLessonShortcut({ key: 'K', target: target(false) }), true)
  assert.equal(isLessonShortcut({ key: 'j', ctrlKey: true, target: target(false) }), false)
  assert.equal(isLessonShortcut({ key: 'j', isComposing: true, target: target(false) }), false)
  assert.equal(isLessonShortcut({ key: 'j', repeat: true, target: target(false) }), false)
  assert.equal(isLessonShortcut({ key: 'x', target: target(false) }), false)
  assert.equal(isLessonShortcut({ key: 'k', target: target(true) }), false)
})

test('lesson links preserve native modified-click and middle-click behavior', () => {
  assert.equal(shouldHandleLessonLinkClick({ button: 0 }), true)
  assert.equal(shouldHandleLessonLinkClick({ button: 1 }), false)
  assert.equal(shouldHandleLessonLinkClick({ button: 2 }), false)
  assert.equal(shouldHandleLessonLinkClick({ button: 0, metaKey: true }), false)
  assert.equal(shouldHandleLessonLinkClick({ button: 0, ctrlKey: true }), false)
  assert.equal(shouldHandleLessonLinkClick({ button: 0, shiftKey: true }), false)
  assert.equal(shouldHandleLessonLinkClick({ button: 0, altKey: true }), false)
  assert.equal(shouldHandleLessonLinkClick({ button: 0, defaultPrevented: true }), false)
})
