import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }
    return user;
  }

  async findByOpenid(openid: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { openid } });
  }

  async findByPhone(phone: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { phone } });
  }

  async create(data: Partial<UserEntity>): Promise<UserEntity> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async update(id: string, data: Partial<UserEntity>): Promise<UserEntity> {
    const user = await this.findById(id);
    Object.assign(user, data);
    return this.userRepository.save(user);
  }

  async verifyIdentity(
    id: string,
    realName: string,
    idCardNo: string,
  ): Promise<UserEntity> {
    const user = await this.findById(id);
    user.realName = realName;
    user.idCardNo = idCardNo;
    user.isVerified = true;
    return this.userRepository.save(user);
  }

  async updateSettings(
    id: string,
    settings: Partial<UserEntity['settings']>,
  ): Promise<UserEntity> {
    const user = await this.findById(id);
    user.settings = { ...user.settings, ...settings };
    return this.userRepository.save(user);
  }
}
