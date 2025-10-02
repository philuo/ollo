# 梦幻西游 - ECS游戏架构设计

> 基于OllO引擎的回合制MMORPG完整ECS架构

---

## 一、组件（Components）

组件是纯数据容器，描述实体的各种属性。

### 1.1 核心组件

#### Transform（变换组件）
- **功能**：描述实体在场景中的位置、旋转和缩放
- **数据类型**：
  - `position: Vec3` (f32 x 3) - 世界坐标（x, y, z）
  - `rotation: f32` - 旋转角度（弧度）
  - `scale: Vec2` (f32 x 2) - 缩放比例（2D游戏）

#### Velocity（速度组件）
- **功能**：描述实体的移动速度
- **数据类型**：
  - `linear: Vec2` (f32 x 2) - 线性速度
  - `moveSpeed: f32` - 移动速度（像素/秒）

#### AABB（轴对齐包围盒）
- **功能**：碰撞检测边界
- **数据类型**：
  - `min: Vec2` (f32 x 2) - 最小坐标
  - `max: Vec2` (f32 x 2) - 最大坐标
  - `offset: Vec2` (f32 x 2) - 相对Transform的偏移

### 1.2 渲染组件

#### SpriteRenderer（精灵渲染器）
- **功能**：渲染2D精灵图像
- **数据类型**：
  - `textureId: u32` - 纹理资源ID
  - `uvRect: Vec4` (f32 x 4) - UV坐标
  - `color: Vec4` (f32 x 4) - 颜色调制RGBA
  - `layer: u8` - 渲染层级（0-255）
  - `flipX: bool` - 水平翻转
  - `flipY: bool` - 垂直翻转

#### AnimationController（动画控制器）
- **功能**：控制精灵动画播放
- **数据类型**：
  - `currentAnimation: string` - 当前动画名称
  - `frameIndex: u32` - 当前帧索引
  - `frameTime: f32` - 当前帧已播放时间
  - `playbackSpeed: f32` - 播放速度倍率
  - `loop: bool` - 是否循环播放
  - `playing: bool` - 是否正在播放

#### ParticleEmitter（粒子发射器）
- **功能**：技能特效、环境特效
- **数据类型**：
  - `maxParticles: u32` - 最大粒子数
  - `emissionRate: f32` - 发射速率
  - `lifetime: f32` - 粒子生命周期
  - `startColor: Vec4` - 起始颜色
  - `endColor: Vec4` - 结束颜色
  - `particleType: u8` - 粒子类型

#### UIElement（UI元素）
- **功能**：UI界面元素基础组件
- **数据类型**：
  - `anchorPoint: Vec2` (f32 x 2) - 锚点位置
  - `pivot: Vec2` (f32 x 2) - 轴心点
  - `size: Vec2` (f32 x 2) - 尺寸
  - `visible: bool` - 是否可见
  - `zOrder: i32` - UI层级

### 1.3 角色属性组件

#### BaseAttributes（基础属性）
- **功能**：角色的基础数值属性
- **数据类型**：
  - `level: u16` - 等级（1-175）
  - `experience: u64` - 当前经验值
  - `expToNextLevel: u64` - 升级所需经验
  - `strength: u16` - 力量
  - `vitality: u16` - 体质
  - `agility: u16` - 敏捷
  - `intelligence: u16` - 智力
  - `endurance: u16` - 耐力

#### CombatStats（战斗属性）
- **功能**：战斗中的衍生属性
- **数据类型**：
  - `hp: u32` - 当前气血
  - `maxHp: u32` - 最大气血
  - `mp: u32` - 当前法力
  - `maxMp: u32` - 最大法力
  - `attack: u32` - 物理攻击力
  - `defense: u32` - 物理防御力
  - `magicAttack: u32` - 法术攻击力
  - `magicDefense: u32` - 法术防御力
  - `speed: u16` - 速度（决定行动顺序）
  - `dodge: u16` - 躲避率
  - `hit: u16` - 命中率
  - `criticalRate: u16` - 暴击率
  - `criticalDamage: u16` - 暴击伤害

#### SecondaryStats（辅助属性）
- **功能**：其他辅助战斗属性
- **数据类型**：
  - `anger: u16` - 愤怒值（0-150）
  - `spiritualPower: u32` - 灵力
  - `healing: u32` - 治疗强度
  - `damage: u32` - 伤害结果
  - `resistFire: u16` - 火抗性
  - `resistWater: u16` - 水抗性
  - `resistThunder: u16` - 雷抗性
  - `resistEarth: u16` - 土抗性
  - `resistPoison: u16` - 毒抗性

### 1.4 角色身份组件

#### PlayerCharacter（玩家角色标记）
- **功能**：标记该实体为玩家控制的角色
- **数据类型**：
  - `playerId: u64` - 玩家ID
  - `accountId: u64` - 账号ID
  - `characterName: string` - 角色名称
  - `gender: u8` - 性别（0=男，1=女）
  - `race: u8` - 种族（0=人族，1=仙族，2=魔族）
  - `sect: u8` - 门派（0-11）

#### PetCharacter（宠物标记）
- **功能**：标记该实体为宠物
- **数据类型**：
  - `petId: u64` - 宠物唯一ID
  - `ownerId: u64` - 主人角色ID
  - `petName: string` - 宠物名称
  - `petType: u16` - 宠物种类
  - `growth: f32` - 成长率（0.0-1.5）
  - `loyality: u8` - 忠诚度（0-100）

#### NPCCharacter（NPC标记）
- **功能**：标记该实体为NPC
- **数据类型**：
  - `npcId: u32` - NPC模板ID
  - `npcName: string` - NPC名称
  - `npcType: u8` - NPC类型（0=任务，1=商店，2=战斗，3=功能）
  - `interactable: bool` - 是否可交互

#### MonsterCharacter（怪物标记）
- **功能**：标记该实体为战斗怪物
- **数据类型**：
  - `monsterId: u32` - 怪物模板ID
  - `monsterName: string` - 怪物名称
  - `monsterRank: u8` - 怪物等级（0=普通，1=精英，2=BOSS）

### 1.5 技能组件

#### SkillSet（技能集）
- **功能**：角色拥有的所有技能
- **数据类型**：
  - `skills: Array<SkillSlot>` - 技能列表
  - `maxSkillSlots: u8` - 最大技能槽位数

#### SkillSlot（技能槽）
- **功能**：单个技能数据
- **数据类型**：
  - `skillId: u32` - 技能ID
  - `skillLevel: u8` - 技能等级（1-160）
  - `experience: u32` - 技能熟练度
  - `cooldown: f32` - 当前冷却时间
  - `enabled: bool` - 是否启用

#### SpellBook（法术书）
- **功能**：存储角色的法术技能
- **数据类型**：
  - `spells: Array<u32>` - 已学习的法术ID列表
  - `maxSpells: u8` - 最大法术数量

#### PetSkills（宠物技能）
- **功能**：宠物的技能集合
- **数据类型**：
  - `skills: Array<u32>` - 宠物技能ID列表（最多10个）
  - `certification: u8` - 技能认证数量

