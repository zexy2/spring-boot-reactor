import { useLayoutEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers, placeholder } from '@codemirror/view'
import { defaultHighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { java } from '@codemirror/lang-java'
import { history, historyKeymap, indentMore } from '@codemirror/commands'
import { MAX_CODE_DRAFT_LENGTH } from '../../learning/progressTransfer'

// CodeMirror only renders visible lines, even with thousands of blank lines.
export default function JavaCodeEditor({ value, onChange, onVerify, onEscape, label, helpId, fragment }) {
  const mountRef = useRef(null)
  const viewRef = useRef(null)
  const callbacks = useRef({ onChange, onVerify, onEscape })
  callbacks.current = { onChange, onVerify, onEscape }

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
      if (view.state.doc.length + 2 > MAX_CODE_DRAFT_LENGTH) return true
      view.dispatch(view.state.replaceSelection('  '), { scrollIntoView: true, userEvent: 'input' })
      return true
    }
    const extensions = [
      lineNumbers(), history(), drawSelection(), highlightActiveLine(),
      indentUnit.of('  '), java(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorState.changeFilter.of((transaction) => transaction.newDoc.length <= MAX_CODE_DRAFT_LENGTH),
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
    const onLargeInsert = (event) => {
      // Large insertText payloads can make desktop Chromium build thousands of
      // editable DOM nodes before CodeMirror can virtualize them.
      if (event.inputType !== 'insertText' || event.isComposing || !event.cancelable ||
          typeof event.data !== 'string' || event.data.length < 1024) return
      event.preventDefault()
      event.stopImmediatePropagation()
      view.dispatch(view.state.replaceSelection(event.data), { scrollIntoView: true, userEvent: 'input' })
    }
    view.contentDOM.addEventListener('keydown', onShortcut, true)
    view.contentDOM.addEventListener('beforeinput', onLargeInsert, true)
    viewRef.current = { view, makeState }
    // Read-only E2E diagnostic: includes offscreen document content.
    view.dom.__getCodeDraft = () => view.state.doc.toString()
    view.dom.__selectCodeRange = (from, to) => view.dispatch({ selection: { anchor: from, head: to } })
    view.dom.__codeSelection = () => [view.state.selection.main.from, view.state.selection.main.to]
    return () => {
      view.contentDOM.removeEventListener('keydown', onShortcut, true)
      view.contentDOM.removeEventListener('beforeinput', onLargeInsert, true)
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
