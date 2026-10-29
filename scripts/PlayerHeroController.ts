import { Vector3 } from 'three'
import { MobaState, SHOP_ITEMS } from './MobaState'
import { HEROES_LIST, HeroDef } from './HeroData'

export default class PlayerHeroController {
  private ctx: any
  private attackCooldown = 0
  private lastAnnounceTime = 0
  private moveSpeedMultiplier = 1.0

  onInit(ctx: any) {
    this.ctx = ctx
    this.setupUI(ctx)
  }

  private setupUI(ctx: any) {
    if (typeof document === 'undefined') {
      return
    }

    // Render Hero Cards in Select Modal
    this.populateHeroCards()
    this.populateShopItems()

    // Minimap Render Loop
    setInterval(() => {
      this.drawMinimap()
    }, 200)

    // Hero Confirm Button
    ctx.ui.on('#btn-confirm-hero', 'click', () => {
      ctx.ui.hide('#modal-hero-select')
      this.showAnnounce('BATTLE START!', 'Hancurkan Crystal Musuh!')
    })

    // Close Hero Modal
    ctx.ui.on('#btn-close-hero-modal', 'click', () => {
      ctx.ui.hide('#modal-hero-select')
    })

    // Open Hero Modal
    ctx.ui.on('#btn-hero-select-open', 'click', () => {
      this.populateHeroCards()
      ctx.ui.show('#modal-hero-select')
    })

    // Shop Toggle
    ctx.ui.on('#btn-shop-open', 'click', () => {
      ctx.ui.show('#modal-shop')
      this.updateShopUI()
    })
    ctx.ui.on('#btn-close-shop', 'click', () => {
      ctx.ui.hide('#modal-shop')
    })

    // Quick Buy Button
    ctx.ui.on('#btn-quick-buy', 'click', () => {
      this.quickBuy()
    })

    // Basic Attack Button
    ctx.ui.on('#btn-main-attack', 'click', () => {
      this.tryBasicAttack()
    })

    // Targeting Priorities
    ctx.ui.on('#btn-target-minion', 'click', () => {
      MobaState.targetMode = 'minion'
      this.tryBasicAttack()
    })
    ctx.ui.on('#btn-target-turret', 'click', () => {
      MobaState.targetMode = 'turret'
      this.tryBasicAttack()
    })

    // Skills
    ctx.ui.on('#btn-skill1', 'click', () => {
      this.castSkill(1)
    })
    ctx.ui.on('#btn-skill2', 'click', () => {
      this.castSkill(2)
    })
    ctx.ui.on('#btn-skill3', 'click', () => {
      this.castSkill(3)
    })

    // Skill Upgrades
    ctx.ui.on('#btn-upgrade-s1', 'click', () => {
      if (MobaState.skillPoints > 0) {
        MobaState.s1Level++
        MobaState.skillPoints--
        this.updateSkillUI()
      }
    })
    ctx.ui.on('#btn-upgrade-s2', 'click', () => {
      if (MobaState.skillPoints > 0) {
        MobaState.s2Level++
        MobaState.skillPoints--
        this.updateSkillUI()
      }
    })
    ctx.ui.on('#btn-upgrade-s3', 'click', () => {
      if (MobaState.skillPoints > 0) {
        MobaState.s3Level++
        MobaState.skillPoints--
        this.updateSkillUI()
      }
    })

    // Spells: Recall, Regen, Flicker
    ctx.ui.on('#btn-recall', 'click', () => {
      if (MobaState.recallCooldown <= 0) {
        MobaState.isRecalling = 3.5
        this.showFloatingText('Channeling Recall...', '#38bdf8')
      }
    })
    ctx.ui.on('#btn-regen', 'click', () => {
      if (MobaState.regenCooldown <= 0) {
        MobaState.isRegening = 5
        MobaState.regenCooldown = 35
        this.showFloatingText('+REGENERASI', '#22c55e')
      }
    })
    ctx.ui.on('#btn-flicker', 'click', () => {
      if (MobaState.flickerCooldown <= 0) {
        this.castFlicker()
      }
    })

    // Play Again
    ctx.ui.on('#btn-play-again', 'click', () => {
      ctx.scene.load('scenes/Main.lscene')
    })

    // Setup Virtual Touch Joystick
    this.setupVirtualJoystick()
  }

  private setupVirtualJoystick() {
    const base = document.getElementById('joystick-base')
    const knob = document.getElementById('joystick-knob')
    if (!base || !knob) return

    let active = false
    let touchId: number | null = null
    const maxRadius = 38

    const handleStart = (clientX: number, clientY: number, id: number | null) => {
      active = true
      touchId = id
      handleMove(clientX, clientY)
    }

    const handleMove = (clientX: number, clientY: number) => {
      if (!active) return
      const rect = base.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      let dx = clientX - centerX
      let dy = clientY - centerY
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius
        dy = (dy / dist) * maxRadius
      }

      knob.style.transform = `translate(${dx}px, ${dy}px)`
      MobaState.joystickVector = {
        x: dx / maxRadius,
        y: dy / maxRadius
      }
    }

