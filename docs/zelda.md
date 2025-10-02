# 塞尔达传说 - ECS游戏架构设计

> 基于OllO引擎的塞尔达风格开放世界游戏完整ECS架构

---

## 一、组件（Components）

组件是纯数据容器，描述实体的各种属性。

### 1.1 核心组件

#### Transform（变换组件）
- **功能**：描述实体在世界空间中的位置、旋转和缩放
- **数据类型**：
  - `position: Vec3` (f32 x 3) - 世界坐标
  - `rotation: Quat` (f32 x 4) - 四元数旋转
  - `scale: Vec3` (f32 x 3) - 缩放比例

#### GlobalTransform（全局变换组件）
- **功能**：缓存实体的世界空间最终变换矩阵
- **数据类型**：
  - `matrix: Mat4` (f32 x 16) - 4x4变换矩阵

#### Velocity（速度组件）
- **功能**：描述实体的线性和角速度
- **数据类型**：
  - `linear: Vec3` (f32 x 3) - 线性速度 m/s
  - `angular: Vec3` (f32 x 3) - 角速度 rad/s

#### Acceleration（加速度组件）
- **功能**：描述实体受到的加速度（重力、风力等）
- **数据类型**：
  - `value: Vec3` (f32 x 3) - 加速度 m/s²

### 1.2 渲染组件

#### MeshRenderer（网格渲染器）
- **功能**：渲染3D模型
- **数据类型**：
  - `meshId: u32` - 网格资源ID
  - `materialIds: Array<u32>` - 材质资源ID数组
  - `castShadow: bool` - 是否投射阴影
  - `receiveShadow: bool` - 是否接收阴影

#### SkinnedMeshRenderer（蒙皮网格渲染器）
- **功能**：渲染带骨骼动画的模型
- **数据类型**：
  - `meshId: u32` - 蒙皮网格ID
  - `materialIds: Array<u32>` - 材质ID数组
  - `boneMatrices: Array<Mat4>` - 骨骼变换矩阵（最多256块骨骼）
  - `rootBone: u32` - 根骨骼索引

#### SpriteRenderer（精灵渲染器）
- **功能**：渲染2D精灵（UI、特效等）
- **数据类型**：
  - `textureId: u32` - 纹理资源ID
  - `uvRect: Vec4` (f32 x 4) - UV矩形 (x, y, width, height)
  - `color: Vec4` (f32 x 4) - 颜色调制 RGBA
  - `size: Vec2` (f32 x 2) - 精灵尺寸

#### ParticleEmitter（粒子发射器）
- **功能**：发射和管理粒子效果
- **数据类型**：
  - `maxParticles: u32` - 最大粒子数
  - `emissionRate: f32` - 每秒发射数量
  - `lifetime: f32` - 粒子生命周期（秒）
  - `startColor: Vec4` - 起始颜色
  - `endColor: Vec4` - 结束颜色
  - `startSize: f32` - 起始大小
  - `endSize: f32` - 结束大小
  - `velocity: Vec3` - 初始速度
  - `spread: f32` - 扩散角度（弧度）
  - `textureId: u32` - 粒子纹理ID

#### Light（光源组件）
- **功能**：定义场景光源
- **数据类型**：
  - `lightType: u8` - 光源类型 (0=方向光, 1=点光源, 2=聚光灯)
  - `color: Vec3` (f32 x 3) - RGB颜色
  - `intensity: f32` - 光照强度
  - `range: f32` - 影响范围（点光源/聚光灯）
  - `innerAngle: f32` - 内锥角（聚光灯）
  - `outerAngle: f32` - 外锥角（聚光灯）
  - `castShadow: bool` - 是否投射阴影

#### Camera（相机组件）
- **功能**：定义视角和投影
- **数据类型**：
  - `fov: f32` - 视场角（弧度）
  - `aspect: f32` - 宽高比
  - `near: f32` - 近裁剪面
  - `far: f32` - 远裁剪面
  - `viewMatrix: Mat4` - 视图矩阵
  - `projectionMatrix: Mat4` - 投影矩阵

### 1.3 物理组件

#### RigidBody（刚体组件）
- **功能**：物理模拟的基础
- **数据类型**：
  - `bodyType: u8` - 类型 (0=静态, 1=动态, 2=运动学)
  - `mass: f32` - 质量（kg）
  - `drag: f32` - 线性阻尼
  - `angularDrag: f32` - 角阻尼
  - `useGravity: bool` - 是否受重力影响
  - `isKinematic: bool` - 是否为运动学刚体

#### Collider（碰撞体组件）
- **功能**：定义碰撞检测的形状
- **数据类型**：
  - `shapeType: u8` - 形状类型 (0=球体, 1=盒体, 2=胶囊, 3=网格)
  - `center: Vec3` - 中心偏移
  - `size: Vec3` - 尺寸参数
  - `radius: f32` - 半径（球体/胶囊）
  - `height: f32` - 高度（胶囊）
  - `isTrigger: bool` - 是否为触发器
  - `physicsMaterial: u32` - 物理材质ID

#### CharacterController（角色控制器）
- **功能**：角色专用的物理控制
- **数据类型**：
  - `radius: f32` - 胶囊半径
  - `height: f32` - 胶囊高度
  - `stepOffset: f32` - 可跨越台阶高度
  - `slopeLimit: f32` - 可攀爬坡度角度
  - `skinWidth: f32` - 皮肤厚度
  - `isGrounded: bool` - 是否在地面上
  - `groundNormal: Vec3` - 地面法线

#### Climbable（可攀爬组件）
- **功能**：标记可攀爬的表面
- **数据类型**：
  - `climbSpeed: f32` - 攀爬速度倍率
  - `allowJumpOff: bool` - 是否允许跳离

### 1.4 游戏逻辑组件

#### Health（生命值组件）
- **功能**：管理实体的生命值
- **数据类型**：
  - `current: f32` - 当前生命值
  - `max: f32` - 最大生命值
  - `regenerationRate: f32` - 每秒恢复速度
  - `isInvincible: bool` - 是否无敌

#### Stamina（耐力组件）
- **功能**：管理角色的耐力系统
- **数据类型**：
  - `current: f32` - 当前耐力
  - `max: f32` - 最大耐力
  - `recoveryRate: f32` - 每秒恢复速度
  - `isExhausted: bool` - 是否精疲力竭

#### Temperature（温度组件）
- **功能**：模拟环境温度影响
- **数据类型**：
  - `current: f32` - 当前体温（摄氏度）
  - `comfort: f32` - 舒适温度
  - `resistance: f32` - 温度抗性（-1到1，负为抗寒，正为抗热）
  - `damageRate: f32` - 极端温度伤害速率

