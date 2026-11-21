#include <emscripten.h>
#include <string.h>

#include "brain_bridge.h"

#include "doomdef.h"
#include "doomstat.h"
#include "d_loop.h"
#include "net_defs.h"
#include "d_event.h"
#include "d_player.h"
#include "info.h"
#include "m_random.h"
#include "p_local.h"
#include "r_main.h"
#include "s_sound.h"
#include "sounds.h"
#include "tables.h"

#define NEVER_TICS 9999
#define ALLY_RADIUS (512 * FRACUNIT)
#define ATTACK_COOLDOWN_TICS 35
#define LOST_TICS (15 * TICRATE)
#define RESPAWN_TICS (3 * TICRATE)
#define SPAWN_ATTEMPTS 32
#define SPAWN_BEHIND_ATTEMPTS 20
#define SPAWN_MIN_DIST 320
#define SPAWN_DIST_STEP 3
#define BOT_FOV_DEGREES 60
#define BOT_REACTION_TICS 7
#define BOT_FIRE_DEGREES 4
#define BOT_TURN_PER_TIC (ANG1 * 6)
#define BOT_SCAN_PER_TIC (ANG1 * 2)
#define BOT_CLOSE_UNITS 220
#define BOT_FAR_UNITS 700
#define BOT_WALK 0x19
#define BOT_STRAFE 0x18
#define BOT_STRAFE_TICS 50

enum
{
    EV_LEVEL_START,
    EV_SPAWN,
    EV_HIT_PLAYER,
    EV_DEATH,
    EV_PLAYER_FIRE,
    EV_PLAYER_DEATH
};

enum
{
    MOVE_ADVANCE,
    MOVE_RETREAT,
    MOVE_STRAFE_L,
    MOVE_STRAFE_R,
    MOVE_FLANK_L,
    MOVE_FLANK_R,
    MOVE_HOLD
};

#define DECISION_ATTACK 16

boolean P_Move(mobj_t* actor);
void P_NewChaseDir(mobj_t* actor);
boolean P_CheckMeleeRange(mobj_t* actor);

EM_JS(int, js_think, (int uid, int species, int* sensors), {
    return Module.brainThink(uid, species, sensors >> 2);
});

EM_JS(void, js_event, (int kind, int tic, int a, int b, int c, int d), {
    Module.brainEvent(kind, tic, a, b, c, d);
});

EM_JS(void, js_labels, (int* data, int count), {
    if (Module.brainLabels) Module.brainLabels(data >> 2, count);
});

#define MAX_LABELS 32
#define LABEL_FIELDS 4

static mobj_t* label_mobjs[MAX_LABELS];
static int label_data[MAX_LABELS * LABEL_FIELDS];
static int label_count;

static int next_uid = 1;
static int player_fire_tic = -NEVER_TICS;
static int player_death_tic = -NEVER_TICS;
static boolean autopilot;
static int bot_focus_uid;
static int bot_focus_tic;
static short bot_turns[BACKUPTICS];

static const angle_t move_offsets[] = {
    0, ANG180, ANG90, (angle_t) -ANG90, ANG45, (angle_t) -ANG45
};

static int TicsSince(int tic)
{
    int ago = leveltime - tic;

    if (ago < 0)
        return 0;
    return ago > NEVER_TICS ? NEVER_TICS : ago;
}

static int AimOffsetDegrees(mobj_t* player, mobj_t* other)
{
    angle_t to_other = R_PointToAngle2(player->x, player->y, other->x, other->y);
    angle_t diff = to_other - player->angle;

    if (diff > ANG180)
        diff = -diff;

    return (int) (((unsigned long long) diff * 180) >> 31);
}

static int DistanceUnits(mobj_t* a, mobj_t* b)
{
    return P_AproxDistance(a->x - b->x, a->y - b->y) >> FRACBITS;
}

static int AlliesNear(mobj_t* actor)
{
    thinker_t* th;
    int count = 0;

    for (th = thinkercap.next; th != &thinkercap; th = th->next)
    {
        mobj_t* mo;

        if (th->function.acp1 != (actionf_p1) P_MobjThinker)
            continue;

        mo = (mobj_t*) th;
        if (mo != actor && mo->species == actor->species && mo->health > 0
            && P_AproxDistance(mo->x - actor->x, mo->y - actor->y) < ALLY_RADIUS)
        {
            count++;
        }
    }

    return count;
}

static boolean CanShoot(mobj_t* actor, boolean can_see)
{
    return can_see && !actor->reactiontime && actor->info->missilestate
        && TicsSince(actor->attacktic) >= ATTACK_COOLDOWN_TICS;
}

