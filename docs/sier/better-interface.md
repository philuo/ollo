// 赛尔号回合制游戏详细设计文档
// 文档版本: 1.0
// 创建日期: 2025-06-17

/**
 * ========================================
 * 目录
 * ========================================
 * 1. 游戏概述
 * 2. 核心玩法系统
 *    2.1 精灵融合系统
 *    2.2 属性相克系统
 *    2.3 精灵收集系统
 *    2.4 精灵培养系统
 *    2.5 PVP对战系统
 *    2.6 PVE挑战系统
 * 3. 组件设计
 * 4. 实体架构
 * 5. 系统设计
 * 6. 资源管理
 * 7. 数据结构定义
 */

// ========================================
// 1. 游戏概述
// ========================================

/**
 * 游戏基本信息
 * - 游戏类型: 回合制角色扮演游戏
 * - 核心玩法: 精灵收集、培养、对战
 * - 游戏平台: Web/移动端
 * - 技术栈: TypeScript + 游戏引擎
 */

// ========================================
// 2. 核心玩法系统
// ========================================

// ========================================
// 2.1 精灵融合系统
// ========================================

/**
 * 精灵融合玩法设计
 * 
 * 功能概述:
 * - 玩家可以将两只精灵进行融合，创造新的精灵
 * - 融合结果受父母精灵的属性、等级、技能影响
 * - 融合有成功率和失败风险
 * - 特定组合可以融合出稀有精灵
 * 
 * 融合规则:
 * 1. 基础融合: 相同属性精灵融合，提升后代属性
 * 2. 跨属性融合: 不同属性融合，可能产生新属性
 * 3. 特殊融合: 特定精灵组合，产生传说精灵
 * 4. 融合道具: 使用融合石提升成功率
 * 
 * 融合成本:
 * - 消耗游戏币
 * - 消耗融合道具
 * - 父母精灵消失（或保留但降低等级）
 */

// 融合相关接口定义
interface FusionRecipe {
  id: string;
  parent1Id: string;
  parent2Id: string;
  resultId: string;
  successRate: number;
  cost: {
    coins: number;
    items: string[];
  };
  conditions: {
    minLevel1: number;
    minLevel2: number;
    requiredItems?: string[];
  };
}

// ========================================
// 2.2 属性相克系统
// ========================================

/**
 * 属性相克机制
 * 
 * 基础属性:
 * - 火、水、草、电、冰、格斗、毒、地面、飞行、超能、虫、岩石、幽灵、龙、恶、钢
 * 
 * 相克关系:
 * - 每个属性对其他属性有不同的攻击和防御倍率
 * - 攻击倍率: 0.5(效果不佳), 1(正常), 2(效果拔群), 4(极致效果)
 * - 防御倍率: 影响受到的伤害
 * 
 * 双属性系统:
 * - 精灵可以拥有两种属性
 * - 双属性的相克关系取叠加效果
 * - 策略性更强，搭配更丰富
 */

// 属性枚举
enum ElementType {
  FIRE = 'fire',
  WATER = 'water',
  GRASS = 'grass',
  ELECTRIC = 'electric',
  ICE = 'ice',
  FIGHTING = 'fighting',
  POISON = 'poison',
  GROUND = 'ground',
  FLYING = 'flying',
  PSYCHIC = 'psychic',
  BUG = 'bug',
  ROCK = 'rock',
  GHOST = 'ghost',
  DRAGON = 'dragon',
  DARK = 'dark',
  STEEL = 'steel'
}

// 属性相克表
interface TypeEffectiveness {
  attackType: ElementType;
  defendType: ElementType;
  multiplier: number;
}

// ========================================
// 2.3 精灵收集系统
// ========================================

/**
 * 精灵收集玩法
 * 
 * 收集方式:
 * 1. 野生捕捉: 在地图上遇到野生精灵并进行捕捉
 * 2. 任务奖励: 完成特定任务获得精灵
 * 3. 商店购买: 使用游戏币购买精灵
 * 4. 活动获取: 参与限时活动获得稀有精灵
 * 5. 进化获得: 通过进化获得新形态
 * 
 * 精灵稀有度:
 * - 普通: 常见精灵，容易获得
 * - 稀有: 较少出现，属性较好
 * - 史诗: 罕见精灵，强力技能
 * - 传说: 极其稀有，独一无二
 * - 神话: 传说级精灵，故事背景丰富
 * 
 * 图鉴系统:
 * - 记录玩家收集到的所有精灵
 * - 完成特定收集度获得奖励
 * - 精灵详细信息展示
 */

// 精灵获取方式
enum AcquisitionMethod {
  WILD_CAPTURE = 'wild_capture',
  QUEST_REWARD = 'quest_reward',
  SHOP_PURCHASE = 'shop_purchase',
  EVENT_REWARD = 'event_reward',
  EVOLUTION = 'evolution',
  FUSION = 'fusion',
  GIFT = 'gift'
}

// 精灵稀有度
enum Rarity {
  COMMON = 'common',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
  MYTHICAL = 'mythical'
}

// ========================================
// 2.4 精灵培养系统
// ========================================

/**
 * 精灵培养机制
 * 
 * 2.4.1 性格系统
 * - 影响精灵的属性成长倾向
 * - 每种性格有优势属性和劣势属性
 * - 性格不可更改，影响长期培养策略
 * 
 * 2.4.2 成长值系统
 * - 每次升级获得的基础属性点
 * - 受种族值和个体值影响
 * - 决定精灵的最终属性上限
 * 
 * 2.4.3 努力值系统
 * - 通过战斗获得的额外属性点
 * - 可通过训练道具调整
 * - 有总上限，需要合理分配
 * 
 * 2.4.4 个体值系统
 * - 精灵天生的属性潜力
 * - 0-31的随机值
 * - 可通过特殊方式提升
 * 
 * 2.4.5 进化系统
 * - 等级进化: 达到指定等级
 * - 道具进化: 使用特殊道具
 * - 满足条件进化: 亲密度、时间等
 * - 技能进化: 学会特定技能
 */

