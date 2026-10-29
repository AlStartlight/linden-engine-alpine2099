import { HEROES_LIST, HeroDef } from './HeroData'

export interface TurretUnit {
  id: string
  team: 'blue' | 'red'
  pos: { x: number; y: number; z: number }
  hp: number
  maxHp: number
  range: number
  attackCooldown: number
  target: any | null
  mesh?: any
  hpBarMesh?: any
}

export interface MinionUnit {
  id: string
  team: 'blue' | 'red'
  type: 'melee' | 'caster' | 'siege'
  lane: 'mid' | 'top' | 'bot'
  pos: { x: number; y: number; z: number }
  hp: number
  maxHp: number
  damage: number
  range: number
  speed: number
  attackCooldown: number
  waypointIdx: number
  target: any | null
  mesh?: any
  hpBarMesh?: any
}

export interface EnemyBot {
  hero: HeroDef
  pos: { x: number; y: number; z: number }
  hp: number
  maxHp: number
  mana: number
  maxMana: number
  level: number
  target: any | null
  attackCooldown: number
  skill1Cooldown: number
  skill2Cooldown: number
  skill3Cooldown: number
  mesh?: any
  hpBarMesh?: any
  state: 'lane' | 'attack' | 'retreat'
}

export interface ShopItem {
  id: string
  name: string
  icon: string
  cost: number
  bonusAtk: number
  bonusHp: number
  bonusSpeed: number
  bonusArmor: number
  description: string
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'boots',
    name: 'Swift Boots',
    icon: '👢',
    cost: 250,
    bonusAtk: 10,
    bonusHp: 150,
    bonusSpeed: 1.5,
    bonusArmor: 10,
    description: '+1.5 Kecepatan Gerak, +150 HP'
  },
  {
    id: 'blade_despair',
    name: 'Blade of Despair',
    icon: '⚔️',
    cost: 800,
    bonusAtk: 90,
    bonusHp: 200,
    bonusSpeed: 0.5,
    bonusArmor: 15,
    description: '+90 Physical Attack masif, +200 HP'
  },
  {
    id: 'bloodlust_axe',
    name: 'Bloodlust Axe',
    icon: '🪓',
    cost: 650,
    bonusAtk: 60,
    bonusHp: 300,
    bonusSpeed: 0.3,
    bonusArmor: 20,
    description: '+60 ATK, +300 HP, +20% Spell Vamp'
  },
  {
    id: 'holy_crystal',
    name: 'Holy Crystal',
    icon: '💎',
    cost: 750,
    bonusAtk: 80,
    bonusHp: 250,
    bonusSpeed: 0.2,
    bonusArmor: 10,
    description: '+80 Magic Attack, +250 HP'
  },
  {
    id: 'athena_shield',
    name: 'Athena Shield',
    icon: '🛡️',
    cost: 700,
    bonusAtk: 15,
    bonusHp: 900,
    bonusSpeed: 0,
    bonusArmor: 60,
    description: '+900 HP masif, +60 Armor Pertahanan'
  },
  {
    id: 'immortality',
    name: 'Immortality',
    icon: '👑',
    cost: 950,
    bonusAtk: 30,
    bonusHp: 1200,
    bonusSpeed: 0.5,
    bonusArmor: 50,
    description: '+1200 Max HP, Hidup kembali saat gugur'
  }
]

class MobaStateStore {
  // Active Hero & Player
  selectedHero: HeroDef = HEROES_LIST[0]
  playerLevel = 1
  playerExp = 0
  playerHp = 2800
  playerMaxHp = 2800
  playerMana = 350
  playerMaxMana = 350
  playerGold = 300
  playerKills = 0
  playerDeaths = 0
  playerAssists = 0

  // Equipment bought
  inventory: ShopItem[] = []

  // Cooldowns (in seconds remaining)
  s1Cooldown = 0
  s2Cooldown = 0
  s3Cooldown = 0
  recallCooldown = 0
  regenCooldown = 0
  flickerCooldown = 0

  // Skill levels (1-5)
  s1Level = 1
  s2Level = 0
  s3Level = 0
  skillPoints = 0

  // Buffs / status
  isRecalling = 0 // timer if recalling
  isRegening = 0
  isUltActive = 0
  isShieldActive = 0

  // Target Priority
  targetMode: 'hero' | 'minion' | 'turret' = 'hero'

  // Match Status
  blueScore = 0
  redScore = 0
  matchSeconds = 0
  gameActive = true
  gameResult: 'victory' | 'defeat' | null = null

  // Base Crystals
  blueBaseHp = 6000
  blueBaseMaxHp = 6000
  redBaseHp = 6000
  redBaseMaxHp = 6000

  // Units
  turrets: TurretUnit[] = []
  minions: MinionUnit[] = []
  enemyBot: EnemyBot | null = null

  // Virtual Joystick input vector [-1..1, -1..1]
  joystickVector = { x: 0, y: 0 }

  // Listeners
  private listeners: Array<() => void> = []

  subscribe(listener: () => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  notify() {
    for (const l of this.listeners) l()
  }

  selectHero(heroId: string) {
    const found = HEROES_LIST.find(h => h.id === heroId)
    if (found) {
      this.selectedHero = found
      this.playerMaxHp = found.baseHp
      this.playerHp = found.baseHp
      this.playerMaxMana = found.baseMana
      this.playerMana = found.baseMana
      this.s1Cooldown = 0
      this.s2Cooldown = 0
      this.s3Cooldown = 0
      this.notify()
    }
  }

  addGold(amount: number) {
    this.playerGold += amount
    this.notify()
  }

  addExp(amount: number) {
    this.playerExp += amount
    const needed = this.playerLevel * 100
    if (this.playerExp >= needed && this.playerLevel < 15) {
      this.playerExp -= needed
      this.playerLevel++
      this.skillPoints++
      this.playerMaxHp += 120
      this.playerHp = Math.min(this.playerHp + 200, this.playerMaxHp)
      this.playerMaxMana += 40
      this.playerMana = this.playerMaxMana
      this.notify()
    }
  }

  buyItem(item: ShopItem): boolean {
    if (this.playerGold >= item.cost) {
      this.playerGold -= item.cost
      this.inventory.push(item)
      this.playerMaxHp += item.bonusHp
      this.playerHp += item.bonusHp
      this.notify()
      return true
    }
    return false
  }
}

export const MobaState = new MobaStateStore()
