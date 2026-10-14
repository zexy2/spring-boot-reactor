import { useLayoutEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers, placeholder } from '@codemirror/view'
import { defaultHighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { java } from '@codemirror/lang-java'
import { history, historyKeymap, indentMore } from '@codemirror/commands'
import { MAX_CODE_DRAFT_LENGTH } from '../../learning/progressTransfer'

// CodeMirror only renders visible lines, even with thousands of blank lines.
export default function JavaCodeEditor({ value, onChange, onVerify, onEscape, onLimitReached, label, helpId, fragment }) {
  const mountRef = useRef(null)
  const viewRef = useRef(null)
  const callbacks = useRef({ onChange, onVerify, onEscape, onLimitReached })
  callbacks.current = { onChange, onVerify, onEscape, onLimitReached }

  useLayoutEffect(() => {
    const insertSpaces = (view) => {
      if (view.state.selection.ranges.some((range) => !range.empty)) {
        const previous = view.state.selection.main
        const indented = indentMore(view)
        if (indented && previous.from < view.state.selection.main.from) {
          // Include inserted leading whitespace in the highlighted selection.
          const next = view.state.selection.main
          view.dispatch({ selection: { anchor: previous.from, head: next.to } })
        }
        return indented
      }
      if (view.state.doc.length + 2 > MAX_CODE_DRAFT_LENGTH) {
        queueMicrotask(() => callbacks.current.onLimitReached?.())
        return true
      }
      view.dispatch(view.state.replaceSelection('  '), { scrollIntoView: true, userEvent: 'input' })
      return true
    }
    const extensions = [
      lineNumbers(), history(), drawSelection(), highlightActiveLine(),
      indentUnit.of('  '), java(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorState.changeFilter.of((transaction) => {
        if (transaction.newDoc.length <= MAX_CODE_DRAFT_LENGTH) return true
        // React updates must happen outside CodeMirror's dispatch.
        if (transaction.docChanged) queueMicrotask(() => callbacks.current.onLimitReached?.())
        return false
      }),
      EditorView.contentAttributes.of({ 'aria-label': label, 'aria-describedby': helpId, 'aria-multiline': 'true', 'data-maxlength': String(MAX_CODE_DRAFT_LENGTH) }),
      placeholder(fragment ? 'TODO yerine gelecek ifadeyi yaz...' : 'Eksik kodu buraya yaz...'),
      keymap.of([
        { key: 'Tab', run: insertSpaces },
        { key: 'Escape', run: () => { callbacks.current.onEscape(); return true } },
        ...historyKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) callbacks.current.onChange(update.state.doc.toString())
      }),
    ]
    const makeState = (doc) => EditorState.create({ doc, extensions })
    const view = new EditorView({ state: makeState(value), parent: mountRef.current })
    // Catch the shortcut before platform-specific mobile input handling.
    const onShortcut = (event) => {
      if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return
      event.preventDefault()
      event.stopPropagation()
      callbacks.current.onVerify()
    }
    let compositionActive = false
    const onCompositionStart = () => { compositionActive = true }
    const onCompositionEnd = () => { compositionActive = false }
    const onMultiCharacterInsert = (event) => {
      // Browser-driven multi-character insertions may arrive before CodeMirror
      // sees a changed DOM selection. Large inserts also need to skip building
      // thousands of editable nodes before CodeMirror virtualizes the document.
      // Some input methods emit insertText with isComposing=false even while
      // composition is active. Let CodeMirror manage all composition edits.
      if (compositionActive || event.inputType !== 'insertText' || event.isComposing || !event.cancelable ||
          typeof event.data !== 'string' || event.data.length < 2) return
      event.preventDefault()
      event.stopImmediatePropagation()
      // Only trust the DOM selection when the whole range maps to rendered
      // content. Offscreen selection is held accurately by CodeMirror state.
      const selected = view.root.getSelection()
      if (selected && !selected.isCollapsed &&
          view.contentDOM.contains(selected.anchorNode) &&
          view.contentDOM.contains(selected.focusNode)) {
        const anchor = view.posAtDOM(selected.anchorNode, selected.anchorOffset)
        const head = view.posAtDOM(selected.focusNode, selected.focusOffset)
        const range = view.state.selection.main
        const stateSelectionVisible = range.from >= view.viewport.from && range.to <= view.viewport.to
        if (anchor !== head && (range.empty || stateSelectionVisible ||
            (Math.min(anchor, head) === 0 && Math.max(anchor, head) === view.state.doc.length))) {
          // A fresh visible DOM selection can be ahead of CodeMirror's cached
          // selection. Keep CodeMirror's range when it spans virtualized lines.
          view.dispatch({ selection: { anchor, head } })
        }
      }
      view.dispatch(view.state.replaceSelection(event.data), { scrollIntoView: true, userEvent: 'input' })
    }
    view.contentDOM.addEventListener('keydown', onShortcut, true)
    view.contentDOM.addEventListener('compositionstart', onCompositionStart, true)
    view.contentDOM.addEventListener('compositionend', onCompositionEnd, true)
    view.contentDOM.addEventListener('blur', onCompositionEnd, true)
    view.contentDOM.addEventListener('beforeinput', onMultiCharacterInsert, true)
    viewRef.current = { view, makeState }
    // Read-only E2E diagnostic: includes offscreen document content.
    view.dom.__getCodeDraft = () => view.state.doc.toString()
    view.dom.__selectCodeRange = (from, to) => view.dispatch({ selection: { anchor: from, head: to } })
    view.dom.__codeSelection = () => [view.state.selection.main.from, view.state.selection.main.to]
    return () => {
      view.contentDOM.removeEventListener('keydown', onShortcut, true)
      view.contentDOM.removeEventListener('compositionstart', onCompositionStart, true)
      view.contentDOM.removeEventListener('compositionend', onCompositionEnd, true)
      view.contentDOM.removeEventListener('blur', onCompositionEnd, true)
      view.contentDOM.removeEventListener('beforeinput', onMultiCharacterInsert, true)
      viewRef.current = null
      view.destroy()
    }
  }, [])

  useLayoutEffect(() => {
    const editor = viewRef.current
    if (!editor || editor.view.state.doc.toString() === value) return
    // External restore/reset must discard stale undo history.
    editor.view.setState(editor.makeState(value))
  }, [value])

  return <div className="code-editor-shell" ref={mountRef} />
}
