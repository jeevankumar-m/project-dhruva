import matplotlib.pyplot as plt 
import numpy as np 
from physics import rk4_step

fig, ax = plt.subplots()
ax.set_xlim(-8000, 8000)
ax.set_ylim(-8000, 8000)
ax.set_xlabel("x(t)")
ax.set_ylabel("y(t)")
ax.set_title("satellite orbit")
ax.axis("equal")

earth = plt.Circle((0, 0), 6378, fill = False, color='blue')
ax.add_patch(earth)

satellite, = ax.plot([], [], 'g^')
debris, = ax.plot([], [], 'r^')
collision_marker, = ax.plot([], [], 'yo', markersize=8)
trail, = ax.plot([], [], 'green')
debris_trail, = ax.plot([], [], 'red')
burn_point, = ax.plot([], [], 'mo', markersize=6)

maneuver_started = False

state = np.array([6778, 0, 0, 0, 7.67, 0])
debris_state = np.array([6780, 0, 0, 0, -7.66, 0])


x_list = []
y_list = []

x_list_debris = []
y_list_debris = []

dt = 20
steps = 200
max_trail = 200

def predict_closest_approach(state, debris_state):
    test_state = state.copy()
    test_debris = debris_state.copy()

    min_distance = 1e9 
    collision_point = None 

    for i in range(200):
        test_state = rk4_step(test_state, dt)
        test_debris = rk4_step(test_debris, dt)

        dx = test_state[0] - test_debris[0]
        dy = test_state[1] - test_debris[1]

        distance = np.sqrt(dx * dx + dy * dy)
        if distance < min_distance:
            min_distance = distance
            collision_point = (test_state[0], test_state[1])

    return min_distance, collision_point


while(True):
    state = rk4_step(state, dt)
    debris_state = rk4_step(debris_state, dt)

    predicted_distance, collision_point = predict_closest_approach(state, debris_state)
    
    if collision_point != None:
        collision_marker.set_data([collision_point[0]], [collision_point[1]])

    debris_x = debris_state[0]
    debris_y = debris_state[1]
    x = state[0]
    y = state[1]

    dx = x - debris_x
    dy = y - debris_y

    distance = np.sqrt(dx * dx + dy * dy) 
    print(distance)

    if predicted_distance < 50 and not maneuver_started:
        print("CDM Warning: Close Approach")
        burn_point.set_data([x], [y])
        v = state[3:6]
        v_mag = np.linalg.norm(v)
        v_unit = v / v_mag 
        delta_v = 0.1
        delta_v_vector = v_unit * delta_v 
        state[3:6] = state[3:6] + delta_v_vector 
        maneuver_started = True 
 
    x_list.append(x)
    y_list.append(y)
    x_list_debris.append(debris_x)
    y_list_debris.append(debris_y)
    
    satellite.set_data([x], [y])
    debris.set_data([debris_x], [debris_y])

    trail.set_data(x_list, y_list)
    debris_trail.set_data(x_list_debris, y_list_debris)

    if len(x_list) > max_trail:
        x_list.pop(0)
        y_list.pop(0)
        x_list_debris.pop(0)
        y_list_debris.pop(0)

    plt.pause(0.1)

plt.show()