### 1.6 装备和物品组件

#### Equipment（装备栏）
- **功能**：角色穿戴的装备
- **数据类型**：
  - `weapon: Option<u64>` - 武器物品ID
  - `helmet: Option<u64>` - 头盔
  - `armor: Option<u64>` - 铠甲
  - `belt: Option<u64>` - 腰带
  - `boots: Option<u64>` - 鞋子
  - `necklace: Option<u64>` - 项链
  - `ring: Option<u64>` - 戒指

#### Inventory（背包）
- **功能**：存储物品的容器
- **数据类型**：
  - `slots: Array<ItemSlot>` - 物品槽列表
  - `maxSlots: u16` - 最大槽位数
  - `gold: u64` - 金币数量
  - `reserveGold: u64` - 储备金

#### ItemSlot（物品槽）
- **功能**：单个物品数据
- **数据类型**：
  - `itemId: u32` - 物品模板ID
  - `instanceId: u64` - 物品实例ID（装备用）
  - `quantity: u32` - 数量（可堆叠物品）
  - `bindStatus: u8` - 绑定状态（0=未绑定，1=装备绑定，2=拾取绑定）

#### ItemProperties（物品属性）
- **功能**：装备的具体属性
- **数据类型**：
  - `durability: u16` - 当前耐久度
  - `maxDurability: u16` - 最大耐久度
  - `level: u16` - 装备等级
  - `quality: u8` - 品质（0-5：白绿蓝紫橙红）
  - `baseStats: Map<u8, u32>` - 基础属性加成
  - `gemSlots: Array<u32>` - 宝石槽（最多4个）
  - `enchantLevel: u8` - 强化等级（0-20）
  - `special: Array<u32>` - 特技/特效ID列表

### 1.7 战斗组件

#### BattleParticipant（战斗参与者）
- **功能**：标记实体正在战斗中
- **数据类型**：
  - `battleId: u64` - 战斗场次ID
  - `side: u8` - 阵营（0=我方，1=敌方）
  - `position: u8` - 站位（0-4）
  - `isLeader: bool` - 是否队长

#### BattleState（战斗状态）
- **功能**：当前战斗状态
- **数据类型**：
  - `canAct: bool` - 是否可行动
  - `hasActed: bool` - 本回合是否已行动
  - `defending: bool` - 防御状态
  - `protect: Option<u64>` - 保护目标实体ID
  - `summonSlots: Array<Option<u64>>` - 召唤兽槽位

#### BuffContainer（增益/减益容器）
- **功能**：存储角色身上的所有Buff
- **数据类型**：
  - `buffs: Array<BuffInstance>` - Buff实例列表
  - `maxBuffs: u8` - 最大Buff数量

#### BuffInstance（Buff实例）
- **功能**：单个Buff数据
- **数据类型**：
  - `buffId: u32` - Buff模板ID
  - `duration: u8` - 剩余回合数
  - `stackCount: u8` - 叠加层数
  - `sourceId: u64` - 施加者实体ID
  - `value: f32` - Buff强度值

#### TurnAction（回合行动）
- **功能**：记录玩家在当前回合的操作
- **数据类型**：
  - `actionType: u8` - 行动类型（0=攻击，1=法术，2=物品，3=防御，4=逃跑，5=保护，6=捕捉）
  - `targetId: Option<u64>` - 目标实体ID
  - `skillId: Option<u32>` - 使用的技能ID
  - `itemId: Option<u64>` - 使用的物品ID
  - `submitted: bool` - 是否已提交

### 1.8 社交和队伍组件

#### TeamMember（队伍成员）
- **功能**：标记角色在队伍中
- **数据类型**：
  - `teamId: u64` - 队伍ID
  - `isLeader: bool` - 是否队长
  - `position: u8` - 队伍位置（0-4）
  - `readyStatus: bool` - 准备状态

#### FriendList（好友列表）
- **功能**：存储好友数据
- **数据类型**：
  - `friends: Array<FriendEntry>` - 好友列表
  - `maxFriends: u16` - 最大好友数量

#### FriendEntry（好友条目）
- **功能**：单个好友数据
- **数据类型**：
  - `friendId: u64` - 好友角色ID
  - `friendName: string` - 好友名称
  - `friendLevel: u16` - 好友等级
  - `friendshipLevel: u8` - 友好度（1-5）
  - `online: bool` - 是否在线

#### GuildMember（帮派成员）
- **功能**：帮派归属信息
- **数据类型**：
  - `guildId: u64` - 帮派ID
  - `guildName: string` - 帮派名称
  - `guildRank: u8` - 帮派职位（0=帮主，1=副帮主，2=长老，3=精英，4=成员）
  - `contribution: u32` - 帮派贡献度
  - `joinTime: u64` - 加入时间戳

### 1.9 任务组件

#### QuestLog（任务日志）
- **功能**：存储角色的任务进度
- **数据类型**：
  - `activeQuests: Array<QuestProgress>` - 进行中的任务
  - `completedQuests: Array<u32>` - 已完成任务ID列表
  - `maxActiveQuests: u8` - 最大同时任务数

#### QuestProgress（任务进度）
- **功能**：单个任务的进度数据
- **数据类型**：
  - `questId: u32` - 任务ID
  - `objectives: Array<ObjectiveProgress>` - 目标进度列表
  - `startTime: u64` - 接取时间
  - `questType: u8` - 任务类型（0=主线，1=支线，2=日常，3=帮派，4=剧情）

#### ObjectiveProgress（任务目标进度）
- **功能**：任务中的单个目标
- **数据类型**：
  - `objectiveType: u8` - 目标类型（0=击败，1=收集，2=对话，3=护送）
  - `targetId: u32` - 目标对象ID
  - `current: u32` - 当前进度
  - `required: u32` - 需求数量
  - `completed: bool` - 是否完成

### 1.10 AI组件

#### AIController（AI控制器）
- **功能**：NPC和怪物的AI行为
- **数据类型**：
  - `behaviorTree: u32` - 行为树ID
  - `currentState: u8` - 当前状态
  - `targetId: Option<u64>` - 目标实体ID
  - `patrolPath: Option<Array<Vec2>>` - 巡逻路径
  - `aggroRadius: f32` - 警戒范围
  - `combatRadius: f32` - 战斗范围

#### BattleAI（战斗AI）
- **功能**：自动战斗的AI决策
- **数据类型**：
  - `strategy: u8` - 战斗策略（0=智能，1=物理，2=法术，3=防御，4=辅助）
  - `priorityTarget: u8` - 优先目标（0=随机，1=血少，2=防低，3=攻高）
  - `mpThreshold: f32` - 法力阈值（低于此值使用物理攻击）
  - `hpThreshold: f32` - 血量阈值（低于此值使用药品）
  - `autoProtectAlly: bool` - 自动保护队友

### 1.11 场景和地图组件

#### MapEntity（地图实体）
- **功能**：标记实体属于某个地图场景
- **数据类型**：
  - `mapId: u32` - 地图ID
  - `spawnPoint: Vec2` - 出生点坐标
  - `canLeave: bool` - 是否可离开地图

