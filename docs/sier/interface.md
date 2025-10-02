# 赛尔号游戏架构设计文档

## 目录
1. [游戏概述](#游戏概述)
2. [核心玩法系统](#核心玩法系统)
3. [实体与组件系统](#实体与组件系统)
4. [资源管理系统](#资源管理系统)
5. [战斗系统架构](#战斗系统架构)
6. [精灵培养系统](#精灵培养系统)
7. [PVP系统设计](#pvp系统设计)
8. [PVE系统设计](#pve系统设计)
9. [UI系统架构](#ui系统架构)
10. [数据持久化](#数据持久化)

---

## 游戏概述

赛尔号是一款以精灵收集、培养、战斗为核心的回合制RPG游戏。玩家扮演赛尔，在宇宙中探索、收集各种精灵，通过培养提升精灵能力，进行PVP和PVE战斗。

### 核心设计理念
- **收集与培养**: 丰富的精灵收集系统和深度的培养机制
- **策略战斗**: 基于属性相克的回合制战斗系统
- **社交竞技**: PVP对战和排行榜系统
- **探索冒险**: PVE副本和剧情推进

---

## 核心玩法系统

### 1. 精灵收集系统

#### 野生精灵捕获
```typescript
// 野生精灵数据组件
interface WildPokemonComponent {
  speciesId: string;           // 精灵种类ID
  level: number;               // 等级
  nature: NatureType;          // 性格
  ivs: IVStats;               // 个体值
  captureRate: number;        // 捕获率
  location: string;           // 出现地点
  spawnConditions: SpawnCondition[]; // 出现条件
}

// 捕获道具组件
interface CaptureItemComponent {
  itemId: string;
  capturePower: number;       // 捕获威力
  typeBonus: PokemonType[];   // 属性加成
  conditionBonus: number;     // 状态加成
}

// 捕获系统
interface CaptureSystem {
  calculateCaptureRate(pokemon: Entity, item: Entity): number;
  attemptCapture(pokemon: Entity, item: Entity): CaptureResult;
  handleCaptureSuccess(pokemon: Entity, trainer: Entity): void;
}
```

#### 精灵获取方式
- **野外捕获**: 在地图中遇到野生精灵并使用精灵球捕获
- **任务奖励**: 完成特定任务获得稀有精灵
- **进化获取**: 通过精灵进化获得新形态
- **交换获取**: 与其他玩家交换精灵
- **活动获取**: 参与限时活动获得限定精灵

### 2. 属性相克系统

#### 属性定义
```typescript
// 精灵属性枚举
enum PokemonType {
  NORMAL = 'normal',
  FIRE = 'fire',
  WATER = 'water',
  GRASS = 'grass',
  ELECTRIC = 'electric',
  PSYCHIC = 'psychic',
  ICE = 'ice',
  DRAGON = 'dragon',
  DARK = 'dark',
  FAIRY = 'fairy',
  FIGHTING = 'fighting',
  FLYING = 'flying',
  POISON = 'poison',
  GROUND = 'ground',
  ROCK = 'rock',
  BUG = 'bug',
  GHOST = 'ghost',
  STEEL = 'steel'
}

// 属性相克表
interface TypeEffectiveness {
  [attacker: string]: {
    [defender: string]: number; // 0.5, 1, 2 分别代表效果不彰、正常、效果拔群
  };
}

// 属性相克组件
interface TypeMatchupComponent {
  types: PokemonType[];        // 精灵属性（最多双属性）
  effectiveness: TypeEffectiveness;
  weaknesses: PokemonType[];   // 弱点属性
  resistances: PokemonType[];  // 抵抗属性
  immunities: PokemonType[];   // 免疫属性
}
```

#### 相克计算规则
- **效果拔群**: 伤害×2.0
- **效果不彰**: 伤害×0.5
- **无效**: 伤害×0
- **双属性**: 分别计算后相乘

### 3. 精灵融合系统

#### 融合机制
```typescript
// 融合配方组件
interface FusionRecipeComponent {
  recipeId: string;
  mainPokemon: string;         // 主精灵
  materialPokemons: string[];  // 材料精灵
  resultPokemon: string;       // 结果精灵
  fusionLevel: number;         // 融合等级
  conditions: FusionCondition[]; // 融合条件
}

// 融合条件
interface FusionCondition {
  type: 'level' | 'friendship' | 'item' | 'time' | 'location';
  value: any;
  description: string;
}

// 融合系统
interface FusionSystem {
  checkFusionPossibility(pokemons: Entity[]): FusionRecipeComponent | null;
  executeFusion(recipe: FusionRecipeComponent, pokemons: Entity[]): Entity;
  calculateFusionStats(parent1: Entity, parent2: Entity): PokemonStats;
}
```

#### 融合规则
- **主材选择**: 选择一只主精灵和1-3只材料精灵
- **等级要求**: 主精灵和材料精灵需达到指定等级
- **亲密度要求**: 部分融合需要精灵间亲密度达标
- **特殊道具**: 某些融合需要特定融合道具
- **成功率**: 根据条件满足度计算融合成功率

### 4. 精灵培养系统

#### 性格系统
```typescript
// 性格枚举
enum NatureType {
  HARDY = 'hardy',       // 固执
  LONELY = 'lonely',     // 孤僻
  BRAVE = 'brave',       // 勇敢
  ADAMANT = 'adamant',   // 顽皮
  NAUGHTY = 'naughty',   // 调皮
  BOLD = 'bold',         // 大胆
  DOCILE = 'docile',     // 沉着
  RELAXED = 'relaxed',   // 悠闲
  IMPISH = 'impish',     // 淘气
  LAX = 'lax',           // 马虎
  TIMID = 'timid',       // 胆小
  HASTY = 'hasty',       // 急躁
  SERIOUS = 'serious',   // 冷静
  JOLLY = 'jolly',       // 开朗
  NAIVE = 'naive',       // 天真
  MODEST = 'modest',     // 保守
  MILD = 'mild',         // 稳重
  QUIET = 'quiet',       // 害羞
  BASHFUL = 'bashful',   // 内向
  RASH = 'rash',         // 鲁莽
  CALM = 'calm',         // 沉着
  GENTLE = 'gentle',     // 温和
  SASSY = 'sassy',       // 傲慢
  CAREFUL = 'careful',   // 谨慎
  QUIRKY = 'quirky'      // 古怪
}

// 性格效果组件
interface NatureComponent {
  nature: NatureType;
  increasedStat: StatType | null;  // 增加的属性
  decreasedStat: StatType | null;  // 减少的属性
  flavorPreference: FlavorType;    // 喜好的味道
}
```

#### 个体值系统
```typescript
// 个体值（IV）组件
interface IVComponent {
  hp: number;        // HP个体值 (0-31)
  attack: number;    // 攻击个体值 (0-31)
  defense: number;   // 防御个体值 (0-31)
  spAttack: number;  // 特攻个体值 (0-31)
  spDefense: number; // 特防个体值 (0-31)
  speed: number;     // 速度个体值 (0-31)

  // 计算方法
  getTotalIVs(): number;
  getIVPercentage(): number;
  isPerfect(): boolean;
}

// 个体值继承规则
interface IVInheritanceRule {
  parentCount: number;           // 参与遗传的亲代数量
  inheritedCount: number;        // 遗传的个体值数量
  guaranteedStats: StatType[];   // 必定遗传的属性
  randomInheritance: boolean;    // 是否随机选择遗传属性
}
```

#### 努力值系统
```typescript
// 努力值（EV）组件
interface EVComponent {
  hp: number;        // HP努力值 (0-252)
  attack: number;    // 攻击努力值 (0-252)
  defense: number;   // 防御努力值 (0-252)
  spAttack: number;  // 特攻努力值 (0-252)
  spDefense: number; // 特防努力值 (0-252)
  speed: number;     // 速度努力值 (0-252)

  // 总努力值上限
  totalEVs: number;  // 总努力值 (0-510)

  // 方法
  getTotalEVs(): number;
  canAddEV(stat: StatType, amount: number): boolean;
  addEV(stat: StatType, amount: number): boolean;
  resetEVs(): void;
}

// 努力值获取来源
interface EVSource {
  sourceType: 'battle' | 'item' | 'vitamin' | 'berry';
  pokemonDefeated?: string;      // 击败的精灵
  itemUsed?: string;            // 使用的道具
  evGained: EVComponent;        // 获得的努力值
  conditions?: string[];        // 获取条件
}
```

#### 等级与经验值系统
```typescript
// 经验值组件
interface ExperienceComponent {
  currentExp: number;           // 当前经验值
  expToNextLevel: number;       // 升到下一级所需经验
  totalExp: number;             // 总经验值
  level: number;                // 当前等级
  expYield: number;             // 给予的经验值
  growthRate: GrowthRateType;   // 经验值成长率
}

// 经验值成长率类型
enum GrowthRateType {
  ERRATIC = 'erratic',      // 不规律
  FAST = 'fast',            // 快速
  MEDIUM_FAST = 'medium_fast', // 中等快速
  MEDIUM_SLOW = 'medium_slow', // 中等缓慢
  SLOW = 'slow',            // 缓慢
  FLUCTUATING = 'fluctuating' // 波动
}

// 等级系统
interface LevelSystem {
  calculateExpNeeded(level: number, growthRate: GrowthRateType): number;
  gainExperience(entity: Entity, amount: number): LevelUpResult;
  calculateLevelUpStats(entity: Entity, newLevel: number): PokemonStats;
}
```

#### 学习技能系统
```typescript
// 技能学习组件
interface MoveLearningComponent {
  availableMoves: MoveEntry[];  // 可学习的技能列表
  learnedMoves: MoveEntry[];    // 已学习的技能
  currentMoves: MoveSlot[];     // 当前装备的技能
  forgottenMoves: string[];     // 已遗忘的技能

  // 学习条件
  learnConditions: LearnCondition[];
}

// 技能学习条件
interface LearnCondition {
  type: 'level' | 'tm' | 'tutor' | 'egg' | 'event';
  requirement: any;
  description: string;
}

// 技能槽位
interface MoveSlot {
  slot: number;               // 槽位编号 (0-3)
  moveId: string | null;      // 技能ID
  currentPP: number;          // 当前PP
  maxPP: number;             // 最大PP
}
```

---

## 实体与组件系统

### 核心实体架构

#### 1. 精灵实体 (Pokemon Entity)
```typescript
// 精灵实体组件组合
interface PokemonArchetype {
  // 基础信息组件
  basicInfo: BasicInfoComponent;

  // 属性组件
  types: TypeComponent;

  // 能力值组件
  stats: StatsComponent;

  // 个体值组件
  ivs: IVComponent;

  // 努力值组件
  evs: EVComponent;

  // 性格组件
  nature: NatureComponent;

  // 经验值组件
  experience: ExperienceComponent;

  // 技能组件
  moves: MoveLearningComponent;

  // 状态组件
  status: StatusComponent;

  // 持有物组件
  heldItem: HeldItemComponent;

  // 特性组件
  ability: AbilityComponent;

  // 关系组件
  relationship: RelationshipComponent;
}

// 基础信息组件
interface BasicInfoComponent {
  pokemonId: string;          // 精灵唯一ID
  speciesId: string;          // 种族ID
  nickname: string | null;    // 昵称
  level: number;              // 等级
  gender: GenderType;         // 性别
  isShiny: boolean;           // 是否异色
  originalTrainer: string;    // 原训练师ID
  currentTrainer: string;     // 当前训练师ID
  captureDate: Date;          // 捕获日期
  captureLocation: string;    // 捕获地点
  captureMethod: string;      // 捕获方法
}

// 属性组件
interface TypeComponent {
  primaryType: PokemonType;   // 第一属性
  secondaryType: PokemonType | null; // 第二属性
  typeMatchups: TypeMatchupComponent;
}

// 能力值组件
interface StatsComponent {
  currentHP: number;          // 当前HP
  maxHP: number;             // 最大HP
  attack: number;            // 攻击
  defense: number;           // 防御
  spAttack: number;          // 特攻
  spDefense: number;         // 特防
  speed: number;             // 速度
  accuracy: number;          // 命中率
  evasion: number;           // 回避率

  // 临时能力值变化
  statStages: StatStages;

  // 计算方法
  recalculateStats(): void;
  applyStatChange(stat: StatType, stages: number): void;
}

// 能力值阶段变化
interface StatStages {
  attack: number;      // -6 到 +6
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
  accuracy: number;
  evasion: number;
}

// 状态组件
interface StatusComponent {
  primaryStatus: PrimaryStatusType | null;  // 主要状态
  secondaryStatuses: SecondaryStatusType[]; // 次要状态
  statusTurns: Map<string, number>;         // 状态持续回合数
  volatileStatuses: VolatileStatusType[];   // 易变状态

  // 状态效果
  statusEffects: StatusEffect[];

  // 方法
  addStatus(status: StatusType, duration?: number): boolean;
  removeStatus(status: StatusType): boolean;
  hasStatus(status: StatusType): boolean;
  updateStatuses(): void;
}

// 主要状态类型
enum PrimaryStatusType {
  POISON = 'poison',           // 中毒
  BURN = 'burn',              // 烧伤
  FREEZE = 'freeze',          // 冰冻
  PARALYSIS = 'paralysis',    // 麻痹
  SLEEP = 'sleep',            // 睡眠
  FAINT = 'faint'             // 濒死
}

// 次要状态类型
enum SecondaryStatusType {
  CONFUSION = 'confusion',    // 混乱
  INFATUATION = 'infatuation', // 着迷
  NIGHTMARE = 'nightmare',    // 噩梦
  CURSE = 'curse',            // 诅咒
  TAUNT = 'taunt',            // 挑衅
  TORMENT = 'torment',        // 怨恨
  DISABLE = 'disable',        // 定身法
  ENCORE = 'encore',          // 再来一次
  HEAL_BLOCK = 'heal_block',  // 治愈封锁
  EMBARGO = 'embargo',        // 封印
  PERISH_SONG = 'perish_song' // 灭亡之歌
}

// 持有物组件
interface HeldItemComponent {
  itemId: string | null;      // 道具ID
  itemEffect: ItemEffect | null; // 道具效果
  consumable: boolean;        // 是否消耗品
  usageCount: number;         // 使用次数
  activationCondition: ItemActivationCondition;
}

// 特性组件
interface AbilityComponent {
  abilityId: string;          // 特性ID
  abilityName: string;        // 特性名称
  abilityDescription: string; // 特性描述
  isActive: boolean;          // 是否激活
  hiddenAbility: boolean;     // 是否隐藏特性
  abilityEffects: AbilityEffect[];
}

// 关系组件
interface RelationshipComponent {
  trainer: string;            // 训练师ID
  friendship: number;         // 亲密度 (0-255)
  affection: number;          // 好感度 (0-255)
  memory: MemoryEntry[];      // 记忆条目
  ribbon: RibbonType[];       // 拥有的绶带

  // 关系效果
  friendshipBonus: FriendshipBonus;
}
```

#### 2. 训练师实体 (Trainer Entity)
```typescript
// 训练师实体组件组合
interface TrainerArchetype {
  // 基础信息
  basicInfo: TrainerBasicInfoComponent;

  // 精灵队伍
  party: PartyComponent;

  // 精灵仓库
  storage: StorageComponent;

  // 道具包
  inventory: InventoryComponent;

  // 成就
  achievements: AchievementComponent;

  // 统计数据
  statistics: TrainerStatisticsComponent;

  // 社交关系
  social: SocialComponent;

  // 游戏进度
  progress: ProgressComponent;
}

// 训练师基础信息组件
interface TrainerBasicInfoComponent {
  trainerId: string;          // 训练师ID
  name: string;               // 姓名
  avatar: string;             // 头像
  gender: GenderType;         // 性别
  region: string;             // 所属地区
  badges: BadgeType[];        // 拥有的徽章
  money: number;              // 金币
  tokens: number;             // 代币
  registrationDate: Date;     // 注册日期
  lastLoginDate: Date;        // 最后登录时间
  onlineStatus: OnlineStatusType; // 在线状态
}

// 队伍组件
interface PartyComponent {
  pokemons: Entity[];         // 队伍中的精灵
  maxPartySize: number;       // 最大队伍数量
  currentLeader: number;      // 当前领队位置

  // 队伍效果
  partyBonuses: PartyBonus[];

  // 方法
  addPokemon(pokemon: Entity, position?: number): boolean;
  removePokemon(pokemon: Entity): boolean;
  swapPositions(pos1: number, pos2: number): boolean;
  isValidParty(): boolean;
}

// 仓库组件
interface StorageComponent {
  boxes: PokemonBox[];        // 精灵盒子
  currentBox: number;         // 当前盒子
  maxBoxes: number;           // 最大盒子数
  maxPokemonPerBox: number;   // 每盒最大精灵数

  // 方法
  addToBox(pokemon: Entity, boxId?: number): boolean;
  removeFromBox(pokemon: Entity, boxId: number): boolean;
  transferBox(pokemon: Entity, fromBox: number, toBox: number): boolean;
}

// 精灵盒子
interface PokemonBox {
  boxId: string;
  name: string;
  wallpaper: string;
  pokemons: (Entity | null)[]; // 精灵数组，包含空位
  createdAt: Date;
  modifiedAt: Date;
}

// 道具包组件
interface InventoryComponent {
  items: InventoryItem[];     // 道具列表
  maxSlots: number;           // 最大格子数
  selectedItems: Set<string>; // 选中的道具

  // 道具分类
  categories: {
    medicine: InventoryItem[];
    balls: InventoryItem[];
    berries: InventoryItem[];
    keyItems: InventoryItem[];
    tmHm: InventoryItem[];
    battleItems: InventoryItem[];
    mail: InventoryItem[];
  };

  // 方法
  addItem(itemId: string, quantity: number): boolean;
  removeItem(itemId: string, quantity: number): boolean;
  hasItem(itemId: string, quantity?: number): boolean;
  getItemQuantity(itemId: string): number;
  sortItems(sortType: SortType): void;
}

// 道具条目
interface InventoryItem {
  itemId: string;
  quantity: number;
  durability?: number;        // 耐久度
  metadata?: any;             // 额外数据
}

// 成就组件
interface AchievementComponent {
  completedAchievements: Achievement[];
  inProgressAchievements: AchievementProgress[];
  achievementPoints: number;  // 成就点数
  totalAchievements: number;  // 总成就数

  // 成就奖励
  unlockedRewards: AchievementReward[];
}

// 成就
interface Achievement {
  achievementId: string;
  name: string;
  description: string;
  category: AchievementCategory;
  difficulty: AchievementDifficulty;
  requirements: AchievementRequirement[];
  rewards: AchievementReward[];
  completedDate: Date;
  isHidden: boolean;
}

// 成就进度
interface AchievementProgress {
  achievementId: string;
  currentProgress: number;
  requiredProgress: number;
  startDate: Date;
}

// 训练师统计组件
interface TrainerStatisticsComponent {
  // 战斗统计
  battlesWon: number;
  battlesLost: number;
  totalBattles: number;
  winRate: number;

  // 精灵统计
  pokemonCaught: number;
  pokemonSeen: number;
  pokemonEvolved: number;
  shinyPokemonFound: number;

  // 游戏时间统计
  totalPlayTime: number;      // 总游戏时间（分钟）
  currentSessionTime: number; // 当前会话时间

  // 经济统计
  moneyEarned: number;
  moneySpent: number;
  itemsCollected: number;

  // 社交统计
  friendsAdded: number;
  tradesCompleted: number;
  giftsSent: number;
  giftsReceived: number;
}

// 社交组件
interface SocialComponent {
  friends: FriendEntry[];     // 好友列表
  blockedUsers: string[];     // 屏蔽用户
  friendRequests: FriendRequest[]; // 好友请求
  guildId?: string;           // 公会ID
  socialPoints: number;       // 社交点数

  // 社交设置
  privacySettings: PrivacySettings;
  statusMessage: string;      // 状态消息
}

// 好友条目
interface FriendEntry {
  trainerId: string;
  name: string;
  avatar: string;
  onlineStatus: OnlineStatusType;
  lastSeen: Date;
  friendshipLevel: number;
  interactionHistory: SocialInteraction[];
}

// 进度组件
interface ProgressComponent {
  // 主线进度
  mainQuestProgress: QuestProgress[];
  currentChapter: number;
  currentQuest: string;

  // 地图探索进度
  exploredAreas: string[];
  discoveredLocations: LocationEntry[];

  // 解锁内容
  unlockedFeatures: string[];
  unlockedAreas: string[];

  // 游戏模式进度
  battleTowerProgress: BattleTowerProgress;
  battleFrontierProgress: BattleFrontierProgress;
}
```

#### 3. 技能实体 (Move Entity)
```typescript
// 技能实体组件组合
interface MoveArchetype {
  // 基础信息
  basicInfo: MoveBasicInfoComponent;

  // 效果信息
  effects: MoveEffectComponent;

  // 使用条件
  conditions: MoveConditionComponent;

  // 动画信息
  animation: MoveAnimationComponent;
}

// 技能基础信息组件
interface MoveBasicInfoComponent {
  moveId: string;             // 技能ID
  name: string;               // 技能名称
  description: string;        // 技能描述
  type: PokemonType;          // 技能属性
  category: MoveCategory;     // 技能分类
  power: number | null;       // 威力
  accuracy: number | null;    // 命中率
  pp: number;                 // PP值
  priority: number;           // 优先度
  contact: boolean;           // 是否接触
  criticalRate: number;       // 暴击率
}

// 技能分类
enum MoveCategory {
  PHYSICAL = 'physical',      // 物理技能
  SPECIAL = 'special',        // 特殊技能
  STATUS = 'status'           // 变化技能
}

// 技能效果组件
interface MoveEffectComponent {
  primaryEffect: MoveEffect;  // 主要效果
  secondaryEffects: MoveEffect[]; // 次要效果
  recoilEffect?: RecoilEffect; // 反冲效果

  // 状态效果
  statusEffects: StatusEffect[];
  volatileStatusEffects: VolatileStatusEffect[];

  // 场地效果
  fieldEffects: FieldEffect[];
  weatherEffects: WeatherEffect[];

  // 能力值变化
  statChanges: StatChange[];
}

// 技能效果
interface MoveEffect {
  effectType: EffectType;
  target: TargetType;
  chance: number;             // 发生概率
  duration?: number;          // 持续时间
  intensity?: number;         // 效果强度
  conditions?: string[];      // 触发条件
}

// 效果类型
enum EffectType {
  DAMAGE = 'damage',          // 造成伤害
  HEAL = 'heal',              // 恢复HP
  STATUS_CHANGE = 'status_change', // 状态变化
  STAT_CHANGE = 'stat_change',     // 能力值变化
  WEATHER_CHANGE = 'weather_change', // 天气变化
  FIELD_CHANGE = 'field_change',     // 场地变化
  FORCE_SWITCH = 'force_switch',     // 强制替换
  BIND = 'bind',              // 束缚
  DRAIN = 'drain',            // 吸收
  RECOIL = 'recoil',          // 反冲
  CONFUSION = 'confusion',    // 混乱
  FLINCH = 'flinch',          // 畏缩
  HEAL_BLOCK = 'heal_block',  // 治愈封锁
  MIRROR_MOVE = 'mirror_move', // 镜子外衣
  COPY_MOVE = 'copy_move'     // 复制技能
}

// 目标类型
enum TargetType {
  SELF = 'self',              // 自身
  OPPONENT = 'opponent',      // 对手
  ALL_OPPONENTS = 'all_opponents', // 所有对手
  ALLY = 'ally',              // 友方
  ALL_ALLIES = 'all_allies',  // 所有友方
  ALL_POKEMON = 'all_pokemon', // 所有精灵
  RANDOM_OPPONENT = 'random_opponent', // 随机对手
  USER_FIELD = 'user_field',  // 自己场地
  OPPONENT_FIELD = 'opponent_field', // 对手场地
  ENTIRE_FIELD = 'entire_field' // 整个场地
}

// 技能条件组件
interface MoveConditionComponent {
  useConditions: UseCondition[];  // 使用条件
  learnConditions: LearnCondition[]; // 学习条件
  zMoveConditions: ZMoveCondition[]; // Z招式条件
  maxMoveConditions: MaxMoveCondition[]; // 极巨招式条件
}

// 使用条件
interface UseCondition {
  type: ConditionType;
  requirement: any;
  errorMessage: string;
}

// 条件类型
enum ConditionType {
  MIN_LEVEL = 'min_level',    // 最低等级
  MAX_LEVEL = 'max_level',    // 最高等级
  HELD_ITEM = 'held_item',    // 持有道具
  WEATHER = 'weather',        // 天气
  TERRAIN = 'terrain',        // 场地
  TIME_OF_DAY = 'time_of_day', // 时间
  LOCATION = 'location',      // 地点
  BATTLE_TYPE = 'battle_type', // 战斗类型
  OPPONENT_TYPE = 'opponent_type', // 对手类型
  STAT_CONDITION = 'stat_condition', // 能力值条件
  STATUS_CONDITION = 'status_condition' // 状态条件
}

// 技能动画组件
interface MoveAnimationComponent {
  animationId: string;        // 动画ID
  animationType: AnimationType; // 动画类型
  startFrame: number;         // 开始帧
  endFrame: number;           // 结束帧
  loopAnimation: boolean;     // 是否循环
  soundEffects: SoundEffect[]; // 音效
  particleEffects: ParticleEffect[]; // 粒子效果
  screenEffects: ScreenEffect[]; // 屏幕效果
}

// 动画类型
enum AnimationType {
  PROJECTILE = 'projectile',  // 投射物
  MELEE = 'melee',            // 近战
  AOE = 'aoe',               // 范围效果
  SELF_APPLY = 'self_apply',  // 自身应用
  FIELD_EFFECT = 'field_effect', // 场地效果
  STATUS_EFFECT = 'status_effect', // 状态效果
  TRANSFORMATION = 'transformation' // 变形
}
```

#### 4. 道具实体 (Item Entity)
```typescript
// 道具实体组件组合
interface ItemArchetype {
  // 基础信息
  basicInfo: ItemBasicInfoComponent;

  // 效果信息
  effects: ItemEffectComponent;

  // 使用条件
  conditions: ItemConditionComponent;

  // 经济信息
  economy: ItemEconomyComponent;
}

// 道具基础信息组件
interface ItemBasicInfoComponent {
  itemId: string;             // 道具ID
  name: string;               // 道具名称
  description: string;        // 道具描述
  category: ItemCategory;     // 道具分类
  rarity: ItemRarity;         // 稀有度
  stackable: boolean;         // 是否可堆叠
  maxStack: number;           // 最大堆叠数
  consumable: boolean;        // 是否消耗品
  tradable: boolean;          // 是否可交易
  sellable: boolean;          // 是否可出售
}

// 道具分类
enum ItemCategory {
  MEDICINE = 'medicine',      // 药品
  POKE_BALL = 'poke_ball',    // 精灵球
  BERRY = 'berry',            // 树果
  TM_HM = 'tm_hm',            // 招式学习器
  BATTLE_ITEM = 'battle_item', // 战斗道具
  KEY_ITEM = 'key_item',      // 重要道具
  MAIL = 'mail',              // 邮件
  EV_ITEM = 'ev_item',        // 努力值道具
  IV_ITEM = 'iv_item',        // 个体值道具
  ABILITY_ITEM = 'ability_item', // 特性道具
  MOVE_ITEM = 'move_item',    // 技能道具
  CURRENCY = 'currency',      // 货币
  MATERIAL = 'material',      // 材料
  FUSION_ITEM = 'fusion_item' // 融合道具
}

// 道具稀有度
enum ItemRarity {
  COMMON = 'common',          // 普通
  UNCOMMON = 'uncommon',      // 不常见
  RARE = 'rare',              // 稀有
  EPIC = 'epic',              // 史诗
  LEGENDARY = 'legendary',    // 传说
  MYTHICAL = 'mythical'       // 神话
}

// 道具效果组件
interface ItemEffectComponent {
  immediateEffects: ItemEffect[];     // 立即效果
  heldEffects: HeldItemEffect[];      // 持有效果
  useEffects: UseEffect[];            // 使用效果
  throwEffects: ThrowEffect[];        // 投掷效果
}

// 道具效果
interface ItemEffect {
  effectType: ItemEffectType;
  target: ItemTargetType;
  value: number;
  duration?: number;
  conditions?: string[];
}

// 道具效果类型
enum ItemEffectType {
  HEAL_HP = 'heal_hp',          // 恢复HP
  HEAL_STATUS = 'heal_status',  // 治愈状态
  REVIVE = 'revive',            // 复活
  BOOST_STAT = 'boost_stat',    // 提升能力值
  INCREASE_FRIENDSHIP = 'increase_friendship', // 增加亲密度
  EVOLVE_POKEMON = 'evolve_pokemon', // 进化精灵
  TEACH_MOVE = 'teach_move',    // 教学技能
  CHANGE_ABILITY = 'change_ability', // 改变特性
  CHANGE_NATURE = 'change_nature', // 改变性格
  INCREASE_EV = 'increase_ev',  // 增加努力值
  RESET_EV = 'reset_ev',        // 重置努力值
  INCREASE_IV = 'increase_iv',  // 增加个体值
  CAPTURE_BOOST = 'capture_boost', // 捕获加成
  EXP_BOOST = 'exp_boost',      // 经验加成
  MONEY_BOOST = 'money_boost',  // 金币加成
  RARE_FIND = 'rare_find'       // 稀有发现
}

// 道具条件组件
interface ItemConditionComponent {
  useConditions: ItemUseCondition[];    // 使用条件
  holdConditions: ItemHoldCondition[];  // 持有条件
  tradeConditions: ItemTradeCondition[]; // 交易条件
}

// 道具经济组件
interface ItemEconomyComponent {
  buyPrice: number;            // 购买价格
  sellPrice: number;           // 出售价格
  shopAvailability: ShopAvailability[]; // 商店 availability
  dropSources: DropSource[];   // 掉落来源
  craftRecipe?: CraftRecipe;   // 合成配方
}
```

---

## 资源管理系统

### 全局状态管理
```typescript
// 游戏全局状态
interface GameState {
  // 当前场景
  currentScene: SceneType;

  // 玩家数据
  player: TrainerEntity;

  // 游戏时间
  gameTime: GameTime;

  // 环境状态
  environment: EnvironmentState;

  // 系统状态
  systems: SystemState;

  // 网络状态
  network: NetworkState;

  // UI状态
  ui: UIState;

  // 缓存状态
  cache: CacheState;
}

// 场景类型
enum SceneType {
  MAIN_MENU = 'main_menu',        // 主菜单
  OVERWORLD = 'overworld',        // 大地图
  BATTLE = 'battle',              // 战斗
  INVENTORY = 'inventory',        // 道具包
  POKEMON_SUMMARY = 'pokemon_summary', // 精灵详情
  SHOP = 'shop',                  // 商店
  TRAINER_CENTER = 'trainer_center', // 精灵中心
  GYM = 'gym',                    // 道馆
  ELITE_FOUR = 'elite_four',      // 四天王
  BATTLE_TOWER = 'battle_tower',  // 对战塔
  ONLINE_LOBBY = 'online_lobby',  // 在线大厅
  TRADE = 'trade',                // 交易
  FUSION = 'fusion',              // 融合
  SETTINGS = 'settings'           // 设置
}

// 游戏时间
interface GameTime {
  totalTicks: number;             // 总tick数
  currentTime: Date;              // 当前游戏时间
  timeSpeed: number;              // 时间流速
  dayPhase: DayPhase;             // 白天阶段
  season: Season;                 // 季节
  weather: WeatherType;           // 天气
}

// 白天阶段
enum DayPhase {
  DAWN = 'dawn',                  // 黎明
  MORNING = 'morning',            // 早晨
  NOON = 'noon',                  // 中午
  AFTERNOON = 'afternoon',        // 下午
  DUSK = 'dusk',                  // 黄昏
  NIGHT = 'night'                 // 夜晚
}

// 季节
enum Season {
  SPRING = 'spring',              // 春季
  SUMMER = 'summer',              // 夏季
  AUTUMN = 'autumn',              // 秋季
  WINTER = 'winter'               // 冬季
}

// 环境状态
interface EnvironmentState {
  currentMap: MapEntity;          // 当前地图
  weatherEffects: WeatherEffect[]; // 天气效果
  terrainEffects: TerrainEffect[]; // 地形效果
  ambientLight: AmbientLight;     // 环境光照
  backgroundMusic: string;        // 背景音乐
  soundEffects: SoundEffect[];    // 环境音效
}

// 系统状态
interface SystemState {
  battleSystem: BattleSystemState;
  inventorySystem: InventorySystemState;
  pokemonSystem: PokemonSystemState;
  socialSystem: SocialSystemState;
  achievementSystem: AchievementSystemState;
  saveSystem: SaveSystemState;
  networkSystem: NetworkSystemState;
}
```

### 资源类型定义
```typescript
// 资源管理器
interface ResourceManager {
  // 精灵资源
  pokemonResources: PokemonResourceMap;

  // 技能资源
  moveResources: MoveResourceMap;

  // 道具资源
  itemResources: ItemResourceMap;

  // 地图资源
  mapResources: MapResourceMap;

  // 音频资源
  audioResources: AudioResourceMap;

  // 图像资源
  imageResources: ImageResourceMap;

  // 动画资源
  animationResources: AnimationResourceMap;

  // 文本资源
  textResources: TextResourceMap;

  // 配置资源
  configResources: ConfigResourceMap;
}

// 精灵资源
interface PokemonResource {
  speciesId: string;
  baseStats: BaseStats;
  abilities: AbilityEntry[];
  movePool: MovePoolEntry[];
  evolutionChain: EvolutionChain;
  breedingInfo: BreedingInfo;
  habitatInfo: HabitatInfo;
  flavorText: FlavorTextEntry[];
  pokedexEntries: PokedexEntry[];
}

// 基础能力值
interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
  total: number;
}

// 特性条目
interface AbilityEntry {
  abilityId: string;
  isHidden: boolean;
  learnConditions: LearnCondition[];
}

// 技能池条目
interface MovePoolEntry {
  moveId: string;
  learnMethod: LearnMethod;
  learnCondition: any;
}

// 学习方法
enum LearnMethod {
  LEVEL_UP = 'level_up',         // 升级学习
  TM = 'tm',                     // TM学习
  TUTOR = 'tutor',               // 技能教学
  EGG = 'egg',                   // 遗传
  EVENT = 'event'                // 活动
}

// 进化链
interface EvolutionChain {
  speciesId: string;
  evolutions: EvolutionEntry[];
}

// 进化条目
interface EvolutionEntry {
  fromSpecies: string;
  toSpecies: string;
  method: EvolutionMethod;
  condition: EvolutionCondition;
  minLevel?: number;
  requiredItem?: string;
  requiredFriendship?: number;
  timeOfDay?: DayPhase;
  location?: string;
  tradeSpecies?: string;
}

// 进化方法
enum EvolutionMethod {
  LEVEL_UP = 'level_up',         // 升级进化
  ITEM = 'item',                 // 道具进化
  TRADE = 'trade',               // 交易进化
  FRIENDSHIP = 'friendship',     // 亲密度进化
  TIME = 'time',                 // 时间进化
  LOCATION = 'location',         // 地点进化
  MOVE = 'move',                 // 技能进化
  GENDER = 'gender',             // 性别进化
  WEATHER = 'weather',           // 天气进化
  PARTY = 'party',               // 队伍进化
  BEAUTY = 'beauty',             // 美丽度进化
  AFFECTION = 'affection',       // 好感度进化
  SPIN = 'spin',                 // 旋转进化
  TRADE_ITEM = 'trade_item',     // 交易+道具进化
  TRADE_SPECIES = 'trade_species', // 交易+特定精灵进化
  SPECIAL = 'special'            // 特殊进化
}

// 繁殖信息
interface BreedingInfo {
  eggGroups: EggGroup[];         // 蛋组
  hatchTime: number;             // 孵化时间（步数）
  babyForm?: string;             // 幼年形态
  genderRatio: GenderRatio;      // 性别比例
  compatibility: EggGroupCompatibility;
}

// 蛋组
enum EggGroup {
  MONSTER = 'monster',
  WATER_1 = 'water_1',
  BUG = 'bug',
  FLYING = 'flying',
  FIELD = 'field',
  FAIRY = 'fairy',
  GRASS = 'grass',
  HUMAN_LIKE = 'human_like',
  WATER_3 = 'water_3',
  MINERAL = 'mineral',
  AMORPHOUS = 'amorphous',
  DRAGON = 'dragon',
  UNDISCOVERED = 'undiscovered',
  DITTO = 'ditto'
}

// 性别比例
interface GenderRatio {
  male: number;                  // 雄性概率 (0-8)
  female: number;                // 雌性概率 (0-8)
  genderless: boolean;           // 无性别
}

// 栖息地信息
interface HabitatInfo {
  primaryHabitat: HabitatType;
  secondaryHabitats: HabitatType[];
  commonLocations: LocationEntry[];
  rarity: RarityType;
  spawnConditions: SpawnCondition[];
  encounterMethods: EncounterMethod[];
}

// 栖息地类型
enum HabitatType {
  GRASSLAND = 'grassland',
  FOREST = 'forest',
  WATER = 'water',
  CAVE = 'cave',
  MOUNTAIN = 'mountain',
  DESERT = 'desert',
  TUNDRA = 'tundra',
  OCEAN = 'ocean',
  URBAN = 'urban',
  SWAMP = 'swamp',
  VOLCANIC = 'volcanic',
  SPACE = 'space'
}

// 遭遇方法
enum EncounterMethod {
  WALKING = 'walking',           // 行走
  SURFING = 'surfing',           // 冲浪
  FISHING = 'fishing',           // 钓鱼
  ROCK_SMASH = 'rock_smash',     // 碎岩
  HEADBUTT = 'headbutt',         // 撞树
  SWEET_SCENT = 'sweet_scent',   // 甜香气
  POKE_RADAR = 'poke_radar',     // 宝可梦雷达
  SWARM = 'swarm',               // 大量出现
  TIME_BASED = 'time_based',     // 时间相关
  WEATHER_BASED = 'weather_based', // 天气相关
  SPECIAL = 'special'            // 特殊方法
}
```

---

## 战斗系统架构

### 战斗实体定义
```typescript
// 战斗实体组件组合
interface BattleArchetype {
  // 战斗基础信息
  battleInfo: BattleInfoComponent;

  // 参与者
  participants: BattleParticipantsComponent;

  // 场地状态
  fieldState: FieldStateComponent;

  // 天气状态
  weatherState: WeatherStateComponent;

  // 回合信息
  turnInfo: TurnInfoComponent;

  // 战斗规则
  rules: BattleRulesComponent;

  // 战斗历史
  history: BattleHistoryComponent;
}

// 战斗基础信息组件
interface BattleInfoComponent {
  battleId: string;              // 战斗ID
  battleType: BattleType;        // 战斗类型
  battleMode: BattleMode;        // 战斗模式
  startTime: Date;               // 开始时间
  endTime?: Date;                // 结束时间
  location: string;              // 战斗地点
  environment: BattleEnvironment; // 战斗环境

  // 战斗状态
  status: BattleStatus;
  currentPhase: BattlePhase;

  // 观察者
  spectators: SpectatorEntry[];
}

// 战斗类型
enum BattleType {
  WILD_POKEMON = 'wild_pokemon',     // 野生精灵
  TRAINER_BATTLE = 'trainer_battle', // 训练师对战
  GYM_BATTLE = 'gym_battle',         // 道馆战
  ELITE_FOUR = 'elite_four',         // 四天王
  CHAMPION = 'champion',             // 冠军
  ONLINE_PVP = 'online_pvp',         // 在线PVP
  TOURNAMENT = 'tournament',         // 锦标赛
  BATTLE_TOWER = 'battle_tower',     // 对战塔
  BATTLE_FRONTIER = 'battle_frontier', // 对战开拓区
  RAID = 'raid',                     // 团队战
  DOUBLE_BATTLE = 'double_battle',   // 双打
  TRIPLE_BATTLE = 'triple_battle',   // 三打
  ROTATION_BATTLE = 'rotation_battle', // 轮换战
  MULTI_BATTLE = 'multi_battle',     // 多人对战
  HORDE_BATTLE = 'horde_battle',     // 群战
  SKY_BATTLE = 'sky_battle',         // 空中战
  INVERSE_BATTLE = 'inverse_battle', // 反转战
  CUSTOM_BATTLE = 'custom_battle'    // 自定义战
}

// 战斗模式
enum BattleMode {
  SINGLE = 'single',                 // 单打
  DOUBLE = 'double',                 // 双打
  TRIPLE = 'triple',                 // 三打
  ROTATION = 'rotation',             // 轮换
  MULTI = 'multi',                   // 多人
  HORDE = 'horde'                    // 群战
}

// 战斗状态
enum BattleStatus {
  PREPARING = 'preparing',           // 准备中
  IN_PROGRESS = 'in_progress',       // 进行中
  PAUSED = 'paused',                 // 暂停
  FINISHED = 'finished',             // 已结束
  ABORTED = 'aborted'                // 中断
}

// 战斗阶段
enum BattlePhase {
  TEAM_PREVIEW = 'team_preview',     // 队伍预览
  TEAM_SELECTION = 'team_selection', // 队伍选择
  BATTLE_START = 'battle_start',     // 战斗开始
  TURN_START = 'turn_start',         // 回合开始
  ACTION_SELECTION = 'action_selection', // 行动选择
  ACTION_EXECUTION = 'action_execution', // 行动执行
  TURN_END = 'turn_end',             // 回合结束
  BATTLE_END = 'battle_end'          // 战斗结束
}

// 参与者组件
interface BattleParticipantsComponent {
  teams: BattleTeam[];               // 参战队伍
  currentTurnOrder: TurnOrderEntry[]; // 当前行动顺序
  selectedActions: SelectedAction[]; // 选中的行动
  faintedPokemon: FaintedPokemonEntry[]; // 濒死精灵

  // 参与者统计
  participantStats: ParticipantStats[];
}

// 战斗队伍
interface BattleTeam {
  teamId: string;
  teamType: TeamType;                // 队伍类型
  trainerId?: string;                // 训练师ID
  pokemons: BattlePokemon[];         // 参战精灵
  activePokemon: BattlePokemon[];    // 场上精灵
  benchPokemon: BattlePokemon[];     // 场下精灵

  // 队伍效果
  teamEffects: TeamEffect[];
  teamBonuses: TeamBonus[];

  // 统计信息
  teamStats: TeamStats;
}

// 队伍类型
enum TeamType {
  PLAYER = 'player',                 // 玩家
  AI = 'ai',                         // AI
  WILD = 'wild',                     // 野生
  BOSS = 'boss',                     // Boss
  RAID_BOSS = 'raid_boss'            // 团队Boss
}

// 战斗精灵
interface BattlePokemon {
  entity: Entity;                    // 精灵实体
  position: BattlePosition;          // 战斗位置
  teamId: string;                    // 队伍ID

  // 战斗状态
  battleStats: BattleStats;          // 战斗能力值
  statusEffects: BattleStatusEffect[]; // 战斗状态效果
  volatileStatuses: VolatileStatusType[]; // 易变状态
  statStages: StatStages;            // 能力值阶段

  // 行动状态
  selectedAction?: SelectedAction;   // 选中的行动
  canMove: boolean;                  // 是否可以行动
  isConfused: boolean;               // 是否混乱
  isInfatuated: boolean;             // 是否着迷
  isNightmared: boolean;             // 是否噩梦
  isTaunted: boolean;                // 是否被挑衅
  isTormented: boolean;              // 是否被怨恨
  isDisabled: boolean;               // 是否被定身法
  isEncored: boolean;                // 是否被再来一次
  isHealBlocked: boolean;            // 是否被治愈封锁
  isEmbargoed: boolean;              // 是否被封印

  // 特殊状态
  isBiding: boolean;                 // 是否蓄力
  isCharging: boolean;               // 是否蓄力中
  isRecharging: boolean;             // 是否需要蓄力
  isRampaging: boolean;              // 是否暴走
  isFlinched: boolean;               // 是否畏缩
  isSemiInvulnerable: boolean;       // 是否半无敌状态

  // 计数器
  turnCounters: Map<string, number>; // 回合计数器
  damageCounters: Map<string, number>; // 伤害计数器
  effectCounters: Map<string, number>; // 效果计数器
}

// 战斗位置
interface BattlePosition {
  side: BattleSide;                  // 战场边
  slot: number;                      // 槽位
  field?: FieldPosition;             // 场地位置
}

// 战场边
enum BattleSide {
  PLAYER = 'player',                 // 玩家方
  OPPONENT = 'opponent',             // 对手方
  NEUTRAL = 'neutral'                // 中立方
}

// 场地状态组件
interface FieldStateComponent {
  playerField: FieldCondition;       // 玩家场地
  opponentField: FieldCondition;     // 对手场地
  globalField: GlobalFieldCondition; // 全局场地

  // 场地效果
  activeFields: FieldEffect[];
  fieldLayers: FieldLayer[];

  // 场地持续时间
  fieldDurations: Map<string, number>;
}

// 场地条件
interface FieldCondition {
  terrain: TerrainType;              // 地形
  hazards: HazardEffect[];           // 场地危害
  barriers: BarrierEffect[];         // 屏障效果
  traps: TrapEffect[];               // 陷阱效果
  weatherEffects: WeatherEffect[];   // 天气效果

  // 场地属性
  gravityLevel: number;              // 重力等级
  roomType?: RoomType;               // 房间类型
  roomDuration?: number;             // 房间持续时间
}

// 地形类型
enum TerrainType {
  NORMAL = 'normal',                 // 普通
  ELECTRIC = 'electric',             // 电气场地
  GRASSY = 'grassy',                 // 青草场地
  MISTY = 'misty',                   // 薄雾场地
  PSYCHIC = 'psychic',               // 精神场地
  TRICK_ROOM = 'trick_room',         // 戏法空间
  MAGIC_ROOM = 'magic_room',         // 魔法空间
  WONDER_ROOM = 'wonder_room',       // 奇迹空间
  GRAVITY = 'gravity',               // 重力
  WATER = 'water',                   // 水面
  ICE = 'ice',                       // 冰面
  LAVA = 'lava',                     // 岩浆
  POISON = 'poison',                 // 毒地面
  WEB = 'web'                        // 蛛网
}

// 危害效果
interface HazardEffect {
  hazardType: HazardType;
  side: BattleSide;
  damage: number;
  conditions: string[];
  removalMethods: string[];
}

// 危害类型
enum HazardType {
  STEALTH_ROCK = 'stealth_rock',     // 隐形岩
  SPIKES = 'spikes',                 // 撒菱
  TOXIC_SPIKES = 'toxic_spikes',     // 毒菱
  STICKY_WEB = 'sticky_web',         // 黏黏网
  ROCKS = 'rocks'                   // 岩石
}

// 屏障效果
interface BarrierEffect {
  barrierType: BarrierType;
  side: BattleSide;
  hp: number;
  maxHP: number;
  conditions: string[];
}

// 屏障类型
enum BarrierType {
  REFLECT = 'reflect',               // 反射壁
  LIGHT_SCREEN = 'light_screen',     // 光墙
  AURORA_VEIL = 'aurora_veil'       // 极光幕
}

// 天气状态组件
interface WeatherStateComponent {
  currentWeather: WeatherType;       // 当前天气
  weatherDuration: number;           // 天气持续时间
  weatherIntensity: number;          // 天气强度
  weatherEffects: WeatherEffect[];   // 天气效果

  // 天气历史
  weatherHistory: WeatherHistoryEntry[];
}

// 天气类型
enum WeatherType {
  CLEAR = 'clear',                   // 晴朗
  SUNNY = 'sunny',                   // 大晴天
  RAIN = 'rain',                     // 下雨
  SANDSTORM = 'sandstorm',           // 沙暴
  HAIL = 'hail',                     // 冰雹
  SNOW = 'snow',                     // 下雪
  FOG = 'fog',                       // 浓雾
  HARSH_SUNLIGHT = 'harsh_sunlight', // 强日光
  HEAVY_RAIN = 'heavy_rain',         // 大雨
  STRONG_WINDS = 'strong_winds',     // 强风
  MYSTICAL_AIR = 'mystical_air',     // 神秘空气
  SHADOW_SKY = 'shadow_sky',         // 暗影天空
  DELTA_STREAM = 'delta_stream'      // 德尔塔气流
}

// 天气效果
interface WeatherEffect {
  weatherType: WeatherType;
  effectType: WeatherEffectType;
  value: number;
  conditions: string[];
  target: TargetType;
}

// 天气效果类型
enum WeatherEffectType {
  DAMAGE = 'damage',                 // 伤害
  STAT_CHANGE = 'stat_change',       // 能力值变化
  TYPE_BOOST = 'type_boost',         // 属性加成
  TYPE_NERF = 'type_nerf',           // 属性削弱
  HEAL = 'heal',                     // 治疗
  ACCURACY_CHANGE = 'accuracy_change', // 命中率变化
  MOVE_POWER_CHANGE = 'move_power_change', // 技能威力变化
  ABILITY_ACTIVATION = 'ability_activation', // 特性激活
  PREVENTION = 'prevention'          // 阻止效果
}

// 回合信息组件
interface TurnInfoComponent {
  currentTurn: number;               // 当前回合数
  maxTurns?: number;                 // 最大回合数
  turnStartTime: Date;               // 回合开始时间
  turnDuration: number;              // 回合持续时间
  turnTimeLimit?: number;            // 回合时间限制

  // 行动顺序
  actionQueue: ActionEntry[];        // 行动队列
  executedActions: ActionEntry[];    // 已执行行动
  pendingActions: ActionEntry[];     // 待执行行动

  // 回合效果
  turnStartEffects: TurnEffect[];    // 回合开始效果
  turnEndEffects: TurnEffect[];      // 回合结束效果
}

// 行动条目
interface ActionEntry {
  actionId: string;
  executor: BattlePokemon;
  actionType: ActionType;
  target: BattlePokemon | BattlePokemon[];
  moveId?: string;
  itemId?: string;
  switchTo?: string;
  priority: number;
  speed: number;
  accuracy: number;
  successChance: number;
  conditions: string[];
}

// 行动类型
enum ActionType {
  MOVE = 'move',                     // 使用技能
  SWITCH = 'switch',                 // 替换精灵
  ITEM = 'item',                     // 使用道具
  FLEE = 'flee',                     // 逃跑
  STRUGGLE = 'struggle',             // 挣扎
  SKIP = 'skip'                      // 跳过
}

// 战斗规则组件
interface BattleRulesComponent {
  rules: BattleRule[];               // 战斗规则
  restrictions: BattleRestriction[]; // 限制条件
  settings: BattleSettings;          // 战斗设置

  // 规则效果
  ruleEffects: RuleEffect[];
}

// 战斗规则
interface BattleRule {
  ruleId: string;
  ruleName: string;
  description: string;
  category: RuleCategory;
  isDefault: boolean;
  priority: number;
  conditions: string[];
  effects: RuleEffect[];
}

// 规则分类
enum RuleCategory {
  BASIC = 'basic',                   // 基础规则
  FORMAT = 'format',                 // 格式规则
  CLAUSE = 'clause',                 // 条款规则
  MODIFIER = 'modifier',             // 修饰规则
  SPECIAL = 'special'                // 特殊规则
}

// 战斗限制
interface BattleRestriction {
  restrictionType: RestrictionType;
  description: string;
  value: any;
  conditions: string[];
}

// 限制类型
enum RestrictionType {
  LEVEL_CAP = 'level_cap',           // 等级上限
  BANNED_POKEMON = 'banned_pokemon', // 禁用精灵
  BANNED_MOVES = 'banned_moves',     // 禁用技能
  BANNED_ITEMS = 'banned_items',     // 禁用道具
  REQUIRED_ITEMS = 'required_items', // 必需道具
  TEAM_SIZE = 'team_size',           // 队伍大小
  TIME_LIMIT = 'time_limit',         // 时间限制
  MOVE_LIMIT = 'move_limit'          // 技能限制
}

// 战斗设置
interface BattleSettings {
  showDamageNumbers: boolean;        // 显示伤害数字
  showHealthBars: boolean;           // 显示HP条
  showStatChanges: boolean;          // 显示能力值变化
  showTurnOrder: boolean;            // 显示行动顺序
  enableAnimations: boolean;         // 启用动画
  animationSpeed: AnimationSpeed;    // 动画速度
  autoMode: boolean;                 // 自动模式
  aiDifficulty: AIDifficulty;        // AI难度
  enableChat: boolean;               // 启用聊天
  enableSpectators: boolean;         // 允许观战
}

// 动画速度
enum AnimationSpeed {
  SLOW = 'slow',                     // 慢速
  NORMAL = 'normal',                 // 正常
  FAST = 'fast',                     // 快速
  INSTANT = 'instant'                // 瞬间
}

// AI难度
enum AIDifficulty {
  EASY = 'easy',                     // 简单
  NORMAL = 'normal',                 // 普通
  HARD = 'hard',                     // 困难
  EXPERT = 'expert',                 // 专家
  MASTER = 'master'                  // 大师
}

// 战斗历史组件
interface BattleHistoryComponent {
  events: BattleEvent[];             // 战斗事件
  statistics: BattleStatistics;      // 战斗统计
  replay: BattleReplay;              // 战斗回放

  // 历史记录
  damageHistory: DamageEntry[];      // 伤害历史
  moveHistory: MoveEntry[];          // 技能历史
  switchHistory: SwitchEntry[];      // 替换历史
  itemHistory: ItemEntry[];          // 道具历史
  statusHistory: StatusEntry[];      // 状态历史
  knockoutHistory: KnockoutEntry[];  // 击倒历史
}

// 战斗事件
interface BattleEvent {
  eventId: string;
  eventType: BattleEventType;
  turn: number;
  timestamp: Date;
  source: BattlePokemon;
  target?: BattlePokemon | BattlePokemon[];
  details: any;
  message: string;
}

// 战斗事件类型
enum BattleEventType {
  BATTLE_START = 'battle_start',     // 战斗开始
  BATTLE_END = 'battle_end',         // 战斗结束
  TURN_START = 'turn_start',         // 回合开始
  TURN_END = 'turn_end',             // 回合结束
  MOVE_USED = 'move_used',           // 使用技能
  MOVE_HIT = 'move_hit',             // 技能命中
  MOVE_MISS = 'move_miss',           // 技能未命中
  CRITICAL_HIT = 'critical_hit',     // 暴击
  SUPER_EFFECTIVE = 'super_effective', // 效果拔群
  NOT_VERY_EFFECTIVE = 'not_very_effective', // 效果不彰
  IMMUNE = 'immune',                 // 免疫
  STATUS_APPLIED = 'status_applied', // 状态施加
  STATUS_REMOVED = 'status_removed', // 状态移除
  STAT_CHANGED = 'stat_changed',     // 能力值变化
  POKEMON_SWITCHED = 'pokemon_switched', // 精灵替换
  POKEMON_FAINTED = 'pokemon_fainted', // 精灵濒死
  POKEMON_REVIVED = 'pokemon_revived', // 精灵复活
  ITEM_USED = 'item_used',           // 使用道具
  WEATHER_CHANGED = 'weather_changed', // 天气变化
  FIELD_CHANGED = 'field_changed',   // 场地变化
  ABILITY_ACTIVATED = 'ability_activated', // 特性激活
  EFFECT_ACTIVATED = 'effect_activated', // 效果激活
  ERROR_OCCURRED = 'error_occurred'   // 发生错误
}
```

### 战斗系统逻辑
```typescript
// 战斗系统主控制器
interface BattleSystem {
  // 战斗初始化
  initializeBattle(battleConfig: BattleConfig): BattleEntity;

  // 回合管理
  startTurn(): void;
  processTurn(): TurnResult;
  endTurn(): void;

  // 行动处理
  selectAction(pokemon: BattlePokemon, action: SelectedAction): boolean;
  executeAction(action: ActionEntry): ActionResult;

  // 伤害计算
  calculateDamage(attacker: BattlePokemon, defender: BattlePokemon, move: MoveEntity): DamageCalculation;

  // 状态处理
  applyStatusEffect(pokemon: BattlePokemon, effect: StatusEffect): boolean;
  removeStatusEffect(pokemon: BattlePokemon, statusType: StatusType): boolean;

  // 能力值变化
  applyStatChange(pokemon: BattlePokemon, stat: StatType, stages: number): boolean;

  // 胜负判定
  checkBattleEnd(): BattleEndResult | null;

  // AI控制
  getAIAction(pokemon: BattlePokemon, difficulty: AIDifficulty): SelectedAction;

  // 回放系统
  recordEvent(event: BattleEvent): void;
  generateReplay(): BattleReplay;
}

// 战斗配置
interface BattleConfig {
  battleType: BattleType;
  participants: BattleParticipant[];
  rules: BattleRule[];
  settings: BattleSettings;
  location: string;
  environment?: BattleEnvironment;
}

// 战斗参与者
interface BattleParticipant {
  participantId: string;
  participantType: ParticipantType;
  trainerId?: string;
  pokemonIds: string[];
  teamSize: number;
  aiDifficulty?: AIDifficulty;
  isPlayer: boolean;
}

// 参与者类型
enum ParticipantType {
  HUMAN = 'human',                   // 人类玩家
  AI = 'ai',                         // AI玩家
  WILD = 'wild',                     // 野生精灵
  BOSS = 'boss',                     // Boss
  SPECTATOR = 'spectator'            // 观众
}

// 回合结果
interface TurnResult {
  turn: number;
  actionsExecuted: number;
  events: BattleEvent[];
  battleEnd: BattleEndResult | null;
  nextTurnOrder: TurnOrderEntry[];
}

// 行动结果
interface ActionResult {
  success: boolean;
  action: ActionEntry;
  results: ActionResultItem[];
  events: BattleEvent[];
  nextActions: ActionEntry[];
}

// 行动结果项
interface ActionResultItem {
  type: ActionResultType;
  target: BattlePokemon;
  result: any;
  success: boolean;
  message: string;
}

// 行动结果类型
enum ActionResultType {
  DAMAGE = 'damage',                 // 伤害
  HEAL = 'heal',                     // 治疗
  STATUS_APPLY = 'status_apply',     // 状态施加
  STATUS_REMOVE = 'status_remove',   // 状态移除
  STAT_CHANGE = 'stat_change',       // 能力值变化
  SWITCH = 'switch',                 // 替换
  ITEM_EFFECT = 'item_effect',       // 道具效果
  ABILITY_EFFECT = 'ability_effect', // 特性效果
  MOVE_EFFECT = 'move_effect',       // 技能效果
  FIELD_EFFECT = 'field_effect',     // 场地效果
  WEATHER_EFFECT = 'weather_effect', // 天气效果
  FAILED = 'failed',                 // 失败
  MISSED = 'missed'                  // 未命中
}

// 伤害计算
interface DamageCalculation {
  baseDamage: number;                // 基础伤害
  finalDamage: number;               // 最终伤害
  effectiveness: number;             // 属性效果
  criticalHit: boolean;              // 暴击
  stab: boolean;                     // 属性一致加成
  randomFactor: number;              // 随机因子
  typeModifier: number;              // 类型修正
  burnModifier: number;              // 烧伤修正
  screenModifier: number;            // 屏障修正
  fieldModifier: number;             // 场地修正
  weatherModifier: number;           // 天气修正
  abilityModifier: number;           // 特性修正
  itemModifier: number;              // 道具修正
  damageRange: [number, number];     // 伤害范围
  damagePercent: number;             // 伤害百分比
  willKO: boolean;                   // 是否会击倒
  remainingHP: number;               // 剩余HP
}

// 战斗结束结果
interface BattleEndResult {
  winner: BattleSide;                // 获胜方
  loser: BattleSide;                 // 失败方
  endCondition: BattleEndCondition;  // 结束条件
  totalTurns: number;                // 总回合数
  duration: number;                  // 战斗持续时间
  rewards: BattleReward[];           // 战斗奖励
  experience: ExperienceReward[];    // 经验奖励
  statistics: BattleStatistics;      // 战斗统计
}

// 战斗结束条件
enum BattleEndCondition {
  ALL_FAINTED = 'all_fainted',       // 全部濒死
  FORFEIT = 'forfeit',               // 认输
  TIME_OUT = 'time_out',             // 超时
  DISCONNECT = 'disconnect',         // 断线
  AGREEMENT = 'agreement',           // 协议结束
  RULE_VIOLATION = 'rule_violation', // 违规
  ERROR = 'error'                    // 错误
}

// 战斗奖励
interface BattleReward {
  rewardType: RewardType;
  amount: number;
  itemId?: string;
  pokemonId?: string;
  moveId?: string;
  condition?: string;
}

// 奖励类型
enum RewardType {
  MONEY = 'money',                   // 金币
  EXPERIENCE = 'experience',         // 经验值
  ITEM = 'item',                     // 道具
  POKEMON = 'pokemon',               // 精灵
  MOVE = 'move',                     // 技能
  BADGE = 'badge',                   // 徽章
  ACHIEVEMENT = 'achievement',       // 成就
  RANKING_POINTS = 'ranking_points', // 排行榜积分
  SOCIAL_POINTS = 'social_points',   // 社交积分
  EVENT_TOKENS = 'event_tokens'      // 活动代币
}

// 经验奖励
interface ExperienceReward {
  pokemonId: string;
  baseExp: number;
  expMultiplier: number;
  finalExp: number;
  levelUp: boolean;
  newLevel?: number;
  learnedMoves?: string[];
}

// 战斗统计
interface BattleStatistics {
  // 总体统计
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalHealing: number;
  totalMovesUsed: number;
  totalItemsUsed: number;
  totalSwitches: number;

  // 精灵统计
  pokemonStats: Map<string, PokemonBattleStats>;

  // 技能统计
  moveStats: Map<string, MoveBattleStats>;

  // 效率统计
  accuracyRate: number;
  criticalHitRate: number;
  superEffectiveRate: number;
  statusEffectRate: number;

  // 时间统计
  averageTurnTime: number;
  totalDecisionTime: number;
  longestTurn: number;
  shortestTurn: number;
}

// 精灵战斗统计
interface PokemonBattleStats {
  pokemonId: string;
  timeInBattle: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  movesUsed: number;
  criticalHits: number;
  timesSwitchedIn: number;
  timesKnockedOut: number;
  knockouts: number;
  statusInflicted: number;
  statusReceived: number;
}

// 技能战斗统计
interface MoveBattleStats {
  moveId: string;
  timesUsed: number;
  timesHit: number;
  timesMissed: number;
  timesCritical: number;
  totalDamage: number;
  averageDamage: number;
  maxDamage: number;
  minDamage: number;
  superEffectiveHits: number;
  notVeryEffectiveHits: number;
  immuneHits: number;
}

// 战斗回放
interface BattleReplay {
  replayId: string;
  battleId: string;
  version: string;
  participants: ReplayParticipant[];
  settings: ReplaySettings;
  events: ReplayEvent[];
  duration: number;
  fileFormat: ReplayFormat;
  checksum: string;
  createdAt: Date;
}

// 回放参与者
interface ReplayParticipant {
  participantId: string;
  name: string;
  avatar: string;
  team: ReplayPokemon[];
  isWinner: boolean;
  isAI: boolean;
}

// 回放精灵
interface ReplayPokemon {
  pokemonId: string;
  species: string;
  nickname?: string;
  level: number;
  moves: string[];
  item?: string;
  ability: string;
  nature: string;
  ivs: IVComponent;
  evs: EVComponent;
}

// 回放设置
interface ReplaySettings {
  battleType: BattleType;
  rules: BattleRule[];
  timeLimit?: number;
  turnLimit?: number;
  levelLimit?: number;
}

// 回放事件
interface ReplayEvent {
  eventId: string;
  turn: number;
  timestamp: number;
  type: ReplayEventType;
  data: any;
}

// 回放事件类型
enum ReplayEventType {
  GAME_START = 'game_start',
  TURN_START = 'turn_start',
  ACTION_SELECT = 'action_select',
  ACTION_EXECUTE = 'action_execute',
  DAMAGE_CALCULATE = 'damage_calculate',
  STATUS_CHANGE = 'status_change',
  STAT_CHANGE = 'stat_change',
  SWITCH_POKEMON = 'switch_pokemon',
  USE_ITEM = 'use_item',
  WEATHER_CHANGE = 'weather_change',
  FIELD_CHANGE = 'field_change',
  ABILITY_ACTIVATE = 'ability_activate',
  TURN_END = 'turn_end',
  GAME_END = 'game_end'
}

// 回放格式
enum ReplayFormat {
  BINARY = 'binary',                 // 二进制格式
  JSON = 'json',                     // JSON格式
  COMPRESSED = 'compressed'          // 压缩格式
}
```

---

## 精灵培养系统

### 培养系统架构
```typescript
// 培养系统主控制器
interface TrainingSystem {
  // 个体值培养
  trainIVs(pokemon: Entity, targetStats: Partial<IVComponent>, method: IVTrainingMethod): TrainingResult;

  // 努力值培养
  trainEVs(pokemon: Entity, targetEVs: EVComponent, method: EVTrainingMethod): TrainingResult;

  // 性格培养
  changeNature(pokemon: Entity, newNature: NatureType, method: NatureChangeMethod): TrainingResult;

  // 特性培养
  changeAbility(pokemon: Entity, newAbility: string, method: AbilityChangeMethod): TrainingResult;

  // 技能培养
  teachMove(pokemon: Entity, moveId: string, method: MoveTeachingMethod): TrainingResult;

  // 亲密度培养
  increaseFriendship(pokemon: Entity, amount: number, method: FriendshipMethod): TrainingResult;

  // 等级培养
  levelUp(pokemon: Entity, method: LevelUpMethod): LevelUpResult;

  // 进化培养
  evolvePokemon(pokemon: Entity, method: EvolutionMethod): EvolutionResult;

  // 培养计划
  createTrainingPlan(pokemon: Entity, goals: TrainingGoal[]): TrainingPlan;
  executeTrainingPlan(plan: TrainingPlan): PlanExecutionResult;
}

// 个体值培养方法
enum IVTrainingMethod {
  BREEDING = 'breeding',             // 繁殖
  HYPER_TRAINING = 'hyper_training', // 超级训练
  BOTTLE_CAPS = 'bottle_caps',       // 瓶盖
  DESTINY_KNOT = 'destiny_knot',     // 红线
  POWER_ITEMS = 'power_items',       // 加力道具
  IV_CHECKER = 'iv_checker',         // 个体值判定
  JUDGE_SYSTEM = 'judge_system'      // 判定系统
}

// 努力值培养方法
enum EVTrainingMethod {
  BATTLES = 'battles',               // 战斗
  VITAMINS = 'vitamins',             // 维生素
  BERRIES = 'berries',               // 树果
  MACHINES = 'machines',             // 训练机器
  WINGS = 'wings',                   // 羽毛
  RESET_BAG = 'reset_bag',           // 重置包包
  POKERUS = 'pokerus',               // 宝可梦病毒
  POWER_ITEMS = 'power_items',       // 加力道具
  EXP_SHARE = 'exp_share'            // 经验分享
}

// 性格改变方法
enum NatureChangeMethod {
  MINTS = 'mints',                   // 薄荷
  MINT_BERRIES = 'mint_berries',     // 薄荷叶
  SPECIAL_ITEMS = 'special_items',   // 特殊道具
  EVENTS = 'events',                 // 活动
  BREEDING = 'breeding',             // 繁殖
  SPECIAL_TRAINING = 'special_training' // 特殊训练
}

// 特性改变方法
enum AbilityChangeMethod {
  ABILITY_CAPSULE = 'ability_capsule', // 特性胶囊
  ABILITY_PATCH = 'ability_patch',     // 特性补丁
  HIDDEN_ABILITY = 'hidden_ability',   // 隐藏特性
  BREEDING = 'breeding',               // 繁殖
  SPECIAL_ITEMS = 'special_items',     // 特殊道具
  EVENTS = 'events',                   // 活动
  TUTOR = 'tutor'                      // 技能教学
}

// 技能教学方法
enum MoveTeachingMethod {
  TM = 'tm',                         // 招式学习器
  HM = 'hm',                         // 秘传学习器
  TUTOR = 'tutor',                   // 技能教学
  BREEDING = 'breeding',             // 繁殖
  LEVEL_UP = 'level_up',             // 升级
  EVENTS = 'events',                 // 活动
  SPECIAL_ITEMS = 'special_items',   // 特殊道具
  MOVE_RELEARNER = 'move_relearner', // 技能回忆
  Z_MOVE = 'z_move',                 // Z招式
  MAX_MOVE = 'max_move'              // 极巨招式
}

// 亲密度培养方法
enum FriendshipMethod {
  WALKING = 'walking',               // 行走
  BATTLES = 'battles',               // 战斗
  LEVEL_UP = 'level_up',             // 升级
  ITEMS = 'items',                   // 道具
  GROOMING = 'grooming',             // 梳理
  PLAYING = 'playing',               // 玩耍
  HEALING = 'healing',               // 治疗
  BERRIES = 'berries',               // 树果
  SPECIAL_EVENTS = 'special_events'  // 特殊事件
}

// 等级提升方法
enum LevelUpMethod {
  EXPERIENCE = 'experience',         // 经验值
  RARE_CANDY = 'rare_candy',         // 糖果
  EXP_SHARE = 'exp_share',           // 经验分享
  LUCKY_EGG = 'lucky_egg',           // 幸运蛋
  TRAINING = 'training',             // 训练
  EVENTS = 'events',                 // 活动
  SPECIAL_ITEMS = 'special_items'    // 特殊道具
}

// 培养结果
interface TrainingResult {
  success: boolean;
  pokemon: Entity;
  method: string;
  resultType: TrainingResultType;
  changes: TrainingChange[];
  cost: TrainingCost;
  timeSpent: number;
  message: string;
  sideEffects?: SideEffect[];
}

// 培养结果类型
enum TrainingResultType {
  SUCCESS = 'success',               // 成功
  PARTIAL_SUCCESS = 'partial_success', // 部分成功
  FAILED = 'failed',                 // 失败
  CANCELLED = 'cancelled',           // 取消
  ERROR = 'error'                    // 错误
}

// 培养变化
interface TrainingChange {
  changeType: ChangeType;
  oldValue: any;
  newValue: any;
  description: string;
}

// 变化类型
enum ChangeType {
  IV_CHANGE = 'iv_change',           // 个体值变化
  EV_CHANGE = 'ev_change',           // 努力值变化
  NATURE_CHANGE = 'nature_change',   // 性格变化
  ABILITY_CHANGE = 'ability_change', // 特性变化
  MOVE_LEARNED = 'move_learned',     // 学习技能
  MOVE_FORGOTTEN = 'move_forgotten', // 遗忘技能
  LEVEL_UP = 'level_up',             // 升级
  FRIENDSHIP_CHANGE = 'friendship_change', // 亲密度变化
  EVOLUTION = 'evolution',           // 进化
  STAT_CHANGE = 'stat_change'        // 能力值变化
}

// 培养成本
interface TrainingCost {
  currency: Map<string, number>;     // 货币成本
  items: Map<string, number>;        // 道具成本
  time: number;                      // 时间成本
  energy: number;                    // 体力成本
  friendship: number;                // 亲密度成本
  conditions: string[];              // 其他条件
}

// 副作用
interface SideEffect {
  effectType: SideEffectType;
  description: string;
  severity: SideEffectSeverity;
  duration?: number;
  conditions?: string[];
}

// 副作用类型
enum SideEffectType {
  FRIENDSHIP_DECREASE = 'friendship_decrease', // 亲密度下降
  HAPPINESS_DECREASE = 'happiness_decrease',   // 幸福度下降
  STAT_TEMPORARY_CHANGE = 'stat_temporary_change', // 能力值临时变化
  STATUS_CONDITION = 'status_condition',       // 状态异常
  EV_RESET = 'ev_reset',                       // 努力值重置
  MOVE_FORGET = 'move_forget',                 // 遗忘技能
  ABILITY_CHANGE = 'ability_change',           // 特性变化
  CANNOT_EVOLVE = 'cannot_evolve'              // 无法进化
}

// 副作用严重程度
enum SideEffectSeverity {
  MINOR = 'minor',                   // 轻微
  MODERATE = 'moderate',             // 中等
  MAJOR = 'major',                   // 严重
  CRITICAL = 'critical'              // 危险
}

// 培养目标
interface TrainingGoal {
  goalType: GoalType;
  targetValue: any;
  priority: number;
  deadline?: Date;
  conditions: string[];
  rewards?: GoalReward[];
}

// 目标类型
enum GoalType {
  REACH_LEVEL = 'reach_level',       // 达到等级
  MAX_IVS = 'max_ivs',               // 最大个体值
  COMPLETE_EVS = 'complete_evs',     // 完成努力值
  LEARN_MOVES = 'learn_moves',       // 学习技能
  EVOLVE = 'evolve',                 // 进化
  MAX_FRIENDSHIP = 'max_friendship', // 最大亲密度
  WIN_BATTLES = 'win_battles',       // 赢得战斗
  COMPLETE_TRAINING = 'complete_training' // 完成训练
}

// 目标奖励
interface GoalReward {
  rewardType: RewardType;
  amount: number;
  itemId?: string;
  description: string;
}

// 培养计划
interface TrainingPlan {
  planId: string;
  pokemonId: string;
  name: string;
  description: string;
  goals: TrainingGoal[];
  schedule: TrainingSchedule;
  resources: TrainingResources;
  estimatedTime: number;
  estimatedCost: TrainingCost;
  createdAt: Date;
  lastModified: Date;
  status: PlanStatus;
}

// 培养日程
interface TrainingSchedule {
  sessions: TrainingSession[];
  currentSession: number;
  totalSessions: number;
  flexibility: ScheduleFlexibility;
  reminders: ScheduleReminder[];
}

// 培养课程
interface TrainingSession {
  sessionId: string;
  name: string;
  description: string;
  activities: TrainingActivity[];
  duration: number;
  startTime?: Date;
  endTime?: Date;
  status: SessionStatus;
  requirements: SessionRequirement[];
  rewards: SessionReward[];
}

// 培养活动
interface TrainingActivity {
  activityId: string;
  activityType: ActivityType;
  name: string;
  description: string;
  duration: number;
  intensity: IntensityLevel;
  requirements: ActivityRequirement[];
  effects: ActivityEffect[];
  cost: ActivityCost;
}

// 活动类型
enum ActivityType {
  BATTLE_TRAINING = 'battle_training',   // 战斗训练
  STAT_TRAINING = 'stat_training',       // 能力值训练
  MOVE_TRAINING = 'move_training',       // 技能训练
  ENDURANCE_TRAINING = 'endurance_training', // 耐力训练
  SPEED_TRAINING = 'speed_training',     // 速度训练
  SPECIAL_TRAINING = 'special_training', // 特殊训练
  REST = 'rest',                         // 休息
  PLAY = 'play',                         // 玩耍
  GROOMING = 'grooming',                 // 梳理
  FEEDING = 'feeding'                    // 喂食
}

// 强度等级
enum IntensityLevel {
  VERY_LOW = 'very_low',                 // 非常低
  LOW = 'low',                           // 低
  MODERATE = 'moderate',                 // 中等
  HIGH = 'high',                         // 高
  VERY_HIGH = 'very_high',               // 非常高
  EXTREME = 'extreme'                    // 极限
}

// 活动要求
interface ActivityRequirement {
  requirementType: RequirementType;
  value: any;
  description: string;
}

// 要求类型
enum RequirementType {
  MIN_LEVEL = 'min_level',               // 最低等级
  MAX_LEVEL = 'max_level',               // 最高等级
  MIN_FRIENDSHIP = 'min_friendship',     // 最低亲密度
  MAX_FRIENDSHIP = 'max_friendship',     // 最高亲密度
  MIN_HEALTH = 'min_health',             // 最低HP
  MIN_ENERGY = 'min_energy',             // 最低体力
  REQUIRED_ITEM = 'required_item',       // 必需道具
  REQUIRED_MOVE = 'required_move',       // 必需技能
  REQUIRED_ABILITY = 'required_ability', // 必需特性
  WEATHER_CONDITION = 'weather_condition', // 天气条件
  TIME_OF_DAY = 'time_of_day',           // 时间
  LOCATION = 'location',                 // 地点
  TRAINER_LEVEL = 'trainer_level'        // 训练师等级
}

// 活动效果
interface ActivityEffect {
  effectType: EffectType;
  value: number;
  chance: number;
  duration?: number;
  conditions?: string[];
}

// 活动成本
interface ActivityCost {
  energy: number;                        // 体力消耗
  happiness: number;                     // 幸福度消耗
  friendship: number;                    // 亲密度消耗
  items: Map<string, number>;            // 道具消耗
  currency: Map<string, number>;         // 货币消耗
  time: number;                          // 时间消耗
}

// 日程灵活性
enum ScheduleFlexibility {
  RIGID = 'rigid',                       // 严格
  FLEXIBLE = 'flexible',                 // 灵活
  VERY_FLEXIBLE = 'very_flexible',       // 非常灵活
  ADAPTIVE = 'adaptive'                  // 自适应
}

// 日程提醒
interface ScheduleReminder {
  reminderId: string;
  reminderType: ReminderType;
  message: string;
  triggerTime: Date;
  isActive: boolean;
}

// 提醒类型
enum ReminderType {
  SESSION_START = 'session_start',       // 课程开始
  SESSION_END = 'session_end',           // 课程结束
  GOAL_DEADLINE = 'goal_deadline',       // 目标截止
  RESOURCE_LOW = 'resource_low',         // 资源不足
  MILESTONE_REACHED = 'milestone_reached' // 里程碑达成
}

// 培养资源
interface TrainingResources {
  availableItems: Map<string, number>;
  availableCurrency: Map<string, number>;
  availableTime: number;
  availableEnergy: number;
  trainerLevel: number;
  gymBadges: BadgeType[];
  unlockedFeatures: string[];
}

// 计划状态
enum PlanStatus {
  DRAFT = 'draft',                       // 草稿
  ACTIVE = 'active',                     // 活跃
  PAUSED = 'paused',                     // 暂停
  COMPLETED = 'completed',               // 完成
  CANCELLED = 'cancelled',               // 取消
  FAILED = 'failed'                      // 失败
}

// 课程状态
enum SessionStatus {
  SCHEDULED = 'scheduled',               // 已安排
  IN_PROGRESS = 'in_progress',           // 进行中
  COMPLETED = 'completed',               // 完成
  SKIPPED = 'skipped',                   // 跳过
  CANCELLED = 'cancelled',               // 取消
  FAILED = 'failed'                      // 失败
}

// 计划执行结果
interface PlanExecutionResult {
  planId: string;
  executionId: string;
  success: boolean;
  completedGoals: TrainingGoal[];
  partiallyCompletedGoals: TrainingGoal[];
  failedGoals: TrainingGoal[];
  timeSpent: number;
  costIncurred: TrainingCost;
  unexpectedEvents: UnexpectedEvent[];
  recommendations: string[];
  nextSteps: string[];
}

// 意外事件
interface UnexpectedEvent {
  eventId: string;
  eventType: EventType;
  description: string;
  timestamp: Date;
  impact: EventImpact;
  resolution?: string;
  prevention?: string;
}

// 事件类型
enum EventType {
  POKEMON_SICK = 'pokemon_sick',         // 精灵生病
  INJURY = 'injury',                     // 受伤
  EXHAUSTION = 'exhaustion',             // 疲劳
  BAD_WEATHER = 'bad_weather',           // 恶劣天气
  ITEM_SHORTAGE = 'item_shortage',       // 道具短缺
  MOTIVATION_DROP = 'motivation_drop',   // 动力下降
  SKILL_REGRESSION = 'skill_regression', // 技能退化
  UNEXPECTED_EVOLUTION = 'unexpected_evolution', // 意外进化
  SPECIAL_DISCOVERY = 'special_discovery', // 特殊发现
  RARE_ENCOUNTER = 'rare_encounter'     // 稀有遭遇
}

// 事件影响
enum EventImpact {
  POSITIVE = 'positive',                 // 正面影响
  NEGATIVE = 'negative',                 // 负面影响
  NEUTRAL = 'neutral',                   // 中性影响
  MIXED = 'mixed'                        // 混合影响
}
```

---

## PVP系统设计

### PVP系统架构
```typescript
// PVP系统主控制器
interface PVPSystem {
  // 匹配系统
  findMatch(request: MatchRequest): Promise<MatchResult>;
  cancelMatch(requestId: string): Promise<boolean>;

  // 房间管理
  createRoom(settings: RoomSettings): Promise<Room>;
  joinRoom(roomId: string, participant: PVPParticipant): Promise<boolean>;
  leaveRoom(roomId: string, participantId: string): Promise<boolean>;

  // 对战管理
  startBattle(roomId: string): Promise<BattleEntity>;
  handleBattleAction(battleId: string, action: PVPAction): Promise<ActionResult>;
  endBattle(battleId: string, result: PVPBattleResult): Promise<void>;

  // 排行榜系统
  updateRankings(battleResult: PVPBattleResult): Promise<void>;
  getRankings(season: string, division: string): Promise<RankingEntry[]>;

  // 奖励系统
  calculateRewards(battleResult: PVPBattleResult): PVPReward[];
  distributeRewards(participantId: string, rewards: PVPReward[]): Promise<void>;

  // 赛季系统
  getCurrentSeason(): PVPSeason;
  startNewSeason(): Promise<PVPSeason>;
  endCurrentSeason(): Promise<void>;
}

// 匹配请求
interface MatchRequest {
  requestId: string;
  participantId: string;
  participantInfo: PVPParticipantInfo;
  preferences: MatchPreferences;
  restrictions: MatchRestrictions;
  timestamp: Date;
  timeout: number;
}

// PVP参与者信息
interface PVPParticipantInfo {
  trainerId: string;
  name: string;
  avatar: string;
  level: number;
  rank: PVPRank;
  rating: number;
  winRate: number;
  battlesPlayed: number;
  recentResults: BattleResult[];
  team: PVPTeam;
  badges: BadgeType[];
  achievements: AchievementType[];
}

// PVP队伍
interface PVPTeam {
  teamId: string;
  name: string;
  pokemons: PVPPokemon[];
  teamStrategy: TeamStrategy;
  teamSynergy: TeamSynergy;
  restrictions: TeamRestrictions;
}

// PVP精灵
interface PVPPokemon {
  pokemonId: string;
  species: string;
  level: number;
  moves: string[];
  item?: string;
  ability: string;
  nature: string;
  ivs: IVComponent;
  evs: EVComponent;
  happiness: number;
  friendship: number;
  originalTrainer: string;
}

// 队伍策略
interface TeamStrategy {
  strategyType: StrategyType;
  description: string;
  corePokemon: string[];
  supportPokemon: string[];
  sweepers: string[];
  walls: string[];
  leads: string[];
  midGame: string[];
  lateGame: string[];
}

// 策略类型
enum StrategyType {
  BALANCED = 'balanced',               // 平衡型
  OFFENSIVE = 'offensive',             // 攻击型
  DEFENSIVE = 'defensive',             // 防守型
  STALL = 'stall',                     // 拖延型
  HYPER_OFFENSE = 'hyper_offense',     // 极攻型
  RAIN = 'rain',                       // 雨天队
  SUN = 'sun',                         // 晴天队
  SAND = 'sand',                       // 沙暴队
  HAIL = 'hail',                       // 冰雹队
  TRICK_ROOM = 'trick_room',           // 戏法空间
  BATON_PASS = 'baton_pass',           // 接力棒
  WEATHER = 'weather',                 // 天气队
  TERRAIN = 'terrain',                 // 场地队
  CORE = 'core',                       // 核心队
  SYNERGY = 'synergy'                  // 协力队
}

// 队伍协力
interface TeamSynergy {
  typeSynergy: TypeSynergy;
  abilitySynergy: AbilitySynergy;
  moveSynergy: MoveSynergy;
  itemSynergy: ItemSynergy;
  overallSynergy: number;
  synergyScore: number;
}

// 属性协力
interface TypeSynergy {
  offensiveCoverage: number;
  defensiveStability: number;
  resistanceCoverage: string[];
  weaknessCoverage: string[];
  immunities: string[];
}

// 特性协力
interface AbilitySynergy {
  complementaryAbilities: string[];
  abilityCombos: AbilityCombo[];
  weatherAbilities: string[];
  terrainAbilities: string[];
}

// 特性组合
interface AbilityCombo {
  ability1: string;
  ability2: string;
  description: string;
  effectiveness: number;
}

// 技能协力
interface MoveSynergy {
  moveCombos: MoveCombo[];
  coverageMoves: string[];
  supportMoves: string[];
  setupMoves: string[];
  priorityMoves: string[];
}

// 技能组合
interface MoveCombo {
  move1: string;
  move2: string;
  description: string;
  effectiveness: number;
}

// 道具协力
interface ItemSynergy {
  itemCombos: ItemCombo[];
  sharedBenefits: string[];
  teamItems: string[];
  individualItems: string[];
}

// 道具组合
interface ItemCombo {
  item1: string;
  item2: string;
  description: string;
  effectiveness: number;
}

// 队伍限制
interface TeamRestrictions {
  maxLevel: number;
  bannedSpecies: string[];
  bannedMoves: string[];
  bannedItems: string[];
  requiredSpecies?: string[];
  requiredItems?: string[];
  clause: ClauseType[];
}

// 条款类型
enum ClauseType {
  SLEEP_CLAUSE = 'sleep_clause',       // 睡眠条款
  FREEZE_CLAUSE = 'freeze_clause',     // 冰冻条款
  SPECIES_CLAUSE = 'species_clause',   // 种族条款
  ITEM_CLAUSE = 'item_clause',         // 道具条款
  SELF_KO_CLAUSE = 'self_ko_clause',   // 自爆条款
  OHKO_CLAUSE = 'ohko_clause',         // 一击必杀条款
  MOODY_CLAUSE = 'moody_clause',       // 心情不定条款
  BATON_PASS_CLAUSE = 'baton_pass_clause', // 接力棒条款
  ENDLESS_BATTLE_CLAUSE = 'endless_battle_clause', // 无尽战斗条款
  CAPTURE_CLAUSE = 'capture_clause',   // 捕获条款
  TIMER_CLAUSE = 'timer_clause',       // 计时条款
  MEGA_CLAUSE = 'mega_clause',         // 超进化条款
  Z_MOVE_CLAUSE = 'z_move_clause',     // Z招式条款
  DYNAMAX_CLAUSE = 'dynamax_clause',   // 极巨化条款
  TERA_CLAUSE = 'tera_clause'          // 太晶化条款
}

// 匹配偏好
interface MatchPreferences {
  battleType: BattleType;
  battleFormat: BattleFormat;
  rankRange?: [number, number];
  region?: string;
  language?: string;
  preferredRules: ClauseType[];
  avoidRules: ClauseType[];
  teamSize: number;
  timeLimit?: number;
  spectatorsAllowed: boolean;
  recordingAllowed: boolean;
}

// 对战格式
enum BattleFormat {
  SINGLES_6V6 = 'singles_6v6',         // 单打6v6
  DOUBLES_4V4 = 'doubles_4v4',         // 双打4v4
  SINGLES_3V3 = 'singles_3v3',         // 单打3v3
  DOUBLES_2V2 = 'doubles_2v2',         // 双打2v2
  SINGLES_1V1 = 'singles_1v1',         // 单打1v1
  DOUBLES_1V1 = 'doubles_1v1',         // 双打1v1
  BATTLE_ROYALE = 'battle_royale',     // 大乱斗
  MULTI_BATTLE = 'multi_battle',       // 多人对战
  ROTATION_BATTLE = 'rotation_battle', // 轮换对战
  TRIPLE_BATTLE = 'triple_battle',     // 三打对战
  HORDE_BATTLE = 'horde_battle',       // 群战
  CUSTOM = 'custom'                    // 自定义
}

// 匹配限制
interface MatchRestrictions {
  minRating?: number;
  maxRating?: number;
  allowedRegions?: string[];
  blockedUsers?: string[];
  requiredFeatures?: string[];
  excludedFeatures?: string[];
  timeWindow?: [Date, Date];
  maxWaitTime?: number;
}

// 匹配结果
interface MatchResult {
  success: boolean;
  matchId?: string;
  roomId?: string;
  opponent?: PVPParticipantInfo;
  estimatedWaitTime?: number;
  failureReason?: string;
  suggestions?: string[];
}

// PVP参与者
interface PVPParticipant {
  participantId: string;
  participantInfo: PVPParticipantInfo;
  connection: PVPConnection;
  status: ParticipantStatus;
  readyStatus: boolean;
  selectedTeam: PVPTeam;
  battleHistory: PVPBattleHistory;
}

// PVP连接
interface PVPConnection {
  connectionId: string;
  status: ConnectionStatus;
  latency: number;
  lastHeartbeat: Date;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  connectionQuality: ConnectionQuality;
}

// 连接状态
enum ConnectionStatus {
  CONNECTED = 'connected',             // 已连接
  DISCONNECTED = 'disconnected',       // 已断开
  RECONNECTING = 'reconnecting',       // 重连中
  TIMEOUT = 'timeout',                 // 超时
  ERROR = 'error'                      // 错误
}

// 连接质量
enum ConnectionQuality {
  EXCELLENT = 'excellent',             // 优秀
  GOOD = 'good',                       // 良好
  FAIR = 'fair',                       // 一般
  POOR = 'poor',                       // 较差
  VERY_POOR = 'very_poor'              // 很差
}

// 参与者状态
enum ParticipantStatus {
  WAITING = 'waiting',                 // 等待中
  READY = 'ready',                     // 准备就绪
  IN_BATTLE = 'in_battle',             // 战斗中
  DISCONNECTED = 'disconnected',       // 断线
  FORFEITED = 'forfeited',             // 认输
  SPECTATING = 'spectating'            // 观战中
}

// PVP战斗历史
interface PVPBattleHistory {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  forfeits: number;
  disconnects: number;
  currentStreak: number;
  bestStreak: number;
  recentBattles: PVPBattleResult[];
  favoritePokemon: Map<string, number>;
  favoriteMoves: Map<string, number>;
  winRateByFormat: Map<BattleFormat, number>;
  averageBattleDuration: number;
}

// PVP战斗结果
interface PVPBattleResult {
  battleId: string;
  battleType: BattleType;
  battleFormat: BattleFormat;
  participants: PVPParticipant[];
  winner: string;
  loser: string;
  result: BattleResult;
  duration: number;
  turns: number;
  startTime: Date;
  endTime: Date;
  ratingChanges: Map<string, RatingChange>;
  rewards: Map<string, PVPReward[]>;
  replay: BattleReplay;
  statistics: PVPBattleStatistics;
  events: PVPBattleEvent[];
}

// 战斗结果
enum BattleResult {
  WIN = 'win',                         // 胜利
  LOSE = 'lose',                       // 失败
  DRAW = 'draw',                       // 平局
  FORFEIT = 'forfeit',                 // 认输
  DISCONNECT = 'disconnect',           // 断线
  TIMEOUT = 'timeout',                 // 超时
  ERROR = 'error'                      // 错误
}

// 评级变化
interface RatingChange {
  oldRating: number;
  newRating: number;
  change: number;
  rankChange: RankChange;
  confidence: number;
  volatility: number;
}

// 等级变化
interface RankChange {
  oldRank: PVPRank;
  newRank: PVPRank;
  promotion: boolean;
  demotion: boolean;
  tierProgress: number;
}

// PVP等级
interface PVPRank {
  rankId: string;
  tier: RankTier;
  division: RankDivision;
  rating: number;
  tierProgress: number;
  maxRating: number;
  seasonHigh: number;
  allTimeHigh: number;
  promotions: number;
  demotions: number;
}

// 等级段位
enum RankTier {
  BRONZE = 'bronze',                   // 青铜
  SILVER = 'silver',                   // 白银
  GOLD = 'gold',                       // 黄金
  PLATINUM = 'platinum',               // 白金
  DIAMOND = 'diamond',                 // 钻石
  MASTER = 'master',                   // 大师
  GRANDMASTER = 'grandmaster',         // 宗师
  CHALLENGER = 'challenger'            // 挑战者
}

// 等级分组
enum RankDivision {
  I = 'I',                             // 第一级
  II = 'II',                           // 第二级
  III = 'III',                         // 第三级
  IV = 'IV'                            // 第四级
}

// PVP奖励
interface PVPReward {
  rewardType: PVPRewardType;
  amount: number;
  itemId?: string;
  pokemonId?: string;
  moveId?: string;
  cosmeticId?: string;
  titleId?: string;
  badgeId?: string;
  description: string;
  rarity: RewardRarity;
  temporary: boolean;
  expirationDate?: Date;
}

// PVP奖励类型
enum PVPRewardType {
  RATING = 'rating',                   // 评级积分
  CURRENCY = 'currency',               // 货币
  TOKENS = 'tokens',                   // 代币
  ITEMS = 'items',                     // 道具
  POKEMON = 'pokemon',                 // 精灵
  MOVES = 'moves',                     // 技能
  COSMETICS = 'cosmetics',             // 装饰品
  TITLES = 'titles',                   // 称号
  BADGES = 'badges',                   // 徽章
  EMOTES = 'emotes',                   // 表情
  AVATAR_FRAMES = 'avatar_frames',     // 头像框
  THEMES = 'themes',                   // 主题
  BATTLE_EFFECTS = 'battle_effects'    // 战斗特效
}

// 奖励稀有度
enum RewardRarity {
  COMMON = 'common',                   // 普通
  UNCOMMON = 'uncommon',               // 不常见
  RARE = 'rare',                       // 稀有
  EPIC = 'epic',                       // 史诗
  LEGENDARY = 'legendary',             // 传说
  MYTHICAL = 'mythical'                // 神话
}

// PVP战斗统计
interface PVPBattleStatistics {
  // 战斗统计
  battleStatistics: BattleStatistics;

  // PVP特有统计
  turnTimeStats: TurnTimeStats;
  moveUsageStats: MoveUsageStats;
  pokemonUsageStats: PokemonUsageStats;
  teamCompositionStats: TeamCompositionStats;
  strategyStats: StrategyStats;
  formatStats: FormatStats;
}

// 回合时间统计
interface TurnTimeStats {
  averageTurnTime: number;
  fastestTurn: number;
  slowestTurn: number;
  medianTurnTime: number;
  timeOuts: number;
  quickDecisions: number;
  longDecisions: number;
}

// 技能使用统计
interface MoveUsageStats {
  mostUsedMoves: Map<string, number>;
  leastUsedMoves: Map<string, number>;
  moveSuccessRate: Map<string, number>;
  moveDamageDealt: Map<string, number>;
  moveTargets: Map<string, TargetType[]>;
  moveEffectiveness: Map<string, number>;
}

// 精灵使用统计
interface PokemonUsageStats {
  mostUsedPokemon: Map<string, number>;
  leastUsedPokemon: Map<string, number>;
  pokemonWinRate: Map<string, number>;
  pokemonAverageTurnsInBattle: Map<string, number>;
  pokemonKODRatio: Map<string, number>;
  pokemonUsageByFormat: Map<string, Map<BattleFormat, number>>;
}

// 队伍构成统计
interface TeamCompositionStats {
  mostUsedTeamCompositions: TeamComposition[];
  teamDiversity: number;
  typeDistribution: Map<PokemonType, number>;
  roleDistribution: Map<TeamRole, number>;
  synergyScores: number[];
  averageTeamRating: number;
}

// 队伍构成
interface TeamComposition {
  pokemons: string[];
  usageCount: number;
  winRate: number;
  averageRating: number;
  typeDistribution: Map<PokemonType, number>;
  strategy: StrategyType;
}

// 队伍角色
enum TeamRole {
  LEAD = 'lead',                       // 领队
  SWEEPER = 'sweeper',                 // 清场手
  WALL = 'wall',                       // 壁牌
  SUPPORT = 'support',                 // 辅助
  TANK = 'tank',                       // 坦克
  SETUP = 'setup',                     // 强化手
  REVENGE_KILLER = 'revenge_killer',   // 复仇杀手
  STALLER = 'staller',                 // 拖延手
  CLERIC = 'cleric',                   // 治疗师
  PHAZER = 'phazer'                    // 吹飞手
}

// 策略统计
interface StrategyStats {
  strategyWinRate: Map<StrategyType, number>;
  strategyUsageRate: Map<StrategyType, number>;
  strategyCounters: Map<StrategyType, StrategyType[]>;
  strategySynergies: Map<StrategyType, StrategyType[]>;
  averageGameLength: Map<StrategyType, number>;
}

// 格式统计
interface FormatStats {
  formatPopularity: Map<BattleFormat, number>;
  formatWinRate: Map<BattleFormat, number>;
  averageGameLength: Map<BattleFormat, number>;
  mostUsedPokemonByFormat: Map<BattleFormat, string[]>;
  mostUsedMovesByFormat: Map<BattleFormat, string[]>;
}

// PVP战斗事件
interface PVPBattleEvent {
  eventId: string;
  eventType: PVPEventType;
  timestamp: Date;
  participantId: string;
  data: any;
  message: string;
  importance: EventImportance;
}

// PVP事件类型
enum PVPEventType {
  MATCH_FOUND = 'match_found',         // 找到匹配
  BATTLE_START = 'battle_start',       // 战斗开始
  TURN_START = 'turn_start',           // 回合开始
  ACTION_SELECTED = 'action_selected', // 选择行动
  ACTION_EXECUTED = 'action_executed', // 执行行动
  CRITICAL_HIT = 'critical_hit',       // 暴击
  MISS = 'miss',                       // 未命中
  STATUS_APPLIED = 'status_applied',   // 状态施加
  POKEMON_FAINTED = 'pokemon_fainted', // 精灵濒死
  POKEMON_SWITCHED = 'pokemon_switched', // 精灵替换
  ITEM_USED = 'item_used',             // 使用道具
  ABILITY_ACTIVATED = 'ability_activated', // 特性激活
  WEATHER_CHANGED = 'weather_changed', // 天气变化
  FIELD_CHANGED = 'field_changed',     // 场地变化
  TIME_WARNING = 'time_warning',       // 时间警告
  DISCONNECTION = 'disconnection',     // 断线
  RECONNECTION = 'reconnection',       // 重连
  FORFEIT = 'forfeit',                 // 认输
  BATTLE_END = 'battle_end',           // 战斗结束
  RATING_CHANGE = 'rating_change',     // 评级变化
  RANK_CHANGE = 'rank_change',         // 等级变化
  REWARD_EARNED = 'reward_earned'      // 获得奖励
}

// 事件重要性
enum EventImportance {
  TRIVIAL = 'trivial',                 // 微不足道
  MINOR = 'minor',                     // 次要
  NORMAL = 'normal',                   // 正常
  IMPORTANT = 'important',             // 重要
  CRITICAL = 'critical',               // 关键
  GAME_CHANGING = 'game_changing'      // 改变战局
}

// 房间设置
interface RoomSettings {
  roomId: string;
  roomName: string;
  roomType: RoomType;
  isPrivate: boolean;
  password?: string;
  maxParticipants: number;
  battleType: BattleType;
  battleFormat: BattleFormat;
  rules: BattleRule[];
  timeLimit: number;
  spectatorLimit: number;
  recordingEnabled: boolean;
  chatEnabled: boolean;
  createdBy: string;
  createdAt: Date;
}

// 房间类型
enum RoomType {
  PUBLIC = 'public',                   // 公开
  PRIVATE = 'private',                 // 私人
  TOURNAMENT = 'tournament',           // 锦标赛
  CUSTOM = 'custom',                   // 自定义
  RANKED = 'ranked',                   // 排位赛
  CASUAL = 'casual',                   // 娱乐赛
  PRACTICE = 'practice',               // 练习赛
  EVENT = 'event'                      // 活动
}

// 房间
interface Room {
  roomId: string;
  settings: RoomSettings;
  participants: PVPParticipant[];
  spectators: Spectator[];
  status: RoomStatus;
  currentBattle?: BattleEntity;
  chatMessages: ChatMessage[];
  createdAt: Date;
  lastActivity: Date;
}

// 房间状态
enum RoomStatus {
  WAITING = 'waiting',                 // 等待中
  READY = 'ready',                     // 准备就绪
  IN_BATTLE = 'in_battle',             // 战斗中
  FINISHED = 'finished',               // 已结束
  CLOSED = 'closed',                   // 已关闭
  ERROR = 'error'                      // 错误
}

// 观众
interface Spectator {
  spectatorId: string;
  name: string;
  avatar: string;
  joinTime: Date;
  canChat: boolean;
  canInteract: boolean;
  status: SpectatorStatus;
}

// 观众状态
enum SpectatorStatus {
  WATCHING = 'watching',               // 观看中
  AWAY = 'away',                       // 离开
  DISCONNECTED = 'disconnected'        // 断线
}

// 聊天消息
interface ChatMessage {
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  messageType: MessageType;
  isSystemMessage: boolean;
}

// 消息类型
enum MessageType {
  TEXT = 'text',                       // 文本
  EMOTE = 'emote',                     // 表情
  SYSTEM = 'system',                   // 系统
  BATTLE_EVENT = 'battle_event',       // 战斗事件
  RANK_CHANGE = 'rank_change',         // 等级变化
  ACHIEVEMENT = 'achievement'          // 成就
}

// PVP行动
interface PVPAction {
  actionId: string;
  participantId: string;
  actionType: PVPActionType;
  data: any;
  timestamp: Date;
  turn: number;
  timeRemaining: number;
}

// PVP行动类型
enum PVPActionType {
  SELECT_MOVE = 'select_move',         // 选择技能
  SELECT_SWITCH = 'select_switch',     // 选择替换
  SELECT_ITEM = 'select_item',         // 选择道具
  FORFEIT = 'forfeit',                 // 认输
  REQUEST_TIME_EXTENSION = 'request_time_extension', // 请求延长时间
  CHAT_MESSAGE = 'chat_message',       // 聊天消息
  EMOTE = 'emote',                     // 表情
  SPECTATE_REQUEST = 'spectate_request', // 观战请求
  REPLAY_REQUEST = 'replay_request',   // 回放请求
  REPORT = 'report'                    // 举报
}

// PVP赛季
interface PVPSeason {
  seasonId: string;
  seasonNumber: number;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  format: BattleFormat;
  rules: BattleRule[];
  rewards: SeasonReward[];
  milestones: SeasonMilestone[];
  specialEvents: SeasonEvent[];
  statistics: SeasonStatistics;
}

// 赛季奖励
interface SeasonReward {
  rewardType: PVPRewardType;
  minRank: PVPRank;
  maxRank?: PVPRank;
  rewards: PVPReward[];
  description: string;
  isExclusive: boolean;
}

// 赛季里程碑
interface SeasonMilestone {
  milestoneId: string;
  name: string;
  description: string;
  requirement: MilestoneRequirement;
  rewards: PVPReward[];
  isRepeatable: boolean;
  progress: number;
  maxProgress: number;
}

// 里程碑要求
interface MilestoneRequirement {
  type: MilestoneType;
  value: number;
  description: string;
}

// 里程碑类型
enum MilestoneType {
  RATING = 'rating',                   // 评级
  WINS = 'wins',                       // 胜场
  BATTLES = 'battles',                 // 战场
  WIN_RATE = 'win_rate',               // 胜率
  POKEMON_USED = 'pokemon_used',       // 使用精灵
  MOVES_USED = 'moves_used',           // 使用技能
  PERFECT_BATTLES = 'perfect_battles', // 完美战斗
  COMEBACK_WINS = 'comeback_wins',     // 逆转胜利
  QUICK_WINS = 'quick_wins',           // 快速胜利
  DIVERSITY = 'diversity'              // 多样性
}

// 赛季活动
interface SeasonEvent {
  eventId: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  eventType: EventType;
  requirements: EventRequirement[];
  rewards: PVPReward[];
  isActive: boolean;
  participation: number;
}

// 活动要求
interface EventRequirement {
  requirementType: EventRequirementType;
  value: any;
  description: string;
}

// 活动要求类型
enum EventRequirementType {
  MIN_RATING = 'min_rating',           // 最低评级
  MIN_BATTLES = 'min_battles',         // 最低战场数
  SPECIFIC_FORMAT = 'specific_format', // 特定格式
  SPECIFIC_POKEMON = 'specific_pokemon', // 特定精灵
  TEAM_THEME = 'team_theme',           // 队伍主题
  TIME_WINDOW = 'time_window',         // 时间窗口
  LOCATION = 'location',               // 地点
  BADGE = 'badge',                     // 徽章
  ACHIEVEMENT = 'achievement'          // 成就
}

// 赛季统计
interface SeasonStatistics {
  totalParticipants: number;
  activeParticipants: number;
  totalBattles: number;
  averageRating: number;
  highestRating: number;
  mostUsedPokemon: Map<string, number>;
  mostUsedMoves: Map<string, number>;
  averageBattleDuration: number;
  participationRate: number;
  completionRate: number;
}

// 排行榜条目
interface RankingEntry {
  rank: number;
  participant: PVPParticipantInfo;
  rating: number;
  rank: PVPRank;
  winRate: number;
  battlesPlayed: number;
  lastActive: Date;
  trend: RankingTrend;
  badge: RankingBadge;
}

// 排行榜趋势
enum RankingTrend {
  UP = 'up',                           // 上升
  DOWN = 'down',                       // 下降
  STABLE = 'stable',                   // 稳定
  NEW = 'new',                         // 新上榜
  INACTIVE = 'inactive'                // 不活跃
}

// 排行榜徽章
interface RankingBadge {
  badgeId: string;
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  condition: BadgeCondition;
}

// 徽章稀有度
enum BadgeRarity {
  COMMON = 'common',                   // 普通
  UNCOMMON = 'uncommon',               // 不常见
  RARE = 'rare',                       // 稀有
  EPIC = 'epic',                       // 史诗
  LEGENDARY = 'legendary',             // 传说
  UNIQUE = 'unique'                    // 独一无二
}

// 徽章条件
interface BadgeCondition {
  type: BadgeConditionType;
  value: any;
  description: string;
}

// 徽章条件类型
enum BadgeConditionType {
  TOP_RANK = 'top_rank',               // 顶级排名
  WIN_STREAK = 'win_streak',           // 连胜
  PERFECT_SEASON = 'perfect_season',   // 完美赛季
  DIVERSITY_MASTER = 'diversity_master', // 多样性大师
  STRATEGY_MASTER = 'strategy_master', // 策略大师
  FORMAT_MASTER = 'format_master',     // 格式大师
  COMMUNITY_FAVORITE = 'community_favorite', // 社区最爱
  EARLY_ADOPTER = 'early_adopter',     // 早期采用者
  VETERAN = 'veteran',                 // 老兵
  LEGEND = 'legend'                    // 传奇
}
```

---

## PVE系统设计

### PVE系统架构
```typescript
// PVE系统主控制器
interface PVESystem {
  // 剧情系统
  startChapter(chapterId: string): Promise<Chapter>;
  progressQuest(questId: string, action: QuestAction): Promise<QuestProgress>;
  completeQuest(questId: string): Promise<QuestReward>;

  // 副本系统
  enterDungeon(dungeonId: string, team: Entity[]): Promise<DungeonSession>;
  progressDungeon(sessionId: string, action: DungeonAction): Promise<DungeonResult>;
  exitDungeon(sessionId: string): Promise<DungeonSummary>;

  // Boss战系统
  challengeBoss(bossId: string, team: Entity[]): Promise<BossBattle>;
  executeBossAction(battleId: string, action: BossAction): Promise<BossActionResult>;

  // 世界探索
  exploreArea(areaId: string): Promise<ExplorationResult>;
  discoverLocation(locationId: string): Promise<DiscoveryResult>;
  interactWithObject(objectId: string): Promise<InteractionResult>;

  // NPC交互
  talkToNPC(npcId: string): Promise<DialogueResult>;
  acceptQuestFromNPC(npcId: string): Promise<Quest>;
  completeQuestForNPC(npcId: string, questId: string): Promise<QuestReward>;

  // 事件系统
  triggerEvent(eventId: string): Promise<EventResult>;
  resolveEventChoice(eventId: string, choiceId: string): Promise<ChoiceResult>;

  // 成就系统
  unlockAchievement(achievementId: string): Promise<AchievementReward>;
  updateAchievementProgress(achievementId: string, progress: number): Promise<void>;

  // 奖励系统
  calculateRewards(activity: PVEActivity, completion: CompletionLevel): PVEReward[];
  distributeRewards(trainerId: string, rewards: PVEReward[]): Promise<void>;
}

// 章节系统
interface Chapter {
  chapterId: string;
  chapterNumber: number;
  title: string;
  description: string;
  story: StoryEntry[];
  quests: Quest[];
  requiredLevel: number;
  prerequisites: string[];
  rewards: ChapterReward[];
  locations: LocationEntry[];
  npcs: NPCEntry[];
  completionStatus: ChapterStatus;
  progress: ChapterProgress;
}

// 故事条目
interface StoryEntry {
  entryId: string;
  type: StoryType;
  content: string;
  character?: string;
  background?: string;
  music?: string;
  soundEffects?: string[];
  choices?: StoryChoice[];
  conditions: StoryCondition[];
  nextEntry?: string;
  isOptional: boolean;
}

// 故事类型
enum StoryType {
  NARRATIVE = 'narrative',             // 叙述
  DIALOGUE = 'dialogue',               // 对话
  MONOLOGUE = 'monologue',             // 独白
  DESCRIPTION = 'description',         // 描述
  CUTSCENE = 'cutscene',               // 过场动画
  FLASHBACK = 'flashback',             // 闪回
  DREAM = 'dream',                     // 梦境
  VISION = 'vision'                    // 幻象
}

// 故事选择
interface StoryChoice {
  choiceId: string;
  text: string;
  consequence: StoryConsequence;
  requirements: StoryRequirement[];
  weight: number;
  isGoodChoice?: boolean;
  isBadChoice?: boolean;
  isNeutralChoice?: boolean;
}

// 故事后果
interface StoryConsequence {
  consequenceType: ConsequenceType;
  value: any;
  description: string;
  immediateEffect?: boolean;
  delayedEffect?: boolean;
  permanentEffect?: boolean;
}

// 后果类型
enum ConsequenceType {
  RELATIONSHIP_CHANGE = 'relationship_change', // 关系变化
  QUEST_UNLOCK = 'quest_unlock',       // 任务解锁
  ITEM_GAIN = 'item_gain',             // 获得道具
  STAT_CHANGE = 'stat_change',         // 能力值变化
  REPUTATION_CHANGE = 'reputation_change', // 声望变化
  STORY_BRANCH = 'story_branch',       // 故事分支
  ACHIEVEMENT_UNLOCK = 'achievement_unlock', // 成就解锁
  LOCATION_UNLOCK = 'location_unlock', // 地点解锁
  BATTLE_TRIGGER = 'battle_trigger',   // 触发战斗
  EVENT_TRIGGER = 'event_trigger'      // 触发事件
}

// 故事要求
interface StoryRequirement {
  requirementType: StoryRequirementType;
  value: any;
  description: string;
}

// 故事要求类型
enum StoryRequirementType {
  LEVEL = 'level',                     // 等级
  QUEST_COMPLETED = 'quest_completed', // 任务完成
  ITEM_OWNED = 'item_owned',           // 拥有道具
  POKEMON_OWNED = 'pokemon_owned',     // 拥有精灵
  BADGE_EARNED = 'badge_earned',       // 获得徽章
  RELATIONSHIP_LEVEL = 'relationship_level', // 关系等级
  REPUTATION_LEVEL = 'reputation_level', // 声望等级
  TIME_OF_DAY = 'time_of_day',         // 时间
  WEATHER = 'weather',                 // 天气
  LOCATION = 'location',               // 地点
  STORY_BRANCH = 'story_branch',       // 故事分支
  CHOICE_MADE = 'choice_made'         // 做出选择
}

// 章节状态
enum ChapterStatus {
  LOCKED = 'locked',                   // 锁定
  AVAILABLE = 'available',             // 可用
  IN_PROGRESS = 'in_progress',         // 进行中
  COMPLETED = 'completed',             // 完成
  PERFECT = 'perfect'                  // 完美
}

// 章节进度
interface ChapterProgress {
  questsCompleted: number;
  totalQuests: number;
  sideQuestsCompleted: number;
  totalSideQuests: number;
  collectiblesFound: number;
  totalCollectibles: number;
  secretsFound: number;
  totalSecrets: number;
  completionPercentage: number;
  timeSpent: number;
  lastPlayed: Date;
}

// 章节奖励
interface ChapterReward {
  rewardType: ChapterRewardType;
  amount: number;
  itemId?: string;
  pokemonId?: string;
  moveId?: string;
  abilityId?: string;
  titleId?: string;
  cosmeticId?: string;
  description: string;
  isGuaranteed: boolean;
  chance?: number;
}

// 章节奖励类型
enum ChapterRewardType {
  EXPERIENCE = 'experience',           // 经验值
  MONEY = 'money',                     // 金币
  ITEMS = 'items',                     // 道具
  POKEMON = 'pokemon',                 // 精灵
  MOVES = 'moves',                     // 技能
  ABILITIES = 'abilities',             // 特性
  TITLES = 'titles',                   // 称号
  COSMETICS = 'cosmetics',             // 装饰品
  BADGES = 'badges',                   // 徽章
  ACCESS = 'access',                   // 访问权限
  STORY_CONTENT = 'story_content',     // 故事内容
  SPECIAL_FEATURES = 'special_features' // 特殊功能
}

// 任务系统
interface Quest {
  questId: string;
  title: string;
  description: string;
  questType: QuestType;
  objectives: QuestObjective[];
  rewards: QuestReward[];
  requirements: QuestRequirement[];
  timeLimit?: number;
  isRepeatable: boolean;
  isHidden: boolean;
  isSideQuest: boolean;
  difficulty: QuestDifficulty;
  recommendedLevel: number;
  location: string;
  npcGiver: string;
  npcReceiver?: string;
  status: QuestStatus;
  progress: QuestProgressData;
  startTime?: Date;
  endTime?: Date;
  completedDate?: Date;
}

// 任务类型
enum QuestType {
  MAIN_STORY = 'main_story',           // 主线任务
  SIDE_STORY = 'side_story',           // 支线任务
  DAILY = 'daily',                     // 日常任务
  WEEKLY = 'weekly',                   // 周常任务
  MONTHLY = 'monthly',                 // 月常任务
  EVENT = 'event',                     // 活动任务
  SPECIAL = 'special',                 // 特殊任务
  HIDDEN = 'hidden',                   // 隐藏任务
  CHAIN = 'chain',                     // 连锁任务
  TIMED = 'timed',                     // 限时任务
  BOUNTY = 'bounty',                   // 赏金任务
  EXPLORATION = 'exploration',         // 探索任务
  COLLECTION = 'collection',           // 收集任务
  BATTLE = 'battle',                   // 战斗任务
  SOCIAL = 'social',                   // 社交任务
  CRAFTING = 'crafting',               // 制作任务
  DELIVERY = 'delivery'                // 递送任务
}

// 任务目标
interface QuestObjective {
  objectiveId: string;
  description: string;
  objectiveType: ObjectiveType;
  target: string;
  requiredAmount: number;
  currentAmount: number;
  isOptional: boolean;
  isHidden: boolean;
  order: number;
  conditions: ObjectiveCondition[];
}

// 目标类型
enum ObjectiveType {
  DEFEAT_POKEMON = 'defeat_pokemon',   // 击败精灵
  CATCH_POKEMON = 'catch_pokemon',     // 捕获精灵
  COLLECT_ITEM = 'collect_item',       // 收集道具
  DELIVER_ITEM = 'deliver_item',       // 递送道具
  TALK_TO_NPC = 'talk_to_npc',         // 与NPC交谈
  VISIT_LOCATION = 'visit_location',   // 访问地点
  WIN_BATTLE = 'win_battle',           // 赢得战斗
  USE_MOVE = 'use_move',               // 使用技能
  EVOLVE_POKEMON = 'evolve_pokemon',   // 进化精灵
  LEVEL_UP_POKEMON = 'level_up_pokemon', // 精灵升级
  GAIN_EXPERIENCE = 'gain_experience', // 获得经验
  EARN_MONEY = 'earn_money',           // 赚取金币
  COMPLETE_DUNGEON = 'complete_dungeon', // 完成副本
  FIND_SECRET = 'find_secret',         // 发现秘密
  SOLVE_PUZZLE = 'solve_puzzle',       // 解决谜题
  HELP_NPC = 'help_npc',               // 帮助NPC
  WIN_MINIGAME = 'win_minigame',       // 赢得小游戏
  TAKE_PHOTO = 'take_photo',           // 拍照
  MAKE_FRIEND = 'make_friend',         // 交朋友
  GAIN_REPUTATION = 'gain_reputation'  // 获得声望
}

// 目标条件
interface ObjectiveCondition {
  conditionType: ObjectiveConditionType;
  value: any;
  description: string;
}

// 目标条件类型
enum ObjectiveConditionType {
  SPECIES = 'species',                 // 特定种类
  TYPE = 'type',                       // 特定属性
  LEVEL = 'level',                     // 特定等级
  LOCATION = 'location',               // 特定地点
  TIME_OF_DAY = 'time_of_day',         // 特定时间
  WEATHER = 'weather',                 // 特定天气
  USING_SPECIFIC_MOVE = 'using_specific_move', // 使用特定技能
  HOLDING_SPECIFIC_ITEM = 'holding_specific_item', // 持有特定道具
  WITH_SPECIFIC_ABILITY = 'with_specific_ability', // 拥有特定特性
  BATTLE_TYPE = 'battle_type',         // 战斗类型
  DIFFICULTY_LEVEL = 'difficulty_level', // 难度等级
  WITHOUT_TAKING_DAMAGE = 'without_taking_damage', // 不受伤害
  WITHIN_TIME_LIMIT = 'within_time_limit', // 时间限制内
  WITHOUT_USING_ITEMS = 'without_using_items', // 不使用道具
  PERFECT_BATTLE = 'perfect_battle'    // 完美战斗
}

// 任务奖励
interface QuestReward {
  rewardType: QuestRewardType;
  amount: number;
  itemId?: string;
  pokemonId?: string;
  moveId?: string;
  abilityId?: string;
  titleId?: string;
  cosmeticId?: string;
  description: string;
  isGuaranteed: boolean;
  chance?: number;
  condition?: string;
}

// 任务奖励类型
enum QuestRewardType {
  EXPERIENCE = 'experience',           // 经验值
  MONEY = 'money',                     // 金币
  ITEMS = 'items',                     // 道具
  POKEMON = 'pokemon',                 // 精灵
  MOVES = 'moves',                     // 技能
  ABILITIES = 'abilities',             // 特性
  TITLES = 'titles',                   // 称号
  COSMETICS = 'cosmetics',             // 装饰品
  BADGES = 'badges',                   // 徽章
  ACCESS = 'access',                   // 访问权限
  REPUTATION = 'reputation',           // 声望
  RELATIONSHIP = 'relationship',       // 关系
  SKILL_POINTS = 'skill_points',       // 技能点
  STAT_POINTS = 'stat_points',         // 属性点
  SPECIAL_ABILITIES = 'special_abilities', // 特殊能力
  UNIQUE_ITEMS = 'unique_items'        // 独特道具
}

// 任务要求
interface QuestRequirement {
  requirementType: QuestRequirementType;
  value: any;
  description: string;
  isOptional: boolean;
}

// 任务要求类型
enum QuestRequirementType {
  MIN_LEVEL = 'min_level',             // 最低等级
  MAX_LEVEL = 'max_level',             // 最高等级
  QUEST_COMPLETED = 'quest_completed', // 完成任务
  ITEM_OWNED = 'item_owned',           // 拥有道具
  POKEMON_OWNED = 'pokemon_owned',     // 拥有精灵
  BADGE_EARNED = 'badge_earned',       // 获得徽章
  SKILL_LEARNED = 'skill_learned',     // 学会技能
  LOCATION_UNLOCKED = 'location_unlocked', // 解锁地点
  REPUTATION_LEVEL = 'reputation_level', // 声望等级
  RELATIONSHIP_LEVEL = 'relationship_level', // 关系等级
  TIME_OF_DAY = 'time_of_day',         // 时间
  WEATHER = 'weather',                 // 天气
  PARTY_SIZE = 'party_size',           // 队伍大小
  SPECIFIC_POKEMON = 'specific_pokemon', // 特定精灵
  SPECIFIC_ITEM = 'specific_item',     // 特定道具
  GENDER = 'gender',                   // 性别
  ALIGNMENT = 'alignment',             // 阵营
  FACTION = 'faction'                  // 派系
}

// 任务难度
enum QuestDifficulty {
  TRIVIAL = 'trivial',                 // 微不足道
  EASY = 'easy',                       // 简单
  NORMAL = 'normal',                   // 普通
  HARD = 'hard',                       // 困难
  VERY_HARD = 'very_hard',             // 很困难
  EXTREME = 'extreme',                 // 极难
  INSANE = 'insane',                   // 疯狂
  IMPOSSIBLE = 'impossible'            // 不可能
}

// 任务状态
enum QuestStatus {
  LOCKED = 'locked',                   // 锁定
  AVAILABLE = 'available',             // 可用
  ACTIVE = 'active',                   // 激活
  IN_PROGRESS = 'in_progress',         // 进行中
  COMPLETED = 'completed',             // 完成
  FAILED = 'failed',                   // 失败
  EXPIRED = 'expired',                 // 过期
  ABANDONED = 'abandoned'              // 放弃
}

// 任务进度数据
interface QuestProgressData {
  objectiveProgress: Map<string, number>;
  totalProgress: number;
  completionPercentage: number;
  timeSpent: number;
  attempts: number;
  lastUpdated: Date;
  notes: string[];
  hints: QuestHint[];
}

// 任务提示
interface QuestHint {
  hintId: string;
  content: string;
  isRevealed: boolean;
  revealCondition: string;
  priority: number;
}

// 任务行动
interface QuestAction {
  actionId: string;
  actionType: QuestActionType;
  objectiveId: string;
  amount: number;
  data: any;
  timestamp: Date;
  location?: string;
  conditions?: string[];
}

// 任务行动类型
enum QuestActionType {
  DEFEAT_POKEMON = 'defeat_pokemon',   // 击败精灵
  CATCH_POKEMON = 'catch_pokemon',     // 捕获精灵
  COLLECT_ITEM = 'collect_item',       // 收集道具
  DELIVER_ITEM = 'deliver_item',       // 递送道具
  TALK_TO_NPC = 'talk_to_npc',         // 与NPC交谈
  VISIT_LOCATION = 'visit_location',   // 访问地点
  WIN_BATTLE = 'win_battle',           // 赢得战斗
  USE_MOVE = 'use_move',               // 使用技能
  EVOLVE_POKEMON = 'evolve_pokemon',   // 进化精灵
  LEVEL_UP_POKEMON = 'level_up_pokemon', // 精灵升级
  GAIN_EXPERIENCE = 'gain_experience', // 获得经验
  EARN_MONEY = 'earn_money',           // 赚取金币
  COMPLETE_DUNGEON = 'complete_dungeon', // 完成副本
  FIND_SECRET = 'find_secret',         // 发现秘密
  SOLVE_PUZZLE = 'solve_puzzle',       // 解决谜题
  HELP_NPC = 'help_npc',               // 帮助NPC
  WIN_MINIGAME = 'win_minigame',       // 赢得小游戏
  TAKE_PHOTO = 'take_photo',           // 拍照
  MAKE_FRIEND = 'make_friend',         // 交朋友
  GAIN_REPUTATION = 'gain_reputation', // 获得声望
  CUSTOM = 'custom'                    // 自定义
}

// 任务进度
interface QuestProgress {
  questId: string;
  status: QuestStatus;
  objectiveProgress: Map<string, number>;
  totalProgress: number;
  startTime: Date;
  lastUpdated: Date;
  timeSpent: number;
  attempts: number;
  hintsRevealed: string[];
  notes: string[];
  milestones: QuestMilestone[];
}

// 任务里程碑
interface QuestMilestone {
  milestoneId: string;
  name: string;
  description: string;
  progressRequired: number;
  rewards: QuestReward[];
  isUnlocked: boolean;
  unlockedDate?: Date;
}

// 副本系统
interface Dungeon {
  dungeonId: string;
  name: string;
  description: string;
  dungeonType: DungeonType;
  difficulty: DungeonDifficulty;
  recommendedLevel: number;
  recommendedPartySize: number;
  maxPartySize: number;
  timeLimit?: number;
  entryCost: EntryCost;
  restrictions: DungeonRestriction[];
  floors: DungeonFloor[];
  rewards: DungeonReward[];
  mechanics: DungeonMechanic[];
  enemies: DungeonEnemy[];
  bosses: DungeonBoss[];
  secrets: DungeonSecret[];
  completionBonus: CompletionBonus;
  replayability: ReplayabilitySettings;
}

// 副本类型
enum DungeonType {
  STORY = 'story',                     // 剧情副本
  CHALLENGE = 'challenge',             // 挑战副本
  RAID = 'raid',                       // 团队副本
  ENDLESS = 'endless',                 // 无尽副本
  PUZZLE = 'puzzle',                   // 谜题副本
  EXPLORATION = 'exploration',         // 探索副本
  SURVIVAL = 'survival',               // 生存副本
  TIME_TRIAL = 'time_trial',           // 计时副本
  STEALTH = 'stealth',                 // 潜行副本
  BOSS_RUSH = 'boss_rush',             // Boss rush
  TREASURE = 'treasure',               // 宝藏副本
  TRIAL = 'trial',                     // 试炼副本
  LABYRINTH = 'labyrinth',            // 迷宫副本
  TOWER = 'tower',                     // 塔副本
  CAVE = 'cave',                       // 洞穴副本
  RUINS = 'ruins',                     // 遗迹副本
  DUNGEON = 'dungeon',                 // 地下城
  CASTLE = 'castle',                   // 城堡副本
  FOREST = 'forest',                   // 森林副本
  VOLCANO = 'volcano',                 // 火山副本
  ICE_CAVE = 'ice_cave',               // 冰洞副本
  DESERT = 'desert',                   // 沙漠副本
  SWAMP = 'swamp',                     // 沼泽副本
  UNDERWATER = 'underwater',           // 水下副本
  SKY = 'sky',                         // 天空副本
  SPACE = 'space',                     // 空间副本
  DIMENSION = 'dimension',             // 异次元副本
  DREAM = 'dream',                     // 梦境副本
  NIGHTMARE = 'nightmare',             // 噩梦副本
  CUSTOM = 'custom'                    // 自定义副本
}

// 副本难度
enum DungeonDifficulty {
  TUTORIAL = 'tutorial',               // 教程
  VERY_EASY = 'very_easy',             // 非常简单
  EASY = 'easy',                       // 简单
  NORMAL = 'normal',                   // 普通
  HARD = 'hard',                       // 困难
  VERY_HARD = 'very_hard',             // 很困难
  EXTREME = 'extreme',                 // 极难
  INSANE = 'insane',                   // 疯狂
  NIGHTMARE = 'nightmare',             // 噩梦
  HELL = 'hell',                       // 地狱
  IMPOSSIBLE = 'impossible'            // 不可能
}

// 进入费用
interface EntryCost {
  costType: CostType;
  amount: number;
  itemId?: string;
  description: string;
  isRefundable: boolean;
  refundCondition?: string;
}

// 费用类型
enum CostType {
  MONEY = 'money',                     // 金币
  ITEM = 'item',                       // 道具
  TOKEN = 'token',                     // 代币
  ENERGY = 'energy',                   // 体力
  REPUTATION = 'reputation',           // 声望
  FRIENDSHIP = 'friendship',           // 友谊
  TIME = 'time',                       // 时间
  CUSTOM = 'custom'                    // 自定义
}

// 副本限制
interface DungeonRestriction {
  restrictionType: DungeonRestrictionType;
  value: any;
  description: string;
  isStrict: boolean;
}

// 副本限制类型
enum DungeonRestrictionType {
  LEVEL_LIMIT = 'level_limit',         // 等级限制
  POKEMON_LIMIT = 'pokemon_limit',     // 精灵限制
  ITEM_LIMIT = 'item_limit',           // 道具限制
  MOVE_LIMIT = 'move_limit',           // 技能限制
  TYPE_LIMIT = 'type_limit',           // 属性限制
  TIME_LIMIT = 'time_limit',           // 时间限制
  DEATH_LIMIT = 'death_limit',         // 死亡限制
  HEALING_LIMIT = 'healing_limit',     // 治疗限制
  SAVE_LIMIT = 'save_limit',           // 存档限制
  PARTY_SIZE_LIMIT = 'party_size_limit', // 队伍大小限制
  EQUIPMENT_LIMIT = 'equipment_limit', // 装备限制
  CONSUMABLE_LIMIT = 'consumable_limit', // 消耗品限制
  SPECIAL_CONDITION = 'special_condition' // 特殊条件
}

// 副本楼层
interface DungeonFloor {
  floorId: string;
  floorNumber: number;
  name: string;
  description: string;
  layout: FloorLayout;
  encounters: FloorEncounter[];
  treasures: FloorTreasure[];
  traps: FloorTrap[];
  puzzles: FloorPuzzle[];
  events: FloorEvent[];
  secrets: FloorSecret[];
  exits: FloorExit[];
  specialConditions: FloorCondition[];
  atmosphere: FloorAtmosphere;
  backgroundMusic: string;
  ambientSounds: string[];
}

// 楼层布局
interface FloorLayout {
  layoutType: LayoutType;
  dimensions: [number, number];
  rooms: Room[];
  corridors: Corridor[];
  obstacles: Obstacle[];
  decorations: Decoration[];
  lighting: LightingSettings;
  weather?: WeatherType;
  terrain: TerrainType[];
}

// 布局类型
enum LayoutType {
  FIXED = 'fixed',                     // 固定布局
  RANDOM = 'random',                   // 随机布局
  PROCEDURAL = 'procedural',           // 程序生成
  MAZE = 'maze',                       // 迷宫
  GRID = 'grid',                       // 网格
  ORGANIC = 'organic',                 // 有机
  SYMMETRICAL = 'symmetrical',         // 对称
  ASYMMETRICAL = 'asymmetrical',       // 不对称
  LINEAR = 'linear',                   // 线性
  BRANCHING = 'branching',             // 分支
  CIRCULAR = 'circular',               // 环形
  SPIRAL = 'spiral',                   // 螺旋
  CUSTOM = 'custom'                    // 自定义
}

// 房间
interface Room {
  roomId: string;
  name: string;
  position: [number, number];
  size: [number, number];
  shape: RoomShape;
  entrances: RoomEntrance[];
  exits: RoomExit[];
  furniture: Furniture[];
  decorations: Decoration[];
  lighting: LightingSettings;
  ambientEffects: AmbientEffect[];
  encounters: RoomEncounter[];
  treasures: RoomTreasure[];
  traps: RoomTrap[];
  puzzles: RoomPuzzle[];
  events: RoomEvent[];
  secrets: RoomSecret[];
  specialConditions: RoomCondition[];
}

// 房间形状
enum RoomShape {
  SQUARE = 'square',                   // 正方形
  RECTANGLE = 'rectangle',             // 长方形
  CIRCLE = 'circle',                   // 圆形
  OVAL = 'oval',                       // 椭圆形
  TRIANGLE = 'triangle',               // 三角形
  PENTAGON = 'pentagon',               // 五边形
  HEXAGON = 'hexagon',                 // 六边形
  OCTAGON = 'octagon',                 // 八边形
  IRREGULAR = 'irregular',             // 不规则
  CUSTOM = 'custom'                    // 自定义
}

// 房间入口
interface RoomEntrance {
  entranceId: string;
  position: [number, number];
  direction: Direction;
  entranceType: EntranceType;
  isLocked: boolean;
  lockType?: LockType;
  keyRequired?: string;
  trap?: RoomTrap;
  decoration?: Decoration;
}

// 方向
enum Direction {
  NORTH = 'north',                     // 北
  SOUTH = 'south',                     // 南
  EAST = 'east',                       // 东
  WEST = 'west',                       // 西
  NORTHEAST = 'northeast',             // 东北
  NORTHWEST = 'northwest',             // 西北
  SOUTHEAST = 'southeast',             // 东南
  SOUTHWEST = 'southwest'              // 西南
}

// 入口类型
enum EntranceType {
  DOOR = 'door',                       // 门
  GATE = 'gate',                       // 门
  ARCHWAY = 'archway',                 // 拱门
  STAIRS = 'stairs',                   // 楼梯
  ELEVATOR = 'elevator',               // 电梯
  TELEPORTER = 'teleporter',           // 传送门
  LADDER = 'ladder',                   // 梯子
  RAMP = 'ramp',                       // 坡道
  BRIDGE = 'bridge',                   // 桥
  SECRET = 'secret',                   // 秘密入口
  HIDDEN = 'hidden',                   // 隐藏入口
  CUSTOM = 'custom'                    // 自定义
}

// 锁类型
enum LockType {
  KEY_LOCK = 'key_lock',               // 钥匙锁
  COMBO_LOCK = 'combo_lock',           // 密码锁
  MAGIC_LOCK = 'magic_lock',           // 魔法锁
  PUZZLE_LOCK = 'puzzle_lock',         // 谜题锁
  TIME_LOCK = 'time_lock',             // 时间锁
  LEVEL_LOCK = 'level_lock',           // 等级锁
  ITEM_LOCK = 'item_lock',             // 道具锁
  ABILITY_LOCK = 'ability_lock',       // 能力锁
  SEQUENCE_LOCK = 'sequence_lock',     // 顺序锁
  CUSTOM_LOCK = 'custom_lock'          // 自定义锁
}

// 房间出口
interface RoomExit {
  exitId: string;
  position: [number, number];
  direction: Direction;
  exitType: ExitType;
  destination: string;
  isOneWay: boolean;
  isHidden: boolean;
  isLocked: boolean;
  lockType?: LockType;
  keyRequired?: string;
  trap?: RoomTrap;
  decoration?: Decoration;
}

// 出口类型
enum ExitType {
  DOOR = 'door',                       // 门
  GATE = 'gate',                       // 门
  ARCHWAY = 'archway',                 // 拱门
  STAIRS_UP = 'stairs_up',             // 上楼梯
  STAIRS_DOWN = 'stairs_down',         // 下楼梯
  ELEVATOR = 'elevator',               // 电梯
  TELEPORTER = 'teleporter',           // 传送门
  LADDER_UP = 'ladder_up',             // 上梯子
  LADDER_DOWN = 'ladder_down',         // 下梯子
  RAMP = 'ramp',                       // 坡道
  BRIDGE = 'bridge',                   // 桥
  SECRET = 'secret',                   // 秘密出口
  HIDDEN = 'hidden',                   // 隐藏出口
  CUSTOM = 'custom'                    // 自定义
}

// 家具
interface Furniture {
  furnitureId: string;
  furnitureType: FurnitureType;
  position: [number, number];
  rotation: number;
  size: [number, number, number];
  isInteractable: boolean;
  isMovable: boolean;
  isBreakable: boolean;
  interactionType?: InteractionType;
  containsItems?: string[];
  trap?: RoomTrap;
  secret?: RoomSecret;
  decoration: Decoration;
}

// 家具类型
enum FurnitureType {
  TABLE = 'table',                     // 桌子
  CHAIR = 'chair',                     // 椅子
  BED = 'bed',                         // 床
  CHEST = 'chest',                     // 箱子
  BOOKSHELF = 'bookshelf',             // 书架
  CABINET = 'cabinet',                 // 柜子
  DESK = 'desk',                       // 书桌
  SOFA = 'sofa',                       // 沙发
  LAMP = 'lamp',                       // 灯
  MIRROR = 'mirror',                   // 镜子
  PAINTING = 'painting',               // 画
  STATUE = 'statue',                   // 雕像
  PLANT = 'plant',                     // 植物
  FOUNTAIN = 'fountain',               // 喷泉
  FIREPLACE = 'fireplace',             // 壁炉
  BARREL = 'barrel',                   // 桶
  CRATE = 'crate',                     // 箱子
  SACK = 'sack',                       // 袋子
  ANVIL = 'anvil',                     // 铁砧
  ALCHEMY_TABLE = 'alchemy_table',     // 炼金台
  ENCHANTING_TABLE = 'enchanting_table', // 附魔台
  FORGE = 'forge',                     // 锻造炉
  LOOM = 'loom',                       // 织布机
  WORKBENCH = 'workbench',             // 工作台
  CUSTOM = 'custom'                    // 自定义
}

// 交互类型
enum InteractionType {
  SEARCH = 'search',                   // 搜索
  OPEN = 'open',                       // 打开
  CLOSE = 'close',                     // 关闭
  USE = 'use',                         // 使用
  ACTIVATE = 'activate',               // 激活
  DEACTIVATE = 'deactivate',           // 停用
  BREAK = 'break',                     // 破坏
  REPAIR = 'repair',                   // 修复
  MOVE = 'move',                       // 移动
  ROTATE = 'rotate',                   // 旋转
  EXAMINE = 'examine',                 // 检查
  READ = 'read',                       // 阅读
  TAKE = 'take',                       // 拿取
  PLACE = 'place',                     // 放置
  CLEAN = 'clean',                     // 清洁
  POLISH = 'polish',                   // 擦亮
  CUSTOM = 'custom'                    // 自定义
}

// 装饰品
interface Decoration {
  decorationId: string;
  decorationType: DecorationType;
  position: [number, number];
  rotation: number;
  size: [number, number, number];
  rarity: DecorationRarity;
  isCollectible: boolean;
  isBreakable: boolean;
  isInteractable: boolean;
  interactionType?: InteractionType;
  containsItems?: string[];
  trap?: RoomTrap;
  secret?: RoomSecret;
  lighting?: LightingSettings;
  soundEffect?: string;
}

// 装饰品类型
enum DecorationType {
  PAINTING = 'painting',               // 画
  SCULPTURE = 'sculpture',             // 雕塑
  TAPESTRY = 'tapestry',               // 挂毯
  VASE = 'vase',                       // 花瓶
  CANDLE = 'candle',                   // 蜡烛
  TORCH = 'torch',                     // 火把
  LANTERN = 'lantern',                 // 灯笼
  CLOCK = 'clock',                     // 时钟
  MIRROR = 'mirror',                   // 镜子
  WINDOW = 'window',                   // 窗户
  CURTAIN = 'curtain',                 // 窗帘
  RUG = 'rug',                         // 地毯
  PILLAR = 'pillar',                   // 柱子
  ARCH = 'arch',                       // 拱门
  FOUNTAIN = 'fountain',               // 喷泉
  PLANTER = 'planter',                 // 花盆
  FLOWER_POT = 'flower_pot',           // 花盆
  STATUE = 'statue',                   // 雕像
  BUST = 'bust',                       // 半身像
  RELIEF = 'relief',                   // 浮雕
  MOSAIC = 'mosaic',                   // 马赛克
  BANNER = 'banner',                   // 旗帜
  FLAG = 'flag',                       // 旗帜
  EMBLEM = 'emblem',                   // 徽章
  CREST = 'crest',                     // 纹章
  CUSTOM = 'custom'                    // 自定义
}

// 装饰品稀有度
enum DecorationRarity {
  COMMON = 'common',                   // 普通
  UNCOMMON = 'uncommon',               // 不常见
  RARE = 'rare',                       // 稀有
  EPIC = 'epic',                       // 史诗
  LEGENDARY = 'legendary',             // 传说
  MYTHICAL = 'mythical',               // 神话
  UNIQUE = 'unique',                   // 独一无二
  MASTERPIECE = 'masterpiece',         // 杰作
  ARTIFACT = 'artifact'                // 神器
}

// 照明设置
interface LightingSettings {
  ambientColor: string;
  ambientIntensity: number;
  directionalColor: string;
  directionalIntensity: number;
  directionalDirection: [number, number, number];
  pointLights: PointLight[];
  spotLights: SpotLight[];
  shadows: ShadowSettings;
  fog: FogSettings;
}

// 点光源
interface PointLight {
  position: [number, number, number];
  color: string;
  intensity: number;
  radius: number;
  attenuation: number;
}

// 聚光灯
interface SpotLight {
  position: [number, number, number];
  direction: [number, number, number];
  color: string;
  intensity: number;
  radius: number;
  angle: number;
  attenuation: number;
}

// 阴影设置
interface ShadowSettings {
  enabled: boolean;
  shadowMapSize: number;
  shadowDistance: number;
  shadowBias: number;
  shadowNormalBias: number;
}

// 雾设置
interface FogSettings {
  enabled: boolean;
  color: string;
  density: number;
  startDistance: number;
  endDistance: number;
}

// 环境效果
