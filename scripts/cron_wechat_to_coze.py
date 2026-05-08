#!/usr/bin/env python3
"""
每日定时脚本：14:00 并发调用 wechat-to-coze 和 wechat-to-coze-github 两个接口

依赖安装:
    pip install httpx schedule

用法:
    python cron_wechat_to_coze.py
"""

import logging
import sys
import threading
import time
from datetime import datetime

import httpx
import schedule

# ─── 配置 ────────────────────────────────────────────────────────────────────
BASE_URL = "https://www.sunhua.fun"
RUN_AT = "14:00"  # 每天执行时间（本地时间，24小时制）

# ─── 日志配置 ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("cron_wechat_to_coze.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)


# ─── 通用 SSE 消费函数 ───────────────────────────────────────────────────────
def _call_sse_endpoint(label: str, endpoint: str, payload: dict) -> None:
    headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }
    log.info(f"{label} 开始调用 → {endpoint}")
    try:
        with httpx.Client(
            timeout=httpx.Timeout(connect=10.0, read=600.0, write=30.0, pool=5.0)
        ) as client:
            with client.stream("POST", endpoint, json=payload, headers=headers) as resp:
                if resp.status_code != 200:
                    body = resp.read().decode("utf-8", errors="replace")
                    log.error(f"{label} 非200响应: {resp.status_code} — {body}")
                    return

                log.info(f"{label} 连接成功，消费 SSE 流中...")
                event_count = 0
                for raw_line in resp.iter_lines():
                    line = raw_line.strip()
                    if not line:
                        continue
                    if line.startswith("data:"):
                        event_count += 1
                        log.info(f"{label} [#{event_count}] {line[5:].strip()[:200]}")
                    elif line.startswith("event:"):
                        log.info(f"{label} {line}")

                log.info(f"{label} 流结束，共 {event_count} 条事件")

    except httpx.ConnectError as e:
        log.error(f"{label} 连接失败: {e}")
    except httpx.ReadTimeout:
        log.error(f"{label} 读取超时（>600s）")
    except Exception as e:
        log.exception(f"{label} 异常: {e}")


# ─── 两个任务 ────────────────────────────────────────────────────────────────
def task_wechat() -> None:
    _call_sse_endpoint(
        label="[职场]",
        endpoint=f"{BASE_URL}/api/cron/wechat-to-coze",
        payload={"track": "职场"},
    )


def task_github() -> None:
    _call_sse_endpoint(
        label="[GitHub]",
        endpoint=f"{BASE_URL}/api/cron/wechat-to-coze-github",
        payload={"track": "GitHub", "enableCoze": True},
    )


# ─── 并发执行 ────────────────────────────────────────────────────────────────
def run_all_jobs() -> None:
    log.info("=" * 60)
    log.info(f"每日任务触发 | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    threads = [
        threading.Thread(target=task_wechat, name="职场", daemon=True),
        threading.Thread(target=task_github, name="GitHub", daemon=True),
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    log.info("所有任务执行完毕")
    log.info("=" * 60)


# ─── 主循环 ──────────────────────────────────────────────────────────────────
def main() -> None:
    log.info(f"定时任务启动，每天 {RUN_AT} 执行")
    log.info(f"  职场: {BASE_URL}/api/cron/wechat-to-coze")
    log.info(f"  GitHub: {BASE_URL}/api/cron/wechat-to-coze-github")

    schedule.every().day.at(RUN_AT).do(run_all_jobs)

    # 启动时立即运行一次（调试用，正式使用时注释掉）：
    # run_all_jobs()

    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    main()