#### TeleportPoint（传送点）
- **功能**：地图传送点
- **数据类型**：
  - `targetMapId: u32` - 目标地图ID
  - `targetPosition: Vec2` - 目标位置
  - `requireLevel: u16` - 需求等级
  - `cost: u32` - 传送费用

#### CollisionShape（碰撞形状）
- **功能**：地图障碍物和可通行区域
- **数据类型**：
  - `shapeType: u8` - 形状类型（0=矩形，1=圆形，2=多边形）
  - `vertices: Array<Vec2>` - 顶点数组
  - `layer: u8` - 碰撞层
  - `isTrigger: bool` - 是否为触发器

#### Interactable（可交互对象）
- **功能**：可交互的场景物体
- **数据类型**：
  - `interactType: u8` - 交互类型（0=对话，1=采集，2=商店，3=任务）
  - `interactRange: f32` - 交互范围
  - `cooldown: f32` - 交互冷却时间
  - `available: bool` - 是否可用

### 1.12 网络组件

#### NetworkIdentity（网络标识）
- **功能**：网络同步的实体标识
- **数据类型**：
  - `networkId: u64` - 网络唯一ID
  - `ownerId: u64` - 所有者客户端ID
  - `authority: u8` - 权限（0=服务器，1=客户端）

#### NetworkTransform（网络变换同步）
- **功能**：同步Transform组件
- **数据类型**：
  - `lastSyncTime: f64` - 上次同步时间
  - `syncInterval: f32` - 同步间隔
  - `interpolate: bool` - 是否插值
  - `threshold: f32` - 同步阈值

#### NetworkAnimator（网络动画同步）
- **功能**：同步动画状态
- **数据类型**：
  - `lastAnimation: string` - 上次同步的动画
  - `syncOnChange: bool` - 仅变化时同步

### 1.13 经济组件

#### Merchant（商人）
- **功能**：NPC商店功能
- **数据类型**：
  - `shopType: u8` - 商店类型（0=杂货，1=装备，2=药品，3=宠物）
  - `inventory: Array<ShopItem>` - 商品列表
  - `refreshInterval: u32` - 刷新间隔（秒）
  - `lastRefresh: u64` - 上次刷新时间

#### ShopItem（商品条目）
- **功能**：商店中的单个商品
- **数据类型**：
  - `itemId: u32` - 物品ID
  - `stock: u32` - 库存数量（-1为无限）
  - `price: u32` - 价格
  - `discount: f32` - 折扣（0.0-1.0）

#### TradeOffer（交易提议）
- **功能**：玩家间交易
- **数据类型**：
  - `traderId: u64` - 交易对象ID
  - `offerItems: Array<u64>` - 提供的物品ID列表
  - `offerGold: u64` - 提供的金币
  - `locked: bool` - 是否锁定
  - `confirmed: bool` - 是否确认

### 1.14 生活技能组件

#### LifeSkills（生活技能）
- **功能**：非战斗类技能
- **数据类型**：
  - `cooking: u16` - 烹饪等级（0-150）
  - `cookingExp: u32` - 烹饪经验
  - `alchemy: u16` - 炼金术等级
  - `alchemyExp: u32` - 炼金术经验
  - `crafting: u16` - 打造等级
  - `craftingExp: u32` - 打造经验
  - `tailoring: u16` - 裁缝等级
  - `tailoringExp: u32` - 裁缝经验

#### HouseOwner（房屋所有者）
- **功能**：玩家房屋系统
- **数据类型**：
  - `houseId: u64` - 房屋ID
  - `houseLevel: u8` - 房屋等级（1-5）
  - `roomCount: u8` - 房间数量
  - `furniture: Array<u32>` - 家具ID列表
  - `servants: Array<u32>` - 仆人ID列表
  - `durability: u16` - 房屋耐久度

### 1.15 特殊状态组件

#### Mounted（骑乘状态）
- **功能**：角色骑乘坐骑
- **数据类型**：
  - `mountId: u32` - 坐骑ID
  - `speedBonus: f32` - 速度加成
  - `canBattle: bool` - 是否可战斗

#### Transform（变身状态）
- **功能**：变身卡效果
- **数据类型**：
  - `transformId: u32` - 变身卡ID
  - `duration: u32` - 剩余时间（秒）
  - `attributeBonus: Map<u8, i32>` - 属性加成

#### Flying（飞行状态）
- **功能**：飞行标记（飞行符/飞行坐骑）
- **数据类型**：
  - `altitude: f32` - 飞行高度
  - `flyingSpeed: f32` - 飞行速度

---

## 二、实体（Entities）

实体是组件的组合，形成不同的原型（Archetype）。

### 2.1 玩家相关实体

#### PlayerEntity（玩家实体）
**挂载组件**：
- Transform
- Velocity
- AABB
- SpriteRenderer
- AnimationController
- PlayerCharacter
- BaseAttributes
- CombatStats
- SecondaryStats
- SkillSet
- SpellBook
- Equipment
- Inventory
- TeamMember (可选)
- GuildMember (可选)
- FriendList
- QuestLog
- MapEntity
- NetworkIdentity
- NetworkTransform
- NetworkAnimator
- LifeSkills
- HouseOwner (可选)

**实体数量**：
- 单个场景：50-200个（根据地图人数上限）
- 全服务器：10,000-100,000个（在线玩家）

#### PetEntity（宠物实体）
**挂载组件**：
- Transform
- SpriteRenderer
- AnimationController
- PetCharacter
- BaseAttributes
- CombatStats
- SecondaryStats
- PetSkills
- BattleParticipant (战斗中)
- BattleState (战斗中)
- BuffContainer
- NetworkIdentity

**实体数量**：
- 单个战斗：最多10个（双方各5）
- 数据库：每玩家最多50个，总计数百万个

### 2.2 NPC实体

#### TaskNPC（任务NPC）
**挂载组件**：
- Transform
- SpriteRenderer
- AnimationController
- NPCCharacter
- Interactable
- MapEntity
- NetworkIdentity

**实体数量**：
- 每个主城：50-100个
- 每个野外地图：10-30个
- 全服：1,000-3,000个

#### MerchantNPC（商人NPC）
**挂载组件**：
- Transform
- SpriteRenderer
- AnimationController
- NPCCharacter
- Merchant
- Interactable
- MapEntity
- NetworkIdentity

**实体数量**：
- 每个主城：20-40个
- 全服：500-1,000个

#### BattleNPC（战斗NPC）
**挂载组件**：
- Transform
- SpriteRenderer
- AnimationController
- NPCCharacter
- BaseAttributes
- CombatStats
- SecondaryStats
- SkillSet
- BattleParticipant (战斗中)
- BattleState (战斗中)
- BuffContainer
- BattleAI
- MapEntity

**实体数量**：
- 每个战斗场景：1-5个
- 并发战斗：1,000-10,000个

### 2.3 怪物实体

