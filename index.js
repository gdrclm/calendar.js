const STORAGE_KEY = 'calendar-events-v1'
const MAX_SEARCH_RESULTS = 20

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь'
]

const CATEGORY_IDS = ['work', 'personal', 'study', 'important']
const DEFAULT_CATEGORY = 'work'

const grid = document.getElementById('calendar-grid')
const monthTitle = document.getElementById('month-title')
const todayLabel = document.getElementById('today-label')
const modal = document.getElementById('event-modal')
const modalTitle = document.getElementById('event-modal-title')
const closeModalButton = document.getElementById('close-modal')
const form = document.getElementById('event-form')
const formTitle = document.getElementById('form-title')
const titleInput = document.getElementById('event-title')
const dateInput = document.getElementById('event-date')
const timeInput = document.getElementById('event-time')
const descriptionInput = document.getElementById('event-description')
const formError = document.getElementById('form-error')
const formActions = document.getElementById('form-actions')
const deleteButton = document.getElementById('delete-event')
const cancelButton = document.getElementById('cancel-edit')
const deleteConfirm = document.getElementById('delete-confirm')
const deleteConfirmText = document.getElementById('delete-confirm-text')
const confirmDeleteButton = document.getElementById('confirm-delete')
const cancelDeleteButton = document.getElementById('cancel-delete')
const selectedDayList = document.getElementById('selected-day-list')
const selectedDayEmpty = document.getElementById('selected-day-empty')
const searchInput = document.getElementById('event-search')
const searchResults = document.getElementById('search-results')
const toastContainer = document.getElementById('toasts')

const today = new Date()

const state = {
  year: today.getFullYear(),
  month: today.getMonth(),
  selected: dateKey(today),
  events: loadEvents(),
  editingId: null
}

let pendingDelete = null

