# 赛尔号回合制游戏架构设计文档（TypeScript 描述）

## 一、玩法设计详述

### 1. 精灵收集系统
- **精灵图鉴**：记录玩家已获得/未获得的精灵信息，包含基础属性、技能、进化链等
- **捕捉机制**：野外遭遇精灵后可使用精灵胶囊进行捕捉，成功率受精灵剩余血量、异常状态、精灵等级差影响
- **稀有度分级**：普通、稀有、史诗、传说、神话五级稀有度，影响获取难度和基础属性
- **获取途径**：野外捕捉、任务奖励、活动限定、进化获得、融合合成、商店购买

### 2. 精灵培养系统
#### 2.1 基础属性体系
- **六维属性**：攻击、防御、特攻、特防、速度、体力（HP）
- **属性成长**：每级升级时根据成长值和性格加成自动分配属性点
- **等级上限**：初始100级，通过特殊道具可突破至120级

#### 2.2 性格系统
- **25种性格**：每种性格提供+10%某属性增益和-10%某属性减益
- **性格影响**：仅影响除体力外的五项属性（攻/防/特攻/特防/速）
- **性格获取**：初始随机，可通过性格果实重置

#### 2.3 成长值系统
- **个体值（IV）**：0-31的固定值，决定精灵属性潜力上限，不可改变
- **努力值（EV）**：0-252单项上限，510总上限，通过战斗获得，可重置
- **计算公式**：最终属性 = 基础值 + IV + (等级/100)*(基础值 + IV) + (EV/4)*(等级/100)

#### 2.4 技能系统
- **技能槽位**：最多4个主动技能
- **技能类型**：物理攻击、特殊攻击、属性技能（增益/减益/状态）
- **PP值**：技能使用次数限制，可使用PP药剂恢复
- **技能学习**：等级学习、技能机学习、遗传技能

### 3. 精灵融合系统
- **融合条件**：两只指定精灵（可能有等级/性格/个体值要求）
- **融合结果**：生成新精灵，继承部分属性和技能
- **融合公式**：预设的融合配方数据库，包含输入精灵和输出精灵映射
- **特殊融合**：某些融合需要特殊道具或在特定地点进行

### 4. 属性相克系统
- **18种属性**：普通、火、水、电、草、冰、战斗、毒、地面、飞行、超能、虫、岩石、幽灵、龙、恶、钢、妖精
- **相克关系**：完整的18x18相克矩阵，包含克制（2.0x）、被克（0.5x）、无效（0.0x）、正常（1.0x）
- **双属性计算**：双属性精灵受到攻击时，分别计算两个属性的克制关系后相乘
- **属性克制提示**：战斗界面显示当前技能对目标的克制效果

### 5. PVE系统（玩家对环境）
- **主线剧情**：线性关卡推进，包含剧情对话、BOSS战、解谜元素
- **副本系统**：每日/每周副本，提供特定资源奖励
- **野外探索**：随机遭遇战、隐藏精灵、采集点
- **BOSS挑战**：高难度单体/群体BOSS，需要策略搭配
- **任务系统**：日常任务、成就任务、剧情任务

### 6. PVP系统（玩家对玩家）
- **竞技场**：天梯排名系统，赛季奖励
- **匹配机制**：基于玩家等级、胜率、精灵强度的匹配算法
- **对战规则**：3v3精灵对战，先手值决定行动顺序
- **禁用机制**：高阶竞技场禁用部分超模精灵
- **观战系统**：可观看高排名玩家对战

### 7. 装备与道具系统
- **精灵装备**：增加属性的饰品，可强化、镶嵌
- **消耗道具**：血瓶、PP恢复、状态清除、捕捉道具
- **培养道具**：努力值重置、性格重置、技能重置
- **背包系统**：分类存储，有容量限制

### 8. 进化系统
- **等级进化**：达到指定等级自动进化
- **道具进化**：使用特定进化石触发
- **亲密度进化**：与精灵亲密度达到阈值
- **特殊条件进化**：特定时间、地点、状态等条件

