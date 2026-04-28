const TZ = "Africa/Johannesburg";

export function nowInSAST(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}

export function todayInSAST(): string {
  return nowInSAST().toISOString().split("T")[0];
}

export function formatSASTDate(date: Date): string {
  return date.toLocaleDateString("en-ZA", {
    timeZone: TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatSASTTime(date: Date): string {
  return date.toLocaleTimeString("en-ZA", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function isSameDay(a: string, b: string): boolean {
  return a.split("T")[0] === b.split("T")[0];
}

export function daysBetween(from: string, to: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / msPerDay
  );
}

export function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
