import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiabilityRuleEntity } from './liability-rule.entity';

export interface LiabilityFact {
  accidentType: string;
  collisionPositions: { vehicleA: string[]; vehicleB: string[] };
  laneCrossingA: boolean;
  laneCrossingB: boolean;
  hasDashcamVideo: boolean;
  weather: string;
  roadCondition: string;
  vehicleAPosition: string;
  vehicleBPosition: string;
}

export interface LiabilityConclusion {
  primaryParty: 'A' | 'B' | 'none';
  primaryLiability: number;
  secondaryLiability: number;
  liabilityType: 'full' | 'primary_secondary' | 'equal';
  ruleType: 'hard' | 'soft';
  ruleId: string;
  ruleName: string;
  legalBasis: string;
  liabilityDescription: string;
  needsManualReview: boolean;
  reviewReason?: string;
  confidence: number;
}

interface InternalRule {
  id: string;
  name: string;
  type: 'hard' | 'soft';
  priority: number;
  condition: (fact: LiabilityFact) => boolean;
  conclude: (fact: LiabilityFact) => Omit<LiabilityConclusion, 'ruleId' | 'ruleName' | 'ruleType'>;
  legalBasis: string;
}

@Injectable()
export class LiabilityRuleEngine {
  private hardcodedRules: InternalRule[] = [];

  constructor(
    @InjectRepository(LiabilityRuleEntity)
    private ruleRepository: Repository<LiabilityRuleEntity>,
  ) {
    this.initializeHardcodedRules();
  }

