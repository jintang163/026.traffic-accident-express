import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100, nullable: true })
  openid: string;

  @Column({ length: 100, nullable: true })
  nickname: string;

  @Column({ length: 500, nullable: true })
  avatarUrl: string;

  @Column({ unique: true, length: 20, nullable: true })
  phone: string;

  @Column({ length: 50, nullable: true })
  realName: string;

  @Column({ unique: true, length: 20, nullable: true })
  idCardNo: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'json', nullable: true })
  settings: {
    enablePushNotification: boolean;
    enableLocation: boolean;
    language: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
