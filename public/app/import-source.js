// Capture textarea UTF-8 before native form serialization changes LF to CRLF.
for (const form of document.querySelectorAll('form[data-import-source]')) {
  form.addEventListener('formdata', event => {
    const file = form.elements.namedItem('csvFile').files[0]
    if (file) return
    const bytes = new TextEncoder().encode(form.elements.namedItem('csv').value)
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
    }
    event.formData.delete('csv')
    event.formData.set('csvBase64', btoa(binary))
  })
}
