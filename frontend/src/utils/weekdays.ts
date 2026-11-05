export const WEEKDAYS = [
  { value: 0, label: "Dush" },
  { value: 1, label: "Sesh" },
  { value: 2, label: "Chor" },
  { value: 3, label: "Pay" },
  { value: 4, label: "Jum" },
  { value: 5, label: "Shan" },
  { value: 6, label: "Yak" },
];

export function formatSchedule(schedule: { weekday: number; start_time: string; end_time: string }[]): string {
  if (schedule.length === 0) return "Jadval belgilanmagan";
  const days = schedule
    .slice()
    .sort((a, b) => a.weekday - b.weekday)
    .map((s) => WEEKDAYS[s.weekday]?.label ?? "")
    .join(", ");
  const { start_time, end_time } = schedule[0];
  return `${days} ${start_time.slice(0, 5)}–${end_time.slice(0, 5)}`;
}
