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
trail, = ax.plot([], [], 'green')
debris_trail, = ax.plot([], [], 'red')


state = np.array([6778, 0, 0, 0, 7.67, 0])
debris_state = np.array([6780, 0, 0, 0, -7.66, 0])


x_list = []
y_list = []

x_list_debris = []
y_list_debris = []

dt = 20
steps = 200
max_trail = 200

while(True):
    state = rk4_step(state, dt)
    debris_state = rk4_step(debris_state, dt)

    debris_x = debris_state[0]
    debris_y = debris_state[1]
    x = state[0]
    y = state[1]

    dx = x - debris_x
    dy = y - debris_y

    distance = np.sqrt(dx * dx + dy * dy) 
    print(distance)

    if distance < 100:
        print("CDM Warning: Close Approach")

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