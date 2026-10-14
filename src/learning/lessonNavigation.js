// Use a query parameter so deep links work on static hosts such as GitHub Pages.
export function lessonIdFromUrl(href, validIds) {
  try {
    const id = new URL(href).searchParams.get('lesson')
    return id && validIds.includes(id) ? id : null
  } catch {
    return null
  }
}

export function lessonUrl(href, lessonId) {
  const url = new URL(href)
  url.searchParams.set('lesson', lessonId)
  return url.href
}

export function isLessonShortcut(event) {
  if (!['j', 'k'].includes(event.key?.toLowerCase())) return false
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || event.repeat) return false
  return !event.target?.closest?.('input, textarea, select, button, a, [contenteditable], [role="textbox"], [role="combobox"], [role="dialog"]')
}

// Only intercept ordinary left clicks. Preserve browser open-in-new-tab,
// copy-link and other native anchor interactions.
export function shouldHandleLessonLinkClick(event) {
  return !event.defaultPrevented
    && event.button === 0
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.shiftKey
}