#### WildMonster（野外怪物）
**挂载组件**：
- Transform
- Velocity
- AABB
- SpriteRenderer
- AnimationController
- MonsterCharacter
- BaseAttributes
- CombatStats
- SecondaryStats
- SkillSet
- AIController
- MapEntity
- NetworkIdentity

**实体数量**：
- 每个野外地图：100-500个
- 全服：10,000-50,000个

#### BattleMonster（战斗怪物实例）
**挂载组件**：
- SpriteRenderer
- AnimationController
- MonsterCharacter
- BaseAttributes
- CombatStats
- SecondaryStats
- SkillSet
- BattleParticipant
- BattleState
- BuffContainer
- BattleAI

**实体数量**：
- 每个战斗：1-5个
- 并发战斗数 × 平均怪物数：5,000-30,000个

#### BossMonster（BOSS怪物）
**挂载组件**：
- Transform
- Velocity
- AABB
- SpriteRenderer
- AnimationController
- ParticleEmitter
- MonsterCharacter
- BaseAttributes
- CombatStats
- SecondaryStats
- SkillSet
- BuffContainer
- AIController
- MapEntity
- NetworkIdentity

**实体数量**：
- 每个副本/特殊地图：1-3个
- 全服：100-500个

### 2.4 场景实体

#### MapTrigger（地图触发器）
**挂载组件**：
- Transform
- AABB
- CollisionShape
- Interactable
- MapEntity

**实体数量**：
- 每个地图：10-50个
- 全服：5,000-20,000个

#### TeleportGate（传送门）
**挂载组件**：
- Transform
- SpriteRenderer
- TeleportPoint
- Interactable
- MapEntity
- NetworkIdentity

**实体数量**：
- 每个地图：5-15个
- 全服：3,000-10,000个

#### ResourceNode（资源采集点）
**挂载组件**：
- Transform
- SpriteRenderer
- Interactable
- MapEntity
- NetworkIdentity

**实体数量**：
- 每个地图：20-100个
- 全服：10,000-30,000个

### 2.5 特效实体

#### SkillEffect（技能特效）
**挂载组件**：
- Transform
- SpriteRenderer
- AnimationController
- ParticleEmitter

**实体数量**：
- 瞬时创建销毁
- 峰值：5,000-20,000个（大规模战斗）

#### BuffEffect（Buff视觉效果）
**挂载组件**：
- Transform
- ParticleEmitter
- UIElement

**实体数量**：
- 依附于战斗单位
- 峰值：2,000-10,000个

### 2.6 UI实体

#### BattleUI（战斗界面）
**挂载组件**：
- UIElement
- SpriteRenderer

**实体数量**：
- 每个客户端：1个完整UI树
- 子元素：50-100个

#### CharacterPanel（角色面板）
**挂载组件**：
- UIElement
- SpriteRenderer

**实体数量**：
- 每个客户端：1个
- 子元素：30-60个

#### InventoryUI（背包界面）
**挂载组件**：
- UIElement
- SpriteRenderer

**实体数量**：
- 每个客户端：1个
- 物品槽：150-200个

#### SkillBar（技能栏）
**挂载组件**：
- UIElement
- SpriteRenderer

**实体数量**：
- 每个客户端：1个
- 技能槽：10-20个

#### ChatWindow（聊天窗口）
**挂载组件**：
- UIElement
- SpriteRenderer

**实体数量**：
- 每个客户端：1个
- 消息条目：50-200个（滚动）

#### Minimap（小地图）
**挂载组件**：
- UIElement
- SpriteRenderer

**实体数量**：
- 每个客户端：1个

### 2.7 物品实体

#### DroppedItem（掉落物品）
**挂载组件**：
- Transform
- SpriteRenderer
- ItemProperties
- Interactable
- MapEntity
- NetworkIdentity

**实体数量**：
- 每个战斗后：1-10个
- 地图上并发：100-500个（有自动消失机制）

#### EquipmentInstance（装备实例）
**挂载组件**：
- ItemProperties
- NetworkIdentity

**实体数量**：
- 存储在数据库，不作为场景实体
- 玩家背包+装备栏：数百万个

---

## 三、系统（Systems）

系统是处理逻辑的核心，对特定组件组合进行操作。

### 3.1 核心系统

#### TransformSystem（变换系统）
- **功能**：更新实体的Transform组件，计算世界坐标
- **逻辑类型**：每帧执行（Update）
- **处理组件**：Transform, Velocity
- **执行时机**：主循环早期

#### AnimationSystem（动画系统）
- **功能**：更新动画帧，驱动精灵动画播放
- **逻辑类型**：每帧执行（Update）
- **处理组件**：AnimationController, SpriteRenderer
- **执行时机**：Transform更新后

#### PhysicsSystem（物理系统）
- **功能**：处理碰撞检测、速度应用
- **逻辑类型**：固定时间步长（FixedUpdate, 60Hz）
- **处理组件**：Transform, Velocity, AABB, CollisionShape
- **执行时机**：独立物理循环

### 3.2 渲染系统

#### RenderSystem（渲染系统）
- **功能**：渲染所有可见实体
- **逻辑类型**：每帧执行（Render）
- **处理组件**：Transform, SpriteRenderer
- **执行时机**：渲染阶段
- **优化**：视锥剔除、层级排序、批处理

#### ParticleSystem（粒子系统）
- **功能**：更新和渲染粒子效果
- **逻辑类型**：每帧执行（Update + Render）
- **处理组件**：ParticleEmitter, Transform
- **执行时机**：渲染前更新粒子生命周期

#### UIRenderSystem（UI渲染系统）
- **功能**：渲染所有UI元素
- **逻辑类型**：每帧执行（Render）
- **处理组件**：UIElement, SpriteRenderer
- **执行时机**：场景渲染后（最后渲染）

#### CameraSystem（相机系统）
- **功能**：跟随玩家、边界限制、缩放控制
- **逻辑类型**：每帧执行（LateUpdate）
- **处理组件**：Camera, Transform
- **执行时机**：所有Transform更新后

### 3.3 战斗系统

#### BattleInitSystem（战斗初始化系统）
- **功能**：创建战斗场景，生成战斗实体，分配站位
- **逻辑类型**：事件驱动（触发战斗时）
- **处理组件**：创建 BattleParticipant, BattleState
- **执行流程**：
  1. 确定双方参战单位
  2. 创建战斗实例（BattleId）
  3. 复制角色属性到战斗实例
  4. 初始化战斗UI
  5. 播放战斗进入动画

#### TurnOrderSystem（回合顺序系统）
- **功能**：根据速度计算行动顺序
- **逻辑类型**：每回合开始（Event）
- **处理组件**：BattleParticipant, CombatStats
- **执行流程**：
  1. 收集所有参战单位
  2. 根据速度值排序
  3. 考虑速度Buff、装备加成
  4. 生成行动队列

#### ActionInputSystem（行动输入系统）
- **功能**：接收玩家的战斗操作指令
- **逻辑类型**：事件驱动（玩家操作）
- **处理组件**：TurnAction, PlayerCharacter
- **执行流程**：
  1. 验证行动合法性
  2. 记录行动到TurnAction组件
  3. 等待所有玩家提交
  4. 超时自动防御

