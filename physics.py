import numpy as np  

#constants 
MU = 398600.4418
J2 = 1.08263e-3
RE = 6378.137
ISP = 300.0
G0 = 9.80665 

#J2 acceleration vector 
#-> input value -> [x, y, z]
#-> output value -> [ax, ay, az]

def j2_acceleration(r):
    r = np.array(r)
    r_mag = np.linalg.norm(r)
    scalar = ((3/2) * J2 * MU * RE ** 2) / r_mag ** 5
    x_param = r[0] * (5 * r[2] ** 2 / r_mag ** 2 - 1)
    y_param = r[1] * (5 * r[2] ** 2 / r_mag ** 2 - 1)
    z_param = r[2] * (5 * r[2] ** 2 / r_mag ** 2 - 3)
    j2_accel = np.array([scalar * x_param, scalar * y_param, scalar * z_param])
    return j2_accel

#derivatives state -> total acceleration 
#-> input value -> [x, y, z, vx, vy, vz]
#-> output value -> [vx, vy, vz, ax, ay, az]

def derivatives(state):
    state = np.array(state)
    r = state[0:3]
    v = state[3:6]
    r_mag = np.linalg.norm(r)
    scalar = -1 * (MU / r_mag ** 3)
    a_j2 = j2_acceleration(r)
    acceleration = (scalar * r) + a_j2
    total_acceleration = np.concatenate([v, acceleration])
    return total_acceleration

#Range Kutta 4th order derivative to find out position with respect to the velocity and time forwarding

def rk4_step(state, dt):
    k1 = derivatives(state)
    k2 = derivatives(state + 0.5 * k1 * dt) 
    k3 = derivatives(state + 0.5 * k2 * dt)  
    k4 = derivatives(state + k3 * dt) 
    new_state = state + (dt / 6) * (k1 + 2*k2 + 2*k3 + k4)
    return new_state

#Propagation state, answers where is the satellite after x seconds 

def propagate(state, duration, dt = 10):
    state = np.array(state)
    for i in range(0, int(duration / dt)):
        state = rk4_step(state, dt)
    return state

#delta_v must be in m/s, not km/s tsiolkovsky equation helps us track the current mass of the rocket based on the depleting fuel resource

def tsiolkovsky(mass_current, delta_v):
    return mass_current * (1 - np.exp(-np.abs(delta_v) / (ISP * G0)))

#Orbital Period in seconds

def orbital_period(altitude_km):
    a = RE + altitude_km
    T = 2 * np.pi * np.sqrt(a ** 3 / MU)
    return T 


### TESTING AREA
# function testing
if __name__ == "__main__":
    print(j2_acceleration([2, 3, 4]))
    print(derivatives([2, 3, 4, 2, 3, 4]))
    state = np.array([6778.0, 0.0, 0.0, 0.0, 7.6, 0.0])
    print(rk4_step(state, 10))
    result = propagate(state, 5700, 10)
    print(np.linalg.norm(result[:3]))
    print(orbital_period(400))