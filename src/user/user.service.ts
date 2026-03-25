import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /**
   * B端账号批量下发核心接口 (PRD Feature)
   * 
   * Expects structured data parsed from Excel.
   * e.g. [ { orgId: 1, name: '李老师', defaultPrefix: 'NJ' }, ... ]
   */
  async batchCreateUsers(usersData: Array<{orgId: number, name: string, defaultPrefix?: string}>) {
    const defaultPassword = 'k12Password123!';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);
    
    // Batch process users
    const toInsert = usersData.map((record, index) => {
      // 预设账号命名规则: 机构简写 + 时间戳末尾 + 自增
      const prefix = record.defaultPrefix || 'ORG';
      const username = `${prefix}_${record.name}_${Date.now().toString().slice(-4)}${index}`;
      
      return {
        username,
        passwordHash,
        orgId: record.orgId,
        role: 'TEACHER', // default assignment
        tokenLimit: 50000 // Give an initial 50k token cap out of the box
      };
    });

    // Run batch insert transactionally
    // @ts-ignore Prisma syntax
    const res = await this.prisma.user.createMany({
      data: toInsert
    });

    // We return the generated plain records (excluding hash) to the admin for printing/distribution
    return {
      message: `Successfully created ${res.count} accounts`,
      generatedAccounts: toInsert.map(u => ({ username: u.username, plainPasswordSet: defaultPassword }))
    };
  }
}
