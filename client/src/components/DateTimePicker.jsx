import { useEffect, useMemo, useRef, useState } from 'react';

const parseLocalDateTime = (value) => {
  if (!value) return null;
  const [datePart, timePart = '00:00'] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  const date = new Date(year, month - 1, day, hours, minutes);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const formatDateTime = (date, time) => `${formatDate(date)}T${time}`;
const formatTime = (date) => (
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
);
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const sameDay = (first, second) => (
  first?.getFullYear() === second?.getFullYear() &&
  first?.getMonth() === second?.getMonth() &&
  first?.getDate() === second?.getDate()
);

export default function DateTimePicker({ id, value, minValue, onChange }) {
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const selectedDateTime = parseLocalDateTime(value);
  const minDateTime = parseLocalDateTime(minValue);
  const initialDate = selectedDateTime || minDateTime || new Date();
  const defaultTime = (date) => (
    minDateTime && sameDay(date, minDateTime) ? formatTime(minDateTime) : '09:00'
  );
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(initialDate));
  const [draftDate, setDraftDate] = useState(value ? formatDate(initialDate) : '');
  const [draftTime, setDraftTime] = useState(
    selectedDateTime ? formatTime(selectedDateTime) : defaultTime(initialDate),
  );

  const calendarDays = useMemo(() => {
    const firstDay = startOfMonth(visibleMonth);
    const mondayFirstOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      0,
    ).getDate();
    return [
      ...Array(mondayFirstOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [visibleMonth]);

  const selectedDate = draftDate ? parseLocalDateTime(`${draftDate}T00:00`) : null;
  const selectedTime = selectedDate && draftTime
    ? parseLocalDateTime(`${draftDate}T${draftTime}`)
    : null;
  const isBeforeMinimum = (date) => minDateTime && date < minDateTime;
  const firstAllowedMonth = minDateTime ? startOfMonth(minDateTime) : null;

  const closePicker = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) closePicker();
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        closePicker(true);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const openPicker = () => {
    const currentValue = parseLocalDateTime(value);
    const startDate = currentValue || minDateTime || new Date();
    setVisibleMonth(startOfMonth(startDate));
    setDraftDate(currentValue ? formatDate(currentValue) : '');
    setDraftTime(currentValue ? formatTime(currentValue) : defaultTime(startDate));
    setOpen(true);
  };

  const changeMonth = (offset) => {
    setVisibleMonth((current) => new Date(
      current.getFullYear(),
      current.getMonth() + offset,
      1,
    ));
  };

  const done = () => {
    if (!selectedDate || !selectedTime || isBeforeMinimum(selectedTime)) return;
    onChange(formatDateTime(selectedDate, draftTime));
    closePicker(true);
  };

  const selectDay = (dateValue) => {
    setDraftDate(dateValue);
    if (!value) {
      const date = parseLocalDateTime(`${dateValue}T00:00`);
      setDraftTime(defaultTime(date));
    }
  };

  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(visibleMonth);
  const displayValue = selectedDateTime
    ? new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(selectedDateTime)
    : 'Choose date and time';

  return (
    <div className="date-time-picker" ref={containerRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`date-time-picker-trigger${value ? ' has-value' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${id}-dialog`}
        onClick={() => (open ? closePicker() : openPicker())}
      >
        <span>{displayValue}</span>
        <span className="date-time-picker-icon" aria-hidden="true">▦</span>
      </button>

      {open && (
        <section
          id={`${id}-dialog`}
          className="date-time-picker-popover"
          role="dialog"
          aria-modal="false"
          aria-label="Choose interview date and time"
        >
          <div className="date-time-picker-month">
            <button
              type="button"
              className="date-time-picker-nav"
              aria-label="Previous month"
              disabled={Boolean(firstAllowedMonth && visibleMonth <= firstAllowedMonth)}
              onClick={() => changeMonth(-1)}
            >
              ‹
            </button>
            <strong aria-live="polite">{monthLabel}</strong>
            <button
              type="button"
              className="date-time-picker-nav"
              aria-label="Next month"
              onClick={() => changeMonth(1)}
            >
              ›
            </button>
          </div>

          <div className="date-time-picker-calendar" aria-label={monthLabel}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <span className="date-time-picker-weekday" key={day}>
                {day}
              </span>
            ))}
            {calendarDays.map((day, index) => {
              if (!day) {
                return <span className="date-time-picker-empty-day" key={`empty-${index}`} />;
              }
              const date = new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth(),
                day,
              );
              const dateValue = formatDate(date);
              return (
                <button
                  type="button"
                  className={`date-time-picker-day${draftDate === dateValue ? ' is-selected' : ''}`}
                  key={dateValue}
                  aria-pressed={draftDate === dateValue}
                  aria-label={new Intl.DateTimeFormat(undefined, {
                    dateStyle: 'full',
                  }).format(date)}
                  disabled={Boolean(minDateTime && date < new Date(
                    minDateTime.getFullYear(),
                    minDateTime.getMonth(),
                    minDateTime.getDate(),
                  ))}
                  onClick={() => selectDay(dateValue)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <label className="date-time-picker-time" htmlFor={`${id}-time`}>
            Time
            <input
              id={`${id}-time`}
              type="time"
              value={draftTime}
              onChange={(event) => setDraftTime(event.target.value)}
            />
          </label>

          {selectedTime && isBeforeMinimum(selectedTime) && (
            <p className="date-time-picker-error" role="alert">
              Choose a time in the future.
            </p>
          )}

          <div className="date-time-picker-actions">
            <button type="button" className="btn ghost small" onClick={() => closePicker(true)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn small"
              onClick={done}
              disabled={!selectedDate || !selectedTime || isBeforeMinimum(selectedTime)}
            >
              Done
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