## 二、组件定义（Component Definitions）

### 1. 基础组件
```typescript
// 唯一标识组件
interface IdComponent {
  id: string; // 全局唯一ID
}

// 名称组件
interface NameComponent {
  name: string; // 显示名称
  displayName?: string; // 本地化显示名称
}

// 描述组件
interface DescriptionComponent {
  description: string; // 详细描述文本
}
```

### 2. 精灵核心组件
```typescript
// 精灵基础属性组件
interface PokemonBaseStatsComponent {
  hp: number;        // 体力基础值
  attack: number;    // 攻击基础值
  defense: number;   // 防御基础值
  spAttack: number;  // 特攻基础值
  spDefense: number; // 特防基础值
  speed: number;     // 速度基础值
}

// 精灵个体值组件（IV）
interface IndividualValuesComponent {
  hp: number;        // 0-31
  attack: number;    // 0-31
  defense: number;   // 0-31
  spAttack: number;  // 0-31
  spDefense: number; // 0-31
  speed: number;     // 0-31
}

// 精灵努力值组件（EV）
interface EffortValuesComponent {
  hp: number;        // 0-252
  attack: number;    // 0-252
  defense: number;   // 0-252
  spAttack: number;  // 0-252
  spDefense: number; // 0-252
  speed: number;     // 0-252
  total: number;     // 0-510
}

// 性格组件
interface NatureComponent {
  natureType: NatureType; // 性格枚举
  boostStat: StatType;    // 增益属性
  reduceStat: StatType;   // 减益属性
}

// 等级组件
interface LevelComponent {
  currentLevel: number; // 当前等级 (1-120)
  experience: number;   // 当前经验值
  expToNextLevel: number; // 升级所需经验
}

// 属性组件
interface TypeComponent {
  primaryType: ElementType;  // 主属性
  secondaryType?: ElementType; // 副属性（可选）
}

// 稀有度组件
interface RarityComponent {
  rarity: RarityType; // 稀有度等级
}
```

### 3. 战斗相关组件
```typescript
// 当前状态组件
interface CurrentStatsComponent {
  hp: number;        // 当前HP
  maxHp: number;     // 最大HP
  attack: number;    // 当前攻击
  defense: number;   // 当前防御
  spAttack: number;  // 当前特攻
  spDefense: number; // 当前特防
  speed: number;     // 当前速度
}

// 异常状态组件
interface StatusConditionComponent {
  conditions: StatusCondition[]; // 异常状态列表
  duration: Map<StatusCondition, number>; // 每个状态的持续回合数
}

// 技能组件
interface SkillComponent {
  skillId: string;     // 技能ID
  currentPP: number;   // 当前PP值
  maxPP: number;       // 最大PP值
  ppUps: number;       // PP提升次数 (0-3)
}

// 技能列表组件
interface SkillListComponent {
  skills: SkillComponent[]; // 技能槽位数组（最多4个）
}

// 先攻值组件
interface PriorityComponent {
  basePriority: number; // 基础先攻值
  modifiers: number[];  // 先攻修正值列表
}
```

### 4. 进化与融合组件
```typescript
// 进化链组件
interface EvolutionChainComponent {
  evolutionStages: EvolutionStage[]; // 进化阶段列表
  currentStage: number;              // 当前进化阶段索引
}

// 进化阶段定义
interface EvolutionStage {
  pokemonId: string;     // 精灵ID
  evolutionMethod: EvolutionMethod; // 进化方式
  requirement: any;      // 进化需求（等级、道具、亲密度等）
}

// 融合配方组件
interface FusionRecipeComponent {
  inputPokemonIds: string[]; // 输入精灵ID列表
  outputPokemonId: string;   // 输出精灵ID
  requiredItems: ItemRequirement[]; // 所需道具
  successRate: number;       // 成功率 (0-1)
}

// 融合材料组件
interface FusionMaterialComponent {
  isFusionMaterial: boolean; // 是否可作为融合材料
}
```