static void SpotNearPlayer(mobj_t* player, int attempt, fixed_t* x, fixed_t* y)
{
    angle_t spread = attempt < SPAWN_BEHIND_ATTEMPTS ? ANG90 : ANG180;
    angle_t angle = player->angle + ANG180 + (angle_t) (((M_Random() - 128) * (long long) spread) >> 7);
    fixed_t dist = (SPAWN_MIN_DIST + M_Random() * SPAWN_DIST_STEP) * FRACUNIT;

    *x = player->x + FixedMul(dist, finecosine[angle >> ANGLETOFINESHIFT]);
    *y = player->y + FixedMul(dist, finesine[angle >> ANGLETOFINESHIFT]);
}

static boolean Fits(mobj_t* mo, fixed_t x, fixed_t y)
{
    return P_CheckPosition(mo, x, y) && tmceilingz - tmfloorz >= mo->height;
}

static void TeleportFog(mobj_t* mo)
{
    S_StartSound(P_SpawnMobj(mo->x, mo->y, mo->z, MT_TFOG), sfx_telept);
}

static void Relocate(mobj_t* actor)
{
    mobj_t* player = actor->target;
    fixed_t oldx = actor->x;
    fixed_t oldy = actor->y;
    fixed_t oldz = actor->z;
    int attempt;

    actor->lastseentic = leveltime;

    for (attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++)
    {
        fixed_t x, y;

        SpotNearPlayer(player, attempt, &x, &y);
        if (!Fits(actor, x, y) || !P_TeleportMove(actor, x, y))
            continue;

        actor->z = actor->floorz;
        if (P_CheckSight(player, actor))
        {
            TeleportFog(actor);
            return;
        }

        P_TeleportMove(actor, oldx, oldy);
        actor->z = oldz;
    }
}

void Brain_InitMobj(mobj_t* mobj)
{
    mobj->species = -1;
    mobj->birthtic = leveltime;
    mobj->hurttic = -NEVER_TICS;
    mobj->attacktic = -NEVER_TICS;
    mobj->lastseentic = leveltime;
}

boolean Brain_Chase(mobj_t* actor)
{
    mobj_t* target = actor->target;
    player_t* player;
    int sensors[SENSOR_COUNT];
    boolean can_see;
    int decision;
    int move;

    if (actor->species < 0 || !target || !target->player)
        return false;

    player = target->player;
    can_see = P_CheckSight(actor, target);
    if (can_see)
        actor->lastseentic = leveltime;
    else if (TicsSince(actor->lastseentic) > LOST_TICS)
        Relocate(actor);

    sensors[SENSOR_DIST] = DistanceUnits(actor, target);
    sensors[SENSOR_AIM_OFFSET] = AimOffsetDegrees(target, actor);
    sensors[SENSOR_CAN_SEE] = can_see;
    sensors[SENSOR_CAN_MELEE] = actor->info->meleestate && P_CheckMeleeRange(actor);
    sensors[SENSOR_CAN_SHOOT] = CanShoot(actor, can_see);
    sensors[SENSOR_HP] = actor->health;
    sensors[SENSOR_MAX_HP] = actor->info->spawnhealth;
    sensors[SENSOR_HURT_AGO] = TicsSince(actor->hurttic);
    sensors[SENSOR_PLAYER_HP] = player->health;
    sensors[SENSOR_PLAYER_WEAPON] = player->readyweapon;
    sensors[SENSOR_PLAYER_FIRED_AGO] = TicsSince(player_fire_tic);
    sensors[SENSOR_PLAYER_SPEED] = P_AproxDistance(target->momx, target->momy) >> FRACBITS;
    sensors[SENSOR_ALLIES_NEAR] = AlliesNear(actor);
    sensors[SENSOR_ALIVE_TICS] = TicsSince(actor->birthtic);

    decision = js_think(actor->uid, actor->species, sensors);
    if (decision < 0)
        return false;

    if (actor->flags & MF_JUSTATTACKED)
    {
        actor->flags &= ~MF_JUSTATTACKED;
        decision &= ~DECISION_ATTACK;
    }

    if (decision & DECISION_ATTACK)
    {
        actor->flags &= ~MF_JUSTHIT;

        if (sensors[SENSOR_CAN_MELEE])
        {
            if (actor->info->attacksound)
                S_StartSound(actor, actor->info->attacksound);
            actor->attacktic = leveltime;
            P_SetMobjState(actor, actor->info->meleestate);
            return true;
        }

        if (sensors[SENSOR_CAN_SHOOT])
        {
            actor->attacktic = leveltime;
            actor->flags |= MF_JUSTATTACKED;
            P_SetMobjState(actor, actor->info->missilestate);
            return true;
        }
    }

    move = decision & 15;
    if (move == MOVE_HOLD)
    {
        actor->angle = R_PointToAngle2(actor->x, actor->y, target->x, target->y);
    }
    else if (move < MOVE_HOLD)
    {
        angle_t heading = R_PointToAngle2(actor->x, actor->y, target->x, target->y)
                        + move_offsets[move];

        actor->movedir = (heading + ANG45 / 2) >> 29;
        if (!P_Move(actor))
            P_NewChaseDir(actor);
    }

    if (actor->info->activesound && P_Random() < 3)
        S_StartSound(actor, actor->info->activesound);

    return true;
}

