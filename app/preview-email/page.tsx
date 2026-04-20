import { generateMultipleWinnersEmailHTML } from "@/lib/emailService";
import { MatchResult } from "@/lib/lotteryRules";

export default function PreviewEmail() {
  const mockNotification = {
    lotteryType: "dlt" as const,
    issueNumber: "23126",
    openDate: "2023-11-20",
    openNumbers: {
      red: ["01", "07", "09", "15", "23"],
      blue: ["03", "12"],
    },
    jackpot: "80,000,000元",
    prizeDetails: {
      "一等奖": "10000000",
      "三等奖": "3000",
    },
    winners: [
      {
        ticketName: "守号策略A (家人生日)",
        matchResult: {
          isWinner: true,
          redMatch: 5,
          blueMatch: 2,
          prizeLevels: [
            {
              name: "一等奖",
              description: "匹配5个红球+2个蓝球",
              redMatch: 5,
              blueMatch: 2,
            },
          ],
          ticketNumbers: {
            red: ["01", "07", "09", "15", "23"],
            blue: ["03", "12"],
          },
        } as MatchResult,
      },
      {
        ticketName: "机选防守注",
        matchResult: {
          isWinner: true,
          redMatch: 4,
          blueMatch: 0,
          prizeLevels: [
            {
              name: "七等奖",
              description: "匹配4个红球",
              redMatch: 4,
              blueMatch: 0,
            },
          ],
          ticketNumbers: {
            red: ["01", "07", "09", "15", "30"],
            blue: ["01", "02"],
          },
        } as MatchResult,
      },
    ],
  };

  const html = generateMultipleWinnersEmailHTML(mockNotification);

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center">
      <div className="mb-6 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg text-sm border border-yellow-200">
        📌 这是邮件 HTML 的实时浏览器预览效果。由于邮件客户端的渲染限制，实际收到时的字体可能会根据设备不同而稍有差异。
      </div>
      <div
        className="w-full max-w-[600px] border shadow-2xl rounded-2xl overflow-hidden bg-white"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