#### Inventory（背包组件）
- **功能**：管理物品存储
- **数据类型**：
  - `slots: Array<ItemSlot>` - 物品槽数组
  - `capacity: u32` - 最大容量
  - `rupees: u32` - 卢比（货币）

#### ItemSlot（物品槽数据）
- **数据类型**：
  - `itemId: u32` - 物品ID
  - `count: u32` - 数量
  - `durability: f32` - 耐久度（0-1）

#### Equipment（装备组件）
- **功能**：管理角色穿戴的装备
- **数据类型**：
  - `weaponSlots: Array<u32>` - 武器槽（最多3个）
  - `shieldSlot: u32` - 盾牌槽
  - `bowSlot: u32` - 弓箭槽
  - `armorHead: u32` - 头部护甲
  - `armorChest: u32` - 胸部护甲
  - `armorLegs: u32` - 腿部护甲
  - `currentWeaponIndex: u8` - 当前武器索引

#### Weapon（武器组件）
- **功能**：定义武器属性
- **数据类型**：
  - `weaponType: u8` - 武器类型 (0=单手剑, 1=双手剑, 2=长矛, 3=斧头, 4=棒子)
  - `damage: f32` - 基础伤害
  - `durability: f32` - 当前耐久度
  - `maxDurability: f32` - 最大耐久度
  - `attackSpeed: f32` - 攻击速度
  - `range: f32` - 攻击范围
  - `criticalRate: f32` - 暴击率
  - `isThrowable: bool` - 是否可投掷

#### Shield（盾牌组件）
- **功能**：定义盾牌属性
- **数据类型**：
  - `defense: f32` - 防御力
  - `durability: f32` - 当前耐久度
  - `maxDurability: f32` - 最大耐久度
  - `canParry: bool` - 是否可格挡反击
  - `canSurf: bool` - 是否可盾滑

#### Bow（弓箭组件）
- **功能**：定义弓箭属性
- **数据类型**：
  - `damage: f32` - 基础伤害
  - `range: f32` - 射程
  - `durability: f32` - 当前耐久度
  - `maxDurability: f32` - 最大耐久度
  - `drawTime: f32` - 拉弓时间
  - `multiShot: u8` - 连射数量

#### Arrow（箭矢组件）
- **功能**：定义箭矢属性
- **数据类型**：
  - `arrowType: u8` - 箭矢类型 (0=普通, 1=火, 2=冰, 3=电, 4=炸弹, 5=古代)
  - `damage: f32` - 伤害
  - `speed: f32` - 飞行速度
  - `gravity: f32` - 重力影响系数

#### CombatState（战斗状态组件）
- **功能**：管理战斗状态机
- **数据类型**：
  - `state: u8` - 当前状态 (0=空闲, 1=攻击, 2=格挡, 3=闪避, 4=受击, 5=死亡)
  - `combo: u8` - 连击计数
  - `attackCooldown: f32` - 攻击冷却时间
  - `lastAttackTime: f64` - 上次攻击时间戳
  - `isBlocking: bool` - 是否正在格挡
  - `dodgeDirection: Vec3` - 闪避方向

### 1.5 AI组件

#### AIController（AI控制器）
- **功能**：AI决策的总控制器
- **数据类型**：
  - `behaviorTree: u32` - 行为树资源ID
  - `currentNode: u32` - 当前执行节点
  - `blackboard: u32` - 黑板数据索引
  - `updateInterval: f32` - 更新间隔（秒）
  - `lastUpdateTime: f64` - 上次更新时间

#### NavAgent（导航代理）
- **功能**：寻路和移动
- **数据类型**：
  - `destination: Vec3` - 目标位置
  - `speed: f32` - 移动速度
  - `acceleration: f32` - 加速度
  - `stoppingDistance: f32` - 停止距离
  - `avoidanceRadius: f32` - 避障半径
  - `pathIndex: u32` - 当前路径点索引
  - `hasPath: bool` - 是否有有效路径

#### Perception（感知组件）
- **功能**：感知周围环境
- **数据类型**：
  - `sightRange: f32` - 视野范围
  - `sightAngle: f32` - 视野角度（弧度）
  - `hearingRange: f32` - 听觉范围
  - `detectedEntities: Array<u32>` - 检测到的实体列表
  - `targetEntity: u32` - 当前目标实体
  - `alertLevel: f32` - 警戒等级 (0-1)

#### EnemyType（敌人类型组件）
- **功能**：定义敌人的种类和行为特性
- **数据类型**：
  - `enemyClass: u8` - 敌人类别 (0=波克布林, 1=莫力布林, 2=蜥蜴战士, 3=守护者, 4=人马, 5=魔像, 6=Boss)
  - `rank: u8` - 等级 (0=红色, 1=蓝色, 2=黑色, 3=银色, 4=金色)
  - `aggroRange: f32` - 仇恨范围
  - `patrolRadius: f32` - 巡逻半径
  - `combatStyle: u8` - 战斗风格 (0=近战, 1=远程, 2=魔法)

### 1.6 环境交互组件

#### Pickupable（可拾取组件）
- **功能**：标记可拾取的物品
- **数据类型**：
  - `itemId: u32` - 物品ID
  - `count: u32` - 数量
  - `autoPickup: bool` - 是否自动拾取
  - `pickupRadius: f32` - 拾取范围

#### Destructible（可破坏组件）
- **功能**：可被破坏的对象
- **数据类型**：
  - `health: f32` - 耐久度
  - `destroyedMeshId: u32` - 破坏后的网格ID
  - `lootTable: u32` - 掉落表ID
  - `explosionForce: f32` - 爆炸力
  - `fragments: Array<u32>` - 碎片实体ID

#### Cookable（可烹饪组件）
- **功能**：可被烹饪的食材
- **数据类型**：
  - `rawItemId: u32` - 生食材ID
  - `cookedItemId: u32` - 熟食材ID
  - `burntItemId: u32` - 焦糊食材ID
  - `cookTime: f32` - 烹饪时间（秒）
  - `burnTime: f32` - 烧焦时间（秒）
  - `currentCookTime: f32` - 当前烹饪时间

#### Burnable（可燃烧组件）
- **功能**：可被点燃的对象
- **数据类型**：
  - `ignitionPoint: f32` - 着火点温度（摄氏度）
  - `burnDuration: f32` - 燃烧持续时间
  - `isBurning: bool` - 是否正在燃烧
  - `burnStartTime: f64` - 燃烧开始时间
  - `spreadRadius: f32` - 火焰传播范围

#### Freezable（可冰冻组件）
- **功能**：可被冰冻的对象
- **数据类型**：
  - `freezePoint: f32` - 冰冻温度（摄氏度）
  - `freezeDuration: f32` - 冰冻持续时间
  - `isFrozen: bool` - 是否冰冻
  - `freezeStartTime: f64` - 冰冻开始时间

