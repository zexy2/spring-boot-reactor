const CHECK_TIMEOUT_MS = 12_000
const UNAVAILABLE_MESSAGE = 'Java sözdizimi kontrolü şu anda çalışmıyor. Tekrar dene; kodun doğru veya yanlış olduğu henüz doğrulanmadı.'

let worker = null
let nextId = 0
const pending = new Map()

function unavailableError() {
  return Object.assign(new Error(UNAVAILABLE_MESSAGE), { code: 'JAVA_SYNTAX_UNAVAILABLE' })
}

function resetWorker() {
  worker?.terminate()
  worker = null
  for (const request of pending.values()) {
    clearTimeout(request.timer)
    request.reject(unavailableError())
  }
  pending.clear()
}

function ensureWorker() {
  if (worker) return worker
  if (typeof Worker === 'undefined') throw unavailableError()
  const instance = new Worker(new URL('./javaSyntaxWorker.js', import.meta.url), { type: 'module' })
  instance.onmessage = ({ data }) => {
    const request = pending.get(data?.id)
    if (!request) return
    pending.delete(data.id)
    clearTimeout(request.timer)
    request.resolve(data)
  }
  instance.onerror = (event) => {
    event.preventDefault()
    if (worker === instance) resetWorker()
  }
  instance.onmessageerror = () => {
    if (worker === instance) resetWorker()
  }
  worker = instance
  return instance
}

export function prefetchJavaSyntaxRuntime() {
  // Starting a module worker begins fetching the parser before the learner checks code.
  try { ensureWorker() } catch { /* Verification reports failure if workers are unavailable. */ }
}

export function validateJavaSyntax(answer, templates) {
  return new Promise((resolve, reject) => {
    let activeWorker
    try {
      activeWorker = ensureWorker()
    } catch {
      reject(unavailableError())
      return
    }
    const id = ++nextId
    const timer = setTimeout(() => {
      if (pending.has(id)) resetWorker()
    }, CHECK_TIMEOUT_MS)
    pending.set(id, { resolve, reject, timer })
    try {
      activeWorker.postMessage({ id, answer, templates })
    } catch {
      resetWorker()
    }
  })
}