#### AIDecisionSystem（AI决策系统）
- **功能**：NPC/怪物的战斗AI决策
- **逻辑类型**：轮到AI单位行动时
- **处理组件**：BattleAI, BattleState, CombatStats
- **执行流程**：
  1. 评估战场态势
  2. 根据策略选择行动
  3. 选择目标
  4. 提交行动到TurnAction

#### ActionExecutionSystem（行动执行系统）
- **功能**：执行战斗行动，计算伤害
- **逻辑类型**：按回合顺序执行
- **处理组件**：TurnAction, CombatStats, SkillSet
- **执行流程**：
  1. 读取TurnAction
  2. 计算命中率
  3. 计算伤害/治疗
  4. 应用Buff/Debuff
  5. 播放动画和特效
  6. 更新HP/MP
  7. 检查死亡

#### DamageCalculationSystem（伤害计算系统）
- **功能**：核心战斗数值计算
- **逻辑类型**：被ActionExecutionSystem调用
- **处理组件**：CombatStats, SecondaryStats, BuffContainer
- **计算公式**：
  - 物理伤害 = (攻击力 - 防御力) × 技能倍率 × 随机系数 × Buff系数
  - 法术伤害 = 法术攻击 × 技能倍率 × (1 - 法抗/100) × Buff系数
  - 暴击判定、躲避判定

#### BuffManagementSystem（Buff管理系统）
- **功能**：应用、更新、移除Buff
- **逻辑类型**：回合开始/结束时
- **处理组件**：BuffContainer, CombatStats
- **执行流程**：
  1. 回合开始时触发Buff效果（持续伤害/治疗）
  2. 回合结束时减少持续时间
  3. 移除过期Buff
  4. 检查Buff叠加规则
  5. 更新属性加成

#### BattleEndSystem（战斗结束系统）
- **功能**：判定战斗结果，结算奖励
- **逻辑类型**：事件驱动（战斗结束条件）
- **处理组件**：BattleParticipant, BattleState
- **执行流程**：
  1. 检查胜负条件（一方全灭或逃跑）
  2. 计算经验奖励
  3. 计算战利品掉落
  4. 发放奖励到背包
  5. 更新任务进度
  6. 销毁战斗实例
  7. 返回场景

### 3.4 技能系统

#### SkillCastSystem（技能施放系统）
- **功能**：处理技能的施放、目标选择
- **逻辑类型**：事件驱动（技能使用）
- **处理组件**：SkillSet, CombatStats
- **执行流程**：
  1. 检查MP是否足够
  2. 检查技能冷却
  3. 验证目标合法性
  4. 扣除MP
  5. 触发技能效果
  6. 设置冷却时间

#### SkillEffectSystem（技能效果系统）
- **功能**：应用技能的各种效果
- **逻辑类型**：被SkillCastSystem调用
- **处理组件**：CombatStats, BuffContainer
- **效果类型**：
  - 直接伤害/治疗
  - 施加Buff/Debuff
  - 召唤/复活
  - 特殊效果（封印、混乱等）

#### PetSkillSystem（宠物技能系统）
- **功能**：处理宠物特有技能
- **逻辑类型**：战斗中行动时
- **处理组件**：PetSkills, BattleState
- **特殊处理**：
  - 宠物技能触发概率
  - 多技能连击
  - 主动/被动技能

### 3.5 装备和物品系统

#### EquipmentSystem（装备系统）
- **功能**：处理装备穿戴、卸下，计算属性加成
- **逻辑类型**：事件驱动（装备操作）
- **处理组件**：Equipment, CombatStats, Inventory
- **执行流程**：
  1. 验证装备条件（等级、职业、种族）
  2. 卸下旧装备
  3. 穿上新装备
  4. 重新计算角色属性
  5. 同步到客户端

#### InventorySystem（背包系统）
- **功能**：管理物品的添加、删除、整理
- **逻辑类型**：事件驱动（背包操作）
- **处理组件**：Inventory, ItemSlot
- **功能列表**：
  - 添加物品（自动堆叠）
  - 删除/丢弃物品
  - 移动物品
  - 整理背包
  - 扩展背包容量

#### ItemUseSystem（物品使用系统）
- **功能**：使用消耗品
- **逻辑类型**：事件驱动（使用物品）
- **处理组件**：Inventory, CombatStats
- **物品类型**：
  - 药品（恢复HP/MP）
  - 食物（临时Buff）
  - 任务物品
  - 特殊道具（变身卡、飞行符）

#### LootSystem（掉落系统）
- **功能**：战斗后生成掉落物
- **逻辑类型**：战斗结束时
- **处理组件**：创建 DroppedItem 实体
- **执行流程**：
  1. 根据怪物等级和稀有度计算掉落表
  2. 随机生成物品
  3. 创建掉落实体
  4. 分配拾取权限
  5. 自动拾取或手动拾取

#### EnhancementSystem（强化系统）
- **功能**：装备强化、宝石镶嵌
- **逻辑类型**：事件驱动（强化操作）
- **处理组件**：ItemProperties
- **功能**：
  - 装备强化（消耗材料提升等级）
  - 宝石镶嵌
  - 装备修理
  - 装备分解

### 3.6 AI系统

#### NPCAISystem（NPC AI系统）
- **功能**：NPC的巡逻、对话、任务触发
- **逻辑类型**：每帧执行
- **处理组件**：AIController, Transform, NPCCharacter
- **行为**：
  - 固定位置站立
  - 巡逻路径
  - 面向玩家
  - 触发剧情

#### MonsterAISystem（怪物AI系统）
- **功能**：野外怪物的巡逻、警戒、追击
- **逻辑类型**：每帧执行
- **处理组件**：AIController, Transform, MonsterCharacter
- **状态机**：
  - 闲置（Idle）：原地或巡逻
  - 警戒（Alert）：发现玩家
  - 追击（Chase）：追逐玩家
  - 触发战斗（Engage）
  - 返回（Return）：脱离后回到出生点

### 3.7 社交和队伍系统

#### TeamManagementSystem（队伍管理系统）
- **功能**：创建、加入、离开队伍
- **逻辑类型**：事件驱动（队伍操作）
- **处理组件**：TeamMember
- **功能**：
  - 创建队伍
  - 邀请玩家
  - 踢出成员
  - 转让队长
  - 队伍聊天
  - 经验分配

#### FriendSystem（好友系统）
- **功能**：添加、删除好友，好友互动
- **逻辑类型**：事件驱动
- **处理组件**：FriendList
- **功能**：
  - 添加好友申请
  - 删除好友
  - 查看好友状态
  - 好友传送
  - 赠送礼物

#### GuildSystem（帮派系统）
- **功能**：帮派创建、管理、活动
- **逻辑类型**：事件驱动
- **处理组件**：GuildMember
- **功能**：
  - 创建帮派
  - 招募成员
  - 帮派升级
  - 帮派任务
  - 帮派战
  - 帮派福利