#### Magnesis（磁力组件）
- **功能**：标记可被磁力吸引的金属物体
- **数据类型**：
  - `isMagnetic: bool` - 是否可被磁力吸引
  - `weight: f32` - 重量（影响吸引速度）

#### Stasis（静止组件）
- **功能**：静止术状态
- **数据类型**：
  - `isStasisActive: bool` - 是否处于静止状态
  - `stasisDuration: f32` - 静止持续时间
  - `accumulatedForce: Vec3` - 累积的力
  - `hitCount: u32` - 被击打次数

### 1.7 元素系统组件

#### ElementalEffect（元素效果组件）
- **功能**：管理实体的元素状态
- **数据类型**：
  - `activeElement: u8` - 当前元素 (0=无, 1=火, 2=冰, 3=电)
  - `elementDuration: f32` - 元素持续时间
  - `elementStrength: f32` - 元素强度
  - `elementStartTime: f64` - 元素开始时间

#### Flammable（易燃组件）
- **功能**：火焰伤害和传播
- **数据类型**：
  - `damagePerSecond: f32` - 每秒火焰伤害
  - `canSpreadFire: bool` - 是否可传播火焰

#### Conductive（导电组件）
- **功能**：电击效果和传导
- **数据类型**：
  - `conductivity: f32` - 导电性 (0-1)
  - `shockDamage: f32` - 电击伤害
  - `chainRadius: f32` - 连锁范围

### 1.8 天气与时间组件

#### WeatherAffected（天气影响组件）
- **功能**：受天气影响的实体
- **数据类型**：
  - `wetness: f32` - 湿度 (0-1)
  - `slipperiness: f32` - 湿滑度（影响攀爬）
  - `conductivity: f32` - 导电性（雨天增加）

#### TimeDependent（时间依赖组件）
- **功能**：根据游戏时间改变行为
- **数据类型**：
  - `activeStartHour: f32` - 激活开始时间 (0-24)
  - `activeEndHour: f32` - 激活结束时间 (0-24)
  - `isNocturnal: bool` - 是否夜行性

### 1.9 载具组件

#### Rideable（可骑乘组件）
- **功能**：马匹等可骑乘对象
- **数据类型**：
  - `rider: u32` - 骑手实体ID (0表示无骑手)
  - `maxSpeed: f32` - 最大速度
  - `acceleration: f32` - 加速度
  - `handling: f32` - 操控性 (0-1)
  - `stamina: f32` - 载具耐力
  - `bond: f32` - 羁绊值 (0-1)

#### Paraglider（滑翔伞组件）
- **功能**：滑翔机制
- **数据类型**：
  - `isGliding: bool` - 是否正在滑翔
  - `glideRatio: f32` - 滑翔比（水平/垂直距离）
  - `minSpeed: f32` - 最小速度
  - `staminaCost: f32` - 每秒耐力消耗

### 1.10 任务与剧情组件

#### QuestGiver（任务发布者）
- **功能**：标记NPC可提供任务
- **数据类型**：
  - `questIds: Array<u32>` - 可提供的任务ID列表
  - `currentQuestId: u32` - 当前任务ID
  - `hasActiveQuest: bool` - 是否有激活的任务

#### QuestMarker（任务标记）
- **功能**：标记任务目标位置
- **数据类型**：
  - `questId: u32` - 关联的任务ID
  - `markerType: u8` - 标记类型 (0=主线, 1=支线, 2=神庙, 3=记忆)
  - `iconId: u32` - 图标资源ID
  - `isActive: bool` - 是否激活

#### DialogTrigger（对话触发器）
- **功能**：触发对话
- **数据类型**：
  - `dialogId: u32` - 对话资源ID
  - `triggerRadius: f32` - 触发范围
  - `canRepeat: bool` - 是否可重复触发
  - `hasTriggered: bool` - 是否已触发

### 1.11 音频组件

#### AudioSource（音频源）
- **功能**：播放3D/2D音频
- **数据类型**：
  - `audioClipId: u32` - 音频片段ID
  - `volume: f32` - 音量 (0-1)
  - `pitch: f32` - 音调 (0.5-2.0)
  - `is3D: bool` - 是否为3D音频
  - `minDistance: f32` - 最小距离
  - `maxDistance: f32` - 最大距离
  - `loop: bool` - 是否循环
  - `isPlaying: bool` - 是否正在播放

#### AudioListener（音频监听器）
- **功能**：接收音频（通常挂载在相机上）
- **数据类型**：
  - `isPrimary: bool` - 是否为主监听器

### 1.12 UI组件

#### UIElement（UI元素）
- **功能**：基础UI元素
- **数据类型**：
  - `anchorMin: Vec2` - 锚点最小值 (0-1)
  - `anchorMax: Vec2` - 锚点最大值 (0-1)
  - `pivot: Vec2` - 轴心点 (0-1)
  - `sizeDelta: Vec2` - 尺寸偏移
  - `anchoredPosition: Vec2` - 锚定位置
  - `layer: u32` - 层级

#### UIText（UI文本）
- **功能**：显示文本
- **数据类型**：
  - `text: string` - 文本内容
  - `fontId: u32` - 字体资源ID
  - `fontSize: f32` - 字体大小
  - `color: Vec4` - 文本颜色
  - `alignment: u8` - 对齐方式

#### UIButton（UI按钮）
- **功能**：交互按钮
- **数据类型**：
  - `normalColor: Vec4` - 正常颜色
  - `hoverColor: Vec4` - 悬停颜色
  - `pressedColor: Vec4` - 按下颜色
  - `onClick: u32` - 点击事件ID

### 1.13 特殊机制组件

#### SheikahSlate（希卡之石）
- **功能**：管理希卡之石的符文能力
- **数据类型**：
  - `unlockedRunes: u32` - 已解锁的符文（位掩码）
  - `activeRune: u8` - 当前激活的符文 (0=炸弹, 1=磁力, 2=静止, 3=冰柱, 4=相机)
  - `bombCooldown: f32` - 炸弹冷却时间
  - `stasisCooldown: f32` - 静止术冷却时间

#### Shrine（神庙组件）
- **功能**：神庙相关逻辑
- **数据类型**：
  - `shrineId: u32` - 神庙唯一ID
  - `isCompleted: bool` - 是否完成
  - `puzzleType: u8` - 谜题类型
  - `hasMonk: bool` - 是否有僧侣

#### Tower（塔组件）
- **功能**：希卡塔
- **数据类型**：
  - `towerId: u32` - 塔ID
  - `isActivated: bool` - 是否激活
  - `region: u8` - 区域ID
  - `mapDataId: u32` - 地图数据ID

#### Korok（呀哈哈组件）
- **功能**：呀哈哈收集点
- **数据类型**：
  - `korokId: u32` - 呀哈哈ID
  - `puzzleType: u8` - 谜题类型 (0=石头, 1=花朵, 2=射箭, 3=光圈等)
  - `isFound: bool` - 是否已找到