  private initializeHardcodedRules() {
    this.hardcodedRules = [
      {
        id: 'HARD_REAR_END',
        name: '追尾事故-后车全责',
        type: 'hard',
        priority: 100,
        condition: (fact) => fact.accidentType === 'rear_end',
        conclude: (fact) => ({
          primaryParty: 'B',
          primaryLiability: 100,
          secondaryLiability: 0,
          liabilityType: 'full',
          needsManualReview: false,
          confidence: 0.95,
          legalBasis: '《道路交通安全法》第四十三条：同车道行驶的机动车，后车应当与前车保持足以采取紧急制动措施的安全距离。',
          liabilityDescription: '后车未与前车保持安全车距导致追尾，依据《道路交通安全法》第四十三条，后车负全部责任。',
        }),
        legalBasis: '《道路交通安全法》第四十三条',
      },
      {
        id: 'HARD_REVERSE',
        name: '倒车事故-倒车方全责',
        type: 'hard',
        priority: 100,
        condition: (fact) => fact.accidentType === 'reverse',
        conclude: (fact) => ({
          primaryParty: 'B',
          primaryLiability: 100,
          secondaryLiability: 0,
          liabilityType: 'full',
          needsManualReview: false,
          confidence: 0.95,
          legalBasis: '《道路交通安全法实施条例》第五十条：机动车倒车时，应当察明车后情况，确认安全后倒车。',
          liabilityDescription: '倒车方未查明车后情况导致碰撞，依据《实施条例》第五十条，倒车方负全部责任。',
        }),
        legalBasis: '《道路交通安全法实施条例》第五十条',
      },
      {
        id: 'HARD_LANE_CHANGE',
        name: '变道刮擦-变道方全责',
        type: 'hard',
        priority: 95,
        condition: (fact) =>
          fact.accidentType === 'side_swipe' &&
          (fact.laneCrossingA !== fact.laneCrossingB),
        conclude: (fact) => {
          const changingLane = fact.laneCrossingA ? 'A' : 'B';
          return {
            primaryParty: changingLane as 'A' | 'B',
            primaryLiability: 100,
            secondaryLiability: 0,
            liabilityType: 'full',
            needsManualReview: false,
            confidence: 0.9,
            legalBasis: '《道路交通安全法实施条例》第四十四条：在道路同方向划有2条以上机动车道的，变更车道的机动车不得影响相关车道行驶的机动车的正常行驶。',
            liabilityDescription: `变道方（${changingLane === 'A' ? 'A车' : 'B车'}）压线变道影响正常行驶车辆，依据《实施条例》第四十四条，变道方负全部责任。`,
          };
        },
        legalBasis: '《道路交通安全法实施条例》第四十四条',
      },
      {
        id: 'SOFT_SIDE_SWIPE_NO_LANE',
        name: '变道刮擦-双方均未压线',
        type: 'soft',
        priority: 80,
        condition: (fact) =>
          fact.accidentType === 'side_swipe' &&
          !fact.laneCrossingA &&
          !fact.laneCrossingB,
        conclude: (fact) => ({
          primaryParty: 'B',
          primaryLiability: 70,
          secondaryLiability: 30,
          liabilityType: 'primary_secondary',
          needsManualReview: true,
          reviewReason: '双方均未压线，变道刮擦责任需结合行车记录仪或证人判定',
          confidence: 0.6,
          legalBasis: '《道路交通安全法实施条例》第四十四条（建议性判定）',
          liabilityDescription: '双方均未明确压线，建议变道方负主要责任，但需人工复核确认。',
        }),
        legalBasis: '《道路交通安全法实施条例》第四十四条',
      },
      {
        id: 'SOFT_SIDE_SWIPE_BOTH_LANE',
        name: '变道刮擦-双方均压线',
        type: 'soft',
        priority: 80,
        condition: (fact) =>
          fact.accidentType === 'side_swipe' &&
          fact.laneCrossingA &&
          fact.laneCrossingB,
        conclude: (fact) => ({
          primaryParty: 'none',
          primaryLiability: 50,
          secondaryLiability: 50,
          liabilityType: 'equal',
          needsManualReview: true,
          reviewReason: '双方均有压线行为，需交警综合判定责任',
          confidence: 0.5,
          legalBasis: '《道路交通安全法》第七十六条（建议性判定）',
          liabilityDescription: '双方均有压线行为，暂判定同等责任，建议交警人工复核。',
        }),
        legalBasis: '《道路交通安全法》第七十六条',
      },
      {
        id: 'HARD_HEAD_ON',
        name: '正面碰撞-需人工审核',
        type: 'hard',
        priority: 70,
        condition: (fact) => fact.accidentType === 'head_on',
        conclude: (fact) => ({
          primaryParty: 'none',
          primaryLiability: 50,
          secondaryLiability: 50,
          liabilityType: 'equal',
          needsManualReview: true,
          reviewReason: '正面碰撞需根据车道线、行驶方向、信号灯等综合判定',
          confidence: 0.4,
          legalBasis: '《道路交通安全法》第七十六条',
          liabilityDescription: '正面碰撞事故需综合判断行驶方向、车道位置等因素，暂判定同等责任，需交警人工复核。',
        }),
        legalBasis: '《道路交通安全法》第七十六条',
      },
      {
        id: 'HARD_INTERSECTION_YIELD',
        name: '路口事故-未让行方全责',
        type: 'hard',
        priority: 90,
        condition: (fact) =>
          fact.accidentType === 'intersection' &&
          (fact.laneCrossingA || fact.laneCrossingB),
        conclude: (fact) => {
          const yielding = fact.laneCrossingA ? 'A' : 'B';
          return {
            primaryParty: yielding as 'A' | 'B',
            primaryLiability: 100,
            secondaryLiability: 0,
            liabilityType: 'full',
            needsManualReview: false,
            confidence: 0.85,
            legalBasis: '《道路交通安全法实施条例》第五十二条：机动车通过没有交通信号灯控制也没有交通警察指挥的交叉路口，应当遵守依次让行规定。',
            liabilityDescription: `未让行方（${yielding === 'A' ? 'A车' : 'B车'}）在路口未按规定让行，依据《实施条例》第五十二条，负全部责任。`,
          };
        },
        legalBasis: '《道路交通安全法实施条例》第五十二条',
      },
      {
        id: 'SOFT_INTERSECTION_NO_LANE',
        name: '路口事故-双方均未压线',
        type: 'soft',
        priority: 70,
        condition: (fact) =>
          fact.accidentType === 'intersection' &&
          !fact.laneCrossingA &&
          !fact.laneCrossingB,
        conclude: (fact) => ({
          primaryParty: 'B',
          primaryLiability: 60,
          secondaryLiability: 40,
          liabilityType: 'primary_secondary',
          needsManualReview: true,
          reviewReason: '路口事故无明确压线，需根据信号灯、让行规则综合判定',
          confidence: 0.5,
          legalBasis: '《道路交通安全法实施条例》第五十二条（建议性判定）',
          liabilityDescription: '路口事故未明确压线，建议B车负主要责任，需人工复核确认信号灯及让行情况。',
        }),
        legalBasis: '《道路交通安全法实施条例》第五十二条',
      },
      {
        id: 'HARD_REAR_END_FRONT_BRAKE',
        name: '追尾+前车急刹',
        type: 'hard',
        priority: 105,
        condition: (fact) =>
          fact.accidentType === 'rear_end' &&
          fact.collisionPositions?.vehicleA?.includes('rear') &&
          fact.collisionPositions?.vehicleB?.includes('front'),
        conclude: (fact) => ({
          primaryParty: 'B',
          primaryLiability: 100,
          secondaryLiability: 0,
          liabilityType: 'full',
          needsManualReview: false,
          confidence: 0.92,
          legalBasis: '《道路交通安全法》第四十三条',
          liabilityDescription: 'B车追尾A车，B车车头碰撞A车车尾，后车未保持安全距离，负全部责任。',
        }),
        legalBasis: '《道路交通安全法》第四十三条',
      },
      {
        id: 'SOFT_DASHCAM_OVERRIDE',
        name: '行车记录仪辅助判定',
        type: 'soft',
        priority: 50,
        condition: (fact) => fact.hasDashcamVideo,
        conclude: (fact) => ({
          primaryParty: 'none',
          primaryLiability: 0,
          secondaryLiability: 0,
          liabilityType: 'equal',
          needsManualReview: false,
          confidence: 0.1,
          legalBasis: '',
          liabilityDescription: '行车记录仪视频可作为责任判定辅助证据，提高判定可信度。',
        }),
        legalBasis: '',
      },
      {
        id: 'SOFT_OTHER_DEFAULT',
        name: '其他事故-默认需人工审核',
        type: 'soft',
        priority: 10,
        condition: (fact) => fact.accidentType === 'other',
        conclude: (fact) => ({
          primaryParty: 'none',
          primaryLiability: 50,
          secondaryLiability: 50,
          liabilityType: 'equal',
          needsManualReview: true,
          reviewReason: '事故类型无法自动分类，需交警人工判定',
          confidence: 0.2,
          legalBasis: '《道路交通安全法》第七十六条',
          liabilityDescription: '事故类型需人工进一步核实，暂按同等责任处理，建议交警复核。',
        }),
        legalBasis: '《道路交通安全法》第七十六条',
      },
    ];

    this.hardcodedRules.sort((a, b) => b.priority - a.priority);
  }