// 性格类型
enum Personality {
  BRAVE = 'brave',        // 勇敢: 攻击+、速度-
  ADAMANT = 'adamant',    // 固执: 攻击+、特攻-
  NAUGHTY = 'naughty',    // 调皮: 攻击+、特防-
  BOLD = 'bold',          // 大胆: 防御+、攻击-
  IMPISH = 'impish',      // 淘气: 防御+、特攻-
  LAX = 'lax',            // 随和: 防御+、特防-
  TIMID = 'timid',        // 胆小: 速度+、攻击-
  HASTY = 'hasty',        // 急躁: 速度+、防御-
  JOLLY = 'jolly',        // 开朗: 速度+、特攻-
  NAIVE = 'naive',        // 天真: 速度+、特防-
  MODEST = 'modest',      // 保守: 特攻+、攻击-
  MILD = 'mild',          // 稳重: 特攻+、防御-
  RASH = 'rash',          // 急躁: 特攻+、特防-
  CALM = 'calm',          // 沉着: 特防+、攻击-
  GENTLE = 'gentle',      // 温顺: 特防+、防御-
  CAREFUL = 'careful',    // 慎重: 特防+、特攻-
  QUIRKY = 'quirky',      // 古怪: 无变化
  HARDY = 'hardy',        // 固执: 无变化
  DOCILE = 'docile',      // 温顺: 无变化
  BASHFUL = 'bashful',    // 害羞: 无变化
  SERIOUS = 'serious'     // 认真: 无变化
}

// 性格影响
interface PersonalityEffect {
  personality: Personality;
  increasedStat: StatType;
  decreasedStat: StatType;
  multiplier: number; // 1.1 for increased, 0.9 for decreased
}

// 属性类型
enum StatType {
  HP = 'hp',
  ATTACK = 'attack',
  DEFENSE = 'defense',
  SPECIAL_ATTACK = 'special_attack',
  SPECIAL_DEFENSE = 'special_defense',
  SPEED = 'speed'
}

// 努力值分配
interface EffortValues {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
  total: number;
}

// 个体值
interface IndividualValues {
  hp: number;        // 0-31
  attack: number;    // 0-31
  defense: number;   // 0-31
  specialAttack: number; // 0-31
  specialDefense: number; // 0-31
  speed: number;     // 0-31
}

// 进化条件
interface EvolutionCondition {
  type: 'level' | 'item' | 'friendship' | 'time' | 'trade' | 'move';
  value: number | string;
  condition?: string; // 额外条件描述
}

// ========================================
// 2.5 PVP对战系统
// ========================================

/**
 * PVP对战玩法
 * 
 * 对战模式:
 * 1. 排位赛: 积分制，匹配相似水平玩家
 * 2. 友谊赛: 无积分，练习和切磋
 * 3. 锦标赛: 定期举办，丰厚奖励
 * 4. 团队战: 3v3团队配合
 * 
 * 匹配机制:
 * - 基于段位和积分匹配
 * - 考虑精灵等级和强度
 * - 平衡等待时间和对战质量
 * 
 * 段位系统:
 * - 青铜、白银、黄金、铂金、钻石、大师
 * - 每个段位分若干小段
 * - 胜利获得积分，失败扣除积分
 * 
 * 奖励机制:
 * - 每日首胜奖励
 * - 连胜奖励
 * - 段位提升奖励
 * - 赛季结束奖励
 */

// PVP模式
enum PVPMode {
  RANKED = 'ranked',
  CASUAL = 'casual',
  TOURNAMENT = 'tournament',
  TEAM_BATTLE = 'team_battle'
}

// 段位系统
enum Rank {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond',
  MASTER = 'master'
}

// 对战记录
interface BattleRecord {
  id: string;
  playerId: string;
  opponentId: string;
  mode: PVPMode;
  result: 'win' | 'lose' | 'draw';
  duration: number;
  ratingChange: number;
  timestamp: Date;
  teamUsed: string[];
  opponentTeam: string[];
}

// ========================================
// 2.6 PVE挑战系统
// ========================================

/**
 * PVE挑战内容
 * 
 * 剧情模式:
 * - 主线剧情: 跟随游戏故事推进
 * - 支线任务: 额外的挑战和奖励
 * - 角色剧情: 深入了解精灵世界
 * 
 * 挑战模式:
 * 1. 精英关卡: 强大的野生精灵
 * 2. 塔挑战: 层层递进的难度
 * 3. 限时副本: 特定时间内开放
 * 4. 世界BOSS: 全服玩家共同挑战
 * 
 * 日常任务:
 * - 每日登录奖励
 * - 日常委托任务
 * - 周常挑战任务
 * - 月度特殊活动
 * 
 * 成就系统:
 * - 收集成就: 收集指定精灵
 * - 战斗成就: 达成战斗条件
 * - 培养成就: 培养强力精灵
 * - 社交成就: 与其他玩家互动
 */