#### ChampionAbility（英傑能力）
- **功能**：四英傑的特殊能力
- **数据类型**：
  - `abilityType: u8` - 能力类型 (0=米法祝福, 1=力巴尔之怒, 2=达尔克尔守护, 3=乌尔波扎之怒)
  - `cooldown: f32` - 冷却时间
  - `charges: u8` - 使用次数
  - `maxCharges: u8` - 最大使用次数

---

## 二、实体（Entities / Archetypes）

实体是组件的组合。以下列出主要的Archetype及其组件配置。

### 2.1 玩家相关实体

#### Player（玩家角色 - 林克）
**组件组合**：
- Transform
- GlobalTransform
- Velocity
- Acceleration
- SkinnedMeshRenderer
- RigidBody
- CharacterController
- Collider
- Health
- Stamina
- Temperature
- Inventory
- Equipment
- CombatState
- SheikahSlate
- Paraglider
- AudioSource
- Camera（作为子实体）

**实体数量**：1

---

#### PlayerCamera（玩家相机）
**组件组合**：
- Transform
- GlobalTransform
- Camera
- AudioListener

**实体数量**：1

---

### 2.2 敌人实体

#### Bokoblin（波克布林）
**组件组合**：
- Transform
- GlobalTransform
- Velocity
- SkinnedMeshRenderer
- RigidBody
- CharacterController
- Collider
- Health
- Equipment
- Weapon
- CombatState
- AIController
- NavAgent
- Perception
- EnemyType
- ElementalEffect
- TimeDependent（夜晚睡觉）
- AudioSource

**实体数量**：500-2000（根据地图区域）

---

#### Moblin（莫力布林）
**组件组合**：
- Transform
- GlobalTransform
- Velocity
- SkinnedMeshRenderer
- RigidBody
- CharacterController
- Collider
- Health
- Equipment
- Weapon
- CombatState
- AIController
- NavAgent
- Perception
- EnemyType
- ElementalEffect
- AudioSource

**实体数量**：300-800

---

#### Lizalfos（蜥蜴战士）
**组件组合**：
- Transform
- GlobalTransform
- Velocity
- SkinnedMeshRenderer
- RigidBody
- CharacterController
- Collider
- Health
- Equipment
- Weapon
- CombatState
- AIController
- NavAgent
- Perception
- EnemyType
- ElementalEffect
- AudioSource

**实体数量**：200-600

---

#### Guardian（守护者）
**组件组合**：
- Transform
- GlobalTransform
- Velocity
- SkinnedMeshRenderer
- RigidBody
- Collider
- Health
- CombatState
- AIController
- Perception
- EnemyType
- Light（激光瞄准）
- AudioSource
- ParticleEmitter（激光特效）

**实体数量**：100-300

---

#### Lynel（人马）
**组件组合**：
- Transform
- GlobalTransform
- Velocity
- SkinnedMeshRenderer
- RigidBody
- CharacterController
- Collider
- Health
- Equipment
- Weapon
- Bow
- Shield
- CombatState
- AIController
- NavAgent
- Perception
- EnemyType
- ElementalEffect
- AudioSource

**实体数量**：30-50

---

#### Boss（Boss实体 - 加农、四神兽等）
**组件组合**：
- Transform
- GlobalTransform
- Velocity
- SkinnedMeshRenderer
- RigidBody
- Collider
- Health
- CombatState
- AIController
- EnemyType
- ElementalEffect
- AudioSource
- ParticleEmitter
- Light

**实体数量**：5-10

---

### 2.3 友方NPC

#### NPC（村民/商人/任务角色）
**组件组合**：
- Transform
- GlobalTransform
- SkinnedMeshRenderer
- Collider
- NavAgent（部分有）
- QuestGiver（部分有）
- DialogTrigger
- TimeDependent
- AudioSource

**实体数量**：200-400

---

#### Horse（马匹）
**组件组合**：
- Transform
- GlobalTransform
- Velocity
- SkinnedMeshRenderer
- RigidBody
- CharacterController
- Collider
- Health
- Stamina
- Rideable
- AIController
- NavAgent
- AudioSource

**实体数量**：50-100

---

### 2.4 物品与道具实体

#### WeaponPickup（武器掉落物）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Collider
- Weapon
- Pickupable
- RigidBody（动态，可被击飞）

**实体数量**：500-2000

---

#### ConsumableItem（消耗品 - 食物/药水/材料）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Collider
- Pickupable
- Cookable（食材类）
- RigidBody

**实体数量**：1000-5000

---

#### Rupee（卢比）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Collider
- Pickupable
- AudioSource（拾取音效）

**实体数量**：500-2000

---

#### Chest（宝箱）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Collider
- Destructible（部分可破坏）
- AudioSource

**实体数量**：300-800

---

### 2.5 环境实体

#### Tree（树木）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Collider
- RigidBody（静态）
- Destructible
- Burnable
- Climbable

**实体数量**：5000-20000

---

#### Rock（岩石）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Collider
- RigidBody
- Destructible
- Pickupable（部分小石头）

**实体数量**：3000-10000

---

#### Grass（草丛）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Burnable
- Destructible

**实体数量**：50000-200000（使用实例化渲染）

---

#### Water（水体）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Collider（触发器）
- WeatherAffected

**实体数量**：100-500（分区域）

---

#### Campfire（营火）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Collider
- Light
- ParticleEmitter
- Burnable
- Cookable（可烹饪点）
- AudioSource

**实体数量**：200-500

---

#### CookingPot（烹饪锅）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Collider
- Cookable

**实体数量**：50-150

---

#### MetalBox（金属箱）
**组件组合**：
- Transform
- GlobalTransorform
- MeshRenderer
- Collider
- RigidBody
- Destructible
- Magnesis
- Conductive

**实体数量**：500-1000

---

### 2.6 神庙与塔

#### ShrineEntrance（神庙入口）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Collider
- Light
- ParticleEmitter
- Shrine
- AudioSource
- QuestMarker

**实体数量**：120

---

#### SheikahTower（希卡塔）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Collider
- Climbable
- Tower
- Light
- ParticleEmitter
- AudioSource
- QuestMarker

**实体数量**：15

---

### 2.7 武器与装备实体（装备状态）

#### Sword（剑）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Weapon

**实体数量**：2000-5000

---

#### Spear（长矛）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Weapon

**实体数量**：1000-3000

---

#### Bow（弓）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Bow

**实体数量**：500-1500

---

#### Shield（盾牌）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Shield

**实体数量**：1000-2000

---

### 2.8 粒子与特效实体

#### FireEffect（火焰特效）
**组件组合**：
- Transform
- ParticleEmitter
- Light

**实体数量**：100-500

