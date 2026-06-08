import { Controller, Get, Put, Body, Param, Request } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  async getProfile(@Request() req) {
    const userId = req.user?.id;
    const user = await this.userService.findById(userId);
    
    return {
      success: true,
      data: user,
      message: '获取成功',
    };
  }

  @Put('profile')
  async updateProfile(@Request() req, @Body() data: any) {
    const userId = req.user?.id;
    const user = await this.userService.update(userId, data);
    
    return {
      success: true,
      data: user,
      message: '更新成功',
    };
  }

  @Post('verify')
  async verifyIdentity(
    @Request() req,
    @Body('realName') realName: string,
    @Body('idCardNo') idCardNo: string,
  ) {
    const userId = req.user?.id;
    const user = await this.userService.verifyIdentity(userId, realName, idCardNo);
    
    return {
      success: true,
      data: user,
      message: '实名认证成功',
    };
  }

  @Put('settings')
  async updateSettings(@Request() req, @Body() settings: any) {
    const userId = req.user?.id;
    const user = await this.userService.updateSettings(userId, settings);
    
    return {
      success: true,
      data: user,
      message: '设置更新成功',
    };
  }
}
