/**
 * 双色球和大乐透中奖规则匹配逻辑
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
 * 双色球中奖规则
 * 红球：6个，从01-33中选择
 * 蓝球：1个，从01-16中选择
 */
export function checkSSQWin(
  ticketNumbers: TicketNumbers,
  openNumbers: OpenNumbers,
): MatchResult {
  const ticketRed = ticketNumbers.red.map((n) => n.padStart(2, "0"));
  const ticketBlue = ticketNumbers.blue[0]?.padStart(2, "0") || "";
  const openRed = openNumbers.red.map((n) => n.padStart(2, "0"));
  const openBlue = openNumbers.blue[0]?.padStart(2, "0") || "";

  // 计算红球匹配数
  const redMatch = ticketRed.filter((num) => openRed.includes(num)).length;
  // 计算蓝球匹配数
  const blueMatch = ticketBlue === openBlue ? 1 : 0;

  const prizeLevels: PrizeLevel[] = [];

  // 双色球中奖规则
  if (redMatch === 6 && blueMatch === 1) {
    prizeLevels.push({
      level: 1,
      name: "一等奖",
      redMatch: 6,
      blueMatch: 1,
      description: "6个红球 + 1个蓝球",
    });
  } else if (redMatch === 6 && blueMatch === 0) {
    prizeLevels.push({
      level: 2,
      name: "二等奖",
      redMatch: 6,
      blueMatch: 0,
      description: "6个红球",
    });
  } else if (redMatch === 5 && blueMatch === 1) {
    prizeLevels.push({
      level: 3,
      name: "三等奖",
      redMatch: 5,
      blueMatch: 1,
      description: "5个红球 + 1个蓝球",
    });
  } else if (redMatch === 5 && blueMatch === 0) {
    prizeLevels.push({
      level: 4,
      name: "四等奖",
      redMatch: 5,
      blueMatch: 0,
      description: "5个红球 或 4个红球 + 1个蓝球",
    });
  } else if (redMatch === 4 && blueMatch === 1) {
    prizeLevels.push({
      level: 4,
      name: "四等奖",
      redMatch: 4,
      blueMatch: 1,
      description: "5个红球 或 4个红球 + 1个蓝球",
    });
  } else if (redMatch === 4 && blueMatch === 0) {
    prizeLevels.push({
      level: 5,
      name: "五等奖",
      redMatch: 4,
      blueMatch: 0,
      description: "4个红球 或 3个红球 + 1个蓝球",
    });
  } else if (redMatch === 3 && blueMatch === 1) {
    prizeLevels.push({
      level: 5,
      name: "五等奖",
      redMatch: 3,
      blueMatch: 1,
      description: "4个红球 或 3个红球 + 1个蓝球",
    });
  } else if (redMatch === 2 && blueMatch === 1) {
    prizeLevels.push({
      level: 6,
      name: "六等奖",
      redMatch: 2,
      blueMatch: 1,
      description: "2个红球 + 1个蓝球 或 1个红球 + 1个蓝球 或 0个红球 + 1个蓝球",
    });
  } else if (redMatch === 1 && blueMatch === 1) {
    prizeLevels.push({
      level: 6,
      name: "六等奖",
      redMatch: 1,
      blueMatch: 1,
      description: "2个红球 + 1个蓝球 或 1个红球 + 1个蓝球 或 0个红球 + 1个蓝球",
    });
  } else if (redMatch === 0 && blueMatch === 1) {
    prizeLevels.push({
      level: 6,
      name: "六等奖",
      redMatch: 0,
      blueMatch: 1,
      description: "2个红球 + 1个蓝球 或 1个红球 + 1个蓝球 或 0个红球 + 1个蓝球",
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
 * 大乐透中奖规则
 * 红球：5个，从01-35中选择
 * 蓝球：2个，从01-12中选择
 */
export function checkDLTWin(
  ticketNumbers: TicketNumbers,
  openNumbers: OpenNumbers,
): MatchResult {
  const ticketRed = ticketNumbers.red.map((n) => n.padStart(2, "0"));
  const ticketBlue = ticketNumbers.blue.map((n) => n.padStart(2, "0"));
  const openRed = openNumbers.red.map((n) => n.padStart(2, "0"));
  const openBlue = openNumbers.blue.map((n) => n.padStart(2, "0"));

  // 计算红球匹配数
  const redMatch = ticketRed.filter((num) => openRed.includes(num)).length;
  // 计算蓝球匹配数
  const blueMatch = ticketBlue.filter((num) => openBlue.includes(num)).length;

  const prizeLevels: PrizeLevel[] = [];

  // 大乐透中奖规则
  if (redMatch === 5 && blueMatch === 2) {
    prizeLevels.push({
      level: 1,
      name: "一等奖",
      redMatch: 5,
      blueMatch: 2,
      description: "5个红球 + 2个蓝球",
    });
  } else if (redMatch === 5 && blueMatch === 1) {
    prizeLevels.push({
      level: 2,
      name: "二等奖",
      redMatch: 5,
      blueMatch: 1,
      description: "5个红球 + 1个蓝球",
    });
  } else if (redMatch === 5 && blueMatch === 0) {
    prizeLevels.push({
      level: 3,
      name: "三等奖",
      redMatch: 5,
      blueMatch: 0,
      description: "5个红球",
    });
  } else if (redMatch === 4 && blueMatch === 2) {
    prizeLevels.push({
      level: 3,
      name: "三等奖",
      redMatch: 4,
      blueMatch: 2,
      description: "5个红球 或 4个红球 + 2个蓝球",
    });
  } else if (redMatch === 4 && blueMatch === 1) {
    prizeLevels.push({
      level: 4,
      name: "四等奖",
      redMatch: 4,
      blueMatch: 1,
      description: "4个红球 + 1个蓝球",
    });
  } else if (redMatch === 3 && blueMatch === 2) {
    prizeLevels.push({
      level: 4,
      name: "四等奖",
      redMatch: 3,
      blueMatch: 2,
      description: "4个红球 + 1个蓝球 或 3个红球 + 2个蓝球",
    });
  } else if (redMatch === 4 && blueMatch === 0) {
    prizeLevels.push({
      level: 5,
      name: "五等奖",
      redMatch: 4,
      blueMatch: 0,
      description: "4个红球",
    });
  } else if (redMatch === 3 && blueMatch === 1) {
    prizeLevels.push({
      level: 5,
      name: "五等奖",
      redMatch: 3,
      blueMatch: 1,
      description: "4个红球 或 3个红球 + 1个蓝球",
    });
  } else if (redMatch === 2 && blueMatch === 2) {
    prizeLevels.push({
      level: 5,
      name: "五等奖",
      redMatch: 2,
      blueMatch: 2,
      description: "4个红球 或 3个红球 + 1个蓝球 或 2个红球 + 2个蓝球",
    });
  } else if (redMatch === 3 && blueMatch === 0) {
    prizeLevels.push({
      level: 6,
      name: "六等奖",
      redMatch: 3,
      blueMatch: 0,
      description: "3个红球",
    });
  } else if (redMatch === 1 && blueMatch === 2) {
    prizeLevels.push({
      level: 6,
      name: "六等奖",
      redMatch: 1,
      blueMatch: 2,
      description: "3个红球 或 1个红球 + 2个蓝球",
    });
  } else if (redMatch === 2 && blueMatch === 1) {
    prizeLevels.push({
      level: 6,
      name: "六等奖",
      redMatch: 2,
      blueMatch: 1,
      description: "3个红球 或 1个红球 + 2个蓝球 或 2个红球 + 1个蓝球",
    });
  } else if (redMatch === 0 && blueMatch === 2) {
    prizeLevels.push({
      level: 6,
      name: "六等奖",
      redMatch: 0,
      blueMatch: 2,
      description: "3个红球 或 1个红球 + 2个蓝球 或 2个红球 + 1个蓝球 或 0个红球 + 2个蓝球",
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