---

#### IceEffect（冰霜特效）
**组件组合**：
- Transform
- ParticleEmitter
- Light

**实体数量**：100-300

---

#### ElectricEffect（电击特效）
**组件组合**：
- Transform
- ParticleEmitter
- Light

**实体数量**：100-300

---

#### ExplosionEffect（爆炸特效）
**组件组合**：
- Transform
- ParticleEmitter
- Light
- AudioSource

**实体数量**：50-200

---

### 2.9 投射物实体

#### Arrow（飞行中的箭矢）
**组件组合**：
- Transform
- GlobalTransform
- Velocity
- MeshRenderer
- Collider
- Arrow
- RigidBody
- ElementalEffect（元素箭）
- TrailRenderer（拖尾）

**实体数量**：50-200

---

#### ThrownWeapon（投掷的武器）
**组件组合**：
- Transform
- GlobalTransform
- Velocity
- MeshRenderer
- Collider
- Weapon
- RigidBody
- AudioSource

**实体数量**：20-100

---

#### Bomb（炸弹）
**组件组合**：
- Transform
- GlobalTransform
- Velocity
- MeshRenderer
- Collider
- RigidBody
- Destructible
- ParticleEmitter
- AudioSource

**实体数量**：10-50

---

### 2.10 UI实体

#### HealthBar（生命条UI）
**组件组合**：
- UIElement
- SpriteRenderer

**实体数量**：1

---

#### StaminaWheel（耐力轮UI）
**组件组合**：
- UIElement
- SpriteRenderer

**实体数量**：1

---

#### Minimap（小地图UI）
**组件组合**：
- UIElement
- SpriteRenderer
- Camera（小地图相机）

**实体数量**：1

---

#### InventoryUI（背包UI）
**组件组合**：
- UIElement
- UIText
- SpriteRenderer

**实体数量**：1（包含多个子元素）

---

### 2.11 呀哈哈与收集品

#### KorokSeed（呀哈哈）
**组件组合**：
- Transform
- GlobalTransform
- MeshRenderer
- Collider
- Korok
- ParticleEmitter
- AudioSource

**实体数量**：900

---

#### MemoryLocation（记忆地点）
**组件组合**：
- Transform
- GlobalTransform
- QuestMarker
- ParticleEmitter

**实体数量**：18

---

---

## 三、系统（Systems）

系统处理具有特定组件组合的实体，执行游戏逻辑。

### 3.1 核心系统

#### TransformSystem（变换系统）
- **功能**：计算实体的世界变换矩阵，处理父子层级关系
- **逻辑类型**：计算密集型，数据并行
- **查询组件**：Transform, GlobalTransform（写）
- **执行阶段**：PreUpdate
- **并行策略**：完全并行（无依赖）

---

#### PhysicsSystem（物理系统）
- **功能**：物理模拟、碰撞检测与响应、重力应用
- **逻辑类型**：计算密集型，部分并行
- **查询组件**：RigidBody（读写）, Collider（读）, Transform（读写）, Velocity（读写）, Acceleration（读）
- **执行阶段**：FixedUpdate
- **并行策略**：宽相并行，窄相串行

---

#### CharacterControllerSystem（角色控制器系统）
- **功能**：专门处理角色移动、碰撞、地面检测
- **逻辑类型**：逻辑密集型
- **查询组件**：CharacterController（读写）, Transform（读写）, Velocity（读）
- **执行阶段**：FixedUpdate（在PhysicsSystem之后）
- **并行策略**：完全并行

---

### 3.2 输入与控制系统

#### PlayerInputSystem（玩家输入系统）
- **功能**：读取玩家输入（键盘、手柄），转换为游戏指令
- **逻辑类型**：IO绑定
- **查询组件**：Player标记组件
- **执行阶段**：PreUpdate（最早）
- **并行策略**：单线程（主线程）

---

#### PlayerMovementSystem（玩家移动系统）
- **功能**：处理玩家移动、跳跃、攀爬、游泳、滑翔
- **逻辑类型**：逻辑密集型
- **查询组件**：Player, Transform（读写）, Velocity（读写）, CharacterController（读）, Stamina（读写）, Paraglider（读写）
- **执行阶段**：Update
- **并行策略**：单线程（仅一个玩家实体）

---

#### PlayerCombatSystem（玩家战斗系统）
- **功能**：处理玩家攻击、格挡、闪避、武器切换
- **逻辑类型**：逻辑密集型
- **查询组件**：Player, CombatState（读写）, Equipment（读）, Stamina（读写）
- **执行阶段**：Update
- **并行策略**：单线程

---

#### CameraControlSystem（相机控制系统）
- **功能**：跟随玩家、处理相机旋转、缩放、碰撞避让
- **逻辑类型**：逻辑密集型
- **查询组件**：Camera（读写）, Transform（读写），Player Transform（读）
- **执行阶段**：LateUpdate
- **并行策略**：单线程

---

### 3.3 AI系统

#### AIDecisionSystem（AI决策系统）
- **功能**：执行行为树，做出AI决策
- **逻辑类型**：逻辑密集型
- **查询组件**：AIController（读写）, Perception（读）
- **执行阶段**：Update
- **并行策略**：完全并行（按实体）

---

#### NavigationSystem（寻路系统）
- **功能**：计算路径，更新导航代理
- **逻辑类型**：计算密集型
- **查询组件**：NavAgent（读写）, Transform（读）
- **执行阶段**：Update
- **并行策略**：任务并行（批量路径计算）

---

#### PerceptionSystem（感知系统）
- **功能**：检测视野、听觉范围内的实体
- **逻辑类型**：计算密集型
- **查询组件**：Perception（读写）, Transform（读）
- **执行阶段**：Update
- **并行策略**：空间分区并行

---

#### EnemyBehaviorSystem（敌人行为系统）
- **功能**：执行敌人的战斗、巡逻、追击逻辑
- **逻辑类型**：逻辑密集型
- **查询组件**：EnemyType（读）, AIController（读）, CombatState（读写）, Transform（读写）, Velocity（读写）
- **执行阶段**：Update
- **并行策略**：完全并行

---

### 3.4 战斗系统

#### CombatSystem（战斗系统）
- **功能**：处理伤害计算、命中检测、格挡判定
- **逻辑类型**：逻辑密集型
- **查询组件**：CombatState（读）, Weapon（读）, Health（读写）, Transform（读）
- **执行阶段**：Update
- **并行策略**：部分并行（伤害事件队列）

---

#### DamageSystem（伤害系统）
- **功能**：应用伤害、处理死亡、掉落物生成
- **逻辑类型**：逻辑密集型
- **查询组件**：Health（读写）, Destructible（读）
- **执行阶段**：Update
- **并行策略**：完全并行

---

