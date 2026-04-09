// lib/prismaService.ts
// 提供 Prisma 客户端的单例实例，通用的数据库操作方法，以及辅助函数，现在包括 upsert 功能

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

class PrismaService {
  private static instance: PrismaService;
  private prisma: PrismaClient;
  private connectionTested: boolean = false;

  private constructor() {
    // 在 Next.js 开发环境下使用全局实例，避免重复创建连接导致 pool 耗尽
    this.prisma =
      globalForPrisma.prisma ??
      new PrismaClient({
        log:
          process.env.NODE_ENV === "development"
            ? ["error", "warn"]
            : ["error"],
      });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = this.prisma;
    }

    // 在应用启动时测试连接（延迟执行，避免阻塞）
    // Prisma Client 使用懒加载连接，首次查询时才会建立连接
    if (process.env.NODE_ENV === "development") {
      // 开发环境下延迟测试连接
      setTimeout(() => {
        this.testConnection().catch(() => {
          // 静默失败，不影响应用启动
        });
      }, 1000);
    }
  }

  private async testConnection() {
    if (this.connectionTested) return;
    
    try {
      // 使用简单的查询来测试连接，而不是 $connect()
      // $connect() 会占用连接池中的连接
      await this.prisma.$queryRaw`SELECT 1`;
      this.connectionTested = true;
      console.log("✅ Database connected successfully");
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      console.error("Please check your DATABASE_URL in .env file");
      // 不抛出错误，允许应用继续运行
    }
  }

  public static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService();
    }
    return PrismaService.instance;
  }

  public getPrismaClient(): PrismaClient {
    return this.prisma;
  }

  // 通用的更新方法
  public async update<T extends object>(model: any, where: any, data: T) {
    const updateData = this.getUpdateData(data);
    return model.update({
      where,
      data: updateData,
    });
  }

  // 新增：通用的 upsert 方法
  public async upsert<T extends object>(
    model: any,
    where: any,
    create: T,
    update: T,
  ) {
    console.log(`Upserting record in ${model.name}:`, where);
    const createOption = {
      ...create,
    };

    const updateOption = {
      ...update,
      updated_at: new Date(),
    };
    try {
      const result = await model.upsert({
        where,
        create: createOption,
        update: updateOption,
      });
      console.log(`Successfully upserted record in ${model.name}:`, result);
      return result;
    } catch (error) {
      console.error(`Error upserting record in ${model.name}:`, error);
      throw error;
    }
  }

  // 之前在 prismaHelpers 中的方法
  private getUpdateData<T extends object>(data: T): T & { updated_at: Date } {
    return {
      ...data,
      updated_at: new Date(),
    };
  }

  // 覆盖 create 方法
  public async create(model: any, data: any) {
    return model.create({ data });
  }

  // 覆盖 createMany 方法
  public async createMany(model: any, data: any) {
    return model.createMany({ data });
  }

  // 覆盖 deleteMany 方法
  public async deleteMany(model: any, where: any) {
    return model.deleteMany({ where });
  }

  // 覆盖 updateMany 方法
  public async updateMany(model: any, where: any, data: any) {
    return model.updateMany({ where, data });
  }

  // 其他通用方法
  public async findUnique(model: any, where: any) {
    return model.findUnique({ where });
  }

  public async findMany(model: any, options?: any) {
    return model.findMany(options);
  }

  public async delete(model: any, where: any) {
    return model.delete({ where });
  }

  // 事务方法
  public async transaction<T>(
    callback: (
      tx: Omit<
        PrismaClient,
        | "$connect"
        | "$disconnect"
        | "$on"
        | "$transaction"
        | "$use"
        | "$extends"
      >,
    ) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(callback);
  }

  // 添加 count 方法
  public async count(model: any, where?: any) {
    return model.count({ where });
  }
}

// 导出单例实例
const prismaService = PrismaService.getInstance();
export default prismaService;