    const handleEnd = () => {
      active = false
      touchId = null
      knob.style.transform = 'translate(0px, 0px)'
      MobaState.joystickVector = { x: 0, y: 0 }
    }

    base.addEventListener('touchstart', (e: TouchEvent) => {
      const touch = e.changedTouches[0]
      handleStart(touch.clientX, touch.clientY, touch.identifier)
      e.preventDefault()
    })
    window.addEventListener('touchmove', (e: TouchEvent) => {
      if (!active) return
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          handleMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY)
          break
        }
      }
    })
    window.addEventListener('touchend', (e: TouchEvent) => {
      if (!active) return
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          handleEnd()
          break
        }
      }
    })

    // Mouse support for desktop
    base.addEventListener('mousedown', (e: MouseEvent) => {
      handleStart(e.clientX, e.clientY, null)
    })
    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (active && touchId === null) {
        handleMove(e.clientX, e.clientY)
      }
    })
    window.addEventListener('mouseup', () => {
      if (active && touchId === null) {
        handleEnd()
      }
    })
  }

  private populateHeroCards() {
    const grid = document.getElementById('hero-cards-grid')
    if (!grid) return
    grid.innerHTML = ''

    HEROES_LIST.forEach((hero) => {
      const card = document.createElement('div')
      card.className = `hero-card ${MobaState.selectedHero.id === hero.id ? 'selected' : ''}`
      card.setAttribute('data-interactive', 'true')
      card.innerHTML = `
        <div class="card-avatar">${hero.icon}</div>
        <div class="card-name">${hero.name}</div>
        <div class="card-title">${hero.title}</div>
        <div class="card-role-tag role-${hero.role.toLowerCase()}">${hero.role}</div>
      `
      card.addEventListener('click', () => {
        MobaState.selectHero(hero.id)
        this.updateHeroPreview(hero)
        this.populateHeroCards()
      })
      grid.appendChild(card)
    })

    this.updateHeroPreview(MobaState.selectedHero)
  }

  private updateHeroPreview(hero: HeroDef) {
    const avatar = document.getElementById('detail-avatar')
    const name = document.getElementById('detail-name')
    const title = document.getElementById('detail-title')
    const role = document.getElementById('detail-role')
    const passive = document.getElementById('detail-passive')
    const skillsRow = document.getElementById('detail-skills-row')

    if (avatar) avatar.innerText = hero.icon
    if (name) name.innerText = hero.name
    if (title) title.innerText = hero.title
    if (role) {
      role.innerText = hero.role.toUpperCase()
      role.className = `role-badge role-${hero.role.toLowerCase()}`
    }
    if (passive) passive.innerText = `${hero.passive.name} - ${hero.passive.description}`

    if (skillsRow) {
      skillsRow.innerHTML = `
        <div class="detail-skill-chip">${hero.skill1.iconText} <strong>S1:</strong> ${hero.skill1.name}</div>
        <div class="detail-skill-chip">${hero.skill2.iconText} <strong>S2:</strong> ${hero.skill2.name}</div>
        <div class="detail-skill-chip">${hero.skill3.iconText} <strong>ULT:</strong> ${hero.skill3.name}</div>
      `
    }

    this.updateSkillUI()
  }

  private updateSkillUI() {
    const h = MobaState.selectedHero
    const s1Icon = document.getElementById('skill1-icon')
    const s1Name = document.getElementById('skill1-name')
    const s1Mana = document.getElementById('skill1-mana')

    const s2Icon = document.getElementById('skill2-icon')
    const s2Name = document.getElementById('skill2-name')
    const s2Mana = document.getElementById('skill2-mana')

    const s3Icon = document.getElementById('skill3-icon')
    const s3Name = document.getElementById('skill3-name')
    const s3Mana = document.getElementById('skill3-mana')

    if (s1Icon) s1Icon.innerText = h.skill1.iconText
    if (s1Name) s1Name.innerText = h.skill1.name
    if (s1Mana) s1Mana.innerText = `${h.skill1.manaCost} MP`

    if (s2Icon) s2Icon.innerText = h.skill2.iconText
    if (s2Name) s2Name.innerText = h.skill2.name
    if (s2Mana) s2Mana.innerText = `${h.skill2.manaCost} MP`

    if (s3Icon) s3Icon.innerText = h.skill3.iconText
    if (s3Name) s3Name.innerText = h.skill3.name
    if (s3Mana) s3Mana.innerText = `${h.skill3.manaCost} MP`

    const heroDisplay = document.getElementById('hero-display-name')
    const heroAvatar = document.getElementById('hero-avatar-icon')
    const roleBadge = document.getElementById('hero-role-badge')

    if (heroDisplay) heroDisplay.innerText = h.name
    if (heroAvatar) heroAvatar.innerText = h.icon
    if (roleBadge) {
      roleBadge.innerText = h.role.toUpperCase()
      roleBadge.className = `role-badge role-${h.role.toLowerCase()}`
    }

    // Skill upgrade buttons visibility
    const upS1 = document.getElementById('btn-upgrade-s1')
    const upS2 = document.getElementById('btn-upgrade-s2')
    const upS3 = document.getElementById('btn-upgrade-s3')
    const showUp = MobaState.skillPoints > 0
    if (upS1) upS1.style.display = showUp ? 'block' : 'none'
    if (upS2) upS2.style.display = showUp ? 'block' : 'none'
    if (upS3) upS3.style.display = showUp ? 'block' : 'none'

    // Update Player Mesh Color in 3D
    this.updatePlayerMeshColor(h.color)
  }

  private updatePlayerMeshColor(hexColor: string) {
    if (!this.ctx || !this.ctx.object3D) return
    this.ctx.object3D.traverse((child: any) => {
      if (child.isMesh && child.material) {
        if (child.material.color) {
          child.material.color.set(hexColor)
        }
      }
    })
  }

  private populateShopItems() {
    const grid = document.getElementById('shop-items-grid')
    if (!grid) return
    grid.innerHTML = ''

    SHOP_ITEMS.forEach((item) => {
      const card = document.createElement('div')
      card.className = 'shop-item-card'
      card.innerHTML = `
        <div class="shop-item-title-row">
          <span>${item.icon} ${item.name}</span>
          <span style="color: #facc15;">💰 ${item.cost}</span>
        </div>
        <div class="shop-item-desc">${item.description}</div>
        <button class="btn-buy-shop-item" data-interactive>BELI (${item.cost} G)</button>
      `
      const buyBtn = card.querySelector('.btn-buy-shop-item')
      if (buyBtn) {
        buyBtn.addEventListener('click', () => {
          if (MobaState.buyItem(item)) {
            this.showFloatingText(`Beli ${item.name}!`, '#facc15')
            this.updateShopUI()
          } else {
            this.showFloatingText('Gold Tidak Cukup!', '#ef4444')
          }
        })
      }
      grid.appendChild(card)
    })
  }

  private updateShopUI() {
    const goldDisplay = document.getElementById('shop-gold-display')
    if (goldDisplay) goldDisplay.innerText = `💰 ${MobaState.playerGold}`
  }

  private quickBuy() {
    // Find first item player can afford
    for (const item of SHOP_ITEMS) {
      if (!MobaState.inventory.find(i => i.id === item.id) && MobaState.playerGold >= item.cost) {
        if (MobaState.buyItem(item)) {
          this.showFloatingText(`Beli ${item.name}!`, '#facc15')
          return
        }
      }
    }
    this.showFloatingText('Gold Belum Cukup', '#ef4444')
  }

  onUpdate(dt: number) {
    if (!MobaState.gameActive) return

    // Movement Handling
    this.handleMovement(dt)

    // Cooldown updates
    this.updateCooldowns(dt)

    // Camera follow
    this.updateCamera()

    // Regens & Fountain check
    this.handleRegenerations(dt)

    // Sync HUD Elements
    this.syncHUD()

    // Keyboard Hotkeys
    this.handleKeyboardInputs()
  }

  private handleKeyboardInputs() {
    if (this.ctx.input.isActionJustPressed('Attack')) {
      this.tryBasicAttack()
    }
    if (this.ctx.input.isActionJustPressed('Skill1')) {
      this.castSkill(1)
    }
    if (this.ctx.input.isActionJustPressed('Skill2')) {
      this.castSkill(2)
    }
    if (this.ctx.input.isActionJustPressed('Skill3')) {
      this.castSkill(3)
    }
    if (this.ctx.input.isActionJustPressed('Recall')) {
      MobaState.isRecalling = 3.5
      this.showFloatingText('Channeling Recall...', '#38bdf8')
    }
    if (this.ctx.input.isActionJustPressed('Regen')) {
      if (MobaState.regenCooldown <= 0) {
        MobaState.isRegening = 5
        MobaState.regenCooldown = 35
        this.showFloatingText('+REGENERASI', '#22c55e')
      }
    }
  }

  private handleMovement(dt: number) {
    // Combine Linden Input (WASD) and Touch Joystick
    const moveInput = this.ctx.input.getVector('Move') || { x: 0, y: 0 }
    let moveX = moveInput.x + MobaState.joystickVector.x
    let moveZ = -moveInput.y + MobaState.joystickVector.y

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ)
    if (len > 0.05) {
      // Cancel recall on move
      if (MobaState.isRecalling > 0) {
        MobaState.isRecalling = 0
        this.showFloatingText('Recall Dibatalkan', '#ef4444')
      }

      if (len > 1) {
        moveX /= len
        moveZ /= len
      }

      // Calculate speed with items and hero base
      let totalSpeed = MobaState.selectedHero.moveSpeed * this.moveSpeedMultiplier
      for (const item of MobaState.inventory) {
        totalSpeed += item.bonusSpeed
      }

      const pos = this.ctx.entity.getTransform().position
      pos.x += moveX * totalSpeed * dt
      pos.z += moveZ * totalSpeed * dt

      // Map boundary clamp (-38 to +38)
      pos.x = Math.max(-38, Math.min(38, pos.x))
      pos.z = Math.max(-38, Math.min(38, pos.z))
      if (this.ctx.object3D) {
        this.ctx.object3D.position.set(pos.x, pos.y, pos.z)
      }

      // Rotate player to face movement direction
      const angle = Math.atan2(moveX, moveZ)
      if (this.ctx.object3D) {
        this.ctx.object3D.rotation.y = angle
      }
    }
  }

  private updateCamera() {
    const camEnt = this.ctx.scene.find('ent-camera-main')
    if (!camEnt) return
    const pPos = this.ctx.entity.getTransform().position
    const cPos = camEnt.getTransform().position
    cPos.x = pPos.x
    cPos.y = pPos.y + 19
    cPos.z = pPos.z + 13
    if (camEnt.object3D) {
      camEnt.object3D.position.set(cPos.x, cPos.y, cPos.z)
    }
  }

  private updateCooldowns(dt: number) {
    if (this.attackCooldown > 0) this.attackCooldown -= dt
    if (MobaState.s1Cooldown > 0) MobaState.s1Cooldown = Math.max(0, MobaState.s1Cooldown - dt)
    if (MobaState.s2Cooldown > 0) MobaState.s2Cooldown = Math.max(0, MobaState.s2Cooldown - dt)
    if (MobaState.s3Cooldown > 0) MobaState.s3Cooldown = Math.max(0, MobaState.s3Cooldown - dt)
    if (MobaState.recallCooldown > 0) MobaState.recallCooldown = Math.max(0, MobaState.recallCooldown - dt)
    if (MobaState.regenCooldown > 0) MobaState.regenCooldown = Math.max(0, MobaState.regenCooldown - dt)
    if (MobaState.flickerCooldown > 0) MobaState.flickerCooldown = Math.max(0, MobaState.flickerCooldown - dt)

    // Recall channeling
    if (MobaState.isRecalling > 0) {
      MobaState.isRecalling -= dt
      if (MobaState.isRecalling <= 0) {
        // Teleport to Blue Fountain
        const pos = this.ctx.entity.getTransform().position
        pos.x = -28
        pos.y = 1
        pos.z = -28
        if (this.ctx.object3D) {
          this.ctx.object3D.position.set(-28, 1, -28)
        }
        this.showFloatingText('Teleport Selesai!', '#38bdf8')
      }
    }

    // Regen spell tick
    if (MobaState.isRegening > 0) {
      MobaState.isRegening -= dt
      MobaState.playerHp = Math.min(MobaState.playerMaxHp, MobaState.playerHp + (MobaState.playerMaxHp * 0.05 * dt))
    }
  }

  private handleRegenerations(dt: number) {
    const pPos = this.ctx.entity.getTransform().position
    // Blue Fountain healing zone at (-28, -28)
    const distToFountain = Math.sqrt((pPos.x - (-28)) ** 2 + (pPos.z - (-28)) ** 2)
    if (distToFountain < 7) {
      MobaState.playerHp = Math.min(MobaState.playerMaxHp, MobaState.playerHp + 400 * dt)
      MobaState.playerMana = Math.min(MobaState.playerMaxMana, MobaState.playerMana + 150 * dt)
    } else {
      // Natural passive regen
      MobaState.playerHp = Math.min(MobaState.playerMaxHp, MobaState.playerHp + 10 * dt)
      MobaState.playerMana = Math.min(MobaState.playerMaxMana, MobaState.playerMana + 15 * dt)
    }
  }

  private syncHUD() {
    if (typeof document === 'undefined') return

    // HP Bar
    const barHp = document.getElementById('bar-hp')
    const textHp = document.getElementById('text-hp')
    if (barHp && textHp) {
      const pct = Math.max(0, Math.min(100, (MobaState.playerHp / MobaState.playerMaxHp) * 100))
      barHp.style.width = `${pct}%`
      textHp.innerText = `${Math.floor(MobaState.playerHp)} / ${MobaState.playerMaxHp}`
    }

    // Mana Bar
    const barMana = document.getElementById('bar-mana')
    const textMana = document.getElementById('text-mana')
    if (barMana && textMana) {
      const pct = Math.max(0, Math.min(100, (MobaState.playerMana / MobaState.playerMaxMana) * 100))
      barMana.style.width = `${pct}%`
      textMana.innerText = `${Math.floor(MobaState.playerMana)} / ${MobaState.playerMaxMana}`
    }

    // Level & Stats
    const lvlBadge = document.getElementById('hero-level-badge')
    const kdaDisplay = document.getElementById('player-kda')
    const goldDisplay = document.getElementById('player-gold')
    const timerDisplay = document.getElementById('match-timer')
    const scoreBlue = document.getElementById('score-blue')
    const scoreRed = document.getElementById('score-red')

    if (lvlBadge) lvlBadge.innerText = `${MobaState.playerLevel}`
    if (kdaDisplay) kdaDisplay.innerText = `${MobaState.playerKills} / ${MobaState.playerDeaths} / ${MobaState.playerAssists}`
    if (goldDisplay) goldDisplay.innerText = `${MobaState.playerGold}`
    if (scoreBlue) scoreBlue.innerText = `${MobaState.blueScore}`
    if (scoreRed) scoreRed.innerText = `${MobaState.redScore}`

    if (timerDisplay) {
      const m = Math.floor(MobaState.matchSeconds / 60)
      const s = Math.floor(MobaState.matchSeconds % 60)
      timerDisplay.innerText = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
    }

    // Cooldown overlays on UI
    this.syncCooldownOverlay('cd-skill1', 'cd-num-skill1', MobaState.s1Cooldown, MobaState.selectedHero.skill1.cooldown)
    this.syncCooldownOverlay('cd-skill2', 'cd-num-skill2', MobaState.s2Cooldown, MobaState.selectedHero.skill2.cooldown)
    this.syncCooldownOverlay('cd-skill3', 'cd-num-skill3', MobaState.s3Cooldown, MobaState.selectedHero.skill3.cooldown)
    this.syncCooldownOverlay('cd-regen', null, MobaState.regenCooldown, 35)
    this.syncCooldownOverlay('cd-flicker', null, MobaState.flickerCooldown, 40)
  }

  private syncCooldownOverlay(overlayId: string, numId: string | null, cdVal: number, maxCd: number) {
    if (typeof document === 'undefined') return
    const overlay = document.getElementById(overlayId)
    const num = numId ? document.getElementById(numId) : null
    if (overlay) {
      const pct = maxCd > 0 ? (cdVal / maxCd) * 100 : 0
      overlay.style.height = `${pct}%`
    }
    if (num) {
      if (cdVal > 0) {
        num.style.display = 'flex'
        num.innerText = `${Math.ceil(cdVal)}`
      } else {
        num.style.display = 'none'
      }
    }
  }

  private tryBasicAttack() {
    if (this.attackCooldown > 0) return
    const hero = MobaState.selectedHero
    const pPos = this.ctx.entity.getTransform().position

    // Find nearest valid target according to targetMode
    const target = this.findTarget(pPos, hero.range)
    if (!target) {
      this.showFloatingText('Tidak ada target dalam range!', '#cbd5e1')
      return
    }

    // Trigger attack cooldown
    this.attackCooldown = 0.75

    // Face the target
    if (this.ctx.object3D) {
      const dx = target.pos.x - pPos.x
      const dz = target.pos.z - pPos.z
      this.ctx.object3D.rotation.y = Math.atan2(dx, dz)
    }

    // Calculate damage
    let damage = hero.baseAtk + (MobaState.playerLevel * 12)
    for (const it of MobaState.inventory) {
      damage += it.bonusAtk
    }

    // Passive effects
    if (hero.id === 'dante') {
      // Dante Lifesteal 25%
      const heal = damage * 0.25
      MobaState.playerHp = Math.min(MobaState.playerMaxHp, MobaState.playerHp + heal)
      this.showFloatingText(`+${Math.floor(heal)} HP`, '#4ade80')
    }

    // Apply damage to target
    this.damageUnit(target, damage, 'physical')

    // Create visual effect / projectile in 3D
    this.createAttackEffect(pPos, target.pos, hero.attackType, hero.accentColor)
  }

  private castSkill(skillNum: 1 | 2 | 3) {
    const hero = MobaState.selectedHero
    const skill = skillNum === 1 ? hero.skill1 : skillNum === 2 ? hero.skill2 : hero.skill3
    const cdVal = skillNum === 1 ? MobaState.s1Cooldown : skillNum === 2 ? MobaState.s2Cooldown : MobaState.s3Cooldown

    if (cdVal > 0) {
      this.showFloatingText(`${skill.name} masih cooldown!`, '#ef4444')
      return
    }
    if (MobaState.playerMana < skill.manaCost) {
      this.showFloatingText('Mana Tidak Cukup!', '#60a5fa')
      return
    }

    // Deduct mana & apply CD
    MobaState.playerMana -= skill.manaCost
    if (skillNum === 1) MobaState.s1Cooldown = skill.cooldown
    if (skillNum === 2) MobaState.s2Cooldown = skill.cooldown
    if (skillNum === 3) MobaState.s3Cooldown = skill.cooldown

    const pPos = this.ctx.entity.getTransform().position
    this.showFloatingText(`${skill.name.toUpperCase()}!`, '#facc15')

    // Execute unique skill logic
    this.executeSkillLogic(hero, skillNum, pPos)
  }

  private executeSkillLogic(hero: HeroDef, skillNum: number, pPos: any) {
    const skill = skillNum === 1 ? hero.skill1 : skillNum === 2 ? hero.skill2 : hero.skill3
    const targets = this.findTargetsInRadius(pPos, skill.range)

    if (skill.type === 'heal') {
      // Selene heal
      MobaState.playerHp = Math.min(MobaState.playerMaxHp, MobaState.playerHp + 420)
      this.showFloatingText('+420 HEAL', '#22c55e')
      return
    }

    if (skill.type === 'dash') {
      // Dash / Leap forward
      const forwardX = Math.sin(this.ctx.object3D?.rotation.y || 0)
      const forwardZ = Math.cos(this.ctx.object3D?.rotation.y || 0)
      pPos.x += forwardX * 6
      pPos.z += forwardZ * 6
      if (this.ctx.object3D) {
        this.ctx.object3D.position.set(pPos.x, pPos.y, pPos.z)
      }
      this.showFloatingText('DASH!', '#38bdf8')
    }

    // Damage all targets in range
    for (const t of targets) {
      let dmg = skill.damage + (MobaState.playerLevel * 20)
      this.damageUnit(t, dmg, 'magic')
      if (skill.type === 'cc') {
        this.showFloatingText('STUNNED!', '#facc15')
      }
    }
  }

  private castFlicker() {
    MobaState.flickerCooldown = 40
    const pPos = this.ctx.entity.getTransform().position
    const forwardX = Math.sin(this.ctx.object3D?.rotation.y || 0)
    const forwardZ = Math.cos(this.ctx.object3D?.rotation.y || 0)
    pPos.x += forwardX * 7
    pPos.z += forwardZ * 7
    if (this.ctx.object3D) {
      this.ctx.object3D.position.set(pPos.x, pPos.y, pPos.z)
    }
    this.showFloatingText('FLICKER!', '#facc15')
  }

  private findTarget(fromPos: any, range: number): any | null {
    let bestTarget: any = null
    let minDist = range

    // 1. Check enemy bot hero
    if (MobaState.enemyBot && MobaState.enemyBot.hp > 0) {
      const dist = Math.hypot(MobaState.enemyBot.pos.x - fromPos.x, MobaState.enemyBot.pos.z - fromPos.z)
      if (dist <= minDist) {
        if (MobaState.targetMode === 'hero' || dist <= minDist) {
          bestTarget = { type: 'hero', unit: MobaState.enemyBot, pos: MobaState.enemyBot.pos }
          minDist = dist
        }
      }
    }

    // 2. Check enemy minions
    for (const minion of MobaState.minions) {
      if (minion.team === 'red' && minion.hp > 0) {
        const dist = Math.hypot(minion.pos.x - fromPos.x, minion.pos.z - fromPos.z)
        if (MobaState.targetMode === 'minion' && dist <= range) {
          return { type: 'minion', unit: minion, pos: minion.pos }
        }
        if (dist <= minDist) {
          bestTarget = { type: 'minion', unit: minion, pos: minion.pos }
          minDist = dist
        }
      }
    }

    // 3. Check enemy turrets & base
    for (const turret of MobaState.turrets) {
      if (turret.team === 'red' && turret.hp > 0) {
        const dist = Math.hypot(turret.pos.x - fromPos.x, turret.pos.z - fromPos.z)
        if (MobaState.targetMode === 'turret' && dist <= range) {
          return { type: 'turret', unit: turret, pos: turret.pos }
        }
        if (dist <= minDist) {
          bestTarget = { type: 'turret', unit: turret, pos: turret.pos }
          minDist = dist
        }
      }
    }

    // Red Base Core
    const distBase = Math.hypot(28 - fromPos.x, 28 - fromPos.z)
    if (distBase <= range && MobaState.redBaseHp > 0) {
      if (!bestTarget || MobaState.targetMode === 'turret') {
        bestTarget = { type: 'base', pos: { x: 28, y: 1.5, z: 28 } }
      }
    }

    return bestTarget
  }

  private findTargetsInRadius(fromPos: any, radius: number): any[] {
    const list: any[] = []
    if (MobaState.enemyBot && MobaState.enemyBot.hp > 0) {
      if (Math.hypot(MobaState.enemyBot.pos.x - fromPos.x, MobaState.enemyBot.pos.z - fromPos.z) <= radius) {
        list.push({ type: 'hero', unit: MobaState.enemyBot, pos: MobaState.enemyBot.pos })
      }
    }
    for (const minion of MobaState.minions) {
      if (minion.team === 'red' && minion.hp > 0) {
        if (Math.hypot(minion.pos.x - fromPos.x, minion.pos.z - fromPos.z) <= radius) {
          list.push({ type: 'minion', unit: minion, pos: minion.pos })
        }
      }
    }
    for (const turret of MobaState.turrets) {
      if (turret.team === 'red' && turret.hp > 0) {
        if (Math.hypot(turret.pos.x - fromPos.x, turret.pos.z - fromPos.z) <= radius) {
          list.push({ type: 'turret', unit: turret, pos: turret.pos })
        }
      }
    }
    return list
  }

  private damageUnit(target: any, damage: number, type: 'physical' | 'magic') {
    if (target.type === 'hero') {
      target.unit.hp -= damage
      this.showDamageNumber(damage, type)
      if (target.unit.hp <= 0) {
        MobaState.playerKills++
        MobaState.blueScore++
        MobaState.addGold(300)
        MobaState.addExp(250)
        this.showAnnounce('AN ENEMY HAS BEEN SLAIN!', 'Musuh Gugur!')
      }
    } else if (target.type === 'minion') {
      target.unit.hp -= damage
      this.showDamageNumber(damage, type)
      if (target.unit.hp <= 0) {
        MobaState.addGold(45)
        MobaState.addExp(35)
      }
    } else if (target.type === 'turret') {
      target.unit.hp -= damage
      this.showDamageNumber(damage, type)
      if (target.unit.hp <= 0) {
        MobaState.addGold(200)
        MobaState.addExp(150)
        this.showAnnounce('TURRET HANCUR!', 'Turret musuh telah dihancurkan!')
      }
    } else if (target.type === 'base') {
      MobaState.redBaseHp = Math.max(0, MobaState.redBaseHp - damage)
      this.showDamageNumber(damage, type)
      if (MobaState.redBaseHp <= 0) {
        MobaState.gameActive = false
        this.showVictoryScreen()
      }
    }
  }

  private createAttackEffect(fromPos: any, toPos: any, attackType: string, colorHex: string) {
    if (!this.ctx || !this.ctx.object3D || !this.ctx.object3D.parent) return
    const scene = this.ctx.object3D.parent
    const THREE = (window as any).THREE || this.ctx.three

    if (!THREE) return

    if (attackType === 'melee') {
      // Slash arc mesh
      const slashGeo = new THREE.TorusGeometry(1.8, 0.15, 8, 24, Math.PI * 0.8)
      const slashMat = new THREE.MeshBasicMaterial({ color: colorHex, wireframe: false })
      const slash = new THREE.Mesh(slashGeo, slashMat)
      slash.position.set(fromPos.x, fromPos.y + 0.8, fromPos.z)
      slash.rotation.x = Math.PI / 2
      slash.rotation.z = this.ctx.object3D.rotation.y
      scene.add(slash)
      setTimeout(() => scene.remove(slash), 150)
    } else {
      // Ranged projectile
      const projGeo = new THREE.SphereGeometry(0.35, 8, 8)
      const projMat = new THREE.MeshBasicMaterial({ color: colorHex })
      const proj = new THREE.Mesh(projGeo, projMat)
      proj.position.set(fromPos.x, fromPos.y + 1, fromPos.z)
      scene.add(proj)

      const start = { ...fromPos }
      let progress = 0
      const interval = setInterval(() => {
        progress += 0.2
        proj.position.x = start.x + (toPos.x - start.x) * progress
        proj.position.z = start.z + (toPos.z - start.z) * progress
        if (progress >= 1) {
          clearInterval(interval)
          scene.remove(proj)
        }
      }, 30)
    }
  }

  private showDamageNumber(damage: number, type: 'physical' | 'magic') {
    if (typeof document === 'undefined') return
    const container = document.getElementById('combat-floating-container')
    if (!container) return
    const el = document.createElement('div')
    el.className = 'floating-text'
    el.style.left = `calc(50% + ${(Math.random() - 0.5) * 80}px)`
    el.style.top = `calc(40% + ${(Math.random() - 0.5) * 50}px)`
    el.style.color = type === 'physical' ? '#ef4444' : '#a855f7'
    el.innerText = `-${Math.floor(damage)}`
    container.appendChild(el)
    setTimeout(() => el.remove(), 1200)
  }

  private showFloatingText(text: string, color: string) {
    if (typeof document === 'undefined') return
    const container = document.getElementById('combat-floating-container')
    if (!container) return
    const el = document.createElement('div')
    el.className = 'floating-text'
    el.style.left = '50%'
    el.style.top = '45%'
    el.style.transform = 'translate(-50%, -50%)'
    el.style.color = color
    el.innerText = text
    container.appendChild(el)
    setTimeout(() => el.remove(), 1200)
  }

  private showAnnounce(title: string, sub: string) {
    if (typeof document === 'undefined') return
    const banner = document.getElementById('announcer-banner')
    const titleEl = document.getElementById('announcer-title')
    const subEl = document.getElementById('announcer-sub')
    if (!banner || !titleEl || !subEl) return

    titleEl.innerText = title
    subEl.innerText = sub
    banner.classList.add('show')
    setTimeout(() => {
      banner.classList.remove('show')
    }, 2800)
  }

  private showVictoryScreen() {
    if (typeof document === 'undefined') return
    const screen = document.getElementById('match-result-screen')
    const banner = document.getElementById('result-banner')
    const sub = document.getElementById('result-subtitle')
    const kda = document.getElementById('result-kda-summary')

    if (screen && banner && sub && kda) {
      banner.innerText = 'VICTORY!'
      banner.style.color = '#facc15'
      sub.innerText = 'Crystal Musuh Hancur! Kemenangan Spektakuler!'
      kda.innerText = `KDA: ${MobaState.playerKills} / ${MobaState.playerDeaths} / ${MobaState.playerAssists} · Total Gold: ${MobaState.playerGold}`
      screen.classList.add('active')
    }
  }

  private drawMinimap() {
    if (typeof document === 'undefined') return
    const canvas = document.getElementById('minimap-canvas') as HTMLCanvasElement
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    // Arena background
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, w, h)

    // Lanes (lines)
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 3

    // Mid lane
    ctx.beginPath()
    ctx.moveTo(10, 10)
    ctx.lineTo(w - 10, h - 10)
    ctx.stroke()

    // Top lane
    ctx.beginPath()
    ctx.moveTo(10, 10)
    ctx.lineTo(10, h - 10)
    ctx.lineTo(w - 10, h - 10)
    ctx.stroke()

    // Bot lane
    ctx.beginPath()
    ctx.moveTo(10, 10)
    ctx.lineTo(w - 10, 10)
    ctx.lineTo(w - 10, h - 10)
    ctx.stroke()

    // Helper map coordinates converter (-38..38 to 0..w)
    const toCanvasX = (worldX: number) => ((worldX + 38) / 76) * w
    const toCanvasY = (worldZ: number) => ((worldZ + 38) / 76) * h

    // Base Crystals
    ctx.fillStyle = '#38bdf8'
    ctx.beginPath()
    ctx.arc(toCanvasX(-28), toCanvasY(-28), 6, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(toCanvasX(28), toCanvasY(28), 6, 0, Math.PI * 2)
    ctx.fill()

    // Turrets
    for (const t of MobaState.turrets) {
      if (t.hp > 0) {
        ctx.fillStyle = t.team === 'blue' ? '#0284c7' : '#dc2626'
        ctx.fillRect(toCanvasX(t.pos.x) - 3, toCanvasY(t.pos.z) - 3, 6, 6)
      }
    }

    // Minions
    for (const m of MobaState.minions) {
      if (m.hp > 0) {
        ctx.fillStyle = m.team === 'blue' ? '#67e8f9' : '#f87171'
        ctx.beginPath()
        ctx.arc(toCanvasX(m.pos.x), toCanvasY(m.pos.z), 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Enemy Bot
    if (MobaState.enemyBot && MobaState.enemyBot.hp > 0) {
      ctx.fillStyle = '#dc2626'
      ctx.beginPath()
      ctx.arc(toCanvasX(MobaState.enemyBot.pos.x), toCanvasY(MobaState.enemyBot.pos.z), 5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Player Hero
    const pPos = this.ctx.entity.getTransform().position
    ctx.fillStyle = '#22c55e'
    ctx.beginPath()
    ctx.arc(toCanvasX(pPos.x), toCanvasY(pPos.z), 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}