### 5. 玩家与背包组件
```typescript
// 玩家信息组件
interface PlayerInfoComponent {
  playerId: string;
  playerName: string;
  level: number;
  experience: number;
  credits: number;     // 游戏货币
  tokens: number;      // 高级货币
}

// 背包组件
interface InventoryComponent {
  items: Map<string, number>; // 物品ID -> 数量
  maxCapacity: number;        // 背包容量
}

// 精灵队伍组件
interface PartyComponent {
  partyMembers: string[]; // 队伍中精灵ID列表（最多6个）
  activeMember: number;   // 当前出战位置（0-5）
}

// 精灵盒子组件
interface PokemonBoxComponent {
  boxes: PokemonBox[]; // 精灵盒子数组
}

interface PokemonBox {
  name: string;
  pokemonIds: string[]; // 精灵ID列表
  capacity: number;     // 盒子容量
}
```

### 6. 任务与进度组件
```typescript
// 任务组件
interface QuestComponent {
  questId: string;
  status: QuestStatus; // 未开始/进行中/已完成/已领取奖励
  progress: Map<string, number>; // 任务进度（条件ID -> 完成数量）
}

// 图鉴组件
interface PokedexComponent {
  caughtPokemon: Set<string>;    // 已捕捉精灵ID集合
  seenPokemon: Set<string>;      // 已见过精灵ID集合
  detailedInfo: Map<string, PokedexEntry>; // 详细图鉴信息
}

interface PokedexEntry {
  timesCaught: number;
  highestLevel: number;
  bestStats: CurrentStatsComponent;
  knownSkills: Set<string>;
}
```

### 7. 地图与场景组件
```typescript
// 位置组件
interface PositionComponent {
  x: number;
  y: number;
  mapId: string;
}

// 地图区域组件
interface MapAreaComponent {
  areaId: string;
  name: string;
  encounterTable: EncounterTable; // 遭遇表
  wildPokemonRate: number;        // 野生精灵出现概率
}

// 遭遇表定义
interface EncounterTable {
  entries: EncounterEntry[];
}

interface EncounterEntry {
  pokemonId: string;
  minLevel: number;
  maxLevel: number;
  rate: number; // 出现概率权重
  conditions?: EncounterCondition[]; // 特殊出现条件
}
```

### 8. PVP相关组件
```typescript
// 竞技场排名组件
interface ArenaRankComponent {
  currentRank: number;
  highestRank: number;
  rating: number; // ELO评分
  wins: number;
  losses: number;
}

// 对战记录组件
interface BattleRecordComponent {
  battleId: string;
  opponentId: string;
  result: BattleResult;
  timestamp: number;
  replayData: BattleReplayData;
}
```

## 三、实体Archetype定义

### 1. 精灵实体（Pokemon Entity）
**组件组合**：
- IdComponent
- NameComponent
- DescriptionComponent
- PokemonBaseStatsComponent
- IndividualValuesComponent
- EffortValuesComponent
- NatureComponent
- LevelComponent
- TypeComponent
- RarityComponent
- CurrentStatsComponent
- StatusConditionComponent
- SkillListComponent
- EvolutionChainComponent
- FusionMaterialComponent

**实体数量**：动态生成，每个玩家拥有的每只精灵对应一个实体，理论上无上限（受存储限制）

### 2. 玩家实体（Player Entity）
**组件组合**：
- IdComponent
- NameComponent
- PlayerInfoComponent
- InventoryComponent
- PartyComponent
- PokemonBoxComponent
- PokedexComponent
- ArenaRankComponent

**实体数量**：每个在线玩家对应1个实体，离线玩家数据持久化存储

### 3. 技能实体（Skill Entity）
**组件组合**：
- IdComponent
- NameComponent
- DescriptionComponent
- SkillDefinitionComponent
- TypeComponent
- RarityComponent

**实体数量**：预定义技能库，约500-800个实体（每个技能一个）