  async evaluate(fact: LiabilityFact): Promise<LiabilityConclusion> {
    console.log('[RuleEngine] 开始规则评估，输入特征:', JSON.stringify(fact));

    const dbRules = await this.loadDatabaseRules();
    const allRules = [...dbRules, ...this.hardcodedRules];
    allRules.sort((a, b) => b.priority - a.priority);

    let bestHardRule: InternalRule | null = null;
    let bestHardConclusion: LiabilityConclusion | null = null;
    let bestSoftRule: InternalRule | null = null;
    let bestSoftConclusion: LiabilityConclusion | null = null;

    for (const rule of allRules) {
      try {
        if (rule.condition(fact)) {
          const conclusion = rule.conclude(fact);

          if (rule.type === 'hard' && !bestHardRule) {
            bestHardRule = rule;
            bestHardConclusion = {
              ...conclusion,
              ruleId: rule.id,
              ruleName: rule.name,
              ruleType: 'hard',
            };
          } else if (rule.type === 'soft' && !bestSoftRule) {
            bestSoftRule = rule;
            bestSoftConclusion = {
              ...conclusion,
              ruleId: rule.id,
              ruleName: rule.name,
              ruleType: 'soft',
            };
          }

          if (bestHardRule && bestSoftRule) break;
        }
      } catch (error) {
        console.warn(`[RuleEngine] 规则 ${rule.id} 执行失败:`, error);
      }
    }

    let finalConclusion: LiabilityConclusion;

    if (bestHardConclusion) {
      finalConclusion = { ...bestHardConclusion };

      if (bestSoftConclusion && bestSoftConclusion.ruleId === 'SOFT_DASHCAM_OVERRIDE' && fact.hasDashcamVideo) {
        finalConclusion.confidence = Math.min(finalConclusion.confidence + 0.1, 1.0);
        finalConclusion.liabilityDescription += '（有行车记录仪佐证，判定可信度提升）';
      }
    } else if (bestSoftConclusion) {
      finalConclusion = { ...bestSoftConclusion };
    } else {
      finalConclusion = {
        primaryParty: 'none',
        primaryLiability: 50,
        secondaryLiability: 50,
        liabilityType: 'equal',
        ruleType: 'soft',
        ruleId: 'DEFAULT_NO_MATCH',
        ruleName: '默认规则-无匹配规则',
        legalBasis: '《道路交通安全法》第七十六条',
        liabilityDescription: '无法匹配自动定责规则，暂按同等责任处理，需交警人工复核。',
        needsManualReview: true,
        reviewReason: '无匹配的自动定责规则',
        confidence: 0.1,
      };
    }

    if (finalConclusion.primaryParty !== 'none' && finalConclusion.needsManualReview) {
      finalConclusion.liabilityType = 'primary_secondary';
    }

    console.log('[RuleEngine] 规则评估完成:', {
      ruleId: finalConclusion.ruleId,
      ruleName: finalConclusion.ruleName,
      ruleType: finalConclusion.ruleType,
      primaryParty: finalConclusion.primaryParty,
      liabilityType: finalConclusion.liabilityType,
      needsManualReview: finalConclusion.needsManualReview,
      confidence: finalConclusion.confidence,
    });

    return finalConclusion;
  }

