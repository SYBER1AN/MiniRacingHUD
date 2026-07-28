-- This Source Code Form is subject to the terms of the bCDDL, v. 1.1.
-- If a copy of the bCDDL was not distributed with this
-- file, You can obtain one at http://beamng.com/bCDDL-1.1.txt

-- generic outgauge implementation based on LiveForSpeed
local M = {}

local hasShiftLights = false
local function init()
  local shiftLightControllers = controller.getControllersByType("shiftLights")
  hasShiftLights = shiftLightControllers and #shiftLightControllers > 0
end

local function reset() end
local function getAddress()        return settings.getValue("protocols_outgauge_address") end
local function getPort()           return settings.getValue("protocols_outgauge_port") end
local function getMaxUpdateRate()  return settings.getValue("protocols_outgauge_maxUpdateRate") end

local function isPhysicsStepUsed()
  return false
end

local function getStructDefinition()
  return [[
    unsigned       time;
    char           car[4];
    unsigned short flags;
    char           gear;
    char           plid;
    float          speed;
    float          rpm;
    float          turbo;
    float          engTemp;
    float          fuel;
    float          oilPressure;
    float          oilTemp;
    unsigned       dashLights;
    unsigned       showLights;
    float          throttle;
    float          brake;
    float          clutch;
    char           display1[16];    // Gear mode string (P,R,N,D,2,1,M3...)
    char           display2[16];
    int            id;
  ]]
end

local OG_SHIFT =     1
local OG_CTRL  =     2
local OG_TURBO =  8192
local OG_KM    = 16384
local OG_BAR   = 32768

local DL_SHIFT        = 2 ^ 0
local DL_FULLBEAM     = 2 ^ 1
local DL_HANDBRAKE    = 2 ^ 2
local DL_PITSPEED     = 2 ^ 3
local DL_TC           = 2 ^ 4
local DL_SIGNAL_L     = 2 ^ 5
local DL_SIGNAL_R     = 2 ^ 6
local DL_SIGNAL_ANY   = 2 ^ 7
local DL_OILWARN      = 2 ^ 8
local DL_BATTERY      = 2 ^ 9
local DL_ABS          = 2 ^ 10
local DL_SPARE        = 2 ^ 11

local function fillStruct(o, dtSim)
  if not electrics.values.watertemp then return end

  o.time = 0
  o.car = "beam"
  o.flags = OG_KM + OG_BAR + (electrics.values.turboBoost and OG_TURBO or 0)
  o.gear = electrics.values.gearIndex + 1
  o.plid = 0
  o.speed = electrics.values.wheelspeed or electrics.values.airspeed
  o.rpm = electrics.values.rpm or 0
  o.turbo = (electrics.values.turboBoost or 0) / 14.504
  o.engTemp = electrics.values.watertemp or 0
  o.fuel = electrics.values.fuel or 0
  o.oilPressure = 0
  o.oilTemp = electrics.values.oiltemp or 0

  o.dashLights = 0
  o.showLights = 0

  if electrics.values.highbeam ~= 0 then
    o.dashLights = bit.bor(o.dashLights, DL_FULLBEAM)
    o.showLights = bit.bor(o.showLights, DL_FULLBEAM)
  end
  if electrics.values.parkingbrake ~= 0 then
    o.dashLights = bit.bor(o.dashLights, DL_HANDBRAKE)
    o.showLights = bit.bor(o.showLights, DL_HANDBRAKE)
  end
  if electrics.values.signal_L ~= 0 then
    o.dashLights = bit.bor(o.dashLights, DL_SIGNAL_L)
    o.showLights = bit.bor(o.showLights, DL_SIGNAL_L)
  end
  if electrics.values.signal_R ~= 0 then
    o.dashLights = bit.bor(o.dashLights, DL_SIGNAL_R)
    o.showLights = bit.bor(o.showLights, DL_SIGNAL_R)
  end
  if electrics.values.hasABS and electrics.values.absActive ~= 0 then
    o.dashLights = bit.bor(o.dashLights, DL_ABS)
    o.showLights = bit.bor(o.showLights, DL_ABS)
  end
  if electrics.values.oil ~= 0 then
    o.dashLights = bit.bor(o.dashLights, DL_OILWARN)
    o.showLights = bit.bor(o.showLights, DL_OILWARN)
  end
  if electrics.values.engineRunning == 0 then
    o.dashLights = bit.bor(o.dashLights, DL_BATTERY)
    o.showLights = bit.bor(o.showLights, DL_BATTERY)
  end
  if electrics.values.hasESC and (electrics.values.esc ~= 0 or electrics.values.tcs ~= 0) then
    o.dashLights = bit.bor(o.dashLights, DL_TC)
    o.showLights = bit.bor(o.showLights, DL_TC)
  end
  if hasShiftLights and electrics.values.shouldShift then
    o.dashLights = bit.bor(o.dashLights, DL_SHIFT)
    o.showLights = bit.bor(o.showLights, DL_SHIFT)
  end

  o.throttle = electrics.values.throttle
  o.brake = electrics.values.brake
  o.clutch = electrics.values.clutch
  local gear = electrics.values.gear
  if type(gear) == "number" then
    if gear == -1 then gear = "R"
    elseif gear == 0 then gear = "N"
    else gear = tostring(gear) end
  end
  o.display1 = tostring(gear or "")
  o.display2 = ""
  o.id = 0
end

M.init = init
M.reset = reset
M.getAddress = getAddress
M.getPort = getPort
M.getMaxUpdateRate = getMaxUpdateRate
M.getStructDefinition = getStructDefinition
M.fillStruct = fillStruct
M.isPhysicsStepUsed = isPhysicsStepUsed

return M