#### WeaponDurabilitySystem（武器耐久系统）
- **功能**：消耗武器耐久度，处理武器损坏
- **逻辑类型**：逻辑密集型
- **查询组件**：Weapon（读写）, Shield（读写）, Bow（读写）
- **执行阶段**：Update
- **并行策略**：完全并行

---

### 3.5 物理交互系统

#### PickupSystem（拾取系统）
- **功能**：处理物品拾取、添加到背包
- **逻辑类型**：逻辑密集型
- **查询组件**：Pickupable（读）, Transform（读）, Player Inventory（读写）
- **执行阶段**：Update
- **并行策略**：单线程（背包互斥访问）

---

#### ClimbingSystem（攀爬系统）
- **功能**：处理角色攀爬逻辑、耐力消耗、滑落
- **逻辑类型**：逻辑密集型
- **查询组件**：CharacterController（读写）, Climbable（读）, Stamina（读写）, Transform（读写）
- **执行阶段**：Update
- **并行策略**：完全并行

---

#### RideSystem（骑乘系统）
- **功能**：处理骑乘马匹的控制、上下马
- **逻辑类型**：逻辑密集型
- **查询组件**：Rideable（读写）, Player, Transform（读写）, Velocity（读写）
- **执行阶段**：Update
- **并行策略**：单线程（玩家操作）

---

#### GlideSystem（滑翔系统）
- **功能**：处理滑翔伞物理、耐力消耗
- **逻辑类型**：逻辑密集型
- **查询组件**：Paraglider（读写）, Velocity（读写）, Stamina（读写）
- **执行阶段**：Update
- **并行策略**：单线程（玩家）

---

### 3.6 希卡之石系统

#### SheikahSlateSystem（希卡之石主系统）
- **功能**：管理符文切换、冷却时间
- **逻辑类型**：逻辑密集型
- **查询组件**：SheikahSlate（读写）, Player
- **执行阶段**：Update
- **并行策略**：单线程

---

#### BombRuneSystem（炸弹符文系统）
- **功能**：生成炸弹、引爆炸弹
- **逻辑类型**：逻辑密集型
- **查询组件**：SheikahSlate（读）, Bomb实体（读写）
- **执行阶段**：Update
- **并行策略**：单线程

---

#### MagnesisSystem（磁力符文系统）
- **功能**：吸引和移动金属物体
- **逻辑类型**：物理密集型
- **查询组件**：Magnesis（读）, RigidBody（读写）, Transform（读写）
- **执行阶段**：Update
- **并行策略**：单线程（玩家控制）

---

#### StasisSystem（静止符文系统）
- **功能**：冻结物体、累积动能、释放
- **逻辑类型**：物理密集型
- **查询组件**：Stasis（读写）, RigidBody（读写）, Velocity（读写）
- **执行阶段**：Update
- **并行策略**：部分并行

---

#### CryonisSystem（冰柱符文系统）
- **功能**：在水面生成冰柱
- **逻辑类型**：逻辑密集型
- **查询组件**：Water（读）, 生成Ice Pillar实体
- **执行阶段**：Update
- **并行策略**：单线程

---

### 3.7 元素系统

#### ElementalInteractionSystem（元素交互系统）
- **功能**：处理火、冰、电元素的应用和交互
- **逻辑类型**：逻辑密集型
- **查询组件**：ElementalEffect（读写）, Burnable（读写）, Freezable（读写）, Conductive（读写）
- **执行阶段**：Update
- **并行策略**：完全并行

---

#### FireSpreadSystem（火焰传播系统）
- **功能**：火焰在可燃物间传播
- **逻辑类型**：空间查询密集
- **查询组件**：Burnable（读写）, Transform（读）
- **执行阶段**：Update
- **并行策略**：空间分区并行

---

#### ElectricChainSystem（电击连锁系统）
- **功能**：电击在导体间传导
- **逻辑类型**：图遍历
- **查询组件**：Conductive（读写）, ElementalEffect（读写）, Transform（读）
- **执行阶段**：Update
- **并行策略**：部分并行（连锁分组）

---

### 3.8 环境系统

#### WeatherSystem（天气系统）
- **功能**：管理天气变化、雨雪效果、温度
- **逻辑类型**：全局状态管理
- **查询组件**：WeatherAffected（读写）, Temperature（读写）
- **执行阶段**：Update
- **并行策略**：广播并行（天气状态读取并行，写入串行）

---

#### TimeSystem（时间系统）
- **功能**：管理游戏时间、昼夜循环
- **逻辑类型**：全局状态管理
- **查询组件**：TimeDependent（读）, Light（读写）
- **执行阶段**：Update
- **并行策略**：广播并行

---

#### TemperatureSystem（温度系统）
- **功能**：根据环境、装备计算体温，应用温度伤害
- **逻辑类型**：计算密集型
- **查询组件**：Temperature（读写）, Health（读写）, Equipment（读）
- **执行阶段**：Update
- **并行策略**：完全并行

---

### 3.9 烹饪与合成系统

#### CookingSystem（烹饪系统）
- **功能**：处理烹饪逻辑、食材组合、效果计算
- **逻辑类型**：逻辑密集型
- **查询组件**：Cookable（读写）, Inventory（读写）
- **执行阶段**：Update
- **并行策略**：单线程（玩家交互）

---

### 3.10 任务与剧情系统

#### QuestSystem（任务系统）
- **功能**：管理任务进度、触发、完成
- **逻辑类型**：状态机
- **查询组件**：QuestGiver（读写）, QuestMarker（读写）
- **执行阶段**：Update
- **并行策略**：单线程（全局任务状态）

---

#### DialogSystem（对话系统）
- **功能**：处理对话触发、显示、选择
- **逻辑类型**：UI交互
- **查询组件**：DialogTrigger（读写）, Player
- **执行阶段**：Update
- **并行策略**：单线程

---

### 3.11 渲染系统

#### MeshRenderingSystem（网格渲染系统）
- **功能**：提交静态网格到渲染队列
- **逻辑类型**：渲染命令生成
- **查询组件**：MeshRenderer（读）, GlobalTransform（读）
- **执行阶段**：Render
- **并行策略**：完全并行（无锁命令缓冲）

---

#### SkinnedMeshRenderingSystem（蒙皮网格渲染系统）
- **功能**：计算骨骼变换，提交蒙皮网格
- **逻辑类型**：计算密集型 + 渲染命令
- **查询组件**：SkinnedMeshRenderer（读写）, GlobalTransform（读）
- **执行阶段**：Render
- **并行策略**：完全并行

---

#### ParticleRenderingSystem（粒子渲染系统）
- **功能**：更新粒子、生成渲染数据
- **逻辑类型**：计算密集型
- **查询组件**：ParticleEmitter（读写）, Transform（读）
- **执行阶段**：Render
- **并行策略**：完全并行

---

