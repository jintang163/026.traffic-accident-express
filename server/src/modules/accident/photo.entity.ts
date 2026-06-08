import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { AccidentEntity } from './accident.entity';

export type PhotoType = 'plate' | 'scene';

@Entity('photos')
export class PhotoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AccidentEntity, (accident) => accident.scenePhotos, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'accidentId' })
  accident: AccidentEntity;

  @Column({ type: 'uuid', nullable: true })
  accidentId: string;

  @Column({
    type: 'enum',
    enum: ['plate', 'scene'],
    default: 'scene',
  })
  type: PhotoType;

  @Column({ length: 500 })
  url: string;

  @Column({ length: 500, nullable: true })
  thumbnailUrl: string;

  @Column({ type: 'json', nullable: true })
  watermarkInfo: {
    timestamp: string;
    location: string;
    latitude: number;
    longitude: number;
  };

  @Column({ type: 'int', default: 0 })
  size: number;

  @Column({ length: 50, nullable: true })
  mimeType: string;

  @CreateDateColumn()
  uploadTime: Date;
}
