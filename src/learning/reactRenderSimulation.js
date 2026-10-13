export function createReactRenderState() {
  return {
    productName: 'Klavye',
    count: 0,
    parentRenders: 1,
    childRenders: 1,
    effectRuns: 1,
    memoEnabled: false,
    lastCause: 'MOUNT',
    nextEventId: 1,
    events: [{ id: 0, cause: 'MOUNT', detail: 'Parent + ProductCard render; effect([productName]) run #1.', tone: 'ok' }],
  }
}

function record(state, updates, cause, detail, tone = 'info') {
  return {
    ...state,
    ...updates,
    lastCause: cause,
    nextEventId: state.nextEventId + 1,
    events: [...state.events, { id: state.nextEventId, cause, detail, tone }].slice(-16),
  }
}

export function updateReactChildState(state) {
  const count = state.count + 1
  return record(state, {
    count,
    childRenders: state.childRenders + 1,
  }, 'CHILD STATE', `setCount(${count}) → ProductCard render; productName değişmediği için effect SKIP.`, 'ok')
}

export function changeReactProductProp(state) {
  const productName = state.productName === 'Klavye' ? 'Mouse' : 'Klavye'
  return record(state, {
    productName,
    parentRenders: state.parentRenders + 1,
    childRenders: state.childRenders + 1,
    effectRuns: state.effectRuns + 1,
  }, 'PROP CHANGE', `Parent productName=${productName} verdi → child render → dependency changed → effect run #${state.effectRuns + 1}.`, 'ok')
}

export function rerenderReactParent(state) {
  const childRenders = state.memoEnabled ? state.childRenders : state.childRenders + 1
  return record(state, {
    parentRenders: state.parentRenders + 1,
    childRenders,
  }, 'PARENT RENDER', state.memoEnabled
    ? 'Parent render oldu; prop aynı ve React.memo aktif → ProductCard render SKIP.'
    : 'Parent render oldu; prop aynı olsa da ProductCard tekrar render oldu; effect dependency aynı olduğu için effect SKIP.', state.memoEnabled ? 'ok' : 'warn')
}

export function setReactMemo(state, memoEnabled) {
  if (state.memoEnabled === memoEnabled) return state
  return record(state, { memoEnabled }, 'MEMO POLICY', memoEnabled
    ? 'React.memo aktif: aynı props ile parent render olduğunda child render atlanabilir.'
    : 'React.memo kapalı: parent render child render üretebilir.', 'info')
}