#### SpriteRenderingSystem（精灵渲染系统）
- **功能**：渲染2D精灵和UI
- **逻辑类型**：渲染命令生成
- **查询组件**：SpriteRenderer（读）, Transform（读）
- **执行阶段**：Render
- **并行策略**：完全并行

---

#### CullingSystem（剔除系统）
- **功能**：视锥剔除、遮挡剔除
- **逻辑类型**：空间查询 + 计算
- **查询组件**：GlobalTransform（读）, MeshRenderer（读）, Camera（读）
- **执行阶段**：Render（渲染前）
- **并行策略**：空间分区并行

---

#### LightingSystem（光照系统）
- **功能**：收集场景光源、计算光照贡献
- **逻辑类型**：计算密集型
- **查询组件**：Light（读）, GlobalTransform（读）
- **执行阶段**：Render
- **并行策略**：完全并行

---

#### ShadowSystem（阴影系统）
- **功能**：生成阴影贴图
- **逻辑类型**：渲染密集型
- **查询组件**：Light（读）, MeshRenderer（读）, GlobalTransform（读）
- **执行阶段**：Render（主渲染前）
- **并行策略**：按光源并行

---

### 3.12 动画系统

#### AnimationSystem（动画系统）
- **功能**：更新骨骼动画、混合动画、过渡
- **逻辑类型**：计算密集型
- **查询组件**：SkinnedMeshRenderer（读写）, AnimationController（读写）
- **执行阶段**：Update
- **并行策略**：完全并行

---

#### IKSystem（反向动力学系统）
- **功能**：计算IK（脚步适配地形、手部瞄准等）
- **逻辑类型**：计算密集型
- **查询组件**：SkinnedMeshRenderer（读写）, IK Target（读）
- **执行阶段**：LateUpdate
- **并行策略**：完全并行

---

### 3.13 音频系统

#### AudioSystem（音频系统）
- **功能**：播放3D/2D音频、音量衰减、混音
- **逻辑类型**：IO + 计算
- **查询组件**：AudioSource（读写）, AudioListener（读）, GlobalTransform（读）
- **执行阶段**：Update
- **并行策略**：部分并行（3D音效计算并行，播放命令串行）

---

### 3.14 UI系统

#### UILayoutSystem（UI布局系统）
- **功能**：计算UI元素的位置和尺寸
- **逻辑类型**：计算密集型
- **查询组件**：UIElement（读写）
- **执行阶段**：Update
- **并行策略**：层级并行（按层级深度）

---

#### UIRenderSystem（UI渲染系统）
- **功能**：渲染UI元素
- **逻辑类型**：渲染命令生成
- **查询组件**：UIElement（读）, UIText（读）, SpriteRenderer（读）
- **执行阶段**：Render（最后）
- **并行策略**：完全并行

---

#### UIInputSystem（UI输入系统）
- **功能**：处理UI交互（点击、悬停）
- **逻辑类型**：事件处理
- **查询组件**：UIButton（读写）, UIElement（读）
- **执行阶段**：Update
- **并行策略**：单线程（主线程）

---

### 3.15 保存与加载系统

#### SaveSystem（保存系统）
- **功能**：序列化游戏状态、写入存档
- **逻辑类型**：IO密集型
- **查询组件**：所有需要序列化的组件
- **执行阶段**：按需触发
- **并行策略**：异步IO（资产线程）

---

#### LoadSystem（加载系统）
- **功能**：反序列化存档、恢复游戏状态
- **逻辑类型**：IO密集型
- **查询组件**：动态创建实体和组件
- **执行阶段**：初始化阶段
- **并行策略**：异步IO（资产线程）

---

### 3.16 资源管理系统

#### ResourceLoaderSystem（资源加载系统）
- **功能**：异步加载网格、纹理、音频等资源
- **逻辑类型**：IO密集型
- **查询组件**：无（操作Resources）
- **执行阶段**：资产线程
- **并行策略**：完全并行（多个资产线程）

---

#### ResourceUnloaderSystem（资源卸载系统）
- **功能**：卸载不再使用的资源，释放内存
- **逻辑类型**：内存管理
- **查询组件**：无（操作Resources）
- **执行阶段**：LateUpdate（定期检查）
- **并行策略**：单线程（引用计数检查）

---

### 3.17 调试系统

#### DebugDrawSystem（调试绘制系统）
- **功能**：绘制碰撞体、路径、调试信息
- **逻辑类型**：渲染命令生成
- **查询组件**：Collider（读）, NavAgent（读）, Transform（读）
- **执行阶段**：Render（仅Debug模式）
- **并行策略**：完全并行

---

#### ProfilingSystem（性能分析系统）
- **功能**：收集性能数据、统计实体数量
- **逻辑类型**：统计
- **查询组件**：所有组件（统计）
- **执行阶段**：LateUpdate
- **并行策略**：部分并行

---

---

## 四、资源（Resources）

资源是全局状态和共享数据，不属于任何特定实体。

### 4.1 全局状态资源

#### GameTime（游戏时间）
- **描述**：全局游戏时间、昼夜循环
- **数据**：
  - `totalSeconds: f64` - 游戏总秒数
  - `timeOfDay: f32` - 当前时刻 (0-24小时)
  - `dayCount: u32` - 第几天
  - `timeScale: f32` - 时间流速

---

#### Weather（天气状态）
- **描述**：当前天气状态
- **数据**：
  - `weatherType: u8` - 天气类型 (0=晴, 1=多云, 2=雨, 3=雷雨, 4=雪, 5=沙尘暴)
  - `intensity: f32` - 强度 (0-1)
  - `temperature: f32` - 环境温度（摄氏度）
  - `windDirection: Vec3` - 风向
  - `windStrength: f32` - 风力
  - `nextWeatherChangeTime: f64` - 下次天气变化时间

---

#### PlayerState（玩家状态）
- **描述**：玩家全局进度
- **数据**：
  - `completedShrines: Array<u32>` - 已完成神庙列表
  - `activatedTowers: Array<u32>` - 已激活希卡塔列表
  - `foundKoroks: Array<u32>` - 已找到呀哈哈列表
  - `defeatedBosses: Array<u32>` - 已击败Boss列表
  - `completedQuests: Array<u32>` - 已完成任务列表
  - `activeQuests: Array<u32>` - 进行中任务列表
  - `unlockedRecipes: Array<u32>` - 已解锁食谱
  - `playTime: f64` - 游戏时长（秒）

---

#### InputState（输入状态）
- **描述**：当前帧的输入状态
- **数据**：
  - `moveAxis: Vec2` - 移动输入 (-1到1)
  - `lookAxis: Vec2` - 视角输入
  - `jumpPressed: bool` - 跳跃键
  - `attackPressed: bool` - 攻击键
  - `blockPressed: bool` - 格挡键
  - `interactPressed: bool` - 交互键
  - `runPressed: bool` - 奔跑键
  - `crouchPressed: bool` - 蹲下键
  - `sheikahSlatePressed: bool` - 希卡之石键

