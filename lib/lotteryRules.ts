/**
 * 双色球和大乐透中奖规则匹配逻辑 (根据 2026 年最新官方规则更新)
 */

export type LotteryType = "ssq" | "dlt";

export interface TicketNumbers {
  red: string[];
  blue: string[];
}

export interface OpenNumbers {
  red: string[];
  blue: string[];
}

export interface PrizeLevel {
  level: number;
  name: string;
  redMatch: number;
  blueMatch: number;
  description: string;
}

export interface MatchResult {
  isWinner: boolean;
  prizeLevels: PrizeLevel[];
  redMatch: number;
  blueMatch: number;
  ticketNumbers: TicketNumbers;
  openNumbers: OpenNumbers;
}

/**
 * 双色球中奖规则 (2026-02-01 新规)
 * 红球：6个 (01-33)，蓝球：1个 (01-16)
 */
export function checkSSQWin(
  ticketNumbers: TicketNumbers,
  openNumbers: OpenNumbers,
): MatchResult {
  const ticketRed = ticketNumbers.red.map((n) => n.padStart(2, "0"));
  const ticketBlue = ticketNumbers.blue[0]?.padStart(2, "0") || "";
  const openRed = openNumbers.red.map((n) => n.padStart(2, "0"));
  const openBlue = openNumbers.blue[0]?.padStart(2, "0") || "";

  const redMatch = ticketRed.filter((num) => openRed.includes(num)).length;
  const blueMatch = ticketBlue === openBlue ? 1 : 0;

  const prizeLevels: PrizeLevel[] = [];

  if (redMatch === 6 && blueMatch === 1) {
    prizeLevels.push({
      level: 1,
      name: "一等奖",
      redMatch: 6,
      blueMatch: 1,
      description: "6红 + 1蓝 (全中)",
    });
  } else if (redMatch === 6 && blueMatch === 0) {
    prizeLevels.push({
      level: 2,
      name: "二等奖",
      redMatch: 6,
      blueMatch: 0,
      description: "6红 + 0蓝",
    });
  } else if (redMatch === 5 && blueMatch === 1) {
    prizeLevels.push({
      level: 3,
      name: "三等奖",
      redMatch: 5,
      blueMatch: 1,
      description: "5红 + 1蓝",
    });
  } else if (
    (redMatch === 5 && blueMatch === 0) ||
    (redMatch === 4 && blueMatch === 1)
  ) {
    prizeLevels.push({
      level: 4,
      name: "四等奖",
      redMatch,
      blueMatch,
      description: "5红 + 0蓝 或 4红 + 1蓝",
    });
  } else if (
    (redMatch === 4 && blueMatch === 0) ||
    (redMatch === 3 && blueMatch === 1)
  ) {
    prizeLevels.push({
      level: 5,
      name: "五等奖",
      redMatch,
      blueMatch,
      description: "4红 + 0蓝 或 3红 + 1蓝",
    });
  } else if (blueMatch === 1) {
    // 六等奖：只要中蓝球 (任意红球+1蓝)
    prizeLevels.push({
      level: 6,
      name: "六等奖",
      redMatch,
      blueMatch,
      description: "中蓝球即中",
    });
  } else if (redMatch === 3 && blueMatch === 0) {
    // 2026 新增：福运奖 (3+0)
    prizeLevels.push({
      level: 7,
      name: "福运奖",
      redMatch: 3,
      blueMatch: 0,
      description: "3红 + 0蓝 (奖池≥15亿时生效)",
    });
  }

  return {
    isWinner: prizeLevels.length > 0,
    prizeLevels,
    redMatch,
    blueMatch,
    ticketNumbers,
    openNumbers,
  };
}

/**
 * 大乐透中奖规则 (2026-02-02 最新 7 奖级新规)
 * 前区：5个 (01-35)，后区：2个 (01-12)
 */
export function checkDLTWin(
  ticketNumbers: TicketNumbers,
  openNumbers: OpenNumbers,
): MatchResult {
  const ticketRed = ticketNumbers.red.map((n) => n.padStart(2, "0"));
  const ticketBlue = ticketNumbers.blue.map((n) => n.padStart(2, "0"));
  const openRed = openNumbers.red.map((n) => n.padStart(2, "0"));
  const openBlue = openNumbers.blue.map((n) => n.padStart(2, "0"));

  const redMatch = ticketRed.filter((num) => openRed.includes(num)).length;
  const blueMatch = ticketBlue.filter((num) => openBlue.includes(num)).length;

  const prizeLevels: PrizeLevel[] = [];

  // 1. 一等奖 (5+2)
  if (redMatch === 5 && blueMatch === 2) {
    prizeLevels.push({
      level: 1,
      name: "一等奖",
      redMatch: 5,
      blueMatch: 2,
      description: "5前区 + 2后区",
    });
  }
  // 2. 二等奖 (5+1)
  else if (redMatch === 5 && blueMatch === 1) {
    prizeLevels.push({
      level: 2,
      name: "二等奖",
      redMatch: 5,
      blueMatch: 1,
      description: "5前区 + 1后区",
    });
  }
  // 3. 三等奖 (5+0 或 4+2)
  else if (
    (redMatch === 5 && blueMatch === 0) ||
    (redMatch === 4 && blueMatch === 2)
  ) {
    prizeLevels.push({
      level: 3,
      name: "三等奖",
      redMatch,
      blueMatch,
      description: "5前区+0后区 或 4前区+2后区",
    });
  }
  // 4. 四等奖 (4+1)
  else if (redMatch === 4 && blueMatch === 1) {
    prizeLevels.push({
      level: 4,
      name: "四等奖",
      redMatch: 4,
      blueMatch: 1,
      description: "4前区 + 1后区",
    });
  }
  // 5. 五等奖 (4+0 或 3+2)
  else if (
    (redMatch === 4 && blueMatch === 0) ||
    (redMatch === 3 && blueMatch === 2)
  ) {
    prizeLevels.push({
      level: 5,
      name: "五等奖",
      redMatch,
      blueMatch,
      description: "4前区+0后区 或 3前区+2后区",
    });
  }
  // 6. 六等奖 (3+1 或 2+2)
  else if (
    (redMatch === 3 && blueMatch === 1) ||
    (redMatch === 2 && blueMatch === 2)
  ) {
    prizeLevels.push({
      level: 6,
      name: "六等奖",
      redMatch,
      blueMatch,
      description: "3前区+1后区 或 2前区+2后区",
    });
  }
  // 7. 七等奖 (3+0 / 2+1 / 1+2 / 0+2)
  else if (
    (redMatch === 3 && blueMatch === 0) ||
    (redMatch === 2 && blueMatch === 1) ||
    (redMatch === 1 && blueMatch === 2) ||
    (redMatch === 0 && blueMatch === 2)
  ) {
    prizeLevels.push({
      level: 7,
      name: "七等奖",
      redMatch,
      blueMatch,
      description: "3+0 / 2+1 / 1+2 / 0+2",
    });
  }

  return {
    isWinner: prizeLevels.length > 0,
    prizeLevels,
    redMatch,
    blueMatch,
    ticketNumbers,
    openNumbers,
  };
}

/**
 * 根据彩票类型检查中奖
 */
export function checkWin(
  lotteryType: LotteryType,
  ticketNumbers: TicketNumbers,
  openNumbers: OpenNumbers,
): MatchResult {
  if (lotteryType === "ssq") {
    return checkSSQWin(ticketNumbers, openNumbers);
  } else {
    return checkDLTWin(ticketNumbers, openNumbers);
  }
}