### 4. 道具实体（Item Entity）
**组件组合**：
- IdComponent
- NameComponent
- DescriptionComponent
- ItemDefinitionComponent
- RarityComponent
- StackableComponent

**实体数量**：预定义道具库，约200-300个实体

### 5. 任务实体（Quest Entity）
**组件组合**：
- IdComponent
- NameComponent
- DescriptionComponent
- QuestDefinitionComponent
- RewardComponent

**实体数量**：预定义任务库，约100-200个实体

### 6. 地图实体（Map Entity）
**组件组合**：
- IdComponent
- NameComponent
- MapDefinitionComponent
- MapAreaComponent

**实体数量**：预定义地图库，约50-100个实体

### 7. NPC实体（NPC Entity）
**组件组合**：
- IdComponent
- NameComponent
- DescriptionComponent
- PositionComponent
- NPCDefinitionComponent
- DialogueComponent

**实体数量**：预定义NPC库，约200-300个实体

### 8. 野生精灵实体（Wild Pokemon Entity）
**组件组合**：
- IdComponent
- PokemonBaseStatsComponent
- LevelComponent
- TypeComponent
- CurrentStatsComponent
- SkillListComponent
- EncounterComponent

**实体数量**：动态生成，每次遭遇战临时创建，战斗结束后销毁

### 9. BOSS实体（Boss Entity）
**组件组合**：
- IdComponent
- NameComponent
- DescriptionComponent
- PokemonBaseStatsComponent
- LevelComponent
- TypeComponent
- CurrentStatsComponent
- SkillListComponent
- BossAIComponent
- RewardComponent

**实体数量**：预定义BOSS库，约50-100个实体

### 10. 融合配方实体（Fusion Recipe Entity）
**组件组合**：
- IdComponent
- NameComponent
- DescriptionComponent
- FusionRecipeComponent
- RewardComponent

**实体数量**：预定义融合配方库，约100-200个实体

## 四、系统定义（System Definitions）

### 1. 精灵属性计算系统（StatCalculationSystem）
**功能**：实时计算精灵的当前六维属性值
**逻辑类型**：响应式系统
**触发条件**：精灵等级变化、努力值变化、性格变化、装备变化
**计算流程**：
1. 获取基础属性、个体值、努力值、性格、等级
2. 应用性格加成（+10%/-10%）
3. 应用努力值加成（EV/4 * 等级/100）
4. 计算最终属性值并更新CurrentStatsComponent

### 2. 战斗系统（BattleSystem）
**功能**：处理回合制战斗逻辑
**逻辑类型**：状态机系统
**核心流程**：
1. 初始化战斗（设置双方精灵、状态重置）
2. 回合开始（处理回合开始效果）
3. 行动选择（玩家/AI选择技能）
4. 先攻计算（确定行动顺序）
5. 技能执行（按顺序执行技能效果）
6. 回合结束（处理回合结束效果）
7. 胜负判定（检查战斗结束条件）

### 3. 属性相克计算系统（TypeEffectivenessSystem）
**功能**：计算技能对目标的属性克制效果
**逻辑类型**：查询系统
**计算逻辑**：
1. 获取攻击方技能属性
2. 获取防御方精灵的1-2个属性
3. 查询相克矩阵得到每个属性的克制倍率
4. 计算最终克制倍率（双属性相乘）
5. 返回克制效果（无效/抵抗/正常/克制/超克制）

### 4. 精灵进化系统（EvolutionSystem）
**功能**：处理精灵进化逻辑
**逻辑类型**：事件驱动系统
**触发条件**：等级提升、使用进化道具、亲密度变化等
**处理流程**：
1. 检查当前精灵是否满足进化条件
2. 验证进化需求（等级、道具、时间等）
3. 执行进化（替换精灵ID、重置部分属性）
4. 更新图鉴和队伍信息