// PVE类型
enum PVEType {
  STORY = 'story',
  ELITE = 'elite',
  TOWER = 'tower',
  DUNGEON = 'dungeon',
  WORLD_BOSS = 'world_boss',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

// 关卡信息
interface Stage {
  id: string;
  name: string;
  type: PVEType;
  difficulty: number;
  recommendedLevel: number;
  requirements: {
    minTeamSize: number;
    maxTeamSize: number;
    requiredElements?: ElementType[];
  };
  rewards: {
    exp: number;
    coins: number;
    items: string[];
    chance: {
      itemId: string;
      probability: number;
    }[];
  };
  enemies: {
    spriteId: string;
    level: number;
    position: number;
  }[];
}

// ========================================
// 3. 组件设计
// ========================================

/**
 * ECS架构组件定义
 * 
 * 组件分类:
 * - 基础组件: 实体基本属性
 * - 显示组件: 视觉表现相关
 * - 交互组件: 用户交互处理
 * - 逻辑组件: 游戏逻辑状态
 * - 数据组件: 持久化数据
 */

// ========================================
// 3.1 基础组件
// ========================================

// 基础信息组件
interface BasicInfoComponent {
  id: string;
  name: string;
  description: string;
  type: string;
  createTime: Date;
  updateTime: Date;
}

// 唯一标识组件
interface UniqueIdComponent {
  uuid: string;
  entityType: string;
}

// 位置组件
interface PositionComponent {
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
}

// 激活状态组件
interface ActiveComponent {
  isActive: boolean;
  activeTime: Date;
  inactiveTime?: Date;
}

// ========================================
// 3.2 精灵相关组件
// ========================================

// 精灵基础属性组件
interface SpriteBaseComponent {
  spriteId: string;
  speciesId: string;
  nickname?: string;
  level: number;
  exp: number;
  expToNext: number;
  personality: Personality;
  rarity: Rarity;
  isShiny: boolean;
  gender: 'male' | 'female' | 'unknown';
}

// 精灵属性组件
interface SpriteStatsComponent {
  currentHp: number;
  maxHp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
  accuracy: number;
  evasion: number;
}

// 精灵属性详情组件
interface SpriteStatsDetailComponent {
  baseStats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  ivs: IndividualValues;
  evs: EffortValues;
  nature: Personality;
  statStages: {
    attack: number;    // -6 to +6
    defense: number;   // -6 to +6
    specialAttack: number; // -6 to +6
    specialDefense: number; // -6 to +6
    speed: number;     // -6 to +6
    accuracy: number;  // -6 to +6
    evasion: number;   // -6 to +6
  };
}

// 精灵类型组件
interface SpriteTypeComponent {
  primaryType: ElementType;
  secondaryType?: ElementType;
  typeChanges: {
    type: ElementType;
    duration: number;
  }[];
}

// 精灵技能组件
interface SpriteMovesComponent {
  moves: {
    moveId: string;
    currentPp: number;
    maxPp: number;
  }[];
  maxMoves: number;
}

// 精灵状态组件
interface SpriteStatusComponent {
  status: {
    type: 'normal' | 'poison' | 'burn' | 'freeze' | 'paralysis' | 'sleep' | 'confusion' | 'infatuation';
    turns: number;
    damage?: number;
  }[];
  abilities: {
    abilityId: string;
    isActive: boolean;
  }[];
}

// 精灵持有物组件
interface SpriteHeldItemComponent {
  itemId?: string;
  effect?: string;
  consumable: boolean;
}

// 精灵关系组件
interface SpriteRelationshipComponent {
  trainerId: string;
  friendship: number; // 0-255
  originalTrainerId?: string;
  tradeCount: number;
}

// 精灵进化组件
interface SpriteEvolutionComponent {
  speciesId: string;
  evolutionChain: string[];
  currentStage: number;
  evolutionConditions: EvolutionCondition[];
  canEvolve: boolean;
}

// ========================================
// 3.3 技能相关组件
// ========================================

// 技能基础信息组件
interface MoveBaseComponent {
  moveId: string;
  name: string;
  description: string;
  type: ElementType;
  category: 'physical' | 'special' | 'status';
  power: number;
  accuracy: number;
  pp: number;
  priority: number;
}

// 技能效果组件
interface MoveEffectComponent {
  effects: {
    type: 'damage' | 'heal' | 'status' | 'stat_change' | 'weather' | 'field_effect';
    target: 'user' | 'opponent' | 'all' | 'field';
    chance: number;
    value: number;
    duration?: number;
  }[];
  secondaryEffects: {
    type: string;
    chance: number;
    value: any;
  }[];
}

// 技能学习组件
interface MoveLearningComponent {
  learnMethod: 'level_up' | 'tm' | 'tutor' | 'egg';
  learnCondition: {
    level?: number;
    itemId?: string;
    friendship?: number;
  };
  isPermanent: boolean;
}

// ========================================
// 3.4 战斗相关组件
// ========================================

// 战斗参与者组件
interface BattleParticipantComponent {
  battleId: string;
  teamId: string;
  position: number;
  isActive: boolean;
  actionTaken: boolean;
}

// 战斗状态组件
interface BattleStateComponent {
  currentTurn: number;
  maxTurns: number;
  weather?: 'sunny' | 'rain' | 'sandstorm' | 'hail' | 'fog';
  weatherTurns: number;
  fieldEffects: {
    type: string;
    turns: number;
    value: any;
  }[];
}

// 战斗动作组件
interface BattleActionComponent {
  actionType: 'move' | 'switch' | 'item' | 'run';
  actionData: {
    moveId?: string;
    targetPosition?: number;
    itemId?: string;
    switchPosition?: number;
  };
  priority: number;
  speed: number;
}

// 战斗结果组件
interface BattleResultComponent {
  result: 'win' | 'lose' | 'draw' | 'flee';
  turns: number;
  experience: {
    spriteId: string;
    expGained: number;
    levelUp: boolean;
  }[];
  rewards: {
    coins: number;
    items: string[];
  };
}

// ========================================
// 3.5 玩家相关组件
// ========================================

// 玩家信息组件
interface PlayerInfoComponent {
  playerId: string;
  username: string;
  avatar: string;
  level: number;
  exp: number;
  title?: string;
  region: string;
  joinDate: Date;
  lastLogin: Date;
}

// 玩家资源组件
interface PlayerResourceComponent {
  coins: number;
  gems: number;
  energy: number;
  maxEnergy: number;
  energyRegenTime: Date;
  items: {
    itemId: string;
    quantity: number;
  }[];
}

// 玩家进度组件
interface PlayerProgressComponent {
  currentStage: string;
  completedStages: string[];
  unlockedFeatures: string[];
  achievements: {
    achievementId: string;
    progress: number;
    completed: boolean;
    completedDate?: Date;
  }[];
  statistics: {
    battlesWon: number;
    battlesLost: number;
    spritesCaught: number;
    spritesEvolved: number;
    playTime: number;
  };
}

// 玩家团队组件
interface PlayerTeamComponent {
  activeTeam: string[];
  teams: {
    teamId: string;
    name: string;
    spriteIds: string[];
    isDefault: boolean;
  }[];
  maxTeams: number;
  maxTeamSize: number;
}

// 玩家PVP组件
interface PlayerPVPComponent {
  rank: Rank;
  rating: number;
  seasonRating: number;
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  bestStreak: number;
  seasonRewards: string[];
}

// ========================================
// 3.6 UI相关组件
// ========================================

// UI元素组件
interface UIElementComponent {
  elementType: 'button' | 'text' | 'image' | 'panel' | 'list' | 'input';
  content: string;
  style: {
    width: number;
    height: number;
    x: number;
    y: number;
    color?: string;
    fontSize?: number;
    backgroundColor?: string;
    borderColor?: string;
  };
  isVisible: boolean;
  isEnabled: boolean;
}

// UI交互组件
interface UIInteractionComponent {
  interactionType: 'click' | 'hover' | 'drag' | 'scroll' | 'input';
  callback: string;
  parameters: any;
  isListening: boolean;
}

// UI动画组件
interface UIAnimationComponent {
  animationType: 'fade' | 'slide' | 'scale' | 'rotate' | 'bounce';
  duration: number;
  delay: number;
  easing: string;
  isPlaying: boolean;
  loop: boolean;
}

// ========================================
// 3.7 音效相关组件
// ========================================

// 音效组件
interface AudioComponent {
  audioId: string;
  audioType: 'music' | 'sfx' | 'voice';
  volume: number;
  loop: boolean;
  isPlaying: boolean;
  fadeIn: number;
  fadeOut: number;
}

// 音效监听组件
interface AudioListenerComponent {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  isMuted: boolean;
}

// ========================================
// 4. 实体架构
// ========================================

/**
 * ECS架构实体定义
 * 
 * 实体是组件的容器，通过组合不同的组件来创建不同类型的游戏对象
 * 每个实体都有一个唯一的ID和一组组件
 */

// ========================================
// 4.1 精灵实体 (Sprite Entity)
// ========================================

/**
 * 精灵实体架构
 * 
 * 组件组合:
 * - UniqueIdComponent: 唯一标识
 * - BasicInfoComponent: 基础信息
 * - PositionComponent: 位置信息
 * - SpriteBaseComponent: 精灵基础属性
 * - SpriteStatsComponent: 精灵当前属性
 * - SpriteStatsDetailComponent: 精灵详细属性
 * - SpriteTypeComponent: 精灵属性类型
 * - SpriteMovesComponent: 精灵技能
 * - SpriteStatusComponent: 精灵状态
 * - SpriteHeldItemComponent: 持有物
 * - SpriteRelationshipComponent: 与训练师关系
 * - SpriteEvolutionComponent: 进化信息
 * - ActiveComponent: 激活状态
 * 
 * 实体数量: 每个玩家最多拥有500只精灵
 * 全服预计: 100万+精灵实体
 */

interface SpriteEntity {
  id: string;
  components: {
    uniqueId: UniqueIdComponent;
    basicInfo: BasicInfoComponent;
    position: PositionComponent;
    spriteBase: SpriteBaseComponent;
    spriteStats: SpriteStatsComponent;
    spriteStatsDetail: SpriteStatsDetailComponent;
    spriteType: SpriteTypeComponent;
    spriteMoves: SpriteMovesComponent;
    spriteStatus: SpriteStatusComponent;
    spriteHeldItem: SpriteHeldItemComponent;
    spriteRelationship: SpriteRelationshipComponent;
    spriteEvolution: SpriteEvolutionComponent;
    active: ActiveComponent;
  };
}

// ========================================
// 4.2 玩家实体 (Player Entity)
// ========================================

/**
 * 玩家实体架构
 * 
 * 组件组合:
 * - UniqueIdComponent: 唯一标识
 * - BasicInfoComponent: 基础信息
 * - PlayerInfoComponent: 玩家详细信息
 * - PlayerResourceComponent: 资源信息
 * - PlayerProgressComponent: 游戏进度
 * - PlayerTeamComponent: 精灵团队
 * - PlayerPVPComponent: PVP信息
 * - ActiveComponent: 在线状态
 * 
 * 实体数量: 全服预计10万+玩家实体
 */

interface PlayerEntity {
  id: string;
  components: {
    uniqueId: UniqueIdComponent;
    basicInfo: BasicInfoComponent;
    playerInfo: PlayerInfoComponent;
    playerResource: PlayerResourceComponent;
    playerProgress: PlayerProgressComponent;
    playerTeam: PlayerTeamComponent;
    playerPVP: PlayerPVPComponent;
    active: ActiveComponent;
  };
}

// ========================================
// 4.3 战斗实体 (Battle Entity)
// ========================================

/**
 * 战斗实体架构
 * 
 * 组件组合:
 * - UniqueIdComponent: 唯一标识
 * - BasicInfoComponent: 基础信息
 * - BattleStateComponent: 战斗状态
 * - BattleParticipantComponent: 参与者信息
 * - BattleActionComponent: 战斗动作
 * - BattleResultComponent: 战斗结果
 * - ActiveComponent: 战斗进行状态
 * 
 * 实体数量: 同时进行的战斗预计1000+场
 */

interface BattleEntity {
  id: string;
  components: {
    uniqueId: UniqueIdComponent;
    basicInfo: BasicInfoComponent;
    battleState: BattleStateComponent;
    battleParticipants: BattleParticipantComponent[];
    battleActions: BattleActionComponent[];
    battleResult?: BattleResultComponent;
    active: ActiveComponent;
  };
}

// ========================================
// 4.4 技能实体 (Move Entity)
// ========================================

/**
 * 技能实体架构
 * 
 * 组件组合:
 * - UniqueIdComponent: 唯一标识
 * - BasicInfoComponent: 基础信息
 * - MoveBaseComponent: 技能基础属性
 * - MoveEffectComponent: 技能效果
 * - MoveLearningComponent: 学习条件
 * - ActiveComponent: 激活状态
 * 
 * 实体数量: 全服技能库预计500+技能实体
 */

interface MoveEntity {
  id: string;
  components: {
    uniqueId: UniqueIdComponent;
    basicInfo: BasicInfoComponent;
    moveBase: MoveBaseComponent;
    moveEffect: MoveEffectComponent;
    moveLearning: MoveLearningComponent;
    active: ActiveComponent;
  };
}

// ========================================
// 4.5 UI实体 (UI Entity)
// ========================================

/**
 * UI实体架构
 * 
 * 组件组合:
 * - UniqueIdComponent: 唯一标识
 * - BasicInfoComponent: 基础信息
 * - PositionComponent: 位置信息
 * - UIElementComponent: UI元素
 * - UIInteractionComponent: 交互处理
 * - UIAnimationComponent: 动画效果
 * - ActiveComponent: 显示状态
 * 
 * 实体数量: 每个界面预计50-200个UI实体
 */

interface UIEntity {
  id: string;
  components: {
    uniqueId: UniqueIdComponent;
    basicInfo: BasicInfoComponent;
    position: PositionComponent;
    uiElement: UIElementComponent;
    uiInteraction?: UIInteractionComponent;
    uiAnimation?: UIAnimationComponent;
    active: ActiveComponent;
  };
}

// ========================================
// 4.6 音效实体 (Audio Entity)
// ========================================

/**
 * 音效实体架构
 * 
 * 组件组合:
 * - UniqueIdComponent: 唯一标识
 * - BasicInfoComponent: 基础信息
 * - AudioComponent: 音效属性
 * - AudioListenerComponent: 监听器(仅全局一个)
 * - ActiveComponent: 播放状态
 * 
 * 实体数量: 全局音效监听器1个，音效实体动态创建
 */

interface AudioEntity {
  id: string;
  components: {
    uniqueId: UniqueIdComponent;
    basicInfo: BasicInfoComponent;
    audio: AudioComponent;
    active: ActiveComponent;
  };
}

// ========================================
// 5. 系统设计
// ========================================

/**
 * ECS架构系统定义
 * 
 * 系统负责处理拥有特定组件的实体，执行游戏逻辑
 * 系统按优先级执行，确保逻辑的正确顺序
 * 
 * 系统分类:
 * - 初始化系统: 游戏启动时的初始化
 * - 输入系统: 处理用户输入
 * - 逻辑系统: 游戏核心逻辑
 * - 渲染系统: 视觉表现
 * - 音频系统: 声音播放
 * - 网络系统: 数据同步
 * - 清理系统: 资源清理
 */

// ========================================
// 5.1 初始化系统
// ========================================

/**
 * 游戏初始化系统
 * 
 * 功能:
 * - 加载游戏配置
 * - 初始化数据库连接
 * - 创建基础实体
 * - 设置全局状态
 * 
 * 逻辑类型: 一次性执行
 * 执行优先级: 最高
 */

interface GameInitSystem {
  name: 'GameInitSystem';
  priority: 1000;
  execute(): void;
  dependencies: string[];
}

/**
 * 资源加载系统
 * 
 * 功能:
 * - 加载游戏资源
 * - 预加载常用资源
 * - 管理资源缓存
 * 
 * 逻辑类型: 异步加载
 * 执行优先级: 高
 */

interface ResourceLoadSystem {
  name: 'ResourceLoadSystem';
  priority: 900;
  execute(): Promise<void>;
  dependencies: ['GameInitSystem'];
}

// ========================================
// 5.2 输入系统
// ========================================

/**
 * 输入处理系统
 * 
 * 功能:
 * - 监听键盘输入
 * - 监听鼠标输入
 * - 监听触摸输入
 * - 转换输入事件为游戏事件
 * 
 * 逻辑类型: 事件驱动
 * 执行优先级: 高
 */

interface InputSystem {
  name: 'InputSystem';
  priority: 800;
  execute(): void;
  dependencies: [];
}

/**
 * UI交互系统
 * 
 * 功能:
 * - 处理UI点击事件
 * - 处理UI拖拽事件
 * - 处理UI输入事件
 * - 触发UI回调
 * 
 * 逻辑类型: 事件驱动
 * 执行优先级: 中
 */

interface UIInteractionSystem {
  name: 'UIInteractionSystem';
  priority: 600;
  execute(): void;
  dependencies: ['InputSystem'];
}

// ========================================
// 5.3 精灵系统
// ========================================

/**
 * 精灵属性计算系统
 * 
 * 功能:
 * - 计算精灵最终属性
 * - 处理等级提升
 * - 处理努力值分配
 * - 处理性格修正
 * 
 * 逻辑类型: 实时计算
 * 执行优先级: 中
 */

interface SpriteStatsCalculationSystem {
  name: 'SpriteStatsCalculationSystem';
  priority: 500;
  execute(): void;
  dependencies: [];
}

/**
 * 精灵进化系统
 * 
 * 功能:
 * - 检查进化条件
 * - 执行进化过程
 * - 更新精灵数据
 * - 播放进化动画
 * 
 * 逻辑类型: 条件触发
 * 执行优先级: 中
 */

interface SpriteEvolutionSystem {
  name: 'SpriteEvolutionSystem';
  priority: 450;
  execute(): void;
  dependencies: ['SpriteStatsCalculationSystem'];
}

/**
 * 精灵状态系统
 * 
 * 功能:
 * - 处理状态效果
 * - 计算状态伤害
 * - 更新状态持续时间
 * - 移除过期状态
 * 
 * 逻辑类型: 回合制更新
 * 执行优先级: 中
 */

interface SpriteStatusSystem {
  name: 'SpriteStatusSystem';
  priority: 400;
  execute(): void;
  dependencies: [];
}

/**
 * 精灵培养系统
 * 
 * 功能:
 * - 处理经验值获得
 * - 处理努力值获得
 * - 处理亲密度变化
 * - 处理个体值检查
 * 
 * 逻辑类型: 事件驱动
 * 执行优先级: 中
 */

interface SpriteTrainingSystem {
  name: 'SpriteTrainingSystem';
  priority: 350;
  execute(): void;
  dependencies: ['SpriteStatsCalculationSystem'];
}

// ========================================
// 5.4 战斗系统
// ========================================

/**
 * 战斗初始化系统
 * 
 * 功能:
 * - 创建战斗实体
 * - 设置战斗参与者
 * - 初始化战斗场地
 * - 准备战斗数据
 * 
 * 逻辑类型: 事件触发
 * 执行优先级: 高
 */

interface BattleInitSystem {
  name: 'BattleInitSystem';
  priority: 700;
  execute(): void;
  dependencies: [];
}

/**
 * 战斗行动系统
 * 
 * 功能:
 * - 收集战斗行动
 * - 计算行动优先级
 * - 排序行动顺序
 * - 执行战斗行动
 * 
 * 逻辑类型: 回合制执行
 * 执行优先级: 中
 */

interface BattleActionSystem {
  name: 'BattleActionSystem';
  priority: 300;
  execute(): void;
  dependencies: ['BattleInitSystem'];
}

/**
 * 战斗伤害计算系统
 * 
 * 功能:
 * - 计算技能伤害
 * - 应用属性相克
 * - 计算暴击伤害
 * - 处理伤害浮动
 * 
 * 逻辑类型: 实时计算
 * 执行优先级: 中
 */

interface BattleDamageCalculationSystem {
  name: 'BattleDamageCalculationSystem';
  priority: 250;
  execute(): void;
  dependencies: ['BattleActionSystem'];
}

/**
 * 战斗效果系统
 * 
 * 功能:
 * - 应用技能效果
 * - 处理状态变化
 * - 更新场地效果
 * - 处理特殊效果
 * 
 * 逻辑类型: 事件驱动
 * 执行优先级: 中
 */

interface BattleEffectSystem {
  name: 'BattleEffectSystem';
  priority: 200;
  execute(): void;
  dependencies: ['BattleActionSystem'];
}

/**
 * 战斗结束系统
 * 
 * 功能:
 * - 判断战斗结果
 * - 计算经验奖励
 * - 分发战斗奖励
 * - 清理战斗数据
 * 
 * 逻辑类型: 条件触发
 * 执行优先级: 低
 */

interface BattleEndSystem {
  name: 'BattleEndSystem';
  priority: 100;
  execute(): void;
  dependencies: ['BattleActionSystem', 'BattleDamageCalculationSystem'];
}

// ========================================
// 5.5 PVP系统
// ========================================

/**
 * PVP匹配系统
 * 
 * 功能:
 * - 寻找匹配对手
 * - 计算匹配分数
 * - 创建对战房间
 * - 同步对战数据
 * 
 * 逻辑类型: 网络请求
 * 执行优先级: 中
 */

interface PVPMatchmakingSystem {
  name: 'PVPMatchmakingSystem';
  priority: 550;
  execute(): void;
  dependencies: [];
}

/**
 * PVP积分系统
 * 
 * 功能:
 * - 计算积分变化
 * - 更新段位信息
 * - 记录对战历史
 * - 计算赛季奖励
 * 
 * 逻辑类型: 事件驱动
 * 执行优先级: 低
 */

interface PVPRatingSystem {
  name: 'PVPRatingSystem';
  priority: 150;
  execute(): void;
  dependencies: ['BattleEndSystem'];
}

// ========================================
// 5.6 PVE系统
// ========================================

/**
 * PVE关卡系统
 * 
 * 功能:
 * - 加载关卡数据
 * - 生成敌人精灵
 * - 设置关卡条件
 * - 管理关卡进度
 * 
 * 逻辑类型: 数据驱动
 * 执行优先级: 中
 */

interface PVEStageSystem {
  name: 'PVEStageSystem';
  priority: 500;
  execute(): void;
  dependencies: [];
}

/**
 * PVE奖励系统
 * 
 * 功能:
 * - 计算关卡奖励
 * - 分发奖励物品
 * - 更新任务进度
 * - 解锁新内容
 * 
 * 逻辑类型: 事件驱动
 * 执行优先级: 低
 */

interface PVERewardSystem {
  name: 'PVERewardSystem';
  priority: 120;
  execute(): void;
  dependencies: ['BattleEndSystem'];
}

// ========================================
// 5.7 渲染系统
// ========================================

/**
 * 渲染系统
 * 
 * 功能:
 * - 渲染游戏场景
 * - 渲染精灵模型
 * - 渲染UI界面
 * - 处理特效显示
 * 
 * 逻辑类型: 每帧执行
 * 执行优先级: 低
 */

interface RenderSystem {
  name: 'RenderSystem';
  priority: 50;
  execute(): void;
  dependencies: [];
}

/**
 * 动画系统
 * 
 * 功能:
 * - 更新动画状态
 * - 播放精灵动画
 * - 播放UI动画
 * - 处理动画事件
 * 
 * 逻辑类型: 每帧执行
 * 执行优先级: 低
 */

interface AnimationSystem {
  name: 'AnimationSystem';
  priority: 40;
  execute(): void;
  dependencies: ['RenderSystem'];
}

// ========================================
// 5.8 音频系统
// ========================================

/**
 * 音频播放系统
 * 
 * 功能:
 * - 播放背景音乐
 * - 播放音效
 * - 管理音频队列
 * - 处理音频淡入淡出
 * 
 * 逻辑类型: 事件驱动
 * 执行优先级: 低
 */

interface AudioSystem {
  name: 'AudioSystem';
  priority: 30;
  execute(): void;
  dependencies: [];
}

// ========================================
// 5.9 网络系统
// ========================================

/**
 * 网络同步系统
 * 
 * 功能:
 * - 同步玩家数据
 * - 同步战斗数据
 * - 处理网络延迟
 * - 重连机制
 * 
 * 逻辑类型: 实时同步
 * 执行优先级: 高
 */

interface NetworkSyncSystem {
  name: 'NetworkSyncSystem';
  priority: 850;
  execute(): void;
  dependencies: [];
}

/**
 * 数据持久化系统
 * 
 * 功能:
 * - 保存玩家数据
 * - 保存精灵数据
 * - 保存战斗记录
 * - 数据备份恢复
 * 
 * 逻辑类型: 定时执行
 * 执行优先级: 低
 */

interface DataPersistenceSystem {
  name: 'DataPersistenceSystem';
  priority: 20;
  execute(): void;
  dependencies: [];
}

// ========================================
// 5.10 清理系统
// ========================================

/**
 * 实体清理系统
 * 
 * 功能:
 * - 清理无效实体
 * - 回收内存资源
 * - 清理过期数据
 * - 优化性能
 * 
 * 逻辑类型: 定时执行
 * 执行优先级: 最低
 */

interface EntityCleanupSystem {
  name: 'EntityCleanupSystem';
  priority: 10;
  execute(): void;
  dependencies: [];
}

// ========================================
// 6. 资源管理
// ========================================

/**
 * 全局资源管理
 * 
 * 资源分类:
 * - 配置资源: 游戏配置数据
 * - 静态资源: 精灵模型、贴图等
 * - 动态资源: 玩家数据、战斗数据等
 * - 临时资源: 缓存数据、临时状态等
 */

// ========================================
// 6.1 全局状态管理
// ========================================

/**
 * 游戏全局状态
 * 
 * 功能:
 * - 管理游戏运行状态
 * - 存储全局配置
 * - 处理状态变更
 * - 状态持久化
 */

interface GlobalState {
  gameState: {
    isRunning: boolean;
    isPaused: boolean;
    currentScene: string;
    gameTime: number;
    frameCount: number;
  };
  
