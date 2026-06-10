import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { AccidentEntity } from '../accident/accident.entity';

export type CertificateStatus = 'draft' | 'issued' | 'verified' | 'revoked';
export type CertificateTemplateType = 'certificate' | 'agreement';

@Entity('certificates')
export class CertificateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  certificateNo: string;

  @Column({
    type: 'enum',
    enum: ['certificate', 'agreement'],
    default: 'certificate',
  })
  templateType: CertificateTemplateType;

  @Column({ type: 'uuid' })
  accidentId: string;

  @OneToOne(() => AccidentEntity)
  @JoinColumn({ name: 'accidentId' })
  accident: AccidentEntity;

  @Column({ type: 'json' })
  parties: Array<{
    id: string;
    name: string;
    idCardNo: string;
    phone: string;
    plateNo: string;
    insuranceCompany: string;
    liability: 'full' | 'primary' | 'secondary' | 'none';
    signature?: string;
  }>;

  @Column({ type: 'text' })
  certificateContent: string;

  @Column({
    type: 'enum',
    enum: ['draft', 'issued', 'verified', 'revoked'],
    default: 'draft',
  })
  status: CertificateStatus;

  @Column({ type: 'datetime' })
  issuedAt: Date;

  @Column({ length: 200 })
  issuedBy: string;

  @Column({ type: 'datetime' })
  validUntil: Date;

  @Column({ unique: true, length: 50 })
  verifyCode: string;

  @Column({ length: 500, nullable: true })
  pdfUrl: string;

  @Column({ length: 500, nullable: true })
  pdfStorageKey: string;

  @Column({ length: 500, nullable: true })
  qrCodeUrl?: string;

  @Column({ length: 500, nullable: true })
  thumbnailUrl?: string;

  @Column({ type: 'json', nullable: true })
  signatureInfo: {
    provider: string;
    sealType: string;
    sealSn: string;
    signedAt: string;
    certificateSn: string;
    isValid: boolean;
  };

  @Column({ type: 'datetime', nullable: true })
  pdfGeneratedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
