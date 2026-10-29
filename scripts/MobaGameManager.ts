import { MobaState, TurretUnit, MinionUnit, EnemyBot } from './MobaState'
import { HEROES_LIST } from './HeroData'

export default class MobaGameManager {
  private ctx: any
  private waveTimer = 2 // Spawns first wave 2 seconds after match start
  private botRespawnTimer = 0
  private minionIdCounter = 1
  private scene3D: any

  onInit(ctx: any) {
    this.ctx = ctx
    this.scene3D = ctx.object3D?.parent || null

    // Initialize Turrets
    this.initTurrets()

    // Initialize Enemy Bot
    this.initEnemyBot()
  }

  private initTurrets() {
    MobaState.turrets = [
      // Blue Turrets
      { id: 'turret_b_mid', team: 'blue', pos: { x: -10, y: 2, z: -10 }, hp: 3000, maxHp: 3000, range: 8.5, attackCooldown: 0, target: null },
      { id: 'turret_b_top', team: 'blue', pos: { x: -24, y: 2, z: 8 }, hp: 3000, maxHp: 3000, range: 8.5, attackCooldown: 0, target: null },
      { id: 'turret_b_bot', team: 'blue', pos: { x: 8, y: 2, z: -24 }, hp: 3000, maxHp: 3000, range: 8.5, attackCooldown: 0, target: null },

      // Red Turrets
      { id: 'turret_r_mid', team: 'red', pos: { x: 10, y: 2, z: 10 }, hp: 3000, maxHp: 3000, range: 8.5, attackCooldown: 0, target: null },
      { id: 'turret_r_top', team: 'red', pos: { x: -8, y: 2, z: 24 }, hp: 3000, maxHp: 3000, range: 8.5, attackCooldown: 0, target: null },
      { id: 'turret_r_bot', team: 'red', pos: { x: 24, y: 2, z: -8 }, hp: 3000, maxHp: 3000, range: 8.5, attackCooldown: 0, target: null }
    ]
  }

  private initEnemyBot() {
    // Pick an opponent hero (e.g. Titan or Astra)
    const opponentDef = HEROES_LIST[2] // Titan (Tank/Fighter)
    MobaState.enemyBot = {
      hero: opponentDef,
      pos: { x: 20, y: 1, z: 20 },
      hp: opponentDef.baseHp,
      maxHp: opponentDef.baseHp,
      mana: opponentDef.baseMana,
      maxMana: opponentDef.baseMana,
      level: 1,
      target: null,
      attackCooldown: 0,
      skill1Cooldown: 0,
      skill2Cooldown: 0,
      skill3Cooldown: 0,
      state: 'lane'
    }

    // Create 3D Mesh for Bot in Scene
    this.createEnemyBotMesh(opponentDef.color)
  }

