// Suggest the approved rent in force on the chosen due day; keep a custom amount.
for (const field of document.querySelectorAll('[data-rent-terms]')) {
  const form = field.form
  const due = form.elements.namedItem('dueDate')
  const terms = JSON.parse(field.dataset.rentTerms)
  let edited = false
  field.addEventListener('input', () => { edited = true })
  due.addEventListener('change', () => {
    if (edited) return
    const term = terms.find(term => term.start_date <= due.value && term.end_date >= due.value)
    if (!term) return
    const amount = (term.rent_cents / 100).toFixed(2)
    field.value = amount
  })
}