#### ChatSystem（聊天系统）
- **功能**：各种聊天频道消息传递
- **逻辑类型**：事件驱动
- **处理组件**：NetworkIdentity
- **频道类型**：
  - 世界频道
  - 队伍频道
  - 帮派频道
  - 私聊
  - 系统公告

#### TradeSystem（交易系统）
- **功能**：玩家间物品交易
- **逻辑类型**：事件驱动
- **处理组件**：TradeOffer, Inventory
- **执行流程**：
  1. 发起交易请求
  2. 双方放入物品/金币
  3. 锁定交易
  4. 双方确认
  5. 执行交换
  6. 防作弊验证

### 3.8 任务系统

#### QuestSystem（任务系统）
- **功能**：任务接取、进度更新、完成
- **逻辑类型**：事件驱动
- **处理组件**：QuestLog, QuestProgress
- **执行流程**：
  1. 检查接取条件
  2. 添加到任务日志
  3. 监听相关事件（击杀、收集等）
  4. 更新进度
  5. 完成时给予奖励

#### QuestProgressSystem（任务进度系统）
- **功能**：追踪任务目标完成情况
- **逻辑类型**：事件驱动（游戏事件）
- **处理组件**：QuestProgress, ObjectiveProgress
- **监听事件**：
  - 击败怪物
  - 收集物品
  - 对话NPC
  - 到达地点
  - 护送NPC

### 3.9 地图和场景系统

#### MapLoadSystem（地图加载系统）
- **功能**：加载/卸载地图资源
- **逻辑类型**：事件驱动（切换地图）
- **处理组件**：MapEntity
- **执行流程**：
  1. 卸载当前地图实体
  2. 加载地图数据
  3. 生成地图实体（NPC、怪物、障碍物）
  4. 生成玩家实体
  5. 初始化地图系统（刷怪、资源点）

#### SpawnSystem（刷新系统）
- **功能**：怪物、资源点的定时刷新
- **逻辑类型**：定时器驱动
- **处理组件**：创建 MonsterCharacter, ResourceNode
- **机制**：
  - 定点刷新
  - 随机刷新
  - 刷新间隔
  - 最大数量限制

#### TeleportSystem（传送系统）
- **功能**：处理玩家传送
- **逻辑类型**：事件驱动（传送触发）
- **处理组件**：TeleportPoint, Transform, MapEntity
- **传送类型**：
  - 地图传送门
  - 飞行符传送
  - 技能传送（回门派、飞行术）
  - GM传送

#### InteractionSystem（交互系统）
- **功能**：玩家与场景物体交互
- **逻辑类型**：事件驱动（玩家点击）
- **处理组件**：Interactable
- **交互类型**：
  - 对话NPC
  - 采集资源
  - 打开宝箱
  - 触发机关

### 3.10 网络系统

#### NetworkSyncSystem（网络同步系统）
- **功能**：同步实体状态到客户端
- **逻辑类型**：定时执行（20-60Hz）
- **处理组件**：NetworkIdentity, NetworkTransform
- **同步内容**：
  - 位置和移动
  - 动画状态
  - 属性变化
  - 战斗事件

#### ClientPredictionSystem（客户端预测系统）
- **功能**：客户端本地模拟，减少延迟感
- **逻辑类型**：客户端每帧
- **处理组件**：NetworkTransform, Velocity
- **机制**：
  - 预测移动
  - 服务器校正
  - 插值平滑

#### ServerAuthenticationSystem（服务器权威系统）
- **功能**：验证客户端操作合法性
- **逻辑类型**：事件驱动（客户端请求）
- **验证项**：
  - 移动速度合法性
  - 技能冷却时间
  - 物品交易合法性
  - 防止外挂作弊

### 3.11 经济系统

#### ShopSystem（商店系统）
- **功能**：NPC商店买卖
- **逻辑类型**：事件驱动（购买/出售）
- **处理组件**：Merchant, Inventory
- **功能**：
  - 购买物品
  - 出售物品
  - 回购物品
  - 商品刷新

#### AuctionSystem（拍卖系统）
- **功能**：玩家间拍卖行交易
- **逻辑类型**：事件驱动
- **功能**：
  - 上架物品
  - 搜索物品
  - 竞价/一口价
  - 自动交易
  - 税收机制

#### EconomyBalanceSystem（经济平衡系统）
- **功能**：监控游戏经济，金币产出/消耗
- **逻辑类型**：定时统计
- **监控指标**：
  - 金币产出（任务、出售）
  - 金币消耗（购买、修理、税费）
  - 通货膨胀率
  - 物价调控

### 3.12 生活技能系统

#### CraftingSystem（制造系统）
- **功能**：打造装备、炼药、烹饪
- **逻辑类型**：事件驱动
- **处理组件**：LifeSkills, Inventory
- **流程**：
  1. 选择配方
  2. 检查材料
  3. 消耗材料
  4. 技能判定（成功率、品质）
  5. 生成物品
  6. 增加熟练度

#### GatheringSystem（采集系统）
- **功能**：采集资源点
- **逻辑类型**：事件驱动
- **处理组件**：Interactable, Inventory
- **流程**：
  1. 检查技能等级
  2. 播放采集动画
  3. 随机生成资源
  4. 添加到背包
  5. 增加熟练度
  6. 资源点消失/刷新

### 3.13 宠物系统

#### PetManagementSystem（宠物管理系统）
- **功能**：宠物携带、召唤、存放
- **逻辑类型**：事件驱动
- **处理组件**：PetCharacter
- **功能**：
  - 召唤宠物
  - 收回宠物
  - 宠物改名
  - 宠物存放（最多50只）

#### PetTrainingSystem（宠物训练系统）
- **功能**：宠物升级、学习技能
- **逻辑类型**：事件驱动
- **处理组件**：PetCharacter, PetSkills
- **功能**：
  - 战斗获得经验
  - 升级分配属性点
  - 学习技能
  - 技能遗忘
  - 技能认证

#### PetBreedingSystem（宠物繁殖系统）
- **功能**：宠物合成、洗练
- **逻辑类型**：事件驱动
- **功能**：
  - 宠物合成（两只合一只，属性提升）
  - 宠物洗练（重置资质）
  - 宠物打书（学习新技能）

### 3.14 特殊玩法系统

#### HousingSystem（房屋系统）
- **功能**：玩家房屋管理
- **逻辑类型**：事件驱动
- **处理组件**：HouseOwner
- **功能**：
  - 购买房屋
  - 房屋升级
  - 家具布置
  - 仓库存储
  - 雇佣仆人
  - 房屋维护

#### MountSystem（坐骑系统）
- **功能**：骑乘系统
- **逻辑类型**：事件驱动
- **处理组件**：Mounted, Velocity
- **功能**：
  - 上下坐骑
  - 移动速度加成
  - 坐骑外观替换

#### TransformSystem（变身系统）
- **功能**：变身卡效果
- **逻辑类型**：事件驱动
- **处理组件**：Transform组件（变身）, CombatStats
- **功能**：
  - 使用变身卡
  - 属性加成
  - 外观改变
  - 时效倒计时

### 3.15 活动和副本系统

