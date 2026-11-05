// Suggest the approved rent in force on the chosen due day; keep a custom amount.
for (const field of document.querySelectorAll('[data-rent-terms]')) {
  const form = field.form
  const due = form.elements.namedItem('dueDate')
  const terms = JSON.parse(field.dataset.rentTerms)
  let suggested = field.value
  due.addEventListener('change', () => {
    const term = terms.find(term => term.start_date <= due.value && term.end_date >= due.value)
    if (!term) return
    const amount = (term.rent_cents / 100).toFixed(2)
    if (Number(field.value) === Number(suggested)) field.value = amount
    suggested = amount
  })
}