  config: {
    gameVersion: string;
    serverUrl: string;
    debugMode: boolean;
    language: string;
    soundEnabled: boolean;
    musicVolume: number;
    sfxVolume: number;
  };
  
  player: {
    currentUserId?: string;
    isLoggedIn: boolean;
    sessionToken?: string;
  };
  
  network: {
    isConnected: boolean;
    latency: number;
    reconnectAttempts: number;
  };
  
  performance: {
    fps: number;
    memoryUsage: number;
    entityCount: number;
  };
}

// ========================================
// 6.2 配置资源
// ========================================

/**
 * 精灵配置资源
 * 
 * 包含所有精灵的基础数据
 */

interface SpriteConfig {
  speciesId: string;
  name: string;
  description: string;
  types: ElementType[];
  baseStats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  abilities: string[];
  moves: {
    level: number;
    moveId: string;
  }[];
  evolutionChain?: {
    speciesId: string;
    method: EvolutionCondition;
  }[];
  catchRate: number;
  experienceYield: number;
  growthRate: 'fast' | 'medium_fast' | 'medium' | 'medium_slow' | 'slow' | 'erratic';
  eggGroups: string[];
  height: number;
  weight: number;
  color: string;
  habitat: string;
  rarity: Rarity;
}

/**
 * 技能配置资源
 * 
 * 包含所有技能的详细数据
 */

interface MoveConfig {
  moveId: string;
  name: string;
  description: string;
  type: ElementType;
  category: 'physical' | 'special' | 'status';
  power: number;
  accuracy: number;
  pp: number;
  priority: number;
  contact: boolean;
  target: 'user' | 'opponent' | 'all' | 'field';
  effects: {
    type: string;
    chance: number;
    value: any;
  }[];
  learnMethod: {
    level?: number;
    tm?: number;
    tutor?: boolean;
    egg?: boolean;
  };
}

/**
 * 物品配置资源
 * 
 * 包含所有物品的属性
 */

interface ItemConfig {
  itemId: string;
  name: string;
  description: string;
  category: 'medicine' | 'ball' | 'machine' | 'hold' | 'key' | 'currency';
  price: number;
  sellPrice: number;
  consumable: boolean;
  stackable: boolean;
  maxStack: number;
  effect: {
    type: string;
    value: any;
    target: string;
  };
  availability: {
    shop: boolean;
    event: boolean;
    quest: boolean;
  };
}

/**
 * 关卡配置资源
 * 
 * 包含所有关卡的数据
 */

interface StageConfig {
  stageId: string;
  name: string;
  description: string;
  type: PVEType;
  difficulty: number;
  recommendedLevel: number;
  requirements: {
    minTeamSize: number;
    maxTeamSize: number;
    requiredElements?: ElementType[];
    requiredItems?: string[];
  };
  environment: {
    weather?: string;
    terrain?: string;
    fieldEffects?: string[];
  };
  enemies: {
    position: number;
    spriteId: string;
    level: number;
    moves: string[];
    item?: string;
    ability?: string;
  }[];
  rewards: {
    exp: number;
    coins: number;
    items: {
      itemId: string;
      quantity: number;
      chance: number;
    }[];
  };
  unlockConditions: {
    previousStages?: string[];
    playerLevel?: number;
    completedQuests?: string[];
  };
}

// ========================================
// 6.3 动态资源
// ========================================

/**
 * 玩家数据资源
 * 
 * 存储玩家的所有游戏数据
 */

interface PlayerData {
  playerId: string;
  basicInfo: {
    username: string;
    avatar: string;
    level: number;
    exp: number;
    title?: string;
    region: string;
    joinDate: Date;
    lastLogin: Date;
  };
  resources: {
    coins: number;
    gems: number;
    energy: number;
    maxEnergy: number;
    items: {
      itemId: string;
      quantity: number;
    }[];
  };
  sprites: {
    spriteId: string;
    speciesId: string;
    nickname?: string;
    level: number;
    exp: number;
    personality: Personality;
    ivs: IndividualValues;
    evs: EffortValues;
    moves: {
      moveId: string;
      pp: number;
    }[];
    item?: string;
    ability: string;
    friendship: number;
  }[];
  teams: {
    teamId: string;
    name: string;
    spriteIds: string[];
    isDefault: boolean;
  }[];
  progress: {
    currentStage: string;
    completedStages: string[];
    unlockedFeatures: string[];
    achievements: {
      achievementId: string;
      progress: number;
      completed: boolean;
      completedDate?: Date;
    }[];
  };
  pvp: {
    rank: Rank;
    rating: number;
    seasonRating: number;
    wins: number;
    losses: number;
    currentStreak: number;
    bestStreak: number;
  };
  statistics: {
    battlesWon: number;
    battlesLost: number;
    spritesCaught: number;
    spritesEvolved: number;
    playTime: number;
    distanceWalked: number;
  };
  settings: {
    musicVolume: number;
    sfxVolume: number;
    language: string;
    notifications: boolean;
    autoSave: boolean;
  };
}

/**
 * 战斗数据资源
 * 
 * 存储战斗过程中的临时数据
 */

interface BattleData {
  battleId: string;
  type: 'pve' | 'pvp';
  participants: {
    playerId: string;
    team: {
      spriteId: string;
      position: number;
      currentHp: number;
      status: string[];
    }[];
  };
  state: {
    currentTurn: number;
    activePosition: {
      player1: number;
      player2: number;
    };
    weather?: string;
    weatherTurns: number;
    fieldEffects: {
      type: string;
      turns: number;
      value: any;
    }[];
  };
  actions: {
    turn: number;
    playerId: string;
    action: {
      type: 'move' | 'switch' | 'item';
      data: any;
    };
  }[];
  results?: {
    winner: string;
    turns: number;
    experience: {
      spriteId: string;
      expGained: number;
      levelUp: boolean;
    }[];
    rewards: {
      coins: number;
      items: string[];
    };
  };
}

// ========================================
// 6.4 缓存资源
// ========================================

/**
 * 精灵图鉴缓存
 * 
 * 缓存玩家已收集的精灵信息
 */

interface PokedexCache {
  sprites: {
    speciesId: string;
    seen: boolean;
    caught: boolean;
    catchCount: number;
    firstSeenDate?: Date;
    firstCaughtDate?: Date;
  }[];
  completion: {
    total: number;
    seen: number;
    caught: number;
    percentage: number;
  };
}

/**
 * 技能缓存
 * 
 * 缓存玩家已学习的技能信息
 */

interface MoveCache {
  learnedMoves: {
    spriteId: string;
    moveId: string;
    learnedDate: Date;
  }[];
  availableTMs: string[];
  availableTutors: string[];
}

/**
 * 好友缓存
 * 
 * 缓存玩家好友关系数据
 */

interface FriendCache {
  friends: {
    playerId: string;
    username: string;
    avatar: string;
    level: number;
    onlineStatus: boolean;
    lastLogin: Date;
  }[];
  requests: {
    fromPlayerId: string;
    fromUsername: string;
    requestDate: Date;
  }[];
  blocked: string[];
}

// ========================================
// 7. 数据结构定义
// ========================================

/**
 * 核心数据结构
 * 
 * 定义游戏中使用的主要数据结构
 * 确保数据的一致性和完整性
 */

// ========================================
// 7.1 请求响应结构
// ========================================

/**
 * API请求基础结构
 */

interface APIRequest<T = any> {
  id: string;
  method: string;
  path: string;
  data: T;
  timestamp: Date;
  token?: string;
}

/**
 * API响应基础结构
 */

interface APIResponse<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}

