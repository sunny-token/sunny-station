import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET_KEY = process.env.JWT_SECRET || 'your-super-secret-key-for-jwt-xoxo-2026';
const secretKeyBytes = new TextEncoder().encode(JWT_SECRET_KEY);

export interface TokenPayload {
  userId: string;
  role: string;
}

// 密码哈希
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// 密码验证
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 签发 JWT
export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7天过期
    .sign(secretKeyBytes);
}

// 验证 JWT
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKeyBytes);
    return payload as unknown as TokenPayload;
  } catch {
    return null; // 验证失败返回 null
  }
}
