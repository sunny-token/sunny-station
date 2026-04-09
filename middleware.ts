import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// 需要与 lib/auth.ts 中保持严格一致的密钥
const JWT_SECRET_KEY = process.env.JWT_SECRET || 'your-super-secret-key-for-jwt-xoxo-2026';
const secretKeyBytes = new TextEncoder().encode(JWT_SECRET_KEY);

// 核心边缘鉴权中间件
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 公开访问白名单
  const publicPaths = ['/login'];
  
  // 1. 对于静态资源、API请求、Next内部文件，直接放行
  if (
    pathname.startsWith('/api') || 
    pathname.startsWith('/_next') || 
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 获取 Cookie 中的凭证
  const token = request.cookies.get('auth_token')?.value;

  // 2. 如果用户访问的是公开页面 (如 /login)
  if (publicPaths.includes(pathname)) {
    if (token) {
      try {
        // 尝试校验 Token，如果已经有合法的 Token，禁止再访问登录页，直接重定向到控制台
        await jwtVerify(token, secretKeyBytes);
        return NextResponse.redirect(new URL('/', request.url)); // 或者 '/settings'
      } catch (error) {
        // Token 失效或被篡改，清理假 Cookie
        const response = NextResponse.next();
        response.cookies.delete('auth_token');
        return response;
      }
    }
    return NextResponse.next();
  }

  // 3. 进入未授权但被保护的页面链路
  if (!token) {
    // 直接拦截并打回登录
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 4. 用户有 Token 的情况，进行边缘密码学校验
  try {
    await jwtVerify(token, secretKeyBytes);
    // 校验成功，放行
    return NextResponse.next();
  } catch (error) {
    // 校验失败（过期/伪造），剥夺 Cookie 并打回登录
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }
}

// 定义中间件拦截范围
export const config = {
  matcher: [
    /*
     * 匹配此范围: 所有路径，但不包括:
     * - api 接口体系我们交给 tRPC 的 ProtectedProcedure 处理
     * - _next 内部编译核心
     * - icon/图片等静态资源
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
