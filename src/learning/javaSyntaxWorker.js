import { parse } from 'java-parser'

// Grammar validation runs outside the UI thread. This does not compile or execute Java.
self.onmessage = ({ data }) => {
  const { id, answer, templates } = data
  let lastError = null
  for (const template of templates) {
    try {
      parse(template.replace('__ANSWER__', answer))
      self.postMessage({ id, ok: true })
      return
    } catch (error) {
      lastError = error
    }
  }

  const rawMessage = String(lastError?.message || '').split('\n')[0].slice(0, 220)
  const position = rawMessage.match(/line:\s*(\d+),\s*column:\s*(\d+)/i)
  const message = position && templates.every((template) => template === '__ANSWER__')
    ? `${position[1]}. satır, ${position[2]}. sütun civarında Java sözdizimi hatası. Parantez, noktalı virgül ve ifadeleri kontrol et.`
    : /sad sad panda|line:\s*NaN|column:\s*NaN/i.test(rawMessage)
      ? 'Java parser sözdizimi hatası buldu. Parantezleri, annotation konumunu ve class/method yapısını kontrol et.'
      : (rawMessage || 'Java sözdizimi çözümlenemedi. Parantezleri ve declaration yapısını kontrol et.')
  self.postMessage({ id, ok: false, message })
}
