export function parseLocalDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    const fallbackDate = new Date(date);
    fallbackDate.setHours(0, 0, 0, 0);
    return fallbackDate;
  }

  return new Date(year, month - 1, day);
}

export function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getTodayInputValue() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return toInputDate(today);
}

export function formatLongDate(date: string) {
  if (!date) return "Date non définie";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parseLocalDate(date));
}

export function addMonthsClamped(date: string, monthsToAdd: number) {
  const sourceDate = date ? parseLocalDate(date) : parseLocalDate(getTodayInputValue());
  const targetYear = sourceDate.getFullYear();
  const targetMonth = sourceDate.getMonth() + monthsToAdd;
  const sourceDay = sourceDate.getDate();

  const firstDayOfTargetMonth = new Date(targetYear, targetMonth, 1);
  const lastDayOfTargetMonth = new Date(
    firstDayOfTargetMonth.getFullYear(),
    firstDayOfTargetMonth.getMonth() + 1,
    0
  ).getDate();

  const safeDay = Math.min(sourceDay, lastDayOfTargetMonth);

  return toInputDate(
    new Date(
      firstDayOfTargetMonth.getFullYear(),
      firstDayOfTargetMonth.getMonth(),
      safeDay
    )
  );
}

export function isBeforeInputDate(firstDate: string, secondDate: string) {
  return parseLocalDate(firstDate).getTime() < parseLocalDate(secondDate).getTime();
}
