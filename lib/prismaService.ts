// lib/prismaService.ts
// 提供 Prisma 客户端的单例实例，通用的数据库操作方法，以及辅助函数，现在包括 upsert 功能

import { PrismaClient } from "@prisma/client";

class PrismaService {
  private static instance: PrismaService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });

    // 测试数据库连接
    this.testConnection();
  }

  private async testConnection() {
    try {
      await this.prisma.$connect();
      console.log("✅ Database connected successfully");
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      console.error("Please check your DATABASE_URL in .env file");
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