---

#### PhysicsWorld（物理世界）
- **描述**：物理模拟的全局配置
- **数据**：
  - `gravity: Vec3` - 重力加速度 (通常 [0, -9.8, 0])
  - `fixedTimeStep: f32` - 固定时间步长（秒，通常0.02）
  - `collisionLayers: Array<u32>` - 碰撞层配置

---

#### RenderSettings（渲染设置）
- **描述**：全局渲染配置
- **数据**：
  - `ambientColor: Vec3` - 环境光颜色
  - `ambientIntensity: f32` - 环境光强度
  - `fogColor: Vec3` - 雾颜色
  - `fogDensity: f32` - 雾浓度
  - `fogStart: f32` - 雾起始距离
  - `fogEnd: f32` - 雾结束距离
  - `shadowDistance: f32` - 阴影渲染距离
  - `shadowQuality: u8` - 阴影质量等级

---

### 4.2 资源数据

#### MeshLibrary（网格库）
- **描述**：所有3D网格数据
- **数据**：
  - `meshes: Map<u32, MeshData>` - 网格ID到网格数据的映射
  - `vertexBuffers: Array<GPUBuffer>` - GPU顶点缓冲
  - `indexBuffers: Array<GPUBuffer>` - GPU索引缓冲

---

#### TextureLibrary（纹理库）
- **描述**：所有纹理数据
- **数据**：
  - `textures: Map<u32, TextureData>` - 纹理ID到纹理数据的映射
  - `gpuTextures: Array<GPUTexture>` - GPU纹理对象

---

#### MaterialLibrary（材质库）
- **描述**：所有材质数据
- **数据**：
  - `materials: Map<u32, MaterialData>` - 材质ID到材质数据的映射
  - `shaders: Map<u32, ShaderProgram>` - 着色器程序

---

#### AudioLibrary（音频库）
- **描述**：所有音频片段
- **数据**：
  - `audioClips: Map<u32, AudioBuffer>` - 音频ID到音频缓冲的映射
  - `musicTracks: Array<u32>` - 音乐轨道ID列表
  - `sfxClips: Array<u32>` - 音效ID列表

---

#### AnimationLibrary（动画库）
- **描述**：所有骨骼动画数据
- **数据**：
  - `animations: Map<u32, AnimationClip>` - 动画ID到动画片段的映射
  - `animationControllers: Map<u32, AnimatorController>` - 动画控制器

---

#### ItemDatabase（物品数据库）
- **描述**：所有物品的静态数据
- **数据**：
  - `items: Map<u32, ItemData>` - 物品ID到物品数据的映射
  - **ItemData结构**：
    - `name: string` - 物品名称
    - `description: string` - 描述
    - `iconId: u32` - 图标纹理ID
    - `itemType: u8` - 物品类型 (武器/食材/材料/护甲等)
    - `value: u32` - 出售价格
    - `stackable: bool` - 是否可堆叠
    - `maxStack: u32` - 最大堆叠数

---

#### RecipeDatabase（食谱数据库）
- **描述**：所有烹饪配方
- **数据**：
  - `recipes: Map<u32, RecipeData>` - 配方ID到配方数据的映射
  - **RecipeData结构**：
    - `ingredients: Array<u32>` - 所需材料ID
    - `result: u32` - 产出物品ID
    - `effects: Array<Effect>` - 附加效果（恢复生命、耐力、抗性等）

---

#### QuestDatabase（任务数据库）
- **描述**：所有任务的配置数据
- **数据**：
  - `quests: Map<u32, QuestData>` - 任务ID到任务数据的映射
  - **QuestData结构**：
    - `questName: string` - 任务名称
    - `description: string` - 任务描述
    - `questType: u8` - 任务类型 (主线/支线/神庙/记忆)
    - `objectives: Array<Objective>` - 目标列表
    - `rewards: Array<u32>` - 奖励物品ID

---

#### DialogDatabase（对话数据库）
- **描述**：所有对话文本
- **数据**：
  - `dialogs: Map<u32, DialogData>` - 对话ID到对话数据的映射
  - **DialogData结构**：
    - `speakerName: string` - 说话者
    - `lines: Array<string>` - 对话文本
    - `choices: Array<Choice>` - 对话选项（分支对话）

---

#### NavMesh（导航网格）
- **描述**：全局导航网格数据
- **数据**：
  - `navMeshData: NavMeshData` - 导航网格
  - `regions: Array<NavRegion>` - 区域划分
  - `pathCache: Map<u64, Array<Vec3>>` - 路径缓存（起点+终点哈希 -> 路径）

---

#### SpatialHash（空间哈希）
- **描述**：空间分区加速结构
- **数据**：
  - `grid: Map<u64, Array<u32>>` - 网格哈希表（网格坐标 -> 实体ID列表）
  - `cellSize: f32` - 网格大小
  - `bounds: AABB` - 世界边界

---

#### EventQueue（事件队列）
- **描述**：全局事件消息队列
- **数据**：
  - `events: Array<GameEvent>` - 事件列表
  - **GameEvent类型**：
    - `entityDied` - 实体死亡
    - `itemPickedUp` - 拾取物品
    - `questCompleted` - 任务完成
    - `shrineCompleted` - 神庙完成
    - `enemyAlerted` - 敌人警觉
    - `weaponBroke` - 武器损坏

---

#### CameraStack（相机堆栈）
- **描述**：管理多个相机的优先级
- **数据**：
  - `activeCameras: Array<u32>` - 激活的相机实体ID（按优先级）
  - `mainCamera: u32` - 主相机实体ID
  - `uiCamera: u32` - UI相机实体ID

---

#### AssetLoadQueue（资源加载队列）
- **描述**：异步资源加载任务队列
- **数据**：
  - `pendingLoads: Array<AssetLoadRequest>` - 待加载资源请求
  - `loadedAssets: Array<u32>` - 已加载资源ID

---

---

## 总结

本文档详细定义了塞尔达风格开放世界游戏的完整ECS架构，包括：

- **组件**：74个组件，涵盖渲染、物理、AI、战斗、环境交互、元素系统等
- **实体**：30+种Archetype，包括玩家、敌人、NPC、物品、环境对象、UI等，总计数量从数百到数十万不等
- **系统**：40+个系统，负责游戏逻辑、物理、渲染、AI、音频等，支持高度并行化
- **资源**：19个全局资源，管理游戏状态、资产库、事件队列、空间加速结构等

此架构设计充分利用了OllO引擎的多线程并行能力，通过精心设计的组件组合和系统依赖关系，实现了大规模开放世界的高性能模拟。

