import numpy as np

def delta_m(m_current, delta_v, Isp, g0=9.81):
    return m_current * (1 - np.exp(-np.abs(delta_v) / (Isp * g0)))

# Example 1: single value
m_current = 1000
delta_v = 500
Isp = 300

dm = delta_m(m_current, delta_v, Isp)
print("Delta m:", dm)

# Example 2: multiple delta-v values
delta_v_values = np.array([100, 200, 300, 400, 500])

dm_values = delta_m(m_current, delta_v_values, Isp)
print("Delta m values:", dm_values)