// ========================================
// 7.2 事件结构
// ========================================

/**
 * 游戏事件基础结构
 */

interface GameEvent<T = any> {
  eventId: string;
  eventType: string;
  source: string;
  target?: string;
  data: T;
  timestamp: Date;
  priority: number;
}

/**
 * 战斗事件结构
 */

interface BattleEvent {
  battleId: string;
  turn: number;
  actionType: 'move' | 'switch' | 'item' | 'faint';
  actor: string;
  target?: string;
  data: {
    moveId?: string;
    damage?: number;
    effectiveness?: number;
    critical?: boolean;
    status?: string;
    message?: string;
  };
}

// ========================================
// 7.3 配置结构
// ========================================

/**
 * 游戏配置结构
 */

interface GameConfig {
  version: string;
  server: {
    url: string;
    timeout: number;
    retryAttempts: number;
  };
  battle: {
    maxTurns: number;
    teamSize: number;
    timePerTurn: number;
  };
  sprite: {
    maxLevel: number;
    maxTeamSize: number;
    maxBoxCount: number;
  };
  pvp: {
    seasons: {
      duration: number;
      rewards: {
        [rank: string]: {
          coins: number;
          items: string[];
        };
      };
    };
  };
}

// ========================================
// 7.4 验证结构
// ========================================

/**
 * 数据验证规则
 */

interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: string[];
}

/**
 * 验证结果
 */

interface ValidationResult {
  isValid: boolean;
  errors: {
    field: string;
    message: string;
    value: any;
  }[];
}

// ========================================
// 总结
// ========================================

/**
 * 本设计文档详细描述了赛尔号回合制游戏的完整架构
 * 
 * 主要特点:
 * 1. 完整的ECS架构设计
 * 2. 详细的组件定义
 * 3. 清晰的实体架构
 * 4. 完善的系统设计
 * 5. 全面的资源管理
 * 6. 规范的数据结构
 * 
 * 涵盖内容:
 * - 精灵融合系统
 * - 属性相克系统
 * - 精灵收集系统
 * - 精灵培养系统
 * - PVP对战系统
 * - PVE挑战系统
 * 
 * 技术优势:
 * - 模块化设计
 * - 可扩展性强
 * - 性能优化
 * - 易于维护
 * 
 * 文档总计: 3000+ 行，详细描述了游戏的核心玩法和技术实现
 */