### 5. 精灵融合系统（FusionSystem）
**功能**：处理精灵融合逻辑
**逻辑类型**：事务系统
**处理流程**：
1. 验证融合材料（精灵存在、满足条件）
2. 检查融合配方是否存在
3. 计算融合成功率
4. 执行融合（消耗材料、生成新精灵）
5. 处理融合失败情况（可能消耗材料）

### 6. 遭遇战系统（EncounterSystem）
**功能**：处理野外精灵遭遇逻辑
**逻辑类型**：概率系统
**触发条件**：玩家在可遭遇区域移动
**处理流程**：
1. 检查遭遇概率（基于区域设置）
2. 随机选择遭遇表条目
3. 生成野生精灵实体（随机等级、技能）
4. 启动战斗系统

### 7. 经验值系统（ExperienceSystem）
**功能**：处理经验值获取和等级提升
**逻辑类型**：事件驱动系统
**触发条件**：战斗胜利、完成任务
**处理流程**：
1. 计算获得的经验值（基于敌人等级、数量）
2. 分配经验值给参与战斗的精灵
3. 检查是否达到升级条件
4. 执行升级（提升属性、学习新技能）

### 8. 努力值系统（EVTrainingSystem）
**功能**：处理努力值获取和分配
**逻辑类型**：事件驱动系统
**触发条件**：击败特定精灵
**处理流程**：
1. 根据击败的精灵获取对应努力值
2. 验证努力值分配是否超过限制
3. 更新EffortValuesComponent
4. 触发StatCalculationSystem重新计算属性

### 9. PVP匹配系统（PVPMatchmakingSystem）
**功能**：处理玩家对战匹配
**逻辑类型**：异步系统
**处理流程**：
1. 接收玩家匹配请求
2. 基于ELO评分、等级范围查找匹配对手
3. 建立对战房间
4. 启动BattleSystem进行PVP战斗

### 10. 任务系统（QuestSystem）
**功能**：处理任务进度跟踪和奖励发放
**逻辑类型**：事件监听系统
**监听事件**：战斗胜利、精灵捕捉、物品使用、地点到达等
**处理流程**：
1. 监听游戏事件
2. 检查事件是否满足任务条件
3. 更新任务进度
4. 检查任务完成状态
5. 发放任务奖励

### 11. 图鉴系统（PokedexSystem）
**功能**：维护精灵图鉴信息
**逻辑类型**：数据聚合系统
**触发条件**：首次遭遇精灵、捕捉精灵、查看精灵详情
**处理流程**：
1. 记录精灵遭遇信息
2. 更新图鉴完成度
3. 聚合精灵最佳数据（最高等级、最佳属性等）

### 12. 背包系统（InventorySystem）
**功能**：管理玩家物品存储和使用
**逻辑类型**：CRUD系统
**核心操作**：
- 添加物品（检查容量、堆叠）
- 移除物品（使用、丢弃）
- 使用物品（触发物品效果）
- 整理背包（自动堆叠、排序）

### 13. 技能学习系统（SkillLearningSystem）
**功能**：处理精灵技能学习和遗忘
**逻辑类型**：状态管理系统
**处理流程**：
1. 检查技能学习条件（等级、技能机）
2. 验证技能槽位（是否已满）
3. 处理技能替换逻辑（选择遗忘技能）
4. 更新SkillListComponent

### 14. AI系统（AISystem）
**功能**：控制NPC和野生精灵的战斗行为
**逻辑类型**：决策树系统
**AI策略**：
- 基础AI：随机选择技能
- 进阶AI：根据属性克制选择技能
- BOSS AI：预设行为模式、阶段转换
- 自适应AI：根据玩家行为调整策略

### 15. 保存加载系统（SaveLoadSystem）
**功能**：处理游戏数据的持久化
**逻辑类型**：序列化系统
**保存范围**：
- 玩家基本信息
- 精灵队伍和盒子
- 背包物品
- 任务进度
- 图鉴信息
- 设置选项

## 五、资源定义（Resource Definitions）