#### DungeonSystem（副本系统）
- **功能**：副本创建和管理
- **逻辑类型**：事件驱动
- **功能**：
  - 创建副本实例
  - 队伍传送进入
  - 副本进度记录
  - 通关奖励结算
  - 副本销毁

#### EventSystem（活动系统）
- **功能**：限时活动管理
- **逻辑类型**：定时触发
- **活动类型**：
  - 双倍经验
  - 节日活动
  - 限时BOSS
  - 跨服竞技

#### RankingSystem（排行榜系统）
- **功能**：各种排行榜统计
- **逻辑类型**：定时更新（每小时/每天）
- **排行类型**：
  - 等级榜
  - 战力榜
  - 财富榜
  - 帮派榜
  - 竞技场榜

---

## 四、资源（Resources）

资源是全局共享的数据和状态。

### 4.1 游戏配置资源

#### GameConfig（游戏配置）
- **功能**：全局游戏参数
- **数据**：
  - `maxLevel: u16 = 175` - 最大等级
  - `expCurve: Array<u64>` - 经验曲线表
  - `baseAttributePerLevel: Map` - 每级基础属性成长
  - `maxTeamSize: u8 = 5` - 队伍最大人数
  - `maxPetCount: u8 = 50` - 宠物上限
  - `inventoryBaseSlots: u16 = 60` - 背包初始格子数

#### BalanceConfig（数值平衡配置）
- **功能**：战斗数值配置
- **数据**：
  - `damageFormula: string` - 伤害公式
  - `criticalMultiplier: f32 = 1.5` - 暴击倍率
  - `dodgeCapacity: f32 = 0.3` - 最大闪避率
  - `attributeWeights: Map` - 属性权重系数

### 4.2 资源数据库

#### SkillDatabase（技能数据库）
- **功能**：所有技能的模板数据
- **数据结构**：
  ```typescript
  Map<skillId: u32, SkillTemplate>
  
  SkillTemplate {
    id: u32,
    name: string,
    description: string,
    skillType: u8, // 0=物理, 1=法术, 2=辅助
    targetType: u8, // 0=单体, 1=群体, 2=自己
    mpCost: u32,
    cooldown: f32,
    damageMultiplier: f32,
    effectIds: Array<u32>,
    animationId: u32,
    iconId: u32,
    maxLevel: u8,
  }
  ```

#### ItemDatabase（物品数据库）
- **功能**：所有物品的模板数据
- **数据结构**：
  ```typescript
  Map<itemId: u32, ItemTemplate>
  
  ItemTemplate {
    id: u32,
    name: string,
    description: string,
    itemType: u8, // 0=装备, 1=消耗, 2=任务, 3=材料
    equipSlot: u8,
    level: u16,
    quality: u8,
    stackSize: u32,
    price: u32,
    stats: Map<u8, u32>,
    iconId: u32,
  }
  ```

#### MonsterDatabase（怪物数据库）
- **功能**：怪物模板数据
- **数据结构**：
  ```typescript
  Map<monsterId: u32, MonsterTemplate>
  
  MonsterTemplate {
    id: u32,
    name: string,
    level: u16,
    baseHp: u32,
    baseMp: u32,
    baseAttack: u32,
    baseDefense: u32,
    baseSpeed: u16,
    skills: Array<u32>,
    lootTable: LootTableId,
    experienceReward: u32,
    modelId: u32,
  }
  ```

#### NPCDatabase（NPC数据库）
- **功能**：NPC模板数据
- **数据结构**：
  ```typescript
  Map<npcId: u32, NPCTemplate>
  
  NPCTemplate {
    id: u32,
    name: string,
    npcType: u8,
    dialogueTree: u32,
    questIds: Array<u32>,
    shopId: Option<u32>,
    modelId: u32,
  }
  ```

#### QuestDatabase（任务数据库）
- **功能**：任务模板数据
- **数据结构**：
  ```typescript
  Map<questId: u32, QuestTemplate>
  
  QuestTemplate {
    id: u32,
    name: string,
    description: string,
    questType: u8,
    requireLevel: u16,
    objectives: Array<Objective>,
    rewards: QuestReward,
    nextQuestId: Option<u32>,
  }
  ```

#### MapDatabase（地图数据库）
- **功能**：地图配置数据
- **数据结构**：
  ```typescript
  Map<mapId: u32, MapTemplate>
  
  MapTemplate {
    id: u32,
    name: string,
    width: u32,
    height: u32,
    tilesetId: u32,
    collisionData: Array<u8>,
    spawnPoints: Array<SpawnPoint>,
    npcSpawns: Array<NPCSpawn>,
    monsterSpawns: Array<MonsterSpawn>,
    teleportPoints: Array<TeleportDef>,
    backgroundMusic: u32,
  }
  ```

#### BuffDatabase（Buff数据库）
- **功能**：Buff/Debuff模板
- **数据结构**：
  ```typescript
  Map<buffId: u32, BuffTemplate>
  
  BuffTemplate {
    id: u32,
    name: string,
    buffType: u8, // 0=增益, 1=减益, 2=控制
    duration: u8, // 回合数
    effectType: u8, // 0=属性修改, 1=持续伤害, 2=控制
    value: f32,
    stackable: bool,
    maxStacks: u8,
    iconId: u32,
  }
  ```

### 4.3 资源管理器

#### TextureAtlas（纹理图集）
- **功能**：管理所有2D纹理资源
- **数据**：
  - `atlases: Map<u32, AtlasData>` - 图集数据
  - `sprites: Map<u32, SpriteRect>` - 精灵UV坐标

#### AnimationLibrary（动画库）
- **功能**：角色和特效动画数据
- **数据**：
  ```typescript
  Map<animId: u32, AnimationClip>
  
  AnimationClip {
    id: u32,
    name: string,
    frames: Array<FrameData>,
    frameDuration: f32,
    loop: bool,
  }
  ```

#### AudioLibrary（音频库）
- **功能**：音效和音乐资源
- **数据**：
  - `bgm: Map<u32, AudioClip>` - 背景音乐
  - `sfx: Map<u32, AudioClip>` - 音效
  - `voice: Map<u32, AudioClip>` - 语音

### 4.4 全局状态

#### GameTime（游戏时间）
- **功能**：游戏世界时间
- **数据**：
  - `serverTime: u64` - 服务器时间戳
  - `deltaTime: f32` - 上帧耗时
  - `fixedDeltaTime: f32 = 0.016` - 固定时间步长
  - `gameDay: u32` - 游戏内天数
  - `dayNightCycle: f32` - 昼夜循环进度

#### ServerState（服务器状态）
- **功能**：服务器运行状态
- **数据**：
  - `serverId: u32` - 服务器ID
  - `serverName: string` - 服务器名称
  - `onlinePlayerCount: u32` - 在线人数
  - `serverLoad: f32` - 服务器负载
  - `maintenanceMode: bool` - 维护模式

