import { Controller, Get, Post, Body, Req, UseGuards, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { OrgService } from './org.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('org')
@UseGuards(JwtAuthGuard)
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Get('list')
  async listOrgs(@Req() req: any) {
    const orgs = await this.orgService.listOrganizations(req.user);
    return { success: true, data: orgs };
  }

  @Post('create')
  async createOrg(@Req() req: any, @Body() body: { name: string }) {
    const org = await this.orgService.createOrganization(req.user, body.name);
    return { success: true, data: org };
  }

  @Post('admin')
  async createOrgAdmin(@Req() req: any, @Body() body: any) {
    const { orgId, userId } = body;
    const admin = await this.orgService.createOrgAdmin(req.user, orgId, userId);
    return { success: true, data: admin };
  }

  @Get(':orgId/users')
  async getOrgUsers(@Req() req: any, @Param('orgId') orgId: string) {
    const list = await this.orgService.getOrgUsers(req.user, parseInt(orgId));
    return { success: true, data: list };
  }

  @Post(':orgId/users/batch')
  async batchCreateUsers(@Req() req: any, @Param('orgId') orgId: string, @Body() body: { users: any[] }) {
    const result = await this.orgService.batchCreateUsers(req.user, parseInt(orgId), body.users);
    return { success: true, data: result };
  }

  @Delete(':orgId/users/:userId')
  async deleteOrgUser(
    @Req() req: any,
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    await this.orgService.deleteOrgUser(req.user, orgId, userId);
    return { success: true };
  }
}