void Brain_LevelStart(void)
{
    player_t* player = &players[consoleplayer];

    player_fire_tic = -NEVER_TICS;
    player_death_tic = -NEVER_TICS;

    if (demoplayback)
        return;

    player->weaponowned[wp_shotgun] = true;
    player->ammo[am_shell] = player->maxammo[am_shell];
    player->pendingweapon = wp_shotgun;
    js_event(EV_LEVEL_START, leveltime, 0, 0, 0, 0);
}

void Brain_PlayerHit(mobj_t* player, mobj_t* source, int damage)
{
    if (source && source->species >= 0)
    {
        js_event(EV_HIT_PLAYER, leveltime, source->uid, damage,
                 AimOffsetDegrees(player, source), 0);
    }
}

void Brain_MonsterHurt(mobj_t* target)
{
    if (target->species >= 0)
        target->hurttic = leveltime;
}

void Brain_MobjKilled(mobj_t* source, mobj_t* target)
{
    mobj_t* player = players[consoleplayer].mo;

    if (target->player)
    {
        player_death_tic = leveltime;
        js_event(EV_PLAYER_DEATH, leveltime,
                 source && source->species >= 0 ? source->uid : 0, 0, 0, 0);
    }
    else if (target->species >= 0 && player)
    {
        js_event(EV_DEATH, leveltime, target->uid, players[consoleplayer].readyweapon,
                 DistanceUnits(player, target), AimOffsetDegrees(player, target));
    }
}

boolean Brain_ShouldRespawn(void)
{
    return leveltime - player_death_tic > RESPAWN_TICS;
}

void Brain_PlayerFired(int weapon)
{
    player_fire_tic = leveltime;
    js_event(EV_PLAYER_FIRE, leveltime, weapon, 0, 0, 0);
}

static mobj_t* BotPickTarget(mobj_t* player)
{
    thinker_t* th;
    mobj_t* best = NULL;
    int best_dist = 0;
    mobj_t* attacker = player->player->attacker;

    for (th = thinkercap.next; th != &thinkercap; th = th->next)
    {
        mobj_t* mo;
        int dist;

        if (th->function.acp1 != (actionf_p1) P_MobjThinker)
            continue;

        mo = (mobj_t*) th;
        if (mo->species < 0 || mo->health <= 0
            || AimOffsetDegrees(player, mo) > BOT_FOV_DEGREES || !P_CheckSight(player, mo))
        {
            continue;
        }

        dist = DistanceUnits(player, mo);
        if (!best || dist < best_dist)
        {
            best = mo;
            best_dist = dist;
        }
    }

    if (!best && player->player->damagecount > 0 && attacker
        && attacker->species >= 0 && attacker->health > 0)
    {
        best = attacker;
    }

    return best;
}

// Several ticcmds can be built before any of them runs, so aim from the angle
// the player will have once the queued turns are applied, not the current one.
static angle_t BotQueuedAngle(mobj_t* player, int maketic)
{
    angle_t angle = player->angle;
    int tic;

    for (tic = gametic; tic < maketic && tic < gametic + BACKUPTICS; tic++)
        angle += (angle_t) bot_turns[tic % BACKUPTICS] << 16;

    return angle;
}

