import type { Title } from "@/lib/contracts/game";

export function getTitlePresentation(title: Title) {
  switch (title) {
    case "chief_operator":
      return { line: "01", isTop: true, tone: "amber" as const };
    case "senior_operator":
      return { line: "02", isTop: false, tone: "neutral" as const };
    case "operator":
      return { line: "03", isTop: false, tone: "neutral" as const };
    case "trainee":
      return { line: "04", isTop: false, tone: "neutral" as const };
    case "off_the_board":
      return { line: "—", isTop: false, tone: "neutral" as const };
  }
}