  private async loadDatabaseRules(): Promise<InternalRule[]> {
    try {
      const dbRules = await this.ruleRepository.find({
        where: { enabled: true },
        order: { priority: 'DESC' },
      });

      return dbRules
        .filter((rule) => rule.conditionExpression)
        .map((rule) => ({
          id: `DB_${rule.id}`,
          name: rule.name,
          type: rule.ruleType as 'hard' | 'soft',
          priority: rule.priority,
          condition: this.buildConditionFromExpression(rule.conditionExpression),
          conclude: this.buildConcludeFromConfig(rule),
          legalBasis: rule.legalBasis || '',
        }));
    } catch (error) {
      console.warn('[RuleEngine] 数据库规则加载失败:', error);
      return [];
    }
  }

  private buildConditionFromExpression(expression: string): (fact: LiabilityFact) => boolean {
    try {
      const fn = new Function('fact', `
        const { accidentType, collisionPositions, laneCrossingA, laneCrossingB, hasDashcamVideo, weather, roadCondition } = fact;
        try {
          return ${expression};
        } catch(e) {
          return false;
        }
      `);
      return fn as (fact: LiabilityFact) => boolean;
    } catch (error) {
      console.warn('[RuleEngine] 规则条件解析失败:', expression, error);
      return () => false;
    }
  }

  private buildConcludeFromConfig(rule: LiabilityRuleEntity): (fact: LiabilityFact) => Omit<LiabilityConclusion, 'ruleId' | 'ruleName' | 'ruleType'> {
    return (fact: LiabilityFact) => ({
      primaryParty: rule.primaryParty as 'A' | 'B' | 'none',
      primaryLiability: rule.primaryLiability,
      secondaryLiability: rule.secondaryLiability,
      liabilityType: rule.primaryLiability === 100 ? 'full' :
                     rule.primaryLiability === 50 ? 'equal' : 'primary_secondary',
      needsManualReview: rule.needsManualReview || false,
      reviewReason: rule.reviewReason || undefined,
      confidence: rule.confidence || 0.5,
      legalBasis: rule.legalBasis || '',
      liabilityDescription: rule.liabilityDescription || '',
    });
  }

  async getRuleList(): Promise<LiabilityRuleEntity[]> {
    return this.ruleRepository.find({
      order: { priority: 'DESC' },
    });
  }

  async createRule(ruleData: Partial<LiabilityRuleEntity>): Promise<LiabilityRuleEntity> {
    const rule = this.ruleRepository.create(ruleData);
    return this.ruleRepository.save(rule);
  }

  async updateRule(id: string, ruleData: Partial<LiabilityRuleEntity>): Promise<LiabilityRuleEntity> {
    await this.ruleRepository.update(id, ruleData);
    return this.ruleRepository.findOne({ where: { id } });
  }

  async deleteRule(id: string): Promise<void> {
    await this.ruleRepository.delete(id);
  }
}