  private createEnemyBotMesh(colorHex: string) {
    if (!this.scene3D) return
    const THREE = (window as any).THREE || this.ctx.three
    if (!THREE) return

    const group = new THREE.Group()

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.8, 16)
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3 })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 0.9
    group.add(body)

    // Red team indicator crown / aura
    const crownGeo = new THREE.ConeGeometry(0.3, 0.4, 8)
    const crownMat = new THREE.MeshBasicMaterial({ color: '#ef4444' })
    const crown = new THREE.Mesh(crownGeo, crownMat)
    crown.position.y = 2.1
    group.add(crown)

    group.position.set(20, 0, 20)
    this.scene3D.add(group)

    if (MobaState.enemyBot) {
      MobaState.enemyBot.mesh = group
    }
  }

  onUpdate(dt: number) {
    if (!MobaState.gameActive) return

    MobaState.matchSeconds += dt

    // Turret AI & combat
    this.updateTurrets(dt)

    // Minion Wave Spawning & AI
    this.updateMinions(dt)

    // Enemy Bot AI
    this.updateEnemyBot(dt)
  }

  private updateTurrets(dt: number) {
    for (const turret of MobaState.turrets) {
      if (turret.hp <= 0) continue
      if (turret.attackCooldown > 0) turret.attackCooldown -= dt

      if (turret.attackCooldown <= 0) {
        // Find nearest hostile target
        const target = this.findTurretTarget(turret)
        if (target) {
          turret.attackCooldown = 1.3
          this.fireTurretLaser(turret.pos, target.pos, turret.team)
          // Deal damage
          if (target.type === 'player') {
            MobaState.playerHp -= 190
            this.showFloatingText('-190 TURRET SHOT', '#ef4444')
          } else if (target.type === 'bot' && MobaState.enemyBot) {
            MobaState.enemyBot.hp -= 220
          } else if (target.type === 'minion') {
            target.unit.hp -= 250
          }
        }
      }
    }
  }

  private findTurretTarget(turret: TurretUnit): any | null {
    const isBlue = turret.team === 'blue'

    // Priority 1: Hostile minions in range
    for (const m of MobaState.minions) {
      if (m.hp > 0 && ((isBlue && m.team === 'red') || (!isBlue && m.team === 'blue'))) {
        const d = Math.hypot(m.pos.x - turret.pos.x, m.pos.z - turret.pos.z)
        if (d <= turret.range) {
          return { type: 'minion', unit: m, pos: m.pos }
        }
      }
    }

    // Priority 2: Hostile hero
    if (!isBlue) {
      // Red turret checks Player (blue)
      const pPos = this.ctx.scene.find('ent-player')?.getTransform().position
      if (pPos) {
        const d = Math.hypot(pPos.x - turret.pos.x, pPos.z - turret.pos.z)
        if (d <= turret.range) {
          return { type: 'player', pos: pPos }
        }
      }
    } else {
      // Blue turret checks Bot (red)
      if (MobaState.enemyBot && MobaState.enemyBot.hp > 0) {
        const d = Math.hypot(MobaState.enemyBot.pos.x - turret.pos.x, MobaState.enemyBot.pos.z - turret.pos.z)
        if (d <= turret.range) {
          return { type: 'bot', pos: MobaState.enemyBot.pos }
        }
      }
    }

    return null
  }

  private fireTurretLaser(fromPos: any, toPos: any, team: 'blue' | 'red') {
    if (!this.scene3D) return
    const THREE = (window as any).THREE || this.ctx.three
    if (!THREE) return

    const color = team === 'blue' ? '#38bdf8' : '#ef4444'
    const laserGeo = new THREE.SphereGeometry(0.4, 8, 8)
    const laserMat = new THREE.MeshBasicMaterial({ color })
    const laser = new THREE.Mesh(laserGeo, laserMat)
    laser.position.set(fromPos.x, fromPos.y + 2, fromPos.z)
    this.scene3D.add(laser)

    let progress = 0
    const start = { x: fromPos.x, y: fromPos.y + 2, z: fromPos.z }
    const interval = setInterval(() => {
      progress += 0.25
      laser.position.x = start.x + (toPos.x - start.x) * progress
      laser.position.y = start.y + (toPos.y + 0.8 - start.y) * progress
      laser.position.z = start.z + (toPos.z - start.z) * progress
      if (progress >= 1) {
        clearInterval(interval)
        this.scene3D.remove(laser)
      }
    }, 30)
  }

  private updateMinions(dt: number) {
    this.waveTimer -= dt
    if (this.waveTimer <= 0) {
      this.waveTimer = 22 // 22 seconds wave interval
      this.spawnMinionWave()
    }

    // Update existing minions
    for (let i = MobaState.minions.length - 1; i >= 0; i--) {
      const minion = MobaState.minions[i]
      if (minion.hp <= 0) {
        // Remove mesh from scene
        if (minion.mesh && this.scene3D) {
          this.scene3D.remove(minion.mesh)
        }
        MobaState.minions.splice(i, 1)
        continue
      }

      if (minion.attackCooldown > 0) minion.attackCooldown -= dt

      // Minion Combat / Movement
      this.stepMinionAI(minion, dt)

      // Sync 3D Mesh
      if (minion.mesh) {
        minion.mesh.position.set(minion.pos.x, 0.4, minion.pos.z)
      }
    }
  }

  private spawnMinionWave() {
    const lanes: Array<'mid' | 'top' | 'bot'> = ['mid', 'top', 'bot']

    for (const lane of lanes) {
      // Blue Minion
      this.createMinion('blue', 'melee', lane, { x: -26, y: 0.5, z: -26 })
      this.createMinion('blue', 'caster', lane, { x: -27, y: 0.5, z: -27 })

      // Red Minion
      this.createMinion('red', 'melee', lane, { x: 26, y: 0.5, z: 26 })
      this.createMinion('red', 'caster', lane, { x: 27, y: 0.5, z: 27 })
    }
  }

  private createMinion(team: 'blue' | 'red', type: 'melee' | 'caster', lane: 'mid' | 'top' | 'bot', startPos: any) {
    const id = `minion_${this.minionIdCounter++}`
    const isMelee = type === 'melee'
    const minion: MinionUnit = {
      id,
      team,
      type,
      lane,
      pos: { ...startPos },
      hp: isMelee ? 480 : 320,
      maxHp: isMelee ? 480 : 320,
      damage: isMelee ? 28 : 42,
      range: isMelee ? 1.6 : 5.5,
      speed: 3.2,
      attackCooldown: 0,
      waypointIdx: 0,
      target: null
    }

    // Create 3D Mesh
    if (this.scene3D) {
      const THREE = (window as any).THREE || this.ctx.three
      if (THREE) {
        const geo = isMelee ? new THREE.BoxGeometry(0.7, 0.7, 0.7) : new THREE.SphereGeometry(0.4, 8, 8)
        const color = team === 'blue' ? (isMelee ? '#0284c7' : '#38bdf8') : (isMelee ? '#dc2626' : '#f87171')
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(startPos.x, 0.4, startPos.z)
        this.scene3D.add(mesh)
        minion.mesh = mesh
      }
    }

    MobaState.minions.push(minion)
  }

  private stepMinionAI(minion: MinionUnit, dt: number) {
    // 1. Look for nearby enemies to attack
    const enemy = this.findNearestHostileUnit(minion.pos, minion.team, minion.range)
    if (enemy) {
      if (minion.attackCooldown <= 0) {
        minion.attackCooldown = 1.0
        // Deal damage
        if (enemy.type === 'player') {
          MobaState.playerHp -= minion.damage
        } else if (enemy.type === 'bot' && MobaState.enemyBot) {
          MobaState.enemyBot.hp -= minion.damage
        } else if (enemy.type === 'minion') {
          enemy.unit.hp -= minion.damage
        } else if (enemy.type === 'turret') {
          enemy.unit.hp -= minion.damage
        }
      }
      return
    }

    // 2. Otherwise advance down lane waypoints
    const waypoints = this.getLaneWaypoints(minion.lane, minion.team)
    if (minion.waypointIdx < waypoints.length) {
      const targetWp = waypoints[minion.waypointIdx]
      const dx = targetWp.x - minion.pos.x
      const dz = targetWp.z - minion.pos.z
      const dist = Math.hypot(dx, dz)

      if (dist < 1.5) {
        minion.waypointIdx++
      } else {
        minion.pos.x += (dx / dist) * minion.speed * dt
        minion.pos.z += (dz / dist) * minion.speed * dt
      }
    }
  }

  private getLaneWaypoints(lane: 'mid' | 'top' | 'bot', team: 'blue' | 'red') {
    if (lane === 'mid') {
      return team === 'blue'
        ? [{ x: -12, z: -12 }, { x: 0, z: 0 }, { x: 12, z: 12 }, { x: 28, z: 28 }]
        : [{ x: 12, z: 12 }, { x: 0, z: 0 }, { x: -12, z: -12 }, { x: -28, z: -28 }]
    } else if (lane === 'top') {
      return team === 'blue'
        ? [{ x: -25, z: 8 }, { x: -22, z: 22 }, { x: -8, z: 25 }, { x: 28, z: 28 }]
        : [{ x: -8, z: 25 }, { x: -22, z: 22 }, { x: -25, z: 8 }, { x: -28, z: -28 }]
    } else {
      return team === 'blue'
        ? [{ x: 8, z: -25 }, { x: 22, z: -22 }, { x: 25, z: -8 }, { x: 28, z: 28 }]
        : [{ x: 25, z: -8 }, { x: 22, z: -22 }, { x: 8, z: -25 }, { x: -28, z: -28 }]
    }
  }

  private findNearestHostileUnit(pos: any, team: 'blue' | 'red', range: number): any | null {
    const isBlue = team === 'blue'

    // Minions
    for (const m of MobaState.minions) {
      if (m.hp > 0 && ((isBlue && m.team === 'red') || (!isBlue && m.team === 'blue'))) {
        if (Math.hypot(m.pos.x - pos.x, m.pos.z - pos.z) <= range) {
          return { type: 'minion', unit: m, pos: m.pos }
        }
      }
    }

    // Heroes
    if (!isBlue) {
      const pPos = this.ctx.scene.find('ent-player')?.getTransform().position
      if (pPos && Math.hypot(pPos.x - pos.x, pPos.z - pos.z) <= range) {
        return { type: 'player', pos: pPos }
      }
    } else {
      if (MobaState.enemyBot && MobaState.enemyBot.hp > 0) {
        if (Math.hypot(MobaState.enemyBot.pos.x - pos.x, MobaState.enemyBot.pos.z - pos.z) <= range) {
          return { type: 'bot', pos: MobaState.enemyBot.pos }
        }
      }
    }

    // Turrets
    for (const t of MobaState.turrets) {
      if (t.hp > 0 && ((isBlue && t.team === 'red') || (!isBlue && t.team === 'blue'))) {
        if (Math.hypot(t.pos.x - pos.x, t.pos.z - pos.z) <= range) {
          return { type: 'turret', unit: t, pos: t.pos }
        }
      }
    }

    return null
  }

  private updateEnemyBot(dt: number) {
    const bot = MobaState.enemyBot
    if (!bot) return

    // Respawn timer check
    if (bot.hp <= 0) {
      if (bot.mesh) bot.mesh.visible = false
      this.botRespawnTimer += dt
      if (this.botRespawnTimer >= 14) {
        this.botRespawnTimer = 0
        bot.hp = bot.maxHp
        bot.pos = { x: 24, y: 1, z: 24 }
        if (bot.mesh) {
          bot.mesh.visible = true
          bot.mesh.position.set(bot.pos.x, 0, bot.pos.z)
        }
      }
      return
    }

    // Cooldown ticks
    if (bot.attackCooldown > 0) bot.attackCooldown -= dt
    if (bot.skill1Cooldown > 0) bot.skill1Cooldown -= dt

    const pPos = this.ctx.scene.find('ent-player')?.getTransform().position
    if (!pPos) return

    const distToPlayer = Math.hypot(pPos.x - bot.pos.x, pPos.z - bot.pos.z)

    // State machine
    if (bot.hp < bot.maxHp * 0.28) {
      bot.state = 'retreat'
    } else if (distToPlayer < 8.5) {
      bot.state = 'attack'
    } else {
      bot.state = 'lane'
    }

    if (bot.state === 'retreat') {
      // Run toward Red Turret Mid (10, 10)
      const dx = 10 - bot.pos.x
      const dz = 10 - bot.pos.z
      const dist = Math.hypot(dx, dz)
      if (dist > 1) {
        bot.pos.x += (dx / dist) * 5.5 * dt
        bot.pos.z += (dz / dist) * 5.5 * dt
      }
      // Heal slowly under tower
      bot.hp = Math.min(bot.maxHp, bot.hp + 60 * dt)
    } else if (bot.state === 'attack') {
      // Approach player and attack
      if (distToPlayer > bot.hero.range) {
        const dx = pPos.x - bot.pos.x
        const dz = pPos.z - bot.pos.z
        bot.pos.x += (dx / distToPlayer) * 5.2 * dt
        bot.pos.z += (dz / distToPlayer) * 5.2 * dt
      } else {
        // In attack range
        if (bot.attackCooldown <= 0) {
          bot.attackCooldown = 0.9
          MobaState.playerHp -= bot.hero.baseAtk
          this.showFloatingText(`-${bot.hero.baseAtk} MUSUH!`, '#ef4444')
        }
        // Skill 1 cast
        if (bot.skill1Cooldown <= 0) {
          bot.skill1Cooldown = bot.hero.skill1.cooldown
          MobaState.playerHp -= bot.hero.skill1.damage
          this.showFloatingText(`${bot.hero.skill1.name.toUpperCase()}!`, '#f87171')
        }
      }
    } else {
      // Push lane towards center (0, 0)
      const dx = -bot.pos.x
      const dz = -bot.pos.z
      const dist = Math.hypot(dx, dz)
      if (dist > 2) {
        bot.pos.x += (dx / dist) * 3.5 * dt
        bot.pos.z += (dz / dist) * 3.5 * dt
      }
    }

    // Sync Bot Mesh
    if (bot.mesh) {
      bot.mesh.position.set(bot.pos.x, 0, bot.pos.z)
    }

    // Check player defeat
    if (MobaState.playerHp <= 0) {
      MobaState.playerDeaths++
      MobaState.redScore++
      MobaState.playerHp = MobaState.playerMaxHp
      // Respawn player at Blue Fountain
      const playerEnt = this.ctx.scene.find('ent-player')
      if (playerEnt) {
        const pPos = playerEnt.getTransform().position
        pPos.x = -28
        pPos.y = 1
        pPos.z = -28
        if (playerEnt.object3D) {
          playerEnt.object3D.position.set(-28, 1, -28)
        }
      }
      this.showFloatingText('KAMU GUGUR! Respawn di base.', '#ef4444')
    }
  }

  private showFloatingText(text: string, color: string) {
    if (typeof document === 'undefined') return
    const container = document.getElementById('combat-floating-container')
    if (!container) return
    const el = document.createElement('div')
    el.className = 'floating-text'
    el.style.left = '50%'
    el.style.top = '50%'
    el.style.transform = 'translate(-50%, -50%)'
    el.style.color = color
    el.innerText = text
    container.appendChild(el)
    setTimeout(() => el.remove(), 1200)
  }
}
