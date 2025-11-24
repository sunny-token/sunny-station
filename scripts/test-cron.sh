#!/bin/bash

# 测试定时任务脚本
# 使用方法:
#   ./scripts/test-cron.sh                    # 本地测试 (默认 http://localhost:3000)
#   ./scripts/test-cron.sh https://your-app.vercel.app  # 测试生产环境
#   ./scripts/test-cron.sh http://localhost:3000 Bearer your-secret  # 带认证测试

BASE_URL="${1:-http://localhost:3000}"
AUTH_HEADER="${2:-}"

echo "🚀 测试定时任务: $BASE_URL/api/cron/crawler"
echo ""

if [ -n "$AUTH_HEADER" ]; then
  echo "📝 使用认证头: $AUTH_HEADER"
  curl -X GET "$BASE_URL/api/cron/crawler" \
    -H "Authorization: $AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -w "\n\nHTTP Status: %{http_code}\n" \
    -s | (jq '.' 2>/dev/null || cat)
else
  echo "📝 无认证测试 (如果设置了 CRON_SECRET，请使用: ./scripts/test-cron.sh $BASE_URL 'Bearer your-secret')"
  curl -X GET "$BASE_URL/api/cron/crawler" \
    -H "Content-Type: application/json" \
    -w "\n\nHTTP Status: %{http_code}\n" \
    -s | (jq '.' 2>/dev/null || cat)
fi

echo ""
echo "✅ 测试完成"