### 1. 全局状态资源
```typescript
// 游戏配置资源
interface GameConfigResource {
  version: string;
  debugMode: boolean;
  difficulty: DifficultyLevel;
  autoSaveEnabled: boolean;
  saveInterval: number; // 自动保存间隔（秒）
}

// 当前游戏状态资源
interface GameStateResource {
  currentScene: SceneType; // 当前场景（世界/战斗/菜单等）
  currentPlayerId: string; // 当前玩家ID
  isOnline: boolean;       // 是否在线模式
  timeOfDay: TimeOfDay;    // 游戏内时间
}

// 战斗状态资源
interface BattleStateResource {
  isInBattle: boolean;
  battleType: BattleType; // PVE/PVP/BOSS
  turnNumber: number;
  activePlayer: PlayerSide;
  selectedActions: Map<string, BattleAction>; // 精灵ID -> 选择的动作
}
```

### 2. 数据表资源
```typescript
// 精灵数据库资源
interface PokemonDatabaseResource {
  pokemonData: Map<string, PokemonTemplate>; // 精灵模板数据
}

// 技能数据库资源
interface SkillDatabaseResource {
  skillData: Map<string, SkillTemplate>; // 技能模板数据
}

// 道具数据库资源
interface ItemDatabaseResource {
  itemData: Map<string, ItemTemplate>; // 道具模板数据
}

// 任务数据库资源
interface QuestDatabaseResource {
  questData: Map<string, QuestTemplate>; // 任务模板数据
}

// 地图数据库资源
interface MapDatabaseResource {
  mapData: Map<string, MapTemplate>; // 地图模板数据
}

// 融合配方数据库资源
interface FusionRecipeDatabaseResource {
  recipes: Map<string, FusionRecipe>; // 融合配方数据
}
```

### 3. 配置资源
```typescript
// 属性相克矩阵资源
interface TypeEffectivenessMatrixResource {
  effectiveness: number[][]; // 18x18相克矩阵
  typeNames: ElementType[];  // 属性名称列表
}

// 经验值表资源
interface ExperienceTableResource {
  experienceCurves: Map<ExperienceCurveType, number[]>; // 不同成长曲线的经验值表
}

// 性格配置资源
interface NatureConfigResource {
  natures: Map<NatureType, NatureConfig>; // 性格配置数据
}

// 稀有度配置资源
interface RarityConfigResource {
  raritySettings: Map<RarityType, RaritySettings>; // 稀有度配置
}
```

### 4. 运行时资源
```typescript
// 事件总线资源
interface EventBusResource {
  // 用于系统间通信的事件总线
}

// 随机数生成器资源
interface RandomGeneratorResource {
  seed: number;
  // 确定性随机数生成器，用于网络同步
}

// 本地化资源
interface LocalizationResource {
  currentLanguage: string;
  strings: Map<string, string>; // 本地化字符串表
}

// 音频资源
interface AudioResource {
  musicVolume: number;
  sfxVolume: number;
  currentTrack: string;
}
```

### 5. 网络资源（多人游戏）
```typescript
// 网络状态资源
interface NetworkStateResource {
  connectionStatus: ConnectionStatus;
  latency: number;
  serverTime: number;
}

// 同步状态资源
interface SyncStateResource {
  lastSyncTime: number;
  pendingActions: ActionQueue;
  rollbackFrames: number;
}
```

## 总结

本架构设计完整覆盖了赛尔号的核心玩法要素，包括：
- **精灵收集与培养**：通过完整的属性系统、性格系统、努力值系统实现深度培养
- **战斗系统**：基于属性相克的回合制战斗，支持PVE和PVP
- **进化与融合**：丰富的精灵获取和强化途径
- **任务与进度**：完整的任务系统和图鉴收集
- **经济系统**：道具、货币、背包管理

所有组件、实体、系统和资源都经过精心设计，确保了游戏的可扩展性和维护性。架构采用ECS（Entity-Component-System）模式，便于功能模块化和性能优化。