#### EventSchedule（活动日程）
- **功能**：当前和即将到来的活动
- **数据**：
  ```typescript
  Array<ScheduledEvent>
  
  ScheduledEvent {
    eventId: u32,
    eventType: u8,
    startTime: u64,
    endTime: u64,
    active: bool,
    config: Map<string, any>,
  }
  ```

### 4.5 缓存和池

#### EntityPool（实体池）
- **功能**：复用频繁创建销毁的实体
- **池类型**：
  - 粒子实体池
  - 伤害数字实体池
  - UI元素池

#### BattleCache（战斗缓存）
- **功能**：当前所有活跃战斗
- **数据**：
  ```typescript
  Map<battleId: u64, BattleInstance>
  
  BattleInstance {
    battleId: u64,
    participants: Array<u64>, // 实体ID列表
    turnNumber: u32,
    currentActorIndex: u8,
    battleState: u8, // 0=准备, 1=行动中, 2=结算
    startTime: u64,
  }
  ```

#### MapCache（地图缓存）
- **功能**：已加载的地图实例
- **数据**：
  - `loadedMaps: Map<u32, MapInstance>` - 当前加载的地图
  - `playerDistribution: Map<u32, Array<u64>>` - 每个地图的玩家列表

### 4.6 网络资源

#### NetworkConfig（网络配置）
- **功能**：网络参数
- **数据**：
  - `serverAddress: string` - 服务器地址
  - `port: u16` - 端口
  - `tickRate: u8 = 20` - 服务器tick频率
  - `syncRate: u8 = 10` - 同步频率
  - `timeout: f32 = 30.0` - 超时时间

#### SessionManager（会话管理器）
- **功能**：管理玩家连接
- **数据**：
  ```typescript
  Map<playerId: u64, PlayerSession>
  
  PlayerSession {
    sessionId: u64,
    playerId: u64,
    accountId: u64,
    connectionState: u8,
    lastHeartbeat: u64,
    ping: u32,
  }
  ```

### 4.7 统计和日志

#### GameStatistics（游戏统计）
- **功能**：游戏数据统计
- **数据**：
  - `totalPlayersCreated: u64` - 创建角色总数
  - `totalBattles: u64` - 总战斗次数
  - `totalItemsDropped: u64` - 掉落物品总数
  - `totalGoldCirculation: u64` - 金币流通量

#### LogSystem（日志系统）
- **功能**：记录重要游戏事件
- **日志类型**：
  - 登录登出日志
  - 交易日志
  - 战斗日志
  - 物品掉落日志
  - 异常行为日志

---

## 五、架构总结

### 5.1 系统执行顺序

```
1. 网络输入阶段
   └─ ServerAuthenticationSystem

2. 输入处理阶段
   └─ ActionInputSystem
   └─ AIDecisionSystem

3. 逻辑更新阶段（Update）
   ├─ GameTime更新
   ├─ QuestProgressSystem
   ├─ BuffManagementSystem
   ├─ ActionExecutionSystem
   ├─ NPCAISystem
   ├─ MonsterAISystem
   └─ SpawnSystem

4. 物理阶段（FixedUpdate）
   └─ PhysicsSystem

5. 变换更新阶段
   ├─ TransformSystem
   └─ AnimationSystem

6. 相机阶段（LateUpdate）
   └─ CameraSystem

7. 渲染阶段（Render）
   ├─ RenderSystem
   ├─ ParticleSystem
   └─ UIRenderSystem

8. 网络同步阶段
   └─ NetworkSyncSystem
```

### 5.2 数据流

```
玩家输入
  ↓
ActionInputSystem（记录到TurnAction）
  ↓
ActionExecutionSystem（读取TurnAction，调用技能/物品系统）
  ↓
DamageCalculationSystem（计算伤害）
  ↓
更新CombatStats（HP/MP变化）
  ↓
BuffManagementSystem（应用Buff效果）
  ↓
检查战斗结束条件
  ↓
BattleEndSystem（结算奖励）
  ↓
更新角色经验、物品、任务进度
  ↓
NetworkSyncSystem（同步到客户端）
```

### 5.3 扩展性设计

#### 模块化
- 每个系统独立，通过组件查询交互
- 新增玩法只需添加新组件和系统
- 数据驱动设计，配置与代码分离

#### 性能优化
- ECS架构天然支持数据局部性
- 可并行处理无依赖系统
- 实体池减少内存分配
- 空间分区（地图分块）减少碰撞检测

#### 网络优化
- 客户端预测 + 服务器校正
- 差异同步（只同步变化的数据）
- 兴趣管理（AOI）
- 战斗采用快照模式（所有玩家看到相同战斗过程）

---

## 六、关键技术点

### 6.1 回合制战斗核心

梦幻西游的战斗系统是半实时回合制：
1. **准备阶段**：玩家有限时（30秒）选择行动
2. **执行阶段**：按速度顺序依次执行所有单位的行动
3. **结算阶段**：检查胜负，更新Buff

ECS实现方式：
- 使用 `TurnAction` 组件收集玩家操作
- `ActionExecutionSystem` 按速度排序后依次执行
- 确定性计算保证所有客户端看到相同结果

### 6.2 宠物系统

宠物拥有独立的属性和技能系统：
- 使用 `PetCharacter` 组件标记宠物身份
- 战斗中视为独立战斗单位（有自己的 `BattleParticipant`）
- 宠物AI由 `BattleAI` 组件控制或玩家手动操作

### 6.3 网络同步策略

- **权威服务器**：所有战斗计算在服务器完成
- **客户端表现**：客户端仅负责播放动画和特效
- **战斗回放**：服务器发送完整行动序列，客户端重放
- **非战斗同步**：位置使用插值，属性变化事件驱动

### 6.4 数据持久化

- 玩家数据定期存档（每5分钟或重大操作后）
- 装备、宠物使用唯一ID（Instance ID）
- 任务进度实时保存
- 交易、拍卖等重要操作立即落盘

---

## 七、预估规模

### 实体数量（单服务器）

| 实体类型 | 数量级 |
|---------|-------|
| 在线玩家 | 5,000 - 10,000 |
| 玩家宠物（战斗中） | 500 - 2,000 |
| NPC | 5,000 - 10,000 |
| 野外怪物 | 10,000 - 50,000 |
| 战斗怪物实例 | 5,000 - 30,000 |
| UI元素（每客户端） | 200 - 500 |
| 特效粒子 | 5,000 - 20,000（峰值） |
| 掉落物品 | 500 - 2,000 |
| **总计** | **30,000 - 120,000** |

### 组件类型总数

- 约 **70+ 种组件**
- 约 **50+ 种实体原型**
- 约 **60+ 个系统**

### 资源数据库规模

| 数据库 | 条目数量 |
|-------|---------|
| 技能数据库 | 500 - 1,000 |
| 物品数据库 | 5,000 - 10,000 |
| 怪物数据库 | 1,000 - 3,000 |
| NPC数据库 | 500 - 2,000 |
| 任务数据库 | 1,000 - 5,000 |
| 地图数据库 | 200 - 500 |
| Buff数据库 | 300 - 800 |

---

*本文档为梦幻西游ECS架构设计蓝图，具体实现时可根据实际需求调整。*