void Brain_Autopilot(ticcmd_t* cmd, int maketic)
{
    mobj_t* player = players[consoleplayer].mo;
    mobj_t* target;
    angle_t aim;
    int turn;
    int dist;

    bot_turns[maketic % BACKUPTICS] = 0;

    if (!autopilot || gamestate != GS_LEVEL || demoplayback || !player
        || (cmd->buttons & BT_SPECIAL))
    {
        return;
    }

    cmd->forwardmove = cmd->sidemove = 0;
    cmd->angleturn = 0;
    cmd->buttons = 0;

    if (player->health <= 0)
        return;

    players[consoleplayer].ammo[am_shell] = players[consoleplayer].maxammo[am_shell];

    aim = BotQueuedAngle(player, maketic);
    target = BotPickTarget(player);
    if (!target)
    {
        bot_focus_uid = 0;
        cmd->angleturn = BOT_SCAN_PER_TIC >> 16;
        cmd->forwardmove = BOT_WALK;
        bot_turns[maketic % BACKUPTICS] = cmd->angleturn;
        return;
    }

    if (target->uid != bot_focus_uid)
    {
        bot_focus_uid = target->uid;
        bot_focus_tic = leveltime;
    }

    turn = (int) (R_PointToAngle2(player->x, player->y, target->x, target->y) - aim
                  + (angle_t) ((M_Random() - 128) * (ANG1 / 96)));
    if (turn > BOT_TURN_PER_TIC)
        turn = BOT_TURN_PER_TIC;
    else if (turn < -BOT_TURN_PER_TIC)
        turn = -BOT_TURN_PER_TIC;
    cmd->angleturn = turn >> 16;
    bot_turns[maketic % BACKUPTICS] = cmd->angleturn;

    if (TicsSince(bot_focus_tic) >= BOT_REACTION_TICS
        && AimOffsetDegrees(player, target) <= BOT_FIRE_DEGREES
        && P_CheckSight(player, target))
    {
        cmd->buttons |= BT_ATTACK;
    }

    dist = DistanceUnits(player, target);
    cmd->forwardmove = dist < BOT_CLOSE_UNITS ? -BOT_WALK : dist > BOT_FAR_UNITS ? BOT_WALK : 0;
    cmd->sidemove = (leveltime / BOT_STRAFE_TICS) % 2 ? BOT_STRAFE : -BOT_STRAFE;
}

EMSCRIPTEN_KEEPALIVE
void set_autopilot(int on)
{
    autopilot = on;
    bot_focus_uid = 0;
}

EMSCRIPTEN_KEEPALIVE
int spawn_monster(int type, int species)
{
    mobj_t* player = players[consoleplayer].mo;
    int attempt;

    if (gamestate != GS_LEVEL || demoplayback || !player || player->health <= 0
        || type < 0 || type >= NUMMOBJTYPES)
    {
        return -1;
    }

    for (attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++)
    {
        fixed_t x, y;
        mobj_t* mo;

        SpotNearPlayer(player, attempt, &x, &y);
        mo = P_SpawnMobj(x, y, ONFLOORZ, type);
        if (!Fits(mo, x, y) || !P_CheckSight(player, mo))
        {
            P_RemoveMobj(mo);
            continue;
        }

        mo->uid = next_uid++;
        mo->species = species;
        mo->target = player;
        mo->angle = R_PointToAngle2(mo->x, mo->y, player->x, player->y);
        P_SetMobjState(mo, mo->info->seestate);
        TeleportFog(mo);
        totalkills++;

        js_event(EV_SPAWN, leveltime, mo->uid, species, 0, 0);
        return mo->uid;
    }

    return -1;
}

void Brain_FrameBegin(void)
{
    label_count = 0;
}

void Brain_SpriteProjected(mobj_t* thing, int x1, int x2, fixed_t texturemid, fixed_t xscale)
{
    int* out;

    if (thing->species < 0 || thing->health <= 0 || label_count >= MAX_LABELS)
    {
        return;
    }

    label_mobjs[label_count] = thing;
    out = &label_data[label_count * LABEL_FIELDS];
    out[0] = thing->uid;
    out[1] = viewwindowx + (x1 + x2) / 2;
    out[2] = viewwindowy + ((centeryfrac - FixedMul(texturemid, xscale)) >> FRACBITS);
    out[3] = xscale >> (FRACBITS - 8);
    label_count++;
}

// Sight checks bump validcount, which the BSP walk relies on, so they wait until the frame is drawn.
void Brain_FrameEnd(void)
{
    mobj_t* viewer = players[displayplayer].mo;
    int kept = 0;
    int i;

    for (i = 0; i < label_count; i++)
    {
        if (!viewer || !P_CheckSight(viewer, label_mobjs[i]))
        {
            continue;
        }
        memmove(&label_data[kept * LABEL_FIELDS], &label_data[i * LABEL_FIELDS], LABEL_FIELDS * sizeof(int));
        kept++;
    }
    js_labels(label_data, kept);
}
