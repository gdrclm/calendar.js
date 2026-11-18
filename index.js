const STORAGE_KEY = 'calendar-events-v1'

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
const deleteButton = document.getElementById('delete-event')
const cancelButton = document.getElementById('cancel-edit')
const selectedDayList = document.getElementById('selected-day-list')
const selectedDayEmpty = document.getElementById('selected-day-empty')

const today = new Date()

const state = {
  year: today.getFullYear(),
  month: today.getMonth(),
  selected: dateKey(today),
  events: loadEvents(),
  editingId: null
}

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

function formatDay(key, options) {
  return capitalize(parseKey(key).toLocaleDateString('ru-RU', options))
}

function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (event) =>
        event &&
        typeof event.id === 'string' &&
        typeof event.title === 'string' &&
        typeof event.date === 'string'
    )
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

function render() {
  monthTitle.textContent = `${MONTHS[state.month]} ${state.year}`
  todayLabel.textContent = capitalize(
    today.toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  )
  renderGrid()
}

function renderGrid() {
  grid.innerHTML = ''

  const firstDay = new Date(state.year, state.month, 1)
  const offset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate()
  const cellsCount = Math.ceil((offset + daysInMonth) / 7) * 7
  const startDate = new Date(state.year, state.month, 1 - offset)
  const todayKey = dateKey(today)

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
    cell.tabIndex = 0
    cell.setAttribute(
      'aria-label',
      capitalize(
        date.toLocaleDateString('ru-RU', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      )
    )
    cell.setAttribute('aria-selected', String(key === state.selected))

    if (!inMonth) cell.classList.add('day--other')
    if (weekend) cell.classList.add('day--weekend')
    if (key === todayKey) cell.classList.add('day--today')
    if (key === state.selected) cell.classList.add('day--selected')

    const number = document.createElement('span')
    number.className = 'day__number'
    number.textContent = date.getDate()
    cell.append(number)

    const list = document.createElement('div')
    list.className = 'day__events'

    for (const event of eventsForDate(key)) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'event'
      chip.dataset.id = event.id
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
    cell.addEventListener('keydown', (keyboardEvent) => {
      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
        keyboardEvent.preventDefault()
        selectDate(key)
      }
    })

    grid.append(cell)
  }
}

function renderSelectedDay() {
  const events = eventsForDate(state.selected)

  modalTitle.textContent = formatDay(state.selected, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
  selectedDayList.innerHTML = ''
  selectedDayEmpty.hidden = events.length > 0

  for (const event of events) {
    const item = document.createElement('li')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'day-list__item'

    const head = document.createElement('span')
    head.className = 'day-list__head'

    if (event.time) {
      const time = document.createElement('span')
      time.className = 'day-list__time'
      time.textContent = event.time
      head.append(time)
    }

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

function openModal() {
  renderSelectedDay()
  if (!modal.open) modal.showModal()
  titleInput.focus()
}

function closeModal() {
  if (modal.open) modal.close()
  resetForm({ keepDate: true })
}

function selectDate(key) {
  state.selected = key
  resetForm({ keepDate: true })
  renderGrid()
  openModal()
}

function resetForm({ keepDate = false } = {}) {
  state.editingId = null
  form.reset()
  formTitle.textContent = 'Новое событие'
  deleteButton.hidden = true
  formError.hidden = true
  timeInput.value = ''
  dateInput.value = keepDate ? state.selected : ''
}

function startEditing(event) {
  state.editingId = event.id
  state.selected = event.date
  formTitle.textContent = 'Редактирование события'
  titleInput.value = event.title
  dateInput.value = event.date
  timeInput.value = event.time || ''
  descriptionInput.value = event.description || ''
  deleteButton.hidden = false
  formError.hidden = true
  renderGrid()
  openModal()
}

function showError(message) {
  formError.textContent = message
  formError.hidden = false
}

form.addEventListener('submit', (submitEvent) => {
  submitEvent.preventDefault()

  const title = titleInput.value.trim()
  const date = dateInput.value
  const time = timeInput.value
  const description = descriptionInput.value.trim()

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

  if (state.editingId) {
    const target = state.events.find(
      (event) => event.id === state.editingId
    )
    if (target) {
      target.title = title
      target.date = date
      target.time = time
      target.description = description
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
      description
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
})

deleteButton.addEventListener('click', () => {
  if (!state.editingId) return

  const target = state.events.find(
    (event) => event.id === state.editingId
  )
  const label = target ? `«${target.title}»` : 'это событие'

  if (!window.confirm(`Удалить ${label}?`)) return

  state.events = state.events.filter(
    (event) => event.id !== state.editingId
  )
  saveEvents()
  resetForm({ keepDate: true })
  render()
  closeModal()
})

cancelButton.addEventListener('click', closeModal)
closeModalButton.addEventListener('click', closeModal)

modal.addEventListener('click', (clickEvent) => {
  if (clickEvent.target === modal) closeModal()
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
})

function shiftMonth(delta) {
  const shifted = new Date(state.year, state.month + delta, 1)
  state.year = shifted.getFullYear()
  state.month = shifted.getMonth()
  state.selected = dateKey(shifted)
  resetForm({ keepDate: true })
  render()
}

function shiftYear(delta) {
  state.year += delta
  const day = Math.min(parseKey(state.selected).getDate(), daysInYearMonth())
  state.selected = dateKey(new Date(state.year, state.month, day))
  resetForm({ keepDate: true })
  render()
}

function daysInYearMonth() {
  return new Date(state.year, state.month + 1, 0).getDate()
}

render()
