// Keep the whole focused link visible inside the scrolling phone navigation.
for (const navigation of document.querySelectorAll('.app-nav')) {
  navigation.addEventListener('focusin', event => {
    if (event.target instanceof HTMLAnchorElement) {
      event.target.scrollIntoView({block: 'nearest', inline: 'nearest'})
    }
  })
}

// Progressive validation for Terrace-owned forms; the server remains authoritative.
for (const [index, form] of [...document.querySelectorAll('form[data-accessible-form]')].entries()) {
  const summary = document.createElement('div')
  summary.className = 'validation-summary'
  summary.tabIndex = -1
  summary.hidden = true
  summary.setAttribute('role', 'alert')
  const heading = document.createElement('h2')
  heading.id = `validation-heading-${index}`
  heading.textContent = 'Check the highlighted fields'
  summary.setAttribute('aria-labelledby', heading.id)
  const list = document.createElement('ul')
  summary.append(heading, list)
  form.prepend(summary)
  const fields = [...form.elements].filter(field => field.willValidate)
  const errors = new Map()
  for (const [fieldIndex, field] of fields.entries()) {
    field.id ||= `form-${index}-field-${fieldIndex}`
    const message = document.createElement('p')
    message.id = `${field.id}-error`
    message.className = 'field-error'
    message.hidden = true
    // Keep errors out of the label so the accessible name stays stable.
    ;(field.closest('label') ?? field).after(message)
    const link = document.createElement('a')
    link.href = `#${field.id}`
    link.addEventListener('click', event => { event.preventDefault(); field.focus() })
    const item = document.createElement('li')
    item.append(link)
    const description = field.getAttribute('aria-describedby')
    const update = () => {
      const invalid = !field.validity.valid
      message.hidden = !invalid
      if (invalid) {
        const label = field.labels?.[0]?.textContent.trim() || field.name
        message.textContent = field.validationMessage
        link.textContent = `${label}: ${field.validationMessage}`
        field.setAttribute('aria-invalid', 'true')
        field.setAttribute('aria-describedby', [description, message.id].filter(Boolean).join(' '))
        if (!item.isConnected) list.append(item)
      } else {
        field.removeAttribute('aria-invalid')
        if (description) field.setAttribute('aria-describedby', description)
        else field.removeAttribute('aria-describedby')
        item.remove()
      }
      summary.hidden = !list.childElementCount
      return !invalid
    }
    errors.set(field, update)
    const correct = () => { if (field.hasAttribute('aria-invalid')) update() }
    field.addEventListener('input', correct)
    field.addEventListener('change', correct)
  }
  form.noValidate = true
  form.addEventListener('submit', event => {
    let valid = true
    for (const update of errors.values()) if (!update()) valid = false
    if (!valid) { event.preventDefault(); summary.focus() }
  })
}
