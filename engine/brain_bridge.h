#ifndef BRAIN_BRIDGE_H
#define BRAIN_BRIDGE_H

#include "doomtype.h"
#include "p_mobj.h"
#include "d_ticcmd.h"

enum
{
    SENSOR_DIST,
    SENSOR_AIM_OFFSET,
    SENSOR_CAN_SEE,
    SENSOR_CAN_MELEE,
    SENSOR_CAN_SHOOT,
    SENSOR_HP,
    SENSOR_MAX_HP,
    SENSOR_HURT_AGO,
    SENSOR_PLAYER_HP,
    SENSOR_PLAYER_WEAPON,
    SENSOR_PLAYER_FIRED_AGO,
    SENSOR_PLAYER_SPEED,
    SENSOR_ALLIES_NEAR,
    SENSOR_ALIVE_TICS,
    SENSOR_COUNT
};

void Brain_InitMobj(mobj_t* mobj);
boolean Brain_Chase(mobj_t* actor);
void Brain_LevelStart(void);
void Brain_PlayerHit(mobj_t* player, mobj_t* source, int damage);
void Brain_MonsterHurt(mobj_t* target);
void Brain_MobjKilled(mobj_t* source, mobj_t* target);
void Brain_PlayerFired(int weapon);
boolean Brain_ShouldRespawn(void);
void Brain_Autopilot(ticcmd_t* cmd, int maketic);
void Brain_FrameBegin(void);
void Brain_SpriteProjected(mobj_t* thing, int x1, int x2, fixed_t texturemid, fixed_t xscale);
void Brain_FrameEnd(void);

#endif