function pad(value) {
  return String(value).padStart(2, '0')
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`
}

function parseKey(key) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function normalizeCategory(category) {
  return CATEGORY_IDS.includes(category) ? category : DEFAULT_CATEGORY
}

function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (event) =>
          event &&
          typeof event.id === 'string' &&
          typeof event.title === 'string' &&
          typeof event.date === 'string'
      )
      .map((event) => ({
        ...event,
        category: normalizeCategory(event.category)
      }))
  } catch (error) {
    console.warn('Не удалось прочитать события:', error)
    return []
  }
}

function saveEvents() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events))
  } catch (error) {
    console.warn('Не удалось сохранить события:', error)
  }
}

function eventsForDate(key) {
  return state.events
    .filter((event) => event.date === key)
    .sort((a, b) => {
      const timeA = a.time || '99:99'
      const timeB = b.time || '99:99'
      return timeA.localeCompare(timeB) || a.title.localeCompare(b.title)
    })
}

function formatDateLabel(date) {
  return capitalize(
    date.toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  )
}

function render() {
  monthTitle.textContent = `${MONTHS[state.month]} ${state.year}`
  todayLabel.textContent = formatDateLabel(today)
  renderGrid()
  refreshSearchIfOpen()
}

function renderGrid() {
  grid.innerHTML = ''

  const firstDay = new Date(state.year, state.month, 1)
  const offset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate()
  const cellsCount = Math.ceil((offset + daysInMonth) / 7) * 7
  const startDate = new Date(state.year, state.month, 1 - offset)
  const todayKey = dateKey(today)
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )

  grid.style.gridTemplateRows = `repeat(${cellsCount / 7}, minmax(0, 1fr))`

  for (let index = 0; index < cellsCount; index++) {
    const date = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + index
    )
    const key = dateKey(date)
    const inMonth = date.getMonth() === state.month
    const weekend = date.getDay() === 0 || date.getDay() === 6

    const cell = document.createElement('div')
    cell.className = 'day'
    cell.setAttribute('role', 'gridcell')
    cell.dataset.date = key
    cell.tabIndex = key === state.selected ? 0 : -1
    cell.setAttribute('aria-label', formatDateLabel(date))
    cell.setAttribute('aria-selected', String(key === state.selected))

    if (!inMonth) cell.classList.add('day--other')
    if (weekend) cell.classList.add('day--weekend')
    if (date < todayStart) cell.classList.add('day--past')
    if (key === todayKey) cell.classList.add('day--today')
    if (key === state.selected) cell.classList.add('day--selected')

    const head = document.createElement('div')
    head.className = 'day__head'

    const number = document.createElement('span')
    number.className = 'day__number'
    number.textContent = date.getDate()

    const addButton = document.createElement('button')
    addButton.type = 'button'
    addButton.className = 'day__add'
    addButton.tabIndex = -1
    addButton.textContent = '+'
    addButton.title = `Добавить событие на ${date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long'
    })}`
    addButton.setAttribute(
      'aria-label',
      `Добавить событие на ${formatDateLabel(date)}`
    )
    addButton.addEventListener('click', (clickEvent) => {
      clickEvent.stopPropagation()
      selectDate(key, { create: true })
    })

    head.append(number, addButton)
    cell.append(head)

    const list = document.createElement('div')
    list.className = 'day__events'

    for (const event of eventsForDate(key)) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'event'
      chip.dataset.id = event.id
      chip.dataset.category = event.category
      chip.title = [event.time, event.title, event.description]
        .filter(Boolean)
        .join(' · ')

      if (event.time) {
        const time = document.createElement('span')
        time.className = 'event__time'
        time.textContent = `${event.time} `
        chip.append(time)
      }

      chip.append(document.createTextNode(event.title))
      chip.addEventListener('click', (clickEvent) => {
        clickEvent.stopPropagation()
        startEditing(event)
      })
      list.append(chip)
    }

    cell.append(list)
    cell.addEventListener('click', () => selectDate(key))
    cell.addEventListener('dblclick', () => selectDate(key, { create: true }))
    cell.addEventListener('keydown', (keyboardEvent) => {
      const moves = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -7,
        ArrowDown: 7
      }

      if (keyboardEvent.key in moves) {
        keyboardEvent.preventDefault()
        const target = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate() + moves[keyboardEvent.key]
        )
        focusDate(target)
        return
      }

      if (keyboardEvent.key === 'Home' || keyboardEvent.key === 'End') {
        keyboardEvent.preventDefault()
        const weekdayIndex = (date.getDay() + 6) % 7
        const target = new Date(date)
        target.setDate(
          date.getDate() +
            (keyboardEvent.key === 'Home' ? -weekdayIndex : 6 - weekdayIndex)
        )
        focusDate(target)
        return
      }

      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
        keyboardEvent.preventDefault()
        selectDate(key)
      }
    })

    grid.append(cell)
  }
}

function focusDay(key) {
  const cell = grid.querySelector(`.day[data-date="${key}"]`)
  if (cell) cell.focus({ preventScroll: true })
}

function focusDate(date) {
  if (date.getFullYear() !== state.year || date.getMonth() !== state.month) {
    state.year = date.getFullYear()
    state.month = date.getMonth()
    render()
  }
  focusDay(dateKey(date))
}

function renderSelectedDay() {
  const events = eventsForDate(state.selected)

  const selectedDate = parseKey(state.selected)
  modalTitle.textContent = `${selectedDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long'
  })}, ${selectedDate.toLocaleDateString('ru-RU', { weekday: 'long' })}`
  selectedDayList.innerHTML = ''
  selectedDayEmpty.hidden = events.length > 0

  for (const event of events) {
    const item = document.createElement('li')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'day-list__item'
    button.dataset.category = event.category

    const head = document.createElement('span')
    head.className = 'day-list__head'

    if (event.time) {
      const time = document.createElement('span')
      time.className = 'day-list__time'
      time.textContent = event.time
      head.append(time)
    }

    const dot = document.createElement('span')
    dot.className = 'day-list__dot'
    dot.dataset.category = event.category
    head.append(dot)

    const title = document.createElement('span')
    title.className = 'day-list__title'
    title.textContent = event.title
    head.append(title)

    button.append(head)

    if (event.description) {
      const description = document.createElement('span')
      description.className = 'day-list__description'
      description.textContent = event.description
      button.append(description)
    }

    button.addEventListener('click', () => startEditing(event))
    item.append(button)
    selectedDayList.append(item)
  }
}

function openModal({ create = false } = {}) {
  renderSelectedDay()
  if (!modal.open) modal.showModal()
  if (create) titleInput.focus()
  else modal.focus()
}

function closeModal() {
  if (modal.open) modal.close()
}

function selectDate(key, { create = false } = {}) {
  state.selected = key
  resetForm({ keepDate: true })
  renderGrid()
  openModal({ create })
}

function resetForm({ keepDate = false } = {}) {
  state.editingId = null
  pendingDelete = null
  form.reset()
  formTitle.textContent = 'Новое событие'
  deleteButton.hidden = true
  formError.hidden = true
  setDeleteConfirm(false)
  timeInput.value = ''
  dateInput.value = keepDate ? state.selected : ''
  setCategory(DEFAULT_CATEGORY)
}

function setCategory(category) {
  const input = form.querySelector(
    `input[name="category"][value="${normalizeCategory(category)}"]`
  )
  if (input) input.checked = true
}

function getCategory() {
  const checked = form.querySelector('input[name="category"]:checked')
  return normalizeCategory(checked ? checked.value : DEFAULT_CATEGORY)
}

function setDeleteConfirm(open) {
  deleteConfirm.hidden = !open
  formActions.hidden = open
  if (open) confirmDeleteButton.focus()
}

function startEditing(event) {
  state.editingId = event.id
  state.selected = event.date
  formTitle.textContent = 'Редактирование события'
  titleInput.value = event.title
  dateInput.value = event.date
  timeInput.value = event.time || ''
  descriptionInput.value = event.description || ''
  setCategory(event.category)
  deleteButton.hidden = false
  formError.hidden = true
  setDeleteConfirm(false)
  renderGrid()
  openModal()
}

function showError(message) {
  formError.textContent = message
  formError.hidden = false
}

function isTypingTarget(target) {
  return Boolean(
    target &&
      target.closest &&
      target.closest('input, textarea, select, [contenteditable="true"]')
  )
}

function searchMatches() {
  const query = searchInput.value.trim().toLowerCase()
  if (!query) return []

  return state.events
    .filter((event) => event.title.toLowerCase().includes(query))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time || '99:99').localeCompare(b.time || '99:99') ||
        a.title.localeCompare(b.title)
    )
}

function renderSearchResults() {
  const query = searchInput.value.trim()

  if (!query) {
    closeSearchResults()
    return
  }

  const matches = searchMatches()

  searchResults.innerHTML = ''
  searchResults.hidden = false

  if (!matches.length) {
    const empty = document.createElement('p')
    empty.className = 'search__empty'
    empty.textContent = `Ничего не найдено по запросу «${query}».`
    searchResults.append(empty)
    return
  }

  const count = document.createElement('p')
  count.className = 'search__count'
  count.textContent =
    matches.length > MAX_SEARCH_RESULTS
      ? `Найдено: ${matches.length} · показаны первые ${MAX_SEARCH_RESULTS}`
      : `Найдено: ${matches.length}`
  searchResults.append(count)

  for (const event of matches.slice(0, MAX_SEARCH_RESULTS)) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'search__item'
    item.dataset.category = event.category

    const dot = document.createElement('span')
    dot.className = 'search__dot'
    dot.dataset.category = event.category

    const date = document.createElement('span')
    date.className = 'search__date'
    date.textContent = parseKey(event.date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })

    const title = document.createElement('span')
    title.className = 'search__title'
    title.textContent = event.title

    item.append(dot, date, title)

    if (event.time) {
      const time = document.createElement('span')
      time.className = 'search__time'
      time.textContent = event.time
      item.append(time)
    }

    item.addEventListener('click', () => openEvent(event))
    searchResults.append(item)
  }
}

function refreshSearchIfOpen() {
  if (!searchResults.hidden) renderSearchResults()
}

function closeSearchResults() {
  searchResults.hidden = true
  searchResults.innerHTML = ''
}

function closeSearch() {
  searchInput.value = ''
  closeSearchResults()
}

function openEvent(event) {
  const date = parseKey(event.date)
  state.year = date.getFullYear()
  state.month = date.getMonth()
  state.selected = event.date
  closeSearch()
  startEditing(event)
}

function showToast(message, { actionLabel, onAction, duration = 4000 } = {}) {
  while (toastContainer.children.length >= 3) {
    toastContainer.firstElementChild.remove()
  }

  const toast = document.createElement('div')
  toast.className = 'toast'

  const text = document.createElement('span')
  text.className = 'toast__text'
  text.textContent = message
  toast.append(text)

  let timer = setTimeout(remove, duration)

  function remove() {
    clearTimeout(timer)
    if (!toast.isConnected) return
    toast.classList.add('toast--leave')
    setTimeout(() => toast.remove(), 180)
  }

  if (actionLabel) {
    const action = document.createElement('button')
    action.type = 'button'
    action.className = 'toast__action'
    action.textContent = actionLabel
    action.addEventListener('click', () => {
      remove()
      if (onAction) onAction()
    })
    toast.append(action)

    toast.addEventListener('mouseenter', () => clearTimeout(timer))
    toast.addEventListener('mouseleave', () => {
      timer = setTimeout(remove, 2000)
    })
  }

  toastContainer.append(toast)
}

function performDelete(target) {
  if (!target) return

  const index = state.events.findIndex((event) => event.id === target.id)
  if (index === -1) return

  state.events.splice(index, 1)
  saveEvents()

  setDeleteConfirm(false)
  resetForm({ keepDate: true })
  render()
  closeModal()

  showToast(`«${target.title}» удалено`, {
    actionLabel: 'Отменить',
    duration: 7000,
    onAction: () => {
      state.events.splice(
        Math.min(index, state.events.length),
        0,
        target
      )
      saveEvents()
      render()
      showToast('Удаление отменено')
    }
  })
}

form.addEventListener('submit', (submitEvent) => {
  submitEvent.preventDefault()

  const title = titleInput.value.trim()
  const date = dateInput.value
  const time = timeInput.value
  const description = descriptionInput.value.trim()
  const category = getCategory()

  if (!title) {
    showError('Введите название события.')
    titleInput.focus()
    return
  }

  if (!date) {
    showError('Выберите дату события.')
    dateInput.focus()
    return
  }

  formError.hidden = true

  const wasEditing = Boolean(state.editingId)

  if (wasEditing) {
    const target = state.events.find(
      (event) => event.id === state.editingId
    )
    if (target) {
      target.title = title
      target.date = date
      target.time = time
      target.description = description
      target.category = category
    }
  } else {
    state.events.push({
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      date,
      time,
      description,
      category
    })
  }

  saveEvents()

  const parsedDate = parseKey(date)
  state.year = parsedDate.getFullYear()
  state.month = parsedDate.getMonth()
  state.selected = date

  resetForm({ keepDate: true })
  render()
  closeModal()

  showToast(wasEditing ? 'Событие обновлено' : 'Событие сохранено')
})

deleteButton.addEventListener('click', () => {
  if (!state.editingId) return

  pendingDelete =
    state.events.find((event) => event.id === state.editingId) || null

  deleteConfirmText.textContent = pendingDelete
    ? `Удалить «${pendingDelete.title}»?`
    : 'Удалить это событие?'
  setDeleteConfirm(true)
})

confirmDeleteButton.addEventListener('click', () => {
  performDelete(pendingDelete)
})

cancelDeleteButton.addEventListener('click', () => {
  pendingDelete = null
  setDeleteConfirm(false)
  deleteButton.focus()
})

cancelButton.addEventListener('click', closeModal)
closeModalButton.addEventListener('click', closeModal)

modal.addEventListener('click', (clickEvent) => {
  if (clickEvent.target === modal) closeModal()
})

modal.addEventListener('close', () => {
  resetForm({ keepDate: true })
  refreshSearchIfOpen()
  focusDay(state.selected)
})

document.getElementById('prev-month').addEventListener('click', () => {
  shiftMonth(-1)
})

document.getElementById('next-month').addEventListener('click', () => {
  shiftMonth(1)
})

document.getElementById('prev-year').addEventListener('click', () => {
  shiftYear(-1)
})

document.getElementById('next-year').addEventListener('click', () => {
  shiftYear(1)
})

document.getElementById('today-btn').addEventListener('click', () => {
  state.year = today.getFullYear()
  state.month = today.getMonth()
  state.selected = dateKey(today)
  resetForm({ keepDate: true })
  render()
  focusDay(state.selected)
})

searchInput.addEventListener('input', renderSearchResults)
searchInput.addEventListener('focus', () => {
  if (searchInput.value.trim()) renderSearchResults()
})

searchInput.addEventListener('keydown', (keyboardEvent) => {
  if (keyboardEvent.key === 'Escape') {
    keyboardEvent.preventDefault()
    closeSearch()
    return
  }

  const firstResult = searchResults.querySelector('.search__item')

  if (
    (keyboardEvent.key === 'Enter' || keyboardEvent.key === 'ArrowDown') &&
    firstResult
  ) {
    keyboardEvent.preventDefault()
    if (keyboardEvent.key === 'Enter') firstResult.click()
    else firstResult.focus()
  }
})

searchResults.addEventListener('keydown', (keyboardEvent) => {
  if (keyboardEvent.key === 'Escape') {
    keyboardEvent.preventDefault()
    closeSearch()
    searchInput.focus()
  }
})

document.addEventListener('click', (clickEvent) => {
  if (!clickEvent.target.closest('.search')) closeSearchResults()
})

document.addEventListener('keydown', (keyboardEvent) => {
  if (modal.open || isTypingTarget(keyboardEvent.target)) return

  if (keyboardEvent.key === '/') {
    keyboardEvent.preventDefault()
    searchInput.focus()
    searchInput.select()
    return
  }

  if (keyboardEvent.key === 'n' || keyboardEvent.key === 'N') {
    keyboardEvent.preventDefault()
    selectDate(state.selected, { create: true })
  }
})

function shiftMonth(delta) {
  const shifted = new Date(state.year, state.month + delta, 1)
  state.year = shifted.getFullYear()
  state.month = shifted.getMonth()
  state.selected = dateKey(shifted)
  resetForm({ keepDate: true })
  render()
  focusDay(state.selected)
}

function shiftYear(delta) {
  state.year += delta
  const day = Math.min(parseKey(state.selected).getDate(), daysInYearMonth())
  state.selected = dateKey(new Date(state.year, state.month, day))
  resetForm({ keepDate: true })
  render()
  focusDay(state.selected)
}

function daysInYearMonth() {
  return new Date(state.year, state.month + 1, 0).getDate()
}

render()
