import { useLayoutEffect, useRef } from 'react'
import { EditorState, Transaction } from '@codemirror/state'
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers, placeholder } from '@codemirror/view'
import { defaultHighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { java } from '@codemirror/lang-java'
import { history, historyKeymap, indentMore, redo, selectAll } from '@codemirror/commands'
import { MAX_CODE_DRAFT_LENGTH } from '../../learning/progressTransfer'

// CodeMirror only renders visible lines, even with thousands of blank lines.
export default function JavaCodeEditor({ value, syncVersion, onChange, onVerify, onEscape, onLimitReached, readDocumentRef, label, helpId, fragment }) {
  const mountRef = useRef(null)
  const viewRef = useRef(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const mountConfigRef = useRef(null)
  if (mountConfigRef.current === null) {
    mountConfigRef.current = { value, readDocumentRef, label, helpId, fragment }
  }
  const callbacks = useRef({ onChange, onVerify, onEscape, onLimitReached })
  callbacks.current = { onChange, onVerify, onEscape, onLimitReached }

  useLayoutEffect(() => {
    const {
      value: initialValue,
      readDocumentRef: initialReadDocumentRef,
      label: initialLabel,
      helpId: initialHelpId,
      fragment: initialFragment,
    } = mountConfigRef.current
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
      EditorView.contentAttributes.of({ 'aria-label': initialLabel, 'aria-describedby': initialHelpId, 'aria-multiline': 'true', 'data-maxlength': String(MAX_CODE_DRAFT_LENGTH) }),
      placeholder(initialFragment ? 'TODO yerine gelecek ifadeyi yaz...' : 'Eksik kodu buraya yaz...'),
      keymap.of([
        // The browser can only select rendered lines of a virtualized document.
        { key: 'Mod-a', run: selectAll },
        { key: 'Tab', run: insertSpaces },
        { key: 'Escape', run: () => { callbacks.current.onEscape(); return true } },
        ...historyKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) callbacks.current.onChange(update.state.doc.toString())
      }),
    ]
    const makeState = (doc) => EditorState.create({ doc, extensions })
    const view = new EditorView({ state: makeState(initialValue), parent: mountRef.current })
    let compositionActive = false
    // Catch the shortcut before platform-specific mobile input handling.
    const onShortcut = (event) => {
      // Enter confirms composed text in an IME. Verification must wait until
      // the composition finishes, even when a browser omits isComposing.
      if (compositionActive || event.isComposing) return
      const commandModifier = event.ctrlKey || event.metaKey
      // Chromium/Linux can otherwise route Ctrl+Shift+Z through contenteditable
      // history and apply another undo. Handle it before CodeMirror/browser
      // keymaps so one key press always means exactly one redo transaction.
      if (commandModifier && event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.stopImmediatePropagation()
        redo(view)
        return
      }
      if (event.key !== 'Enter' || !commandModifier) return
      event.preventDefault()
      event.stopPropagation()
      callbacks.current.onVerify()
    }
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
        const completeDocumentSelected = range.from === 0 && range.to === view.state.doc.length
        if (!completeDocumentSelected && anchor !== head && (range.empty || stateSelectionVisible ||
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
    initialReadDocumentRef.current = () => view.state.doc.toString()
    // Read-only E2E diagnostic: includes offscreen document content.
    view.dom.__getCodeDraft = () => view.state.doc.toString()
    view.dom.__selectCodeRange = (from, to) => view.dispatch({ selection: { anchor: from, head: to } })
    view.dom.__codeSelection = () => [view.state.selection.main.from, view.state.selection.main.to]
    view.dom.__replaceCodeDraft = (nextValue, addToHistory = false) => {
      const next = String(nextValue)
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: next },
        selection: { anchor: next.length },
        annotations: Transaction.addToHistory.of(Boolean(addToHistory)),
      })
      return view.state.doc.toString()
    }
    return () => {
      view.contentDOM.removeEventListener('keydown', onShortcut, true)
      view.contentDOM.removeEventListener('compositionstart', onCompositionStart, true)
      view.contentDOM.removeEventListener('compositionend', onCompositionEnd, true)
      view.contentDOM.removeEventListener('blur', onCompositionEnd, true)
      view.contentDOM.removeEventListener('beforeinput', onMultiCharacterInsert, true)
      viewRef.current = null
      initialReadDocumentRef.current = null
      view.destroy()
    }
  }, [])

  useLayoutEffect(() => {
    const editor = viewRef.current
    const nextValue = valueRef.current
    if (!editor || editor.view.state.doc.toString() === nextValue) return
    // Only explicit restore/reset revisions may replace CodeMirror state.
    // React can commit an older local value after a newer editor transaction;
    // syncing every value prop would roll back fast typing, paste or undo.
    editor.view.setState(editor.makeState(nextValue))
  }, [syncVersion])

  return <div className="code-editor-shell" ref={mountRef} />
}
