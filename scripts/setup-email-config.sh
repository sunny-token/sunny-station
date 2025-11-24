#!/bin/bash

# 邮件配置助手脚本
# 帮助用户配置 SMTP 邮件服务

echo "=========================================="
echo "邮件配置助手"
echo "=========================================="
echo ""

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
    echo "❌ 未找到 .env 文件，正在创建..."
    touch .env
fi

echo "请选择您使用的邮箱服务商："
echo "1) QQ 邮箱"
echo "2) 163 邮箱"
echo "3) 126 邮箱"
echo "4) Gmail"
echo "5) 腾讯企业邮箱"
echo "6) 其他（自定义配置）"
echo ""
read -p "请输入选项 (1-6): " choice

case $choice in
    1)
        echo ""
        echo "=== QQ 邮箱配置 ==="
        echo "提示：需要在 QQ 邮箱设置中开启 SMTP 服务并获取授权码"
        echo "设置路径：QQ 邮箱 -> 设置 -> 账户 -> POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务"
        echo ""
        read -p "请输入您的 QQ 邮箱地址: " email
        read -p "请输入 SMTP 授权码（不是登录密码）: " password
        read -p "发件人名称（默认：彩票中奖通知）: " from_name
        from_name=${from_name:-"彩票中奖通知"}
        
        # 追加到 .env 文件
        cat >> .env << EOF

# SMTP 邮件配置 (QQ 邮箱)
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=${email}
SMTP_PASSWORD=${password}
SMTP_FROM_EMAIL=${email}
SMTP_FROM_NAME=${from_name}
EOF
        echo ""
        echo "✅ QQ 邮箱配置已添加到 .env 文件"
        ;;
    2)
        echo ""
        echo "=== 163 邮箱配置 ==="
        echo "提示：需要在 163 邮箱设置中开启 SMTP 服务并获取授权码"
        echo ""
        read -p "请输入您的 163 邮箱地址: " email
        read -p "请输入 SMTP 授权码（不是登录密码）: " password
        read -p "发件人名称（默认：彩票中奖通知）: " from_name
        from_name=${from_name:-"彩票中奖通知"}
        
        cat >> .env << EOF

# SMTP 邮件配置 (163 邮箱)
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_USER=${email}
SMTP_PASSWORD=${password}
SMTP_FROM_EMAIL=${email}
SMTP_FROM_NAME=${from_name}
EOF
        echo ""
        echo "✅ 163 邮箱配置已添加到 .env 文件"
        ;;
    3)
        echo ""
        echo "=== 126 邮箱配置 ==="
        echo "提示：需要在 126 邮箱设置中开启 SMTP 服务并获取授权码"
        echo "设置路径：126 邮箱 -> 设置 -> POP3/SMTP/IMAP -> 开启 IMAP/SMTP 服务"
        echo ""
        read -p "请输入您的 126 邮箱地址: " email
        read -p "请输入 SMTP 授权码（不是登录密码）: " password
        read -p "发件人名称（默认：彩票中奖通知）: " from_name
        from_name=${from_name:-"彩票中奖通知"}
        
        cat >> .env << EOF

# SMTP 邮件配置 (126 邮箱)
SMTP_HOST=smtp.126.com
SMTP_PORT=465
SMTP_USER=${email}
SMTP_PASSWORD=${password}
SMTP_FROM_EMAIL=${email}
SMTP_FROM_NAME=${from_name}
EOF
        echo ""
        echo "✅ 126 邮箱配置已添加到 .env 文件"
        ;;
    4)
        echo ""
        echo "=== Gmail 配置 ==="
        echo "提示：需要开启两步验证并生成应用专用密码"
        echo "设置路径：Google 账户 -> 安全性 -> 两步验证 -> 应用专用密码"
        echo ""
        read -p "请输入您的 Gmail 地址: " email
        read -p "请输入应用专用密码（不是登录密码）: " password
        read -p "发件人名称（默认：彩票中奖通知）: " from_name
        from_name=${from_name:-"彩票中奖通知"}
        
        cat >> .env << EOF

# SMTP 邮件配置 (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=${email}
SMTP_PASSWORD=${password}
SMTP_FROM_EMAIL=${email}
SMTP_FROM_NAME=${from_name}
EOF
        echo ""
        echo "✅ Gmail 配置已添加到 .env 文件"
        ;;
    5)
        echo ""
        echo "=== 腾讯企业邮箱配置 ==="
        read -p "请输入您的企业邮箱地址: " email
        read -p "请输入邮箱密码: " password
        read -p "发件人名称（默认：彩票中奖通知）: " from_name
        from_name=${from_name:-"彩票中奖通知"}
        
        cat >> .env << EOF

# SMTP 邮件配置 (腾讯企业邮箱)
SMTP_HOST=smtp.exmail.qq.com
SMTP_PORT=465
SMTP_USER=${email}
SMTP_PASSWORD=${password}
SMTP_FROM_EMAIL=${email}
SMTP_FROM_NAME=${from_name}
EOF
        echo ""
        echo "✅ 腾讯企业邮箱配置已添加到 .env 文件"
        ;;
    6)
        echo ""
        echo "=== 自定义配置 ==="
        read -p "请输入 SMTP 服务器地址: " smtp_host
        read -p "请输入 SMTP 端口 (465/587/25): " smtp_port
        read -p "请输入 SMTP 用户名（通常是邮箱地址）: " smtp_user
        read -p "请输入 SMTP 密码/授权码: " smtp_password
        read -p "发件人邮箱（默认使用用户名）: " from_email
        read -p "发件人名称（默认：彩票中奖通知）: " from_name
        from_email=${from_email:-$smtp_user}
        from_name=${from_name:-"彩票中奖通知"}
        
        cat >> .env << EOF

# SMTP 邮件配置 (自定义)
SMTP_HOST=${smtp_host}
SMTP_PORT=${smtp_port}
SMTP_USER=${smtp_user}
SMTP_PASSWORD=${smtp_password}
SMTP_FROM_EMAIL=${from_email}
SMTP_FROM_NAME=${from_name}
EOF
        echo ""
        echo "✅ 自定义配置已添加到 .env 文件"
        ;;
    *)
        echo "❌ 无效的选项"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "配置完成！"
echo "=========================================="
echo ""
echo "⚠️  重要提示："
echo "1. 请确保已重启开发服务器（如果正在运行）"
echo "2. 可以在系统设置页面测试邮件发送功能"
echo "3. 如果使用 QQ/163/Gmail，请确保已获取授权码/应用密码"
echo ""
echo "配置的环境变量："
grep "^SMTP_" .env | sed 's/PASSWORD=.*/PASSWORD=***/' || echo "未找到配置"
echo ""

